# DrapeMind Web

El acceso pide correo y contraseña; la API determina la empresa y el destino. Los enlaces `/tienda/<slug>` reconocen la tienda automáticamente. Los clientes tienen una cuenta universal y pueden elegir otra tienda desde `/tiendas`. El carrito, las compras y el stock se conservan por empresa y sucursal. No hay selector de rol en el acceso.

El panel de empresas guía el alta en tres pasos y muestra validaciones junto a los campos. Permite preparar el enlace, asignar el plan y elegir contratación Stripe o licencia administrativa. Los comprobantes usan datos comerciales de cada empresa. [Contrato de identidad y compras](../backend/docs/COMPRAS_POR_TIENDA.md).

Despliegue compartido en `https://167.86.106.105/DrapeMind/`: prepara ambos repositorios con `python3 instalar_vps.py` desde `/root/app/DrapeMind`. El gestor nativo compila con Node privado, publica por versiones y configura Nginx/API/WebSockets. [Guía del instalador](../backend/docs/INSTALACION_VPS.md).

Panel Angular standalone para ADMIN y VENDEDOR, con catalogo, inventario, reservas, pedidos,
metricas y una consola conversacional Altair conectada al proveedor configurado en FastAPI.

La arquitectura principal usa un solo modelo NVIDIA desde el backend, tarjetas verificadas y hasta tres consultas simultáneas por conexión. El onboarding guarda las respuestas y muestra una inferencia breve real; permite reintentar si la IA falla. No requiere claves en el navegador.

Inicia la API con `python iniciar_backend.py` desde la raíz del proyecto. Configuración y migraciones: [backend/README.md](../backend/README.md). El proxy local usa el puerto 8000; `config.json` funciona con `/api/v1` y el runtime conserva el prefijo de producción `/DrapeMind`.

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

- `/ws/ai`: autenticación JWT por primer frame, actividad real de herramientas y respuesta verificada. El adaptador NVIDIA admite JSON y SSE; el texto se publica después de validar los datos comerciales.
- `/ws/events`: reservas, pedidos, pagos e inventario con reconexion y heartbeat.

AI Studio soporta respuestas `text`, `cards` y `mixed`. Cada mensaje conserva un desplegable
de acciones verificadas con sus pasos y tiempos. Las cards de producto usan variantes reales y
pueden agregarse al carrito; pedidos y reservas enlazan a sus pantallas. Los accesos contextuales
de IA se limitan a catálogo, detalle de producto y carrito, donde aportan una decisión concreta.

Consultar una prenda no obliga a mostrar su tarjeta. Las preguntas de precio pueden responderse
solo con texto; al explorar prendas se usan fichas compactas. Abrir un detalle vuelve a consultar
el catálogo y agregar al carrito valida nuevamente precio y stock en el servidor. El chat sigue
el último mensaje mientras el usuario permanece al final; permite desplazarse para leer respuestas anteriores.

La identidad Fashion Neubrutalism utiliza hueso, negro, lima y coral, con tipografía editorial,
bordes definidos y sombras sólidas selectivas. [Auditoría por ruta](docs/FASHION_NEUBRUTALISM_AUDIT.md).
[Verificación y límites de esta entrega](docs/FASHION_NEUBRUTALISM_VERIFICATION.md).

Los WebSockets usan `ws://` o `wss://` automaticamente segun la URL HTTP. La interfaz conserva
el JWT en `sessionStorage`, no en almacenamiento permanente.

## Calidad

```powershell
npm run build
npm test -- --watch=false
```
