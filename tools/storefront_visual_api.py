"""Isolated visual QA fixture. No access to the real DB or NVIDIA credentials.

Run from web/tools using the backend virtualenv: python -m uvicorn storefront_visual_api:app --port 18000
Then ng serve --port 14200 --proxy-config tools/visual_proxy.json.
Public fixture login: any email/password. Data and mutations exist only in this process.
"""
import base64
import json
import time
from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.staticfiles import StaticFiles

ROOT = Path(__file__).parent
app = FastAPI()
app.mount('/qa-images', StaticFiles(directory=ROOT/'fixtures'), name='qa-images')
PRODUCTS = json.loads((ROOT/'fixtures/catalog.json').read_text(encoding='utf-8'))
FAVORITES = set()

@app.post('/api/v1/auth/login')
@app.post('/api/v1/auth/refresh')
def login():
    payload = base64.urlsafe_b64encode(json.dumps({'sub':'1','exp':int(time.time())+3600}).encode()).decode().rstrip('=')
    return {'access_token':f'eyJhbGciOiJub25lIn0.{payload}.visual-qa', 'token_type':'bearer','expires_in':3600}

@app.get('/api/v1/auth/me')
def me():
    return dict(id=1,nombre='Camila',email='visual@example.test',telefono=None,rol='CLIENTE',estado='ACTIVO',created_at='2026-09-12T00:00:00Z',has_style_profile=True)

@app.get('/api/v1/catalog/products')
def products(q:str='',genero:str|None=None,categoria_id:int|None=None,precio_max:float|None=None,limit:int=48,offset:int=0):
    return [p for p in PRODUCTS if (not q or q.lower() in (p['nombre']+' '+p['marca']).lower()) and (not genero or p['genero_objetivo']==genero) and (not categoria_id or p['categoria_id']==categoria_id) and (precio_max is None or p['precio']<=precio_max)][offset:offset+limit]

@app.get('/api/v1/catalog/products/{product_id}')
def product(product_id:int):
    found=next((p for p in PRODUCTS if p['id']==product_id),None)
    if not found: raise HTTPException(404)
    return found

@app.get('/api/v1/catalog/categories')
def categories():
    return [dict(id=i,nombre=name,slug=name.lower(),descripcion=None,parent_id=None,activo=True) for i,name in [(18,'Vestidos'),(26,'Chaquetas'),(32,'Pantalones')]]

@app.get('/api/v1/catalog/favorites')
def favorites(): return [p for p in PRODUCTS if p['id'] in FAVORITES]

@app.post('/api/v1/catalog/favorites/{product_id}')
def favorite_add(product_id:int): FAVORITES.add(product_id); return {'message':'Guardado'}

@app.delete('/api/v1/catalog/favorites/{product_id}')
def favorite_remove(product_id:int): FAVORITES.discard(product_id); return None

@app.get('/api/v1/branches')
def branches(): return [dict(id=1,ciudad_id=1,codigo='CENTRAL',nombre='Tienda Central',direccion='Santa Cruz',telefono=None,latitud=None,longitud=None,activo=True,ciudad='Santa Cruz',departamento='Santa Cruz')]

@app.get('/api/v1/cart')
def cart(): return dict(id=1,usuario_id=1,items=[],total_items=0,subtotal=0)

@app.get('/api/v1/notifications')
@app.get('/api/v1/users/me/notifications')
@app.get('/api/v1/ai/sessions')
@app.get('/api/v1/orders')
@app.get('/api/v1/reservations')
def empty(): return []

@app.get('/api/v1/users/me/style-profile')
def profile(): return dict(usuario_id=1,genero='MUJER',talla_superior='M',talla_inferior='M',estilos_preferidos=['casual'],colores_preferidos=['negro'],presupuesto_maximo=400)

@app.get('/api/v1/branches/products/{product_id}/availability')
def availability(product_id:int):
    return [dict(sucursal_id=1,sucursal='Tienda Central',variante_id=v['id'],producto_id=product_id,producto=product(product_id)['nombre'],sku=v['sku'],color=v['color'],talla=v['talla'],stock_total=8,stock_reservado=0,stock_disponible=8) for v in product(product_id)['variantes']]

@app.websocket('/api/v1/ws/{channel}')
async def events(socket:WebSocket,channel:str):
    await socket.accept()
    try:
        await socket.receive_json()
        await socket.send_json({'type':'connected','channel':channel})
        while True:
            message=await socket.receive_json()
            if message.get('type')=='ping': await socket.send_json({'type':'pong'})
            elif message.get('type')=='chat':
                # Explicit failure fixture: visual QA never pretends to call the real provider.
                await socket.send_json({'type':'error','request_id':message.get('request_id'),'message':'La vista de prueba no tiene conexión con NVIDIA.'})
    except WebSocketDisconnect: pass
