'use strict';
const { chromium, devices } = require('playwright');
const SITE = 'https://ironiq-e9f7e.web.app';
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  const dialogs = [], perr = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  page.on('pageerror', e => perr.push(e.message));
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.fill('#auth-email', 'personalteste@gmail.com');
  await page.fill('#auth-pass', '123456');
  await page.evaluate(() => window.login());
  await page.waitForTimeout(7000);
  await page.evaluate(() => window.navigate('planos'));
  await page.waitForTimeout(1200);

  const btn = page.locator('#page-planos button:visible', { hasText: 'Assinar PRO' }).first();
  console.log('Viewport: iPhone 12 (mobile)');
  console.log('Botão "Assinar PRO" visível?', await btn.count() > 0);
  // O que está no ponto central do botão? (detecta overlay cobrindo)
  const cobertura = await page.evaluate(() => {
    var bs = Array.from(document.querySelectorAll('#page-planos button')).filter(b => /Assinar PRO/.test(b.textContent) && b.offsetParent !== null);
    if (!bs.length) return 'sem botão visível';
    var b = bs[0]; var r = b.getBoundingClientRect();
    var topo = document.elementFromPoint(r.left + r.width/2, r.top + r.height/2);
    return { botao: b.outerHTML.slice(0,60), noPonto: topo ? (topo.tagName + '.' + topo.className).slice(0,80) : 'null', ehOBotao: topo === b || b.contains(topo) };
  });
  console.log('Cobertura no ponto do botão:', JSON.stringify(cobertura, null, 1));
  let clickErr = null;
  try { await btn.click({ timeout: 4000 }); } catch (e) { clickErr = e.message.split('\n')[0]; }
  await page.waitForTimeout(2000);
  console.log('Erro de clique:', clickErr || 'nenhum');
  console.log('Dialogs após clique:', JSON.stringify(dialogs));
  console.log('Plano salvo:', await page.evaluate(() => localStorage.getItem('ironqi_plano_personalteste@gmail.com')));
  if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr));
  await browser.close();
})().catch(e => { console.error('FAIL:', e); process.exit(2); });
