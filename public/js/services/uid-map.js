// ─── UID MAP SERVICE ─────────────────────────────────────────────────────────
// Mapeamento email→uid em memória + persistência Firestore.
// Depende de: state.js (emailToUid), firebase-init.js (isDemo, db, auth)

function loadUidMap() {
  // emailToUid é puramente em memória — não persiste em localStorage
}
loadUidMap();

function saveUidMapping(email, uid) {
  emailToUid[email] = uid;
  // As regras do uidMap só permitem gravar o PRÓPRIO mapeamento (uid == auth.uid).
  // Para outros usuários (ex.: personal cacheando o uid do aluno) mantemos só o
  // cache local — a leitura do uidMap deles é liberada. Tentar gravar geraria
  // um permission-denied inofensivo, mas ruidoso. Por isso só grava o próprio.
  if (!isDemo && db && auth && auth.currentUser && auth.currentUser.uid === uid) {
    db.collection('uidMap').doc(email.replace(/\./g, ',')).set({ uid: uid, email: email }).catch(function (e) { console.warn('Firestore uidMap error:', e.code || e); });
  }
}
