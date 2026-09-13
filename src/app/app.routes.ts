import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    title: 'Experiencia Atelier | DrapeMind',
    loadComponent: () =>
      import('./features/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },
  {
    path: 'receipt/:id',
    title: 'Comprobante Oficial Verificado | DrapeMind',
    loadComponent: () =>
      import('./features/receipt-view/receipt-view.component').then((m) => m.ReceiptViewComponent),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: [
      {
        path: 'dashboard',
        title: 'Resumen | DrapeMind',
        loadComponent: () =>
          import('./features/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'catalog',
        title: 'Catalogo | DrapeMind',
        loadComponent: () =>
          import('./features/catalog/catalog.component').then((m) => m.CatalogComponent),
      },
      {
        path: 'account',
        title: 'Mi cuenta | DrapeMind',
        loadComponent: () =>
          import('./features/account/account.component').then((m) => m.AccountComponent),
      },
      {
        path: 'inventory',
        title: 'Inventario | DrapeMind',
        loadComponent: () =>
          import('./features/inventory/inventory.component').then((m) => m.InventoryComponent),
      },
      {
        path: 'reservations',
        title: 'Reservas | DrapeMind',
        loadComponent: () =>
          import('./features/reservations/reservations.component').then(
            (m) => m.ReservationsComponent,
          ),
      },
      {
        path: 'orders',
        title: 'Pedidos | DrapeMind',
        loadComponent: () =>
          import('./features/orders/orders.component').then((m) => m.OrdersComponent),
      },
      {
        path: 'ai-studio',
        title: 'Asistente IA | DrapeMind',
        loadComponent: () =>
          import('./features/ai-studio/ai-studio.component').then((m) => m.AiStudioComponent),
      },
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: '' },
];
