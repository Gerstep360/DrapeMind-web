import { Component, ChangeDetectorRef, effect, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { OfflineService, offlineMessage } from '../offline/offline.service';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { AuthService } from '../../../core/auth.service';
@Component({
  selector: 'app-exchanges',
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './exchanges.component.html',
  styleUrl: '../feature.scss',
})
export class ExchangesComponent {
  private cdr = inject(ChangeDetectorRef);
  readonly offline = inject(OfflineService);
  readonly auth = inject(AuthService);
  private http = inject(HttpClient);
  private runtime = inject(RuntimeConfigService);
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
  lines: { variante_id: number; cantidad: number }[] = [];
  requestId = crypto.randomUUID();
  pending: any = null;
  constructor() {
    effect(() => {
      const owner = this.offline.owner();
      this.order = null;
      this.quote = null;
      this.result = null;
      this.lines = [];
      this.returns = {};
      try {
        this.pending = owner
          ? JSON.parse(localStorage.getItem(`drapemind.exchange.pending|${owner}`) ?? 'null')
          : null;
      } catch {
        this.pending = null;
      }
    });
  }
  get base() {
    return `${this.runtime.apiUrl}/retail`;
  }
  variantName(id: number) {
    const v = this.offline.bundle()?.variants.find((v) => v.id === id),
      p = this.offline.bundle()?.products.find((p) => p.id === v?.producto_id);
    return p ? `${p.nombre} · ${v?.talla} · ${v?.color}` : `Variante ${id}`;
  }
  async find() {
    await this.action(async () => {
      if (this.pending) throw new Error('Comprueba primero el resultado del cambio anterior.');
      this.order = await firstValueFrom(
        this.http.get(`${this.base}/orders/find`, { params: { code: this.code.trim() } }),
      );
      this.returns = {};
      this.lines = [];
      this.quote = null;
      this.result = null;
      this.requestId = crypto.randomUUID();
      if (!this.offline.usable()) await this.offline.download();
    });
  }
  add() {
    const id = +this.variant,
      q = +this.quantity;
    if (!id || q < 1 || !Number.isInteger(q)) {
      this.error = 'Elige una prenda y cantidad válidas.';
      return;
    }
    const line = this.lines.find((i) => i.variante_id === id);
    if (line) line.cantidad += q;
    else this.lines.push({ variante_id: id, cantidad: q });
    this.quote = null;
  }
  draft() {
    return {
      operacion_id: this.requestId,
      pedido_origen_id: this.order.pedido_id,
      sucursal_id: this.order.sucursal_id,
      motivo: this.note.trim(),
      devoluciones: Object.entries(this.returns)
        .filter(([, q]) => +q > 0)
        .map(([id, q]) => ({ item_pedido_id: +id, cantidad: +q })),
      prendas_nuevas: this.lines.map((i) => ({ ...i })),
      efectivo_recibido: Number(this.received).toFixed(2),
      efectivo_devuelto: Number(this.refunded).toFixed(2),
    };
  }
  async calculate() {
    await this.action(async () => {
      this.quote = await firstValueFrom(
        this.http.post(`${this.base}/exchanges?preview=true`, this.draft()),
      );
      this.received = String(Math.max(0, +this.quote.diferencia));
      this.refunded = String(Math.max(0, -this.quote.diferencia));
    });
  }
  async save() {
    if (!this.order || !this.quote || this.pending) return;
    await this.action(async () => {
      const owner = this.offline.owner();
      if (!owner) throw new Error('Inicia sesión para confirmar el cambio.');
      const payload = this.draft();
      localStorage.setItem(`drapemind.exchange.pending|${owner}`, JSON.stringify(payload));
      this.pending = payload;
      await this.sendPending(owner);
    });
  }
  async checkPending() {
    await this.action(async () => {
      const owner = this.offline.owner();
      if (owner) await this.sendPending(owner);
    });
  }
  private async sendPending(owner: string) {
    try {
      const result = await firstValueFrom(
        this.http.post<any>(`${this.base}/exchanges`, this.pending).pipe(timeout(25000)),
      );
      localStorage.removeItem(`drapemind.exchange.pending|${owner}`);
      if (owner !== this.offline.owner()) return;
      this.result = result;
      this.pending = null;
      this.order = null;
      this.quote = null;
      void this.offline.download();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (status && status >= 400 && status < 500) {
        localStorage.removeItem(`drapemind.exchange.pending|${owner}`);
        if (owner === this.offline.owner()) this.pending = null;
      }
      throw e;
    }
  }
  async action(work: () => Promise<void>) {
    if (this.busy) return;
    this.busy = true;
    this.error = '';
    try {
      if (!this.offline.online())
        throw new Error('Los cambios de prendas necesitan conexión para validar el comprobante.');
      await work();
    } catch (e) {
      this.error = offlineMessage(e);
    } finally {
      this.busy = false;
      this.cdr.markForCheck();
    }
  }
}
