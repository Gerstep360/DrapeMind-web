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
  out = path.resolve(__dirname, '../qa/incremento-ii', prefix ? 'vps-path' : '.');
fs.mkdirSync(out, { recursive: true });
const now = new Date(),
  expiry = new Date(Date.now() + 86400000).toISOString();
const product = {
  id: 1,
  nombre: 'Camisa de algodón',
  descripcion: 'Corte cómodo para todos los días',
  categoria_id: 1,
  precio: '175.00',
  imagenes: [],
};
const snapshot = {
  schema_version: 1,
  owner: '1:4',
  tenant_id: 1,
  user_id: 4,
  tenant_name: 'Moda Oriente',
  version: 'qa-version',
  downloaded_at: now.toISOString(),
  valid_until: expiry,
  products: [product],
  variants: [{ id: 1, producto_id: 1, sku: 'CAM-M', talla: 'M', color: 'Negro' }],
  branches: [{ id: 1, nombre: 'Centro', ciudad: 'La Paz', direccion: 'Av. Principal' }],
  categories: [{ id: 1, nombre: 'Camisas' }],
  stock: [{ sucursal_id: 1, variante_id: 1, disponible: 10 }],
};
const supplier = {
  id: 1,
  nombre_empresa: 'Confecciones Andinas',
  nit: '123456',
  contacto_nombre: 'Ana',
  telefono: '70000000',
  email: 'ventas@example.com',
  ciudad: 'La Paz',
  activo: true,
  usuario_id: 7,
};
const offer = {
  id: 1,
  nombre_suministro: 'Camisas de algodón',
  categoria: 'Prendas',
  unidad_medida: 'Unidades',
  costo_unitario: 65,
  cantidad_disponible: 20,
  tiempo_entrega_dias: 3,
  estado: 'DISPONIBLE',
  activo: true,
};
const orders = [
  {
    id: 21,
    proveedor_id: 1,
    proveedor: supplier.nombre_empresa,
    sucursal: 'Centro',
    estado: 'CONFIRMADO',
    total: '325.00',
    created_at: now.toISOString(),
    items: [{ nombre: offer.nombre_suministro, cantidad: 5 }],
  },
];
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname === prefix + '/config.json') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({backendUrl:base,apiPrefix:'/api/v1'}));
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
  let calls = 0;
  const receipts = new Map();
  let loseResponse = true;
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' || url.port !== '14202') return route.abort();
      if (url.pathname === prefix + '/config.json')
        return route.fulfill({
          json: { backendUrl: base, apiPrefix: '/api/v1' },
        });
      if (!url.pathname.startsWith(prefix + '/api/')) return route.continue();
      const endpoint = url.pathname.replace(prefix + '/api/v1', '');
      if (endpoint === '/offline/bundle') return route.fulfill({ json: snapshot });
      if (endpoint === '/offline/reservations') {
        calls++;
        const body = route.request().postDataJSON();
        if (!receipts.has(body.operacion_id))
          receipts.set(body.operacion_id, {
            id: 31,
            codigo_publico: 'a1234567-1111-4222-8333-123456789012',
            estado: 'PENDIENTE',
            vence_at: expiry,
            sucursal_id: 1,
          });
        if (loseResponse) {
          loseResponse = false;
          return route.abort('connectionreset');
        }
        return route.fulfill({
          json: { reservation: receipts.get(body.operacion_id), status: 'CONFIRMED' },
        });
      }
      if (endpoint === '/saas/me')
        return route.fulfill({
          json: {
            access_active: true,
            tenant: { name: 'Moda Oriente', slug: 'a' },
            plan: { name: 'Profesional', features: { offline: true } },
            subscription: { status: 'ACTIVE', ends_at: expiry },
            active_branches: 1,
          },
        });
      if (endpoint === '/supply/suppliers') return route.fulfill({ json: [supplier] });
      if (endpoint === '/supply/suppliers/1/offers') return route.fulfill({ json: [offer] });
      if (endpoint === '/supply/orders') return route.fulfill({ json: orders });
      if (endpoint === '/supply/destinations')
        return route.fulfill({
          json: {
            branches: [{ id: 1, nombre: 'Centro' }],
            variants: [{ id: 1, nombre: 'Camisa de algodón · M · Negro' }],
          },
        });
      if (endpoint === '/cart')
        return route.fulfill({ json: { id: 1, items: [], total_items: 0, subtotal: 0 } });
      if (
        endpoint === '/branches' ||
        endpoint.includes('notifications') ||
        endpoint.includes('favorites')
      )
        return route.fulfill({ json: [] });
      return route.fulfill({ json: { items: [], total: 0 } });
    });
    await context.routeWebSocket('**/*', (socket) =>
      socket.onMessage(() => socket.send(JSON.stringify({ type: 'connected' }))),
    );
    await context.addInitScript(() => {
      if (localStorage.getItem('qa-initialized')) return;
      const token =
        'test.' +
        btoa(
          JSON.stringify({
            sub: '4',
            tid: 1,
            platform: false,
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        ) +
        '.test';
      localStorage.setItem('drapemind_access_token', token);
      localStorage.setItem('drapemind_company', 'a');
      localStorage.setItem(
        'drapemind_user',
        JSON.stringify({
          id: 4,
          tenant_id: 1,
          tenant_slug: 'a',
          tenant_name: 'Moda Oriente',
          nombre: 'Cliente de prueba',
          email: 'qa@example.com',
          rol: 'CLIENTE',
          estado: 'ACTIVO',
          has_style_profile: true,
        }),
      );
      localStorage.setItem('qa-initialized', 'true');
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/offline');
    await page.getByRole('button', { name: 'Guardar catálogo', exact: true }).click();
    await page.getByRole('heading', { name: 'Camisa de algodón', exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, 'offline-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('heading', { name: 'Camisa de algodón', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Elegir y reservar' }).click();
    await page.getByRole('spinbutton', { name: 'Cantidad' }).fill('2');
    await page.getByRole('button', { name: 'Guardar solicitud', exact: true }).click();
    await page.getByText('Guardada en el dispositivo', { exact: true }).waitFor();
    assert.equal(calls, 0);
    assert.equal(await page.getByRole('link', { name: 'Ver reserva y QR' }).count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(out, 'offline-narrow.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Horizontal overflow at 390px',
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Guardada en el dispositivo', { exact: true }).waitFor();
    await context.setOffline(false);
    await page.getByText('Por comprobar al conectar', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Enviar pendientes', exact: true }).click();
    await page.getByText('Recibida por la tienda', { exact: true }).waitFor();
    assert.equal(receipts.size, 1);
    assert.equal(calls, 2);
    await page.screenshot({
      path: path.join(out, 'offline-confirmed.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('drapemind_user'));
      user.id = 9;
      user.tenant_id = 2;
      user.tenant_name = 'Otra tienda';
      localStorage.setItem('drapemind_user', JSON.stringify(user));
      localStorage.setItem('drapemind_company', 'b');
      localStorage.setItem(
        'drapemind_access_token',
        'test.' +
          btoa(
            JSON.stringify({
              sub: '9',
              tid: 2,
              platform: false,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ) +
          '.test',
      );
    });
    await page.reload();
    await page.getByRole('button', { name: 'Guardar catálogo', exact: true }).waitFor();
    assert.equal(await page.locator('.offline-product').count(), 0);
    assert.equal(await page.locator('.request-row').count(), 0);
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem('drapemind_user'));
      user.id = 1;
      user.tenant_id = 1;
      user.rol = 'ADMIN';
      localStorage.setItem('drapemind_user', JSON.stringify(user));
      localStorage.setItem('drapemind_company', 'a');
      localStorage.setItem(
        'drapemind_access_token',
        'test.' +
          btoa(
            JSON.stringify({
              sub: '1',
              tid: 1,
              platform: false,
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ) +
          '.test',
      );
    });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/suppliers-admin');
    await page.getByRole('heading', { name: 'Confecciones Andinas', exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, 'supply-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Registrar proveedor', exact: true }).click();
    await page.getByRole('textbox', { name: 'Empresa', exact: true }).fill('Nuevo proveedor');
    await page.screenshot({ path: path.join(out, 'supplier-form.png'), animations: 'disabled' });
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(out, 'supply-narrow.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Horizontal overflow in supply at 390px',
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'verification.json'),
      JSON.stringify(
        {
          viewports: [1440, 390],
          pwaReloadOffline: true,
          queueSurvivesReload: true,
          lostResponseRetried: true,
          serverReservations: receipts.size,
          tenantIsolation: true,
          pageErrors: errors,
        },
        null,
        2,
      ),
    );
    console.log(
      'Incremento II browser checks passed: PWA offline reload, durable queue, lost-response retry, tenant isolation and responsive screens.',
    );
  } catch (error) {
    const page = browser.contexts().flatMap(context => context.pages())[0];
    if (page) {
      await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});
      console.error('QA failure context', await page.evaluate(async () => ({
        url:location.href, online:navigator.onLine, text:document.body.innerText.slice(0,2200),
        config:await (await caches.match(new URL('config.json',document.baseURI)))?.text(),
        worker:navigator.serviceWorker.controller?.scriptURL,
        cacheKeys:await caches.keys()
      })));
    }
    throw error;
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
  server.close();
});
