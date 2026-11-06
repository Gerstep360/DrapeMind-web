// Isolated browser fixtures. No credentials, charges or production requests.
const { chromium } = require('playwright');
const http = require('node:http'),
  fs = require('node:fs'),
  path = require('node:path'),
  assert = require('node:assert/strict');
const prefix = process.env.QA_BASE_PATH || '';
assert.ok(prefix === '' || prefix === '/DrapeMind', 'Supported QA base paths: / and /DrapeMind/');
const base = 'http://127.0.0.1:14202' + prefix;
const root = path.resolve(__dirname, '../dist/web/browser'),
  out = path.resolve(__dirname, '../qa/incremento-iv', prefix ? 'vps-path' : '.');
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === prefix + '/config.json') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ backendUrl: base, apiPrefix: '/api/v1' }));
    return;
  }
  const local = path.resolve(root, '.' + pathname.slice(prefix.length));
  const file =
    local.startsWith(root + path.sep) && fs.existsSync(local) && fs.statSync(local).isFile()
      ? local
      : path.join(root, 'index.html');
  res.setHeader(
    'Content-Type',
    {
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon',
      '.webmanifest': 'application/manifest+json',
    }[path.extname(file)] || 'application/json',
  );
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise((r) => server.listen(14202, '127.0.0.1', r));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  const errors = [];
  try {
    const context=await browser.newContext({acceptDownloads:true});
    const report={id:1,titulo:'Balance de la tienda',analisis:'Cobros confirmados e inventario actual.',recomendaciones:['Revisar disponibilidad de tallas.'],datos:{empresa:'Moda Oriente',sucursal:'Todas las sucursales',desde:'2026-11-01',hasta:'2026-11-06',ingreso_neto_cobrado:'200.00',pedidos_pagados:2,inventario_actual:{unidades_disponibles:8},prendas_vendidas:[],alcance:'Inventario actual; ingresos netos del periodo.'}};
    let input,fail=false;
    await context.route('**/api/**',route=>{
      const e=new URL(route.request().url()).pathname.split('/api/v1')[1];
      if(e==='/business-reports'&&route.request().method()==='POST'){input=route.request().postDataJSON();return fail?route.fulfill({status:503,json:{detail:'NVIDIA no pudo generar el an?lisis'}}):route.fulfill({status:201,json:report});}
      if(e==='/business-reports')return route.fulfill({json:[]});
      if(e==='/business-reports/1/xlsx')return route.fulfill({contentType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',body:'PK test'});
      if(e==='/business-reports/1/pdf')return route.fulfill({contentType:'application/pdf',body:'%PDF-1.4 test'});
      if(e==='/saas/me')return route.fulfill({json:{access_active:true,tenant:{name:'Moda Oriente',slug:'a'},plan:{name:'Profesional',features:{ai_reports:true}},subscription:{status:'ACTIVE'}}});
      if(e==='/cart')return route.fulfill({json:{id:1,items:[],total_items:0,subtotal:0}});
      if(e==='/business-dashboard')return route.fulfill({json:report.datos});
      if(e==='/business-predictions')return route.fulfill({json:{estado:'DATOS_INSUFICIENTES',motivo:'Se necesitan al menos 42 días de historial y 20 pedidos pagados.',observaciones:3,pedidos_observados:2,predicciones:[]}});
      if(e==='/branches')return route.fulfill({json:[]});
      return route.fulfill({json:[]});
    });
    await context.routeWebSocket('**/*',socket=>socket.onMessage(()=>{}));
    await context.addInitScript(()=>{
      const claims={sub:'4',tid:1,platform:false,exp:Math.floor(Date.now()/1000)+3600};
      localStorage.setItem('drapemind_access_token','test.'+btoa(JSON.stringify(claims))+'.test');localStorage.setItem('drapemind_company','a');
      localStorage.setItem('drapemind_user',JSON.stringify({id:4,tenant_id:1,tenant_slug:'a',tenant_name:'Moda Oriente',nombre:'Administraci?n',email:'qa@example.com',rol:'ADMIN',estado:'ACTIVO',has_style_profile:true}));
      window.SpeechRecognition=class {start(){this.onresult({results:[[{transcript:'Revisa las ventas de hoy'}]]});this.onend?.();}stop(){}abort(){}};
    });
    const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});await page.goto(base+'/ai-reports');
      await page.getByRole('button',{name:'Dictar consulta',exact:true}).click();
      await page.getByRole('button',{name:'Generar reporte',exact:true}).click();
      await page.getByRole('heading',{name:'Balance de la tienda',exact:true}).waitFor();assert.equal(input.entrada,'VOZ');
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar PDF',exact:true}).click();assert.equal((await download).suggestedFilename(),'reporte-1.pdf');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(out,'reports-'+width+'.png'),fullPage:true});
    }
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:1000});await page.goto(base+'/business-insights');
      await page.getByRole('heading',{name:'Indicadores y tendencias',exact:true}).waitFor();
      await page.getByText('Bs 200.00',{exact:true}).waitFor();
      await page.getByRole('button',{name:'Consultar predicción',exact:true}).click();
      await page.getByRole('status').filter({hasText:'Se necesitan'}).waitFor();
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(out,'insights-'+width+'.png'),fullPage:true});
    }
    await page.goto(base+'/ai-reports');await page.getByRole('button',{name:'Disponibilidad actual',exact:true}).click();await page.getByRole('button',{name:'Generar reporte',exact:true}).click();await page.getByRole('heading',{name:'Balance de la tienda',exact:true}).waitFor();
    const excel=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar Excel',exact:true}).click();assert.equal((await excel).suggestedFilename(),'reporte-1.xlsx');
    fail=true;await page.getByRole('button',{name:'Generar reporte',exact:true}).click();await page.getByRole('alert').filter({hasText:'NVIDIA'}).waitFor();
    assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({responsive:[1440,390],voice:true,pdf:true,providerError:true,pageErrors:errors},null,2));
    console.log('Incremento III: responsive, dictado, PDF y error NVIDIA verificados.');
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
