/* SmartBoard service worker
 * - Pre-caches the app shell so the app opens instantly and works offline (landing page + install).
 * - Live drawing always needs the internet: socket traffic is never intercepted or cached.
 * - Bump VERSION when you change any file in SHELL so users get the update.
 */
const VERSION = 'smartboard-v29';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

const SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/core.js',
  '/js/call.js',
  '/js/extras.js',
  '/js/extras2.js',
  '/js/extras3.js',
  '/js/extras4.js',
  '/js/account.js',
  '/js/app.js',
  '/js/features.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/config.js',
];

// Fonts and PDF/export libraries come from these CDNs; cache them after first use.
const CDN_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com', 'cdnjs.cloudflare.com'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      // add files one by one so a single failure does not break the whole install
      Promise.all(SHELL.map((url) => cache.add(url).catch(() => null)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Stale-while-revalidate: answer from cache immediately, refresh the cache in the background.
async function staleWhileRevalidate(request, cacheName, matchOptions) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, matchOptions);
  const network = fetch(request)
    .then((res) => {
      if (res && (res.ok || res.type === 'opaque')) cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Never touch live socket connections (only the client script is cached).
  if (url.pathname.startsWith('/socket.io/') && url.pathname !== '/socket.io/socket.io.js') return;
  // Always check the network for the service worker file itself.
  if (url.pathname === '/sw.js' || url.pathname.startsWith('/api/')) return;

  // Page navigations (including /?room=CODE): open the cached app shell instantly.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = (await cache.match('/index.html')) || (await cache.match('/'));
        const network = fetch(req)
          .then((res) => { if (res && res.ok) cache.put('/index.html', res.clone()); return res; })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith(staleWhileRevalidate(req, SHELL_CACHE));
  } else if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(staleWhileRevalidate(req, RUNTIME_CACHE));
  }
});
