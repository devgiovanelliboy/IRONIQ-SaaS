// ─── INIT.JS ─────────────────────────────────────────────────────────────────
// Inicialização da aplicação + registro do Service Worker.
// Carrega por ÚLTIMO, depois de auth.js (o autologin já disparou nesse ponto).
// navigate() → js/router.js | autologin IIFE → js/modules/auth.js

try { lucide.createIcons(); } catch(e) { console.warn('Lucide icons not available'); }

// NAV inicialmente oculta (evita flash antes do Firebase confirmar sessão)
(function() {
  var n1 = document.getElementById('bottom-nav');
  var n2 = document.getElementById('bottom-nav-personal');
  [n1, n2].forEach(function(n) { if (n) n.style.display = 'none'; });
})();

// Limpa cache antigo uma vez por sessão (evita conflito com SW anterior)
if (!sessionStorage.getItem('cache_limpo')) {
  sessionStorage.setItem('cache_limpo', '1');
  if ('caches' in window) {
    caches.keys().then(function(keys) {
      return Promise.all(keys.map(function(k) { return caches.delete(k); }));
    }).catch(function() {});
  }
}

// ─── SERVICE WORKER ──────────────────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  var swRefreshing = false;
  // Se a página JÁ está sob controle de um Service Worker neste load, então um
  // 'controllerchange' futuro significa que uma versão NOVA assumiu → recarrega 1x.
  // Na primeiríssima instalação (sem controller) NÃO recarrega, evitando o
  // duplo-carregamento que acontecia antes.
  var swTinhaControle = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (swRefreshing || !swTinhaControle) return;
    swRefreshing = true;
    window.location.reload();
  });
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    // Procura atualização imediatamente, a cada 60s, e SEMPRE que o usuário
    // volta pra aba (visibilitychange/focus) — assim uma aba aberta há horas
    // se atualiza no instante em que você olha pra ela, sem ação manual.
    function checarUpdate() { try { reg.update(); } catch (e) {} }
    checarUpdate();
    setInterval(checarUpdate, 60000);
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') checarUpdate();
    });
    window.addEventListener('focus', checarUpdate);
    reg.addEventListener('updatefound', function() {
      var w = reg.installing;
      if (w) w.addEventListener('statechange', function() {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          // Nova versão pronta e já havia uma ativa → ativa a nova na hora.
          // Isso dispara o 'controllerchange' acima, que recarrega a página.
          w.postMessage({ action: 'skipWaiting' });
        }
      });
    });
  });
}
