import { Routes } from '@angular/router';
import { aiReportsPlanGuard } from '../saas.service';
import { incrementoIRoutes } from '../../incrementos/incremento-i/routes';
import { incrementoIIRoutes } from '../../incrementos/incremento-ii/routes';

/** Feature routes grouped by the same business packages used by navigation. */
export const packageRoutes: Routes = [
  ...incrementoIRoutes,
  ...incrementoIIRoutes,
  {
    path: 'dashboard',
    title: 'Resumen | DrapeMind',
    data: { package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('@packages/sucursales-inventario-proveedores/panel-general/dashboard.component').then(
        (m) => m.DashboardComponent,
      ),
  },
  {
    path: 'account',
    title: 'Mi cuenta | DrapeMind',
    data: { package: 'Acceso y gestión de usuarios' },
    loadComponent: () =>
      import('@packages/acceso-gestion-usuarios/gestionar-cuenta/account.component').then(
        (m) => m.AccountComponent,
      ),
  },
  {
    path: 'catalog',
    title: 'Catálogo | DrapeMind',
    data: { package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/consultar-catalogo-prendas/catalog.component').then(
        (m) => m.CatalogComponent,
      ),
  },
  {
    path: 'cart-optimizer',
    title: 'Estudio de Perchero y Optimización | DrapeMind',
    data: { package: 'Carrito, pedidos y pagos' },
    loadComponent: () =>
      import('@packages/carrito-pedidos-pagos/optimizar-perchero-ia/cart-optimizer.component').then(
        (m) => m.CartOptimizerComponent,
      ),
  },
  {
    path: 'orders',
    title: 'Pedidos | DrapeMind',
    data: { package: 'Carrito, pedidos y pagos' },
    loadComponent: () =>
      import('@packages/carrito-pedidos-pagos/gestionar-pedidos-ventas-entregas/orders.component').then(
        (m) => m.OrdersComponent,
      ),
  },
  {
    path: 'pos',
    title: 'Caja | DrapeMind',
    data: { package: 'Carrito, pedidos y pagos' },
    loadComponent: () =>
      import('@packages/carrito-pedidos-pagos/registrar-venta-presencial/pos.component').then(
        (m) => m.PosComponent,
      ),
  },
  {
    path: 'reservations',
    title: 'Reservas | DrapeMind',
    data: { package: 'Reservas y atención en tienda' },
    loadComponent: () =>
      import('@packages/reservas-atencion-tienda/gestionar-reservas-sucursal/reservations.component').then(
        (m) => m.ReservationsComponent,
      ),
  },
  {
    path: 'ai-studio',
    title: 'Altair | DrapeMind',
    data: { package: 'Inteligencia artificial y asistencia de moda' },
    loadComponent: () =>
      import('@packages/inteligencia-artificial-asistencia-moda/consultar-asistente-altair/ai-studio.component').then(
        (m) => m.AiStudioComponent,
      ),
  },
  {
    path: 'seasons-admin',
    title: 'Temporadas y Colecciones | DrapeMind',
    data: { package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/gestionar-temporadas-colecciones/seasons-management.component').then(
        (m) => m.SeasonsManagementComponent,
      ),
  },
  {
    path: 'ai-product-assist',
    title: 'Estudio de Prendas IA | DrapeMind',
    data: { package: 'Inteligencia artificial y asistencia de moda' },
    loadComponent: () =>
      import('@packages/inteligencia-artificial-asistencia-moda/registrar-producto-asistido-ia/ai-product-assist.component').then(
        (m) => m.AiProductAssistComponent,
      ),
  },
  {
    path: 'ai-reports',
    canActivate: [aiReportsPlanGuard],
    title: 'Informes Ejecutivos IA | DrapeMind',
    data: { package: 'Inteligencia artificial y asistencia de moda' },
    loadComponent: () =>
      import('@packages/inteligencia-artificial-asistencia-moda/generar-reportes-empresariales/business-reports.component').then(
        (m) => m.BusinessReportsComponent,
      ),
  },
  {
    path: 'favorites',
    title: 'Mis Favoritos | DrapeMind',
    data: { package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/gestionar-favoritos/favorites.component').then(
        (m) => m.FavoritesComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];
