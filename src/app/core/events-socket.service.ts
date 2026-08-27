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

  readonly connected = signal(false);
  readonly events = signal<RealtimeEvent[]>([]);

  connect(): void {
    const token = this.auth.token();
    if (!token || this.socket) return;
    this.socket = new WebSocket(this.runtime.wsUrl('events'));
    this.socket.onopen = () => {
      this.socket?.send(JSON.stringify({ type: 'auth', token }));
      this.retry = 0;
    };
    this.socket.onmessage = (message) => {
      const event = JSON.parse(String(message.data)) as RealtimeEvent;
      if (event.type === 'connected') {
        this.connected.set(true);
        return;
      }
      if (event.type === 'pong') return;
      this.events.update((items) => [event, ...items].slice(0, 30));
      this.toast.show(this.eventMessage(event), 'info');
    };
    this.socket.onclose = () => {
      this.socket = null;
      this.connected.set(false);
      if (this.auth.isAuthenticated()) this.scheduleRetry();
    };
  }

  disconnect(): void {
    if (this.retryTimer !== null) window.clearTimeout(this.retryTimer);
    this.socket?.close(1000, 'logout');
    this.socket = null;
    this.connected.set(false);
  }

  private scheduleRetry(): void {
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
