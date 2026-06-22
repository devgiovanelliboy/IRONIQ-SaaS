#!/usr/bin/env node
/**
 * IRONQI — Atribuição de papéis privilegiados (caminho confiável)
 * ===============================================================
 * As regras do Firestore agora IMPEDEM que um usuário se auto-promova a
 * `perfil: 'admin'` ou `tipoPersonal: 'personal_interno' | 'personal_principal'`
 * gravando o próprio documento (anti-escalação — ver firestore.rules).
 *
 * Logo, papéis privilegiados só podem ser atribuídos por aqui, via Admin SDK,
 * que roda num ambiente confiável (sua máquina / CI) com uma service account e
 * IGNORA as regras de segurança.
 *
 * Define tanto o campo no documento (`usuarios/{uid}`) — usado hoje pelas regras —
 * quanto um custom claim no token de auth (defesa em profundidade / futuro).
 *
 * ── Setup ───────────────────────────────────────────────────────────────────
 *   1. No Firebase Console → Configurações do projeto → Contas de serviço →
 *      "Gerar nova chave privada". Salve como backend/serviceAccount.json
 *      (NÃO comite esse arquivo — adicione ao .gitignore).
 *   2. npm install            (firebase-admin já está em package.json)
 *
 * ── Uso ─────────────────────────────────────────────────────────────────────
 *   node backend/admin-roles.js set-admin     <email>
 *   node backend/admin-roles.js unset-admin   <email>
 *   node backend/admin-roles.js set-tipo      <email> <personal|personal_interno|personal_principal>
 *   node backend/admin-roles.js set-principal <email>     (atalho: vira o Personal Principal)
 *   node backend/admin-roles.js whoami        <email>     (mostra papel atual)
 *
 * Exemplos:
 *   node backend/admin-roles.js set-tipo joao@x.com personal_interno
 *   node backend/admin-roles.js set-principal lukas@x.com
 */

'use strict';

const path = require('path');
const admin = require('firebase-admin');

const PROJECT_ID = 'ironiq-e9f7e';
const TIPOS_VALIDOS = ['personal', 'personal_interno', 'personal_principal'];

function initAdmin() {
  // Aceita GOOGLE_APPLICATION_CREDENTIALS ou backend/serviceAccount.json
  let credential;
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    credential = admin.credential.applicationDefault();
  } else {
    let sa;
    try {
      sa = require(path.join(__dirname, 'serviceAccount.json'));
    } catch (e) {
      console.error('\n❌ Service account não encontrada.');
      console.error('   Salve backend/serviceAccount.json ou defina GOOGLE_APPLICATION_CREDENTIALS.\n');
      process.exit(1);
    }
    credential = admin.credential.cert(sa);
  }
  admin.initializeApp({ credential, projectId: PROJECT_ID });
}

async function getUid(email) {
  const user = await admin.auth().getUserByEmail(email);
  return user.uid;
}

const db = () => admin.firestore();
const userDoc = (uid) => db().collection('usuarios').doc(uid);

async function mergeClaims(uid, patch) {
  const user = await admin.auth().getUser(uid);
  const claims = Object.assign({}, user.customClaims || {}, patch);
  // Remove chaves nulas para manter o token enxuto
  Object.keys(claims).forEach((k) => { if (claims[k] === null) delete claims[k]; });
  await admin.auth().setCustomUserClaims(uid, claims);
  return claims;
}

async function setAdmin(email, on) {
  const uid = await getUid(email);
  await userDoc(uid).set({ perfil: on ? 'admin' : 'aluno_autonomo' }, { merge: true });
  await mergeClaims(uid, { admin: on ? true : null });
  console.log(`✅ ${email}: perfil ${on ? '→ admin' : 'removido de admin'} (claim admin=${on}).`);
  console.log('   ⚠️  O usuário precisa relogar para o novo token/claim valer.');
}

async function setTipo(email, tipo) {
  if (!TIPOS_VALIDOS.includes(tipo)) {
    console.error(`❌ Tipo inválido: ${tipo}. Use um de: ${TIPOS_VALIDOS.join(', ')}`);
    process.exit(1);
  }
  const uid = await getUid(email);
  await userDoc(uid).set({ tipoPersonal: tipo }, { merge: true });
  await mergeClaims(uid, { tipoPersonal: tipo });
  console.log(`✅ ${email}: tipoPersonal → ${tipo}.`);

  if (tipo === 'personal_principal') {
    await promoverPrincipal(email, uid);
  }
}

async function promoverPrincipal(email, uid) {
  const cfgRef = db().collection('configuracoes').doc('sistema');
  const cfg = await cfgRef.get();
  const anterior = cfg.exists ? (cfg.data().personalPrincipal || '') : '';

  // Rebaixa o Principal anterior para interno (se houver e for diferente)
  if (anterior && anterior !== email) {
    try {
      const antigoUid = await getUid(anterior);
      await userDoc(antigoUid).set({ tipoPersonal: 'personal_interno' }, { merge: true });
      await mergeClaims(antigoUid, { tipoPersonal: 'personal_interno' });
      console.log(`   ↳ ${anterior} rebaixado para personal_interno.`);
    } catch (e) {
      console.warn(`   ⚠️  Não consegui rebaixar o Principal anterior (${anterior}): ${e.message}`);
    }
  }

  await cfgRef.set({ personalPrincipal: email }, { merge: true });
  console.log(`✅ configuracoes/sistema.personalPrincipal → ${email}.`);
  console.log('   Novos alunos autônomos passam a ser direcionados a ele.');
}

async function whoami(email) {
  const uid = await getUid(email);
  const doc = await userDoc(uid).get();
  const d = doc.exists ? doc.data() : {};
  const user = await admin.auth().getUser(uid);
  console.log(`\n${email} (uid ${uid})`);
  console.log(`  doc.perfil       = ${d.perfil || '(vazio)'}`);
  console.log(`  doc.tipoPersonal = ${d.tipoPersonal || '(vazio)'}`);
  console.log(`  claims           = ${JSON.stringify(user.customClaims || {})}\n`);
}

async function main() {
  const [cmd, email, arg] = process.argv.slice(2);
  if (!cmd || !email) {
    console.log('Uso: node backend/admin-roles.js <comando> <email> [arg]');
    console.log('Comandos: set-admin | unset-admin | set-tipo <tipo> | set-principal | whoami');
    process.exit(1);
  }
  initAdmin();
  try {
    switch (cmd) {
      case 'set-admin':     await setAdmin(email, true);  break;
      case 'unset-admin':   await setAdmin(email, false); break;
      case 'set-tipo':      await setTipo(email, arg);    break;
      case 'set-principal': await setTipo(email, 'personal_principal'); break;
      case 'whoami':        await whoami(email);          break;
      default:
        console.error(`❌ Comando desconhecido: ${cmd}`);
        process.exit(1);
    }
  } catch (e) {
    console.error(`❌ Erro: ${e.message}`);
    process.exit(1);
  }
  process.exit(0);
}

main();
