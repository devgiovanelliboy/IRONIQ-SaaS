'use strict';
// Reproduz NO SITE LIVE o cenário do Safari/PWA infectado: aluno logado de verdade,
// mas com a flag ironqi_personal_logado PRESA de uma sessão de personal anterior
// (email diferente) e o cache de perfil ausente. Prova que o nav volta para ALUNO.
const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { chromium, devices } = require('playwright');

const EMAIL = process.argv[2] || 'danilo44giovanelli@gmail.com';
const SITE = process.env.SITE || 'https://ironiq-e9f7e.web.app';

(async () => {
  initializeApp({ credential: cert(require(path.join(__dirname, 'serviceAccount.json'))), projectId: 'ironiq-e9f7e' });
  const user = await getAuth().getUserByEmail(EMAIL);
  const token = await getAuth().createCustomToken(user.uid);

  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  page.on('dialog', d => d.accept().catch(() => {}));

  await page.goto(SITE + '/app.html', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await page.waitForFunction(() => typeof window.firebase !== 'undefined' && firebase.auth, null, { timeout: 20000 });
  await page.evaluate(t => firebase.auth().signInWithCustomToken(t), token);
  await page.waitForTimeout(8000);

  // confirma que _sanearFlagsPapel chegou no deploy (prova que v23 carrega o fix)
  const temFix = await page.evaluate(() => typeof window._sanearFlagsPapel === 'function');

  // INJETA o cenário do bug: flag de personal de OUTRA conta + apaga perfil do cache
  await page.evaluate((email) => {
    localStorage.setItem('ironqi_personal_logado', 'ghost_personal@x.com'); // email DIFERENTE
    localStorage.setItem('ironqi_admin_logado', 'ghost_admin@x.com');
    var u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}');
    delete u[email]; // _perfilDoCache(email) -> ''
    localStorage.setItem('ironqi_usuarios', JSON.stringify(u));
    try { window.navigate('dashboard'); } catch (e) {}
  }, EMAIL);
  await page.waitForTimeout(1500);

  const st = await page.evaluate(() => {
    function vis(id) { var e = document.getElementById(id); if (!e) return false; var s = getComputedStyle(e); return e.classList.contains('show') && s.display !== 'none'; }
    return {
      navAluno: vis('bottom-nav'),
      navPersonal: vis('bottom-nav-personal'),
      personal_flag: localStorage.getItem('ironqi_personal_logado'),
      admin_flag: localStorage.getItem('ironqi_admin_logado'),
      logado: localStorage.getItem('ironqi_logado')
    };
  });

  const ok = st.navAluno && !st.navPersonal && st.personal_flag === null && st.admin_flag === null;
  console.log('fix presente (v23):', temFix);
  console.log('RESULTADO:', JSON.stringify(st, null, 2));
  console.log(ok ? '\n✅ LIVE OK: flag presa saneada, nav = ALUNO' : '\n❌ LIVE FALHOU');
  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e && e.message); process.exit(2); });
