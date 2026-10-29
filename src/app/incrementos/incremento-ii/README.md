# Incremento II: CU-11 a CU-14

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
