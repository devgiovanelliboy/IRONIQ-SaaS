'use strict';
/**
 * Cloud Functions do IRONQI
 * - agendaCheckIn / agendaCancelCheckIn: check-in autoritativo (capacidade + contador no servidor)
 * - reconcileCheckinCount: mantém checkinCount fiel à subcoleção (trigger)
 * - setUserRole: atribuição de papéis privilegiados (admin) → doc + custom claim
 * - enforceLimiteAlunos: bloqueia vínculo de aluno acima do limite do personal (trigger)
 * - activateTrial: libera uma única avaliação gratuita de 24h no servidor
 * - acceptProtocol: conclui aceite + dieta/treino + comissão de forma atômica
 * - adminDeleteUser: exclui Auth, perfil, subcoleções e referências de uma conta
 */
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

admin.initializeApp();
const db = admin.firestore();

async function isAdmin(uid, token) {
  if (token && token.admin === true) return true;
  const doc = await db.collection('usuarios').doc(uid).get();
  return doc.exists && doc.data().perfil === 'admin';
}

function emailMapId(email) {
  return String(email || '').replace(/\./g, ',');
}

async function deleteQuery(query) {
  const snap = await query.get();
  if (snap.empty) return 0;
  const writer = db.bulkWriter();
  snap.docs.forEach((doc) => writer.delete(doc.ref));
  await writer.close();
  return snap.size;
}

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
  if (!(await isAdmin(req.auth.uid, req.auth.token))) throw new HttpsError('permission-denied', 'Apenas admin pode alterar papéis.');

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
//  CONTA — exclusão definitiva (somente admin)
// ─────────────────────────────────────────────────────────────
exports.adminDeleteUser = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  if (!(await isAdmin(req.auth.uid, req.auth.token))) throw new HttpsError('permission-denied', 'Apenas admin pode excluir contas.');
  const targetEmail = String((req.data && req.data.targetEmail) || '').trim().toLowerCase();
  if (!targetEmail) throw new HttpsError('invalid-argument', 'targetEmail obrigatório.');
  if (targetEmail === String(req.auth.token.email || '').toLowerCase()) throw new HttpsError('failed-precondition', 'Você não pode excluir a própria conta por este painel.');

  let user;
  try { user = await admin.auth().getUserByEmail(targetEmail); }
  catch (e) { if (e.code === 'auth/user-not-found') return { ok: true, alreadyDeleted: true }; throw e; }

  const related = [
    ['protocolos_analise', 'alunoEmail'], ['protocolos_analise', 'reviewerEmail'],
    ['protocolos_analise', 'direcionadoPara'], ['protocolos_analise', 'aprovadoPor'],
    ['comissoes', 'alunoEmail'], ['comissoes', 'personalEmail']
  ];
  let deletedRelated = 0;
  for (const [collection, field] of related) {
    deletedRelated += await deleteQuery(db.collection(collection).where(field, '==', targetEmail));
  }
  await db.recursiveDelete(db.collection('usuarios').doc(user.uid));
  await db.collection('uidMap').doc(emailMapId(targetEmail)).delete().catch(() => {});
  await admin.auth().deleteUser(user.uid);
  return { ok: true, uid: user.uid, deletedRelated: deletedRelated };
});

// ─────────────────────────────────────────────────────────────
//  TRIAL — uma única ativação de 24h, definida no servidor
// ─────────────────────────────────────────────────────────────
exports.activateTrial = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  const ref = db.collection('usuarios').doc(req.auth.uid);
  return db.runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists) throw new HttpsError('not-found', 'Perfil não encontrado.');
    const data = doc.data();
    if (data.trialUtilizado === true || data.plano === 'trial') throw new HttpsError('already-exists', 'O teste gratuito já foi utilizado.');
    if (data.plano && data.plano !== 'trial') throw new HttpsError('failed-precondition', 'Sua conta já possui um plano.');
    const expira = admin.firestore.Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
    tx.update(ref, { plano: 'trial', trialExpira: expira, trialUtilizado: true });
    return { ok: true, expira: expira.toDate().toISOString() };
  });
});

// ─────────────────────────────────────────────────────────────
//  ACEITE — finalização e comissão autoritativas
// ─────────────────────────────────────────────────────────────
exports.acceptProtocol = onCall(async (req) => {
  if (!req.auth) throw new HttpsError('unauthenticated', 'Login necessário.');
  const email = String(req.auth.token.email || '').toLowerCase();
  const tipo = req.data && req.data.tipo === 'dieta' ? 'dieta' : 'treino';
  let protocoloId = String((req.data && req.data.protocoloId) || '');
  let protocoloRef;
  let protocoloDoc;

  if (protocoloId && !protocoloId.startsWith('fs_')) {
    protocoloRef = db.collection('protocolos_analise').doc(protocoloId);
    protocoloDoc = await protocoloRef.get();
  }
  if (!protocoloDoc || !protocoloDoc.exists) {
    const snap = await db.collection('protocolos_analise')
      .where('alunoEmail', '==', email)
      .where('status', '==', 'aguardando_aceite_aluno').get();
    const match = snap.docs.find((doc) => (doc.data().tipo || 'treino') === tipo);
    if (!match) throw new HttpsError('not-found', 'Protocolo aguardando aceite não encontrado.');
    protocoloDoc = match; protocoloRef = match.ref; protocoloId = match.id;
  }

  const protocolo = protocoloDoc.data();
  if (String(protocolo.alunoEmail || '').toLowerCase() !== email) throw new HttpsError('permission-denied', 'Este protocolo pertence a outro aluno.');
  if (protocolo.status !== 'aguardando_aceite_aluno') {
    if (protocolo.status === 'aprovado') return { ok: true, alreadyAccepted: true, protocoloId: protocoloId };
    throw new HttpsError('failed-precondition', 'O protocolo não está aguardando aceite.');
  }

  const userRef = db.collection('usuarios').doc(req.auth.uid);
  const userDoc = await userRef.get();
  if (!userDoc.exists) throw new HttpsError('not-found', 'Perfil do aluno não encontrado.');
  const now = admin.firestore.FieldValue.serverTimestamp();
  const colecao = tipo === 'dieta' ? 'dietas' : 'treinos';
  const atualRef = userRef.collection(colecao).doc('atual');
  const personalEmail = protocolo.aprovadoPor || protocolo.direcionadoPara || protocolo.reviewerEmail || '';
  const batch = db.batch();
  batch.update(protocoloRef, { status: 'aprovado', dataAceito: now });
  batch.set(atualRef, { dados: protocolo.protocolo || {}, status: 'aprovado', aprovadoPor: personalEmail, dataAceito: now });
  const cicloField = tipo === 'dieta' ? 'ultimoAceiteDieta' : 'ultimoAceiteTreino';
  batch.update(userRef, { [cicloField]: now });

  if (personalEmail && userDoc.data().plano !== 'trial' && !protocolo.ehAjuste) {
    const ps = await db.collection('usuarios').where('email', '==', personalEmail).limit(1).get();
    const pd = ps.empty ? {} : ps.docs[0].data();
    if (pd.tipoPersonal === 'personal_interno' || pd.tipoPersonal === 'personal_principal') {
      const commRef = db.collection('comissoes').doc(protocoloId + '_' + tipo);
      batch.set(commRef, { personalEmail: personalEmail, alunoEmail: email, tipo: tipo, valor: tipo === 'treino' ? 4 : 1, status: 'confirmado', protocoloId: protocoloId, dataConfirmado: now }, { merge: false });
    }
  }
  await batch.commit();
  return { ok: true, protocoloId: protocoloId };
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

// Mantém o lookup email → uid fora do alcance do cliente.
exports.syncUidMap = onDocumentWritten('usuarios/{uid}', async (event) => {
  const before = event.data && event.data.before && event.data.before.exists ? event.data.before.data() : null;
  const after = event.data && event.data.after && event.data.after.exists ? event.data.after.data() : null;
  const beforeEmail = before && before.email ? String(before.email).toLowerCase() : '';
  const afterEmail = after && after.email ? String(after.email).toLowerCase() : '';
  if (beforeEmail && beforeEmail !== afterEmail) await db.collection('uidMap').doc(emailMapId(beforeEmail)).delete().catch(() => {});
  if (afterEmail) await db.collection('uidMap').doc(emailMapId(afterEmail)).set({ uid: event.params.uid, email: afterEmail });
});
