import { Routes } from '@angular/router';
export const incrementoIIRoutes: Routes = [
  {
    path: 'retail',
    title: 'Caja y reservas | DrapeMind',
    data: { incremento: 2, casos: ['CU-15', 'CU-16', 'CU-17', 'CU-19'] },
    loadComponent: () => import('./caja/retail.component').then((m) => m.RetailComponent),
  },
  {
    path: 'sync-conflicts',
    title: 'Operaciones por revisar | DrapeMind',
    data: { incremento: 2, casos: ['CU-18'] },
    loadComponent: () =>
      import('./conflictos/conflicts.component').then((m) => m.ConflictsComponent),
  },
  {
    path: 'exchanges',
    title: 'Cambios de prendas | DrapeMind',
    data: { incremento: 2, casos: ['CU-20'] },
    loadComponent: () => import('./cambios/exchanges.component').then((m) => m.ExchangesComponent),
  },
  {
    path: 'offline',
    title: 'Sin conexión | DrapeMind',
    data: { incremento: 2, casos: ['CU-12', 'CU-13', 'CU-14'] },
    loadComponent: () => import('./offline/offline.component').then((m) => m.OfflineComponent),
  },
  {
    path: 'suppliers-admin',
    title: 'Proveedores y abastecimiento | DrapeMind',
    data: { incremento: 2, casos: ['CU-11'] },
    loadComponent: () =>
      import('./cu11-abastecimiento/supply.component').then((m) => m.SupplyComponent),
  },
];
