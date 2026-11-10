import { Routes } from '@angular/router';
export const cu11Cu20Routes: Routes = [
  {
    path: 'retail',
    title: 'Caja y reservas | DrapeMind',
    data: { casos: ['CU-15', 'CU-16', 'CU-17', 'CU-19'] },
    loadComponent: () => import('../cu15_ventas_contado/cu15-retail.component').then((m) => m.RetailComponent),
  },
  {
    path: 'sync-conflicts',
    title: 'Operaciones por revisar | DrapeMind',
    data: { casos: ['CU-18'] },
    loadComponent: () =>
      import('../cu18_conflictos/cu18-conflicts.component').then((m) => m.ConflictsComponent),
  },
  {
    path: 'exchanges',
    title: 'Cambios de prendas | DrapeMind',
    data: { casos: ['CU-20'] },
    loadComponent: () => import('../cu20_cambios/cu20-exchanges.component').then((m) => m.ExchangesComponent),
  },
  {
    path: 'offline',
    title: 'Reservas guardadas | DrapeMind',
    data: { casos: ['CU-12', 'CU-13', 'CU-14'] },
    loadComponent: () => import('../cu13_catalogo_offline/cu13-offline.component').then((m) => m.OfflineComponent),
  },
  {
    path: 'suppliers-admin',
    title: 'Proveedores y abastecimiento | DrapeMind',
    data: { casos: ['CU-11'] },
    loadComponent: () =>
      import('../cu11_proveedores/cu11-supply.component').then((m) => m.SupplyComponent),
  },
];
