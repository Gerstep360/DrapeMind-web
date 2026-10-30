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
  let calls = 0;
  const receipts = new Map();
  let loseResponse = true;
  let loseSaleResponse = true;
  let exchangeReceipt = null,
    exchangeCount = 0,
    loseExchangeResponse = true;
  snapshot.variants.push({ id: 2, producto_id: 1, sku: 'CAM-L', talla: 'L', color: 'Negro' });
  snapshot.stock.push({ sucursal_id: 1, variante_id: 2, disponible: 5 });
  snapshot.reservations = [
    {
      id: 41,
      codigo_publico: 'b1234567-1111-4222-8333-123456789012',
      sucursal_id: 1,
      usuario_id: 4,
      estado: 'LISTA',
      vence_at: expiry,
      items: [{ variante_id: 1, cantidad: 1, precio_unitario: '175.00' }],
    },
  ];
  const conflict = {
    usuario_nombre: 'Ana Pérez',
    sucursal_nombre: 'Centro',
    detalle_prendas: [
      {
        variante_id: 1,
        nombre: 'Camisa de algodón · M · Negro',
        cantidad: 1,
        precio_unitario: '150.00',
        precio_actual: '175.00',
      },
    ],
    id: 900,
    usuario_id: 6,
    operacion_id: 'd1234567-1111-4222-8333-123456789012',
    tipo: 'SALE',
    estado: 'CONFLICT',
    intentos: 1,
    payload: {
      operacion_id: 'd1234567-1111-4222-8333-123456789012',
      sucursal_id: 1,
      snapshot_version: 'qa-version',
      creado_at: now.toISOString(),
      items: [{ variante_id: 1, cantidad: 1, precio_unitario: '150.00' }],
      efectivo_recibido: '150.00',
    },
    error: {
      code: 'PRICE_CHANGED',
      message: 'El precio cambió. Un encargado debe revisar el importe cobrado.',
    },
  };
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
      const owner = JSON.parse(
        Buffer.from(
          (route.request().headers()['authorization'] || '').split('.')[1] || 'e30',
          'base64url',
        ).toString(),
      ).sub;
      if (endpoint === '/offline/bundle')
        return route.fulfill({ json: { ...snapshot, owner: `1:${owner}`, user_id: +owner } });
      if (endpoint === '/offline/operations' && route.request().method() === 'GET')
        return route.fulfill({
          json: [...receipts.values()].filter((o) => String(o.usuario_id) === owner),
        });
      if (endpoint === '/offline/operations') {
        calls++;
        const envelope = route.request().postDataJSON(),
          body = envelope.payload;
        if (!receipts.has(body.operacion_id)) {
          const reservation = {
            id: 31,
            codigo_publico: 'a1234567-1111-4222-8333-123456789012',
            estado: 'PENDIENTE',
            vence_at: expiry,
            sucursal_id: 1,
          };
          const total = body.items.reduce(
            (n, i) => n + Number(i.precio_unitario || 0) * i.cantidad,
            0,
          );
          receipts.set(body.operacion_id, {
            id: receipts.size + 1,
            usuario_id: +owner,
            operacion_id: body.operacion_id,
            tipo: envelope.tipo,
            payload: body,
            estado: 'CONFIRMED',
            intentos: 1,
            resultado:
              envelope.tipo === 'RESERVATION'
                ? { reservation }
                : {
                    sale: {
                      pedido_id: envelope.tipo === 'PICKUP' ? 502 : 501,
                      codigo_publico: reservation.codigo_publico,
                      total: total.toFixed(2),
                      estado: 'ENTREGADO',
                      cambio: (+body.efectivo_recibido - total).toFixed(2),
                    },
                  },
          });
        }
        if (loseResponse && envelope.tipo === 'RESERVATION') {
          loseResponse = false;
          return route.abort('connectionreset');
        }
        if (loseSaleResponse && envelope.tipo === 'SALE') {
          loseSaleResponse = false;
          return route.abort('connectionreset');
        }
        return route.fulfill({
          json: receipts.get(body.operacion_id),
        });
      }
      if (endpoint === '/retail/reservations')
        return route.fulfill({ json: snapshot.reservations });
      if (endpoint.startsWith('/retail/reservations/') && endpoint.endsWith('/prepare'))
        return route.fulfill({ json: snapshot.reservations[0] });
      if (endpoint === '/retail/conflicts')
        return route.fulfill({ json: conflict.estado === 'CONFIRMED' ? [] : [conflict] });
      if (endpoint === '/retail/operations/900/audit')
        return route.fulfill({
          json: [
            {
              id: 1,
              actor_id: 6,
              accion: 'SYNC',
              created_at: now.toISOString(),
              detalle: { estado: 'CONFLICT' },
            },
          ],
        });
      if (endpoint === '/retail/operations/900/resolve') {
        conflict.estado =
          route.request().postDataJSON().accion === 'REJECT' ? 'REJECTED' : 'CONFIRMED';
        return route.fulfill({ json: conflict });
      }
      if (endpoint === '/retail/orders/find')
        return route.fulfill({
          json: {
            pedido_id: 501,
            sucursal_id: 1,
            total: '350.00',
            items: [
              {
                id: 1001,
                variante_id: 1,
                nombre: product.nombre,
                talla: 'M',
                color: 'Negro',
                cantidad: 2,
                disponible_cambio: 2,
                precio_unitario: '175.00',
                credito_unitario: '175.00',
              },
            ],
          },
        });
      if (endpoint.startsWith('/retail/exchanges/operations/')) {
        return exchangeReceipt && endpoint.endsWith(exchangeReceipt.operacion_id)
          ? route.fulfill({ json: exchangeReceipt })
          : route.fulfill({ status: 404, json: { detail: 'Cambio no encontrado' } });
      }
      if (endpoint === '/retail/exchanges') {
        if (url.searchParams.get('preview') === 'true')
          return route.fulfill({
            json: { credito: '175.00', total_nuevo: '175.00', diferencia: '0.00' },
          });
        if (!exchangeReceipt) {
          exchangeCount++;
          exchangeReceipt = {
            id: 1,
            credito: '175.00',
            total_nuevo: '175.00',
            diferencia: '0.00',
            operacion_id: route.request().postDataJSON().operacion_id,
            sale: { pedido_id: 701, codigo_publico: 'c1234567-1111-4222-8333-123456789012' },
          };
        }
        assert.equal(route.request().postDataJSON().operacion_id, exchangeReceipt.operacion_id);
        if (loseExchangeResponse) {
          loseExchangeResponse = false;
          return route.abort('connectionreset');
        }
        return route.fulfill({ json: exchangeReceipt });
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
      if (endpoint === '/supply/suppliers') {
        if (route.request().method() === 'POST') {
          Object.assign(supplier, route.request().postDataJSON());
          return route.fulfill({ status: 201, json: supplier });
        }
        return route.fulfill({ json: [supplier] });
      }
      if (endpoint === '/supply/suppliers/1/offers') return route.fulfill({ json: [offer] });
      if (endpoint === '/supply/orders') {
        if (route.request().method() === 'POST') {
          const body = route.request().postDataJSON();
          assert.equal(body.sucursal_id, 1);
          assert.equal(body.items[0].variante_id, 1);
          orders.push({
            id: 22,
            proveedor_id: 1,
            proveedor: supplier.nombre_empresa,
            sucursal: 'Centro',
            estado: 'SOLICITADO',
            total: '65.00',
            created_at: now.toISOString(),
            items: [{ nombre: offer.nombre_suministro, cantidad: 1 }],
          });
          return route.fulfill({ status: 201, json: orders.at(-1) });
        }
        return route.fulfill({ json: orders });
      }
      if (endpoint.startsWith('/supply/orders/')) {
        const parts = endpoint.split('/'),
          order = orders.find((o) => o.id === +parts[3]);
        if (!order) return route.fulfill({ status: 404, json: { detail: 'No existe' } });
        order.estado =
          parts[4] === 'confirm' ? 'CONFIRMADO' : parts[4] === 'receive' ? 'RECIBIDO' : 'CANCELADO';
        return route.fulfill({ json: order });
      }
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
    assert.equal(calls, 1);
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
    await page.getByRole('button', { name: 'Guardar proveedor', exact: true }).click();
    await page.getByRole('heading', { name: 'Nuevo proveedor', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Añadir suministro', exact: true }).click();
    await page.locator('form.order-form select').nth(2).selectOption({ index: 1 });
    await page.getByRole('button', { name: 'Solicitar pedido', exact: true }).click();
    const newOrder = page
      .locator('article.request-row')
      .filter({
        has: page.getByRole('heading', { name: 'Pedido 22 · Nuevo proveedor', exact: true }),
      });
    await newOrder.getByRole('button', { name: 'Confirmar unidades', exact: true }).click();
    await newOrder.getByRole('button', { name: 'Registrar recepción', exact: true }).click();
    await newOrder.locator('.state').filter({ hasText: 'RECIBIDO' }).waitFor();
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
    const retailOut = path.join(out, 'cu15-cu20');
    fs.mkdirSync(retailOut, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/retail');
    await page
      .getByRole('button', { name: 'Guardar catálogo de la sucursal', exact: true })
      .click();
    await page.getByLabel('Prenda, talla y color', { exact: true }).waitFor();
    await context.setOffline(true);
    await page.getByLabel('Prenda, talla y color', { exact: true }).selectOption({ index: 1 });
    await page.getByLabel('Cantidad', { exact: true }).fill('2');
    await page.getByRole('button', { name: 'Añadir a la venta', exact: true }).click();
    await page.getByLabel('Efectivo recibido', { exact: true }).fill('400');
    await page.screenshot({
      path: path.join(retailOut, 'cash-desktop.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: path.join(retailOut, 'cash-narrow.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Cash desk overflow',
    );
    await page.getByRole('button', { name: 'Guardar venta de contado', exact: true }).click();
    await page.getByText('Guardada en el dispositivo', { exact: true }).waitFor();
    const downloadPromise = page.waitForEvent('download');
    await page
      .getByRole('button', { name: 'Descargar comprobante provisional', exact: true })
      .click();
    const download = await downloadPromise;
    const receiptText = fs.readFileSync(await download.path(), 'utf8');
    assert.ok(
      receiptText.includes('PROVISIONAL') &&
        receiptText.includes('350.00') &&
        receiptText.includes('50.00'),
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Operaciones y resultados', exact: true }).click();
    await page.getByText('Guardada en el dispositivo', { exact: true }).waitFor();
    await context.setOffline(false);
    await page.getByText('Por comprobar al conectar', { exact: true }).waitFor();
    await page
      .getByRole('button', { name: 'Sincronizar y consultar resultados', exact: true })
      .click();
    await page.getByText('Confirmada', { exact: true }).waitFor();
    assert.equal([...receipts.values()].filter((r) => r.tipo === 'SALE').length, 1);
    assert.equal(
      calls,
      2,
      'One POST each for the reservation and cash sale; lost responses reconciled through GET',
    );
    await page.screenshot({
      path: path.join(retailOut, 'operations-confirmed.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Atender reservas', exact: true }).click();
    await page.getByRole('button', { name: 'Cobrar y entregar', exact: true }).click();
    await page.getByLabel('Efectivo recibido', { exact: true }).fill('200');
    await page.getByRole('button', { name: 'Confirmar cobro y entrega', exact: true }).click();
    await page.getByText('Retiro de reserva 41', { exact: true }).waitFor();
    await page.getByText('Pedido 502', { exact: false }).waitFor();
    assert.equal([...receipts.values()].filter((r) => r.tipo === 'PICKUP').length, 1);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base + '/sync-conflicts');
    await page.getByRole('button', { name: 'Revisar detalle', exact: true }).click();
    await page
      .getByLabel('Motivo y acuerdo con el cliente', { exact: true })
      .fill('Se respeta el precio cobrado en caja.');
    await page
      .getByLabel('Autorizar el precio que se cobró y quedó guardado', { exact: true })
      .check();
    await page.screenshot({
      path: path.join(retailOut, 'conflict-review.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.getByRole('button', { name: 'Volver a validar', exact: true }).click();
    await page
      .getByText('Todo al día. No hay operaciones pendientes de revisión en tus sucursales.', {
        exact: true,
      })
      .waitFor();
    await page.goto(base + '/exchanges');
    await page.getByLabel('Número de pedido o código del comprobante', { exact: true }).fill('501');
    await page.getByRole('button', { name: 'Buscar venta', exact: true }).click();
    await page.getByRole('spinbutton').first().fill('1');
    await page.getByLabel('Nueva talla o prenda', { exact: true }).selectOption({ index: 2 });
    await page.getByLabel('Cantidad', { exact: true }).fill('1');
    await page.getByRole('button', { name: 'Añadir prenda nueva', exact: true }).click();
    await page
      .getByLabel('Motivo del cambio', { exact: true })
      .fill('El cliente solicita talla L.');
    await page
      .getByRole('button', { name: 'Calcular diferencia con precios actuales', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirmar cambio y efectivo', exact: true }).waitFor();
    await page.screenshot({
      path: path.join(retailOut, 'exchange-preview.png'),
      fullPage: true,
      animations: 'disabled',
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: path.join(retailOut, 'exchange-narrow.png'),
      fullPage: true,
      animations: 'disabled',
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      'Exchange overflow',
    );
    await page.getByRole('button', { name: 'Confirmar cambio y efectivo', exact: true }).click();
    await page
      .getByRole('heading', { name: 'Un cambio necesita comprobarse', exact: true })
      .waitFor();
    await page.reload();
    await page.getByRole('button', { name: 'Comprobar cambio anterior', exact: true }).click();
    await page.getByRole('heading', { name: 'Cambio 1 registrado', exact: true }).waitFor();
    assert.equal(exchangeCount, 1);
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(out, 'verification.json'),
      JSON.stringify(
        {
          viewports: [1440, 390],
          pwaReloadOffline: true,
          queueSurvivesReload: true,
          lostResponseRetried: true,
          serverReservations: [...receipts.values()].filter((r) => r.tipo === 'RESERVATION').length,
          serverCashSales: [...receipts.values()].filter((r) => r.tipo === 'SALE').length,
          serverPickups: [...receipts.values()].filter((r) => r.tipo === 'PICKUP').length,
          provisionalCashReceipt: true,
          cashLostResponseReconciled: true,
          conflictReview: true,
          exchangeCompleted: true,
          exchangeLostResponseRecovered: true,
          supplierRegistrationAndReceiving: true,
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
    const page = browser.contexts().flatMap((context) => context.pages())[0];
    if (page) {
      await page.screenshot({ path: path.join(out, 'failure.png'), fullPage: true });
      console.error(
        'QA failure context',
        await page.evaluate(async () => ({
          url: location.href,
          online: navigator.onLine,
          text: document.body.innerText.slice(0, 2200),
          config: await (await caches.match(new URL('config.json', document.baseURI)))?.text(),
          worker: navigator.serviceWorker.controller?.scriptURL,
          cacheKeys: await caches.keys(),
          forms: [...document.forms].map((f) => ({
            valid: f.checkValidity(),
            inputs: [...f.querySelectorAll('input')].map((i) => ({
              name: i.name,
              value: i.value,
              validation: i.validationMessage,
            })),
            buttons: [...f.querySelectorAll('button')].map((b) => ({
              text: b.innerText,
              type: b.type,
              disabled: b.disabled,
            })),
          })),
        })),
      );
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
