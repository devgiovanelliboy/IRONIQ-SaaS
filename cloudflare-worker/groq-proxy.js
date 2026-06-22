// ─── IRONQI · Proxy seguro da IA (Groq) em Cloudflare Workers ────────────────
// Mantém a chave da Groq no servidor (secret GROQ_API_KEY) e só atende quem
// envia um ID token válido do Firebase do projeto. A chave nunca vai ao navegador.
//
// Secrets/vars necessários no Worker:
//   GROQ_API_KEY   (secret)  -> sua chave da Groq
//   FIREBASE_PROJECT_ID (var) -> ironiq-e9f7e
//
// O app chama este Worker no lugar de https://api.groq.com/...

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const JWK_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const ALLOWED_MODELS = ['llama-3.1-8b-instant'];

// Cache simples das chaves públicas do Firebase (por isolate)
let _jwkCache = { keys: null, exp: 0 };

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type'
  };
}

function json(status, obj) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: Object.assign({ 'Content-Type': 'application/json' }, corsHeaders())
  });
}

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function b64urlToString(s) {
  return new TextDecoder().decode(b64urlToBytes(s));
}

async function getJwks() {
  const now = Date.now();
  if (_jwkCache.keys && now < _jwkCache.exp) return _jwkCache.keys;
  const r = await fetch(JWK_URL);
  const data = await r.json();
  const map = {};
  (data.keys || []).forEach((k) => { map[k.kid] = k; });
  // cache-control max-age do Google costuma ser ~6h; usamos 1h por segurança
  _jwkCache = { keys: map, exp: now + 3600 * 1000 };
  return map;
}

// Verifica o ID token do Firebase (RS256) e retorna o payload, ou lança erro.
async function verifyFirebaseToken(token, projectId) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('token malformado');
  const header = JSON.parse(b64urlToString(parts[0]));
  const payload = JSON.parse(b64urlToString(parts[1]));
  if (header.alg !== 'RS256') throw new Error('alg inválido');

  const jwks = await getJwks();
  const jwk = jwks[header.kid];
  if (!jwk) throw new Error('chave pública não encontrada');

  const key = await crypto.subtle.importKey(
    'jwk',
    { kty: jwk.kty, n: jwk.n, e: jwk.e, alg: 'RS256', ext: true },
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );

  const signed = new TextEncoder().encode(parts[0] + '.' + parts[1]);
  const sig = b64urlToBytes(parts[2]);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig, signed);
  if (!ok) throw new Error('assinatura inválida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) throw new Error('token expirado');
  if (payload.iat > now + 300) throw new Error('iat no futuro');
  if (payload.aud !== projectId) throw new Error('aud inválido');
  if (payload.iss !== 'https://securetoken.google.com/' + projectId) throw new Error('iss inválido');
  if (!payload.sub) throw new Error('sub ausente');
  return payload;
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() });
    if (request.method !== 'POST') return json(405, { error: 'Method not allowed' });

    const projectId = env.FIREBASE_PROJECT_ID || 'ironiq-e9f7e';

    const auth = request.headers.get('Authorization') || '';
    const m = auth.match(/^Bearer (.+)$/);
    if (!m) return json(401, { error: 'Token ausente' });
    try {
      await verifyFirebaseToken(m[1], projectId);
    } catch (e) {
      return json(401, { error: 'Token inválido', detail: String(e.message || e) });
    }

    if (!env.GROQ_API_KEY) return json(500, { error: 'GROQ_API_KEY não configurada no Worker' });

    let body;
    try { body = await request.json(); } catch (e) { return json(400, { error: 'JSON inválido' }); }

    const model = ALLOWED_MODELS.includes(body.model) ? body.model : ALLOWED_MODELS[0];
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (!messages.length) return json(400, { error: 'messages obrigatório' });
    const temperature = typeof body.temperature === 'number' ? body.temperature : 0.7;
    const max_tokens = Math.min(typeof body.max_tokens === 'number' ? body.max_tokens : 2048, 4096);

    try {
      const r = await fetch(GROQ_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + env.GROQ_API_KEY },
        body: JSON.stringify({ model, messages, temperature, max_tokens })
      });
      const data = await r.json();
      return json(r.status, data);
    } catch (e) {
      return json(502, { error: 'Erro ao contatar a IA', detail: String(e) });
    }
  }
};
