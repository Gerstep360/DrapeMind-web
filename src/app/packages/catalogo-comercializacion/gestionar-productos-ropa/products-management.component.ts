import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AdminApiService } from '@core/api/admin-api.service';
import { ToastService } from '@core/toast.service';
import { Category, Product } from '@core/models';

import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-products-management',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './products-management.component.html',
  styleUrl: './products-management.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductsManagementComponent implements OnInit {
  private readonly adminApi = inject(AdminApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toasts = inject(ToastService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(false);
  readonly aiDrafting = signal(false);
  readonly imageUploading = signal(false);

  // Filters
  readonly searchQuery = signal('');
  readonly selectedCategoryId = signal<number | null>(null);
  readonly selectedGender = signal<string>('TODOS');
  readonly filterActiveOnly = signal<boolean | null>(null);

  // Modal
  readonly productModalOpen = signal(false);
  readonly editingProduct = signal<Product | null>(null);
  readonly previewImageUrl = signal<string | null>(null);

  productForm!: FormGroup;

  readonly genders = ['HOMBRE', 'MUJER', 'UNISEX'];

  ngOnInit(): void {
    this.initForm();
    this.loadCategories();
    this.loadProducts();
  }

  private initForm(): void {
    this.productForm = this.fb.group({
      categoria_id: [null, [Validators.required]],
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      marca: ['DrapeMind Atelier'],
      material: ['', [Validators.required]],
      precio: [0, [Validators.required, Validators.min(1)]],
      costo_referencia: [null],
      calidad_nivel: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
      genero_objetivo: ['UNISEX', [Validators.required]],
      descripcion: [''],
      descripcion_ai: [''],
      imagenes: [[]],
      activo: [true],
    });
  }

  loadCategories(): void {
    this.adminApi.listCategories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    this.adminApi
      .listProducts({
        categoria_id: this.selectedCategoryId() || undefined,
        genero: this.selectedGender() === 'TODOS' ? undefined : this.selectedGender(),
        activo: this.filterActiveOnly() === null ? undefined : this.filterActiveOnly()!,
        limit: 100,
      })
      .subscribe({
        next: (data) => {
          this.products.set(data);
          this.loading.set(false);
        },
        error: (err) => {
          this.toasts.show('Error al cargar catálogo: ' + (err.error?.detail || err.message), 'error');
          this.loading.set(false);
        },
      });
  }

  filteredProducts(): Product[] {
    const q = this.searchQuery().trim().toLowerCase();
    return this.products().filter((p) => {
      return (
        !q ||
        p.nombre.toLowerCase().includes(q) ||
        (p.marca && p.marca.toLowerCase().includes(q)) ||
        (p.material && p.material.toLowerCase().includes(q))
      );
    });
  }

  openNewProductModal(): void {
    this.editingProduct.set(null);
    this.previewImageUrl.set(null);
    const firstCat = this.categories().length > 0 ? this.categories()[0].id : null;
    this.productForm.reset({
      categoria_id: this.selectedCategoryId() || firstCat,
      nombre: '',
      marca: 'DrapeMind Atelier',
      material: 'Lino y Algodón Pima',
      precio: 180,
      costo_referencia: 90,
      calidad_nivel: 3,
      genero_objetivo: 'UNISEX',
      descripcion: '',
      descripcion_ai: '',
      imagenes: [],
      activo: true,
    });
    this.productModalOpen.set(true);
  }

  openEditProductModal(p: Product): void {
    this.editingProduct.set(p);
    const imgUrl = this.extractFirstImage(p.imagenes);
    this.previewImageUrl.set(imgUrl);

    this.productForm.patchValue({
      categoria_id: p.categoria_id,
      nombre: p.nombre,
      marca: p.marca || 'DrapeMind Atelier',
      material: p.material || '',
      precio: p.precio,
      costo_referencia: p.costo_referencia,
      calidad_nivel: p.calidad_nivel || 3,
      genero_objetivo: p.genero_objetivo || 'UNISEX',
      descripcion: p.descripcion || '',
      descripcion_ai: p.descripcion_ai || '',
      imagenes: p.imagenes || [],
      activo: p.activo,
    });
    this.productModalOpen.set(true);
  }

  closeProductModal(): void {
    this.productModalOpen.set(false);
  }

  saveProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }
    const val = this.productForm.value;
    const editing = this.editingProduct();

    if (editing) {
      this.adminApi.updateProduct(editing.id, val).subscribe({
        next: () => {
          this.toasts.show(`Prenda "${val.nombre}" actualizada`, 'info');
          this.closeProductModal();
          this.loadProducts();
        },
        error: (err) => {
          this.toasts.show('Error al actualizar prenda: ' + (err.error?.detail || err.message), 'error');
        },
      });
    } else {
      this.adminApi.createProduct(val).subscribe({
        next: () => {
          this.toasts.show(`Prenda "${val.nombre}" creada en el catálogo`, 'info');
          this.closeProductModal();
          this.loadProducts();
        },
        error: (err) => {
          this.toasts.show('Error al registrar prenda: ' + (err.error?.detail || err.message), 'error');
        },
      });
    }
  }

  toggleProductStatus(p: Product): void {
    this.adminApi.deleteProduct(p.id).subscribe({
      next: (res) => {
        this.toasts.show(res.message || 'Estado actualizado', 'info');
        this.loadProducts();
      },
      error: (err) => {
        this.toasts.show('Error al alternar estado: ' + (err.error?.detail || err.message), 'error');
      },
    });
  }

  // File Upload
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    const file = input.files[0];

    this.imageUploading.set(true);
    this.adminApi.uploadProductImage(file).subscribe({
      next: (res) => {
        this.previewImageUrl.set(res.url);
        const currentImgs = this.productForm.get('imagenes')?.value || [];
        this.productForm.patchValue({
          imagenes: [res.url, ...currentImgs],
        });
        this.imageUploading.set(false);
        this.toasts.show('Fotografía subida correctamente', 'info');
      },
      error: (err) => {
        this.toasts.show('Error al subir imagen: ' + (err.error?.detail || err.message), 'error');
        this.imageUploading.set(false);
      },
    });
  }

  setManualImageUrl(url: string): void {
    if (!url) return;
    this.previewImageUrl.set(url);
    this.productForm.patchValue({
      imagenes: [url],
    });
  }

  // AI Assistant Integration (CU-25)
  generateAiDescription(): void {
    const nombre = this.productForm.get('nombre')?.value;
    if (!nombre) {
      this.toasts.show('Ingresa al menos el nombre de la prenda para redactar con IA', 'info');
      return;
    }
    const material = this.productForm.get('material')?.value || 'Alta costura';
    this.aiDrafting.set(true);

    this.adminApi
      .assistProductDraft({
        nombre_borrador: nombre,
        material: material,
        estilo_objetivo: 'Atelier de lujo y sastrería elegante',
      })
      .subscribe({
        next: (res) => {
          this.productForm.patchValue({
            descripcion: res.descripcion_editorial,
            descripcion_ai: res.guia_cuidado,
          });
          this.aiDrafting.set(false);
          this.toasts.show('Descripción editorial redactada por Altair AI', 'info');
        },
        error: () => {
          this.aiDrafting.set(false);
          this.toasts.show('No se pudo conectar con el redactor de IA', 'error');
        },
      });
  }

  extractFirstImage(imagenes: any[] | undefined): string | null {
    if (!imagenes || imagenes.length === 0) return null;
    const first = imagenes[0];
    if (typeof first === 'string') return first;
    return first?.url || null;
  }

  getCategoryName(catId: number): string {
    const c = this.categories().find((cat) => cat.id === catId);
    return c ? c.nombre : 'Cat #' + catId;
  }

  // Metrics
  activeProductsCount(): number {
    return this.products().filter((p) => p.activo).length;
  }

  lowStockProductsCount(): number {
    return this.products().filter((p) => (p.stock_disponible || 0) <= 2).length;
  }

  averageQuality(): number {
    if (this.products().length === 0) return 0;
    const sum = this.products().reduce((acc, p) => acc + (p.calidad_nivel || 3), 0);
    return Math.round((sum / this.products().length) * 10) / 10;
  }
}
