// Isolated UI fixtures: never connects to a backend or remote WebSocket.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist/web/browser');
const output = path.resolve(__dirname, '../qa/operations');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  let file = path.resolve(root, '.' + new URL(req.url, 'http://localhost').pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  res.setHeader('Content-Type', ({'.js':'text/javascript','.css':'text/css','.html':'text/html'})[path.extname(file)] || 'application/json');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(14201, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const context = await browser.newContext();
    let fail = false, cancellations = 0;
    const reservations = [{id: 21, codigo_publico:'visual-21', estado:'LISTA', sucursal_id:1, observacion:'Dos prendas para probar en tienda', fecha_reserva:'2026-09-09T10:00:00Z', vence_at:'2026-09-11T10:00:00Z'},
      {id:22,codigo_publico:'visual-22',estado:'EN_PREPARACION',sucursal_id:1,observacion:'Recojo por la tarde',fecha_reserva:'2026-09-09T10:00:00Z',vence_at:'2026-09-11T10:00:00Z'}];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' || url.port !== '14201') return route.abort();
      if (url.pathname === '/config.json') return route.fulfill({json:{backendUrl:'http://127.0.0.1:14201',apiPrefix:'/api/v1'}});
      if (url.pathname === '/api/v1/reservations') return fail ? route.fulfill({status:503,json:{detail:'Fixture unavailable'}}) : route.fulfill({json:reservations});
      if (url.pathname.endsWith('/cancel')) { cancellations++; return route.fulfill({json:{...reservations[0],estado:'CANCELADA'}}); }
      if (url.pathname.startsWith('/api/')) return route.fulfill({json:{items:[],total:0,total_bob:0}});
      return route.continue();
    });
    await context.routeWebSocket('**/*', socket => socket.onMessage(() => socket.send(JSON.stringify({type:'connected'}))));
    await context.addInitScript(() => {
      sessionStorage.setItem('drapemind_access_token','test.' + btoa(JSON.stringify({exp:Math.floor(Date.now()/1000)+3600})) + '.test');
      sessionStorage.setItem('drapemind_user',JSON.stringify({id:1,nombre:'Prueba visual',rol:'CLIENTE',estado:'ACTIVO'}));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({width:1440,height:960});
    await page.goto('http://127.0.0.1:14201/reservations');
    await page.getByText('Lista para recojo',{exact:true}).waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'reservations-desktop.png')});
    await page.getByLabel('Buscar una reserva').fill('22');
    assert.equal(await page.locator('.reservation-row').count(),1);
    await page.getByLabel('Buscar una reserva').fill('');
    await page.getByRole('button',{name:'Cancelar',exact:true}).first().click();
    await page.getByRole('dialog',{name:'¿Liberar estas prendas?'}).waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'cancel-dialog.png')});
    await page.keyboard.press('Escape');
    assert.equal(cancellations,0);
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({animations:'disabled',path:path.join(output,'reservations-narrow.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    fail = true;
    await page.reload();
    await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'reservations-error.png')});
    fail = false;
    await page.getByRole('button',{name:'Reintentar',exact:true}).click();
    await page.getByText('Lista para recojo',{exact:true}).waitFor();
    await context.route('**/api/v1/branches/staff/assigned', route => route.fulfill({json:[{id:1,nombre:'Showroom Centro',ciudad:'La Paz'}]}));
    const product = {id:7,nombre:'Camisa de lino',precio:210,activo:true,variantes:[{id:8,producto_id:7,sku:'LIN-AZ-M',color:'Azul',codigo_color:'#496577',talla:'M',stock_total:5,stock_reservado:1,stock_disponible:4,activo:true}]};
    await context.route('**/api/v1/catalog/products?*', route => route.fulfill({json:[product]}));
    await context.route('**/api/v1/catalog/products/7', route => route.fulfill({json:product}));
    await context.route('**/api/v1/branches/1/availability?*', route => route.fulfill({json:[{variante_id:8,stock_total:5,stock_reservado:1,stock_disponible:4}]}));
    await context.route('**/api/v1/branches/1/movements*', route => route.fulfill({json:[]}));
    await context.addInitScript(() => sessionStorage.setItem('drapemind_user',JSON.stringify({id:1,nombre:'Prueba visual',rol:'ADMIN',estado:'ACTIVO'})));
    await page.setViewportSize({width:1440,height:960});
    await page.goto('http://127.0.0.1:14201/inventory');
    await page.getByText('LIN-AZ-M',{exact:true}).waitFor();
    await page.screenshot({animations:'disabled',path:path.join(output,'inventory-desktop.png')});
    await page.getByRole('button',{name:'Solo stock crítico',exact:true}).click();
    await page.getByText('LIN-AZ-M',{exact:true}).waitFor({state:'hidden'});
    await page.getByRole('button',{name:'Mostrar todas',exact:true}).click();
    await page.getByLabel('Buscar en esta sucursal').fill('azul');
    await page.getByText('LIN-AZ-M',{exact:true}).waitFor();
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({animations:'disabled',path:path.join(output,'inventory-narrow.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: reservations 1440/390, search, cancel dialog Escape, error/retry, no external network');
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode=1; });
