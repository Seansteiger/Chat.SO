const CACHE_NAME = 'chatso-v5';
const STATIC_ASSETS = [
  '/manifest.webmanifest',
  '/favicon.png',
  '/favicon.ico',
  '/apple-touch-icon.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/launch-icon.png',
  '/icons/badge-96.png',
  '/icons/badge-72.png',
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

// 4. Background Web Push Handler: wakes up the Service Worker even when the app/browser is completely closed
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = { title: 'Chat.SO', body: event.data ? event.data.text() : 'New notification' };
  }

  const title = data.title || 'Chat.SO';
  const isCall = data.type === 'CALL';

  const options = {
    body: data.body || (isCall ? 'Incoming call...' : 'New message received'),
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-96.png',
    tag: data.tag || (isCall ? 'chatso-incoming-call' : `chat-${data.senderId || 'general'}`),
    renotify: true,
    requireInteraction: isCall,
    vibrate: isCall ? [500, 250, 500, 250, 500, 250, 500] : (data.silent ? undefined : [200, 100, 200]),
    actions: isCall
      ? [
          { action: 'answer', title: '📞 Answer' },
          { action: 'decline', title: '✕ Decline' },
        ]
      : undefined,
    data: {
      ...data,
      url: data.url || (isCall ? '/#calls' : (data.senderId ? `/#chat=${data.senderId}` : '/')),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// 5. Notification click handler: opens or focuses the Chat.SO window when clicked from the Notification Panel / Action Center
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'decline') {
    // Call was declined from the notification panel
    return;
  }

  const data = event.notification.data || {};
  const isCall = data.type === 'CALL';
  const targetUrl = data.url || (isCall ? '/#calls' : (data.senderId ? `/#chat=${data.senderId}` : '/'));

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a Chat.SO window is already open, focus it and post a message
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (isCall && 'postMessage' in client) {
            client.postMessage({
              type: 'CALL_NOTIFICATION_CLICK',
              callId: data.callId,
              callerId: data.callerId,
            });
          } else if (data.senderId && 'postMessage' in client) {
            client.postMessage({
              type: 'NOTIFICATION_CLICK',
              senderId: data.senderId,
            });
          }
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('notificationclose', (event) => {
  // Notification dismissed by user or OS
});
