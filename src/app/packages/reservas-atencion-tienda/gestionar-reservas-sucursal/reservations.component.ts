import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '@core/auth.service';
import { EventsSocketService } from '@core/events-socket.service';
import { Branch, Reservation, Order } from '@core/models';
import { BranchInventoryApiService } from '@core/api/branch-inventory-api.service';
import { CommerceApiService } from '@core/api/commerce-api.service';
import { ReservationsApiService } from '@core/api/reservations-api.service';
import { ToastService } from '@core/toast.service';
import { QrScannerComponent } from '@packages/reservas-atencion-tienda/atender-llegada-cliente/qr-scanner/qr-scanner.component';

@Component({
  selector: 'app-reservations',
  imports: [ReactiveFormsModule, FormsModule, QrScannerComponent],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent {
  readonly auth = inject(AuthService);
  private readonly reservationsApi = inject(ReservationsApiService);
  private readonly branchApi = inject(BranchInventoryApiService);
  private readonly commerceApi = inject(CommerceApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);

  readonly reservations = signal<Reservation[]>([]);
  readonly checkoutOrder = signal<Order | null>(null);
  readonly collectingCash = signal(false);

  collectCash(): void {
    const order = this.checkoutOrder();
    if (!order || this.collectingCash() || order.estado !== 'PENDIENTE_PAGO') return;
    this.collectingCash.set(true);
    this.commerceApi.confirmCashPayment(order.id).subscribe({
      next: (paid) => {
        this.collectingCash.set(false);
        this.checkoutOrder.set(paid);
        this.toast.show('Cobro registrado. Ya puedes descargar el comprobante.', 'success');
      },
      error: (error) => {
        this.collectingCash.set(false);
        this.toast.show(
          error?.error?.detail ?? 'No se confirmó el cobro. Revisa el pedido antes de reintentar.',
          'error',
        );
      },
    });
  }

  downloadCheckoutReceipt(): void {
    const order = this.checkoutOrder();
    if (!order) return;
    this.commerceApi.receipt(order.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `comprobante-${order.id}.txt`;
        link.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
      error: () => this.toast.show('No se pudo descargar el comprobante.', 'error'),
    });
  }
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal<number>(0);
  readonly statusFilter = signal('');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly query = signal('');

  readonly visibleReservations = computed(() => {
    const items = this.reservations();
    if (!items || !Array.isArray(items)) return [];
    const q = (this.query() || '').trim().toLowerCase();
    const st = this.statusFilter() || '';
    const bId = Number(this.branchId()) || 0;

    return items.filter((item) => {
      if (!item) return false;
      // Filtrar por sucursal específica si no es 0 ("Todas mis sucursales")
      if (bId > 0 && item.sucursal_id && Number(item.sucursal_id) !== bId) {
        return false;
      }
      // Filtrar por estado si está seleccionado
      if (st && item.estado !== st) {
        return false;
      }
      // Búsqueda libre
      if (q) {
        const bName = this.branchName(item.sucursal_id);
        const code = this.reservationCode(item);
        const idStr = String(item.id ?? '');
        const obs = item.observacion || '';
        const pub = item.codigo_publico ? String(item.codigo_publico) : '';
        const searchTarget =
          `${idStr} ${code} ${pub} ${obs} ${bName} ${item.estado || ''}`.toLowerCase();
        if (!searchTarget.includes(q)) return false;
      }
      return true;
    });
  });

  readonly pendingCancel = signal<Reservation | null>(null);
  readonly cancelDialog = viewChild<ElementRef<HTMLDialogElement>>('cancelDialog');
  readonly qrDialog = viewChild<ElementRef<HTMLDialogElement>>('qrDialog');
  private requestVersion = 0;
  readonly qrToken = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly validating = signal(false);
  readonly actionId = signal<number | null>(null);
  readonly qrPreviewUrl = signal<string | null>(null);
  readonly qrReservation = signal<Reservation | null>(null);

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.closeQr();
    });
    if (this.auth.user()?.rol !== 'CLIENTE') {
      this.branchApi.assignedBranches().subscribe({
        next: (branches) => this.branches.set(Array.isArray(branches) ? branches : []),
      });
    }
    effect(() => {
      const event = this.events.events().at(0);
      if (event?.type?.startsWith('reservation_')) {
        untracked(() => this.load());
      }
    });
    this.load();
  }

  load(): void {
    const version = ++this.requestVersion;
    this.loadError.set('');
    this.loading.set(true);
    const bId = Number(this.branchId()) || 0;
    const request =
      this.auth.user()?.rol === 'CLIENTE'
        ? this.reservationsApi.myReservations()
        : this.reservationsApi.reservations(
            this.statusFilter() || undefined,
            bId > 0 ? bId : undefined,
          );

    request.subscribe({
      next: (items) => {
        if (version !== this.requestVersion) return;
        this.reservations.set(Array.isArray(items) ? items : []);
        this.loading.set(false);
      },
      error: (err) => {
        if (version !== this.requestVersion) return;
        this.loading.set(false);
        this.loadError.set(
          err?.error?.detail ||
            'No pudimos consultar las reservas. Tus datos no se han modificado.',
        );
      },
    });
  }

  onBranchFilterChange(val: string | number): void {
    this.branchId.set(Number(val) || 0);
    this.load();
  }

  onStatusFilterChange(val: string): void {
    this.statusFilter.set(val || '');
    this.load();
  }

  formatId(id: number | string | null | undefined): string {
    if (id === null || id === undefined) return '0000';
    return String(id).padStart(4, '0');
  }

  formatDate(dateVal: string | null | undefined): string {
    if (!dateVal) return '—';
    try {
      const d = new Date(dateVal);
      if (isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('es-BO', {
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
    } catch {
      return '—';
    }
  }

  reservationCode(reservation: Reservation | null | undefined): string {
    if (!reservation) return 'RES-0000';
    if (reservation.codigo_publico) {
      const clean = String(reservation.codigo_publico)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toUpperCase();
      return `RES-${clean.slice(0, 8)}`;
    }
    return `RES-${this.formatId(reservation.id)}`;
  }

  onQrDecoded(token: string): void {
    this.qrToken.setValue(token);
    this.toast.show('QR detectado con éxito', 'success');
    this.validateQr();
  }

  validateQr(): void {
    if (this.qrToken.invalid || this.validating()) return;
    this.validating.set(true);
    const codeEntered = this.qrToken.value.trim();
    this.reservationsApi.validateQr(codeEntered).subscribe({
      next: (reservation) => {
        this.validating.set(false);
        this.qrToken.reset();
        this.toast.show(
          `Reserva ${this.reservationCode(reservation)} validada correctamente`,
          'success',
        );
        this.load();
      },
      error: (error) => {
        this.validating.set(false);
        this.toast.show(error?.error?.detail ?? 'Código o QR inválido', 'error');
      },
    });
  }

  convert(reservation: Reservation): void {
    if (this.actionId() !== null) return;
    if (['CONVERTIDA', 'CANCELADA'].includes(reservation.estado)) {
      this.toast.show(`La reserva ya está en estado ${reservation.estado.toLowerCase()}`, 'info');
      return;
    }
    this.actionId.set(reservation.id);
    this.reservationsApi.convertReservation(reservation.id).subscribe({
      next: (order) => {
        this.actionId.set(null);
        this.toast.show(`Reserva convertida en pedido #${order.id}`, 'success');
        this.checkoutOrder.set(order);
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        const detail = error?.error?.detail ?? 'No se pudo convertir la reserva';
        this.toast.show(detail, 'error');
        // Recargar reservas para sincronizar estado real tras conflicto (ej. 409)
        this.load();
      },
    });
  }

  prepare(reservation: Reservation): void {
    this.runAction(
      reservation,
      this.reservationsApi.prepareReservation(reservation.id),
      `Reserva #${reservation.id} en preparación`,
    );
  }

  markReady(reservation: Reservation): void {
    this.runAction(
      reservation,
      this.reservationsApi.markReservationReady(reservation.id),
      `Reserva #${reservation.id} lista para recojo`,
    );
  }

  cancel(reservation: Reservation): void {
    this.pendingCancel.set(reservation);
    this.cancelDialog()?.nativeElement.showModal();
  }

  confirmCancel(): void {
    const reservation = this.pendingCancel();
    if (!reservation) return;
    this.cancelDialog()?.nativeElement.close();
    this.runAction(
      reservation,
      this.reservationsApi.cancelReservation(reservation.id),
      `Reserva #${reservation.id} cancelada`,
    );
  }

  showQr(reservation: Reservation): void {
    this.reservationsApi.reservationQr(reservation.id).subscribe({
      next: (blob) => {
        this.closeQr();
        this.qrPreviewUrl.set(URL.createObjectURL(blob));
        this.qrReservation.set(reservation);
        this.qrDialog()?.nativeElement.showModal();
      },
      error: (error) => this.toast.show(error?.error?.detail ?? 'El QR ya no está activo', 'error'),
    });
  }

  closeQr(): void {
    this.qrDialog()?.nativeElement.close();
    const current = this.qrPreviewUrl();
    if (current) URL.revokeObjectURL(current);
    this.qrPreviewUrl.set(null);
    this.qrReservation.set(null);
  }

  canPrepare(): boolean {
    return ['ADMIN', 'VENDEDOR', 'ENCARGADO'].includes(this.auth.user()?.rol ?? '');
  }

  canConvert(): boolean {
    return ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO'].includes(this.auth.user()?.rol ?? '');
  }

  private runAction(
    reservation: Reservation,
    request: ReturnType<ReservationsApiService['cancelReservation']>,
    message: string,
  ): void {
    if (this.actionId() !== null) return;
    this.actionId.set(reservation.id);
    request.subscribe({
      next: () => {
        this.actionId.set(null);
        this.toast.show(message, 'success');
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo actualizar la reserva', 'error');
      },
    });
  }

  timeProgress(reservation: Reservation | null | undefined): number {
    if (!reservation?.fecha_reserva || !reservation?.vence_at) return 100;
    const start = new Date(reservation.fecha_reserva).getTime();
    const end = new Date(reservation.vence_at).getTime();
    const now = Date.now();
    if (isNaN(start) || isNaN(end) || end <= start) return 100;
    const pct = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  branchName(id: number | null | undefined): string {
    if (id === null || id === undefined) return 'Sin sucursal';
    const numId = Number(id);
    const found = this.branches().find((branch) => branch.id === numId);
    return found?.nombre ?? `Sucursal #${numId}`;
  }

  stateLabel(state: string | null | undefined): string {
    if (!state) return 'Desconocido';
    const labels: Record<string, string> = {
      PENDIENTE: 'Por recibir',
      CONFIRMADA: 'Visita confirmada',
      EN_PREPARACION: 'En preparación',
      LISTA: 'Lista para recojo',
      RETIRADA: 'Cliente atendido',
      CONVERTIDA: 'Convertida en compra',
      CANCELADA: 'Cancelada',
      VENCIDA: 'Vencida',
    };
    return labels[state] ?? state;
  }
}
