/* QA E2E AO VIVO — Agenda contra Firestore real (regras de produção).
 * personalteste cria horário → alunoteste (vinculado) vê e marca check-in → personal confirma.
 * Limpa os dados de teste ao final. Uso: node backend/qa-agenda-live.test.js
 */
'use strict';
const { chromium } = require('playwright');
const SITE = 'https://ironiq-e9f7e.web.app';
const TITULO = 'QA Presencial ' + Date.now().toString(36);

const results = [];
function check(name, cond, detail) { results.push(!!cond); console.log((cond ? '✅' : '❌') + ' ' + name + (detail ? ' — ' + detail : '')); }

async function novoCtx(browser, tag) {
  const page = await (await browser.newContext()).newPage();
  const logs = [];
  page.on('console', m => { const t = m.type(); if (t === 'error' || t === 'warning') logs.push('[' + tag + '] ' + t + ': ' + m.text().slice(0, 160)); });
  page.on('pageerror', e => logs.push('[' + tag + '] pageerror: ' + e.message));
  page.on('dialog', async d => { await d.accept(); });
  page._logs = logs;
  return page;
}

async function login(page, email) {
  await page.goto(SITE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.login === 'function', null, { timeout: 15000 });
  await page.evaluate(() => window.navigate('login'));
  await page.waitForSelector('#auth-email', { timeout: 5000 });
  await page.fill('#auth-email', email);
  await page.fill('#auth-pass', '123456');
  await page.evaluate(() => window.login());
  await page.waitForTimeout(7000);
}

(async () => {
  const browser = await chromium.launch();
  const pPersonal = await novoCtx(browser, 'PERSONAL');
  const pAluno = await novoCtx(browser, 'ALUNO');

  // ── 1) PERSONAL cria o horário ──
  console.log('\n── 1) Personal cria horário (' + TITULO + ') ──');
  await login(pPersonal, 'personalteste@gmail.com');
  await pPersonal.evaluate(() => window.navigate('agenda-personal'));
  await pPersonal.waitForSelector('#page-agenda-personal.active', { timeout: 8000 });
  const amanha = await pPersonal.evaluate(() => { const d = new Date(Date.now() + 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
  await pPersonal.fill('#agenda-data', amanha);
  await pPersonal.fill('#agenda-hora', '08:00');
  await pPersonal.selectOption('#agenda-tipo', 'individual');
  await pPersonal.fill('#agenda-capacidade', '3');
  await pPersonal.fill('#agenda-titulo', TITULO);
  await pPersonal.click('#page-agenda-personal button.btn-primary');
  await pPersonal.waitForTimeout(3500); // espera write no Firestore
  const slot = await pPersonal.evaluate((t) => (JSON.parse(localStorage.getItem('ironqi_agenda_slots') || '[]')).find(s => s.titulo === t), TITULO);
  check('Personal criou o horário (local)', !!slot, slot ? slot.id : 'não encontrado');
  const slotId = slot && slot.id;
  // Confirma persistência no Firestore: re-navega e re-sincroniza do servidor
  await pPersonal.evaluate(() => { localStorage.removeItem('ironqi_agenda_slots'); localStorage.removeItem('ironqi_agenda_checkins'); window.navigate('dashboard'); window.navigate('agenda-personal'); });
  await pPersonal.waitForTimeout(3500);
  const slotFs = await pPersonal.evaluate((t) => (JSON.parse(localStorage.getItem('ironqi_agenda_slots') || '[]')).find(s => s.titulo === t), TITULO);
  check('Horário persistiu no Firestore (re-sync do servidor)', !!slotFs, slotFs ? slotFs.id : 'sumiu após limpar cache');

  // ── 2) ALUNO vê e marca check-in ──
  console.log('\n── 2) Aluno vinculado vê e marca check-in ──');
  await login(pAluno, 'alunoteste@gmail.com');
  const vinc = await pAluno.evaluate(() => { var e = localStorage.getItem('ironqi_logado'); var u = JSON.parse(localStorage.getItem('ironqi_usuarios') || '{}'); return (u[e] && u[e].dados) ? u[e].dados.personal_vinculado : null; });
  check('Aluno está vinculado ao personalteste', vinc === 'personalteste@gmail.com', 'personal_vinculado=' + vinc);
  await pAluno.evaluate(() => window.navigate('agenda-aluno'));
  await pAluno.waitForSelector('#page-agenda-aluno.active', { timeout: 8000 });
  await pAluno.waitForTimeout(3500); // sync do Firestore
  const textoAluno = await pAluno.textContent('#agenda-aluno-lista');
  check('Aluno enxerga o horário do personal (Firestore)', textoAluno.indexOf(TITULO) !== -1, textoAluno.replace(/\s+/g, ' ').slice(0, 120));

  const cardAluno = pAluno.locator('#agenda-aluno-lista .card', { hasText: TITULO });
  const btnCheckin = cardAluno.locator('button', { hasText: 'Check-in' });
  check('Botão Check-in disponível', await btnCheckin.count() > 0);
  if (await btnCheckin.count() > 0) {
    await btnCheckin.first().click();
    await pAluno.waitForTimeout(3500); // transação no Firestore
  }
  const textoAlunoDepois = await pAluno.textContent('#agenda-aluno-lista');
  check('Aluno confirmado após check-in', /confirmado/i.test(textoAlunoDepois));
  // Re-sync do servidor para confirmar persistência do check-in
  await pAluno.evaluate(() => { localStorage.removeItem('ironqi_agenda_slots'); localStorage.removeItem('ironqi_agenda_checkins'); window.navigate('dashboard'); window.navigate('agenda-aluno'); });
  await pAluno.waitForTimeout(3500);
  const textoAlunoResync = await pAluno.textContent('#agenda-aluno-lista');
  check('Check-in persistiu no Firestore (re-sync)', /confirmado/i.test(textoAlunoResync));

  // ── 3) PERSONAL vê a presença ──
  console.log('\n── 3) Personal vê a presença do aluno ──');
  await pPersonal.evaluate(() => { localStorage.removeItem('ironqi_agenda_slots'); localStorage.removeItem('ironqi_agenda_checkins'); window.navigate('dashboard'); window.navigate('agenda-personal'); });
  await pPersonal.waitForTimeout(4000); // sync slots + checkins do servidor
  const textoPersonal = await pPersonal.textContent('#agenda-personal-lista');
  const blocoSlot = textoPersonal.split('Excluir').find(b => b.indexOf(TITULO) !== -1) || textoPersonal;
  check('Personal vê 1/3 vagas (check-in contabilizado)', /1\/3\s*vagas/.test(blocoSlot), blocoSlot.replace(/\s+/g, ' ').slice(0, 140));
  check('Personal lê a lista de presença (não "Ninguém marcou")', blocoSlot.indexOf(TITULO) !== -1 && !/Ninguém marcou/.test(blocoSlot));

  // ── 4) Limpeza: aluno cancela, personal exclui ──
  console.log('\n── 4) Limpeza dos dados de teste ──');
  await pAluno.evaluate(() => window.navigate('agenda-aluno'));
  await pAluno.waitForTimeout(2500);
  const btnCancel = pAluno.locator('#agenda-aluno-lista .card', { hasText: TITULO }).locator('button', { hasText: 'Cancelar' });
  if (await btnCancel.count() > 0) { await btnCancel.first().click(); await pAluno.waitForTimeout(2500); }
  if (slotId) { await pPersonal.evaluate((id) => window.agendaExcluirSlot(id), slotId); await pPersonal.waitForTimeout(2500); }
  console.log('Limpeza concluída.');

  // ── Erros capturados ──
  const allLogs = [].concat(pPersonal._logs, pAluno._logs).filter(l => /permission|denied|agenda|Erro|FirebaseError|insufficient/i.test(l));
  console.log('\n── Logs relevantes (permissão/agenda) ──');
  if (allLogs.length) allLogs.forEach(l => console.log('  • ' + l)); else console.log('  (nenhum)');
  check('Nenhum erro de permissão/agenda no console', allLogs.filter(l => /permission|denied|insufficient|FirebaseError/i.test(l)).length === 0);

  await browser.close();
  const fails = results.filter(r => !r).length;
  console.log('\n══════════════════════════════');
  console.log(`RESULTADO: ${results.length - fails}/${results.length} checks passaram.`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('HARNESS FAIL:', e); process.exit(2); });
