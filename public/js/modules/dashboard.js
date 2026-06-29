// ─── MÓDULO: DASHBOARD / NOTIFICAÇÕES ────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             planos.js (getPlanoUsuario), comissoes.js (_reenviarComissoesPendentes)
    // ─── DASHBOARD (checa treinos aprovados) ───
    var currentReviewId = null;

    function carregarDashboard() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      _reenviarComissoesPendentes();

      // Esconde banner de trial se já tem plano ativo
      var plano = getPlanoUsuario();
      var banner = document.getElementById('banner-trial');
      if (banner) banner.style.display = plano ? 'none' : '';

      verificarAlertaVencimento();

      // Só mostra o card de hidratação para alunos
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var perfil = userData.perfil || userData.tipo || '';
      var hydCard = document.getElementById('hyd-card');
      if (hydCard) {
        hydCard.style.display = (perfil === 'aluno_autonomo' || perfil === 'aluno_personal') ? '' : 'none';
      }

      // Esconde waiting screen por padrão
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';

      var pendentes = _st.pendentes;
      var aprovadoTreino = null;
      var aprovadoDieta = null;
      var aceiteTreino = null;
      var aceiteDieta = null;
      var temPendenteTreino = false;
      var temPendenteDieta = false;
      for (var i = 0; i < pendentes.length; i++) {
        var p = pendentes[i];
        if (p.alunoEmail !== email) continue;
        if (p.status === 'approved') {
          if (p.tipo === 'dieta') {
            if (!aprovadoDieta || p.dataAprovado > aprovadoDieta.dataAprovado) aprovadoDieta = p;
          } else {
            if (!aprovadoTreino || p.dataAprovado > aprovadoTreino.dataAprovado) aprovadoTreino = p;
          }
        } else if (p.status === 'aguardando_aceite_aluno') {
          if (p.tipo === 'dieta') {
            if (!aceiteDieta || p.dataAprovado > aceiteDieta.dataAprovado) aceiteDieta = p;
          } else {
            if (!aceiteTreino || p.dataAprovado > aceiteTreino.dataAprovado) aceiteTreino = p;
          }
        } else if (p.status === 'pendente_aprovacao') {
          if (p.tipo === 'dieta') temPendenteDieta = true;
          else temPendenteTreino = true;
        }
      }
      if (aceiteTreino && aceiteTreino.protocolo) {
        mostrarAceiteProtocolo('treino', aceiteTreino.id, aceiteTreino.aprovadoPor || aceiteTreino.direcionadoPara || '', aceiteTreino.protocolo);
      } else if (aprovadoTreino && aprovadoTreino.protocolo) {
        exibirTreino(aprovadoTreino.protocolo);
      } else if (!isDemo && db && emailToUid[email]) {
        carregarTreinoDoFirestore(email, temPendenteTreino);
      } else if (temPendenteTreino) {
        mostrarTelaEspera();
        buscarProtocoloPendenteEIniciar(email, 'treino');
      } else {
        document.getElementById('empty-workout').style.display = 'flex';
        document.getElementById('empty-workout-btn').style.display = '';
        document.getElementById('workout-container').style.display = 'none';
      }

      if (aceiteDieta && aceiteDieta.protocolo && aceiteDieta.protocolo.resultado) {
        mostrarAceiteProtocolo('dieta', aceiteDieta.id, aceiteDieta.aprovadoPor || aceiteDieta.direcionadoPara || '', aceiteDieta.protocolo);
      } else if (aprovadoDieta && aprovadoDieta.protocolo && aprovadoDieta.protocolo.resultado) {
        exibirDietaAprovada(aprovadoDieta.protocolo.resultado);
      } else if (!isDemo && db && emailToUid[email]) {
        carregarDietaDoFirestore(email, temPendenteDieta);
      } else if (temPendenteDieta) {
        document.getElementById('empty-dieta').style.display = 'none';
        document.getElementById('empty-dieta-btn').style.display = 'none';
        document.getElementById('dieta-aprovada-container').style.display = 'none';
        buscarProtocoloPendenteEIniciar(email, 'dieta');
      } else {
        document.getElementById('empty-dieta').style.display = 'flex';
        document.getElementById('empty-dieta-btn').style.display = '';
        document.getElementById('dieta-aprovada-container').style.display = 'none';
      }
    }

    function carregarTreinoDoFirestore(email, temPendente) {
      var uid = emailToUid[email];
      if (!uid) {
        if (temPendente) { mostrarTelaEspera(); buscarProtocoloPendenteEIniciar(email, 'treino'); }
        else { document.getElementById('empty-workout').style.display = 'flex'; document.getElementById('empty-workout-btn').style.display = ''; document.getElementById('workout-container').style.display = 'none'; }
        return;
      }
      db.collection('usuarios').doc(uid).collection('treinos').doc('atual').get().then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          var dataAprovado = data.dataCriacao && data.dataCriacao.toDate ? data.dataCriacao.toDate().toISOString() : new Date().toISOString();
          var pendentes = _st.pendentes;
          var fsId = 'fs_treino_' + uid;
          if (data.status === 'aguardando_aceite_aluno' && data.dados) {
            var fsEntry = { id: fsId, tipo: 'treino', alunoEmail: email, status: 'aguardando_aceite_aluno', dataAprovado: dataAprovado, aprovadoPor: data.aprovadoPor || '', protocolo: data.dados };
            var fsIdx = pendentes.findIndex(function(p) { return p.id === fsId; });
            if (fsIdx >= 0) { pendentes[fsIdx] = fsEntry; } else { pendentes.push(fsEntry); }
            _st.pendentes = pendentes;
            mostrarAceiteProtocolo('treino', fsId, data.aprovadoPor || '', data.dados);
          } else if (data.status === 'aprovado' && data.dados) {
            var fsEntry2 = { id: fsId, tipo: 'treino', alunoEmail: email, status: 'approved', dataAprovado: dataAprovado, protocolo: data.dados };
            var fsIdx2 = pendentes.findIndex(function(p) { return p.id === fsId; });
            if (fsIdx2 >= 0) { pendentes[fsIdx2] = fsEntry2; } else { pendentes.push(fsEntry2); }
            _st.pendentes = pendentes;
            exibirTreino(data.dados);
          } else {
            mostrarTelaEspera();
            buscarProtocoloPendenteEIniciar(email, 'treino');
          }
        } else {
          if (temPendente) {
            mostrarTelaEspera();
            buscarProtocoloPendenteEIniciar(email, 'treino');
          } else {
            document.getElementById('empty-workout').style.display = 'flex';
            document.getElementById('empty-workout-btn').style.display = '';
            document.getElementById('workout-container').style.display = 'none';
          }
        }
      }).catch(function(e) {
        console.warn('Erro ao carregar treino do Firestore:', e);
        if (temPendente) { mostrarTelaEspera(); buscarProtocoloPendenteEIniciar(email, 'treino'); }
      });
    }

    function carregarDietaDoFirestore(email, temPendente) {
      var uid = emailToUid[email];
      if (!uid) {
        if (temPendente) buscarProtocoloPendenteEIniciar(email, 'dieta');
        else { document.getElementById('empty-dieta').style.display = 'flex'; document.getElementById('empty-dieta-btn').style.display = ''; document.getElementById('dieta-aprovada-container').style.display = 'none'; }
        return;
      }
      db.collection('usuarios').doc(uid).collection('dietas').doc('atual').get().then(function(doc) {
        if (doc.exists) {
          var data = doc.data();
          var dataAprovado = data.dataCriacao && data.dataCriacao.toDate ? data.dataCriacao.toDate().toISOString() : new Date().toISOString();
          var pendentes = _st.pendentes;
          var fsDietaId = 'fs_dieta_' + uid;
          if (data.status === 'aguardando_aceite_aluno' && data.dados) {
            var fsDietaEntry = { id: fsDietaId, tipo: 'dieta', alunoEmail: email, status: 'aguardando_aceite_aluno', dataAprovado: dataAprovado, aprovadoPor: data.aprovadoPor || '', protocolo: data.dados };
            var fsDietaIdx = pendentes.findIndex(function(p) { return p.id === fsDietaId; });
            if (fsDietaIdx >= 0) { pendentes[fsDietaIdx] = fsDietaEntry; } else { pendentes.push(fsDietaEntry); }
            _st.pendentes = pendentes;
            mostrarAceiteProtocolo('dieta', fsDietaId, data.aprovadoPor || '', data.dados);
          } else if (data.status === 'aprovado' && data.dados && data.dados.resultado) {
            var fsDietaEntry2 = { id: fsDietaId, tipo: 'dieta', alunoEmail: email, status: 'approved', dataAprovado: dataAprovado, protocolo: data.dados };
            var fsDietaIdx2 = pendentes.findIndex(function(p) { return p.id === fsDietaId; });
            if (fsDietaIdx2 >= 0) { pendentes[fsDietaIdx2] = fsDietaEntry2; } else { pendentes.push(fsDietaEntry2); }
            _st.pendentes = pendentes;
            exibirDietaAprovada(data.dados.resultado);
          } else {
            if (temPendente) buscarProtocoloPendenteEIniciar(email, 'dieta');
            else { document.getElementById('empty-dieta').style.display = 'flex'; document.getElementById('empty-dieta-btn').style.display = ''; document.getElementById('dieta-aprovada-container').style.display = 'none'; }
          }
        } else {
          if (temPendente) {
            buscarProtocoloPendenteEIniciar(email, 'dieta');
          } else {
            document.getElementById('empty-dieta').style.display = 'flex';
            document.getElementById('empty-dieta-btn').style.display = '';
            document.getElementById('dieta-aprovada-container').style.display = 'none';
          }
        }
      }).catch(function(e) {
        console.warn('Erro ao carregar dieta do Firestore:', e);
        if (temPendente) buscarProtocoloPendenteEIniciar(email, 'dieta');
      });
    }

    // Busca o protocolo mais recente do aluno no Firestore (aguardando OU pendente),
    // atualiza _waitingProtocoloId e inicia o listener correto — resolve a race condition
    // do fluxo antigo (buscarProtocoloPendente + iniciarListenerAprovacao sequenciais).
    function buscarProtocoloPendenteEIniciar(email, tipo) {
      if (isDemo || !db) { iniciarListenerAprovacao(); return; }
      db.collection('protocolos_analise')
        .where('alunoEmail', '==', email)
        .orderBy('dataGerado', 'desc')
        .limit(10)
        .get()
        .then(function(snap) {
          var aguardando = null, pendente = null;
          snap.forEach(function(doc) {
            var d = doc.data();
            var tipoOk = !tipo || (d.tipo || 'treino') === tipo;
            if (tipoOk && d.status === 'aguardando_aceite_aluno' && !aguardando) aguardando = { id: doc.id, data: d };
            if (tipoOk && d.status === 'pendente_aprovacao' && !pendente) pendente = { id: doc.id, data: d };
          });
          if (aguardando) {
            _waitingProtocoloId = aguardando.id;
            _waitingTipo = aguardando.data.tipo || tipo || 'treino';
            protocoloAguardandoAceite(aguardando.data);
          } else if (pendente) {
            _waitingProtocoloId = pendente.id;
            _waitingTipo = pendente.data.tipo || tipo || 'treino';
            iniciarListenerAprovacao();
          } else {
            iniciarListenerAprovacao();
          }
        })
        .catch(function(e) {
          console.warn('Erro ao buscar protocolo pendente:', e);
          iniciarListenerAprovacao();
        });
    }

    // ─── NOTIFICAÇÕES DO PERSONAL ───

    // escapeHtml() → js/utils.js

    function atualizarBadgeNotificacoes() {
      var notificacoes = _st.notificacoes;
      var naoLidas = notificacoes.filter(function(n) { return !n.lida; });
      var badge = document.getElementById('notificacao-badge');
      if (!badge) return;
      if (naoLidas.length > 0) {
        badge.style.display = 'inline';
        badge.textContent = naoLidas.length;
      } else {
        badge.style.display = 'none';
      }
    }

    function abrirNotificacoes() {
      atualizarBadgeNotificacoes();
      document.getElementById('personal-pendentes-list').style.display = 'none';
      var container = document.getElementById('notificacoes-list');
      container.style.display = 'block';
      var notificacoes = _st.notificacoes;
      if (!notificacoes.length) {
        container.innerHTML = '<div class="personal-empty"><div class="icon-big">🔔</div><h3>Nenhum alerta</h3><p>Alertas de bem-estar dos alunos aparecerão aqui.</p></div>';
        return;
      }
      var html = '';
      for (var i = notificacoes.length - 1; i >= 0; i--) {
        var n = notificacoes[i];
        var nome = getAlunoNome(n.alunoEmail);
        var data = new Date(n.data);
        var dataStr = data.toLocaleDateString('pt-BR') + ' ' + data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        var icone = n.tipo === 'dor' ? '⚠️' : n.tipo === 'cansaço' || n.tipo === 'fadiga' ? '😰' : '🔔';
        var borda = n.lida ? '' : 'border-left:3px solid #FF4444;';
        html +=
          '<div class="pending-card" style="' + escapeHtml(borda) + '" onclick="marcarNotificacaoLida(\'' + escapeHtml(n.id) + '\')">' +
            '<div class="aluno-info">' + icone + ' ' + escapeHtml(n.tipo.toUpperCase()) + '</div>' +
            '<div class="aluno-nome">' + escapeHtml(nome) + '</div>' +
            '<div class="aluno-email">' + escapeHtml(n.descricao) + '</div>' +
            '<div class="footer-card">' +
              '<span class="status-date">' + escapeHtml(dataStr) + '</span>' +
            '</div>' +
          '</div>';
      }
      container.innerHTML = html;
    }

    function marcarNotificacaoLida(id) {
      var notificacoes = _st.notificacoes;
      for (var i = 0; i < notificacoes.length; i++) {
        if (notificacoes[i].id === id) {
          notificacoes[i].lida = true;
          break;
        }
      }
      _st.notificacoes = notificacoes;
      abrirNotificacoes();
    }

    // ─── PERSONAL HOME CRM ───
    function pessoalTemComissao(email) {
      var us = _st.usuarios;
      var d = (us[email] && us[email].dados) || {};
      return d.tipoPersonal === 'personal_interno' || d.tipoPersonal === 'personal_principal';
    }

    function isPersonalInterno(email) {
      var us = _st.usuarios;
      var d = (us[email] && us[email].dados) || {};
      return d.tipoPersonal === 'personal_interno';
    }

    // Busca protocolos pendentes do Firestore e merge no localStorage — necessário cross-device
    // Personal Interno também recebe protocolos dos alunos autônomos (direcionados ao Personal Principal)
    function sincronizarProtocolosPendentes(email, callback) {
      if (isDemo || !db) { if (callback) callback(); return; }
      // Usa apenas um where (direcionadoPara) para evitar necessidade de índice composto.
      // O filtro de status é feito em JS depois.
      var alvos = [email];
      if (isPersonalInterno(email) && PERSONAL_PRINCIPAL !== email) alvos.push(PERSONAL_PRINCIPAL);
      var queries = alvos.map(function(alvo) {
        return db.collection('protocolos_analise').where('direcionadoPara', '==', alvo).get();
      });
      Promise.all(queries).then(function(snaps) {
        var analises = _st.protocolos;
        var pendentes = _st.pendentes;
        var ativos = ['pendente_aprovacao', 'aguardando_aceite_aluno'];
        var alvoSet = {}; alvos.forEach(function(a) { alvoSet[a] = true; });

        // Coleta do Firestore: o que está ATIVO (pendente/aguardando) e direcionado a mim.
        var fsAtivos = {}; // id -> data
        var total = 0;
        snaps.forEach(function(snap) {
          snap.forEach(function(doc) {
            var data = doc.data();
            if (ativos.indexOf(data.status) !== -1) { fsAtivos[doc.id] = data; total++; }
          });
        });

        // Remove os itens DESTE personal que o Firestore já não considera ativos
        // (ex.: o aluno aceitou → virou 'aprovado'). Itens de outros alvos ficam intactos.
        pendentes = pendentes.filter(function(p) { return !alvoSet[p.direcionadoPara] || fsAtivos[p.id]; });
        analises  = analises.filter(function(a) { return !alvoSet[a.direcionadoPara] || fsAtivos[a.id]; });

        var pendById = {}; pendentes.forEach(function(p) { pendById[p.id] = p; });
        var anaById  = {}; analises.forEach(function(a) { anaById[a.id] = a; });

        // Adiciona novos e atualiza o status dos existentes — SEM perder o protocolo
        // já gerado localmente (a dieta/treino criada pela IA mora no localStorage).
        Object.keys(fsAtivos).forEach(function(fsId) {
          var data = fsAtivos[fsId];
          var dataGerado = (data.dataGerado && data.dataGerado.toDate ? data.dataGerado.toDate().toISOString() : data.dataGerado) || new Date().toISOString();
          if (pendById[fsId]) {
            pendById[fsId].status = data.status;
            if (data.dataAprovado) pendById[fsId].dataAprovado = data.dataAprovado;
            if (data.aprovadoPor) pendById[fsId].aprovadoPor = data.aprovadoPor;
          } else {
            pendentes.push({ id: fsId, alunoEmail: data.alunoEmail || '', tipo: data.tipo || 'treino', status: data.status, direcionadoPara: data.direcionadoPara || email, protocolo: data.protocolo || {}, dataGerado: dataGerado, dataAprovado: data.dataAprovado || '', aprovadoPor: data.aprovadoPor || '' });
          }
          if (anaById[fsId]) {
            anaById[fsId].status = data.status;
          } else {
            analises.push({ id: fsId, alunoEmail: data.alunoEmail || '', alunoNome: data.alunoNome || '', reviewerEmail: data.reviewerEmail || email, direcionadoPara: data.direcionadoPara || email, tipo: data.tipo || 'treino', status: data.status, protocolo: data.protocolo || {}, dataGerado: dataGerado });
          }
        });

        _st.protocolos = analises;
        _st.pendentes = pendentes;
        console.log('[IRONQI] Sync pendentes: ' + total + ' ativo(s) para', email);
        if (callback) callback();
      }).catch(function(e) {
        console.error('[IRONQI] Sync protocolos ERRO:', e.code, e.message);
        if (callback) callback();
      });
    }