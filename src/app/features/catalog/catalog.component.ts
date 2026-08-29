import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Observable } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { CartService } from '../../core/cart.service';
import { BranchStock, Category, Product, ProductVariant } from '../../core/models';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-catalog',
  imports: [ReactiveFormsModule, DecimalPipe],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  private readonly api = inject(StoreApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly runtime = inject(RuntimeConfigService);

  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loading = signal(true);
  readonly editorOpen = signal(false);
  readonly saving = signal(false);
  readonly favoriteIds = signal<Set<number>>(new Set());
  readonly availability = signal<BranchStock[]>([]);
  readonly selectedBranchId = signal<number | null>(null);
  readonly reserving = signal(false);

  // AI Concierge
  readonly aiQueryControl = new FormControl('', { nonNullable: true });

  // Filters
  readonly selectedCategory = signal<number | null>(null);
  readonly selectedGender = signal<string>('TODOS');
  readonly maxPriceFilter = signal<number | null>(null);
  readonly search = new FormControl('', { nonNullable: true });

  // Product detail & variant modal
  readonly detailModalOpen = signal(false);
  readonly loadingDetail = signal(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedColor = signal<string | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly selectedQty = signal<number>(1);

  // Form for admin new product
  readonly form = this.fb.nonNullable.group({
    categoria_id: [0, [Validators.required, Validators.min(1)]],
    nombre: ['', [Validators.required, Validators.minLength(2)]],
    descripcion: [''],
    marca: [''],
    material: [''],
    precio: [0, [Validators.required, Validators.min(0)]],
    calidad_nivel: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    genero_objetivo: ['UNISEX'],
  });

  readonly availableColors = computed(() => {
    const p = this.selectedProduct();
    if (!p?.variantes) return [];
    const map = new Map<string, string | null>();
    p.variantes.forEach((v) => {
      if (!map.has(v.color)) {
        map.set(v.color, v.codigo_color || '#333333');
      }
    });
    return Array.from(map.entries()).map(([color, hex]) => ({ color, hex }));
  });

  readonly availableSizes = computed(() => {
    const p = this.selectedProduct();
    const color = this.selectedColor();
    if (!p?.variantes) return [];
    return p.variantes
      .filter((v) => !color || v.color === color)
      .map((v) => ({
        talla: v.talla,
        stock: v.stock_disponible,
        variantId: v.id,
      }));
  });

  readonly activeVariant = computed(() => {
    const p = this.selectedProduct();
    const color = this.selectedColor();
    const size = this.selectedSize();
    if (!p?.variantes || !color || !size) return null;
    return p.variantes.find((v) => v.color === color && v.talla === size) || null;
  });

  readonly selectedVariantAvailability = computed(() => {
    const variantId = this.activeVariant()?.id;
    return variantId
      ? this.availability().filter(
          (row) => row.variante_id === variantId && row.stock_disponible > 0,
        )
      : [];
  });

  constructor() {
    this.load();
    this.route.queryParamMap.subscribe((params) => {
      const productId = Number(params.get('product'));
      if (Number.isInteger(productId) && productId > 0) {
        this.openProductById(productId);
      }
    });
    this.search.valueChanges
      .pipe(debounceTime(280), distinctUntilChanged())
      .subscribe(() => this.loadProducts());
  }

  private openProductById(productId: number): void {
    this.detailModalOpen.set(true);
    this.loadingDetail.set(true);
    this.api.product(productId).subscribe({
      next: (product) => {
        this.selectedProduct.set(product);
        this.selectedQty.set(1);
        const first = product.variantes?.find(
          (variant) => variant.activo && variant.stock_disponible > 0,
        ) ?? product.variantes?.[0];
        this.selectedColor.set(first?.color ?? null);
        this.selectedSize.set(first?.talla ?? null);
        this.loadingDetail.set(false);
        this.loadAvailability(product.id);
      },
      error: () => {
        this.loadingDetail.set(false);
        this.detailModalOpen.set(false);
        this.toast.show('No se pudo abrir la ficha de la prenda', 'error');
      },
    });
  }

  load(): void {
    forkJoin({
      categories: this.api.categories(),
      products: this.api.products({ limit: 60 }),
      favorites: this.api.favorites(),
    }).subscribe({
      next: ({ categories, products, favorites }) => {
        this.categories.set(categories);
        this.products.set(products);
        this.favoriteIds.set(new Set(favorites.map((product) => product.id)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadProducts(): void {
    this.loading.set(true);
    const gender = this.selectedGender() === 'TODOS' ? undefined : this.selectedGender();
    this.api
      .products({
        q: this.search.value,
        categoria_id: this.selectedCategory(),
        gender: gender,
        max_price: this.maxPriceFilter(),
        limit: 60,
        con_stock: false,
      })
      .subscribe({
        next: (products) => {
          this.products.set(products);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  chooseCategory(id: number | null): void {
    this.selectedCategory.set(id);
    this.loadProducts();
  }

  chooseGender(gender: string): void {
    this.selectedGender.set(gender);
    this.loadProducts();
  }

  chooseMaxPrice(max: number | null): void {
    this.maxPriceFilter.set(max);
    this.loadProducts();
  }

  filterByCollection(theme: 'CENA' | 'POLERAS_TOP' | 'CASUAL_ECONOMICO' | 'TODOS'): void {
    if (theme === 'POLERAS_TOP') {
      this.search.setValue('Polera');
      this.maxPriceFilter.set(null);
      this.selectedCategory.set(null);
    } else if (theme === 'CASUAL_ECONOMICO') {
      this.search.setValue('');
      this.maxPriceFilter.set(300);
      this.selectedCategory.set(null);
    } else if (theme === 'CENA') {
      this.search.setValue('Camisa');
      this.maxPriceFilter.set(null);
      this.selectedCategory.set(null);
    } else {
      this.search.setValue('');
      this.maxPriceFilter.set(null);
      this.selectedCategory.set(null);
      this.selectedGender.set('TODOS');
    }
    this.loadProducts();
  }

  onConciergeSearch(): void {
    const query = this.aiQueryControl.value.trim();
    if (query) {
      this.search.setValue(query);
      this.loadProducts();
    }
  }

  askAiFromCatalog(): void {
    const query = this.aiQueryControl.value.trim();
    if (!query) return;
    void this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: `Recomiéndame opciones para: ${query}. Explica cuál conviene más.`,
      },
    });
  }

  askAiAboutProduct(product: Product): void {
    this.closeDetail();
    void this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: `Completa un outfit a partir de ${product.nombre}, producto ${product.id}, con stock real.`,
      },
    });
  }

  openProductDetail(product: Product): void {
    this.loadingDetail.set(true);
    this.detailModalOpen.set(true);
    this.selectedProduct.set(product);
    this.selectedQty.set(1);

    this.api.product(product.id).subscribe({
      next: (fullProduct) => {
        this.selectedProduct.set(fullProduct);
        if (fullProduct.variantes && fullProduct.variantes.length > 0) {
          const first = fullProduct.variantes[0];
          this.selectedColor.set(first.color);
          this.selectedSize.set(first.talla);
        }
        this.loadingDetail.set(false);
        this.loadAvailability(fullProduct.id);
      },
      error: () => {
        this.loadingDetail.set(false);
      },
    });
  }

  closeDetail(): void {
    this.detailModalOpen.set(false);
    this.selectedProduct.set(null);
    this.availability.set([]);
    this.selectedBranchId.set(null);
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
    const sizes = this.availableSizes();
    if (sizes.length > 0 && !sizes.some((s) => s.talla === this.selectedSize())) {
      this.selectedSize.set(sizes[0].talla);
    }
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
    this.selectedBranchId.set(null);
  }

  private loadAvailability(productId: number): void {
    this.api.productAvailability(productId).subscribe({
      next: (rows) => {
        this.availability.set(rows);
        const first = rows.find((row) => row.variante_id === this.activeVariant()?.id);
        this.selectedBranchId.set(first?.sucursal_id ?? null);
      },
      error: () => this.availability.set([]),
    });
  }

  toggleFavorite(product: Product, event?: Event): void {
    event?.stopPropagation();
    const isFavorite = this.favoriteIds().has(product.id);
    const request: Observable<unknown> = isFavorite
      ? this.api.removeFavorite(product.id)
      : this.api.addFavorite(product.id);
    request.subscribe({
      next: () => {
        this.favoriteIds.update((current) => {
          const next = new Set(current);
          isFavorite ? next.delete(product.id) : next.add(product.id);
          return next;
        });
        this.toast.show(
          isFavorite ? 'Prenda retirada de favoritos' : 'Prenda guardada en favoritos',
          'success',
        );
      },
      error: () => this.toast.show('No se pudo actualizar favoritos', 'error'),
    });
  }

  reserveSelected(): void {
    const variant = this.activeVariant();
    const branchId = this.selectedBranchId();
    if (!variant || !branchId || this.reserving()) {
      this.toast.show('Selecciona una talla y un showroom con stock', 'error');
      return;
    }
    this.reserving.set(true);
    this.api
      .createReservation(branchId, [{ variante_id: variant.id, cantidad: this.selectedQty() }])
      .pipe(finalize(() => this.reserving.set(false)))
      .subscribe({
        next: (reservation) => {
          this.toast.show(`Reserva #${reservation.id} creada por 48 horas`, 'success');
          this.closeDetail();
          void this.router.navigate(['/reservations']);
        },
        error: (error) =>
          this.toast.show(
            error?.error?.detail ?? 'No se pudo reservar en ese showroom',
            'error',
          ),
      });
  }

  changeQty(delta: number): void {
    const next = this.selectedQty() + delta;
    const max = this.activeVariant()?.stock_disponible ?? 10;
    if (next >= 1 && next <= max) {
      this.selectedQty.set(next);
    }
  }

  addToCartFromModal(): void {
    const variant = this.activeVariant();
    if (!variant) {
      this.toast.show('Selecciona color y talla primero', 'error');
      return;
    }
    this.cart.addItem(variant.id, this.selectedQty());
    this.closeDetail();
  }

  buyNowFromModal(): void {
    const variant = this.activeVariant();
    if (!variant) {
      this.toast.show('Selecciona color y talla primero', 'error');
      return;
    }
    this.cart.addItem(variant.id, this.selectedQty());
    this.closeDetail();
    this.cart.open();
  }

  saveProduct(): void {
    if (this.form.invalid || this.saving()) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    const value = this.form.getRawValue();
    this.api
      .createProduct({
        ...value,
        genero_objetivo: value.genero_objetivo as Product['genero_objetivo'],
        costo_referencia: null,
        descripcion_ai: null,
        tags_ai: [],
        imagenes: [],
        activo: true,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.editorOpen.set(false);
          this.form.reset({
            categoria_id: 0,
            nombre: '',
            descripcion: '',
            marca: '',
            material: '',
            precio: 0,
            calidad_nivel: 3,
            genero_objetivo: 'UNISEX',
          });
          this.toast.show('Producto creado. Agrega sus variantes en inventario.', 'success');
          this.loadProducts();
        },
        error: (error) => {
          this.saving.set(false);
          this.toast.show(error?.error?.detail ?? 'No se pudo crear el producto', 'error');
        },
      });
  }

  imageUrl(product: Product): string | null {
    const first = product.imagenes?.[0];
    let raw: string | null = null;
    if (typeof first === 'string') raw = first;
    else if (first?.url) raw = first.url;
    if (!raw) return null;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:')) return raw;
    if (raw.startsWith('/')) return `${this.runtime.backendUrl}${raw}`;
    return `${this.runtime.backendUrl}/${raw}`;
  }

  onImageError(product: Product): void {
    product.imagenes = [];
  }
}
