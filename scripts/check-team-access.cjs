// Isolated role editor and notification UI checks; no production requests or sends.
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../dist/web/browser'),out=path.resolve(__dirname,'../qa/team-access');fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:14203/DrapeMind';
const server=http.createServer((req,res)=>{
  if(req.url==='/DrapeMind/config.json'){res.setHeader('Content-Type','application/json');return res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));}
  const local=path.resolve(root,'.'+new URL(req.url,base).pathname.replace(/^\/DrapeMind/,''));const file=local.startsWith(root+path.sep)&&fs.existsSync(local)&&fs.statSync(local).isFile()?local:path.join(root,'index.html');
  res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml','.json':'application/json'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
(async()=>{
 await new Promise(r=>server.listen(14203,'127.0.0.1',r));const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext();const errors=[];let savedRole,savedAccess,sentNotice;
  const permissions=[['catalog.read','Catálogo','Consultar prendas y disponibilidad'],['catalog.manage','Catálogo','Crear y editar prendas, variantes y categorías'],['sales.manage','Caja','Registrar ventas de contado'],['inventory.manage','Inventario','Registrar y ajustar existencias']].map(([key,group,label])=>({key,group,label,delegable:true}));
  let roles=[{id:1,nombre:'Asesor de colección',descripcion:'Cuida las prendas',base_role:'VENDEDOR',permisos:['catalog.read','catalog.manage'],activo:true}];
  const user={id:1,tenant_id:1,tenant_slug:'moda-oriente',tenant_name:'Moda Oriente',nombre:'Administración',email:'admin@example.com',rol:'ADMIN',estado:'ACTIVO',has_style_profile:true,created_at:'2026-11-01'};
  const staff={...user,id:4,nombre:'Claudia Mendoza',email:'claudia@example.com',rol:'CAJERO'};
  await context.addInitScript(({user})=>{localStorage.setItem('drapemind_user',JSON.stringify(user));localStorage.setItem('drapemind_access_token','a.'+btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600,sub:'1',tid:1}))+'.b');},{user});
  await context.routeWebSocket('**',ws=>ws.onMessage(()=>{}));
  await context.route('**/api/**',route=>{
   const e=new URL(route.request().url()).pathname.split('/api/v1')[1],method=route.request().method();
   if(e==='/team/catalog')return route.fulfill({json:{permissions,defaults:{CAJERO:['catalog.read','sales.manage'],VENDEDOR:['catalog.read','catalog.manage']}}});
   if(e==='/team/roles'&&method==='GET')return route.fulfill({json:roles});
   if(e==='/team/roles'&&method==='POST'){savedRole=route.request().postDataJSON();roles.push({...savedRole,id:2});return route.fulfill({status:201,json:roles[1]});}
   if(e==='/team/users/4/access'&&method==='GET')return route.fulfill({json:{base_role:'CAJERO',role:null,overrides:{}}});
   if(e==='/team/users/4/access'){savedAccess=route.request().postDataJSON();return route.fulfill({json:savedAccess});}
   if(e==='/notifications/send'){sentNotice=route.request().postDataJSON();return route.fulfill({status:201,json:{id:7,delivery:{sent:1,failed:0,devices:1}}});}
   if(e==='/admin/users')return route.fulfill({json:[user,staff]});
   if(e==='/auth/me')return route.fulfill({json:user});
   if(e==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'moda-oriente'},plan:{name:'Profesional',features:{ai_reports:true}},subscription:{status:'ACTIVE'}}});
   if(e==='/notifications')return route.fulfill({json:{items:[],unread_count:0}});
   if(e==='/cart')return route.fulfill({json:{items:[],total_items:0,subtotal:0}});
   return route.fulfill({json:[]});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  for(const width of [1440,390]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/users-admin');await page.getByRole('heading',{name:'Tu equipo y tus clientes'}).waitFor();
   await page.getByRole('button',{name:'Crear rol',exact:true}).click();const dialog=page.getByRole('dialog',{name:'Crear rol',exact:true});await dialog.waitFor();
   await dialog.getByLabel('Nombre del rol').fill('Caja de fin de semana');await dialog.getByLabel('Registrar y ajustar existencias',{exact:true}).check();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'role-'+width+'.png'),fullPage:true});
   await dialog.getByRole('button',{name:'Guardar permisos'}).click();await dialog.waitFor({state:'hidden'});assert.ok(savedRole.permisos.includes('inventory.manage'));
   await page.getByRole('row').filter({hasText:'Claudia Mendoza'}).getByRole('button',{name:'Permisos',exact:true}).click();
   const access=page.getByRole('dialog',{name:'Claudia Mendoza',exact:true});await access.waitFor();await access.getByLabel('Registrar ventas de contado',{exact:true}).selectOption('deny');
   await page.screenshot({path:path.join(out,'user-access-'+width+'.png'),fullPage:true});await access.getByRole('button',{name:'Guardar permisos'}).click();await access.waitFor({state:'hidden'});assert.equal(savedAccess.permisos['sales.manage'],false);
  }
  await page.getByRole('row').filter({hasText:'Claudia Mendoza'}).getByRole('button',{name:'Enviar aviso',exact:true}).click();const notice=page.getByRole('dialog',{name:'Avisar a Claudia Mendoza'});
  await notice.getByLabel('Asunto',{exact:true}).fill('Tu pedido está listo');await notice.getByLabel('Mensaje',{exact:true}).fill('Puedes recogerlo en la sucursal Centro.');await notice.getByRole('button',{name:'Enviar aviso',exact:true}).click();await notice.waitFor({state:'hidden'});assert.equal(sentNotice.usuario_id,4);
  assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({viewports:[1440,390],roleCreation:true,individualDeny:true,storeNotice:true,errors},null,2));console.log('Roles, excepciones y avisos verificados en 1440 y 390 px.');
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
