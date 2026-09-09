# Verificación visual del chat

La conversación de las capturas es una fixture exclusivamente de prueba, no una respuesta medida del modelo.
El código de producto no incorpora sus textos.

Se verificaron: estado vacío sin mensaje de asistente predefinido, apartado plegable de ideas,
espera, texto parcial durante streaming, acción sugerida, respuesta y error.
Viewports: 1440 × 960 y 390 × 844. Se revisaron las capturas y se corrigió el layout estrecho.

Ejecutar npm run build y node scripts/check-chat-ui.cjs con Playwright disponible.
Por defecto usa Edge instalado; CHAT_QA_BROWSER permite otro canal compatible.
El script sirve únicamente el build local y bloquea solicitudes externas; los WebSockets son fixtures sin conexión a servidor.
No reemplaza pruebas end-to-end contra un backend real.

El chat conserva el lenguaje visual del atelier, elimina el marco de las respuestas del asistente,
separa ejemplos de mensajes, añade compositor flotante, transiciones y movimiento reducido.
