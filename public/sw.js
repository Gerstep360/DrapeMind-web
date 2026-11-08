/* Only the application shell is cached. Authenticated API responses stay in the owner-scoped IndexedDB module. */
const BUILD_ID = 'development';
const ROOT = new URL(self.registration.scope).pathname;
const PREFIX = `drapemind-shell-${ROOT}-`;
const CACHE = PREFIX + BUILD_ID;
self.addEventListener('push', event => {
  event.waitUntil((async () => {
    let message;
    try { message = event.data.json(); } catch { return; }
    const data = message.data || {};
    const slug = String(data.tenant_slug || '');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return;
    const screen = ['/catalog', '/orders', '/reservations', '/ai-studio'].includes(data.screen) ? data.screen : '/catalog';
    const url = new URL(`tienda/${encodeURIComponent(slug)}`, self.registration.scope);
    url.searchParams.set('next', screen);
    await self.registration.showNotification(message.title || data.tenant_name || 'DrapeMind', {
      body: message.body || '', tag: `store-${data.tenant_id}-${data.notification_id}`,
      data: { url: url.href },
    });
  })());
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil((async () => {
    const url = new URL(event.notification.data?.url || self.registration.scope);
    if (url.origin !== self.location.origin || !url.pathname.startsWith(ROOT)) return;
    const clients = await self.clients.matchAll({type:'window', includeUncontrolled:true});
    const tab = clients.find(client => new URL(client.url).pathname.startsWith(ROOT));
    if (tab) { await tab.navigate(url.href); await tab.focus(); }
    else await self.clients.openWindow(url.href);
  })());
});
self.addEventListener('install', (event) =>
  event.waitUntil(
    (async () => {
      const response = await fetch(new URL('sw-assets.json', self.registration.scope), {
        cache: 'no-store',
      });
      if (!response.ok) throw new Error('Offline manifest unavailable');
      const manifest = await response.json();
      const cache = await caches.open(CACHE);
      await cache.addAll(
        manifest.assets.map((path) => new URL(path, self.registration.scope).href),
      );
      // Activate updates after existing tabs close, so their lazy chunks keep the same shell version.
    })(),
  ),
);
self.addEventListener('activate', (event) =>
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith(PREFIX) && name !== CACHE) await caches.delete(name);
      await self.clients.claim();
    })(),
  ),
);
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (
    event.request.method !== 'GET' ||
    url.origin !== self.location.origin ||
    !url.pathname.startsWith(ROOT) ||
    url.pathname.includes('/api/') ||
    url.pathname.includes('/health/') ||
    event.request.headers.has('Authorization')
  )
    return;
  if (event.request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          return await fetch(event.request, { signal: AbortSignal.timeout(5000) });
        } catch {
          return (
            (await caches.match(new URL('index.html', self.registration.scope))) || Response.error()
          );
        }
      })(),
    );
    return;
  }
  event.respondWith(
    (async () => {
      if (url.pathname.includes('/static/products/'))
        return (await caches.match(event.request)) || fetch(event.request);
      const cache = await caches.open(CACHE);
      if (url.pathname.endsWith('/config.json')) {
        try {
          return await fetch(event.request);
        } catch {
          return (await cache.match(event.request)) || Response.error();
        }
      }
      return (await cache.match(event.request)) || fetch(event.request);
    })(),
  );
});
