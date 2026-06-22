'use strict';
/**
 * Cloud Functions do IRONQI
 * - agendaCheckIn / agendaCancelCheckIn: check-in autoritativo (capacidade + contador no servidor)
 * - reconcileCheckinCount: mantém checkinCount fiel à subcoleção (trigger)
 * - setUserRole: atribuição de papéis privilegiados (admin) → doc + custom claim
 * - enforceLimiteAlunos: bloqueia vínculo de aluno acima do limite do personal (trigger)
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────
//  AGENDA — check-in autoritativo
// ─────────────────────────────────────────────────────────────
exports.agendaCheckIn = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  const slotId = req.data && req.data.slotId;
  if (!slotId) throw new HttpsError('invalid-argument', 'slotId obrigatório.');
  const uid = req.auth.uid;
  const email = req.auth.token.email;
  const slotRef = db.collection('agenda_slots').doc(slotId);
  const userRef = db.collection('usuarios').doc(uid);

  return db.runTransaction(async (tx) => {
    const [slotDoc, userDoc] = await Promise.all([tx.get(slotRef), tx.get(userRef)]);
    if (!slotDoc.exists) throw new HttpsError('not-found', 'Horário não encontrado.');
    const slot = slotDoc.data();
    const user = userDoc.exists ? userDoc.data() : {};
    if (user.personal_vinculado !== slot.personalEmail) {
      throw new HttpsError('permission-denied', 'Você não é aluno deste personal.');
    }
    const ckRef = slotRef.collection('checkins').doc(uid);
    const ckDoc = await tx.get(ckRef);
    const count = slot.checkinCount || 0;
    if (ckDoc.exists) return { ok: true, count: count, already: true };
    if (slot.tipo !== 'aulao' && count >= (slot.capacidade || 0)) {
      throw new HttpsError('resource-exhausted', 'Esgotado.');
    }
    const nome = ((user.nome || '') + ' ' + (user.sobrenome || '')).trim() || email.split('@')[0];
    tx.set(ckRef, { alunoEmail: email, alunoNome: nome, checkedInAt: admin.firestore.FieldValue.serverTimestamp() });
    tx.update(slotRef, { checkinCount: count + 1 });
    return { ok: true, count: count + 1 };
  });
});

exports.agendaCancelCheckIn = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  const slotId = req.data && req.data.slotId;
  if (!slotId) throw new HttpsError('invalid-argument', 'slotId obrigatório.');
  const uid = req.auth.uid;
  const slotRef = db.collection('agenda_slots').doc(slotId);

  return db.runTransaction(async (tx) => {
    const slotDoc = await tx.get(slotRef);
    if (!slotDoc.exists) return { ok: true, count: 0 };
    const ckRef = slotRef.collection('checkins').doc(uid);
    const ckDoc = await tx.get(ckRef);
    const count = slotDoc.data().checkinCount || 0;
    if (!ckDoc.exists) return { ok: true, count: count };
    tx.delete(ckRef);
    tx.update(slotRef, { checkinCount: Math.max(0, count - 1) });
    return { ok: true, count: Math.max(0, count - 1) };
  });
});

// Reconciliação: qualquer escrita na subcoleção de check-ins recalcula o contador real.
exports.reconcileCheckinCount = onDocumentWritten('agenda_slots/{slotId}/checkins/{ckId}', async (event) => {
  const slotRef = db.collection('agenda_slots').doc(event.params.slotId);
  try {
    const agg = await slotRef.collection('checkins').count().get();
    await slotRef.update({ checkinCount: agg.data().count });
  } catch (e) {
    console.warn('reconcileCheckinCount falhou:', e.message);
  }
});

// ─────────────────────────────────────────────────────────────
//  PAPÉIS — atribuição privilegiada (somente admin)
// ─────────────────────────────────────────────────────────────
const TIPOS_VALIDOS = ['personal', 'personal_interno', 'personal_principal'];

exports.setUserRole = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  const callerDoc = await db.collection('usuarios').doc(req.auth.uid).get();
  const isAdmin = req.auth.token.admin === true || (callerDoc.exists && callerDoc.data().perfil === 'admin');
  if (!isAdmin) throw new HttpsError('permission-denied', 'Apenas admin pode alterar papéis.');

  const data = req.data || {};
  const targetEmail = data.targetEmail;
  const tipoPersonal = data.tipoPersonal;
  const perfil = data.perfil;
  if (!targetEmail) throw new HttpsError('invalid-argument', 'targetEmail obrigatório.');
  if (tipoPersonal && TIPOS_VALIDOS.indexOf(tipoPersonal) === -1) throw new HttpsError('invalid-argument', 'tipoPersonal inválido.');

  let userRec;
  try { userRec = await admin.auth().getUserByEmail(targetEmail); }
  catch (e) { throw new HttpsError('not-found', 'Usuário não encontrado: ' + targetEmail); }
  const uid = userRec.uid;
  const update = {};
  const claims = Object.assign({}, userRec.customClaims || {});
  if (tipoPersonal) { update.tipoPersonal = tipoPersonal; claims.tipoPersonal = tipoPersonal; }
  if (perfil) { update.perfil = perfil; if (perfil === 'admin') claims.admin = true; else delete claims.admin; }

  await db.collection('usuarios').doc(uid).set(update, { merge: true });
  await admin.auth().setCustomUserClaims(uid, claims);

  if (tipoPersonal === 'personal_principal') {
    const cfgRef = db.collection('configuracoes').doc('sistema');
    const cfg = await cfgRef.get();
    const anterior = cfg.exists ? (cfg.data().personalPrincipal || '') : '';
    if (anterior && anterior !== targetEmail) {
      try {
        const a = await admin.auth().getUserByEmail(anterior);
        await db.collection('usuarios').doc(a.uid).set({ tipoPersonal: 'personal_interno' }, { merge: true });
        const ac = Object.assign({}, a.customClaims || {}, { tipoPersonal: 'personal_interno' });
        await admin.auth().setCustomUserClaims(a.uid, ac);
      } catch (e) { /* ignora */ }
    }
    await cfgRef.set({ personalPrincipal: targetEmail }, { merge: true });
  }
  return { ok: true, uid: uid };
});

// ─────────────────────────────────────────────────────────────
//  LIMITE DE ALUNOS — enforcement no vínculo (trigger)
//  Limite por personal em configuracoes/limites_alunos { <email>: N } (0 = ilimitado).
//  Se um aluno_personal exceder o limite do personal, o vínculo é revertido e o
//  aluno é marcado (bloqueadoPorLimite) para o app avisar.
// ─────────────────────────────────────────────────────────────
exports.enforceLimiteAlunos = onDocumentWritten('usuarios/{uid}', async (event) => {
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  if (!after) return;
  const personalEmail = after.personal_vinculado;
  const perfil = after.perfil || after.tipo || '';
  if (!personalEmail || (perfil !== 'aluno_personal' && perfil !== 'alunoPersonal')) return;

  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  // Só age quando o vínculo passou a existir/mudou (evita loop em updates irrelevantes)
  if (before && before.personal_vinculado === personalEmail) return;

  const cfg = await db.collection('configuracoes').doc('limites_alunos').get();
  const limite = cfg.exists ? (cfg.data()[personalEmail] || 0) : 0;
  if (!limite || limite <= 0) return; // 0 = ilimitado

  const snap = await db.collection('usuarios').where('personal_vinculado', '==', personalEmail).count().get();
  if (snap.data().count > limite) {
    await event.data.after.ref.set({ personal_vinculado: admin.firestore.FieldValue.delete(), bloqueadoPorLimite: true }, { merge: true });
    console.log('Limite de alunos excedido para ' + personalEmail + ' — vínculo de ' + (after.email || event.params.uid) + ' revertido.');
  }
});
