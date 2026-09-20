import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AppNotification, NotificationService } from '@core/notification.service';

@Component({
  selector: 'app-notifications-drawer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications-drawer.component.html',
  styleUrls: ['./notifications-drawer.component.scss'],
})
export class NotificationsDrawerComponent {
  readonly notifService = inject(NotificationService);
  private readonly router = inject(Router);

  readonly currentFilter = signal<'TODAS' | 'PEDIDO' | 'RESERVA' | 'PAGO' | 'PROMOCION'>('TODAS');

  readonly filteredList = computed(() => {
    const list = this.notifService.notifications();
    const filter = this.currentFilter();
    if (filter === 'TODAS') return list;
    return list.filter((n) => n.tipo === filter);
  });

  setFilter(filter: 'TODAS' | 'PEDIDO' | 'RESERVA' | 'PAGO' | 'PROMOCION'): void {
    this.currentFilter.set(filter);
  }

  handleNavigate(item: AppNotification): void {
    this.notifService.markAsRead(item.id);
    this.notifService.closePanel();

    let target = item.enlace;
    if (!target) {
      if (item.tipo === 'IA') {
        target = '/ai-studio';
      } else if (item.tipo === 'PEDIDO' || item.tipo === 'PAGO') {
        const id = item.metadata?.order_id || item.metadata?.id;
        target = id ? `/orders?id=${id}` : '/orders';
      } else if (item.tipo === 'RESERVA') {
        const id = item.metadata?.reservation_id || item.metadata?.id;
        target = id ? `/reservations?id=${id}` : '/reservations';
      } else if (item.tipo === 'PROMOCION') {
        target = '/promotions-admin';
      } else {
        target = '/catalog';
      }
    }

    if (target) {
      this.router.navigateByUrl(target).catch(() => {
        const fallback = target!.split('?')[0];
        this.router.navigateByUrl(fallback);
      });
    }
  }

  formatTime(isoDate: string): string {
    if (!isoDate) return '';
    try {
      const d = new Date(isoDate);
      const now = new Date();
      const diffMinutes = Math.floor((now.getTime() - d.getTime()) / (1000 * 60));
      if (diffMinutes < 1) return 'Hace un momento';
      if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
      const diffHours = Math.floor(diffMinutes / 60);
      if (diffHours < 24) return `Hace ${diffHours} h`;
      return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }
}
