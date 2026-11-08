import { Routes } from '@angular/router';

/** Segundo parcial, CU-04 y CU-06 a CU-10. Componentes de dominio compartidos. */
export const cu01Cu10Routes: Routes = [
  {
    path: 'subscription',
    data: { casos: ['CU-04'] },
    title: 'Plan de empresa | DrapeMind',
    loadComponent: () =>
      import('../cu04_plan_empresa/cu04-subscription.component').then((m) => m.SubscriptionComponent),
  },
  {
    path: 'inventory',
    title: 'Inventario | DrapeMind',
    data: { casos: ['CU-09'], package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('../cu09_inventario/cu09-inventory.component').then(
        (m) => m.InventoryComponent,
      ),
  },
  {
    path: 'users-admin',
    title: 'Usuarios y Roles | DrapeMind',
    data: { casos: ['CU-06'], package: 'Acceso y gestión de usuarios' },
    loadComponent: () =>
      import('../cu06_usuarios_roles/cu06-users-management.component').then(
        (m) => m.UsersManagementComponent,
      ),
  },
  {
    path: 'products-admin',
    title: 'Gestión de Prendas | DrapeMind',
    data: { casos: ['CU-08', 'CU-10'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('../cu08_productos/cu08-products-management.component').then(
        (m) => m.ProductsManagementComponent,
      ),
  },
  {
    path: 'categories-admin',
    title: 'Categorías y Variantes | DrapeMind',
    data: { casos: ['CU-08'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('../cu08_productos/cu08-categories-variants.component').then(
        (m) => m.CategoriesVariantsComponent,
      ),
  },
  {
    path: 'branches-admin',
    title: 'Sedes y Ciudades | DrapeMind',
    data: { casos: ['CU-07'], package: 'Sucursales, inventario y proveedores' },
    loadComponent: () =>
      import('../cu07_sucursales/cu07-branches-management.component').then(
        (m) => m.BranchesManagementComponent,
      ),
  },
  {
    path: 'promotions-admin',
    title: 'Promociones y Descuentos | DrapeMind',
    data: { casos: ['CU-10'], package: 'Catálogo y comercialización' },
    loadComponent: () =>
      import('../cu10_precios_promociones/cu10-promotions-management.component').then(
        (m) => m.PromotionsManagementComponent,
      ),
  },
];
