# Entrega y verificación del rediseño web

Identidad: fotografía del catálogo, hueso `#F8F7F2`, papel `#FFFDF7`, negro `#111111`, lima `#C6FC4A` y coral `#EF754E`. Manrope existente en pesos fuertes, geometría de 2–6 px y sombras sólidas concentradas en acciones principales. No se incorporaron productos, campañas, métricas ni fotografías ficticias a producción.

La [matriz de auditoría](FASHION_NEUBRUTALISM_AUDIT.md) registra las 22 pantallas encontradas, archivos, servicios y estados. Se conservaron las rutas, guards, roles y contratos de compra. La aplicación Flutter queda fuera de este lote visual.

## Cambios principales

- Tokens y alias compatibles; las 22 rutas aplican las primitivas compartidas de `styles/_fashion.scss` a encabezados, formularios, botones, tablas y estados. La [matriz por ruta](UI_CONSISTENCY.md) identifica sus componentes.
- Shell con navegación de clientes y navegación operativa por rol, selección de sucursal, notificaciones y carrito.
- Catálogo con cabecera coral, tarjetas con fotografía real, precios del API, favoritos, filtros y selección de variantes.
- Acceso y onboarding con identidad editorial; las pantallas administrativas mantienen tablas, filtros, formularios y acciones.
- Chat con compositor persistente, herramientas accesibles, progreso real, historial, copiar respuesta y fichas horizontales compactas. A 760 px o menos, las fichas del chat pasan a una columna.
- El detalle abierto desde el chat consulta nuevamente el catálogo. Variantes agotadas no permiten compra desde la ficha; el servidor vuelve a comprobar stock y precio.
- `ProductMediaComponent` sustituye los antiguos SVG de prendas en 18 espacios de 13 componentes, incluido catálogo, favoritos, carrito, detalle, chat y POS. Las fotos ausentes o que fallan muestran un estado tipográfico «Sin fotografía» con la misma identidad visual.
- El chat conserva y renderiza `ui_blocks` en mensajes e historial local. Las comparaciones y existencias se muestran en tablas semánticas, los presupuestos/carritos en resúmenes, los pedidos/reservas/pagos en listas de estados y las políticas en bloques de información. Las opciones de continuación conservan sus botones existentes.
- NVIDIA selecciona componentes prefabricados por `source_tool`; el servidor exige una consulta autorizada del turno actual y vuelve a leer sus datos. El modelo no proporciona precios, filas, HTML, CSS ni acciones de compra para estas vistas. El historial del servidor conserva los hechos completos para preguntas posteriores.
- Los sockets continúan intentando reconectar tras una interrupción prolongada, con espera máxima de 30 segundos; se detienen al cerrar sesión o invalidarse la autenticación.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm run build:prod` | Correcto, producción; bundle inicial aproximadamente 321 kB antes de compresión |
| `npm test -- --watch=false` | 19 pruebas correctas: catálogo, concurrencia, herramientas, formularios de aclaración, fichas, recuperación de sockets, vistas dinámicas y error de fotografía |
| Backend `python -m pytest -q` | 118 pruebas correctas; incluye precios, preferencias y sus prioridades, tallas exactas, presupuestos, ahorro, novedades por fecha, formularios y componentes con datos de herramientas |
| `python -m scripts.local_tasks check-db` | Conexión y tablas/columnas compatibles |
| `alembic current` | `20261016_01 (head)` |
| Promociones, notificaciones, direcciones, favoritos, perfil | 200 en FastAPI y por el proxy `localhost:4200`, usando cuenta temporal eliminada al terminar |
| `/ws/ai` y `/ws/events` | Autenticación y ping/pong correctos en FastAPI y por el proxy Angular |
| Chat real con NVIDIA + PostgreSQL | Explorar: 2 fichas con nombre/precio coincidentes; precio: nueva consulta y cero fichas; pregunta general: sin herramientas innecesarias |
| `python -m scripts.diagnostics.check_dynamic_ui` | NVIDIA real: comparación como `data_table` con nombres/precios iguales a PostgreSQL; presupuesto como `metrics` calculado por el servidor. Cuenta temporal eliminada |
| `python -m scripts.diagnostics.check_personal_shopping` | NVIDIA real: perfil y talla explícita, plan de más prendas, ahorro sin mutar carrito y formulario de ciudad con consulta retomada |
| `python -m scripts.local_tasks check-ai` | Herramientas nativas y streaming correctos con `nvidia/nemotron-3-super-120b-a12b` |
| Perfil inicial + inferencia breve real | Guardado e inferencia correctos con NVIDIA; cuenta de comprobación eliminada |

La migración `20261016_01_promotion_product.py` añade la columna que faltaba en `promociones`; no elimina promociones existentes. El diagnóstico local ahora comprueba estructura de tablas y columnas, además de conexión.

## Límites de la verificación

No había navegador ni superficie gráfica conectada al controlador de esta sesión. No se generaron capturas ni se acredita inspección visual a 1440/1024/768/390/320 px. Los breakpoints, foco visible, espacio reservado para fotos y preferencias de movimiento reducido se revisaron en código; las interacciones cubiertas se verificaron mediante pruebas Angular.

La integración real se verificó con `python -m scripts.diagnostics.check_grounded_chat`. El modelo anterior produjo timeouts y nombres de herramientas inválidos; el modelo local quedó configurado como `nvidia/nemotron-3-super-120b-a12b` tras verificar el flujo completo. La prueba aislada de catálogo devolvió dos fichas correctas en 5,7 segundos. Se mantiene un solo proveedor/modelo configurado; los errores no se sustituyen por productos o precios inventados.

Los mensajes `Angular is running in development mode` corresponden a `npm start`. Las referencias `VM…reportAllChanges/startTime` y `webextension.js` no aparecen en `src` ni `public`; no se atribuyeron a una causa específica sin evidencia.
