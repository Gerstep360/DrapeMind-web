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
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { BranchStock, Category, Product, ProductVariant, User } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';

// Componentes modulares hijos del POS
import { PosAiModalComponent } from './components/pos-ai-modal/pos-ai-modal.component';
import { PosCatalogComponent } from './components/pos-catalog/pos-catalog.component';
import { PosHeaderComponent } from './components/pos-header/pos-header.component';
import { PosProductModalComponent } from './components/pos-product-modal/pos-product-modal.component';
import { PosTicketComponent } from './components/pos-ticket/pos-ticket.component';

// Modelos y tipos del POS
import {
  AiModelChoice,
  CustomerMode,
  OutfitPiece,
  OutfitSet,
  PaymentMethod,
  PosTicketItem,
} from './models/pos.models';

export * from './models/pos.models';

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
  private readonly api = inject(StoreApiService);
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

  // Sugerir Outfit IA con selector de modelo
  readonly aiModalOpen = signal<boolean>(false);
  readonly aiLoading = signal<boolean>(false);
  readonly selectedAiModel = signal<AiModelChoice>('altair');
  readonly aiOccasionControl = new FormControl('', { nonNullable: true });
  readonly outfitSets = signal<OutfitSet[]>([]);
  readonly selectedOutfitSet = signal<OutfitSet | null>(null);
  readonly aiResponseText = signal<string>('');

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
    this.api.categories().subscribe({
      next: (cats) => this.categories.set(cats),
      error: () => {},
    });
  }

  loadProducts(): void {
    this.loadingCatalog.set(true);
    const q = this.searchControl.value.trim() || undefined;
    const cat = this.selectedCategory() || undefined;

    this.api
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
      fullProduct: this.api.product(rawProduct.id),
      stockRows: this.api.productAvailability(rawProduct.id).pipe(catchError(() => of([]))),
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
    this.api.searchCustomers(query).subscribe({
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

  // ASISTENTE DE OUTFITS IA
  openAiOutfitModal(): void {
    this.aiModalOpen.set(true);
    this.selectedOutfitSet.set(null);
    this.aiResponseText.set('');
  }

  closeAiOutfitModal(): void {
    this.aiModalOpen.set(false);
  }

  setAiModel(model: AiModelChoice): void {
    this.selectedAiModel.set(model);
  }

  generateAiSuggestions(): void {
    const prompt = this.aiOccasionControl.value.trim();
    if (!prompt) {
      this.toast.show('Ingresa una ocasión, estilo o presupuesto deseado', 'info');
      return;
    }

    this.aiLoading.set(true);
    this.selectedOutfitSet.set(null);
    const firstItem = this.ticketItems()[0];
    const model = this.selectedAiModel();

    const modelLabel =
      model === 'mini'
        ? 'Mini (Rápido)'
        : model === 'dinamico'
          ? 'Moda Dinámico'
          : 'Altair Atelier Pro';

    const handler = (res: any) => {
      this.aiLoading.set(false);
      const answerText: string = res.respuesta || '';
      this.aiResponseText.set(answerText);
      const rawProducts: any[] = res.productos || [];

      if (rawProducts.length === 0) {
        this.outfitSets.set([]);
        return;
      }

      const rolesOrder: Array<'SUPERIOR' | 'INFERIOR' | 'CALZADO' | 'ACCESORIO'> = [
        'SUPERIOR',
        'INFERIOR',
        'CALZADO',
        'ACCESORIO',
      ];
      const roleLabels = {
        SUPERIOR: 'Prenda Superior',
        INFERIOR: 'Prenda Inferior',
        CALZADO: 'Calzado',
        ACCESORIO: 'Accesorio / Complemento',
      };

      const createPiece = (prod: any, idx: number): OutfitPiece => {
        const role = rolesOrder[idx % rolesOrder.length];
        const defaultVar = prod.variantes?.[0];
        return {
          productId: prod.id,
          variantId: defaultVar?.id,
          name: prod.nombre,
          brand: prod.marca || 'DrapeMind Collection',
          price: Number(prod.precio || 0),
          image: prod.imagen_principal || defaultVar?.imagen || this.getProductImage(prod),
          categoryName: prod.categoria || 'Moda',
          role,
          roleLabel: roleLabels[role],
          color: defaultVar?.color,
          size: defaultVar?.talla,
        };
      };

      const optionRegex = /(?:\*\*|\#\#)?\s*Opci[oó]n\s*(\d+)[^:\n]*:?\s*([^\n*]+)?([\s\S]*?)(?=(?:\*\*|\#\#)?\s*Opci[oó]n\s*\d+|Recomendaci[oó]n|$)/gi;
      const parsedSets: OutfitSet[] = [];
      let match: RegExpExecArray | null;

      while ((match = optionRegex.exec(answerText)) !== null) {
        const optNum = match[1];
        const optTitle = (match[2] || `Look ${optNum}`).replace(/[*_#]/g, '').trim();
        const blockContent = match[3] || '';

        const idMatch = blockContent.match(/IDs?:?\s*\[([0-9,\s]+)\]/i);
        if (idMatch) {
          const ids = idMatch[1]
            .split(',')
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => !isNaN(n));

          const setPieces: OutfitPiece[] = [];
          ids.forEach((id, idx) => {
            const prod = rawProducts.find((p) => p.id === id);
            if (prod) {
              setPieces.push(createPiece(prod, idx));
            }
          });

          if (setPieces.length > 0) {
            const descMatch = blockContent.match(/\*?\*?Descripci[oó]n:\*?\*?\s*([^\n*]+)/i);
            const rationale = descMatch
              ? descMatch[1].replace(/[*_]/g, '').trim()
              : `Propuesta coordinada para "${prompt}"`;

            parsedSets.push({
              id: `outfit-opt-${optNum}-${Date.now()}`,
              title: `Opción ${optNum}: ${optTitle}`,
              occasion: prompt,
              model,
              modelName: modelLabel,
              rationale,
              totalPrice: setPieces.reduce((sum, p) => sum + p.price, 0),
              pieces: setPieces,
            });
          }
        }
      }

      if (parsedSets.length > 0) {
        this.outfitSets.set(parsedSets);
        return;
      }

      const genericIdMatch = answerText.match(/IDs?:?\s*\[([0-9,\s]+)\]/i);
      if (genericIdMatch) {
        const ids = genericIdMatch[1]
          .split(',')
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        const setPieces: OutfitPiece[] = [];
        ids.forEach((id, idx) => {
          const prod = rawProducts.find((p) => p.id === id);
          if (prod) {
            setPieces.push(createPiece(prod, idx));
          }
        });
        if (setPieces.length > 0) {
          this.outfitSets.set([
            {
              id: `outfit-id-set-${Date.now()}`,
              title: firstItem ? `Look Coordinado con ${firstItem.name}` : `Outfit Completo: ${prompt}`,
              occasion: prompt,
              model,
              modelName: modelLabel,
              rationale: answerText.slice(0, 240),
              totalPrice: setPieces.reduce((sum, p) => sum + p.price, 0),
              pieces: setPieces,
            },
          ]);
          return;
        }
      }

      const limited = rawProducts.slice(0, 3);
      const fallbackPieces = limited.map((p, idx) => createPiece(p, idx));
      this.outfitSets.set([
        {
          id: `outfit-curated-${Date.now()}`,
          title: firstItem ? `Look Coordinado con ${firstItem.name}` : `Outfit Completo: ${prompt}`,
          occasion: prompt,
          model,
          modelName: modelLabel,
          rationale: answerText.slice(0, 240) || 'Combinación armónica seleccionada de nuestro catálogo.',
          totalPrice: fallbackPieces.reduce((sum, p) => sum + p.price, 0),
          pieces: fallbackPieces,
        },
      ]);
    };

    const apiCall = firstItem
      ? this.api.completeOutfit({
          producto_base_id: firstItem.productId,
          ocasion: `${prompt} [Modelo: ${model}]`,
        })
      : this.api.generateOutfit({
          ocasion: `${prompt} [Modelo: ${model}]`,
        });

    apiCall.subscribe({
      next: handler,
      error: () => {
        this.aiLoading.set(false);
        this.toast.show('No se pudo generar outfit IA', 'error');
      },
    });
  }

  addWholeOutfitToTicket(set: OutfitSet): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.toast.show('Selecciona una sucursal de atención', 'info');
      return;
    }

    set.pieces.forEach((piece) => {
      this.api.product(piece.productId).subscribe({
        next: (fullProduct) => {
          const variant =
            fullProduct.variantes?.find((v) => v.activo && v.stock_disponible > 0) ||
            fullProduct.variantes?.[0];
          if (variant) {
            this.addItemToTicket({
              variantId: variant.id,
              productId: fullProduct.id,
              name: fullProduct.nombre,
              brand: fullProduct.marca || 'DrapeMind',
              color: variant.color,
              colorHex: variant.codigo_color,
              size: variant.talla,
              sku: variant.sku,
              price: Number(fullProduct.precio),
              quantity: 1,
              maxStock: Math.max(1, variant.stock_disponible),
              image: variant.imagen || this.getProductImage(fullProduct) || undefined,
            });
          }
        },
      });
    });

    this.closeAiOutfitModal();
    this.toast.show('Conjunto añadido al ticket de mostrador', 'success');
  }

  addSinglePieceFromOutfit(piece: OutfitPiece): void {
    this.api.product(piece.productId).subscribe({
      next: (fullProduct) => {
        this.openVariantModal(fullProduct);
        this.closeAiOutfitModal();
      },
      error: () => {
        this.toast.show('No se pudo cargar la prenda seleccionada', 'error');
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

    this.api.createPosSale(payload).subscribe({
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
