// ─── MÓDULO: COMISSÕES ────────────────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             dashboard.js (pessoalTemComissao, isPersonalInterno)
    function registrarComissao(personalEmail, alunoEmail, tipo, protocoloId, valor) {
      if (!personalEmail || !alunoEmail) return;
      if (!pessoalTemComissao(personalEmail)) return;
      // Treinos de trial não geram comissão
      if (typeof trialExpirado !== 'undefined' && _st.planos[alunoEmail] === 'trial') return;
      // Idempotência: não registra comissão duplicada para o mesmo protocolo/tipo
      // (protege contra duplo clique, reload e re-execução do aceite)
      var _comExist = _st.comissoes;
      if (protocoloId && _comExist.some(function(c) { return c.protocoloId === protocoloId && c.tipo === tipo; })) {
        return;
      }
      var novaComissao = {
        id: 'comm_' + Date.now().toString(36),
        personalEmail: personalEmail,
        alunoEmail: alunoEmail,
        tipo: tipo,
        valor: valor,
        status: 'confirmado',
        protocoloId: protocoloId,
        dataConfirmado: new Date().toISOString()
      };
      var comissoes = _st.comissoes;
      comissoes.push(novaComissao);
      _st.comissoes = comissoes;
      if (!isDemo && db) {
        db.collection('comissoes').add({
          personalEmail: personalEmail,
          alunoEmail: alunoEmail,
          tipo: tipo,
          valor: valor,
          status: 'confirmado',
          protocoloId: protocoloId,
          dataConfirmado: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(docRef) {
          var comissoes2 = _st.comissoes;
          for (var i = 0; i < comissoes2.length; i++) {
            if (comissoes2[i].id === novaComissao.id) { comissoes2[i].firestoreId = docRef.id; break; }
          }
          _st.comissoes = comissoes2;
        }).catch(function(e) { console.warn('Erro ao salvar comissão no Firestore:', e.code || e); });
      }
    }

    // Reenvia ao Firestore comissões locais que não foram persistidas (sem firestoreId).
    // Roda no dispositivo do aluno (a regra exige alunoEmail == usuário autenticado).
    function _reenviarComissoesPendentes() {
      if (isDemo || !db) return;
      var comissoes = _st.comissoes;
      var meuEmail = localStorage.getItem('ironqi_logado');
      comissoes.filter(function(c) { return !c.firestoreId && c.alunoEmail === meuEmail; }).forEach(function(c) {
        db.collection('comissoes').add({
          personalEmail: c.personalEmail, alunoEmail: c.alunoEmail, tipo: c.tipo, valor: c.valor,
          status: c.status || 'confirmado', protocoloId: c.protocoloId,
          dataConfirmado: firebase.firestore.FieldValue.serverTimestamp()
        }).then(function(ref) {
          var arr = _st.comissoes;
          for (var i = 0; i < arr.length; i++) { if (arr[i].id === c.id) { arr[i].firestoreId = ref.id; break; } }
          _st.comissoes = arr;
        }).catch(function(e) { console.warn('Retry comissão falhou:', e.code || e); });
      });
    }

    function sincronizarComissoesPersonal(email, callback) {
      if (isDemo || !db) { if (callback) callback(); return; }
      db.collection('comissoes').where('personalEmail', '==', email).get().then(function(snap) {
        var comissoes = _st.comissoes;
        snap.forEach(function(doc) {
          var d = doc.data();
          var fsId = doc.id;
          if (!comissoes.some(function(c) { return c.firestoreId === fsId; })) {
            comissoes.push({
              id: 'comm_' + fsId,
              firestoreId: fsId,
              personalEmail: d.personalEmail,
              alunoEmail: d.alunoEmail,
              tipo: d.tipo,
              valor: d.valor || (d.tipo === 'treino' ? 4 : 1),
              status: d.status || 'confirmado',
              protocoloId: d.protocoloId || '',
              dataPago: d.dataPago || null,
              dataConfirmado: d.dataConfirmado && d.dataConfirmado.toDate ? d.dataConfirmado.toDate().toISOString() : (d.dataConfirmado || new Date().toISOString())
            });
          }
        });
        _st.comissoes = comissoes;
        if (callback) callback();
      }).catch(function(e) { console.warn('Erro ao sincronizar comissões:', e.code || e); if (callback) callback(); });
    }

    function carregarComissoesPersonal() {
      var email = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado');
      if (!email) return;
      var elCard = document.getElementById('perfil-comissoes');
      if (!elCard) return;
      if (!pessoalTemComissao(email)) { elCard.style.display = 'none'; return; }
      sincronizarComissoesPersonal(email, function() {
        var comissoes = _st.comissoes;
        var minhas = comissoes.filter(function(c) { return c.personalEmail === email && c.status === 'confirmado'; });
        var treinos = minhas.filter(function(c) { return c.tipo === 'treino'; }).length;
        var dietas = minhas.filter(function(c) { return c.tipo === 'dieta'; }).length;
        var total = minhas.reduce(function(sum, c) { return sum + (c.valor || 0); }, 0);
        document.getElementById('comm-treinos-aceitos').textContent = treinos;
        document.getElementById('comm-dietas-aceitas').textContent = dietas;
        document.getElementById('comm-total-receber').textContent = 'R$' + total.toFixed(0);
        elCard.style.display = 'flex';
      });
    }