#!/usr/bin/env node
/**
 * IRONIQ — Backfill de custom claims (Layer B)
 * ============================================
 * Espelha os papéis que HOJE vivem no documento usuarios/{uid}
 * (perfil:'admin' e tipoPersonal) para custom claims no token de auth,
 * SEM efeitos colaterais (não altera configuracoes/sistema, não rebaixa ninguém).
 *
 * Idempotente: rodar várias vezes é seguro.
 *
 *   node backend/backfill-claims.js          (aplica)
 *   node backend/backfill-claims.js --dry     (só mostra o que faria)
 *
 * IMPORTANTE: claims só entram no token quando o usuário gera um token novo
 * (relogin) ou após o refresh automático (até ~1h). Avise os privilegiados
 * para relogar depois de migrar as regras.
 */
'use strict';

const path = require('path');
const { initializeApp, cert } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

const PROJECT_ID = 'ironiq-e9f7e';
const DRY = process.argv.includes('--dry');

let sa;
try {
  sa = require(path.join(__dirname, 'serviceAccount.json'));
} catch (e) {
  console.error('\n❌ backend/serviceAccount.json não encontrado.\n');
  process.exit(1);
}
initializeApp({ credential: cert(sa), projectId: PROJECT_ID });

async function main() {
  const db = getFirestore();
  const snap = await db.collection('usuarios').get();
  let tocados = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const email = d.email || '(sem email)';
    const desejado = {};
    if (d.perfil === 'admin') desejado.admin = true;
    if (d.tipoPersonal === 'personal_interno' || d.tipoPersonal === 'personal_principal') {
      desejado.tipoPersonal = d.tipoPersonal;
    }
    // Nada privilegiado → garante que não há claim sobrando
    const temPrivilegio = Object.keys(desejado).length > 0;

    let user;
    try {
      user = await getAuth().getUser(doc.id);
    } catch (e) {
      console.warn(`⚠️  ${email}: sem conta de Auth (uid ${doc.id}) — pulado.`);
      continue;
    }
    const atuais = user.customClaims || {};

    // Monta o conjunto final de claims: mantém o que não gerenciamos,
    // aplica os papéis privilegiados e remove os que não valem mais.
    const finais = Object.assign({}, atuais);
    ['admin', 'tipoPersonal'].forEach((k) => { delete finais[k]; });
    Object.assign(finais, desejado);

    const mudou = JSON.stringify(normaliza(atuais)) !== JSON.stringify(normaliza(finais));
    if (!mudou) continue;

    tocados++;
    const resumo = temPrivilegio ? JSON.stringify(desejado) : '(sem claims privilegiados)';
    if (DRY) {
      console.log(`• ${email}: ${JSON.stringify(atuais)}  ->  ${JSON.stringify(finais)}   ${resumo}`);
    } else {
      await getAuth().setCustomUserClaims(doc.id, finais);
      console.log(`✅ ${email}: claims ${resumo}`);
    }
  }

  console.log(`\n${DRY ? '[dry-run] ' : ''}${tocados} usuário(s) ${DRY ? 'seriam atualizados' : 'atualizados'}.`);
  if (!DRY && tocados > 0) {
    console.log('⚠️  Os usuários privilegiados precisam RELOGAR para o claim entrar no token.');
  }
  process.exit(0);
}

function normaliza(o) {
  const r = {};
  Object.keys(o).sort().forEach((k) => { r[k] = o[k]; });
  return r;
}

main().catch((e) => { console.error('❌ Erro:', e.message); process.exit(1); });
