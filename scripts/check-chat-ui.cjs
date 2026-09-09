// Local visual fixture only: all external HTTP and WebSocket traffic is intercepted.
const { chromium } = require('playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../dist/web/browser');
const output = path.resolve(__dirname, '../qa/chat');
fs.mkdirSync(output, { recursive: true });
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let file = path.resolve(root, '.' + pathname);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(root, 'index.html');
  const mime = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };
  res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
  res.end(fs.readFileSync(file));
});
(async () => {
  await new Promise(resolve => server.listen(14200, '127.0.0.1', resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.CHAT_QA_BROWSER || 'msedge' });
  try {
    const context = await browser.newContext();
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname !== '127.0.0.1' || url.port !== '14200') return route.abort();
      if (url.pathname === '/config.json') return route.fulfill({ json: { backendUrl: 'http://127.0.0.1:14200', apiPrefix: '/api/v1' } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ json: { items: [], total: 0, total_bob: 0 } });
      return route.continue();
    });
    let peer;
    await context.routeWebSocket('**/*', socket => {
      // Never connectToServer: this is an in-browser protocol fixture.
      socket.onMessage(raw => {
        const event = JSON.parse(raw);
        if (event.type === 'auth') socket.send(JSON.stringify({ type: 'connected' }));
        if (event.type === 'chat') {
          peer = socket;
          socket.send(JSON.stringify({ type: 'progress', content: 'Pensando…' }));
        }
      });
    });
    await context.addInitScript(() => {
      sessionStorage.setItem('drapemind_access_token', 'test.' + btoa(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600 })) + '.test');
      sessionStorage.setItem('drapemind_user', JSON.stringify({ id: 0, nombre: 'Prueba visual', rol: 'CLIENTE', estado: 'ACTIVO' }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.goto('http://127.0.0.1:14200/ai-studio');
    await page.getByRole('textbox', { name: 'Mensaje para Altair' }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop-empty.png') });
    assert.equal(await page.locator('.message').count(), 0);
    await page.locator('.ideas-panel summary').click();
    await page.screenshot({ path: path.join(output, 'desktop-ideas.png') });
    await page.locator('.ideas-panel summary').click();
    await page.getByRole('textbox', { name: 'Mensaje para Altair' }).fill('Ayúdame a combinar texturas suaves');
    await page.getByRole('button', { name: 'Enviar consulta', exact: true }).click();
    await page.locator('.live-thinking-card').waitFor();
    await page.waitForFunction(() => document.querySelector('.live-thinking-card')?.textContent.includes('Pensando'));
    await page.screenshot({ path: path.join(output, 'desktop-thinking.png') });
    assert.ok(peer);
    peer.send(JSON.stringify({ type: 'answer_snapshot', content: 'Podemos contrastar **lino y algodón** con una paleta suave.' }));
    await page.getByText('lino y algodón', { exact: false }).waitFor();
    peer.send(JSON.stringify({ type: 'done', tools: [], suggested_actions: [{ label: 'Explorar tejidos', prompt: 'Busca prendas de algodón' }] }));
    await page.getByRole('button', { name: 'Explorar tejidos', exact: false }).waitFor();
    await page.screenshot({ path: path.join(output, 'desktop-response.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForFunction(() => document.querySelector('.sidebar').getBoundingClientRect().right <= 1);
    await page.screenshot({ path: path.join(output, 'narrow-response.png') });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    assert.equal(overflow, false, 'Horizontal viewport overflow');
    assert.ok(await page.getByRole('textbox', { name: 'Mensaje para Altair' }).isVisible());
    await page.getByRole('button', { name: 'Explorar tejidos', exact: false }).click();
    await page.locator('.live-thinking-card').waitFor();
    peer.send(JSON.stringify({ type: 'error', code: 'AI_UNAVAILABLE', message: 'El modelo excedió el tiempo de respuesta. Puedes reintentar.' }));
    await page.locator('.message--error').waitFor();
    await page.screenshot({ path: path.join(output, 'narrow-error.png') });
    assert.deepEqual(errors, []);
    console.log('PASS: empty, ideas, thinking, streamed response, suggested action, 1440px/390px; external network blocked');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
