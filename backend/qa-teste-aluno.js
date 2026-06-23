'use strict';
// Diagnóstico não-destrutivo: loga como teste_aluno (custom token do Admin SDK)
// no site LIVE e reporta exatamente como o app o roteia.
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { chromium, devices } = require('playwright');

const EMAIL = process.argv[2] || 'teste_aluno@gmail.com';
const SITE = process.env.SITE || 'https://ironiq-e9f7e.web.app';

(async () => {
  initializeApp({ credential: cert(require(path.join(__dirname, 'serviceAccount.json'))), projectId: 'ironiq-e9f7e' });
  const user = await getAuth().getUserByEmail(EMAIL);
  const token = await getAuth().createCustomToken(user.uid);
  console.log('uid:', user.uid);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  const perr = [];
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => perr.push(e.message));

  await page.goto(SITE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.waitForFunction(() => typeof window.firebase !== 'undefined' && firebase.auth, null, { timeout: 20000 });
  await page.evaluate(t => firebase.auth().signInWithCustomToken(t), token);
  await page.waitForTimeout(9000);

  const st = await page.evaluate((email) => {
    function vis(id) { var e = document.getElementById(id); if (!e) return false; var s = getComputedStyle(e); return e.classList.contains('show') && s.display !== 'none'; }
    var u = {};
    try { u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}'); } catch (e) {}
    var d = u[email] ? (u[email].dados || {}) : {};
    return {
      activePage: (document.querySelector('.page.active') || {}).id || null,
      navAluno: vis('bottom-nav'),
      navPersonal: vis('bottom-nav-personal'),
      ironqi_logado: localStorage.getItem('ironqi_logado'),
      ironqi_personal_logado: localStorage.getItem('ironqi_personal_logado'),
      cache_perfil: d.perfil || null,
      cache_tipo: d.tipo || null,
      plano: localStorage.getItem('ironqi_plano_' + email)
    };
  }, EMAIL);

  console.log('RESULTADO:', JSON.stringify(st, null, 2));
  if (perr.length) console.log('PAGEERR:', JSON.stringify(perr.slice(0, 4)));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e && e.message); process.exit(2); });
