const CACHE_NAME = 'artha-v61';
const ASSETS = [
  './',
  './index.html',
  './style.css?v=60',
  './style.css',
  './js/main.js?v=60',
  './js/main.js',
  './js/config.js',
  './js/utils.js',
  './js/state.js',
  './js/api/supabase.js',
  './js/api/presence.js',
  './js/api/sync.js',
  './js/api/auth.js',
  './js/modules/transactions.js',
  './js/modules/budgets.js',
  './js/modules/momBalance.js',
  './js/modules/savings.js',
  './js/modules/debts.js',
  './js/modules/reports.js',
  './js/modules/charts.js',
  './js/modules/admin.js',
  './js/ui/theme.js',
  './js/ui/modals.js',
  './js/ui/router.js',
  './manifest.json',
  './offline.html',
  './404.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Hanya tangani GET requests untuk domain sendiri (origin kita)
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  // Network first fallback to cache, and offline page fallback
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          const offlinePage = await caches.match('./offline.html');
          if (offlinePage) return offlinePage;
          return caches.match('./index.html');
        }
        return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
      })
  );
});
