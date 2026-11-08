const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/segundo-parcial');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14205/DrapeMind';
const server=http.createServer((req,res)=>{
 if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
 const p=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const file=p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()?p:path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(14205,'127.0.0.1',r));
 const audio=path.join(require('node:os').tmpdir(),'drapemind-voice-qa.wav');
 const pcm=Buffer.alloc(44+16000*2*2);pcm.write('RIFF');pcm.writeUInt32LE(pcm.length-8,4);pcm.write('WAVEfmt ',8);pcm.writeUInt32LE(16,16);pcm.writeUInt16LE(1,20);pcm.writeUInt16LE(1,22);pcm.writeUInt32LE(16000,24);pcm.writeUInt32LE(32000,28);pcm.writeUInt16LE(2,32);pcm.writeUInt16LE(16,34);pcm.write('data',36);pcm.writeUInt32LE(pcm.length-44,40);
 for(let i=0;i<32000;i++)pcm.writeInt16LE(Math.round(Math.sin(i*2*Math.PI*440/16000)*5000),44+i*2);fs.writeFileSync(audio,pcm);
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture='+audio]});
 try{
  const context=await browser.newContext({permissions:['microphone']});const errors=[],voices=[];let orders=0,reports=0;
  const user={id:4,tenant_id:1,tenant_slug:'moda',tenant_name:'Moda Oriente',nombre:'Administración',email:'admin@example.com',rol:'ADMIN',estado:'ACTIVO',has_style_profile:true};
  const cart={id:1,estado:'ACTIVO',total_items:2,subtotal:200,items:[{id:1,variante_id:7,producto_id:1,nombre:'Camisa de algodón',talla:'M',color:'Negro',cantidad:2,precio_unitario:100,subtotal:200}]};
  await context.addInitScript(({user})=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({sub:'4',tid:1,exp:Math.floor(Date.now()/1000)+3600}))+'.b');},{user});
  await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
  await context.route('**/api/**',async route=>{
   const ep=new URL(route.request().url()).pathname.split('/api/v1')[1],method=route.request().method();
   if(ep==='/voice/transcribe'){
    const body=route.request().postDataJSON();voices.push(body.proposito);
    const wav=Buffer.from(body.audio_wav,'base64');assert.equal(wav.subarray(0,4).toString(),'RIFF');assert.equal(wav.readUInt32LE(24),16000);assert.ok(wav.length>6444);
    return route.fulfill({json:{texto:'Consulta las ventas de este mes',proveedor:'NVIDIA',idioma:'auto',requiere_revision:true}});
   }
   if(ep==='/business-reports'&&method==='POST'){reports++;return route.fulfill({status:503,json:{detail:'Prueba sin generar consultas reales'}});}
   if(ep==='/orders/checkout'&&method==='POST'){orders++;return route.fulfill({status:409,json:{detail:'El stock de esta sucursal cambió. Actualiza la disponibilidad.'}});}
   if(ep==='/orders/checkout-options')return route.fulfill({json:{carrito_id:1,vacio:false,compra_pendiente:null,sucursales:[{id:1,nombre:'Centro',disponible:true,faltantes:[]},{id:2,nombre:'Norte',disponible:false,faltantes:[{variante_id:7,solicitado:2,disponible:0}]}]}});
   if(ep==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'moda'},plan:{name:'Profesional',features:{offline:true,ai_reports:true}},subscription:{status:'ACTIVE'}}});
   if(ep==='/auth/me')return route.fulfill({json:user});
   if(ep==='/cart')return route.fulfill({json:cart});
   if(ep==='/branches')return route.fulfill({json:[{id:1,nombre:'Centro',direccion:'Calle principal'}]});
   if(ep==='/commerce/config')return route.fulfill({json:{costo_delivery:'25.00'}});
   if(ep==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
   if(ep==='/team/me')return route.fulfill({json:{permissions:['reports.ai','catalog.read','cart.write','orders.read']}});
   return route.fulfill({json:[]});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/ai-reports');await page.getByRole('heading',{name:'Reportes de tu negocio'}).waitFor();
  await page.getByRole('button',{name:'Dictar consulta',exact:true}).click();
  await page.getByRole('button',{name:/Terminar grabación/}).waitFor();await page.waitForTimeout(900);
  await page.getByRole('button',{name:/Terminar grabación/}).click();await page.getByRole('textbox',{name:'¿Qué necesitas conocer?'}).filter({visible:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('textarea[name=query]')?.value.includes('ventas de este mes'));
  assert.equal(reports,0,'Dictation must not automatically generate a report');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'reporte-voz-'+width+'.png'),fullPage:true});}
  await page.goto(base+'/ai-studio');await page.getByRole('textbox',{name:'Mensaje para Altair'}).waitFor();
  await page.getByRole('button',{name:'Dictar mensaje',exact:true}).click();await page.getByRole('button',{name:'Detener dictado',exact:true}).waitFor();await page.waitForTimeout(900);await page.getByRole('button',{name:'Detener dictado',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('textarea[aria-label="Mensaje para Altair"]')?.value.includes('ventas de este mes'));
  await page.screenshot({path:path.join(out,'altair-voz-390.png'),fullPage:true});
  await page.getByRole('button',{name:'Abrir perchero de compras',exact:true}).click();
  await page.getByRole('button',{name:/Continuar al Checkout/}).click();
  await page.getByText('Tarjeta con Stripe',{exact:true}).waitFor();
  assert.ok(await page.locator('#pickup-branch option').filter({hasText:'Norte'}).isDisabled());
  assert.equal(await page.getByText('Pago QR',{exact:true}).count(),0);
  await page.getByRole('button',{name:/Confirmar Pedido/}).click();await page.getByRole('alert').filter({hasText:'El stock de esta sucursal cambió'}).first().waitFor();
  assert.equal(orders,1);await page.getByRole('button',{name:'Actualizar disponibilidad',exact:true}).click();assert.equal(orders,1,'Refreshing stock must not create another order');
  for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.screenshot({path:path.join(out,'checkout-'+width+'.png'),fullPage:true});}
  assert.deepEqual(voices,['REPORTE','ALTAIR']);assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({voicePurposes:voices,reviewBeforeRequest:true,checkoutRequests:orders,availabilityRefreshReadOnly:true,stripeOnly:true,pageErrors:errors,viewports:[1440,390]},null,2));
  console.log('Voz web en reportes y Altair, revisión de texto, sucursal sin stock, Stripe y conflicto de checkout verificados.');
 }finally{await browser.close();server.close();fs.unlinkSync(audio);}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
