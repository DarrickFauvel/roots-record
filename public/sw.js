const CACHE = 'roots-record-v4';
const PRECACHE = [
  '/icon.svg', '/manifest.json',
  '/styles.css', '/components.js', '/datastar.js',
  '/fonts/fonts.css',
  '/fonts/jetbrains-mono.woff2',
  '/fonts/merriweather.woff2',
  '/fonts/merriweather-italic.woff2',
  '/fonts/nunito.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)));
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

  if (req.method !== 'GET' || url.origin !== location.origin) return;

  // CSS/JS: network-first — always fetch fresh, fall back to cache when offline
  if (url.pathname.match(/\.(css|js)$/)) {
    e.respondWith(
      fetch(req).then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(req, clone));
        return res;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Static assets (images, fonts, icons): cache-first
  if (url.pathname.match(/\.(svg|png|jpg|webp|woff2?)$/)) {
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
