// Render the real Angular build with isolated fixtures; never sends a bank operation.
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/saas-payments-bulk');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14212/DrapeMind';
const server=http.createServer((req,res)=>{
 if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
 const local=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const file=local.startsWith(root+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile()?local:path.join(root,'index.html');
 res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
const plan={id:1,name:'Profesional',code:'PRO',active:true,max_branches:10,features:{products_sales:true,offline:true,reports:true,ai_reports:true},currency:'bob',monthly_amount_minor:19900,annual_amount_minor:199000};
const company={tenant:{id:1,name:'Moda Oriente',slug:'moda-oriente',active:true},plan,subscription:{status:'ACTIVE',source:'STRIPE'},access_active:true};
const invoice={id:'in_fixture',tenant_id:1,company:'Moda Oriente',admin:'Ana Mendoza',email:'admin@example.com',number:'DM-2026-11',plan:'Profesional',status:'paid',currency:'BOB',amount_due:199,amount_paid:199,amount_remaining:0,attempts:1,livemode:false,issued_at:'2026-11-10T12:00:00Z',paid_at:'2026-11-10T12:01:00Z',pdf_url:'https://pay.stripe.com/invoice/fixture/pdf'};
const report={items:[invoice],total:1,companies:1,last_synced_at:'2026-11-10T13:00:00Z',stripe_configured:true,stripe_mode:'test',summary:[{currency:'BOB',livemode:false,paid_amount_minor:19900,pending_amount_minor:0,paid_count:1,pending_count:0}],monthly:[{month:'2026-11',currency:'BOB',livemode:false,amount_minor:19900}]};
(async()=>{await new Promise(r=>server.listen(14212,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const errors=[];let saved,quoted=0;
  async function contextFor(platform){
   const context=await browser.newContext();const user={id:platform?3:1,tenant_id:platform?null:1,is_platform_admin:platform,nombre:'Administración',email:'admin@example.com',rol:'ADMIN',estado:'ACTIVO',has_style_profile:true};
   await context.addInitScript(user=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({sub:String(user.id),tid:user.tenant_id,platform:user.is_platform_admin,exp:Math.floor(Date.now()/1000)+3600}))+'.b');},user);
   await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
   await context.route('**/api/**',route=>{
    const request=route.request(),ep=new URL(request.url()).pathname.split('/api/v1')[1],method=request.method();
    if(ep==='/auth/me')return route.fulfill({json:user});
    if(ep==='/saas/tenants')return route.fulfill({json:[company]});
    if(ep==='/saas/plans')return route.fulfill({json:[plan]});
    if(ep==='/saas/me')return route.fulfill({json:company});
    if(ep==='/saas/billing')return route.fulfill({json:report});
    if(ep==='/saas/billing/sync')return route.fulfill({json:{imported:1,next_cursor:null}});
    if(ep==='/saas/billing/export')return route.fulfill({body:Buffer.from('%PDF-1.4 fixture'),contentType:'application/pdf'});
    if(ep==='/admin/promotions'&&method==='POST'){saved=request.postDataJSON();return route.fulfill({status:201,json:{...saved,id:1,usos_actuales:0,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}});}
    if(ep==='/admin/promotions')return route.fulfill({json:[]});
    if(ep==='/catalog/promotions/quote'){quoted++;return route.fulfill({json:{valido:true,codigo:'MAYOR3',tipo_descuento:'POR_CANTIDAD',descuento_calculado:60,automatico:true,mensaje:'Compra por mayor: 20% desde 3 prendas.'}});}
    if(ep==='/catalog/promotions')return route.fulfill({json:[]});
    if(ep==='/cart')return route.fulfill({json:{id:1,estado:'ACTIVO',subtotal:300,total_items:3,items:[{id:1,variante_id:1,producto_id:1,nombre:'Camisa de algodón',sku:'CAM-M',color:'Negro',talla:'M',cantidad:3,precio_unitario:100,subtotal:300,stock_disponible:10,imagen:null}]}});
    if(ep==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
    return route.fulfill({json:[]});
   });return context;
  }
  const platform=await contextFor(true),page=await platform.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/saas-platform');await page.getByRole('button',{name:'Pagos y reportes',exact:true}).click();await page.getByRole('heading',{name:'Pagos y facturación',exact:true}).waitFor();
  for(const width of [1440,390,320]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(150);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Billing overflow '+width);await page.screenshot({path:path.join(out,'billing-'+width+'.png'),fullPage:true});}
  await page.setViewportSize({width:1440,height:1000});await page.getByRole('button',{name:'Actualizar desde Stripe',exact:true}).click();await page.getByText(/Historial actualizado desde Stripe/).waitFor();
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();assert.equal((await downloading).suggestedFilename(),'pagos-saas.pdf');
  const tenant=await contextFor(false),adminPage=await tenant.newPage();adminPage.on('pageerror',e=>errors.push(e.message));await adminPage.goto(base+'/promotions-admin');await adminPage.getByRole('button',{name:/Nueva Promoción/i}).click();
  await adminPage.locator('[formControlName="tipo_descuento"]').selectOption('POR_CANTIDAD');await adminPage.locator('[formControlName="cantidad_minima"]').fill('3');await adminPage.locator('[formControlName="valor_descuento"]').fill('20');
  for(const width of [1440,390]){await adminPage.setViewportSize({width,height:1000});await adminPage.waitForTimeout(150);assert.ok(await adminPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Promotion overflow '+width);await adminPage.screenshot({path:path.join(out,'bulk-'+width+'.png'),fullPage:true});}
  const submit=adminPage.locator('button[type="submit"]');await submit.click();await adminPage.waitForTimeout(250);assert.equal(saved.cantidad_minima,3);assert.equal(saved.tipo_descuento,'POR_CANTIDAD');
  // Open the ordinary cart and check that automatic pricing is shown without typing a coupon.
  await adminPage.setViewportSize({width:1440,height:1000});await adminPage.goto(base+'/catalog');await adminPage.waitForTimeout(400);
  await adminPage.getByRole('button',{name:'Abrir perchero de compras',exact:true}).click();
  await adminPage.getByText('DESCUENTO POR MAYOR',{exact:true}).waitFor({timeout:5000}).catch(async e=>{fs.writeFileSync(path.join(out,'debug-cart.json'),JSON.stringify({quoted,errors,text:await adminPage.locator('body').innerText()},null,2));await adminPage.screenshot({path:path.join(out,'debug-cart.png'),fullPage:true});throw e;});assert.ok(quoted>0);
  await adminPage.waitForTimeout(450);const drawer=await adminPage.locator('.cart-drawer').boundingBox();assert.ok(drawer.x>=0&&drawer.x+drawer.width<=1441,'Cart drawer must fit the viewport');await adminPage.screenshot({path:path.join(out,'bulk-cart.png'),fullPage:true});
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({billing:[1440,390,320],bulk:[1440,390],automaticCart:true,export:true,errors},null,2));console.log('Panel SaaS y promoción por cantidad renderizados, sin desbordamientos ni errores.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
