import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';
import { packageRoutes } from './core/navigation/package-routes';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('@packages/acceso-gestion-usuarios/iniciar-sesion/login.component').then(
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
