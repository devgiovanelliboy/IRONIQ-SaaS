'use strict';
const { chromium } = require('playwright');
const SITE = 'https://ironiq-e9f7e.web.app';

async function login(page, email, pass, log) {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function', null, { timeout: 15000 });
  // Instrumenta erros não capturados e rejeições de promise
  await page.evaluate(() => {
    window.__errs = [];
    window.addEventListener('error', e => window.__errs.push('error: ' + (e.message || e.error)));
    window.addEventListener('unhandledrejection', e => window.__errs.push('unhandledrejection: ' + (e.reason && (e.reason.message || e.reason.code || e.reason))));
  });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.fill('#auth-email', email);
  await page.fill('#auth-pass', pass);
  await page.evaluate(() => window.login());
  await page.waitForTimeout(7000);
}

(async () => {
  const browser = await chromium.launch();

  // ─── PERSONAL: clicar de verdade no botão visível ───
  {
    const page = await (await browser.newContext()).newPage();
    const dialogs = [], perr = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    page.on('pageerror', e => perr.push(e.message));
    console.log('\n══════ PERSONAL — clique no plano ══════');
    await login(page, 'personalteste@gmail.com', '123456', {});
    await page.evaluate(() => window.navigate('planos'));
    await page.waitForTimeout(1200);
    const btn = page.locator('#page-planos button:visible', { hasText: 'Assinar PRO' }).first();
    const n = await btn.count();
    console.log('Botão "Assinar PRO" visível?', n > 0);
    let clickErr = null;
    try {
      await btn.click({ timeout: 4000 });
    } catch (e) { clickErr = e.message.split('\n')[0]; }
    await page.waitForTimeout(2500);
    const planoDepois = await page.evaluate(() => localStorage.getItem('ironqi_plano_personalteste@gmail.com'));
    const pagDepois = await page.evaluate(() => { var a = document.querySelector('.page.active'); return a ? a.id : '?'; });
    console.log('Erro de clique (cobertura/actionability):', clickErr || 'nenhum');
    console.log('Dialogs após clique:', JSON.stringify(dialogs));
    console.log('Plano salvo após clique:', planoDepois);
    console.log('Página após clique:', pagDepois);
    console.log('window.__errs:', JSON.stringify(await page.evaluate(() => window.__errs || [])));
    if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr));
  }

  // ─── ALUNO: capturar a exceção do login ───
  {
    const page = await (await browser.newContext()).newPage();
    const dialogs = [], perr = [];
    page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
    page.on('pageerror', e => perr.push(e.message));
    console.log('\n══════ ALUNO — erro no login ══════');
    await login(page, 'alunoteste@gmail.com', '123456', {});
    console.log('Dialogs:', JSON.stringify(dialogs));
    console.log('window.__errs:', JSON.stringify(await page.evaluate(() => window.__errs || [])));
    if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr));
    const info = await page.evaluate(() => {
      var e = localStorage.getItem('ironqi_logado');
      var u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}');
      return { email: e, perfil: (u[e] && u[e].dados) ? (u[e].dados.perfil || u[e].dados.tipo) : null, personal_vinculado: (u[e] && u[e].dados) ? u[e].dados.personal_vinculado : null };
    });
    console.log('Aluno após login:', JSON.stringify(info));
  }

  await browser.close();
})().catch(e => { console.error('HARNESS FAIL:', e); process.exit(2); });
