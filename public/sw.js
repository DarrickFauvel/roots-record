const CACHE = 'roots-record-v1';
const STATIC = [
  '/styles.css',
  '/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const { request: req } = e;
  const url = new URL(req.url);

  // Let non-GET and cross-origin requests pass through
  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // Static assets: cache-first
  if (url.pathname.match(/\.(css|js|svg|png|jpg|webp|woff2?)$/)) {
    e.respondWith(
      caches.match(req).then(hit => hit || fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }))
    );
    return;
  }

  // HTML pages: network-first, fall back to cache
  e.respondWith(
    fetch(req)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      })
      .catch(() => caches.match(req))
  );
});
