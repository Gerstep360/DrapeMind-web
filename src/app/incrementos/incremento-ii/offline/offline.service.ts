import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, timeout } from 'rxjs';
import { AuthService } from '../../../core/auth.service';
import { RuntimeConfigService } from '../../../core/runtime-config.service';
import { OfflineBundle, QueuedReservation } from './offline.models';
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
        try { await this.cachePhotos(owner, data); } catch { /* Optional photos may be unavailable when browser storage is restricted. */ }
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
          (['PENDING', 'SENDING', 'UNCERTAIN'].includes(r.state) ||
            (r.state === 'CONFIRMED' &&
              r.body.snapshot_version === this.bundle()?.version &&
              Date.parse(r.body.creado_at) > Date.parse(this.bundle()?.downloaded_at ?? '') &&
              Date.parse(r.reservation?.vence_at ?? '') > Date.now())) &&
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
    record = this.queue().find((r) => r.key === record.key) ?? record;
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
              .post<{ reservation: QueuedReservation['reservation'] }>(
                `${this.runtime.apiUrl}/offline/reservations`,
                record.body,
              )
              .pipe(timeout(25000)),
          );
          await this.save({
            ...record,
            state: 'CONFIRMED',
            reservation: result.reservation,
            message: 'La tienda recibió tu reserva.',
          });
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
        this.queue().some((r) => ['PENDING', 'UNCERTAIN'].includes(r.state))
      )
        this.retryTimer = window.setTimeout(() => void this.sync(), 15000);
    }
  }
}
