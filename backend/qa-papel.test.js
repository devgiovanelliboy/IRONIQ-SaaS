'use strict';
// ════════════════════════════════════════════════════════════════════════
//  QA — Vazamento de PAPEL/IDENTIDADE entre contas (regressão).
//  Reproduz: aluno que herda a flag ironqi_personal_logado de uma sessão de
//  personal anterior -> via nav de personal e lia dados da conta errada
//  ("treino sumiu"). Valida que a fonte única _definirPapel reconcilia tudo.
//
//  Uso:  SITE=http://localhost:5050 node backend/qa-papel.test.js
// ════════════════════════════════════════════════════════════════════════
const { chromium, devices } = require('playwright');
const SITE = process.env.SITE || 'http://localhost:5050';
// Modo demo (?demo) exercita o MESMO código de roteamento/flags sem Firebase.
const A = 'aluno_start@teste.com';        // perfil aluno_autonomo (seed demo)
const P = 'lukas.athademos@gmail.com';    // perfil personal (seed demo)
const PASS = '123456';

function ok(cond, msg) {
  console.log((cond ? 'PASS' : 'FAIL') + ': ' + msg);
  if (!cond) process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  const perr = [];
  page.on('dialog', d => d.accept().catch(() => {}));
  page.on('pageerror', e => perr.push(e.message));

  async function loginAs(email) {
    await page.evaluate(() => window.navigate('login'));
    await page.waitForSelector('#auth-email', { timeout: 8000 });
    await page.fill('#auth-email', email);
    await page.fill('#auth-pass', PASS);
    await page.evaluate(() => window.login());
    await page.waitForTimeout(6500);
  }
  const visibleNav = () => page.evaluate(() => {
    function vis(id) { var e = document.getElementById(id); if (!e) return false; var s = getComputedStyle(e); return e.classList.contains('show') && s.display !== 'none'; }
    return { aluno: vis('bottom-nav'), personal: vis('bottom-nav-personal') };
  });
  const flags = () => page.evaluate(() => ({
    logado: localStorage.getItem('ironqi_logado'),
    personal: localStorage.getItem('ironqi_personal_logado'),
    admin: localStorage.getItem('ironqi_admin_logado')
  }));

  await page.goto(SITE + '/app.html?demo', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function' && typeof window.navigate === 'function', null, { timeout: 20000 });

  // ── CASO 1: personal vê nav de personal ──
  await loginAs(P);
  let nav = await visibleNav(), f = await flags();
  ok(nav.personal && !nav.aluno, 'CASO1 personal vê o nav de PERSONAL');
  ok(f.personal === P, 'CASO1 flag ironqi_personal_logado = personal');

  // ── CASO 2: troca para aluno (sem logout limpo) ──
  await loginAs(A);
  nav = await visibleNav(); f = await flags();
  ok(nav.aluno && !nav.personal, 'CASO2 aluno vê o nav de ALUNO (não o de personal)');
  ok(f.personal === null, 'CASO2 flag de personal foi limpa ao virar aluno');
  ok((f.personal || f.logado) === A && (f.logado || f.personal) === A, 'CASO2 identidade resolve para o aluno nas duas ordens de leitura');

  // ── CASO 3: flag de personal PRESA + reload (reproduz o bug do autologin) ──
  await page.evaluate((p) => {
    localStorage.setItem('ironqi_personal_logado', p);     // flag presa de sessão anterior
    localStorage.setItem('ironqi_admin_logado', 'ghost_admin@x.com');
  }, P);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.navigate === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(7000);
  nav = await visibleNav(); f = await flags();
  ok(f.logado === A, 'CASO3 continua logado como aluno após reload');
  ok(f.personal === null, 'CASO3 flag de personal PRESA foi reconciliada (limpa)');
  ok(f.admin === null, 'CASO3 flag de admin fantasma foi limpa');
  ok(nav.aluno && !nav.personal, 'CASO3 nav volta para ALUNO (bug corrigido)');
  ok((f.personal || f.logado) === A && (f.logado || f.personal) === A, 'CASO3 identidade consistente nas duas ordens (treino não some)');

  // ── CASO 4: flag de personal de OUTRA conta (email != logado) — invariante ──
  // Reproduz Safari/PWA que já logou um personal antes: a flag fica presa com o
  // email do personal antigo enquanto ironqi_logado já é o aluno.
  await page.evaluate((a) => {
    localStorage.setItem('ironqi_logado', a);
    localStorage.setItem('ironqi_personal_logado', 'ghost_personal@x.com'); // email DIFERENTE
    localStorage.setItem('ironqi_admin_logado', 'ghost_admin@x.com');
    window._sanearFlagsPapel();
  }, A);
  let f4 = await flags();
  ok(f4.personal === null, 'CASO4 flag de personal de OUTRA conta removida (invariante email==logado)');
  ok(f4.admin === null, 'CASO4 flag de admin de OUTRA conta removida');
  ok(f4.logado === A, 'CASO4 identidade do aluno preservada');

  // ── CASO 5: cache SEM o perfil + flag de personal presa -> nav deve ser ALUNO ──
  // É o buraco que o diagnóstico antigo não pegava (ele limpava o localStorage).
  await page.evaluate((a) => {
    localStorage.setItem('ironqi_personal_logado', 'ghost_personal@x.com');
    var u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}');
    delete u[a];                       // _perfilDoCache(a) passa a retornar ''
    localStorage.setItem('ironqi_usuarios', JSON.stringify(u));
    // A nav é decidida no início de navigate(); um erro de init de página
    // (ex.: hidratação sem dados de usuário no cache) vem DEPOIS — blinda.
    try { window.navigate('dashboard'); } catch (e) {}
  }, A);
  await page.waitForTimeout(900);
  let nav5 = await visibleNav(), f5 = await flags();
  ok(nav5.aluno && !nav5.personal, 'CASO5 cache sem perfil + flag presa -> nav volta para ALUNO');
  ok(f5.personal === null, 'CASO5 flag de personal de outra conta foi saneada no navigate()');

  if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr.slice(0, 5)));
  await browser.close();
  console.log(process.exitCode ? '\n❌ FALHOU' : '\n✅ TODOS OS CASOS PASSARAM');
})().catch(e => { console.error('FAIL runner:', e && e.message); process.exit(2); });
