import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { RealtimeEvent } from './models';
import { RuntimeConfigService } from './runtime-config.service';
import { ToastService } from './toast.service';

@Injectable({ providedIn: 'root' })
export class EventsSocketService {
  private readonly auth = inject(AuthService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly toast = inject(ToastService);
  private socket: WebSocket | null = null;
  private retryTimer: number | null = null;
  private retry = 0;
  private authRejected = false;
  private manualDisconnect = false;

  readonly connected = signal(false);
  readonly events = signal<RealtimeEvent[]>([]);

  connect(): void {
    const token = this.auth.hasValidToken() ? this.auth.token() : null;
    if (!token || this.socket) return;
    this.manualDisconnect = false;
    this.authRejected = false;
    this.socket = new WebSocket(this.runtime.wsUrl('events'));
    this.socket.onopen = () => {
      this.socket?.send(JSON.stringify({ type: 'auth', token }));
    };
    this.socket.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as RealtimeEvent;
      if (event.type === 'connected') {
        this.retry = 0;
        this.connected.set(true);
        return;
      }
      if (event.type === 'pong') return;
      if (event.type === 'error' && event.code === 'AUTH_INVALID') {
        this.authRejected = true;
        this.disconnect(false);
        this.auth.logout();
        return;
      }
      this.events.update((items) => [event, ...items].slice(0, 30));
      this.toast.show(this.eventMessage(event), 'info');
    };
    this.socket.onclose = (event) => {
      this.socket = null;
      this.connected.set(false);
      if (this.authRejected || event.code === 4401) {
        if (this.auth.token()) this.auth.logout();
        return;
      }
      if (!this.manualDisconnect && this.auth.hasValidToken()) this.scheduleRetry();
    };
  }

  disconnect(manual = true): void {
    this.manualDisconnect = manual;
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.socket?.close(1000, 'logout');
    this.socket = null;
    this.connected.set(false);
  }

  private scheduleRetry(): void {
    if (!this.auth.hasValidToken() || this.retry >= 5) return;
    const delay = Math.min(30_000, 1000 * 2 ** this.retry++);
    this.retryTimer = window.setTimeout(() => this.connect(), delay);
  }

  private eventMessage(event: RealtimeEvent): string {
    if (event.type.startsWith('order_'))
      return `Pedido #${event.order_id} ahora esta ${event.status}`;
    if (event.type.startsWith('reservation_'))
      return `Reserva #${event.reservation_id}: ${event.status}`;
    if (event.type.startsWith('payment_')) return `Pago actualizado: ${event.status}`;
    return 'Hay una actualizacion en tiempo real';
  }
}
