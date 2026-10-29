# Incremento I: CU-01 a CU-10

Las rutas empresariales están agrupadas en [routes.ts](routes.ts). Los accesos públicos y el panel SaaS conservan sus entradas en app.routes.ts. Se reutilizan estos componentes relativos a src/app:

| Casos               | Componentes                                                                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CU-01, CU-02, CU-03 | packages/saas/platform.component.ts                                                                                                                            |
| CU-04               | packages/saas/subscription.component.ts                                                                                                                        |
| CU-05               | packages/acceso-gestion-usuarios/iniciar-sesion/login.component.ts; packages/saas/store-entry.component.ts                                                     |
| CU-06               | packages/acceso-gestion-usuarios/gestionar-usuarios-roles/users-management.component.ts                                                                        |
| CU-07               | packages/sucursales-inventario-proveedores/gestionar-ciudades-sucursales/branches-management.component.ts                                                      |
| CU-08               | packages/catalogo-comercializacion/gestionar-productos-ropa/products-management.component.ts y gestionar-categorias-variantes/categories-variants.component.ts |
| CU-09               | packages/sucursales-inventario-proveedores/gestionar-inventario-sucursal/inventory.component.ts                                                                |
| CU-10               | packages/catalogo-comercializacion/gestionar-promociones/promotions-management.component.ts y gestionar-productos-ropa/products-management.component.ts        |
