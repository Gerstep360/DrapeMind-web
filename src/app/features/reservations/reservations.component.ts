import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { EventsSocketService } from '../../core/events-socket.service';
import { Reservation } from '../../core/models';
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
  readonly loading = signal(true);
  readonly qrToken = new FormControl('', { nonNullable: true, validators: Validators.required });
  readonly validating = signal(false);
  readonly actionId = signal<number | null>(null);
  readonly qrPreviewUrl = signal<string | null>(null);
  readonly qrReservation = signal<Reservation | null>(null);

  constructor() {
    effect(() => {
      const event = this.events.events().at(0);
      if (event?.type.startsWith('reservation_')) this.load();
    });
    this.load();
  }

  load(): void {
    const request =
      this.auth.user()?.rol === 'CLIENTE' ? this.api.myReservations() : this.api.reservations();
    request.subscribe({
      next: (items) => {
        this.reservations.set(items);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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
    if (!window.confirm('¿Cancelar esta reserva y liberar sus prendas?')) return;
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
      },
      error: (error) => this.toast.show(error?.error?.detail ?? 'El QR ya no está activo', 'error'),
    });
  }

  closeQr(): void {
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
    return Math.max(0, Math.min(100, ((now - start) / (end - start)) * 100));
  }
}
