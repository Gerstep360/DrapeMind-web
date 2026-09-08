import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth.service';
import { EventsSocketService } from '../../core/events-socket.service';
import { Order, Payment } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-orders',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OrdersComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(StoreApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);

  readonly orders = signal<Order[]>([]);
  readonly loading = signal(true);
  readonly filter = signal<string>('TODOS');
  readonly actionId = signal<number | null>(null);

  // Pay modal
  readonly payModalOpen = signal(false);
  readonly selectedOrderForPay = signal<Order | null>(null);
  readonly currentPayment = signal<Payment | null>(null);
  readonly payingMock = signal(false);

  constructor() {
    effect(() => {
      const event = this.events.events().at(0);
      if (event?.type.startsWith('order_') || event?.type.startsWith('payment_')) this.load();
    });
    this.load();
  }

  load(): void {
    const request = this.auth.user()?.rol === 'CLIENTE' ? this.api.myOrders() : this.api.orders();
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
      PREPARANDO: ['LISTO', 'CANCELADO'],
      LISTO: ['ENVIADO', 'ENTREGADO'],
      ENVIADO: ['ENTREGADO'],
      ENTREGADO: [],
      CANCELADO: [],
    };
    return transitions[order.estado] || [];
  }

  updateStatus(order: Order, status: string): void {
    this.actionId.set(order.id);
    this.api.updateOrderStatus(order.id, status).subscribe({
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

  confirmCashPayment(order: Order): void {
    this.actionId.set(order.id);
    this.api.confirmCashPayment(order.id).subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show(`Cobro en efectivo registrado para el pedido #${order.id}. Venta completada con éxito.`, 'success');
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo registrar el cobro en efectivo', 'error');
      },
    });
  }

  openPaymentModal(order: Order): void {
    this.selectedOrderForPay.set(order);
    this.payModalOpen.set(true);
    this.currentPayment.set(null);

    this.api
      .initiatePayment({
        pedido_id: order.id,
        metodo: 'QR',
      }, `web-order-${order.id}-qr`)
      .subscribe({
        next: (payment) => {
          this.currentPayment.set(payment);
        },
        error: (err) => {
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
    this.api.payment(payment.id).subscribe({
      next: (updated) => {
        this.payingMock.set(false);
        this.currentPayment.set(updated);
        this.toast.show(`Estado registrado: ${updated.estado}`, updated.estado === 'APROBADO' ? 'success' : 'info');
        this.load();
      },
      error: () => { this.payingMock.set(false); this.toast.show('No se pudo consultar el pago. Reintenta.', 'error'); },
    });
  }

  downloadReceipt(order: Order): void {
    this.api.receipt(order.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url; link.download = `comprobante-${order.id}.txt`; link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.toast.show('El comprobante requiere un pago aprobado', 'error'),
    });
  }

  confirmMockPayment(): void {
    const payment = this.currentPayment();
    if (!payment || this.payingMock()) return;
    this.payingMock.set(true);

    this.api.mockConfirmPayment(payment.id).subscribe({
      next: () => {
        this.payingMock.set(false);
        this.toast.show('¡Pago completado exitosamente! 💳', 'success');
        this.closePaymentModal();
        this.load();
      },
      error: (err) => {
        this.payingMock.set(false);
        this.toast.show(err?.error?.detail || 'Error al procesar el pago', 'error');
      },
    });
  }
}
