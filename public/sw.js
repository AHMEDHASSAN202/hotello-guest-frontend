/**
 * GXP Guest App service worker (14.1 AC3) — correctness first:
 *  - offline fallback + icons precached at install
 *  - hashed build assets (/_next/static/) cache-first (immutable by name)
 *  - navigations network-first with the offline screen as fallback
 *  - API responses NEVER cached (cross-origin requests are left alone)
 */
const CACHE = 'gxp-shell-v1';
const OFFLINE_URL = '/offline.html';
const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // The API lives on another origin — never intercepted, never cached.
  if (url.origin !== self.location.origin) return;

  // App shell navigations: network first, warm offline screen when it fails.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  // Hashed immutable build assets + icons: cache first for instant repeat opens.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((cache) => cache.put(request, copy));
            }
            return res;
          }),
      ),
    );
  }
});

// --- Web Push (Epic 23) — the SW renders, never composes. The payload
// arrives from the backend as fully-formed JSON (`title`/`body`/`url`, and
// optionally `tag` for collapse); this file never builds strings, it only
// shows the notification and routes the tap.
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data;
  try {
    data = event.data.json();
  } catch {
    return;
  }
  event.waitUntil(
    self.registration.showNotification(data.title || '', {
      body: data.body || '',
      tag: data.tag || undefined, // collapse on-device too
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const client = list.find((c) => 'focus' in c);
      if (client) return client.focus().then((c) => ('navigate' in c ? c.navigate(url) : undefined));
      return self.clients.openWindow(url);
    }),
  );
});
