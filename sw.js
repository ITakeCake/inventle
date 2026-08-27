var CACHE = 'inventle-v6';
var ASSETS = [
  '/',
  '/index.html',
  '/infinite.html',
  '/stats.html',
  '/about.html',
  '/how-to-play.html',
  '/privacy.html',
  '/terms.html',
  '/contact.html',
  '/css/main.css',
  '/css/animations.css',
  '/css/global-stats.css',
  '/js/i18n.js',
  '/js/data.js',
  '/js/data-daily.js',
  '/js/data-overlay.js',
  '/js/core.js',
  '/js/game.js',
  '/js/infinite.js',
  '/js/global-stats.js',
  '/js/i18n-patch.js',
  '/js/settings-page.js',
  '/js/dev.js',
  '/favicon.svg',
  '/manifest.json',
  '/locales/data-de.js',
  '/locales/data-en.js',
  '/locales/data-es.js',
  '/locales/data-fr.js',
  '/locales/data-hi.js',
  '/locales/data-it.js',
  '/locales/data-ja.js',
  '/locales/data-ko.js',
  '/locales/data-nb.js',
  '/locales/data-pl.js',
  '/locales/data-pt.js',
  '/locales/data-sv.js',
  '/locales/data-uk.js',
  '/locales/data-zh.js'
];

self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(e) {
  var url = new URL(e.request.url);
  // Don't intercept cross-origin requests (API calls, fonts, etc.) - let the browser handle them
  if (url.origin !== self.location.origin) return;
  // Don't cache POSTs or other non-GET methods
  if (e.request.method !== 'GET') return;

  // Network first for everything - cache is only a fallback for offline
  e.respondWith(
    fetch(e.request).then(function(response) {
      if (response && response.ok) {
        var clone = response.clone();
        caches.open(CACHE).then(function(cache) { cache.put(e.request, clone); });
      }
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('Offline and not cached', { status: 503, statusText: 'Service Unavailable' });
      });
    })
  );
});
