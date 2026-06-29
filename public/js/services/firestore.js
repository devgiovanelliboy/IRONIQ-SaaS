// ─── FIRESTORE USER DATA SERVICE ─────────────────────────────────────────────
// CRUD de dados de usuário no Firestore.
// Depende de: state.js (_st, emailToUid), firebase-init.js (isDemo, auth, db),
//             uid-map.js (saveUidMapping)

function setFsUserData(email, data) {
  if (!email) return;
  var usuarios = _st.usuarios;
  if (!usuarios[email]) usuarios[email] = { senha: '', dados: {}, criadoEm: new Date().toISOString() };
  // Merge Firestore data into existing local dados to preserve local-only fields (e.g. fotoUrl)
  for (var k in data) {
    usuarios[email].dados[k] = data[k];
  }
  _st.usuarios = usuarios;
  if (!isDemo && auth && db) {
    var uid = emailToUid[email];
    if (uid) {
      db.collection('usuarios').doc(uid).set(data, { merge: true }).catch(function (e) { console.warn('Firestore usuarios set error:', e.code || e); });
    }
  }
}

function loadUserFromFirebase(uid, email) {
  if (!uid || !email || isDemo || !db) return Promise.resolve();
  return db.collection('usuarios').doc(uid).get().then(function (doc) {
    if (doc.exists) {
      var data = doc.data();
      setFsUserData(email, data);
    }
    saveUidMapping(email, uid);
  }).catch(function (e) { console.warn('Firestore loadUser error:', e.code || e); });
}
