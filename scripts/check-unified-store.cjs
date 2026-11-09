const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/unified-store');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14207/DrapeMind';
const server=http.createServer((req,res)=>{
 if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
 const p=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const f=p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()?p:path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});
(async()=>{
 await new Promise(r=>server.listen(14207,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext();let connected=true,submitted=[],results=[],own=null;const errors=[];
 const user={id:4,tenant_id:1,tenant_slug:'moda',tenant_name:'Moda Oriente',nombre:'Comprador',email:'buyer@example.com',rol:'CLIENTE',estado:'ACTIVO',has_style_profile:true};
 const variant={id:7,producto_id:1,sku:'CAM-M',talla:'M',color:'Negro',activo:true,stock_disponible:10,stock_total:10,stock_reservado:0};
 const product={id:1,categoria_id:1,nombre:'Camisa de algodón',precio:100,imagenes:[],marca:'Moda Oriente',descripcion:'Algodón suave',activo:true,genero_objetivo:'UNISEX',calidad_nivel:3,created_at:new Date().toISOString(),tags_ai:[],stock_disponible:10,variantes:[variant]};
 let cart={id:1,estado:'ACTIVO',total_items:0,subtotal:0,items:[]};
 const branch={id:1,nombre:'Centro',direccion:'Calle principal',ciudad:'La Paz',activo:true};
 const bundle={schema_version:1,owner:'1:4',tenant_id:1,user_id:4,tenant_name:'Moda Oriente',version:'test1',downloaded_at:new Date().toISOString(),valid_until:new Date(Date.now()+86400000).toISOString(),products:[{...product,precio:'100.00',variantes:undefined}],variants:[variant],branches:[branch],categories:[{id:1,nombre:'Camisas'}],stock:[{sucursal_id:1,variante_id:7,disponible:10}]};
 await context.addInitScript(({user})=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({sub:'4',tid:1,exp:Math.floor(Date.now()/1000)+3600}))+'.b');},{user});
 await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
 await context.route('**/api/**',async route=>{
  if(!connected)return route.abort('internetdisconnected');
  const ep=new URL(route.request().url()).pathname.split('/api/v1')[1],method=route.request().method();
  if(ep==='/auth/me')return route.fulfill({json:user});
  if(ep==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'moda'},plan:{name:'Básico',features:{offline:true}},subscription:{status:'ACTIVE'}}});
  if(ep==='/offline/bundle')return route.fulfill({json:bundle});
  if(ep==='/cart')return route.fulfill({json:cart});
  if(ep==='/cart/draft'){const items=route.request().postDataJSON().items;cart={...cart,items:items.map(i=>({...i,id:1,producto_id:1,nombre:product.nombre,precio_unitario:100,subtotal:i.cantidad*100,stock_disponible:10,talla:'M',color:'Negro'})),total_items:items.reduce((n,i)=>n+i.cantidad,0),subtotal:items.reduce((n,i)=>n+i.cantidad*100,0)};return route.fulfill({json:cart});}
  if(ep==='/payments/deferred/context')return route.fulfill({json:{owner:'1:4',downloaded_at:bundle.downloaded_at,valid_until:bundle.valid_until,cart,branches:[branch],addresses:[],cards:[{id:1,marca:'visa',ultimos_cuatro:'4242'}],delivery_fee:'25.00'}});
  if(ep==='/payments/deferred'&&method==='GET')return route.fulfill({json:results});
  if(ep==='/payments/deferred'&&method==='POST'){
   const body=route.request().postDataJSON();submitted.push(body);assert.equal(body.items[0].cantidad,1);assert.equal(body.items[0].variante_id,7);assert.equal(body.total_autorizado,'100.00');
   const result={operacion_id:body.operacion_id,estado:'REQUIERE_AUTENTICACION',pedido_id:27,total_autorizado:'100.00',tarjeta_id:1,mensaje:'Tu banco pide verificación.',vence_at:new Date(Date.now()+86400000).toISOString()};results=[result];return route.fulfill({json:result});
  }
  if(ep?.endsWith('/sync'))return route.fulfill({json:results[0]});
  if(ep==='/catalog/products')return route.fulfill({json:[product]});
  if(ep==='/catalog/products/1')return route.fulfill({json:product});
  if(ep==='/catalog/categories')return route.fulfill({json:[{id:1,nombre:'Camisas',slug:'camisas',activo:true}]});
  if(ep==='/catalog/products/1/availability')return route.fulfill({json:[{...variant,sucursal_id:1,stock_disponible:10}]});
  if(ep==='/branches')return route.fulfill({json:[branch]});
  if(ep==='/commerce/config')return route.fulfill({json:{costo_delivery:'25.00'}});
  if(ep==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
  if(ep==='/products/1/reviews'&&method==='POST'){const b=route.request().postDataJSON();own={...b,id:1,producto_id:1,usuario_id:4,usuario_nombre:'Comprador',compra_verificada:true,creado_en:new Date().toISOString()};return route.fulfill({json:own});}
  if(ep==='/products/1/reviews'&&method==='DELETE'){own=null;return route.fulfill({json:{ok:true}});}
  if(ep==='/products/1/reviews')return route.fulfill({json:{producto_id:1,total:own?1:0,promedio:own?.calificacion||0,distribucion:{'5':own?1:0},resenas:own?[own]:[],mi_resena:own}});
  return route.fulfill({json:[]});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/catalog');await page.getByRole('button',{name:'Ver Camisa de algodón',exact:true}).waitFor();
 // Reviews are attached to the actual garment detail.
 await page.getByRole('button',{name:'Ver Camisa de algodón',exact:true}).click();
 await page.getByText('Opiniones de esta prenda',{exact:true}).click();
 await page.getByRole('button',{name:/CALIFICAR PRENDA/}).click();
 await page.locator('app-product-reviews textarea').fill('Excelente tela y talla.');
 await page.getByRole('button',{name:/PUBLICAR RESEÑA/}).click();
 await page.getByRole('button',{name:/EDITAR MI RESEÑA/}).waitFor();
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.locator('app-product-reviews').scrollIntoViewIfNeeded();await page.waitForTimeout(300);assert.ok(await page.evaluate(()=>{const m=document.querySelector('.product-detail-modal');return document.documentElement.scrollWidth<=innerWidth&&m.scrollWidth<=m.clientWidth+1;}));await page.screenshot({path:path.join(out,'reviews-'+width+'.png'),fullPage:true});}
 await page.keyboard.press('Escape');
 // Reload closes detail without reaching into Angular state.
 await page.goto(base+'/catalog');
 await page.setViewportSize({width:1440,height:1000});
 await page.getByRole('button',{name:'Datos de esta tienda',exact:true}).filter({visible:true}).click();
 await page.getByRole('button',{name:'Descargar esta tienda',exact:true}).click();
 await page.getByRole('button',{name:'Actualizar descarga',exact:true}).waitFor();
 await page.getByRole('button',{name:'Cerrar datos de tienda',exact:true}).click();
 await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
 connected=false;await context.setOffline(true);await page.reload();
 await page.getByRole('button',{name:'Ver Camisa de algodón',exact:true}).click();
 await page.getByRole('button',{name:'Añadir a la Bolsa',exact:true}).click();
 if(!await page.getByRole('dialog',{name:'Perchero y Carrito de compras'}).isVisible())await page.getByRole('button',{name:/^Abrir (perchero de compras|carrito)$/}).filter({visible:true}).click();
 await page.getByRole('button',{name:/Continuar al Checkout/}).click();
 await page.getByLabel('Tarjeta de esta compra').waitFor();
 await page.getByRole('checkbox',{name:/Autorizo un único cobro/}).check();
 await page.getByRole('button',{name:/Confirmar compra/}).click();
 await page.getByRole('button',{name:'Ver mis pedidos',exact:true}).click();
 await page.getByText('En espera de conexión',{exact:true}).waitFor();assert.equal(submitted.length,0);
 await page.setViewportSize({width:390,height:1000});
 await page.waitForTimeout(300);
 await page.screenshot({path:path.join(out,'normal-orders-offline-390.png'),fullPage:true});
 await page.reload();await page.getByText('En espera de conexión',{exact:true}).waitFor();
 connected=true;await context.setOffline(false);
 await page.getByText('Tu banco pide verificación',{exact:true}).waitFor({timeout:45000});
 assert.equal(submitted.length,1);assert.ok(submitted[0].operacion_id);assert.ok(!JSON.stringify(submitted[0]).match(/card_number|cvc|pan/i));
 await page.screenshot({path:path.join(out,'normal-orders-reconnected-390.png'),fullPage:true});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({normalCatalogCartCheckoutOrders:true,reviewsInProduct:true,offlineReload:true,automaticReconnect:true,submitted:submitted.length,viewports:[1440,390],pageErrors:errors},null,2));
 console.log('Tienda normal: descarga, catálogo offline, carrito, compra durable, Mis pedidos y recuperación automática verificados; CU30 integrado.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
