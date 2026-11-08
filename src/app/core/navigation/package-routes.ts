import { Routes } from '@angular/router';
import { aiReportsPlanGuard } from '../saas.service';
import { cu01Cu10Routes } from '../../segundo_parcial/compartido/cu01_cu10.routes';
import { cu11Cu20Routes } from '../../segundo_parcial/compartido/cu11_cu20.routes';

/** Feature routes grouped by the same business packages used by navigation. */
export const packageRoutes: Routes = [
  {path:'pending-purchases',title:'Compras pendientes | DrapeMind',loadComponent:()=>import('../../segundo_parcial/cu23_pagos/cu23-deferred-checkout.component').then(m=>m.DeferredCheckoutComponent)},
  {path:'business-insights',title:'Indicadores y tendencias | DrapeMind',loadComponent:()=>import('../../segundo_parcial/cu27_dashboard/cu27-insights.component').then(m=>m.InsightsComponent)},
  ...cu01Cu10Routes,
  ...cu11Cu20Routes,
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
      import('../../segundo_parcial/cu13_catalogo_offline/cu13-catalog.component').then(
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
      import('../../segundo_parcial/cu24_pedidos/cu24-orders.component').then(
        (m) => m.OrdersComponent,
      ),
  },
  {
    path: 'pos',
    title: 'Caja | DrapeMind',
    data: { package: 'Carrito, pedidos y pagos' },
    loadComponent: () =>
      import('../../segundo_parcial/compartido/caja_online/pos.component').then(
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
      import('../../segundo_parcial/cu29_altair/cu29-ai-studio.component').then(
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
      import('../../segundo_parcial/cu25_reportes_voz/cu25-business-reports.component').then(
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
