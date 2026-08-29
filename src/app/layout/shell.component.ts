import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AiSocketService } from '../core/ai-socket.service';
import { AuthService } from '../core/auth.service';
import { CartService } from '../core/cart.service';
import { EventsSocketService } from '../core/events-socket.service';
import { UserRole } from '../core/models';
import { ToastService } from '../core/toast.service';
import { CartDrawerComponent } from './cart-drawer/cart-drawer.component';

export type NavIcon =
  | 'dashboard'
  | 'catalog'
  | 'inventory'
  | 'reservations'
  | 'orders'
  | 'stylist'
  | 'account';

interface NavItem {
  label: string;
  icon: NavIcon;
  route: string;
  roles: UserRole[];
}

@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, CartDrawerComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartService);
  readonly events = inject(EventsSocketService);
  readonly toasts = inject(ToastService);
  private readonly ai = inject(AiSocketService);
  readonly menuOpen = signal(false);

  private readonly allNav: NavItem[] = [
    {
      label: 'Colección',
      icon: 'catalog',
      route: '/catalog',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
    {
      label: 'Personal Stylist',
      icon: 'stylist',
      route: '/ai-studio',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
    {
      label: 'Pedidos & Ventas',
      icon: 'orders',
      route: '/orders',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
    {
      label: 'Reservas',
      icon: 'reservations',
      route: '/reservations',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
    {
      label: 'Mi Cuenta',
      icon: 'account',
      route: '/account',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
    {
      label: 'Inventario',
      icon: 'inventory',
      route: '/inventory',
      roles: ['ADMIN'],
    },
    {
      label: 'Panel General',
      icon: 'dashboard',
      route: '/dashboard',
      roles: ['ADMIN', 'VENDEDOR', 'ENCARGADO', 'CAJERO', 'CLIENTE'],
    },
  ];

  readonly navigation = computed(() => {
    const role = this.auth.user()?.rol;
    return role ? this.allNav.filter((item) => item.roles.includes(role)) : [];
  });

  constructor() {
    this.events.connect();
  }

  logout(): void {
    this.events.disconnect();
    this.ai.disconnect();
    this.auth.logout();
  }
}
