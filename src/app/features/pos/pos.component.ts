import { CommonModule, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { BranchService } from '../../core/branch.service';
import { BranchStock, Category, Product, ProductVariant, User } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';
import { ReceiptModalComponent } from '../../shared/components/receipt-modal/receipt-modal.component';

export interface PosTicketItem {
  variantId: number;
  productId: number;
  name: string;
  brand: string;
  color: string;
  colorHex?: string | null;
  size: string;
  sku: string;
  price: number;
  quantity: number;
  maxStock: number;
  image?: string | null;
}

export type AiModelChoice = 'mini' | 'dinamico' | 'altair';

export interface OutfitPiece {
  productId: number;
  variantId?: number;
  name: string;
  brand: string;
  price: number;
  image?: string;
  categoryName?: string;
  role: 'SUPERIOR' | 'INFERIOR' | 'CALZADO' | 'ACCESORIO';
  roleLabel: string;
  color?: string;
  size?: string;
}

export interface OutfitSet {
  id: string;
  title: string;
  occasion: string;
  model: AiModelChoice;
  modelName: string;
  rationale: string;
  totalPrice: number;
  pieces: OutfitPiece[];
}

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DecimalPipe, ReceiptModalComponent],
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

  // Selector de variantes
  readonly variantModalOpen = signal<boolean>(false);
  readonly selectedProduct = signal<Product | null>(null);
  readonly selectedColor = signal<string | null>(null);
  readonly selectedSize = signal<string | null>(null);
  readonly selectedVariant = signal<ProductVariant | null>(null);
  readonly productStockRows = signal<BranchStock[]>([]);
  readonly loadingVariants = signal<boolean>(false);

  // Cliente: Mostrador vs Registrado
  readonly customerMode = signal<'WALK_IN' | 'REGISTERED'>('WALK_IN');
  readonly guestNameControl = new FormControl('Cliente de Mostrador', { nonNullable: true });
  readonly guestDocControl = new FormControl('', { nonNullable: true });
  readonly customerSearchControl = new FormControl('', { nonNullable: true });
  readonly customerSearchResults = signal<User[]>([]);
  readonly isSearchingCustomers = signal<boolean>(false);
  readonly selectedCustomer = signal<User | null>(null);

  // Ticket de venta en mostrador
  readonly ticketItems = signal<PosTicketItem[]>([]);

  // Pago
  readonly paymentMethod = signal<'EFECTIVO' | 'TARJETA' | 'QR'>('EFECTIVO');
  readonly cashReceivedControl = new FormControl<number | null>(null);
  readonly cardRefControl = new FormControl('', { nonNullable: true });
  readonly qrRefControl = new FormControl('', { nonNullable: true });

  // Sugerir Outfit IA con selector de modelo y vista de conjuntos
  readonly aiModalOpen = signal<boolean>(false);
  readonly aiLoading = signal<boolean>(false);
  readonly selectedAiModel = signal<AiModelChoice>('altair');
  readonly aiOccasionControl = new FormControl('Casual elegante para evento social', {
    nonNullable: true,
  });
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

  getProductImage(product: Product): string | undefined {
    if (!product.imagenes || product.imagenes.length === 0) return undefined;
    const first = product.imagenes[0];
    if (typeof first === 'string') return first;
    return first?.url;
  }

  getCategoryName(catId: number): string {
    const found = this.categories().find((c) => c.id === catId);
    return found ? found.nombre : 'Moda';
  }

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

  onSelectBranch(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const branchId = Number(target.value);
    const branch = this.branchService.branches().find((b) => b.id === branchId);
    if (branch) {
      this.branchService.selectBranch(branch);
      this.toast.show(`Sede de venta cambiada a: ${branch.nombre}`, 'info');
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

  // MODAL DE VARIANTES & STOCK
  openVariantModal(product: Product): void {
    this.selectedProduct.set(product);
    this.variantModalOpen.set(true);
    this.loadingVariants.set(true);

    // Seleccionar por defecto la primera variante activa
    const defaultV = product.variantes?.find((v) => v.activo) || product.variantes?.[0];
    if (defaultV) {
      this.selectedColor.set(defaultV.color);
      this.selectedSize.set(defaultV.talla);
      this.selectedVariant.set(defaultV);
    } else {
      this.selectedColor.set(null);
      this.selectedSize.set(null);
      this.selectedVariant.set(null);
    }

    // Consultar disponibilidad real de la prenda por sede usando productAvailability
    this.api.productAvailability(product.id).subscribe({
      next: (stockRows) => {
        this.productStockRows.set(stockRows);
        this.loadingVariants.set(false);

        const branchId = this.selectedBranchId();
        const availableVariants = product.variantes?.filter((v) => {
          if (!v.activo) return false;
          if (!branchId) return v.stock_disponible > 0;
          const match = stockRows.find(
            (r) => r.variante_id === v.id && r.sucursal_id === branchId,
          );
          return (match?.stock_disponible ?? 0) > 0;
        });

        const activeMatch = availableVariants?.[0] || defaultV;
        if (activeMatch) {
          this.selectColor(activeMatch.color);
          this.selectSize(activeMatch.talla);
        }
      },
      error: () => {
        this.loadingVariants.set(false);
      },
    });
  }

  closeVariantModal(): void {
    this.variantModalOpen.set(false);
    this.selectedProduct.set(null);
  }

  selectColor(color: string): void {
    this.selectedColor.set(color);
    this.updateActiveVariant();
  }

  selectSize(size: string): void {
    this.selectedSize.set(size);
    this.updateActiveVariant();
  }

  private updateActiveVariant(): void {
    const p = this.selectedProduct();
    const c = this.selectedColor();
    const s = this.selectedSize();
    if (!p?.variantes || !c || !s) {
      this.selectedVariant.set(null);
      return;
    }
    const match = p.variantes.find((v) => v.color === c && v.talla === s && v.activo) || null;
    this.selectedVariant.set(match);
  }

  getVariantBranchStock(variantId: number): number {
    const branchId = this.selectedBranchId();
    if (!branchId) return 0;
    const match = this.productStockRows().find(
      (r) => r.variante_id === variantId && r.sucursal_id === branchId,
    );
    if (match) return match.stock_disponible;

    const p = this.selectedProduct();
    const v = p?.variantes?.find((x) => x.id === variantId);
    return v?.stock_disponible ?? 0;
  }

  addSelectedVariantToTicket(): void {
    const product = this.selectedProduct();
    const variant = this.selectedVariant();
    const branchId = this.selectedBranchId();

    if (!product || !variant) {
      this.toast.show('Selecciona color y talla', 'info');
      return;
    }

    if (!branchId) {
      this.toast.show('Selecciona una sucursal de atención', 'info');
      return;
    }

    const availableStock = this.getVariantBranchStock(variant.id);
    if (availableStock <= 0) {
      this.toast.show('Sin stock disponible en esta sucursal', 'error');
      return;
    }

    this.addItemToTicket({
      variantId: variant.id,
      productId: product.id,
      name: product.nombre,
      brand: product.marca || 'DrapeMind',
      color: variant.color,
      colorHex: variant.codigo_color,
      size: variant.talla,
      sku: variant.sku,
      price: Number(product.precio),
      quantity: 1,
      maxStock: availableStock,
      image: variant.imagen || this.getProductImage(product) || undefined,
    });

    this.closeVariantModal();
    this.toast.show(`Agregado: ${product.nombre} (${variant.talla})`, 'success');
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
  setCustomerMode(mode: 'WALK_IN' | 'REGISTERED'): void {
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

  selectCustomer(cust: User): void {
    this.selectedCustomer.set(cust);
    this.customerSearchResults.set([]);
    this.customerSearchControl.setValue(cust.nombre);
    this.toast.show(`Cliente asignado: ${cust.nombre}`, 'info');
  }

  clearSelectedCustomer(): void {
    this.selectedCustomer.set(null);
    this.customerSearchControl.setValue('');
  }

  // ATALAYER SUGERENCIAS RÁPIDAS DE EFECTIVO
  setExactCash(): void {
    this.cashReceivedControl.setValue(this.total());
  }

  addCash(amount: number): void {
    const current = Number(this.cashReceivedControl.value || 0);
    this.cashReceivedControl.setValue(current + amount);
  }

  // SUGERIR OUTFIT IA CON MODELOS MINI, DINÁMICO Y ALTAIR
  openAiOutfitModal(): void {
    this.aiModalOpen.set(true);
    this.outfitSets.set([]);
    this.selectedOutfitSet.set(null);
    this.aiResponseText.set('');

    const firstItem = this.ticketItems()[0];
    if (firstItem) {
      this.aiOccasionControl.setValue(`Combinar con ${firstItem.name} (${firstItem.color})`);
    } else {
      this.aiOccasionControl.setValue('Outfit completo casual contemporáneo de temporada');
    }

    // Auto-generar primera sugerencia
    this.generateAiSuggestions();
  }

  closeAiOutfitModal(): void {
    this.aiModalOpen.set(false);
    this.selectedOutfitSet.set(null);
  }

  selectAiModel(model: AiModelChoice): void {
    this.selectedAiModel.set(model);
    this.generateAiSuggestions();
  }

  setAiModel(model: AiModelChoice): void {
    this.selectedAiModel.set(model);
  }

  generateAiSuggestions(): void {
    this.aiLoading.set(true);
    this.selectedOutfitSet.set(null);
    const firstItem = this.ticketItems()[0];
    const occasion = this.aiOccasionControl.value.trim() || 'Estilo Contemporáneo';
    const model = this.selectedAiModel();

    const modelLabel =
      model === 'mini'
        ? 'Gemma Mini 2B (Rápido)'
        : model === 'dinamico'
          ? 'Moda Dinámico (Balanceado)'
          : 'Altair Atelier Pro (Curaduría)';

    const handler = (res: any) => {
      this.aiLoading.set(false);
      this.aiResponseText.set(res.respuesta || 'Sugerencia de outfit generada según disponibilidad.');
      const rawProducts: any[] = res.productos || [];

      if (rawProducts.length === 0) {
        this.outfitSets.set([]);
        return;
      }

      // Convertir productos sugeridos en un conjunto de outfit curado
      const rolesOrder: Array<'SUPERIOR' | 'INFERIOR' | 'CALZADO' | 'ACCESORIO'> = [
        'SUPERIOR',
        'INFERIOR',
        'CALZADO',
        'ACCESORIO',
      ];
      const roleLabels: Record<string, string> = {
        SUPERIOR: 'Prenda Superior',
        INFERIOR: 'Prenda Inferior',
        CALZADO: 'Calzado',
        ACCESORIO: 'Accesorio / Complemento',
      };

      const pieces: OutfitPiece[] = rawProducts.map((prod, idx) => {
        const role = rolesOrder[idx % rolesOrder.length];
        const defaultVar = prod.variantes?.[0];
        return {
          productId: prod.id,
          variantId: defaultVar?.id,
          name: prod.nombre,
          brand: prod.marca || 'DrapeMind Collection',
          price: Number(prod.precio || 0),
          image: prod.imagen_principal || defaultVar?.imagen || undefined,
          categoryName: prod.categoria || 'Moda',
          role,
          roleLabel: roleLabels[role],
          color: defaultVar?.color,
          size: defaultVar?.talla,
        };
      });

      const totalPrice = pieces.reduce((sum, p) => sum + p.price, 0);

      const outfitTitle = firstItem
        ? `Look Coordinado con ${firstItem.name}`
        : `Outfit Completo: ${occasion}`;

      const sets: OutfitSet[] = [
        {
          id: `outfit-main-${Date.now()}`,
          title: outfitTitle,
          occasion,
          model,
          modelName: modelLabel,
          rationale: res.respuesta || 'Combinación armónica de texturas, paleta y corte curada por DrapeMind IA.',
          totalPrice,
          pieces,
        },
      ];

      if (pieces.length >= 3) {
        const capsule = pieces.slice(0, 2);
        const capPrice = capsule.reduce((sum, p) => sum + p.price, 0);
        sets.push({
          id: `outfit-capsule-${Date.now()}`,
          title: `Cápsula Esencial (${occasion})`,
          occasion,
          model,
          modelName: modelLabel,
          rationale: `Selección minimalista de piezas clave combinadas para ${occasion}.`,
          totalPrice: capPrice,
          pieces: capsule,
        });
      }

      this.outfitSets.set(sets);
    };

    if (firstItem) {
      this.api
        .completeOutfit({
          producto_base_id: firstItem.productId,
          ocasion: `${occasion} [Modelo: ${model}]`,
        })
        .subscribe({
          next: handler,
          error: () => {
            this.aiLoading.set(false);
            this.toast.show('No se pudo generar recomendación IA', 'error');
          },
        });
    } else {
      this.api
        .generateOutfit({
          ocasion: `${occasion} [Modelo: ${model}]`,
        })
        .subscribe({
          next: handler,
          error: () => {
            this.aiLoading.set(false);
            this.toast.show('No se pudo generar outfit IA', 'error');
          },
        });
    }
  }

  viewOutfitDetail(set: OutfitSet): void {
    this.selectedOutfitSet.set(set);
  }

  backToOutfitList(): void {
    this.selectedOutfitSet.set(null);
  }

  addWholeOutfitToTicket(set: OutfitSet): void {
    const branchId = this.selectedBranchId();
    if (!branchId) {
      this.toast.show('Selecciona una sucursal de atención', 'info');
      return;
    }

    let addedCount = 0;
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
            addedCount++;
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
