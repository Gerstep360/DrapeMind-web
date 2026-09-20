import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { of, switchMap } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { EventsSocketService } from '@core/events-socket.service';
import { Branch, BranchStock, Order, Payment } from '@core/models';
import { BranchInventoryApiService } from '@core/api/branch-inventory-api.service';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ToastService } from '@core/toast.service';
import { ReceiptModalComponent } from '@shared/components/receipt-modal/receipt-modal.component';
import { StripePaymentComponent } from '@shared/components/stripe-payment.component';
import { CashPaymentModalComponent } from '@shared/components/cash-payment-modal/cash-payment-modal.component';

@Component({
  selector: 'app-orders',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReceiptModalComponent,
    StripePaymentComponent,
    CashPaymentModalComponent,
  ],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent {
  readonly auth = inject(AuthService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly branchApi = inject(BranchInventoryApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<string>('TODOS');
  readonly actionId = signal<number | null>(null);

  // Pay modal
  readonly payModalOpen = signal(false);
  readonly selectedOrderForPay = signal<Order | null>(null);
  readonly currentPayment = signal<Payment | null>(null);
  readonly payingMock = signal(false);
  readonly paymentError = signal('');

  // Receipt modal (PDF & Image export)
  readonly receiptModalOpen = signal(false);
  readonly selectedReceiptOrderId = signal<number | null>(null);

  // Cash Payment modal (Dedicated Dialog with live change calculator)
  readonly cashModalOpen = signal<boolean>(false);
  readonly selectedOrderForCash = signal<Order | null>(null);

  openCashModal(order: Order): void {
    this.selectedOrderForCash.set(order);
    this.cashModalOpen.set(true);
  }

  closeCashModal(): void {
    this.cashModalOpen.set(false);
    this.selectedOrderForCash.set(null);
  }

  onCashPaymentProcessed(_result: { order: Order; cashReceived: number; change: number }): void {
    this.load();
  }

  // POS / Counter Sale modal (CU-37)
  readonly posModalOpen = signal(false);
  readonly posBranches = signal<Branch[]>([]);
  readonly posSelectedBranchId = signal<number | null>(null);
  readonly posStockList = signal<BranchStock[]>([]);
  readonly posSearchTerm = signal<string>('');
  readonly posSelectedStock = signal<BranchStock | null>(null);
  readonly posQuantity = signal<number>(1);
  readonly posPaymentMethod = signal<string>('EFECTIVO');
  readonly posLoadingStock = signal<boolean>(false);
  readonly posSubmitting = signal<boolean>(false);

  constructor() {
    effect(() => {
      const event = this.events.events().at(0);
      if (event?.type.startsWith('order_') || event?.type.startsWith('payment_')) this.load();
    });

    this.route.queryParamMap.subscribe((params) => {
      const orderIdStr = params.get('id');
      if (orderIdStr) {
        const orderId = Number(orderIdStr);
        if (!isNaN(orderId) && orderId > 0) {
          this.filter.set('TODOS');
          this.selectedReceiptOrderId.set(orderId);
          this.receiptModalOpen.set(true);
        }
      }
    });

    this.load();
  }

  load(): void {
    const request = this.auth.user()?.rol === 'CLIENTE' ? this.commerceApi.myOrders() : this.commerceApi.orders();
    request.subscribe({
      next: (orders) => {
        this.orders.set(orders);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  filteredOrders(): Order[] {
    return this.filter() === 'TODOS'
      ? this.orders()
      : this.orders().filter((order) => order.estado === this.filter());
  }

  nextStatuses(order: Order): string[] {
    const transitions: Record<Order['estado'], string[]> = {
      PENDIENTE_PAGO: ['CANCELADO'],
      PAGADO: ['PREPARANDO'],
      PREPARANDO: ['LISTO'],
      LISTO: ['ENVIADO', 'ENTREGADO'],
      ENVIADO: ['ENTREGADO'],
      ENTREGADO: [],
      CANCELADO: [],
    };
    return transitions[order.estado] || [];
  }

  updateStatus(order: Order, status: string): void {
    this.actionId.set(order.id);
    this.commerceApi.updateOrderStatus(order.id, status).subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show(`Pedido #${order.id} actualizado a ${status}`, 'success');
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo actualizar el pedido', 'error');
      },
    });
  }

  // Estado de efectivo recibido por pedido para cobro en mostrador
  readonly orderCashReceived = signal<Record<number, number | null>>({});

  getCashReceived(orderId: number): number | null {
    return this.orderCashReceived()[orderId] ?? null;
  }

  setCashReceived(orderId: number, amount: number | null): void {
    this.orderCashReceived.update((map) => ({
      ...map,
      [orderId]: amount,
    }));
  }

  onOrderCashInput(orderId: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value !== '' ? Number(input.value) : null;
    this.setCashReceived(orderId, val);
  }

  setExactCash(orderId: number, total: number): void {
    this.setCashReceived(orderId, total);
  }

  getCashChange(orderId: number, total: number): number {
    const received = this.getCashReceived(orderId);
    if (received === null || received === undefined) return 0;
    return received >= total ? Number((received - total).toFixed(2)) : 0;
  }

  isCashInsufficient(orderId: number, total: number): boolean {
    const received = this.getCashReceived(orderId);
    if (received === null || received === undefined) return false;
    return received < total;
  }

  getMissingCash(orderId: number, total: number): number {
    const received = this.getCashReceived(orderId);
    if (received === null || received === undefined) return 0;
    return received < total ? Number((total - received).toFixed(2)) : 0;
  }

  getQuickBills(total: number): number[] {
    if (!total || total <= 0) return [50, 100, 200];
    const bills: number[] = [];
    const step = total > 500 ? 100 : total > 100 ? 50 : 20;
    let nextRound = Math.ceil(total / step) * step;
    if (nextRound <= total) nextRound += step;
    bills.push(nextRound);

    const nextRound2 = nextRound + (step === 20 ? 50 : step);
    if (!bills.includes(nextRound2)) bills.push(nextRound2);

    if (total <= 500 && !bills.includes(500)) {
      bills.push(500);
    } else if (total > 500 && !bills.includes(1000)) {
      bills.push(1000);
    }

    return bills.slice(0, 3);
  }

  confirmCashPayment(order: Order): void {
    const received = this.getCashReceived(order.id);
    const change = this.getCashChange(order.id, order.total);

    if (received !== null && received < order.total) {
      this.toast.show(
        `El monto recibido (Bs. ${received.toFixed(2)}) es menor al total (Bs. ${order.total.toFixed(2)})`,
        'error',
      );
      return;
    }

    this.actionId.set(order.id);
    this.commerceApi.confirmCashPayment(order.id).subscribe({
      next: () => {
        this.actionId.set(null);
        if (received !== null && change > 0) {
          this.toast.show(
            `Cobro de Bs. ${received.toFixed(2)} registrado para el pedido #${order.id}. Entregar cambio de Bs. ${change.toFixed(2)} al cliente.`,
            'success',
          );
        } else {
          this.toast.show(
            `Cobro en efectivo registrado para el pedido #${order.id}. Venta completada con éxito.`,
            'success',
          );
        }
        this.setCashReceived(order.id, null);
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo registrar el cobro en efectivo', 'error');
      },
    });
  }

  openPaymentModal(order: Order): void {
    this.paymentError.set('');
    this.selectedOrderForPay.set(order);
    this.payModalOpen.set(true);
    this.currentPayment.set(null);

    this.commerceApi
      .paymentConfiguration().pipe(switchMap(config => config.provider === 'stripe' ? of(null) : this.commerceApi.initiatePayment({
        pedido_id: order.id,
        metodo: 'QR',
      }, `web-order-${order.id}-qr`)))
      .subscribe({
        next: (payment) => {
          if (this.selectedOrderForPay()?.id !== order.id || !this.payModalOpen()) return;
          this.currentPayment.set(payment);
        },
        error: (err) => {
          if (this.selectedOrderForPay()?.id !== order.id || !this.payModalOpen()) return;
          this.paymentError.set(err?.error?.detail || 'El pago no está disponible. Intenta nuevamente más tarde.');
          this.toast.show(err?.error?.detail || 'No se pudo generar el enlace de pago', 'error');
        },
      });
  }

  closePaymentModal(): void {
    this.payModalOpen.set(false);
    this.selectedOrderForPay.set(null);
    this.currentPayment.set(null);
  }

  refreshPayment(): void {
    const payment = this.currentPayment();
    if (!payment || this.payingMock()) return;
    this.payingMock.set(true);
    this.commerceApi.payment(payment.id).subscribe({
      next: (updated) => {
        this.payingMock.set(false);
        this.currentPayment.set(updated);
        this.toast.show(`Estado registrado: ${updated.estado}`, updated.estado === 'APROBADO' ? 'success' : 'info');
        this.load();
      },
      error: () => { this.payingMock.set(false); this.toast.show('No se pudo consultar el pago. Reintenta.', 'error'); },
    });
  }

  openReceiptModal(order: Order): void {
    this.selectedReceiptOrderId.set(order.id);
    this.receiptModalOpen.set(true);
  }

  closeReceiptModal(): void {
    this.receiptModalOpen.set(false);
    this.selectedReceiptOrderId.set(null);
  }

  downloadReceipt(order: Order): void {
    this.openReceiptModal(order);
  }

  confirmMockPayment(): void {
    const payment = this.currentPayment();
    if (!payment || this.payingMock()) return;
    this.payingMock.set(true);

    this.commerceApi.mockConfirmPayment(payment.id).subscribe({
      next: () => {
        this.payingMock.set(false);
        this.toast.show('¡Pago completado exitosamente!', 'success');
        this.closePaymentModal();
        this.load();
      },
      error: (err) => {
        this.payingMock.set(false);
        this.toast.show(err?.error?.detail || 'Error al procesar el pago', 'error');
      },
    });
  }

  // POS / Counter Sale Methods (CU-37)
  openPosModal(): void {
    this.posModalOpen.set(true);
    this.posSelectedStock.set(null);
    this.posQuantity.set(1);
    this.posSearchTerm.set('');
    this.posPaymentMethod.set('EFECTIVO');

    this.branchApi.branches().subscribe({
      next: (branches) => {
        this.posBranches.set(branches);
        if (branches.length > 0) {
          const defaultBranchId = branches[0].id;
          this.posSelectedBranchId.set(defaultBranchId);
          this.loadPosStock(defaultBranchId);
        }
      },
      error: () => this.toast.show('Error al cargar sucursales para el punto de venta', 'error'),
    });
  }

  closePosModal(): void {
    this.posModalOpen.set(false);
    this.posSelectedStock.set(null);
    this.posQuantity.set(1);
    this.posSearchTerm.set('');
  }

  onBranchChange(branchIdStr: string): void {
    const branchId = Number(branchIdStr);
    if (!isNaN(branchId)) {
      this.posSelectedBranchId.set(branchId);
      this.posSelectedStock.set(null);
      this.posQuantity.set(1);
      this.loadPosStock(branchId);
    }
  }

  loadPosStock(branchId: number): void {
    this.posLoadingStock.set(true);
    this.branchApi.branchAvailability(branchId).subscribe({
      next: (stocks) => {
        this.posStockList.set(stocks || []);
        this.posLoadingStock.set(false);
      },
      error: () => {
        this.posStockList.set([]);
        this.posLoadingStock.set(false);
      },
    });
  }

  filteredPosStocks(): BranchStock[] {
    const query = this.posSearchTerm().trim().toLowerCase();
    const stocks = this.posStockList();
    if (!query) return stocks.slice(0, 15);
    return stocks
      .filter(
        (s) =>
          s.producto.toLowerCase().includes(query) ||
          s.sku.toLowerCase().includes(query) ||
          s.color.toLowerCase().includes(query) ||
          s.talla.toLowerCase().includes(query)
      )
      .slice(0, 25);
  }

  selectPosStock(item: BranchStock): void {
    this.posSelectedStock.set(item);
    this.posQuantity.set(1);
  }

  submitPosSale(): void {
    const branchId = this.posSelectedBranchId();
    const stock = this.posSelectedStock();
    const qty = this.posQuantity();

    if (!branchId) {
      this.toast.show('Selecciona una sucursal para la venta', 'info');
      return;
    }
    if (!stock) {
      this.toast.show('Selecciona una prenda/variante para la venta', 'info');
      return;
    }
    if (qty < 1 || qty > stock.stock_disponible) {
      this.toast.show(`Cantidad no válida (Disponible: ${stock.stock_disponible})`, 'info');
      return;
    }

    this.posSubmitting.set(true);
    this.commerceApi
      .createPosSale({
        sucursal_id: branchId,
        items: [
          {
            variante_id: stock.variante_id,
            cantidad: qty,
            precio_unitario: Number(stock.precio || 0),
          },
        ],
        metodo_pago: this.posPaymentMethod(),
      })
      .subscribe({
        next: (res) => {
          this.posSubmitting.set(false);
          this.toast.show(
            `¡Venta en mostrador registrada exitosamente! Pedido #${res.pedido_id}.`,
            'success'
          );
          this.closePosModal();
          this.load();
          // Abrir inmediatamente el comprobante para descarga o impresión
          this.selectedReceiptOrderId.set(res.pedido_id);
          this.receiptModalOpen.set(true);
        },
        error: (err) => {
          this.posSubmitting.set(false);
          const detail = err?.error?.detail || 'Error al procesar la venta en mostrador';
          this.toast.show(detail, 'error');
        },
      });
  }
}
