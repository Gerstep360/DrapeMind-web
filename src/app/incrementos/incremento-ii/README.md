# Incremento II: CU-11 a CU-20

| Caso                                           | Implementación                                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------ |
| CU-11 Proveedores y abastecimiento             | cu11-abastecimiento/supply.component.ts y .html; ruta /suppliers-admin                     |
| CU-12 Descargar datos offline                  | offline/offline.service.ts, offline-store.ts y offline.models.ts                           |
| CU-13 Consultar catálogo offline               | offline/offline.component.ts y .html; ruta /offline                                        |
| CU-14 Registrar solicitudes de reserva offline | cola persistente en offline/offline.service.ts; diálogo y seguimiento en offline.component |

Entrada: [routes.ts](routes.ts). Diseño compartido del incremento: feature.scss.

IndexedDB conserva catálogo y operaciones por URL del servidor, empresa y usuario. Las fotografías públicas se guardan en CacheStorage. Una solicitud local no tiene QR ni garantiza stock: FastAPI verifica plan, permisos, sucursal, disponibilidad y precio actual antes de crear la reserva. Los reintentos usan el mismo UUID.

La PWA se prepara con npm run build o npm run build:prod. El postbuild scripts/offline-manifest.mjs incluye los chunks diferidos en el shell precargado y cambia su versión en cada compilación. El trabajador public/sw.js excluye las respuestas de la API y peticiones autenticadas. El servidor de desarrollo ng serve no instala este trabajador.

Prueba de navegador reproducible: scripts/check-incremento-ii.cjs. Evidencias: qa/incremento-ii. Usa Playwright y Edge con datos ficticios; no realiza solicitudes a producción.

| Casos nuevos | Implementación y acceso |
| --- | --- |
| CU-15 Ventas de contado offline | caja/retail.component; /retail → Nueva venta |
| CU-16 Pendientes y resultados | caja/retail.component y offline/offline.component; filtros y resultados guardados |
| CU-17 Sincronizar reservas y ventas | offline/offline.service; registro antes de enviar, UUID estable y conciliación por resultados |
| CU-18 Resolver conflictos | conflictos/conflicts.component; /sync-conflicts, solo Encargado/Administrador |
| CU-19 Atender y cobrar reservas | caja/retail.component → Atender reservas; copia local, preparación online y retiro con cobro persistente |
| CU-20 Cambios de prendas | cambios/exchanges.component; /exchanges, con conexión |

La venta offline genera un comprobante provisional descargable. Al confirmarse aparece el comprobante de la empresa. Las ventas cobradas no se cancelan localmente como una solicitud de reserva. Una respuesta perdida se concilia por UUID, incluso si no aparece en los últimos 200 resultados.

CU-20 conserva en local la solicitud enviada hasta conocer su resultado. Si se recarga la página o se pierde la respuesta, se comprueba el mismo cambio antes de iniciar otro. Los precios del cálculo previo y la confirmación se validan en el backend.
## Recuperación de cambios de prendas

Un cambio pendiente se conserva por servidor, empresa y usuario. Al comprobarlo se consulta `GET /retail/exchanges/operations/{uuid}` antes de reenviar el mismo cuerpo. Un error de autenticación mantiene la solicitud guardada. La cancelación de reservas verifica el propietario y el estado antes de cualquier petición.
