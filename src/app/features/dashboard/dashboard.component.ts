import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../core/auth.service';
import { EventsSocketService } from '../../core/events-socket.service';
import { AiRuntimeStatus, Order, Reservation, SalesInventoryMetrics } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(StoreApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly metrics = signal<SalesInventoryMetrics | null>(null);
  readonly orders = signal<Order[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly runtime = signal<AiRuntimeStatus | null>(null);
  readonly runtimeBusy = signal(false);

  constructor() {
    effect(() => {
      const latest = this.events.events().at(0);
      if (latest?.type.startsWith('order_') || latest?.type.startsWith('reservation_')) {
        this.load();
      }
    });
    this.load();
  }

  load(): void {
    const role = this.auth.user()?.rol;
    const orders$ = role === 'CLIENTE' ? this.api.myOrders() : this.api.orders();
    const reservations$ = role === 'CLIENTE' ? this.api.myReservations() : this.api.reservations();
    if (role === 'ADMIN') {
      forkJoin({
        orders: orders$,
        reservations: reservations$,
        metrics: this.api.metrics(),
        runtime: this.api.aiRuntime(),
      }).subscribe({
        next: (data) => {
          this.orders.set(data.orders);
          this.reservations.set(data.reservations);
          this.metrics.set(data.metrics);
          this.runtime.set(data.runtime);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    } else {
      forkJoin({ orders: orders$, reservations: reservations$ }).subscribe({
        next: (data) => {
          this.orders.set(data.orders);
          this.reservations.set(data.reservations);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
    }
  }

  toggleRuntime(): void {
    const current = this.runtime();
    if (!current || this.runtimeBusy()) return;
    this.runtimeBusy.set(true);
    const action = current.running ? this.api.stopAi() : this.api.startAi();
    action.subscribe({
      next: (status) => {
        this.runtime.set(status);
        this.runtimeBusy.set(false);
        this.toast.show(
          status.running ? 'Gemma esta listo' : 'Gemma fue descargado de memoria',
          'success',
        );
      },
      error: (error) => {
        this.runtimeBusy.set(false);
        this.toast.show(error?.error?.detail ?? 'No se pudo cambiar el runtime', 'error');
      },
    });
  }

  get activeOrders(): number {
    return this.orders().filter((order) => !['ENTREGADO', 'CANCELADO'].includes(order.estado))
      .length;
  }

  get activeReservations(): number {
    return this.reservations().filter((reservation) =>
      ['PENDIENTE', 'CONFIRMADA'].includes(reservation.estado),
    ).length;
  }
}
