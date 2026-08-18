const CACHE = 'lumora-v1';
const STATIC = ['/favicon.svg', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // Never intercept API, uploads, or non-GET requests
  if (request.method !== 'GET') return;
  if (url.pathname.startsWith('/v1') || url.pathname.startsWith('/uploads') || url.pathname.startsWith('/exports')) return;

  // Network-first for navigation (always get fresh HTML)
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request).catch(() => caches.match('/index.html') ?? fetch(request))
    );
    return;
  }

  // Cache-first for static assets (JS/CSS/fonts/images)
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
