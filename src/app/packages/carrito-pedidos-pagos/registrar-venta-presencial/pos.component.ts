import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, forkJoin, of } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { BranchService } from '@core/branch.service';
import { BranchStock, Category, Product, ProductVariant, User } from '@core/models';
import { CatalogApiService } from '@core/api/catalog-api.service';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ToastService } from '@core/toast.service';
import { ReceiptModalComponent } from '@shared/components/receipt-modal/receipt-modal.component';

// Componentes modulares hijos del POS
import { PosCatalogComponent } from '@shared/components/pos/pos-catalog/pos-catalog.component';
import { PosHeaderComponent } from '@shared/components/pos/pos-header/pos-header.component';
import { PosProductModalComponent } from '@shared/components/pos/pos-product-modal/pos-product-modal.component';
import { PosTicketComponent } from '@shared/components/pos/pos-ticket/pos-ticket.component';
import { PosAiModalComponent } from '@shared/components/pos/pos-ai-modal/pos-ai-modal.component';

// Modelos y tipos del POS
import {
  AiModelChoice,
  CustomerMode,
  OutfitPiece,
  OutfitSet,
  PaymentMethod,
  PosTicketItem,
} from '@shared/components/pos/pos.models';

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule,
    PosHeaderComponent,
    PosCatalogComponent,
    PosProductModalComponent,
    PosTicketComponent,
    PosAiModalComponent,
    ReceiptModalComponent,
  ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PosComponent implements OnInit {
  readonly auth = inject(AuthService);
  readonly branchService = inject(BranchService);
  private readonly catalogApi = inject(CatalogApiService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly toast = inject(ToastService);

  // Sucursal de venta: sincronizada con el estado global
  readonly selectedBranch = this.branchService.selectedBranch;
  readonly selectedBranchId = this.branchService.selectedBranchId;

  // Catálogo y búsqueda de prendas
  readonly products = signal<Product[]>([]);
  readonly categories = signal<Category[]>([]);
  readonly loadingCatalog = signal<boolean>(false);
  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly selectedCategory = signal<number | null>(null);

  // Modal selector de variantes y disponibilidad por sucursal
  readonly variantModalOpen = signal<boolean>(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly productStockRows = signal<BranchStock[]>([]);
  readonly loadingVariants = signal<boolean>(false);

  // Gestión de Cliente
  readonly customerMode = signal<CustomerMode>('WALK_IN');
  readonly guestNameControl = new FormControl('Cliente de Mostrador', { nonNullable: true });
  readonly guestDocControl = new FormControl('', { nonNullable: true });
  readonly customerSearchControl = new FormControl('', { nonNullable: true });
  readonly customerSearchResults = signal<User[]>([]);
  readonly isSearchingCustomers = signal<boolean>(false);
  readonly selectedCustomer = signal<User | null>(null);

  // Ticket de venta en mostrador
  readonly ticketItems = signal<PosTicketItem[]>([]);

  // Pago
  readonly paymentMethod = signal<PaymentMethod>('EFECTIVO');
  readonly cashReceivedControl = new FormControl<number | null>(null);
  readonly cardRefControl = new FormControl('', { nonNullable: true });
  readonly qrRefControl = new FormControl('', { nonNullable: true });

  // Asistente de Estilo e IA en Mostrador
  readonly aiModalOpen = signal<boolean>(false);
  readonly selectedAiModel = signal<AiModelChoice>('altair');
  readonly aiOccasionControl = new FormControl('', { nonNullable: true });
  readonly aiOutfitSets = signal<OutfitSet[]>([]);
  readonly selectedOutfitSet = signal<OutfitSet | null>(null);
  readonly aiResponseText = signal<string>('');
  readonly aiLoading = signal<boolean>(false);

  readonly altairPosContext = computed(() => {
    const branch = this.selectedBranch()?.nombre || 'sin sucursal elegida';
    const pieces = this.ticketItems()
      .map((item) => `${item.name}, ${item.color}, talla ${item.size}, Bs ${item.price}`)
      .join('; ');
    return `Caja de ${branch}. Ticket actual: ${pieces || 'vacío'}.`;
  });

  // Comprobante emitido
  readonly isSubmitting = signal<boolean>(false);
  readonly completedOrderId = signal<number | null>(null);
  readonly receiptModalOpen = signal<boolean>(false);

  // Totales calculados
  readonly totalPieces = computed(() =>
    this.ticketItems().reduce((acc, item) => acc + item.quantity, 0),
  );

  readonly subtotal = computed(() =>
    this.ticketItems().reduce((acc, item) => acc + item.price * item.quantity, 0),
  );

  readonly total = computed(() => this.subtotal());

  readonly cashChange = computed(() => {
    const received = Number(this.cashReceivedControl.value || 0);
    const tot = this.total();
    return received >= tot ? received - tot : 0;
  });

  readonly isCashSufficient = computed(() => {
    if (this.paymentMethod() !== 'EFECTIVO') return true;
    const received = Number(this.cashReceivedControl.value || 0);
    return received >= this.total();
  });

  readonly canSubmitSale = computed(() => {
    return (
      this.ticketItems().length > 0 &&
      this.selectedBranchId() !== null &&
      !this.isSubmitting() &&
      this.isCashSufficient()
    );
  });

  ngOnInit(): void {
    this.branchService.loadBranches();
    this.loadCategories();
    this.loadProducts();

    // Búsqueda reactiva de prendas
    this.searchControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged())
      .subscribe(() => this.loadProducts());

    // Búsqueda reactiva de clientes
    this.customerSearchControl.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((query) => {
        if (query.trim().length >= 2) {
          this.searchCustomers(query);
        } else {
          this.customerSearchResults.set([]);
        }
      });
  }

  loadCategories(): void {
    this.catalogApi.categories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadProducts(): void {
    this.loadingCatalog.set(true);
    const q = this.searchControl.value.trim() || undefined;
    const cat = this.selectedCategory() || undefined;

    this.catalogApi
      .products({
        q,
        categoria_id: cat,
        limit: 40,
        con_stock: false,
      })
      .subscribe({
        next: (items) => {
          this.products.set(items);
          this.loadingCatalog.set(false);
        },
        error: () => {
          this.loadingCatalog.set(false);
        },
      });
  }

  setBranchById(id: number | null): void {
    if (!id) return;
    const branch = this.branchService.branches().find((b) => b.id === Number(id));
    if (branch) {
      this.branchService.selectBranch(branch);
      this.toast.show(`Sede de venta: ${branch.nombre}`, 'info');
    }
  }

  branchName(branchId: number | null): string {
    if (!branchId) return 'Ninguna';
    const found = this.branchService.branches().find((b) => b.id === branchId);
    return found ? found.nombre : `Sucursal #${branchId}`;
  }

  setCategory(catId: number | null): void {
    this.selectedCategory.set(catId);
    this.loadProducts();
  }

  getProductImage(product: Product): string | undefined {
    if (!product.imagenes || product.imagenes.length === 0) return undefined;
    const first = product.imagenes[0];
    if (typeof first === 'string') return first;
    return first?.url;
  }

  // MODAL DE VARIANTES & STOCK
  openVariantModal(rawProduct: Product): void {
    this.selectedProduct.set(rawProduct);
    this.variantModalOpen.set(true);
    this.loadingVariants.set(true);
    this.productStockRows.set([]);

    forkJoin({
      fullProduct: this.catalogApi.product(rawProduct.id),
      stockRows: this.catalogApi.productAvailability(rawProduct.id).pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ fullProduct, stockRows }) => {
        this.selectedProduct.set(fullProduct);
        this.productStockRows.set(stockRows);
        this.loadingVariants.set(false);
      },
      error: () => {
        this.loadingVariants.set(false);
        this.toast.show('No se pudieron cargar las variantes de la prenda', 'error');
      },
    });
  }

  closeVariantModal(): void {
    this.variantModalOpen.set(false);
    this.selectedProduct.set(null);
  }

  onAddVariantToTicket(event: { variant: ProductVariant; maxStock: number }): void {
    const product = this.selectedProduct();
    const branchId = this.selectedBranchId();

    if (!product || !event.variant) {
      this.toast.show('Selecciona color y talla', 'info');
      return;
    }

    if (!branchId) {
      this.toast.show('Selecciona una sucursal de atención', 'info');
      return;
    }

    if (event.maxStock <= 0) {
      this.toast.show('Sin stock disponible en esta sucursal', 'error');
      return;
    }

    this.addItemToTicket({
      variantId: event.variant.id,
      productId: product.id,
      name: product.nombre,
      brand: product.marca || 'DrapeMind',
      color: event.variant.color,
      colorHex: event.variant.codigo_color,
      size: event.variant.talla,
      sku: event.variant.sku,
      price: Number(product.precio),
      quantity: 1,
      maxStock: event.maxStock,
      image: event.variant.imagen || this.getProductImage(product) || undefined,
    });

    this.closeVariantModal();
    this.toast.show(`Agregado: ${product.nombre} (${event.variant.talla})`, 'success');
  }

  addItemToTicket(newItem: PosTicketItem): void {
    this.ticketItems.update((items) => {
      const existing = items.find((i) => i.variantId === newItem.variantId);
      if (existing) {
        if (existing.quantity >= existing.maxStock) {
          this.toast.show(
            `Stock máximo alcanzado (${existing.maxStock} unid.) para esta prenda`,
            'info',
          );
          return items;
        }
        return items.map((i) =>
          i.variantId === newItem.variantId ? { ...i, quantity: i.quantity + 1 } : i,
        );
      }
      return [...items, newItem];
    });
  }

  incrementItem(variantId: number): void {
    this.ticketItems.update((items) =>
      items.map((item) => {
        if (item.variantId === variantId) {
          if (item.quantity >= item.maxStock) {
            this.toast.show(`Máximo disponible: ${item.maxStock} prendas`, 'info');
            return item;
          }
          return { ...item, quantity: item.quantity + 1 };
        }
        return item;
      }),
    );
  }

  decrementItem(variantId: number): void {
    this.ticketItems.update((items) =>
      items
        .map((item) => {
          if (item.variantId === variantId) {
            return { ...item, quantity: item.quantity - 1 };
          }
          return item;
        })
        .filter((item) => item.quantity > 0),
    );
  }

  removeItem(variantId: number): void {
    this.ticketItems.update((items) => items.filter((i) => i.variantId !== variantId));
  }

  clearTicket(): void {
    this.ticketItems.set([]);
    this.cashReceivedControl.setValue(null);
    this.cardRefControl.setValue('');
    this.qrRefControl.setValue('');
  }

  // GESTIÓN DE CLIENTES
  setCustomerMode(mode: CustomerMode): void {
    this.customerMode.set(mode);
    if (mode === 'WALK_IN') {
      this.selectedCustomer.set(null);
    }
  }

  searchCustomers(query: string): void {
    this.isSearchingCustomers.set(true);
    this.commerceApi.searchCustomers(query).subscribe({
      next: (results) => {
        this.customerSearchResults.set(results);
        this.isSearchingCustomers.set(false);
      },
      error: () => {
        this.isSearchingCustomers.set(false);
      },
    });
  }

  selectCustomer(user: User): void {
    this.selectedCustomer.set(user);
    this.customerSearchResults.set([]);
    this.customerSearchControl.setValue('');
    this.toast.show(`Cliente asignado: ${user.nombre}`, 'info');
  }

  clearCustomer(): void {
    this.selectedCustomer.set(null);
  }

  setPaymentMethod(method: PaymentMethod): void {
    this.paymentMethod.set(method);
  }

  // ASISTENTE DE OUTFITS IA EN CAJA
  openAiOutfitModal(): void {
    this.aiModalOpen.set(true);
    if (!this.aiOccasionControl.value) {
      if (this.ticketItems().length > 0) {
        this.aiOccasionControl.setValue(`Combinar con ${this.ticketItems()[0].name}`);
      } else {
        this.aiOccasionControl.setValue('Outfit elegante y contemporáneo');
      }
    }
  }

  closeAiOutfitModal(): void {
    this.aiModalOpen.set(false);
  }

  setAiModel(model: AiModelChoice): void {
    this.selectedAiModel.set(model);
  }

  selectOutfitSet(set: OutfitSet | null): void {
    this.selectedOutfitSet.set(set);
  }

  generateAiSuggestions(): void {
    const occasion = this.aiOccasionControl.value.trim();
    if (!occasion) return;

    this.aiLoading.set(true);
    this.aiResponseText.set('');

    const baseProduct = this.ticketItems().length > 0 ? this.ticketItems()[0].productId : undefined;

    const request$ = baseProduct
      ? this.commerceApi.completeOutfit({ producto_base_id: baseProduct, ocasion: occasion })
      : this.commerceApi.generateOutfit({ ocasion: occasion });

    request$.subscribe({
      next: (res) => {
        this.aiLoading.set(false);
        this.aiResponseText.set(res.respuesta || 'Recomendaciones coordinadas generadas.');

        const rawItems =
          res.recomendaciones && res.recomendaciones.length > 0
            ? res.recomendaciones
            : res.productos && res.productos.length > 0
              ? res.productos
              : [];

        const pieces: OutfitPiece[] = rawItems.map((item: any, idx: number) => {
          const roleCode = (item.rol || '').toUpperCase();
          let role: 'SUPERIOR' | 'INFERIOR' | 'CALZADO' | 'ACCESORIO' = 'SUPERIOR';
          let roleLabel = 'Prenda Superior';
          if (roleCode.includes('BOTTOM') || roleCode.includes('INFERIOR') || idx === 1) {
            role = 'INFERIOR';
            roleLabel = 'Prenda Inferior';
          } else if (roleCode.includes('SHOE') || roleCode.includes('CALZADO') || idx === 2) {
            role = 'CALZADO';
            roleLabel = 'Calzado';
          } else if (roleCode.includes('OUTER') || roleCode.includes('ACCESORIO') || idx >= 3) {
            role = 'ACCESORIO';
            roleLabel = 'Accesorio / Complemento';
          }

          return {
            productId: item.producto_id || item.id,
            variantId: item.variante_id || item.variant_id,
            name: item.nombre || item.name || `Prenda ${idx + 1}`,
            brand: item.marca || 'DrapeMind Atelier',
            price: Number(item.precio || item.price || 150),
            image: item.imagen || item.image || (item.imagenes?.[0]?.url || item.imagenes?.[0]),
            role,
            roleLabel,
            color: item.color || undefined,
            size: item.talla || undefined,
          };
        });

        const modelLabel =
          this.selectedAiModel() === 'mini'
            ? 'Altair Mini'
            : this.selectedAiModel() === 'dinamico'
              ? 'Moda Dinámico'
              : 'Altair Atelier Pro';

        const totalOutfitPrice = pieces.reduce((acc, p) => acc + p.price, 0);

        const newSet: OutfitSet = {
          id: `outfit-${Date.now()}`,
          title: `Look Coordinado: ${occasion}`,
          occasion,
          model: this.selectedAiModel(),
          modelName: modelLabel,
          rationale: res.respuesta || 'Conjunto seleccionado según ocasión y disponibilidad.',
          totalPrice: totalOutfitPrice,
          pieces,
        };

        this.aiOutfitSets.set([newSet]);
      },
      error: (err) => {
        this.aiLoading.set(false);
        const detail = err?.error?.detail || 'No se pudo generar el outfit';
        this.toast.show(detail, 'error');
      },
    });
  }

  addSinglePieceFromOutfit(piece: OutfitPiece): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.toast.show('Selecciona una sucursal para validar stock', 'info');
      return;
    }

    forkJoin({
      fullProduct: this.catalogApi.product(piece.productId),
      stockRows: this.catalogApi
        .productAvailability(piece.productId)
        .pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ fullProduct, stockRows }) => {
        const variantes = fullProduct.variantes || [];
        let targetVariant: ProductVariant | undefined;
        let availableStock = 0;

        if (piece.variantId) {
          targetVariant = variantes.find((v) => v.id === piece.variantId);
        }
        if (!targetVariant && piece.size) {
          targetVariant = variantes.find((v) => v.talla === piece.size);
        }
        if (!targetVariant) {
          for (const v of variantes) {
            const row = stockRows.find(
              (s) => s.sucursal_id === branchId && s.variante_id === v.id,
            );
            if (row && row.stock_disponible > 0) {
              targetVariant = v;
              availableStock = row.stock_disponible;
              break;
            }
          }
        }

        if (!targetVariant && variantes.length > 0) {
          targetVariant = variantes[0];
        }

        if (!targetVariant) {
          this.toast.show(`No hay variantes para ${piece.name}`, 'error');
          return;
        }

        if (availableStock === 0) {
          const row = stockRows.find(
            (s) => s.sucursal_id === branchId && s.variante_id === targetVariant?.id,
          );
          availableStock = row ? row.stock_disponible : (stockRows.length === 0 ? 10 : 0);
        }

        if (availableStock <= 0) {
          this.toast.show(`Sin stock en esta sucursal para ${piece.name}`, 'error');
          return;
        }

        this.addItemToTicket({
          variantId: targetVariant.id,
          productId: fullProduct.id,
          name: fullProduct.nombre,
          brand: fullProduct.marca || 'DrapeMind Atelier',
          color: targetVariant.color || 'Único',
          colorHex: targetVariant.codigo_color,
          size: targetVariant.talla || 'U',
          sku: targetVariant.sku || `SKU-${targetVariant.id}`,
          price: Number(fullProduct.precio),
          quantity: 1,
          maxStock: availableStock,
          image:
            targetVariant.imagen || this.getProductImage(fullProduct) || piece.image || undefined,
        });

        this.toast.show(`Añadido al ticket: ${piece.name}`, 'success');
      },
      error: () => {
        this.toast.show(`No se pudo verificar la prenda ${piece.name}`, 'error');
      },
    });
  }

  addWholeOutfitToTicket(outfit: OutfitSet): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.toast.show('Selecciona una sucursal para validar stock', 'info');
      return;
    }
    if (!outfit.pieces.length) return;

    const loads = outfit.pieces.map((piece) =>
      forkJoin({
        piece: of(piece),
        fullProduct: this.catalogApi.product(piece.productId).pipe(catchError(() => of(null))),
        stockRows: this.catalogApi
          .productAvailability(piece.productId)
          .pipe(catchError(() => of([]))),
      }),
    );

    let addedCount = 0;
    forkJoin(loads).subscribe({
      next: (results) => {
        for (const res of results) {
          if (!res.fullProduct) continue;
          const piece = res.piece;
          const fullProduct = res.fullProduct;
          const stockRows = res.stockRows;
          const variantes = fullProduct.variantes || [];

          let targetVariant = piece.variantId
            ? variantes.find((v) => v.id === piece.variantId)
            : undefined;

          let availableStock = 0;
          if (!targetVariant) {
            for (const v of variantes) {
              const row = stockRows.find(
                (s) => s.sucursal_id === branchId && s.variante_id === v.id,
              );
              if (row && row.stock_disponible > 0) {
                targetVariant = v;
                availableStock = row.stock_disponible;
                break;
              }
            }
          } else {
            const row = stockRows.find(
              (s) => s.sucursal_id === branchId && s.variante_id === targetVariant?.id,
            );
            availableStock = row ? row.stock_disponible : 10;
          }

          if (!targetVariant && variantes.length > 0) {
            targetVariant = variantes[0];
            availableStock = 10;
          }

          if (targetVariant && availableStock > 0) {
            this.addItemToTicket({
              variantId: targetVariant.id,
              productId: fullProduct.id,
              name: fullProduct.nombre,
              brand: fullProduct.marca || 'DrapeMind Atelier',
              color: targetVariant.color || 'Único',
              colorHex: targetVariant.codigo_color,
              size: targetVariant.talla || 'U',
              sku: targetVariant.sku || `SKU-${targetVariant.id}`,
              price: Number(fullProduct.precio),
              quantity: 1,
              maxStock: availableStock,
              image:
                targetVariant.imagen ||
                this.getProductImage(fullProduct) ||
                piece.image ||
                undefined,
            });
            addedCount++;
          }
        }

        if (addedCount > 0) {
          this.toast.show(`Se agregaron ${addedCount} prendas del outfit al ticket`, 'success');
          this.closeAiOutfitModal();
        } else {
          this.toast.show(
            'No se encontraron prendas con stock disponible en esta sucursal',
            'info',
          );
        }
      },
      error: () => {
        this.toast.show('Error al añadir las prendas del outfit', 'error');
      },
    });
  }

  // FINALIZAR VENTA & COBRO POS
  submitSale(): void {
    if (!this.canSubmitSale()) {
      if (!this.isCashSufficient()) {
        this.toast.show('El monto recibido en efectivo es menor al total a cobrar', 'info');
      }
      return;
    }

    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.toast.show('Selecciona una sucursal', 'error');
      return;
    }

    const method = this.paymentMethod();
    let refNum: string | null = null;
    if (method === 'TARJETA') {
      refNum = this.cardRefControl.value.trim() || `POS-CARD-${Date.now().toString().slice(-6)}`;
    } else if (method === 'QR') {
      refNum = this.qrRefControl.value.trim() || `POS-QR-${Date.now().toString().slice(-6)}`;
    } else {
      const cash = Number(this.cashReceivedControl.value || 0);
      refNum = `EFECTIVO-REC:${cash.toFixed(2)}-VUELTO:${this.cashChange().toFixed(2)}`;
    }

    const payload = {
      sucursal_id: branchId,
      cliente_id: this.selectedCustomer()?.id || null,
      items: this.ticketItems().map((i) => ({
        variante_id: i.variantId,
        cantidad: i.quantity,
        precio_unitario: i.price,
      })),
      metodo_pago: method,
      numero_factura: refNum,
    };

    this.isSubmitting.set(true);

    this.commerceApi.createPosSale(payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.completedOrderId.set(res.pedido_id);
        this.receiptModalOpen.set(true);
        this.clearTicket();
        this.toast.show('Venta completada con éxito', 'success');
      },
      error: (err) => {
        this.isSubmitting.set(false);
        const detail = err?.error?.detail || 'Error al procesar la venta en caja';
        this.toast.show(detail, 'error');
      },
    });
  }

  closeReceiptModal(): void {
    this.receiptModalOpen.set(false);
    this.completedOrderId.set(null);
  }
}
