var CACHE = 'ironiq-v7';
var APP_SHELL = [
  '/',
  '/index.html',
  '/firebase-config.js',
  '/manifest.json',
  '/logo.webp',
  '/logo-192.png',
  '/logo-512.png',
  '/logo-apple.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE).then(function(cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE; }).map(function(k) { return caches.delete(k); })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function(event) {
  var url = event.request.url;

  // Não intercepta APIs externas
  if (url.indexOf('firestore.googleapis.com') !== -1 ||
      url.indexOf('identitytoolkit') !== -1 ||
      url.indexOf('securetoken') !== -1 ||
      url.indexOf('firebase') !== -1 ||
      url.indexOf('groq.com') !== -1 ||
      url.indexOf('fonts.googleapis.com') !== -1 ||
      url.indexOf('fonts.gstatic.com') !== -1 ||
      url.indexOf('gstatic.com') !== -1 ||
      url.indexOf('jsdelivr.net') !== -1) {
    return;
  }

  // Documento HTML (navegação): NETWORK-FIRST — garante que correções cheguem
  // no próximo acesso, sem prender o usuário numa versão velha do app.
  var isDoc = event.request.mode === 'navigate' ||
    (event.request.headers.get('accept') || '').indexOf('text/html') !== -1;
  if (isDoc) {
    event.respondWith(
      fetch(event.request).then(function(response) {
        if (response && response.ok) {
          var copy = response.clone();
          caches.open(CACHE).then(function(cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function() {
        return caches.match(event.request).then(function(c) { return c || caches.match('/index.html'); });
      })
    );
    return;
  }

  // Demais assets (JS/CSS/img): cache-first com revalidação em background (stale-while-revalidate)
  event.respondWith(
    caches.open(CACHE).then(function(cache) {
      return cache.match(event.request).then(function(cached) {
        var networkFetch = fetch(event.request).then(function(response) {
          if (event.request.method === 'GET' && response && response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        }).catch(function() {
          return cached;
        });
        // Serve o cache imediatamente; rede atualiza em background
        return cached || networkFetch;
      });
    })
  );
});

self.addEventListener('message', function(event) {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});
