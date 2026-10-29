import { Routes } from '@angular/router';
export const incrementoIIRoutes: Routes = [
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
