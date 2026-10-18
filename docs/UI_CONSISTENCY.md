# Consistencia visual por ruta

Todas las rutas reales importan las mismas primitivas SCSS para encabezados, botones, campos, tablas y feedback. Las composiciones de catálogo/chat y las tablas operativas conservan su función. No se cambian guards ni servicios.

Las imágenes de prendas comparten `ProductMediaComponent`: fotografía real cuando está disponible y estado tipográfico sin SVG cuando falta o falla la carga. El chat renderiza los componentes prefabricados de `AiPresentationComponent` con datos de herramientas del backend. La [verificación](FASHION_NEUBRUTALISM_VERIFICATION.md) incluye pruebas automáticas, integración NVIDIA real y los límites de la revisión visual.

| Ruta | Componente | Sistema compartido |
| --- | --- | --- |
| /login | `src\app\packages\acceso-gestion-usuarios\iniciar-sesion\login.component.ts` | `fashion.page` |
| /onboarding | `src\app\packages\acceso-gestion-usuarios\registrar-cliente\onboarding.component.ts` | `fashion.page` |
| /receipt/:id | `src\app\packages\carrito-pedidos-pagos\consultar-comprobante\receipt-view.component.ts` | `fashion.page` |
| /dashboard | `src\app\packages\sucursales-inventario-proveedores\panel-general\dashboard.component.ts` | `fashion.page` |
| /account | `src\app\packages\acceso-gestion-usuarios\gestionar-cuenta\account.component.ts` | `fashion.page` |
| /catalog | `src\app\packages\catalogo-comercializacion\consultar-catalogo-prendas\catalog.component.ts` | `fashion.page` |
| /cart-optimizer | `src\app\packages\carrito-pedidos-pagos\optimizar-perchero-ia\cart-optimizer.component.ts` | `fashion.page` |
| /orders | `src\app\packages\carrito-pedidos-pagos\gestionar-pedidos-ventas-entregas\orders.component.ts` | `fashion.page` |
| /pos | `src\app\packages\carrito-pedidos-pagos\registrar-venta-presencial\pos.component.ts` | `fashion.page` |
| /reservations | `src\app\packages\reservas-atencion-tienda\gestionar-reservas-sucursal\reservations.component.ts` | `fashion.page` |
| /ai-studio | `src\app\packages\inteligencia-artificial-asistencia-moda\consultar-asistente-altair\ai-studio.component.ts` | `fashion.page` |
| /inventory | `src\app\packages\sucursales-inventario-proveedores\gestionar-inventario-sucursal\inventory.component.ts` | `fashion.page` |
| /users-admin | `src\app\packages\acceso-gestion-usuarios\gestionar-usuarios-roles\users-management.component.ts` | `fashion.page` |
| /products-admin | `src\app\packages\catalogo-comercializacion\gestionar-productos-ropa\products-management.component.ts` | `fashion.page` |
| /categories-admin | `src\app\packages\catalogo-comercializacion\gestionar-categorias-variantes\categories-variants.component.ts` | `fashion.page` |
| /branches-admin | `src\app\packages\sucursales-inventario-proveedores\gestionar-ciudades-sucursales\branches-management.component.ts` | `fashion.page` |
| /suppliers-admin | `src\app\packages\sucursales-inventario-proveedores\gestionar-proveedores\suppliers-management.component.ts` | `fashion.page` |
| /promotions-admin | `src\app\packages\catalogo-comercializacion\gestionar-promociones\promotions-management.component.ts` | `fashion.page` |
| /seasons-admin | `src\app\packages\catalogo-comercializacion\gestionar-temporadas-colecciones\seasons-management.component.ts` | `fashion.page` |
| /ai-product-assist | `src\app\packages\inteligencia-artificial-asistencia-moda\registrar-producto-asistido-ia\ai-product-assist.component.ts` | `fashion.page` |
| /ai-reports | `src\app\packages\inteligencia-artificial-asistencia-moda\generar-reportes-empresariales\business-reports.component.ts` | `fashion.page` |
| /favorites | `src\app\packages\catalogo-comercializacion\gestionar-favoritos\favorites.component.ts` | `fashion.page` |
