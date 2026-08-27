# DrapeMind Web

Panel Angular standalone para ADMIN y VENDEDOR, con catalogo, inventario, reservas, pedidos,
metricas y una consola conversacional de Gemma.

## Desarrollo local

```powershell
npm install
npm start
```

Abre <http://localhost:4200>. `npm start` usa [proxy.conf.json](proxy.conf.json) para enviar
`/api`, `/health` y los WebSockets a `http://127.0.0.1:8000`. El navegador trabaja
same-origin y no depende de CORS durante el desarrollo.

`public/config.json` permite cambiar el host sin recompilar:

```json
{
  "backendUrl": "https://api.midominio.com",
  "apiPrefix": "/api/v1"
}
```

Si se omite `backendUrl`, desarrollo usa el proxy y produccion usa el mismo origen del navegador.
No guardes secretos en los environments: todo lo compilado por Angular es publico.

## Produccion Linux

```bash
npm ci
npm run build
```

Publica `dist/web/browser/`. La configuracion recomendada sirve Angular y hace proxy de `/api`
al backend en el mismo dominio; revisa [drapemind.conf](deploy/nginx/drapemind.conf). En ese modo no
se necesita CORS. Si frontend y backend usan dominios distintos, agrega el origen exacto a
`backend/.env:CORS_ORIGINS`; CORS no se puede configurar desde el navegador.

## Tiempo real

- `/ws/ai`: autenticacion JWT por primer frame, streaming de tokens, tools y estado del modelo.
- `/ws/events`: reservas, pedidos, pagos e inventario con reconexion y heartbeat.

AI Studio soporta respuestas `text`, `cards` y `mixed`. Cada mensaje conserva un desplegable
de acciones verificadas con sus pasos y tiempos. Las cards de producto usan variantes reales y
pueden agregarse al carrito; pedidos y reservas enlazan a sus pantallas. Los accesos contextuales
de IA se limitan a catálogo, detalle de producto y carrito, donde aportan una decisión concreta.

Los outfits incluyen explicación, alertas de restricciones, total, presupuesto restante y una
acción para agregar el conjunto completo. En respuestas largas el chat ancla el inicio de la
recomendación para que el usuario lea primero la decisión y luego recorra las cards.

Los WebSockets usan `ws://` o `wss://` automaticamente segun la URL HTTP. La interfaz conserva
el JWT en `sessionStorage`, no en almacenamiento permanente.

## Calidad

```powershell
npm run build
npm test -- --watch=false
```
