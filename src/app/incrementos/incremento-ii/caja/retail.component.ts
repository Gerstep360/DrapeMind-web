import { Component, ChangeDetectorRef, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OfflineService, offlineMessage } from '../offline/offline.service';
import { AttendingReservation, QueuedReservation } from '../offline/offline.models';
import { AuthService } from '../../../core/auth.service';

@Component({
  selector: 'app-retail',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './retail.component.html',
  styleUrl: '../feature.scss',
})
export class RetailComponent {
  private cdr = inject(ChangeDetectorRef);
  readonly offline = inject(OfflineService);
  readonly auth = inject(AuthService);
  tab: 'sale' | 'reservations' | 'operations' = 'sale';
  branch = 0;
  search = '';
  received = '';
  error = '';
  success = '';
  busy = false;
  lines: { variante_id: number; cantidad: number }[] = [];
  selectedVariant = 0;
  quantity = 1;
  pickupTarget: AttendingReservation | null = null;
  pickupCash = '';
  stateFilter = '';
  kindFilter = '';
  get data() {
    return this.offline.bundle();
  }
  get branchId() {
    return this.branch || this.data?.branches[0]?.id || 0;
  }
  get variants() {
    const q = this.search.toLocaleLowerCase();
    return (
      this.data?.variants.filter((v) =>
        `${this.variantName(v.id)} ${v.sku}`.toLocaleLowerCase().includes(q),
      ) ?? []
    );
  }
  get reservations() {
    const q = this.search.toLowerCase();
    return (this.data?.reservations ?? []).filter(
      (r) =>
        r.sucursal_id === this.branchId &&
        (String(r.id) === q || r.codigo_publico.toLowerCase().includes(q)),
    );
  }
  get operations() {
    return this.offline
      .queue()
      .filter(
        (r) =>
          (!this.stateFilter || r.state === this.stateFilter) &&
          (!this.kindFilter || (r.tipo ?? 'RESERVATION') === this.kindFilter),
      )
      .slice()
      .reverse();
  }
  variantName(id: number) {
    const v = this.data?.variants.find((v) => v.id === id),
      p = this.data?.products.find((p) => p.id === v?.producto_id);
    return p ? `${p.nombre} · ${v?.talla} · ${v?.color}` : `Variante ${id}`;
  }
  price(id: number) {
    const v = this.data?.variants.find((v) => v.id === id);
    return Number(this.data?.products.find((p) => p.id === v?.producto_id)?.precio ?? 0);
  }
  get total() {
    return (
      this.lines.reduce((n, i) => n + Math.round(this.price(i.variante_id) * 100) * i.cantidad, 0) /
      100
    );
  }
  reservationTotal(r: AttendingReservation) {
    return r.items.reduce((n, i) => n + Math.round(+i.precio_unitario * 100) * i.cantidad, 0) / 100;
  }
  add() {
    this.error = '';
    const id = +this.selectedVariant,
      q = +this.quantity;
    if (!id || !Number.isInteger(q) || q < 1) {
      this.error = 'Elige una talla y una cantidad válida.';
      return;
    }
    const line = this.lines.find((l) => l.variante_id === id);
    const amount = (line?.cantidad ?? 0) + q;
    if (amount > 100 || amount > this.offline.available(id, this.branchId)) {
      this.error = 'La copia guardada no tiene suficientes unidades.';
      return;
    }
    if (line) line.cantidad = amount;
    else this.lines.push({ variante_id: id, cantidad: q });
    this.quantity = 1;
  }
  async saveSale() {
    await this.action(async () => {
      await this.offline.cashSale(this.lines, this.branchId, this.received);
      this.lines = [];
      this.received = '';
      this.tab = 'operations';
      this.success =
        'Venta guardada. Puedes consultar el comprobante provisional y su sincronización.';
    });
  }
  async refresh() {
    await this.action(() => this.offline.refreshReservations());
  }
  async prepare(r: AttendingReservation, state: string) {
    await this.action(() => this.offline.prepareReservation(r.id, state));
  }
  async collect() {
    if (!this.pickupTarget) return;
    const target = this.pickupTarget;
    await this.action(async () => {
      await this.offline.pickup(target, this.pickupCash);
      this.pickupTarget = null;
      this.pickupCash = '';
      this.tab = 'operations';
      this.success = 'Cobro de la reserva guardado. Comprueba el resultado de sincronización.';
    });
  }
  async action(work: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    this.success = '';
    try {
      await work();
    } catch (e) {
      this.error = offlineMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
  state(r: QueuedReservation) {
    return {
      PENDING: 'Guardada en el dispositivo',
      SENDING: 'Enviando…',
      UNCERTAIN: 'Por comprobar al conectar',
      CONFLICT: 'Necesita revisión',
      CONFIRMED: 'Confirmada',
      CANCELLED: 'Cancelada',
      REJECTED: 'Anulada por el encargado',
    }[r.state];
  }
  receipt(r: QueuedReservation) {
    const total =
      r.body.items.reduce(
        (n, i) => n + Math.round(Number(i.precio_unitario ?? 0) * 100) * i.cantidad,
        0,
      ) / 100;
    const text = [
      r.sale ? 'COMPROBANTE DE VENTA' : 'COMPROBANTE PROVISIONAL · PENDIENTE DE SINCRONIZACIÓN',
      this.data?.tenant_name ?? this.auth.user()?.tenant_name ?? 'Tienda',
      r.branch,
      r.body.creado_at,
      `Operación: ${r.body.operacion_id}`,
      ...r.body.items.map(
        (i) =>
          `${i.cantidad} × ${this.variantName(i.variante_id)} · Bs ${i.precio_unitario ?? '—'}`,
      ),
      `Total: Bs ${total.toFixed(2)}`,
      `Efectivo recibido: Bs ${r.body.efectivo_recibido ?? '0'}`,
      `Cambio: Bs ${(Number(r.body.efectivo_recibido ?? 0) - total).toFixed(2)}`,
      `Estado: ${this.state(r)}`,
      r.sale
        ? `Pedido ${r.sale.pedido_id} · ${r.sale.codigo_publico}`
        : 'El servidor todavía debe validar el stock y el cobro.',
      'Documento interno no fiscal.',
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `comprobante-${r.body.operacion_id}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
