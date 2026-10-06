const CACHE_NAME = 'chatso-v2';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

// Install: pre-cache static icons only (never cache index.html with cache-first)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate: clean up all old caches immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Fetch handler: Network-First for HTML/navigation requests to guarantee no white screens on fresh loads
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass caching for APIs, sockets, cloud uploads, and Convex
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/uploads/') ||
    url.hostname.includes('convex.cloud')
  ) {
    return;
  }

  // 1. Navigation / HTML requests: NETWORK-FIRST
  // Guarantees user receives the latest bundle and never gets stuck on stale HTML with broken JS chunks
  if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => {
          // Only if offline, fall back to cached page
          return caches.match(event.request).then((cached) => cached || caches.match('/'));
        })
    );
    return;
  }

  // 2. Static hashed assets (JS/CSS in /assets/): Stale-while-revalidate or Network-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return networkResponse;
          })
          .catch(() => cached);

        return cached || fetchPromise;
      })
    );
    return;
  }

  // 3. Other static assets (icons, manifest)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      });
    })
  );
});
