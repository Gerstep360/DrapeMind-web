import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { RuntimeConfigService } from './runtime-config.service';
import { ToastService } from './toast.service';

export interface AppNotification {
  id: string;
  tipo: 'PEDIDO' | 'RESERVA' | 'PAGO' | 'PROMOCION' | 'IA' | 'SISTEMA';
  titulo: string;
  mensaje: string;
  leido: boolean;
  fecha: string;
  enlace?: string;
  metadata?: any;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly runtime = inject(RuntimeConfigService);
  private readonly toasts = inject(ToastService);
  private readonly router = inject(Router);

  readonly notifications = signal<AppNotification[]>([]);
  readonly isPanelOpen = signal<boolean>(false);
  readonly isConnected = signal<boolean>(false);

  readonly unreadCount = computed(() => {
    return this.notifications().filter((n) => !n.leido).length;
  });

  private socket: WebSocket | null = null;
  private pingInterval: any = null;
  private reconnectTimer: any = null;
  private isDestroyed = false;

  constructor() {
    this.loadFromStorage();
    // Iniciar conexión reactiva si hay sesión activa
    if (this.auth.token()) {
      this.connect();
    }
  }

  togglePanel(): void {
    this.isPanelOpen.update((v) => !v);
  }

  openPanel(): void {
    this.isPanelOpen.set(true);
  }

  closePanel(): void {
    this.isPanelOpen.set(false);
  }

  connect(): void {
    if (this.isDestroyed) return;
    const token = this.auth.token();
    if (!token) return;

    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const url = this.runtime.wsUrl('events');
      this.socket = new WebSocket(url);

      this.socket.onopen = () => {
        this.socket?.send(JSON.stringify({ type: 'auth', token }));
        this.startHeartbeat();
      };

      this.socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncomingEvent(data);
        } catch {}
      };

      this.socket.onclose = () => {
        this.isConnected.set(false);
        this.stopHeartbeat();
        this.scheduleReconnect();
      };

      this.socket.onerror = () => {
        this.isConnected.set(false);
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.send(JSON.stringify({ type: 'ping' }));
      }
    }, 25000);
  }

  private stopHeartbeat(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect(): void {
    if (this.isDestroyed || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (this.auth.token()) {
        this.connect();
      }
    }, 5000);
  }

  private handleIncomingEvent(data: any): void {
    if (!data || typeof data !== 'object') return;

    if (data.type === 'connected') {
      this.isConnected.set(true);
      return;
    }

    if (data.type === 'pong') {
      return;
    }

    let notif: AppNotification | null = null;
    const nowIso = new Date().toISOString();
    const id = `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    switch (data.type) {
      case 'order_created': {
        const orderId = data.order_id || data.id;
        notif = {
          id,
          tipo: 'PEDIDO',
          titulo: 'Nuevo Pedido Creado',
          mensaje: `Se ha generado la orden #${orderId || ''}. Estado: PENDIENTE DE PAGO.`,
          leido: false,
          fecha: nowIso,
          enlace: orderId ? `/orders?id=${orderId}` : '/orders',
          metadata: data,
        };
        break;
      }

      case 'order_status_updated': {
        const orderId = data.order_id || data.id;
        notif = {
          id,
          tipo: 'PEDIDO',
          titulo: 'Actualización de Pedido',
          mensaje: `El pedido #${orderId || ''} avanzó al estado: ${data.estado || 'ACTUALIZADO'}.`,
          leido: false,
          fecha: nowIso,
          enlace: orderId ? `/orders?id=${orderId}` : '/orders',
          metadata: data,
        };
        break;
      }

      case 'payment_updated': {
        const orderId = data.order_id || data.payment_id || data.id;
        notif = {
          id,
          tipo: 'PAGO',
          titulo: 'Comprobante de Pago Confirmado',
          mensaje: `El pago registrado para el pedido #${orderId || ''} fue validado exitosamente.`,
          leido: false,
          fecha: nowIso,
          enlace: data.order_id ? `/orders?id=${data.order_id}` : '/orders',
          metadata: data,
        };
        break;
      }

      case 'reservation_created': {
        const resId = data.reservation_id || data.id;
        notif = {
          id,
          tipo: 'RESERVA',
          titulo: 'Reserva Registrada en Tienda',
          mensaje: `Tu reserva de prendas #${resId || ''} fue recibida para preparación en sucursal.`,
          leido: false,
          fecha: nowIso,
          enlace: resId ? `/reservations?id=${resId}` : '/reservations',
          metadata: data,
        };
        break;
      }

      case 'reservation_status_updated': {
        const resId = data.reservation_id || data.id;
        notif = {
          id,
          tipo: 'RESERVA',
          titulo: 'Reserva Lista en Tienda',
          mensaje: `La reserva #${resId || ''} cambió a: ${data.estado || 'ACTUALIZADA'}.`,
          leido: false,
          fecha: nowIso,
          enlace: resId ? `/reservations?id=${resId}` : '/reservations',
          metadata: data,
        };
        break;
      }

      case 'promotion_created':
        notif = {
          id,
          tipo: 'PROMOCION',
          titulo: 'Nueva Promoción Atelier',
          mensaje: `Se ha publicado la oferta "${data.codigo}"${data.producto_nombre ? ' para ' + data.producto_nombre : ''}.`,
          leido: false,
          fecha: nowIso,
          enlace: '/promotions-admin',
          metadata: data,
        };
        break;

      case 'ai_response':
      case 'ai_completed':
      case 'ai_chat_done':
        notif = {
          id,
          tipo: 'IA',
          titulo: 'Altair AI: Respuesta Lista',
          mensaje: data.mensaje || data.respuesta || 'Altair completó tu diseño y asesoría en el chat.',
          leido: false,
          fecha: nowIso,
          enlace: data.sesion_id ? `/ai-studio?session=${data.sesion_id}` : '/ai-studio',
          metadata: data,
        };
        break;

      case 'notification': {
        const payloadData = data.data || data.payload || {};
        const screen = String(payloadData.screen || '').toLowerCase();
        const nType = String(data.notification_type || '').toUpperCase();
        let enlace = '/orders';
        let tipoNotif: 'PEDIDO' | 'RESERVA' | 'PAGO' | 'PROMOCION' | 'IA' | 'SISTEMA' = 'PEDIDO';

        if (screen.includes('ai') || screen.includes('chat') || screen.includes('studio') || nType.includes('AI')) {
          enlace = payloadData.sesion_id ? `/ai-studio?session=${payloadData.sesion_id}` : '/ai-studio';
          tipoNotif = 'IA';
        } else if (screen.includes('reservation') || screen.includes('reserva') || nType.includes('RESERVA')) {
          const rId = payloadData.reservation_id || payloadData.id || data.reservation_id;
          enlace = rId ? `/reservations?id=${rId}` : '/reservations';
          tipoNotif = 'RESERVA';
        } else if (screen.includes('catalog') || screen.includes('ropa') || screen.includes('prenda')) {
          enlace = '/catalog';
          tipoNotif = 'SISTEMA';
        } else if (screen.includes('report')) {
          enlace = '/ai-reports';
          tipoNotif = 'IA';
        } else if (screen.includes('promo') || nType.includes('PROMO')) {
          enlace = '/promotions-admin';
          tipoNotif = 'PROMOCION';
        } else {
          // Default to orders with ID if available
          const oId = payloadData.order_id || payloadData.id || data.order_id;
          enlace = oId ? `/orders?id=${oId}` : '/orders';
          tipoNotif = nType.includes('PAGO') ? 'PAGO' : 'PEDIDO';
        }

        notif = {
          id: data.id ? `notif_${data.id}` : id,
          tipo: tipoNotif,
          titulo: data.title || data.titulo || 'Notificación Atelier',
          mensaje: data.body || data.mensaje || '',
          leido: false,
          fecha: data.created_at || nowIso,
          enlace,
          metadata: payloadData,
        };
        break;
      }

      case 'notification_dismissed': {
        const dismissedId = data.notification_id;
        if (dismissedId) {
          this.notifications.update((list) =>
            list.map((n) => (n.id === `notif_${dismissedId}` || n.id === String(dismissedId) ? { ...n, leido: true } : n))
          );
          this.saveToStorage();
        }
        return;
      }

      default: {
        const text = `${data.titulo || data.title || ''} ${data.mensaje || data.message || ''}`.toLowerCase();
        let fallbackEnlace = '/orders';
        let inferredType: 'PEDIDO' | 'RESERVA' | 'PAGO' | 'PROMOCION' | 'IA' | 'SISTEMA' = 'SISTEMA';
        if (text.includes('chat') || text.includes('altair') || text.includes('diseño') || text.includes('inteligencia')) {
          fallbackEnlace = '/ai-studio';
          inferredType = 'IA';
        } else if (text.includes('reserva') || text.includes('sucursal') || text.includes('tienda')) {
          const rId = data.reservation_id || data.id;
          fallbackEnlace = rId ? `/reservations?id=${rId}` : '/reservations';
          inferredType = 'RESERVA';
        } else if (text.includes('pedido') || text.includes('compra') || text.includes('pago') || text.includes('orden')) {
          const oId = data.order_id || data.id;
          fallbackEnlace = oId ? `/orders?id=${oId}` : '/orders';
          inferredType = text.includes('pago') ? 'PAGO' : 'PEDIDO';
        } else if (text.includes('promoción') || text.includes('promocion') || text.includes('descuento')) {
          fallbackEnlace = '/promotions-admin';
          inferredType = 'PROMOCION';
        }

        if (data.mensaje || data.message || data.titulo || data.title) {
          notif = {
            id,
            tipo: inferredType,
            titulo: data.titulo || data.title || 'Aviso del Atelier',
            mensaje: data.mensaje || data.message || 'Nueva notificación del sistema.',
            leido: false,
            fecha: nowIso,
            enlace: fallbackEnlace,
            metadata: data,
          };
        }
        break;
      }
    }

    if (notif) {
      this.addNotification(notif);
      this.toasts.show(notif.mensaje, 'info');
    }
  }

  addNotification(item: AppNotification): void {
    this.notifications.update((prev) => [item, ...prev].slice(0, 50));
    this.saveToStorage();
    this.showBrowserNotification(item);
  }

  private showBrowserNotification(item: AppNotification): void {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        const browserNotif = new Notification(item.titulo, {
          body: item.mensaje,
          icon: '/favicon.ico',
          tag: item.id,
        });
        browserNotif.onclick = () => {
          window.focus();
          browserNotif.close();
          if (item.enlace) {
            this.router.navigateByUrl(item.enlace);
          }
        };
      } catch {}
    } else if (Notification.permission === 'default') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          this.showBrowserNotification(item);
        }
      });
    }
  }

  markAsRead(id: string): void {
    this.notifications.update((list) =>
      list.map((n) => (n.id === id ? { ...n, leido: true } : n)),
    );
    this.saveToStorage();
  }

  markAllAsRead(): void {
    this.notifications.update((list) => list.map((n) => ({ ...n, leido: true })));
    this.saveToStorage();
  }

  deleteNotification(id: string): void {
    this.notifications.update((list) => list.filter((n) => n.id !== id));
    this.saveToStorage();
  }

  clearAll(): void {
    this.notifications.set([]);
    this.saveToStorage();
  }

  private getStorageKey(): string {
    const uid = this.auth.user()?.id || 'guest';
    return `drapemind_notifications_${uid}`;
  }

  private loadFromStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      const stored = localStorage.getItem(this.getStorageKey());
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.notifications.set(parsed);
          return;
        }
      }
    } catch {}

    // Semilla inicial informativa si no hay registros previos
    this.notifications.set([
      {
        id: 'seed_init_1',
        tipo: 'SISTEMA',
        titulo: 'Canal de Notificaciones en Vivo Activo',
        mensaje: 'Conexión WebSocket sincronizada para eventos de pedidos, reservas y novedades sastreras.',
        leido: true,
        fecha: new Date().toISOString(),
      },
    ]);
  }

  private saveToStorage(): void {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(this.notifications()));
    } catch {}
  }
}
