import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { platformGuard } from './core/saas.service';
import { packageRoutes } from './core/navigation/package-routes';

export const routes: Routes = [
  {
    path: 'tiendas',
    title: 'Tiendas | DrapeMind',
    loadComponent: () => import('./segundo_parcial/cu05_acceso/cu05-stores.component').then((m) => m.StoresComponent),
  },
  {
    path: 'tienda/:slug',
    title: 'Entrar a tu tienda | DrapeMind',
    loadComponent: () =>
      import('./segundo_parcial/cu05_acceso/cu05-store-entry.component').then((m) => m.StoreEntryComponent),
  },
  {
    path: 'tienda/:slug/login',
    loadComponent: () =>
      import('./segundo_parcial/cu05_acceso/cu05-login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'saas-platform',
    title: 'Empresas | DrapeMind',
    canActivate: [authGuard, platformGuard],
    loadComponent: () =>
      import('./segundo_parcial/cu01_empresas/cu01-platform.component').then((m) => m.PlatformComponent),
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./segundo_parcial/cu05_acceso/cu05-login.component').then(
        (m) => m.LoginComponent,
      ),
  },
  {
    path: 'onboarding',
    canActivate: [authGuard],
    title: 'Experiencia Atelier | DrapeMind',
    loadComponent: () =>
      import('@packages/acceso-gestion-usuarios/registrar-cliente/onboarding.component').then(
        (m) => m.OnboardingComponent,
      ),
  },
  {
    path: 'receipt/:id',
    title: 'Comprobante Oficial Verificado | DrapeMind',
    loadComponent: () =>
      import('@packages/carrito-pedidos-pagos/consultar-comprobante/receipt-view.component').then(
        (m) => m.ReceiptViewComponent,
      ),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell.component').then((m) => m.ShellComponent),
    children: packageRoutes,
  },
  { path: '**', redirectTo: '' },
];
