// ─── FIREBASE / DEMO MODE ────────────────────────────────────────────────────
// Inicializa Firebase (auth, db, storage) ou entra em modo demo.
// Depende de: firebase-config.js (firebaseConfig global) + SDK compat CDN.

var isDemo = false;
var auth = null, db = null, storage = null;
var _protocoloListener = null;

// ─── PROXY DE IA (Groq) ──────────────────────────────────────────────────────
// Chamadas de IA passam por um proxy (Cloudflare Worker) que guarda a chave no
// servidor. O cliente envia o ID token do Firebase; o Worker valida e repassa à Groq.
var IA_PROXY_URL = 'https://ironqi-groq-proxy.contato-ironiq.workers.dev';

function _iaFetch(payload, signal) {
  var opts = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  };
  if (signal) opts.signal = signal;
  function doFetch(token) {
    if (token) opts.headers['Authorization'] = 'Bearer ' + token;
    return fetch(IA_PROXY_URL, opts);
  }
  if (auth && auth.currentUser && auth.currentUser.getIdToken) {
    return auth.currentUser.getIdToken().then(doFetch);
  }
  return doFetch(null);
}

// Força demo mode se tiver ?demo na URL (ex: http://localhost:5000?demo)
if (window.location.search.indexOf('demo') !== -1) isDemo = true;

if (!isDemo) {
  try {
    if (firebaseConfig.apiKey === 'SUA_API_KEY') throw new Error('demo');
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function(e) { console.error('Erro de persistência:', e); });
    db = firebase.firestore();
    storage = firebase.storage();
  } catch (e) {
    isDemo = true;
    console.log('Modo demo — Firebase não configurado');
  }
} else {
  console.log('Modo demo forçado por ?demo na URL');
}
