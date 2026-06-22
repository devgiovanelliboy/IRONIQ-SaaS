/* QA E2E — fluxo da Agenda (personal cria → aluno check-in → personal vê presença)
 * Modo demo (?demo): tudo em localStorage, sem Firebase. Dirige o JS real da página.
 * Uso: node backend/qa-agenda.test.js
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PUB = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.webp': 'image/webp', '.css': 'text/css' };

function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p === '/') p = '/index.html';
      const fp = path.join(PUB, p);
      if (!fp.startsWith(PUB) || !fs.existsSync(fp) || fs.statSync(fp).isDirectory()) { res.writeHead(404); res.end('nf'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(fp)] || 'application/octet-stream' });
      fs.createReadStream(fp).pipe(res);
    });
    srv.listen(0, () => resolve(srv));
  });
}

const results = [];
function check(name, cond, detail) { results.push({ name, ok: !!cond, detail: detail || '' }); console.log((cond ? '✅' : '❌') + ' ' + name + (detail ? ' — ' + detail : '')); }

(async () => {
  const srv = await serve();
  const port = srv.address().port;
  const url = `http://localhost:${port}/index.html?demo`;
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  page.on('dialog', d => d.accept());

  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.navigate === 'function' && typeof window.agendaAddSlot === 'function', null, { timeout: 10000 });

  // Data futura (amanhã) em YYYY-MM-DD
  const amanha = await page.evaluate(() => { const d = new Date(Date.now() + 86400000); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

  // ── Bootstrap usuários (personal + aluno vinculado) ──
  await page.evaluate(() => {
    const usuarios = {
      'personal@test.com': { dados: { nome: 'Carlos', sobrenome: 'PT', perfil: 'personal', tipo: 'personal' } },
      'aluno@test.com': { dados: { nome: 'Ana', sobrenome: 'Silva', perfil: 'aluno_personal', personal_vinculado: 'personal@test.com' } }
    };
    localStorage.setItem('ironqi_usuarios', JSON.stringify(usuarios));
    localStorage.removeItem('ironqi_agenda_slots');
    localStorage.removeItem('ironqi_agenda_checkins');
  });

  // ── 1) PERSONAL cria um horário individual (2 vagas) ──
  await page.evaluate(() => { localStorage.setItem('ironqi_personal_logado', 'personal@test.com'); localStorage.removeItem('ironqi_logado'); window.navigate('agenda-personal'); });
  await page.waitForSelector('#page-agenda-personal.active', { timeout: 5000 });
  await page.fill('#agenda-data', amanha);
  await page.fill('#agenda-hora', '07:00');
  await page.selectOption('#agenda-tipo', 'individual');
  await page.fill('#agenda-capacidade', '2');
  await page.fill('#agenda-titulo', 'Funcional');
  await page.click('#page-agenda-personal button.btn-primary'); // Adicionar horário
  await page.waitForTimeout(300);

  const slotCriado = await page.evaluate(() => JSON.parse(localStorage.getItem('ironqi_agenda_slots') || '[]'));
  check('Personal criou 1 horário', slotCriado.length === 1, slotCriado.length + ' slot(s)');
  check('Slot com capacidade 2 e tipo individual', slotCriado[0] && slotCriado[0].capacidade === 2 && slotCriado[0].tipo === 'individual');
  const listaPersonalAntes = await page.textContent('#agenda-personal-lista');
  check('Lista do personal mostra "0/2 vagas"', /0\/2\s*vagas/.test(listaPersonalAntes), listaPersonalAntes.replace(/\s+/g, ' ').slice(0, 120));
  const slotId = slotCriado[0] && slotCriado[0].id;

  // ── 2) ALUNO vê a agenda e marca check-in ──
  await page.evaluate(() => { localStorage.setItem('ironqi_logado', 'aluno@test.com'); localStorage.removeItem('ironqi_personal_logado'); window.navigate('agenda-aluno'); });
  await page.waitForSelector('#page-agenda-aluno.active', { timeout: 5000 });
  await page.waitForTimeout(200);
  const listaAlunoAntes = await page.textContent('#agenda-aluno-lista');
  check('Aluno vê o horário do personal', /Funcional/.test(listaAlunoAntes) && /2 vaga/.test(listaAlunoAntes), listaAlunoAntes.replace(/\s+/g, ' ').slice(0, 120));
  check('Aluno tem botão Check-in', await page.locator('#agenda-aluno-lista button:has-text("Check-in")').count() > 0);

  await page.click('#agenda-aluno-lista button:has-text("Check-in")');
  await page.waitForTimeout(300);
  const listaAlunoDepois = await page.textContent('#agenda-aluno-lista');
  check('Aluno confirmado após check-in', /confirmado/i.test(listaAlunoDepois));
  check('Vaga decrementou para "1 vaga"', /1 vaga/.test(listaAlunoDepois), listaAlunoDepois.replace(/\s+/g, ' ').slice(0, 120));
  const ckSalvo = await page.evaluate(() => JSON.parse(localStorage.getItem('ironqi_agenda_checkins') || '[]'));
  check('Check-in gravado com o aluno correto', ckSalvo.length === 1 && ckSalvo[0].alunoEmail === 'aluno@test.com' && ckSalvo[0].slotId === slotId);

  // ── 3) PERSONAL vê a presença do aluno ──
  await page.evaluate(() => { localStorage.setItem('ironqi_personal_logado', 'personal@test.com'); localStorage.removeItem('ironqi_logado'); window.navigate('agenda-personal'); });
  await page.waitForSelector('#page-agenda-personal.active', { timeout: 5000 });
  await page.waitForTimeout(200);
  const listaPersonalDepois = await page.textContent('#agenda-personal-lista');
  check('Personal vê o nome do aluno na presença', /Ana Silva/.test(listaPersonalDepois), listaPersonalDepois.replace(/\s+/g, ' ').slice(0, 140));
  check('Personal vê "1/2 vagas" após o check-in', /1\/2\s*vagas/.test(listaPersonalDepois));

  // ── 4) ALUNO cancela o check-in ──
  await page.evaluate(() => { localStorage.setItem('ironqi_logado', 'aluno@test.com'); localStorage.removeItem('ironqi_personal_logado'); window.navigate('agenda-aluno'); });
  await page.waitForSelector('#page-agenda-aluno.active', { timeout: 5000 });
  await page.waitForTimeout(200);
  await page.click('#agenda-aluno-lista button:has-text("Cancelar check-in")');
  await page.waitForTimeout(300);
  const ckAposCancel = await page.evaluate(() => JSON.parse(localStorage.getItem('ironqi_agenda_checkins') || '[]'));
  check('Check-in removido após cancelar', ckAposCancel.length === 0);

  check('Nenhum erro de runtime no console/página', errors.length === 0, errors.slice(0, 5).join(' | '));

  await browser.close();
  srv.close();

  const fails = results.filter(r => !r.ok);
  console.log('\n──────────────────────────────');
  console.log(`RESULTADO: ${results.length - fails.length}/${results.length} checks passaram.`);
  if (errors.length) { console.log('\nErros capturados:'); errors.forEach(e => console.log('  • ' + e)); }
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FALHA NO HARNESS:', e); process.exit(2); });
