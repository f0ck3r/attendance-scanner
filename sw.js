// Airdrie Over 50 Club — Attendance Scanner
// Service Worker v3.8
// Bump CACHE_VERSION below whenever a new version of index.html is deployed.
// The old cache will be automatically cleared and the fresh files downloaded.

const CACHE_VERSION = 'ao50-v3.8';
const CACHED_URLS = [
  '/',
  '/index.html'
];

// Install: cache the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(cache => {
      return cache.addAll(CACHED_URLS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: clear any old caches from previous versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => {
      // Tell all open tabs that a new version is active
      self.clients.matchAll({ includeUncontrolled: true }).then(clients => {
        clients.forEach(client => client.postMessage({ type: 'NEW_VERSION' }));
      });
      return self.clients.claim();
    })
  );
});

// Fetch: serve from cache, fall back to network, update cache in background
// CRITICAL FIX (v3.5): only intercept same-origin requests. Previously this
// handler intercepted ALL GET requests including cross-origin calls to
// Google Apps Script, causing every attendance post to be double-fetched.
// On weak wifi this exhausted the browser's per-domain connection pool
// (~6 concurrent on Safari), causing the app to "freeze" after a few scans
// since new requests couldn't even start. Airplane Mode "fixed" it because
// it forced all hung requests to fail immediately instead of hanging.
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  // Only intercept requests to our own origin — let everything else
  // (Google Apps Script, CDN libraries, etc.) pass through untouched
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        // Update the cache with the fresh response
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => null);

      // Return cached version immediately (fast load), network updates in background
      return cached || networkFetch;
    })
  );
});
