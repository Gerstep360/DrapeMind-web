import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ToastService } from '@core/toast.service';
import { Category, Product, ProductVariant } from '@core/models';

@Component({
  selector: 'app-categories-variants',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './categories-variants.component.html',
  styleUrl: './categories-variants.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoriesVariantsComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly activeTab = signal<'categories' | 'variants'>('categories');
  readonly categories = signal<Category[]>([]);
  readonly variants = signal<ProductVariant[]>([]);
  readonly products = signal<Product[]>([]);
  readonly loading = signal(false);

  // Filters
  readonly searchQuery = signal('');
  readonly selectedProductId = signal<number | null>(null);

  // Modals
  readonly categoryModalOpen = signal(false);
  readonly editingCategory = signal<Category | null>(null);
  readonly variantModalOpen = signal(false);
  readonly editingVariant = signal<ProductVariant | null>(null);

  categoryForm!: FormGroup;
  variantForm!: FormGroup;

  ngOnInit(): void {
    this.initForms();
    this.loadData();
  }

  private initForms(): void {
    this.categoryForm = this.fb.group({
      nombre: ['', [Validators.required, Validators.minLength(2)]],
      slug: ['', [Validators.required, Validators.pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)]],
      descripcion: [''],
      parent_id: [null],
      activo: [true],
    });

    this.variantForm = this.fb.group({
      producto_id: [null, [Validators.required]],
      sku: ['', [Validators.required, Validators.minLength(3)]],
      color: ['', [Validators.required]],
      codigo_color: ['#10110F'],
      talla: ['M', [Validators.required]],
      stock_total: [0, [Validators.required, Validators.min(0)]],
      codigo_barras: [''],
      imagen: [''],
      activo: [true],
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.adminApi.listCategories().subscribe({
      next: (cats) => {
        this.categories.set(cats);
        this.adminApi.listProducts({ limit: 100 }).subscribe({
          next: (prods) => {
            this.products.set(prods);
            this.adminApi.listVariants({ limit: 100 }).subscribe({
              next: (vars) => {
                this.variants.set(vars);
                this.loading.set(false);
              },
              error: () => this.loading.set(false),
            });
          },
          error: () => this.loading.set(false),
        });
      },
      error: (err) => {
        this.toasts.show('Error al cargar categorías: ' + (err.error?.detail || err.message), 'error');
        this.loading.set(false);
      },
    });
  }

  filteredCategories(): Category[] {
    const q = this.searchQuery().trim().toLowerCase();
    return this.categories().filter((c) => {
      return !q || c.nombre.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
    });
  }

  filteredVariants(): ProductVariant[] {
    const q = this.searchQuery().trim().toLowerCase();
    const prodId = this.selectedProductId();
    return this.variants().filter((v) => {
      const matchProd = prodId === null || v.producto_id === prodId;
      const matchQ =
        !q ||
        v.sku.toLowerCase().includes(q) ||
        v.color.toLowerCase().includes(q) ||
        v.talla.toLowerCase().includes(q) ||
        (v.producto && v.producto.toLowerCase().includes(q));
      return matchProd && matchQ;
    });
  }

  getCategoryName(id: number | null): string {
    if (!id) return 'Ninguna (Categoría raíz)';
    const c = this.categories().find((cat) => cat.id === id);
    return c ? c.nombre : 'ID #' + id;
  }

  // --- Category Actions ---
  openNewCategoryModal(): void {
    this.editingCategory.set(null);
    this.categoryForm.reset({
      nombre: '',
      slug: '',
      descripcion: '',
      parent_id: null,
      activo: true,
    });
    this.categoryModalOpen.set(true);
  }

  openEditCategoryModal(cat: Category): void {
    this.editingCategory.set(cat);
    this.categoryForm.patchValue({
      nombre: cat.nombre,
      slug: cat.slug,
      descripcion: cat.descripcion || '',
      parent_id: cat.parent_id,
      activo: cat.activo,
    });
    this.categoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
  }

  generateSlugFromName(): void {
    const name = this.categoryForm.get('nombre')?.value || '';
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[\s\W-]+/g, '-')
      .replace(/^-+|-+$/g, '');
    this.categoryForm.patchValue({ slug });
  }

  saveCategory(): void {
    if (this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const val = this.categoryForm.value;
    const editing = this.editingCategory();

    if (editing) {
      this.adminApi.updateCategory(editing.id, val).subscribe({
        next: () => {
          this.toasts.show(`Categoría "${val.nombre}" actualizada`, 'info');
          this.closeCategoryModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar categoría: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createCategory(val).subscribe({
        next: () => {
          this.toasts.show(`Categoría "${val.nombre}" creada`, 'info');
          this.closeCategoryModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al crear categoría: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleCategoryStatus(cat: Category): void {
    this.adminApi.deleteCategory(cat.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadData();
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // --- Variant Actions ---
  openNewVariantModal(): void {
    this.editingVariant.set(null);
    const firstProd = this.products().length > 0 ? this.products()[0].id : null;
    this.variantForm.reset({
      producto_id: this.selectedProductId() || firstProd,
      sku: '',
      color: 'Negro Atelier',
      codigo_color: '#10110F',
      talla: 'M',
      stock_total: 10,
      codigo_barras: '',
      imagen: '',
      activo: true,
    });
    this.variantModalOpen.set(true);
  }

  openEditVariantModal(v: ProductVariant): void {
    this.editingVariant.set(v);
    this.variantForm.patchValue({
      producto_id: v.producto_id,
      sku: v.sku,
      color: v.color,
      codigo_color: v.codigo_color || '#10110F',
      talla: v.talla,
      stock_total: v.stock_total,
      codigo_barras: (v as any).codigo_barras || '',
      imagen: v.imagen || '',
      activo: v.activo,
    });
    this.variantModalOpen.set(true);
  }

  closeVariantModal(): void {
    this.variantModalOpen.set(false);
  }

  saveVariant(): void {
    if (this.variantForm.invalid) {
      this.variantForm.markAllAsTouched();
      return;
    }
    const val = this.variantForm.value;
    const editing = this.editingVariant();

    if (editing) {
      this.adminApi.updateVariant(editing.id, val).subscribe({
        next: () => {
          this.toasts.show(`Variante SKU "${val.sku}" actualizada`, 'info');
          this.closeVariantModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar variante: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createVariant(val.producto_id, val).subscribe({
        next: () => {
          this.toasts.show(`Variante SKU "${val.sku}" registrada`, 'info');
          this.closeVariantModal();
          this.loadData();
        },
        error: (err) => {
          this.toasts.show('Error al crear variante: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleVariantStatus(v: ProductVariant): void {
    this.adminApi.deleteVariant(v.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadData();
      },
      error: (err) => {
        this.toasts.show('Error al cambiar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  getProductName(prodId: number): string {
    const p = this.products().find((prod) => prod.id === prodId);
    return p ? p.nombre : 'Producto #' + prodId;
  }
}
