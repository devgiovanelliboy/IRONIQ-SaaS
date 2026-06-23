'use strict';
// Reproduz no MOTOR REAL do iOS (WebKit) + viewport de iPhone, login fresco
// (igual abrir no Chrome/Safari do iPhone zerado). Captura POR QUE aparece personal.
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { webkit, devices } = require('playwright');

const EMAIL = process.argv[2] || 'danilo44giovanelli@gmail.com';
const SITE = process.env.SITE || 'https://ironiq-e9f7e.web.app';

(async () => {
  initializeApp({ credential: cert(require(path.join(__dirname, 'serviceAccount.json'))), projectId: 'ironiq-e9f7e' });
  const user = await getAuth().getUserByEmail(EMAIL);
  const token = await getAuth().createCustomToken(user.uid);

  const browser = await webkit.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  const perr = [];
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => perr.push(e.message));

  await page.goto(SITE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.waitForFunction(() => typeof window.firebase !== 'undefined' && firebase.auth, null, { timeout: 25000 });
  await page.evaluate(t => firebase.auth().signInWithCustomToken(t), token);
  await page.waitForTimeout(9000);

  const st = await page.evaluate((email) => {
    function info(id) {
      var e = document.getElementById(id);
      if (!e) return { exists: false };
      var s = getComputedStyle(e);
      return { exists: true, hasShow: e.classList.contains('show'), display: s.display, visibility: s.visibility };
    }
    var u = {};
    try { u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}'); } catch (e) {}
    var d = u[email] ? (u[email].dados || {}) : {};
    return {
      innerWidth: window.innerWidth,
      ua: navigator.userAgent,
      activePage: (document.querySelector('.page.active') || {}).id || null,
      ultima_pagina: localStorage.getItem('ultima_pagina'),
      bottomNavAluno: info('bottom-nav'),
      bottomNavPersonal: info('bottom-nav-personal'),
      sidebarAluno: info('sidebar-nav'),
      sidebarPersonal: info('sidebar-nav-personal'),
      ironqi_logado: localStorage.getItem('ironqi_logado'),
      personal_flag: localStorage.getItem('ironqi_personal_logado'),
      admin_flag: localStorage.getItem('ironqi_admin_logado'),
      cache_perfil: d.perfil || null,
      cache_tipo: d.tipo || null
    };
  }, EMAIL);

  console.log('RESULTADO WEBKIT (iPhone):\n', JSON.stringify(st, null, 2));
  if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr.slice(0, 6)));
  await browser.close();
  process.exit(0);
})().catch(e => { console.error('FAIL:', e && e.message); process.exit(2); });
