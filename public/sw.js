/* Only the application shell is cached. Authenticated API responses stay in the owner-scoped IndexedDB module. */
const BUILD_ID = 'development';
const ROOT = new URL(self.registration.scope).pathname;
const PREFIX = `drapemind-shell-${ROOT}-`;
const CACHE = PREFIX + BUILD_ID;
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
