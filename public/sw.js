// Qwara service worker - offline-first for static assets, network-first for HTML.
// Bumps CACHE_VERSION when you need clients to drop old caches.
const CACHE_VERSION = 'qwara-v1';
const CACHE = CACHE_VERSION;

// Core routes to pre-cache on install so the shell works offline.
const PRECACHE = [
  '/',
  '/blog',
  '/projects',
  '/archive',
  '/friends',
  '/search',
  '/now',
  '/avatar.png',
  '/favicon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      // addAll fails entirely if one URL 404s; use individual puts instead.
      Promise.all(
        PRECACHE.map((url) =>
          fetch(url)
            .then((res) => (res.ok ? cache.put(url, res) : undefined))
            .catch(() => undefined)
        )
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin requests; let the browser handle the rest.
  if (url.origin !== self.location.origin) return;

  // HTML navigations: network-first so content updates are visible,
  // falling back to cache (then to the cached root) when offline.
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match('/'))
        )
    );
    return;
  }

  // Static assets (fonts, images, CSS, JS): cache-first with background update.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
