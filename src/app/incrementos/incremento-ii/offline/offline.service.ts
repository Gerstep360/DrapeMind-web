import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import {
  OfflineBundle,
  QueuedReservation,
  SyncedOperation,
  AttendingReservation,
} from './offline.models';
import { OfflineStore } from './offline-store';

export function offlineMessage(error: unknown): string {
  const detail = (error as HttpErrorResponse)?.error?.detail;
  if (typeof detail === 'string') return detail;
  if (detail?.message) return detail.message;
  if (Array.isArray(detail)) return 'Revisa los datos de la solicitud e inténtalo nuevamente.';
  return error instanceof Error && !(error instanceof HttpErrorResponse)
    ? error.message
    : 'No pudimos conectar. Tu solicitud sigue guardada en este dispositivo.';
}

export function offlineMediaUrl(apiUrl: string, image: string): string {
  if (!image) return '';
  if (/^(https?:|data:|blob:)/.test(image)) return image;
  let clean = image.replace(/^\/+/, '').replace(/^drapemind\//i, '');
  if (!clean.includes('/')) clean = `static/products/${clean}`;
  return `${apiUrl.replace(/\/api\/v1\/?$/, '')}/${clean}`;
}

@Injectable({ providedIn: 'root' })
export class OfflineService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly store = new OfflineStore();
  readonly bundle = signal<OfflineBundle | null>(null);
  readonly queue = signal<QueuedReservation[]>([]);
  readonly online = signal(typeof navigator === 'undefined' || navigator.onLine);
  readonly downloading = signal(false);
  readonly syncing = signal(false);
  readonly message = signal('');
  readonly phase = signal('');
  readonly owner = computed(() => {
    const u = this.auth.user();
    return u?.tenant_id &&
      this.auth.isAuthenticated() &&
      !u.is_platform_admin &&
      u.rol !== 'PROVEEDOR'
      ? `${this.runtime.apiUrl}|${u.tenant_id}:${u.id}`
      : null;
  });
  readonly canSell = computed(() =>
    ['ADMIN', 'ENCARGADO', 'CAJERO'].includes(this.auth.user()?.rol ?? ''),
  );
  readonly pending = computed(
    () =>
      this.queue().filter((r) => ['PENDING', 'SENDING', 'UNCERTAIN', 'CONFLICT'].includes(r.state))
        .length,
  );
  private loadingOwner: string | null = null;
  private retryTimer: number | null = null;
  constructor() {
    const onOnline = () => {
      this.online.set(true);
      void this.sync();
    };
    const onOffline = () => this.online.set(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    });
    effect(() => {
      const owner = this.owner();
      this.bundle.set(null);
      this.queue.set([]);
      this.message.set('');
      if (owner) void this.restore(owner);
    });
  }
  usable(): boolean {
    const bundle = this.bundle();
    return (
      !!bundle &&
      this.owner()?.endsWith(`|${bundle.owner}`) === true &&
      Date.parse(bundle.valid_until) > Date.now() &&
      this.auth.hasValidToken()
    );
  }
  private async restore(owner: string): Promise<void> {
    this.loadingOwner = owner;
    try {
      const [record, queue] = await Promise.all([
        this.store.read<{ key: string; data: OfflineBundle }>('bundles', owner),
        this.store.list<QueuedReservation>(owner),
      ]);
      if (this.owner() !== owner) return;
      this.bundle.set(record?.data ?? null);
      this.queue.set(queue.map((r) => (r.state === 'SENDING' ? { ...r, state: 'UNCERTAIN' } : r)));
    } catch {
      if (this.owner() === owner)
        this.message.set(
          'No pudimos abrir los datos guardados. Permite el almacenamiento de este sitio para usarlo sin conexión.',
        );
    } finally {
      if (this.loadingOwner === owner) this.loadingOwner = null;
    }
    if (this.owner() === owner && this.online()) void this.sync();
  }
  async download(): Promise<void> {
    const owner = this.owner();
    if (!owner || this.downloading()) return;
    this.downloading.set(true);
    this.message.set('');
    this.phase.set('Descargando prendas y disponibilidad…');
    try {
      const data = await firstValueFrom(
        this.http.get<OfflineBundle>(`${this.runtime.apiUrl}/offline/bundle`).pipe(timeout(60000)),
      );
      if (owner !== this.owner() || !owner.endsWith(`|${data.owner}`)) return;
      this.phase.set('Guardando el catálogo en este dispositivo…');
      await this.store.write('bundles', { key: owner, data } as { key: string });
      if (owner === this.owner()) {
        this.bundle.set(data);
        try {
          await this.cachePhotos(owner, data);
        } catch {
          /* Optional photos may be unavailable when browser storage is restricted. */
        }
        if (owner === this.owner()) this.phase.set('Catálogo guardado');
      }
    } catch (e) {
      if (owner === this.owner()) this.message.set(offlineMessage(e));
    } finally {
      this.downloading.set(false);
    }
  }
  private async cachePhotos(owner: string, bundle: OfflineBundle): Promise<void> {
    if (!('caches' in window)) return;
    const urls = [
      ...new Set(
        bundle.products
          .map((p) => offlineMediaUrl(this.runtime.apiUrl, p.imagenes?.[0] ?? ''))
          .filter((u) => u && !u.startsWith('data:') && !u.startsWith('blob:')),
      ),
    ];
    const cache = await caches.open(`drapemind-product-images-${encodeURIComponent(owner)}`);
    let done = 0,
      index = 0;
    const worker = async () => {
      while (index < urls.length && owner === this.owner()) {
        const url = urls[index++];
        try {
          const response = await fetch(url, {
            credentials: 'omit',
            signal: AbortSignal.timeout(5000),
          });
          if (
            response.ok &&
            Number(response.headers.get('Content-Length') || 0) < 2_000_000 &&
            owner === this.owner()
          )
            await cache.put(url, response);
        } catch {
          /* A missing photograph does not invalidate the catalog or pending operations. */
        }
        done++;
        if (owner === this.owner()) this.phase.set(`Guardando fotos ${done} de ${urls.length}…`);
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, urls.length) }, () => worker()));
  }
  available(variant: number, branch: number): number {
    const base =
      this.bundle()?.stock.find((s) => s.variante_id === variant && s.sucursal_id === branch)
        ?.disponible ?? 0;
    const pending = this.queue()
      .filter(
        (r) =>
          r.tipo !== 'PICKUP' &&
          (['PENDING', 'SENDING', 'UNCERTAIN'].includes(r.state) ||
            (r.tipo === 'SALE' && r.state === 'CONFLICT') ||
            (r.state === 'CONFIRMED' &&
              r.body.snapshot_version === this.bundle()?.version &&
              Date.parse(r.body.creado_at) > Date.parse(this.bundle()?.downloaded_at ?? '') &&
              (r.tipo === 'SALE' || Date.parse(r.reservation?.vence_at ?? '') > Date.now()))) &&
          r.body.sucursal_id === branch,
      )
      .reduce(
        (sum, r) =>
          sum +
          r.body.items.filter((i) => i.variante_id === variant).reduce((a, i) => a + i.cantidad, 0),
        0,
      );
    return Math.max(0, base - pending);
  }
  async reserve(variantId: number, branchId: number, quantity: number): Promise<void> {
    const owner = this.owner(),
      bundle = this.bundle();
    if (!owner || !bundle || !this.usable())
      throw new Error('Actualiza la descarga con conexión antes de guardar otra solicitud.');
    const variant = bundle.variants.find((v) => v.id === variantId),
      branch = bundle.branches.find((b) => b.id === branchId);
    if (
      !variant ||
      !branch ||
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > 100 ||
      quantity > this.available(variantId, branchId)
    )
      throw new Error('Revisa la talla, la sucursal y la cantidad disponible en tu copia.');
    const id = crypto.randomUUID();
    const record: QueuedReservation = {
      key: `${owner}|${id}`,
      owner,
      name: `${bundle.products.find((p) => p.id === variant.producto_id)?.nombre} · ${variant.talla} · ${variant.color}`,
      branch: branch.nombre,
      body: {
        operacion_id: id,
        sucursal_id: branchId,
        snapshot_version: bundle.version,
        creado_at: new Date().toISOString(),
        items: [{ variante_id: variantId, cantidad: quantity }],
      },
      state: 'PENDING',
      attempts: 0,
    };
    await this.store.write('reservations', record);
    if (owner !== this.owner()) return;
    this.queue.update((rows) => [...rows, record]);
    this.message.set('Solicitud guardada. El stock se confirmará al sincronizar.');
    if (this.online()) void this.sync();
  }
  async cancel(record: QueuedReservation): Promise<void> {
    const current = this.queue().find((r) => r.key === record.key);
    if (
      !current ||
      this.syncing() ||
      current.owner !== this.owner() ||
      !['PENDING', 'CONFLICT'].includes(current.state)
    )
      return;
    record = current;
    if (record.tipo && record.tipo !== 'RESERVATION') return;
    if (record.state === 'CONFLICT') {
      if (!this.online()) {
        this.message.set('Conéctate para cancelar una solicitud que ya recibió la tienda.');
        return;
      }
      try {
        await firstValueFrom(
          this.http
            .post(
              `${this.runtime.apiUrl}/offline/operations/${record.body.operacion_id}/cancel`,
              {},
            )
            .pipe(timeout(15000)),
        );
      } catch (e) {
        if (record.owner !== this.owner()) return;
        if ((e as HttpErrorResponse).status !== 404) {
          this.message.set(offlineMessage(e));
          await this.sync();
          return;
        }
      }
    }
    if (
      this.syncing() ||
      record.owner !== this.owner() ||
      ['SENDING', 'UNCERTAIN', 'CONFIRMED'].includes(record.state)
    )
      return;
    await this.save({ ...record, state: 'CANCELLED', message: 'Cancelada en este dispositivo.' });
  }
  async retry(record: QueuedReservation): Promise<void> {
    record = this.queue().find((r) => r.key === record.key) ?? record;
    if (this.syncing() || record.owner !== this.owner() || record.state !== 'CONFLICT') return;
    await this.save({ ...record, state: 'PENDING', message: undefined });
    await this.sync();
  }
  private async save(record: QueuedReservation): Promise<void> {
    await this.store.write('reservations', record);
    if (record.owner === this.owner())
      this.queue.update((rows) => rows.map((r) => (r.key === record.key ? record : r)));
  }
  async sync(): Promise<void> {
    const owner = this.owner();
    if (!owner || !this.online() || this.syncing() || this.loadingOwner) return;
    this.syncing.set(true);
    try {
      await this.pullResults(owner);
      for (const original of this.queue().filter((r) =>
        ['PENDING', 'UNCERTAIN', 'SENDING'].includes(r.state),
      )) {
        if (owner !== this.owner() || !this.online()) break;
        const record = { ...original, state: 'SENDING' as const, attempts: original.attempts + 1 };
        await this.save(record);
        if (owner !== this.owner()) break;
        try {
          const result = await firstValueFrom(
            this.http
              .post<SyncedOperation>(`${this.runtime.apiUrl}/offline/operations`, {
                tipo: record.tipo ?? 'RESERVATION',
                payload: record.body,
              })
              .pipe(timeout(25000)),
          );
          await this.save(this.mergeResult(record, result));
        } catch (e) {
          const status = (e as HttpErrorResponse).status;
          await this.save({
            ...record,
            state: status >= 400 && status < 500 ? 'CONFLICT' : 'UNCERTAIN',
            message: offlineMessage(e),
          });
          if (!status || status === 401 || status === 402 || status === 403 || status >= 500) break;
        }
      }
    } catch (e) {
      if (owner === this.owner()) this.message.set(offlineMessage(e));
    } finally {
      this.syncing.set(false);
      if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
      if (
        this.owner() &&
        this.online() &&
        this.queue().some((r) => ['PENDING', 'UNCERTAIN', 'CONFLICT'].includes(r.state))
      )
        this.retryTimer = window.setTimeout(() => void this.sync(), 15000);
    }
  }

  private mergeResult(record: QueuedReservation, result: SyncedOperation): QueuedReservation {
    if (!['CONFIRMED', 'CONFLICT', 'REJECTED'].includes(result.estado))
      throw new Error(
        'La tienda no confirmó un resultado válido. Comprobaremos la misma operación nuevamente.',
      );
    return {
      ...record,
      tipo: result.tipo,
      serverId: result.id,
      state: result.estado,
      attempts: result.intentos,
      reservation: result.resultado?.reservation,
      sale: result.resultado?.sale,
      message:
        result.error?.message ??
        (result.estado === 'CONFIRMED'
          ? 'Operación confirmada por la tienda.'
          : 'Necesita revisión del encargado.'),
    };
  }
  private async pullResults(owner: string): Promise<void> {
    try {
      const results = await firstValueFrom(
        this.http
          .get<SyncedOperation[]>(`${this.runtime.apiUrl}/offline/operations`)
          .pipe(timeout(10000)),
      );
      const known = new Set(results.map((r) => r.operacion_id));
      const missing = this.queue()
        .filter(
          (r) =>
            r.attempts > 0 &&
            ['PENDING', 'UNCERTAIN', 'CONFLICT'].includes(r.state) &&
            !known.has(r.body.operacion_id),
        )
        .map((r) => r.body.operacion_id);
      for (let offset = 0; offset < missing.length; offset += 100) {
        if (this.owner() !== owner) return;
        const extra = await firstValueFrom(
          this.http
            .post<SyncedOperation[]>(`${this.runtime.apiUrl}/offline/operations/results`, {
              operaciones: missing.slice(offset, offset + 100),
            })
            .pipe(timeout(10000)),
        );
        results.push(...extra);
      }
      for (const result of results) {
        if (this.owner() !== owner) return;
        const key = `${owner}|${result.operacion_id}`,
          existing = this.queue().find((r) => r.key === key);
        const record = existing ?? {
          key,
          owner,
          body: result.payload,
          name:
            result.tipo === 'RESERVATION'
              ? 'Reserva de prendas'
              : result.tipo === 'PICKUP'
                ? 'Retiro de reserva'
                : 'Venta de contado',
          branch:
            this.bundle()?.branches.find((b) => b.id === result.payload.sucursal_id)?.nombre ??
            `Sucursal ${result.payload.sucursal_id}`,
          state: 'PENDING' as const,
          attempts: 0,
        };
        const updated = this.mergeResult(record, result);
        await this.store.write('reservations', updated);
        if (this.owner() !== owner) return;
        this.queue.update((rows) =>
          existing ? rows.map((r) => (r.key === key ? updated : r)) : [...rows, updated],
        );
      }
    } catch {
      /* Local pending operations remain authoritative until the server can be reached. */
    }
  }
  async cashSale(
    lines: { variante_id: number; cantidad: number }[],
    branchId: number,
    received: string,
  ): Promise<void> {
    const data = this.bundle();
    if (!data || !this.usable() || !this.canSell())
      throw new Error('Actualiza la descarga e inicia sesión con tu cuenta de caja.');
    const unique = new Set(lines.map((l) => l.variante_id));
    if (!lines.length || unique.size !== lines.length)
      throw new Error('Añade prendas y agrupa las cantidades de cada talla.');
    const items = lines.map((line) => {
      const variant = data.variants.find((v) => v.id === line.variante_id),
        product = data.products.find((p) => p.id === variant?.producto_id);
      if (
        !product ||
        !Number.isInteger(line.cantidad) ||
        line.cantidad < 1 ||
        line.cantidad > 100 ||
        line.cantidad > this.available(line.variante_id, branchId)
      )
        throw new Error('Revisa las cantidades disponibles en la sucursal.');
      return { ...line, precio_unitario: product.precio };
    });
    const total = items.reduce(
      (n, i) => n + Math.round(Number(i.precio_unitario) * 100) * i.cantidad,
      0,
    );
    if (!Number.isFinite(+received) || +received < 0 || Math.round(+received * 100) < total)
      throw new Error('El efectivo recibido no cubre el total.');
    await this.queueCash('SALE', branchId, items, received);
  }
  async pickup(reservation: AttendingReservation, received: string): Promise<void> {
    if (!this.canSell() || !this.usable())
      throw new Error('Actualiza la descarga con tu cuenta de caja.');
    if (Date.parse(reservation.vence_at) <= Date.now())
      throw new Error('La reserva de tu copia ya venció. Actualiza la lista antes de cobrar.');
    if (
      this.queue().some(
        (r) => r.body.reserva_id === reservation.id && !['CANCELLED', 'REJECTED'].includes(r.state),
      )
    )
      throw new Error('Esta reserva ya tiene un cobro guardado. Comprueba su resultado.');
    const total = reservation.items.reduce(
      (n, i) => n + Math.round(Number(i.precio_unitario) * 100) * i.cantidad,
      0,
    );
    if (!Number.isFinite(+received) || Math.round(+received * 100) < total)
      throw new Error('El efectivo recibido no cubre la reserva.');
    await this.queueCash(
      'PICKUP',
      reservation.sucursal_id,
      reservation.items,
      received,
      reservation.id,
    );
  }
  private async queueCash(
    tipo: 'SALE' | 'PICKUP',
    branchId: number,
    items: { variante_id: number; cantidad: number; precio_unitario: string }[],
    received: string,
    reservation?: number,
  ) {
    const owner = this.owner(),
      data = this.bundle();
    if (!owner || !data || !data.branches.some((b) => b.id === branchId))
      throw new Error('Selecciona una sucursal autorizada.');
    const id = crypto.randomUUID();
    const record: QueuedReservation = {
      key: `${owner}|${id}`,
      owner,
      tipo,
      name: tipo === 'SALE' ? 'Venta de contado' : `Retiro de reserva ${reservation}`,
      branch: data.branches.find((b) => b.id === branchId)!.nombre,
      body: {
        operacion_id: id,
        sucursal_id: branchId,
        snapshot_version: data.version,
        creado_at: new Date().toISOString(),
        items,
        efectivo_recibido: Number(received).toFixed(2),
        ...(reservation ? { reserva_id: reservation } : {}),
      },
      state: 'PENDING',
      attempts: 0,
    };
    await this.store.write('reservations', record);
    if (this.owner() !== owner) return;
    this.queue.update((rows) => [...rows, record]);
    this.message.set('Cobro guardado. El comprobante es provisional hasta sincronizar.');
    if (this.online()) void this.sync();
  }
  async refreshReservations(): Promise<void> {
    if (!this.canSell() || !this.online()) return;
    const owner = this.owner();
    const reservations = await firstValueFrom(
      this.http
        .get<AttendingReservation[]>(`${this.runtime.apiUrl}/retail/reservations`)
        .pipe(timeout(15000)),
    );
    const data = this.bundle();
    if (owner && owner === this.owner() && data) {
      const updated = { ...data, reservations };
      await this.store.write('bundles', { key: owner, data: updated } as { key: string });
      if (owner === this.owner()) this.bundle.set(updated);
    }
  }
  async prepareReservation(id: number, estado: string): Promise<void> {
    if (!this.online()) throw new Error('Conéctate para actualizar la preparación de la reserva.');
    await firstValueFrom(
      this.http.post(`${this.runtime.apiUrl}/retail/reservations/${id}/prepare`, { estado }),
    );
    await this.refreshReservations();
  }
}
