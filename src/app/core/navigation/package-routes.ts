import { Routes } from '@angular/router';

/** Feature routes grouped by the same business packages used by navigation. */
export const packageRoutes: Routes = [
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
    path: 'inventory',
    title: 'Inventario | DrapeMind',
    data: { package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('@packages/sucursales-inventario-proveedores/gestionar-inventario-sucursal/inventory.component').then(
        (m) => m.InventoryComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
];
