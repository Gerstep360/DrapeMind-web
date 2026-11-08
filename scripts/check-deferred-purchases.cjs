const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/deferred-purchases');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14204/DrapeMind';
const server=http.createServer((req,res)=>{
 if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
 const filePath=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const file=filePath.startsWith(root+path.sep)&&fs.existsSync(filePath)&&fs.statSync(filePath).isFile()?filePath:path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(14204,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();const errors=[];let connected=true;let submitted=[];let results=[];
  const user={id:4,tenant_id:1,tenant_slug:'moda',tenant_name:'Moda Oriente',nombre:'Comprador',email:'buyer@example.com',rol:'CLIENTE',estado:'ACTIVO',has_style_profile:true};
  const cart={id:1,estado:'ACTIVO',total_items:2,subtotal:200,items:[{id:1,variante_id:7,producto_id:1,nombre:'Camisa de algodón',talla:'M',color:'Negro',cantidad:2,precio_unitario:100,subtotal:200}]};
  const data={owner:'1:4',downloaded_at:new Date().toISOString(),valid_until:new Date(Date.now()+86400000*7).toISOString(),cart,cards:[{id:1,marca:'visa',ultimos_cuatro:'4242',mes_vencimiento:12,anio_vencimiento:2032}],branches:[{id:1,nombre:'Centro',direccion:'Calle principal'}],addresses:[],delivery_fee:'25.00'};
  await context.addInitScript(({user})=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({sub:'4',tid:1,exp:Math.floor(Date.now()/1000)+3600}))+'.b');},{user});
  await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
  await context.route('**/api/**',route=>{
   if(!connected)return route.abort('internetdisconnected');
   const endpoint=new URL(route.request().url()).pathname.split('/api/v1')[1];
   if(endpoint==='/payments/deferred/context')return route.fulfill({json:data});
   if(endpoint==='/payments/deferred'&&route.request().method()==='GET')return route.fulfill({json:results});
   if(endpoint==='/payments/deferred'&&route.request().method()==='POST'){
    const body=route.request().postDataJSON();submitted.push(body);assert.ok(!JSON.stringify(body).includes('card_number'));assert.ok(!JSON.stringify(body).includes('cvc'));
    const result={operacion_id:body.operacion_id,estado:'REQUIERE_AUTENTICACION',pedido_id:27,total_autorizado:'200.00',tarjeta_id:body.tarjeta_id,mensaje:'Tu banco solicita verificación. Continúa con conexión para autorizar el pago.',vence_at:new Date(Date.now()+86400000).toISOString()};results=[result];return route.fulfill({status:201,json:result});
   }
   if(endpoint?.endsWith('/sync'))return route.fulfill({json:results[0]});
   if(endpoint==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'moda'},plan:{name:'Básico',features:{offline:true}},subscription:{status:'ACTIVE'}}});
   if(endpoint==='/auth/me')return route.fulfill({json:user});
   if(endpoint==='/cart')return route.fulfill({json:cart});
   if(endpoint==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
   return route.fulfill({json:[]});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/pending-purchases');await page.getByRole('heading',{name:'Prendas de tu carrito',exact:true}).waitFor();
  await page.getByText('Camisa de algodón',{exact:true}).waitFor();
  await page.getByLabel('Sucursal').selectOption({label:'Centro'});
  await page.getByLabel('Tarjeta para esta compra').selectOption({label:'VISA ···· 4242'});
  await page.getByRole('checkbox',{name:/Autorizo un único cobro/}).check();
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  connected=false;await context.setOffline(true);
  await page.getByRole('button',{name:'Guardar compra pendiente',exact:true}).click();
  await page.getByText('En espera de conexión',{exact:true}).waitFor();assert.equal(submitted.length,0);
  const stored=await page.evaluate(()=>new Promise((resolve,reject)=>{const q=indexedDB.open('drapemind-checkout',1);q.onsuccess=()=>{const r=q.result.transaction('purchases').objectStore('purchases').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);};}));
  assert.equal(stored.length,1);assert.equal(stored[0].body.total_autorizado,'200.00');assert.equal(stored[0].body.tarjeta_id,1);
  const operation=stored[0].operation;
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'offline-'+width+'.png'),fullPage:true});}
  await page.reload();await page.getByText('En espera de conexión',{exact:true}).waitFor();assert.equal(submitted.length,0);
  connected=true;await context.setOffline(false);await page.getByRole('button',{name:'Sincronizar',exact:true}).click();
  await page.getByText('Tu banco pide verificación',{exact:true}).waitFor();assert.equal(submitted.length,1);assert.equal(submitted[0].operacion_id,operation);
  await page.screenshot({path:path.join(out,'bank-verification-390.png'),fullPage:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({viewports:[1440,390],offlinePersistence:true,offlineReload:true,stableOperation:operation,submissions:submitted.length,noCardNumbers:true,pageErrors:errors},null,2));console.log('Compra guardada offline, recarga PWA y sincronización con un único identificador verificadas.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
