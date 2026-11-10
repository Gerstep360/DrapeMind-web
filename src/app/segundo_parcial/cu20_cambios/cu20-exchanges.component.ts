import { Component, ChangeDetectorRef, effect, inject, OnInit, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { OfflineService, offlineMessage, offlineMediaUrl } from '../cu13_catalogo_offline/cu13-offline.service';
import { StripePaymentComponent } from '../cu23_pagos/cu23-pago.component';
import { RuntimeConfigService } from '../../core/runtime-config.service';
import { AuthService } from '../../core/auth.service';
import { DownloadedOrdersService } from '../cu24_pedidos/cu24-pedidos-descargados.service';
import { Order } from '../../core/models';

export type ExchangeMode = 'DEVOLUCION' | 'CAMBIO';

@Component({
  selector: 'app-exchanges',
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, StripePaymentComponent],
  templateUrl: './cu20-exchanges.component.html',
  styleUrls: ['../compartido/feature.scss', './cu20-exchanges.component.scss'],
})
export class ExchangesComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  readonly offline = inject(OfflineService);
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);
  private runtime = inject(RuntimeConfigService);
  private route = inject(ActivatedRoute);
  private downloaded = inject(DownloadedOrdersService);

  activeMode: ExchangeMode = 'DEVOLUCION';
  code = '';
  order: any = null;
  quote: any = null;
  result: any = null;
  error = '';
  busy = false;
  note = '';
  received = '0';
  refunded = '0';
  variant = 0;
  quantity = 1;
  returns: Record<number, number> = {};
  lines: { variante_id: number; cantidad: number; name?: string; price?: number }[] = [];
  requestId = crypto.randomUUID();
  pending: any = null;

  // Pago y Diferencia
  paymentMethod: 'STRIPE' | 'EFECTIVO' = 'STRIPE';
  stripePaidSuccess = false;

  // Selección Visual de Prendas
  garmentSearch = '';
  selectedCategory = 0;
  selectedProduct: any = null;
  selectedVariant: any = null;

  // Selección directa sin buscar
  clientOrders = signal<Order[]>([]);
  loadingOrders = signal(false);
  showManualSearch = false;

  private lastOwner: string | null = null;

  constructor() {
    effect(() => {
      const owner = this.offline.owner();
      if (this.lastOwner !== null && this.lastOwner !== owner) {
        this.order = null;
        this.quote = null;
        this.result = null;
        this.lines = [];
        this.returns = {};
      }
      this.lastOwner = owner;
      try {
        this.pending = owner
          ? JSON.parse(localStorage.getItem(`drapemind.exchange.pending|${owner}`) ?? 'null')
          : null;
      } catch {
        this.pending = null;
      }
    });
  }

  ngOnInit() {
    const qp = this.route.snapshot.queryParamMap;
    const modeParam = qp.get('mode');
    if (modeParam === 'CAMBIO') {
      this.activeMode = 'CAMBIO';
    } else {
      this.activeMode = 'DEVOLUCION';
    }

    const codeParam = qp.get('code');
    if (codeParam) {
      this.code = codeParam;
      void this.find();
    } else {
      this.loadClientOrders();
    }
  }

  get base() {
    return `${this.runtime.apiUrl}/retail`;
  }

  get hasReturns(): boolean {
    return Object.values(this.returns).some((q) => +q > 0);
  }

  setMode(mode: ExchangeMode) {
    if (this.activeMode === mode) return;
    this.activeMode = mode;
    this.error = '';
    if (mode === 'DEVOLUCION') {
      this.lines = [];
      if (this.order && this.hasReturns) {
        void this.calculate();
      }
    } else {
      this.quote = null;
      if (this.lines.length > 0 && this.order && this.hasReturns) {
        void this.calculate();
      }
    }
  }

  loadClientOrders() {
    this.loadingOrders.set(true);
    this.downloaded.list().subscribe({
      next: (orders) => {
        // Filtrar pedidos que aplican a cambio o devolución: PAGADO o ENTREGADO preferidos
        this.clientOrders.set(orders);
        this.loadingOrders.set(false);
      },
      error: () => {
        this.loadingOrders.set(false);
      },
    });
  }

  selectOrder(order: Order) {
    this.code = String(order.id);
    void this.find();
  }

  clearOrder() {
    this.order = null;
    this.quote = null;
    this.result = null;
    this.stripePaidSuccess = false;
    this.lines = [];
    this.returns = {};
    this.selectedProduct = null;
    this.selectedVariant = null;
    this.code = '';
    this.error = '';
    this.loadClientOrders();
  }

  variantName(id: number): string {
    const v = this.offline.bundle()?.variants.find((v) => v.id === id);
    const p = this.offline.bundle()?.products.find((p) => p.id === v?.producto_id);
    return p ? `${p.nombre} · ${v?.talla} · ${v?.color} (Bs ${p.precio})` : `Variante #${id}`;
  }

  get availableVariants() {
    return this.offline.bundle()?.variants ?? [];
  }

  get catalogProducts() {
    const products = this.offline.bundle()?.products ?? [];
    const q = this.garmentSearch.trim().toLowerCase();
    const cat = this.selectedCategory;
    return products.filter((p) => {
      const matchSearch =
        !q || p.nombre.toLowerCase().includes(q) || (p.marca && p.marca.toLowerCase().includes(q));
      const matchCat = !cat || p.categoria_id === cat;
      return matchSearch && matchCat;
    });
  }

  get categories() {
    return this.offline.bundle()?.categories ?? [];
  }

  productImage(p: any): string {
    return p?.imagenes?.[0] ? offlineMediaUrl(this.runtime.apiUrl, p.imagenes[0]) : '';
  }

  variantImage(variantId: number): string {
    const v = this.offline.bundle()?.variants.find((v) => v.id === variantId);
    const p = this.offline.bundle()?.products.find((p) => p.id === v?.producto_id);
    return this.productImage(p);
  }

  variantsForProduct(productId: number) {
    return this.offline.bundle()?.variants.filter((v) => v.producto_id === productId) ?? [];
  }

  // Modal Selector Boutique
  pickerProduct: any = null;
  pickerSelectedSize = '';
  pickerSelectedColor = '';
  pickerQuantity = 1;

  get pickerAvailableSizes(): string[] {
    if (!this.pickerProduct) return [];
    const variants = this.variantsForProduct(this.pickerProduct.id);
    return [...new Set(variants.map((v) => v.talla))].filter(Boolean);
  }

  get pickerAvailableColors(): string[] {
    if (!this.pickerProduct) return [];
    const variants = this.variantsForProduct(this.pickerProduct.id);
    const filtered = this.pickerSelectedSize
      ? variants.filter((v) => v.talla === this.pickerSelectedSize)
      : variants;
    return [...new Set(filtered.map((v) => v.color))].filter(Boolean);
  }

  get currentPickerVariant(): any | null {
    if (!this.pickerProduct) return null;
    const variants = this.variantsForProduct(this.pickerProduct.id);
    return (
      variants.find(
        (v) =>
          (!this.pickerSelectedSize || v.talla === this.pickerSelectedSize) &&
          (!this.pickerSelectedColor || v.color === this.pickerSelectedColor),
      ) ||
      variants[0] ||
      null
    );
  }

  get currentReturnCredit(): number {
    if (!this.order?.items) return 0;
    return this.order.items.reduce((sum: number, it: any) => {
      const q = this.returns[it.id] || 0;
      return sum + q * Number(it.credito_unitario || 0);
    }, 0);
  }

  openPicker(prod: any) {
    this.pickerProduct = prod;
    this.pickerQuantity = 1;
    this.selectedProduct = prod;
    const variants = this.variantsForProduct(prod.id);
    const sizes = [...new Set(variants.map((v) => v.talla))].filter(Boolean);
    this.pickerSelectedSize = sizes[0] || '';
    const filteredVars = this.pickerSelectedSize
      ? variants.filter((v) => v.talla === this.pickerSelectedSize)
      : variants;
    const colors = [...new Set(filteredVars.map((v) => v.color))].filter(Boolean);
    this.pickerSelectedColor = colors[0] || '';
    const variant = this.currentPickerVariant;
    if (variant) {
      this.variant = variant.id;
      this.selectedVariant = variant;
    }
  }

  closePicker() {
    this.pickerProduct = null;
  }

  selectPickerSize(size: string) {
    this.pickerSelectedSize = size;
    const colors = this.pickerAvailableColors;
    if (!colors.includes(this.pickerSelectedColor)) {
      this.pickerSelectedColor = colors[0] || '';
    }
    const variant = this.currentPickerVariant;
    if (variant) {
      this.variant = variant.id;
      this.selectedVariant = variant;
    }
  }

  selectPickerColor(color: string) {
    this.pickerSelectedColor = color;
    const variant = this.currentPickerVariant;
    if (variant) {
      this.variant = variant.id;
      this.selectedVariant = variant;
    }
  }

  changePickerQty(delta: number) {
    this.pickerQuantity = Math.max(1, this.pickerQuantity + delta);
  }

  confirmPickerAdd() {
    const v = this.currentPickerVariant;
    if (!v) {
      this.error = 'Por favor selecciona una talla y color disponibles.';
      return;
    }
    this.variant = v.id;
    this.quantity = this.pickerQuantity;
    this.addVariant();
    this.closePicker();
  }

  selectProduct(p: any) {
    this.openPicker(p);
  }

  selectVariant(v: any) {
    this.selectedVariant = v;
    this.variant = v.id;
  }

  addSelectedVariant() {
    if (!this.selectedVariant || this.quantity < 1) return;
    this.addVariant();
  }

  onStripePaid() {
    this.stripePaidSuccess = true;
    if (this.result) {
      this.result.stripe_payment_needed = false;
    }
    this.cdr.markForCheck();
  }

  async find() {
    await this.action(async () => {
      if (this.pending) throw new Error('Comprueba primero el resultado de la operación anterior.');
      if (!this.code.trim()) {
        throw new Error('Ingresa un número de pedido o código válido.');
      }
      this.order = await firstValueFrom(
        this.http.get(`${this.base}/orders/find`, { params: { code: this.code.trim() } }),
      );
      this.returns = {};
      this.lines = [];
      this.quote = null;
      this.result = null;
      this.requestId = crypto.randomUUID();

      // Inicializar prendas a devolver automáticamente
      if (this.order?.items) {
        for (const item of this.order.items) {
          if (item.disponible_cambio > 0) {
            this.returns[item.id] = 1;
          }
        }
      }

      if (!this.offline.usable()) {
        try {
          await this.offline.download();
        } catch (_) {}
      }

      // Si está en modo devolución, pre-calcular automáticamente
      if (this.activeMode === 'DEVOLUCION' && this.hasReturns) {
        await this.calculate();
      }
    });
  }

  toggleReturn(itemId: number, max: number) {
    const cur = this.returns[itemId] || 0;
    if (cur > 0) {
      this.returns[itemId] = 0;
    } else {
      this.returns[itemId] = Math.min(1, max);
    }
    this.quote = null;
    if (this.activeMode === 'DEVOLUCION') {
      void this.calculate();
    }
  }

  changeReturnQty(itemId: number, delta: number, max: number) {
    const cur = this.returns[itemId] || 0;
    const next = Math.max(0, Math.min(max, cur + delta));
    this.returns[itemId] = next;
    this.quote = null;
    if (this.activeMode === 'DEVOLUCION') {
      void this.calculate();
    }
  }

  addVariant() {
    const id = +this.variant;
    const q = +this.quantity;
    if (!id || q < 1 || !Number.isInteger(q)) {
      this.error = 'Elige una variante de prenda y cantidad válidas.';
      return;
    }
    const v = this.offline.bundle()?.variants.find((v) => v.id === id);
    const p = this.offline.bundle()?.products.find((p) => p.id === v?.producto_id);
    const line = this.lines.find((i) => i.variante_id === id);
    if (line) {
      line.cantidad += q;
    } else {
      this.lines.push({
        variante_id: id,
        cantidad: q,
        name: p ? `${p.nombre} · ${v?.talla} · ${v?.color}` : `Variante #${id}`,
        price: p ? Number(p.precio) : 0,
      });
    }
    this.variant = 0;
    this.quantity = 1;
    this.selectedVariant = null;
    this.quote = null;
    void this.calculate();
  }

  removeLine(index: number) {
    this.lines.splice(index, 1);
    this.quote = null;
    if (this.lines.length > 0 || this.activeMode === 'DEVOLUCION') {
      void this.calculate();
    }
  }

  setQuickNote(reason: string) {
    this.note = reason;
  }

  draft() {
    return {
      operacion_id: this.requestId,
      pedido_origen_id: this.order.pedido_id,
      sucursal_id: this.order.sucursal_id || 1,
      motivo: this.note.trim() || (this.activeMode === 'DEVOLUCION' ? 'Devolución de prenda' : 'Cambio de prenda'),
      devoluciones: Object.entries(this.returns)
        .filter(([, q]) => +q > 0)
        .map(([id, q]) => ({ item_pedido_id: +id, cantidad: +q })),
      prendas_nuevas: this.lines.map((i) => ({ variante_id: i.variante_id, cantidad: i.cantidad })),
      efectivo_recibido: this.paymentMethod === 'STRIPE' ? '0.00' : Number(this.received).toFixed(2),
      efectivo_devuelto: this.paymentMethod === 'STRIPE' ? '0.00' : Number(this.refunded).toFixed(2),
      metodo_pago: this.paymentMethod,
    };
  }

  async calculate() {
    if (!this.order || !this.hasReturns) return;
    await this.action(async () => {
      this.quote = await firstValueFrom(
        this.http.post(`${this.base}/exchanges?preview=true`, this.draft()),
      );
      this.received = String(Math.max(0, +this.quote.diferencia));
      this.refunded = String(Math.max(0, -this.quote.diferencia));
    });
  }

  async save() {
    if (!this.order || !this.hasReturns || this.pending) return;
    if (!this.quote) {
      await this.calculate();
      if (!this.quote) return;
    }
    await this.action(async () => {
      const owner = this.offline.owner();
      if (!owner) throw new Error('Inicia sesión para confirmar la operación.');
      const payload = this.draft();
      localStorage.setItem(`drapemind.exchange.pending|${owner}`, JSON.stringify(payload));
      this.pending = payload;
      await this.sendPending(owner);
    });
  }

  async refreshRefund() {
    const operation = this.result?.operacion_id;
    if (!operation) return;
    const owner = this.offline.owner();
    await this.action(async () => {
      const result = await firstValueFrom(this.http.get<any>(`${this.base}/exchanges/operations/${operation}`).pipe(timeout(15000)));
      if (owner !== this.offline.owner()) return;
      this.result = result;
    });
  }

  async checkPending() {
    await this.action(async () => {
      const owner = this.offline.owner();
      if (owner) await this.sendPending(owner, true);
    });
  }

  private async sendPending(owner: string, recover = false) {
    const payload = this.pending;
    try {
      let result: any;
      if (recover) {
        try {
          result = await firstValueFrom(
            this.http
              .get<any>(`${this.base}/exchanges/operations/${payload.operacion_id}`)
              .pipe(timeout(15000)),
          );
        } catch (e:any) {
          if(e.status!==404)throw e;
          result = await firstValueFrom(
            this.http.post<any>(`${this.base}/exchanges`, payload).pipe(timeout(15000)),
          );
        }
      } else {
        result = await firstValueFrom(
          this.http.post<any>(`${this.base}/exchanges`, payload).pipe(timeout(15000)),
        );
      }
      localStorage.removeItem(`drapemind.exchange.pending|${owner}`);
      this.pending = null;
      this.result = result;
      this.order = null;
      this.quote = null;
      this.lines = [];
      this.returns = {};
      this.loadClientOrders();
      this.cdr.markForCheck();
    } catch (err: any) {
      this.error = this.getSpecificError(err);
      this.cdr.markForCheck();
    }
  }

  private async action(fn: () => Promise<void>) {
    this.busy = true;
    this.error = '';
    try {
      await fn();
    } catch (err: any) {
      this.error = this.getSpecificError(err);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }

  private getSpecificError(err: any): string {
    if (!err) return 'Ocurrió un error inesperado al procesar la solicitud.';
    if (typeof err === 'string') return err;
    if (err.message && !err.status && !err.error) return err.message;
    if (err.status === 403) {
      return 'No tienes permisos para realizar cambios o devoluciones en este pedido, o el pedido pertenece a otra cuenta.';
    }
    if (err.status === 404) {
      return `No se encontró ningún pedido con el número "${this.code}". Verifica el número ingresado.`;
    }
    if (err.status === 409 || err.status === 400 || err.status === 422) {
      const detail = err.error?.detail;
      if (typeof detail === 'string') return detail;
      if (detail?.message) return detail.message;
      if (Array.isArray(detail)) return detail.map((d: any) => d.msg || JSON.stringify(d)).join(', ');
    }
    if (err.status === 503) {
      return 'Servicio no disponible temporalmente. Comprueba tu conexión o vuelve a intentar en unos segundos.';
    }
    return err.error?.detail || err.message || 'Error en la operación. Intenta nuevamente.';
  }
}
