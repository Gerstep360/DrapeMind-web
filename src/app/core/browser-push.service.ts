import { HttpClient } from '@angular/common/http';
import { Injectable, effect, inject, signal, untracked } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';

@Injectable({ providedIn: 'root' })
export class BrowserPushService {
  private readonly auth = inject(AuthService);
  private readonly http = inject(HttpClient);
  private readonly runtime = inject(RuntimeConfigService);
  readonly active = signal(false);
  readonly busy = signal(false);
  readonly message = signal('Recibe avisos de tus tiendas aunque cierres esta página.');
  readonly supported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && window.isSecureContext;
  private token: string | null = null;
  private owner = '';
  private cleanupPromise: Promise<unknown> = Promise.resolve();

  constructor() {
    this.auth.beforeLogout.add(() => this.revoke());
    effect(() => {
      const token = this.auth.token(); const user = this.auth.user();
      const owner = token && user ? `${user.tenant_id}:${user.id}` : '';
      untracked(() => {
        if (owner === this.owner) return;
        this.owner = owner;
        if (owner && this.supported && Notification.permission === 'granted') void this.register(false);
        if (!owner) this.active.set(false);
      });
    });
  }
  async enable(): Promise<void> { await this.register(true); }
  private async register(prompt: boolean): Promise<void> {
    if (!this.supported) { this.message.set('Este navegador necesita HTTPS de confianza para activar los avisos.'); return; }
    if (this.busy()) return;
    const owner = this.owner; const jwt = this.auth.token();
    if (!jwt) return;
    this.busy.set(true);
    try {
      await this.cleanupPromise;
      if (owner !== this.owner || jwt !== this.auth.token()) return;
      if (prompt && await Notification.requestPermission() !== 'granted') { this.message.set('Puedes permitir los avisos desde los ajustes del navegador.'); return; }
      // Do not wait forever on a PWA worker that is absent in development.
      const registration = await navigator.serviceWorker.getRegistration(new URL(document.baseURI).pathname);
      if (!registration?.active) throw new Error('Recarga la página para preparar las notificaciones.');
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        const config = await firstValueFrom(this.http.get<{ public_key: string }>(this.runtime.apiUrl + '/notifications/push-config'));
        const value = config.public_key.replace(/-/g, '+').replace(/_/g, '/');
        const bytes = Uint8Array.from(atob(value.padEnd(Math.ceil(value.length / 4) * 4, '=')), c => c.charCodeAt(0));
        subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
      }
      if (owner !== this.owner || jwt !== this.auth.token()) return;
      let device = localStorage.getItem('dm_browser_device');
      if (!device) { device = crypto.randomUUID(); localStorage.setItem('dm_browser_device', device); }
      const result = await firstValueFrom(this.http.post<{token: string}>(this.runtime.apiUrl + '/devices/web-register', {subscription: subscription.toJSON(), dispositivo_id: device}));
      if (owner !== this.owner || jwt !== this.auth.token()) return;
      this.token = result.token; this.active.set(true); this.message.set('Avisos activados para las tiendas vinculadas a tu cuenta.');
    } catch (e) { this.message.set(e instanceof Error ? e.message : 'No pudimos activar los avisos. Intenta nuevamente.'); }
    finally { this.busy.set(false); if (this.owner && owner !== this.owner) void this.register(false); }
  }
  private revoke(): void {
    const jwt = this.auth.token(); const token = this.token;
    this.token = null; this.active.set(false);
    if (jwt && token) void fetch(this.runtime.apiUrl + '/devices/unregister', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${jwt}`}, body: JSON.stringify({token}), keepalive:true});
    if (this.supported) this.cleanupPromise = navigator.serviceWorker.getRegistration().then(r => r?.pushManager.getSubscription()).then(s => s?.unsubscribe()).catch(() => {});
  }
}
