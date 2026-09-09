import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, ElementRef, effect, inject, signal, viewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { EventsSocketService } from '../../core/events-socket.service';
import { Branch, Reservation } from '../../core/models';
import { StoreApiService } from '../../core/store-api.service';
import { ToastService } from '../../core/toast.service';

@Component({
  selector: 'app-reservations',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './reservations.component.html',
  styleUrl: './reservations.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservationsComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(StoreApiService);
  private readonly events = inject(EventsSocketService);
  private readonly toast = inject(ToastService);

  readonly reservations = signal<Reservation[]>([]);
  readonly branches = signal<Branch[]>([]);
  readonly branchId = signal(0);
  readonly statusFilter = signal('');
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly query = signal('');
  readonly visibleReservations = computed(() => this.reservations().filter(item =>
    (!this.statusFilter() || item.estado === this.statusFilter()) &&
    (!this.query().trim() || [item.id, item.codigo_publico, item.observacion, this.branchName(item.sucursal_id)]
      .join(' ').toLowerCase().includes(this.query().trim().toLowerCase()))));
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
    inject(DestroyRef).onDestroy(() => this.closeQr());
    if (this.auth.user()?.rol !== 'CLIENTE') {
      this.api.assignedBranches().subscribe({ next: (branches) => this.branches.set(branches) });
    }
    effect(() => {
      const event = this.events.events().at(0);
      if (event?.type.startsWith('reservation_')) this.load();
    });
    this.load();
  }

  load(): void {
    const version = ++this.requestVersion;
    this.loadError.set('');
    this.loading.set(true);
    const request =
      this.auth.user()?.rol === 'CLIENTE' ? this.api.myReservations() : this.api.reservations(this.statusFilter(), this.branchId());
    request.subscribe({
      next: (items) => {
        if (version !== this.requestVersion) return;
        this.reservations.set(items);
        this.loading.set(false);
      },
      error: () => {
        if (version !== this.requestVersion) return;
        this.loading.set(false);
        this.loadError.set('No pudimos consultar las reservas. Tus datos no se han modificado.');
      },
    });
  }

  validateQr(): void {
    if (this.qrToken.invalid || this.validating()) return;
    this.validating.set(true);
    this.api.validateQr(this.qrToken.value.trim()).subscribe({
      next: (reservation) => {
        this.validating.set(false);
        this.qrToken.reset();
        this.toast.show(`Reserva #${reservation.id} validada`, 'success');
        this.load();
      },
      error: (error) => {
        this.validating.set(false);
        this.toast.show(error?.error?.detail ?? 'QR invalido', 'error');
      },
    });
  }

  convert(reservation: Reservation): void {
    if (this.actionId() !== null) return;
    this.actionId.set(reservation.id);
    this.api.convertReservation(reservation.id).subscribe({
      next: (order) => {
        this.actionId.set(null);
        this.toast.show(`Reserva convertida en pedido #${order.id}`, 'success');
        this.load();
      },
      error: (error) => {
        this.actionId.set(null);
        this.toast.show(error?.error?.detail ?? 'No se pudo convertir la reserva', 'error');
      },
    });
  }

  prepare(reservation: Reservation): void {
    this.runAction(
      reservation,
      this.api.prepareReservation(reservation.id),
      `Reserva #${reservation.id} en preparación`,
    );
  }

  markReady(reservation: Reservation): void {
    this.runAction(
      reservation,
      this.api.markReservationReady(reservation.id),
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
      this.api.cancelReservation(reservation.id),
      `Reserva #${reservation.id} cancelada`,
    );
  }

  showQr(reservation: Reservation): void {
    this.api.reservationQr(reservation.id).subscribe({
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
    request: ReturnType<StoreApiService['cancelReservation']>,
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

  timeProgress(reservation: Reservation): number {
    const start = new Date(reservation.fecha_reserva).getTime();
    const end = new Date(reservation.vence_at).getTime();
    const now = Date.now();
    return end > start ? Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100)) : 100;
  }

  branchName(id: number | null): string {
    return this.branches().find(branch => branch.id === id)?.nombre ?? (id ? 'Sucursal #' + id : 'Sin sucursal');
  }

  stateLabel(state: string): string {
    return ({PENDIENTE: 'Por recibir', CONFIRMADA: 'Visita confirmada', EN_PREPARACION: 'En preparación',
      LISTA: 'Lista para recojo', RETIRADA: 'Cliente atendido', CONVERTIDA: 'Convertida en compra',
      CANCELADA: 'Cancelada', VENCIDA: 'Vencida'} as Record<string, string>)[state] ?? state;
  }
}
