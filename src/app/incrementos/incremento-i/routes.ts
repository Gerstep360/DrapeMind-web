import { Routes } from '@angular/router';

/** Segundo parcial, CU-04 y CU-06 a CU-10. Componentes de dominio compartidos. */
export const incrementoIRoutes: Routes = [
  {
    path: 'subscription',
    data: { incremento: 1, casos: ['CU-04'] },
    title: 'Plan de empresa | DrapeMind',
    loadComponent: () =>
      import('../../packages/saas/subscription.component').then((m) => m.SubscriptionComponent),
  },
  {
    path: 'inventory',
    title: 'Inventario | DrapeMind',
    data: { incremento: 1, casos: ['CU-09'], package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('@packages/sucursales-inventario-proveedores/gestionar-inventario-sucursal/inventory.component').then(
        (m) => m.InventoryComponent,
      ),
  },
  {
    path: 'users-admin',
    title: 'Usuarios y Roles | DrapeMind',
    data: { incremento: 1, casos: ['CU-06'], package: 'Acceso y gestión de usuarios' },
    loadComponent: () =>
      import('@packages/acceso-gestion-usuarios/gestionar-usuarios-roles/users-management.component').then(
        (m) => m.UsersManagementComponent,
      ),
  },
  {
    path: 'products-admin',
    title: 'Gestión de Prendas | DrapeMind',
    data: { incremento: 1, casos: ['CU-08', 'CU-10'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/gestionar-productos-ropa/products-management.component').then(
        (m) => m.ProductsManagementComponent,
      ),
  },
  {
    path: 'categories-admin',
    title: 'Categorías y Variantes | DrapeMind',
    data: { incremento: 1, casos: ['CU-08'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/gestionar-categorias-variantes/categories-variants.component').then(
        (m) => m.CategoriesVariantsComponent,
      ),
  },
  {
    path: 'branches-admin',
    title: 'Sedes y Ciudades | DrapeMind',
    data: { incremento: 1, casos: ['CU-07'], package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('@packages/sucursales-inventario-proveedores/gestionar-ciudades-sucursales/branches-management.component').then(
        (m) => m.BranchesManagementComponent,
      ),
  },
  {
    path: 'promotions-admin',
    title: 'Promociones y Descuentos | DrapeMind',
    data: { incremento: 1, casos: ['CU-10'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('@packages/catalogo-comercializacion/gestionar-promociones/promotions-management.component').then(
        (m) => m.PromotionsManagementComponent,
      ),
  },
];
