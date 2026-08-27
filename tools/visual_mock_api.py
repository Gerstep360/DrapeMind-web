"""Read-only visual QA API for rendering authenticated Angular states."""

from datetime import UTC, datetime, timedelta

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NOW = datetime.now(UTC)
ORDER = {
    "id": 41,
    "codigo_publico": "PED-2026-0041",
    "estado": "PREPARANDO",
    "canal": "WEB",
    "tipo_entrega": "RECOJO",
    "subtotal": 780,
    "descuento": 30,
    "costo_envio": 0,
    "total": 750,
    "created_at": NOW.isoformat(),
    "paid_at": NOW.isoformat(),
    "completed_at": None,
}
RESERVATION = {
    "id": 18,
    "codigo_publico": "RES-2026-0018",
    "estado": "CONFIRMADA",
    "fecha_reserva": NOW.isoformat(),
    "vence_at": (NOW + timedelta(minutes=22)).isoformat(),
    "observacion": "Recoge en tienda central",
}


@app.post("/api/v1/auth/login")
def login() -> dict:
    return {"access_token": "visual-qa-token", "token_type": "bearer", "expires_in": 3600}


@app.get("/api/v1/auth/me")
def me() -> dict:
    return {
        "id": 1,
        "nombre": "Camila Rojas",
        "email": "admin@drapemind.local",
        "telefono": None,
        "rol": "ADMIN",
        "estado": "ACTIVO",
        "created_at": NOW.isoformat(),
    }


@app.get("/api/v1/admin/orders")
def orders() -> list[dict]:
    return [ORDER, {**ORDER, "id": 40, "codigo_publico": "PED-2026-0040", "estado": "LISTO"}]


@app.get("/api/v1/admin/reservations")
def reservations() -> list[dict]:
    return [RESERVATION]


@app.get("/api/v1/admin/metrics/sales-inventory")
def metrics() -> dict:
    return {
        "ventas": {"pedidos_entregados": 128, "ingresos": 48250},
        "inventario": {"variantes": 94, "unidades_disponibles": 612, "stock_bajo": 7},
    }


@app.get("/api/v1/admin/ai/runtime")
def runtime() -> dict:
    return {
        "healthy": True,
        "managed": True,
        "running": True,
        "active_requests": 0,
        "idle_seconds": 84,
        "idle_timeout_seconds": 600,
        "model": "google/gemma-4-E2B-it-qat-q4_0-gguf",
        "model_exists": True,
        "mmproj_exists": True,
        "executable": "/opt/llama.cpp/build/bin/llama-server",
        "platform": "linux",
    }


@app.websocket("/api/v1/ws/events")
async def events(socket: WebSocket) -> None:
    await socket.accept()
    await socket.receive_json()
    await socket.send_json({"type": "connected", "channel": "events"})
    try:
        while True:
            message = await socket.receive_json()
            if message.get("type") == "ping":
                await socket.send_json({"type": "pong"})
    except WebSocketDisconnect:
        pass


@app.websocket("/api/v1/ws/ai")
async def ai(socket: WebSocket) -> None:
    await socket.accept()
    await socket.receive_json()
    await socket.send_json({"type": "connected", "channel": "ai"})
    try:
        while True:
            message = await socket.receive_json()
            if message.get("type") == "ping":
                await socket.send_json({"type": "pong"})
            if message.get("type") == "chat":
                await socket.send_json({"type": "tool_start", "name": "recommend_outfit"})
                await socket.send_json(
                    {
                        "type": "tool_result",
                        "name": "recommend_outfit",
                        "result": [{"id": 8}, {"id": 11}, {"id": 15}],
                    }
                )
                await socket.send_json(
                    {
                        "type": "presentation",
                        "mode": "mixed",
                        "title": "Outfit listo para agregar",
                        "card_count": 3,
                        "notices": [
                            {
                                "type": "warning",
                                "title": "No sustituí tu talla",
                                "message": "No hay calzado en talla 45.",
                            }
                        ],
                        "response_meta": {
                            "kind": "outfit",
                            "total_bob": 667,
                            "budget_bob": 800,
                            "budget_remaining_bob": 133,
                            "item_count": 3,
                            "occasion": "casual",
                            "can_add_all": True,
                        },
                    }
                )
                await socket.send_json(
                    {
                        "type": "token",
                        "content": (
                            "Armé una base casual equilibrada respetando tu polera talla M "
                            "y el pantalón ancho. El total es Bs 667. No añadí calzado porque "
                            "no encontré talla 45 con stock."
                        ),
                    }
                )
                await socket.send_json(
                    {
                        "type": "done",
                        "session_id": 7,
                        "interaction_id": 12,
                        "tools": ["recommend_outfit"],
                        "presentation_mode": "mixed",
                        "response_title": "Outfit listo para agregar",
                        "duration_ms": 842,
                        "notices": [
                            {
                                "type": "warning",
                                "title": "No sustituí tu talla",
                                "message": "No hay calzado en talla 45.",
                            }
                        ],
                        "response_meta": {
                            "kind": "outfit",
                            "total_bob": 667,
                            "budget_bob": 800,
                            "budget_remaining_bob": 133,
                            "item_count": 3,
                            "occasion": "casual",
                            "can_add_all": True,
                        },
                        "action_items": [
                            {
                                "id": 8,
                                "variante_id": 21,
                                "nombre": "Polera Gráfica Edición Limitada",
                                "precio": 179,
                                "color": "Blanco crudo",
                                "talla": "M",
                                "accion": "AGREGAR",
                                "motivo": "Stock verificado · Calidad Q4",
                            },
                            {
                                "id": 11,
                                "variante_id": 33,
                                "nombre": "Pantalón Palazzo Sastrero",
                                "precio": 319,
                                "color": "Grafito",
                                "talla": "S",
                                "accion": "AGREGAR",
                                "motivo": "Stock verificado · Calidad Q5",
                            },
                            {
                                "id": 15,
                                "variante_id": 42,
                                "nombre": "Bufanda de Lana y Cachemira",
                                "precio": 169,
                                "color": "Gris perla",
                                "talla": "Única",
                                "accion": "AGREGAR",
                                "motivo": "Stock verificado · Calidad Q5",
                            },
                        ],
                    }
                )
    except WebSocketDisconnect:
        pass
