'use strict';
const { chromium, devices } = require('playwright');
const SITE = 'https://ironiq-e9f7e.web.app';

async function loginPersonal(page) {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.fill('#auth-email', 'personalteste@gmail.com');
  await page.fill('#auth-pass', '123456');
  await page.evaluate(() => window.login());
  await page.waitForTimeout(7000);
}

(async () => {
  const browser = await chromium.launch();

  // Mobile: clicar no CORPO do card (não no botão)
  const ctx = await browser.newContext({ ...devices['iPhone 12'] });
  const page = await ctx.newPage();
  const dialogs = []; const perr = [];
  page.on('dialog', async d => { dialogs.push(d.message()); await d.accept(); });
  page.on('pageerror', e => perr.push(e.message));
  await loginPersonal(page);
  await page.evaluate(() => window.navigate('planos'));
  await page.waitForTimeout(1200);
  // limpa plano pra observar a mudança
  await page.evaluate(() => localStorage.removeItem('ironqi_plano_personalteste@gmail.com'));

  // Localiza o card do "Assinar PRO" (personal) e clica no TÍTULO/preço, não no botão
  const card = page.locator('#page-planos .plan-card:visible', { has: page.locator('button', { hasText: 'Assinar PRO' }) }).first();
  console.log('Card PRO visível?', await card.count() > 0);
  const alvo = card.locator('.price').first();
  await alvo.scrollIntoViewIfNeeded();
  await alvo.click({ timeout: 5000 }); // clique no PREÇO (corpo do card)
  await page.waitForTimeout(2500);
  console.log('Dialogs após clicar no CORPO do card:', JSON.stringify(dialogs));
  console.log('Plano salvo:', await page.evaluate(() => localStorage.getItem('ironqi_plano_personalteste@gmail.com')));
  console.log('Página:', await page.evaluate(() => { var a = document.querySelector('.page.active'); return a ? a.id : '?'; }));
  if (perr.length) console.log('PAGE ERRORS:', JSON.stringify(perr));

  const ok = dialogs.some(d => /ativada com sucesso/i.test(d));
  console.log('\n' + (ok ? '✅ Clique no corpo do card seleciona o plano' : '❌ Card não respondeu'));

  await browser.close();
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('FAIL:', e); process.exit(2); });
