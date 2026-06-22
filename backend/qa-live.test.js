/* QA ao vivo contra https://ironiq-e9f7e.web.app com contas reais.
 * Reproduz: (1) erro de "internet" no login do aluno; (2) clique no plano sem resposta.
 * Uso: node backend/qa-live.test.js
 */
'use strict';
const { chromium } = require('playwright');
const SITE = 'https://ironiq-e9f7e.web.app';

async function sessao(label, email, pass, afterLogin) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const log = { pageerror: [], consoleerr: [], reqfail: [], dialogs: [] };
  page.on('pageerror', e => log.pageerror.push(e.message));
  page.on('console', m => { if (m.type() === 'error') log.consoleerr.push(m.text()); });
  page.on('requestfailed', r => log.reqfail.push(r.url().slice(0, 80) + ' :: ' + (r.failure() && r.failure().errorText)));
  page.on('dialog', async d => { log.dialogs.push(d.message()); await d.accept(); });

  console.log(`\n══════════ ${label} (${email}) ══════════`);
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.fill('#auth-email', email);
  await page.fill('#auth-pass', pass);
  await page.evaluate(() => window.login());

  // espera o login resolver (sai da página de login ou aparece dialog)
  await page.waitForTimeout(7000);

  const estado = await page.evaluate(() => {
    var ativa = document.querySelector('.page.active');
    return {
      pagina: ativa ? ativa.id : '(nenhuma)',
      logado: localStorage.getItem('ironqi_logado'),
      personalLogado: localStorage.getItem('ironqi_personal_logado'),
      plano: (function(){ var e = localStorage.getItem('ironqi_logado')||localStorage.getItem('ironqi_personal_logado'); return e ? localStorage.getItem('ironqi_plano_'+e) : null; })()
    };
  });
  console.log('Após login →', JSON.stringify(estado));
  console.log('Dialogs:', JSON.stringify(log.dialogs));
  if (log.pageerror.length) console.log('PAGE ERRORS:', JSON.stringify(log.pageerror, null, 1));
  if (log.consoleerr.length) console.log('CONSOLE ERRORS:', JSON.stringify(log.consoleerr.slice(0, 8), null, 1));
  if (log.reqfail.length) console.log('REQ FAILED:', JSON.stringify(log.reqfail.slice(0, 8), null, 1));

  if (afterLogin) await afterLogin(page, log, estado);

  await browser.close();
}

(async () => {
  // PERSONAL: testar clique no plano
  await sessao('PERSONAL', 'personalteste@gmail.com', '123456', async (page, log) => {
    log.dialogs.length = 0;
    await page.evaluate(() => window.navigate('planos'));
    await page.waitForTimeout(1500);
    // tenta achar um botão de plano de personal e clicar
    const botoes = await page.evaluate(() => {
      var bs = Array.from(document.querySelectorAll('#page-planos button')).filter(b => /assinar|começar|grátis/i.test(b.textContent));
      return bs.map(b => ({ txt: b.textContent.trim(), onclick: b.getAttribute('onclick'), visivel: b.offsetParent !== null }));
    });
    console.log('Botões de plano encontrados:', JSON.stringify(botoes, null, 1));
    // clica no primeiro visível
    const idx = botoes.findIndex(b => b.visivel);
    if (idx >= 0) {
      const clicado = await page.evaluate((i) => {
        var bs = Array.from(document.querySelectorAll('#page-planos button')).filter(b => /assinar|começar|grátis/i.test(b.textContent) && b.offsetParent !== null);
        if (!bs[i]) return false; bs[i].click(); return true;
      }, idx);
      await page.waitForTimeout(2500);
      console.log('Clique no plano "' + botoes[idx].txt + '" →', clicado ? 'clicado' : 'falhou');
      console.log('Dialogs após clique:', JSON.stringify(log.dialogs));
      console.log('Página após clique:', await page.evaluate(() => { var a = document.querySelector('.page.active'); return a ? a.id : '(nenhuma)'; }));
      if (log.pageerror.length) console.log('PAGE ERRORS (clique):', JSON.stringify(log.pageerror));
    } else {
      console.log('❌ Nenhum botão de plano visível encontrado.');
    }
  });

  // ALUNO: observar o erro de login
  await sessao('ALUNO', 'alunoteste@gmail.com', '123456');
})().catch(e => { console.error('HARNESS FAIL:', e); process.exit(2); });
