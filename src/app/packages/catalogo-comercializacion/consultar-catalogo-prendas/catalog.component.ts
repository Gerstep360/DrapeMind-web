import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { debounceTime, distinctUntilChanged, finalize, forkJoin, Observable } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { BranchService } from '@core/branch.service';
import { CartService } from '@core/cart.service';
import { BranchStock, Category, Product, ProductVariant } from '@core/models';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { ReservationsApiService } from '@core/api/reservations-api.service';
import { ToastService } from '@core/toast.service';
import { ProductCardComponent } from '@shared/components/catalog/product-card/product-card.component';
import { ProductDetailModalComponent } from '@packages/catalogo-comercializacion/consultar-detalle-talla-color-variante/product-detail-modal.component';
import {
  ProductDetailAction,
  ProductDetailState,
} from '@packages/catalogo-comercializacion/consultar-detalle-talla-color-variante/product-detail-modal.models';
import { CatalogFiltersComponent } from '@packages/catalogo-comercializacion/buscar-filtrar-prendas/catalog-filters.component';
import {
  CatalogFilterAction,
  CatalogFilterState,
} from '@packages/catalogo-comercializacion/buscar-filtrar-prendas/catalog-filters.models';

@Component({
  selector: 'app-catalog',
  imports: [
    ReactiveFormsModule,
    ProductCardComponent,
    ProductDetailModalComponent,
    CatalogFiltersComponent,
  ],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly branchService = inject(BranchService);
  private readonly api = inject(CatalogApiService);
  private readonly reservationsApi = inject(ReservationsApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

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
  readonly aiPanelOpen = signal<boolean>(false);
  readonly altairCatalogContext = computed(() => {
    const visible = this.products().length;
    const branch = this.branchService.selectedBranch()?.nombre || 'sin sucursal elegida';
    const query = this.search.value.trim();
    return `${visible} prendas visibles; sucursal ${branch}${query ? `; búsqueda actual: ${query}` : ''}.`;
  });

  readonly catalogFilterState = computed<CatalogFilterState>(() => ({
    categories: this.categories(),
    selectedCategoryId: this.selectedCategory(),
    selectedGender: this.selectedGender(),
    maximumPrice: this.maxPriceFilter(),
    searchControl: this.search,
    altairOpen: this.aiPanelOpen(),
    altairContext: this.altairCatalogContext(),
  }));

  // Pagination (+8000 items)
  readonly offset = signal<number>(0);
  readonly limit = 48;
  readonly hasMore = signal<boolean>(true);
  readonly loadingMore = signal<boolean>(false);

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
      if (v.activo && !map.has(v.color)) {
        map.set(v.color, v.codigo_color || '#333333');
      }
    });
    return Array.from(map.entries()).map(([color, hex]) => ({ color, hex: hex || '#333333' }));
  });

  readonly availableSizes = computed(() => {
    const p = this.selectedProduct();
    const color = this.selectedColor();
    if (!p?.variantes || !color) return [];
    return p.variantes
      .filter((v) => v.color === color && v.activo)
      .map((v) => ({ talla: v.talla, stock: v.stock_disponible }));
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

  readonly currentBranchStock = computed(() => {
    const bId = this.selectedBranchId();
    if (!bId) return 0;
    const match = this.selectedVariantAvailability().find((row) => row.sucursal_id === bId);
    return match ? match.stock_disponible : 0;
  });

  readonly currentBranchName = computed(() => {
    const bId = this.selectedBranchId();
    if (!bId) return 'Sede no seleccionada';
    return this.branchName(bId);
  });

  readonly productDetailState = computed<ProductDetailState>(() => {
    const product = this.selectedProduct();
    return {
      open: this.detailModalOpen(),
      loading: this.loadingDetail(),
      product,
      favorite: product ? this.favoriteIds().has(product.id) : false,
      colors: this.availableColors(),
      sizes: this.availableSizes(),
      selectedColor: this.selectedColor(),
      selectedSize: this.selectedSize(),
      selectedQuantity: this.selectedQty(),
      activeVariant: this.activeVariant(),
      branchAvailability: this.selectedVariantAvailability(),
      branchNames: Object.fromEntries(
        this.branchService.branches().map((branch) => [branch.id, branch.nombre]),
      ),
      selectedBranchId: this.selectedBranchId(),
      selectedBranchStock: this.currentBranchStock(),
      selectedBranchName: this.currentBranchName(),
      reserving: this.reserving(),
    };
  });

  constructor() {
    this.branchService.loadBranches();
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
        const first =
          product.variantes?.find((variant) => variant.activo && variant.stock_disponible > 0) ??
          product.variantes?.[0];
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
      products: this.api.products({ limit: this.limit, offset: 0 }),
      favorites: this.api.favorites(),
    }).subscribe({
      next: ({ categories, products, favorites }) => {
        this.categories.set(categories);
        this.products.set(products);
        this.offset.set(products.length);
        this.hasMore.set(products.length >= this.limit);
        this.favoriteIds.set(new Set(favorites.map((product) => product.id)));
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  loadProducts(append = false): void {
    if (append) {
      if (this.loadingMore() || !this.hasMore()) return;
      this.loadingMore.set(true);
    } else {
      this.loading.set(true);
      this.offset.set(0);
      this.hasMore.set(true);
    }

    const currentOffset = append ? this.offset() : 0;
    const gender = this.selectedGender() === 'TODOS' ? undefined : this.selectedGender();
    const query = this.search.value.trim() || undefined;

    this.api
      .products({
        q: query,
        categoria_id: this.selectedCategory(),
        genero: gender,
        precio_max: this.maxPriceFilter(),
        offset: currentOffset,
        limit: this.limit,
        con_stock: false,
      })
      .subscribe({
        next: (incoming) => {
          if (append) {
            this.products.update((prev) => [...prev, ...incoming]);
            this.offset.set(currentOffset + incoming.length);
            this.loadingMore.set(false);
          } else {
            this.products.set(incoming);
            this.offset.set(incoming.length);
            this.loading.set(false);
          }
          this.hasMore.set(incoming.length >= this.limit);
        },
        error: () => {
          if (append) this.loadingMore.set(false);
          else this.loading.set(false);
        },
      });
  }

  loadMore(): void {
    this.loadProducts(true);
  }

  resetFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.selectedGender.set('TODOS');
    this.selectedCategory.set(null);
    this.maxPriceFilter.set(null);
    this.loadProducts(false);
  }

  chooseCategory(id: number | null): void {
    this.selectedCategory.set(id);
    this.loadProducts(false);
  }

  chooseGender(gender: string): void {
    this.selectedGender.set(gender);
    this.loadProducts(false);
  }

  chooseMaxPrice(max: number | null): void {
    this.maxPriceFilter.set(max);
    this.loadProducts(false);
  }

  toggleAiPanel(): void {
    this.aiPanelOpen.update((v) => !v);
  }

  handleCatalogFilterAction(action: CatalogFilterAction): void {
    switch (action.type) {
      case 'toggle-altair':
        this.toggleAiPanel();
        break;
      case 'select-category':
        this.chooseCategory(action.categoryId);
        break;
      case 'select-gender':
        this.chooseGender(action.gender);
        break;
      case 'select-maximum-price':
        this.chooseMaxPrice(action.maximumPrice);
        break;
    }
  }

  askAiAboutProduct(product: Product): void {
    this.closeDetail();
    void this.router.navigate(['/ai-studio'], {
      queryParams: {
        autoQuery: `Completa un outfit a partir de ${product.nombre}, usando stock real de la sucursal seleccionada.`,
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

  branchName(branchId: number): string {
    const branch = this.branchService.branches().find((b) => b.id === branchId);
    return branch ? branch.nombre : `Sucursal #${branchId}`;
  }

  onBranchChange(branchId: number): void {
    if (!branchId) return;
    this.selectedBranchId.set(branchId);
    const branch = this.branchService.branches().find((b) => b.id === branchId);
    if (branch) {
      this.branchService.selectBranch(branch);
    }
  }

  private syncSelectedBranchWithAvailability(rows?: BranchStock[]): void {
    const variantId = this.activeVariant()?.id;
    const avail = (rows ?? this.availability()).filter(
      (row) => row.variante_id === variantId && row.stock_disponible > 0,
    );
    if (avail.length === 0) {
      this.selectedBranchId.set(null);
      return;
    }
    const preferredId = this.branchService.selectedBranchId();
    const matching = avail.find((r) => r.sucursal_id === preferredId);
    if (matching) {
      this.selectedBranchId.set(matching.sucursal_id);
    } else {
      this.selectedBranchId.set(avail[0].sucursal_id);
    }
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
    const sizes = this.availableSizes();
    if (sizes.length > 0 && !sizes.some((s) => s.talla === this.selectedSize())) {
      this.selectedSize.set(sizes[0].talla);
    }
    this.syncSelectedBranchWithAvailability();
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
    this.syncSelectedBranchWithAvailability();
  }

  private loadAvailability(productId: number): void {
    this.api.productAvailability(productId).subscribe({
      next: (rows) => {
        this.availability.set(rows);
        this.syncSelectedBranchWithAvailability(rows);
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
    this.reservationsApi
      .createReservation(branchId, [{ variante_id: variant.id, cantidad: this.selectedQty() }])
      .pipe(finalize(() => this.reserving.set(false)))
      .subscribe({
        next: (reservation) => {
          this.toast.show(`Reserva #${reservation.id} creada por 48 horas`, 'success');
          this.closeDetail();
          void this.router.navigate(['/reservations']);
        },
        error: (error) =>
          this.toast.show(error?.error?.detail ?? 'No se pudo reservar en ese showroom', 'error'),
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
    this.closeDetail();
    this.cart.addItem(variant.id, this.selectedQty(), undefined, false);
  }

  buyNowFromModal(): void {
    const variant = this.activeVariant();
    if (!variant) {
      this.toast.show('Selecciona color y talla primero', 'error');
      return;
    }
    this.closeDetail();
    this.cart.addItem(variant.id, this.selectedQty(), undefined, true);
  }

  handleProductDetailAction(action: ProductDetailAction): void {
    switch (action.type) {
      case 'close':
        this.closeDetail();
        break;
      case 'toggle-favorite':
        this.toggleFavorite(action.product);
        break;
      case 'ask-altair':
        this.askAiAboutProduct(action.product);
        break;
      case 'select-color':
        this.selectColor(action.color);
        break;
      case 'select-size':
        this.selectSize(action.size);
        break;
      case 'select-branch':
        this.onBranchChange(action.branchId);
        break;
      case 'change-quantity':
        this.changeQty(action.delta);
        break;
      case 'reserve':
        this.reserveSelected();
        break;
      case 'add-to-cart':
        this.addToCartFromModal();
        break;
      case 'buy-now':
        this.buyNowFromModal();
        break;
    }
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
}
