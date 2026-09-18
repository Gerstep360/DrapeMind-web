import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '@core/auth.service';
import { EventsSocketService } from '@core/events-socket.service';
import {
  AiAnalyticsOverview,
  AiRuntimeStatus,
  Order,
  Reservation,
  SalesHistoryItem,
  SalesInventoryMetrics,
} from '@core/models';
import { AdminApiService } from '@core/api/admin-api.service';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { OperationsApiService } from '@core/api/operations-api.service';
import { ReservationsApiService } from '@core/api/reservations-api.service';
import { ToastService } from '@core/toast.service';

interface CommercialSummary {
  total_ventas: number;
  total_pedidos: number;
  total_usuarios: number;
  total_productos: number;
  pedidos_por_estado: Record<string, number>;
}

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  readonly auth = inject(AuthService);
  private readonly operationsApi = inject(OperationsApiService);
  private readonly adminApi = inject(AdminApiService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly reservationsApi = inject(ReservationsApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);

  readonly loading = signal(true);
  readonly activeTab = signal<'general' | 'ai_audit' | 'runtime'>('general');

  // Metricas operativas estandar
  readonly metrics = signal<SalesInventoryMetrics | null>(null);
  readonly orders = signal<Order[]>([]);
  readonly reservations = signal<Reservation[]>([]);
  readonly runtime = signal<AiRuntimeStatus | null>(null);
  readonly runtimeBusy = signal(false);

  // CU-40: Analitica avanzada y auditoria
  readonly commercialSummary = signal<CommercialSummary | null>(null);
  readonly aiAnalytics = signal<AiAnalyticsOverview | null>(null);
  readonly salesHistory = signal<SalesHistoryItem[]>([]);
  readonly aiTypeMetrics = signal<Array<{ tipo: string; total: number; duracion_promedio_ms: number }>>([]);

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
    const orders$ = role === 'CLIENTE' ? this.commerceApi.myOrders() : this.commerceApi.orders();
    const reservations$ = role === 'CLIENTE' ? this.reservationsApi.myReservations() : this.reservationsApi.reservations();

    if (role === 'ADMIN') {
      forkJoin({
        orders: orders$,
        reservations: reservations$,
        metrics: this.operationsApi.metrics(),
        runtime: this.operationsApi.aiRuntime(),
        commercial: this.adminApi.getCommercialDashboard(),
        aiAnalytics: this.adminApi.getAiAnalytics(30),
        salesHistory: this.adminApi.getSalesHistory(30),
        aiTypes: this.adminApi.getAiTypeMetrics(),
      }).subscribe({
        next: (data) => {
          this.orders.set(data.orders);
          this.reservations.set(data.reservations);
          this.metrics.set(data.metrics);
          this.runtime.set(data.runtime);
          this.commercialSummary.set(data.commercial);
          this.aiAnalytics.set(data.aiAnalytics);
          this.salesHistory.set(data.salesHistory);
          this.aiTypeMetrics.set(data.aiTypes);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
        },
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

  setTab(tab: 'general' | 'ai_audit' | 'runtime'): void {
    this.activeTab.set(tab);
  }

  toggleRuntime(): void {
    const current = this.runtime();
    if (!current || this.runtimeBusy()) return;
    this.runtimeBusy.set(true);
    const action = current.running ? this.operationsApi.stopAi() : this.operationsApi.startAi();
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

  getOrderStatusCount(status: string): number {
    return this.commercialSummary()?.pedidos_por_estado[status] ?? 0;
  }

  getOrderStatusPercentage(status: string): number {
    const total = this.commercialSummary()?.total_pedidos ?? 0;
    if (total === 0) return 0;
    const count = this.getOrderStatusCount(status);
    return Math.round((count / total) * 100);
  }
}
