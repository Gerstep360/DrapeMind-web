const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/download-reports');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14209/DrapeMind';
const server=http.createServer((req,res)=>{
 if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
 if(/test-[av]\.svg$/.test(req.url)){res.setHeader('Content-Type','image/svg+xml');return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path fill="#dfff4f" d="M0 0h20v20H0z"/></svg>');}
 const p=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const f=p.startsWith(root+path.sep)&&fs.existsSync(p)&&fs.statSync(p).isFile()?p:path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.webmanifest':'application/manifest+json'})[path.extname(f)]||'application/octet-stream');res.end(fs.readFileSync(f));
});
const report={id:17,titulo:'Balance de la colección',consulta:'¿Cómo van las ventas de este mes?',analisis:'## Ventas y disponibilidad\n\nLas prendas **más vendidas** mantienen su disponibilidad.\n\n| Prenda | Unidades |\n|---|---:|\n| Camisa de algodón | 14 |\n\n<script>window.__reportInjected=true</script>',recomendaciones:['Revisar las tallas de mayor salida.','Reponer las variantes con stock bajo según la demanda.'],datos:{empresa:'Moda Oriente',desde:'2026-11-01',hasta:'2026-11-10',sucursal:'Todas las sucursales',pedidos_pagados:12,ingreso_neto_cobrado:'1250.50',inventario_actual:{unidades_disponibles:84,variantes_con_stock_bajo:3},prendas_vendidas:[{nombre:'Camisa de algodón',cantidad:14},{nombre:'Pantalón de lino',cantidad:8},{nombre:'Chaqueta ligera',cantidad:3}],alcance:'Cobros confirmados del periodo. El inventario corresponde al momento de la consulta.'}};
(async()=>{
 await new Promise(r=>server.listen(14209,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
 const context=await browser.newContext();let failCart=true;const errors=[];let generated=0;
 const user={id:1,tenant_id:1,tenant_slug:'moda',tenant_name:'Moda Oriente',nombre:'Administración',email:'admin@example.com',rol:'ADMIN',estado:'ACTIVO',has_style_profile:true};
 const bundle={schema_version:1,owner:'1:1',tenant_id:1,user_id:1,tenant_name:'Moda Oriente',version:'download-test',downloaded_at:new Date().toISOString(),valid_until:new Date(Date.now()+86400000).toISOString(),products:[{id:1,nombre:'Camisa de algodón',categoria_id:1,precio:'100.00',imagenes:['static/products/test-a.svg','static/products/test-b.svg']}],variants:[{id:7,producto_id:1,talla:'M',color:'Negro',sku:'CAM-M',imagen:'static/products/test-v.svg'}],branches:[{id:1,nombre:'Centro',ciudad:'La Paz'}],categories:[],stock:[{variante_id:7,sucursal_id:1,disponible:10}]};
 await context.addInitScript(user=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({sub:'1',tid:1,exp:Math.floor(Date.now()/1000)+3600}))+'.b');},user);
 await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
 await context.route('**/api/**',route=>{
  const ep=new URL(route.request().url()).pathname.split('/api/v1')[1];
  if(ep==='/auth/me')return route.fulfill({json:user});
  if(ep==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'moda'},plan:{name:'Profesional',features:{offline:true,ai_reports:true}},subscription:{status:'ACTIVE'}}});
  if(ep==='/business-reports'){if(route.request().method()==='POST'){generated++;assert.ok(route.request().postDataJSON().consulta.includes('ventas'));return route.fulfill({status:201,json:report});}return route.fulfill({json:[report]});}
  if(ep==='/business-reports/17/pdf')return route.fulfill({body:fs.readFileSync(path.resolve(__dirname,'../../.deploy/report-sample.pdf')),contentType:'application/pdf'});
  if(ep==='/offline/bundle')return route.fulfill({json:bundle});
  if(ep==='/cart')return failCart?route.fulfill({status:503,json:{detail:'No pudimos guardar el carrito en esta prueba.'}}):route.fulfill({json:{id:1,estado:'ACTIVO',items:[],subtotal:0,total_items:0}});
  if(ep==='/branches')return route.fulfill({json:bundle.branches});
  if(ep==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
  return route.fulfill({json:[]});
 });
 const page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/ai-reports');await page.getByRole('heading',{name:/Reportes de/}).waitFor();
 await page.getByRole('button',{name:/Balance de la colección/}).click();
 assert.equal(await page.locator('.analysis-copy h2').textContent(),'Ventas y disponibilidad');assert.equal(await page.evaluate(()=>window.__reportInjected),undefined);
 assert.equal(await page.locator('.analysis-copy table tbody tr').count(),1);
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.evaluate(()=>window.scrollTo(0,0));await page.waitForTimeout(250);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Report overflow at '+width);await page.screenshot({path:path.join(out,'report-'+width+'.png'),fullPage:true});}
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF ↓',exact:true}).click();const download=await downloadPromise;assert.equal(download.suggestedFilename(),'reporte-17.pdf');await download.saveAs(path.join(out,'report-downloaded.pdf'));
 await page.getByLabel('¿Qué necesitas conocer?',{exact:true}).fill('Revisa las ventas de este mes');await page.getByRole('button',{name:'Generar reporte',exact:true}).click();await page.locator('.report-document').waitFor();assert.equal(generated,1);
 await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Tienda descargada',exact:true}).click();
 const dialog=page.getByRole('dialog',{name:'Tu tienda, contigo.',exact:true});await dialog.waitFor();
 assert.ok(await page.locator('dialog:modal').count(),'Dialog must be in top layer');
 for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(250);const r=await dialog.boundingBox();assert.ok(r.x>=0&&r.y>=0&&r.x+r.width<=width+1&&r.y+r.height<=1001);assert.ok(Math.abs(r.x+r.width/2-width/2)<2);assert.ok(Math.abs(r.y+r.height/2-500)<2);await page.screenshot({path:path.join(out,'download-'+width+'.png')});}
 await dialog.getByRole('button',{name:'Descargar esta tienda',exact:true}).click();await dialog.getByRole('alert').filter({hasText:'No se completó'}).waitFor();assert.equal(await dialog.getByText('Tu tienda está lista en este dispositivo.',{exact:true}).count(),0);
 failCart=false;await dialog.getByRole('button',{name:'Actualizar descarga',exact:true}).click();await dialog.getByText('Tu tienda está lista en este dispositivo.',{exact:true}).waitFor();
 assert.equal(await dialog.locator('.download-steps .done').count(),4);
 await dialog.getByText(/1 fotos no pudieron guardarse/).waitFor();
 const photos=await page.evaluate(async()=>{const key=(await caches.keys()).find(k=>k.startsWith('drapemind-product-images-'));return (await (await caches.open(key)).keys()).map(r=>r.url);});
 assert.equal(photos.length,2);assert.ok(photos.some(url=>url.endsWith('test-v.svg')));assert.ok(!photos.some(url=>url.endsWith('test-b.svg')));
 assert.match(await dialog.getByRole('link',{name:'Seguir en el catálogo',exact:true}).getAttribute('href'),/catalog$/);
 await page.screenshot({path:path.join(out,'download-ready-320.png')});await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await page.getByRole('button',{name:'Tienda descargada',exact:true}).evaluate(el=>el===document.activeElement),true);
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({viewports:[1440,390,320],topLayerAndCentered:true,downloadFailureAndRecovery:true,fourVerifiedStages:true,normalCatalogLink:true,markdownStructured:true,sanitizedHTML:true,pdfDownload:true,pageErrors:errors},null,2));
 console.log('Descarga: diálogo centrado, error real, reintento y 4 etapas; reportes: formato, HTML seguro y PDF verificados a 1440/390/320 px.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
