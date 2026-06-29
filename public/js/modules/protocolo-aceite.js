// ─── MÓDULO: PROTOCOLO / ACEITE + LISTENER ───────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             protocolo-form.js (workoutData, mostrarTelaEspera, _aceitePendente)
//             comissoes.js (registrarComissao), dashboard.js (pessoalTemComissao)
    function buscarProtocoloPendente(email) {
      if (!isDemo && db) {
        // Cancela listener anterior para não vazar (evita callbacks duplicados)
        if (_protocoloListener) { _protocoloListener(); _protocoloListener = null; }
        _protocoloListener = db.collection('protocolos_analise')
          .where('alunoEmail', '==', email)
          .where('status', '==', 'pendente_aprovacao')
          .orderBy('dataGerado', 'desc')
          .limit(1)
          .onSnapshot(function(snapshot) {
            snapshot.docChanges().forEach(function(change) {
              if (change.type === 'modified' || change.type === 'removed') return;
              var doc = change.doc;
              var data = doc.data();
              if (data.status === 'pendente_aprovacao') {
                _waitingProtocoloId = doc.id;
                _waitingTipo = data.tipo;
              }
            });
          }, function(err) { console.log('Erro listener:', err); });
      } else {
        // Modo demo: verifica localStorage
        var analises = _st.protocolos;
        for (var i = analises.length - 1; i >= 0; i--) {
          if (analises[i].alunoEmail === email && analises[i].status === 'pendente_aprovacao') {
            _waitingProtocoloId = analises[i].id;
            _waitingTipo = analises[i].tipo;
            break;
          }
        }
      }
    }

    function iniciarListenerAprovacao() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      if (!isDemo && db && _waitingProtocoloId) {
        if (_protocoloListener) _protocoloListener();
        _protocoloListener = db.collection('protocolos_analise')
          .doc(_waitingProtocoloId)
          .onSnapshot(function(doc) {
            if (doc.exists) {
              var data = doc.data();
              if (data.status === 'aguardando_aceite_aluno') {
                protocoloAguardandoAceite(data);
              } else if (data.status === 'aprovado') {
                protocoloAprovado(data);
              }
            }
          }, function(err) { console.log('Erro listener:', err); });
      } else if (_waitingProtocoloId) {
        var poll = setInterval(function() {
          var analises = _st.protocolos;
          for (var i = 0; i < analises.length; i++) {
            if (analises[i].id === _waitingProtocoloId) {
              if (analises[i].status === 'aguardando_aceite_aluno') {
                clearInterval(poll);
                protocoloAguardandoAceite(analises[i]);
                return;
              } else if (analises[i].status === 'aprovado') {
                clearInterval(poll);
                protocoloAprovado(analises[i]);
                return;
              }
            }
          }
        }, 2000);
      }
    }

    function protocoloAguardandoAceite(data) {
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';
      var tipo = _waitingTipo || data.tipo || 'treino';
      var personalEmail = data.aprovadoPor || data.direcionadoPara || data.reviewerEmail || '';
      var protocoloId = _waitingProtocoloId || '';
      // Salva em localStorage com status aguardando_aceite_aluno
      var email = localStorage.getItem('ironqi_logado');
      var pendentes = _st.pendentes;
      var encontrado = false;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === protocoloId) {
          pendentes[i].status = 'aguardando_aceite_aluno';
          pendentes[i].aprovadoPor = personalEmail;
          pendentes[i].protocolo = data.protocolo;
          encontrado = true;
          break;
        }
      }
      if (!encontrado) {
        pendentes.push({ id: protocoloId, tipo: tipo, alunoEmail: email, status: 'aguardando_aceite_aluno', dataAprovado: new Date().toISOString(), aprovadoPor: personalEmail, protocolo: data.protocolo });
      }
      _st.pendentes = pendentes;
      mostrarAceiteProtocolo(tipo, protocoloId, personalEmail, data.protocolo);
      _waitingProtocoloId = null;
      _waitingTipo = null;
    }

    function mostrarAceiteProtocolo(tipo, id, personalEmail, protocolo) {
      _aceitePendente[tipo] = { id: id, personalEmail: personalEmail, protocolo: protocolo };
      if (tipo === 'treino') {
        document.getElementById('empty-workout').style.display = 'none';
        document.getElementById('empty-workout-btn').style.display = 'none';
        document.getElementById('workout-container').style.display = 'none';
        var wr = document.getElementById('waiting-review');
        if (wr) wr.style.display = 'none';
        // Renderiza preview do treino
        var preview = document.getElementById('aceite-treino-preview');
        if (preview && protocolo) {
          var ph = '<div style="margin-bottom:10px;">';
          ph += '<div style="font-size:14px;font-weight:700;color:#CCFF00;margin-bottom:2px;">' + (protocolo.nome || 'Protocolo IRONIQA') + '</div>';
          if (protocolo.meta) ph += '<div style="font-size:11px;color:#666;">' + protocolo.meta + '</div>';
          ph += '</div>';
          var dias = protocolo.dias || [];
          for (var di = 0; di < dias.length; di++) {
            var d = dias[di];
            ph += '<div style="margin-bottom:14px;">';
            ph += '<div style="font-size:12px;font-weight:700;color:#eee;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #222;">' + d.nome + '</div>';
            var exs = d.exercicios || [];
            for (var ei = 0; ei < exs.length; ei++) {
              var ex = exs[ei];
              ph += '<div style="display:flex;align-items:center;gap:10px;padding:5px 0;">' +
                '<span style="font-size:18px;flex-shrink:0;">' + (ex.icon || '🏋️') + '</span>' +
                '<div style="flex:1;min-width:0;">' +
                  '<div style="font-size:12px;color:#ddd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ex.nome + '</div>' +
                  '<div style="font-size:10px;color:#555;">' + (ex.detalhe || '') + '</div>' +
                '</div>' +
                '<div style="font-size:11px;color:#CCFF00;font-weight:700;flex-shrink:0;">' + (ex.reps || '') + '</div>' +
              '</div>';
            }
            ph += '</div>';
          }
          if (!dias.length) ph += '<p style="color:#555;font-size:12px;text-align:center;margin:0;">Sem dias cadastrados.</p>';
          preview.innerHTML = ph;
        }
        var el = document.getElementById('aceite-protocolo-treino');
        if (el) el.style.display = 'flex';
      } else {
        document.getElementById('empty-dieta').style.display = 'none';
        document.getElementById('empty-dieta-btn').style.display = 'none';
        document.getElementById('dieta-aprovada-container').style.display = 'none';
        // Renderiza preview da dieta
        var dietaPreview = document.getElementById('aceite-dieta-preview');
        if (dietaPreview && protocolo) {
          var conteudo = (protocolo.resultado) ? protocolo.resultado : (typeof protocolo === 'string' ? protocolo : '');
          dietaPreview.innerHTML = conteudo ? (typeof formatarTextoDieta === 'function' ? formatarTextoDieta(conteudo) : conteudo) : '<p style="color:#555;text-align:center;margin:0;">Conteúdo não disponível.</p>';
        }
        var el2 = document.getElementById('aceite-protocolo-dieta');
        if (el2) el2.style.display = 'flex';
      }
    }

    function aceitarProtocolo(tipo) {
      var aceite = _aceitePendente[tipo];
      if (!aceite) return;
      var email = localStorage.getItem('ironqi_logado');
      // Marca início do ciclo deste tipo para controle de limites por plano
      var _agora = new Date().toISOString();
      if (email) _st.ultimoAceite[tipo + '_' + email] = _agora;
      if (!isDemo && db && auth && auth.currentUser) {
        var _cicloUpdate = {};
        _cicloUpdate['ultimoAceite' + (tipo === 'treino' ? 'Treino' : 'Dieta')] = _agora;
        db.collection('usuarios').doc(auth.currentUser.uid).update(_cicloUpdate)
          .catch(function(e) { console.warn('Erro ao salvar ciclo no Firestore:', e.code || e); });
      }
      // Atualiza localStorage: status 'approved'
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === aceite.id) {
          pendentes[i].status = 'approved';
          pendentes[i].dataAceito = new Date().toISOString();
          break;
        }
      }
      _st.pendentes = pendentes;
      // Esconde a tela de aceite
      var elId = tipo === 'treino' ? 'aceite-protocolo-treino' : 'aceite-protocolo-dieta';
      var el = document.getElementById(elId);
      if (el) el.style.display = 'none';
      // Registra comissão (ajustes não geram comissão)
      if (!aceite.ehAjuste) {
        var valor = tipo === 'treino' ? 4 : 1;
        registrarComissao(aceite.personalEmail, email, tipo, aceite.id, valor);
      }
      // Atualiza Firestore: marca como aprovado final
      // Atualiza protocolos_analise — inclusive para ids fs_ (busca pelo alunoEmail)
      if (!isDemo && db) {
        var _analiseUpdate = { status: 'aprovado', dataAceito: new Date().toISOString() };
        if (aceite.id && aceite.id.indexOf('fs_') !== 0) {
          atualizarProtocoloAnalise(aceite.id, _analiseUpdate);
        } else {
          // id fs_ = veio do Firestore; busca o doc real pelo alunoEmail
          db.collection('protocolos_analise')
            .where('alunoEmail', '==', email)
            .where('status', '==', 'aguardando_aceite_aluno')
            .limit(1).get()
            .then(function(snap) {
              snap.forEach(function(doc) {
                db.collection('protocolos_analise').doc(doc.id).update(_analiseUpdate)
                  .catch(function(e) { console.warn('Erro update analise aceite:', e); });
              });
            }).catch(function() {});
        }
      }
      // Salva na subcoleção do aluno com dados completos + status aprovado (set garante que dados nunca se perdem)
      var uid = emailToUid[email];
      if (!isDemo && db && uid) {
        var colecao = tipo === 'dieta' ? 'dietas' : 'treinos';
        db.collection('usuarios').doc(uid).collection(colecao).doc('atual').set({
          dados: aceite.protocolo,
          status: 'aprovado',
          aprovadoPor: aceite.personalEmail || '',
          dataAceito: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: false }).catch(function(e) { console.warn('Erro ao salvar aceite na subcoleção:', e.code || e); });
      }
      // Exibe o protocolo
      _aceitePendente[tipo] = null;
      if (tipo === 'dieta') {
        exibirDietaAprovada(aceite.protocolo.resultado);
      } else {
        exibirTreino(aceite.protocolo);
      }
    }

    function rejeitarProtocolo(tipo) {
      var aceite = _aceitePendente[tipo];
      if (!aceite) return;
      if (!confirm('Tem certeza? O protocolo será descartado e você precisará solicitar um novo.')) return;
      // Atualiza localStorage
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === aceite.id) { pendentes.splice(i, 1); break; }
      }
      _st.pendentes = pendentes;
      // Atualiza Firestore — protocolos_analise
      if (!isDemo && db) {
        var _rejUpdate = { status: 'rejeitado_aluno', dataRejeicao: new Date().toISOString() };
        if (aceite.id && aceite.id.indexOf('fs_') !== 0) {
          atualizarProtocoloAnalise(aceite.id, _rejUpdate);
        } else {
          db.collection('protocolos_analise').where('alunoEmail', '==', email).where('status', '==', 'aguardando_aceite_aluno').limit(1).get()
            .then(function(snap) { snap.forEach(function(doc) { db.collection('protocolos_analise').doc(doc.id).update(_rejUpdate).catch(function(){}); }); }).catch(function(){});
        }
        // Limpa a subcoleção para não re-exibir treino rejeitado no próximo reload
        var _rUid = emailToUid[email];
        if (_rUid) {
          var _rCol = tipo === 'dieta' ? 'dietas' : 'treinos';
          db.collection('usuarios').doc(_rUid).collection(_rCol).doc('atual').delete()
            .catch(function(e) { console.warn('Erro ao limpar subcoleção após rejeição:', e.code || e); });
        }
      }
      _aceitePendente[tipo] = null;
      // Volta para o estado vazio
      if (tipo === 'treino') {
        document.getElementById('aceite-protocolo-treino').style.display = 'none';
        document.getElementById('empty-workout').style.display = 'flex';
        document.getElementById('empty-workout-btn').style.display = '';
      } else {
        document.getElementById('aceite-protocolo-dieta').style.display = 'none';
        document.getElementById('empty-dieta').style.display = 'flex';
        document.getElementById('empty-dieta-btn').style.display = '';
      }
    }

    function solicitarNovoProtocolo(tipo) {
      var aceite = _aceitePendente[tipo];
      if (!aceite) return;
      if (!confirm('Solicitar a geração de um novo protocolo? O atual será descartado.')) return;
      // Remove do localStorage
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === aceite.id) { pendentes.splice(i, 1); break; }
      }
      _st.pendentes = pendentes;
      if (!isDemo && db) {
        var _novUpdate = { status: 'rejeitado_aluno_novo_solicitado', dataRejeicao: new Date().toISOString() };
        if (aceite.id && aceite.id.indexOf('fs_') !== 0) {
          atualizarProtocoloAnalise(aceite.id, _novUpdate);
        } else {
          var _novEmail = localStorage.getItem('ironqi_logado');
          db.collection('protocolos_analise').where('alunoEmail', '==', _novEmail).where('status', '==', 'aguardando_aceite_aluno').limit(1).get()
            .then(function(snap) { snap.forEach(function(doc) { db.collection('protocolos_analise').doc(doc.id).update(_novUpdate).catch(function(){}); }); }).catch(function(){});
        }
        // Limpa a subcoleção para não re-exibir protocolo descartado
        var _novUid = emailToUid[localStorage.getItem('ironqi_logado')];
        if (_novUid) {
          var _novCol = tipo === 'dieta' ? 'dietas' : 'treinos';
          db.collection('usuarios').doc(_novUid).collection(_novCol).doc('atual').delete()
            .catch(function(e) { console.warn('Erro ao limpar subcoleção após novo solicitado:', e.code || e); });
        }
      }
      _aceitePendente[tipo] = null;
      if (tipo === 'treino') {
        document.getElementById('aceite-protocolo-treino').style.display = 'none';
        abrirFormulario();
      } else {
        document.getElementById('aceite-protocolo-dieta').style.display = 'none';
        navigate('dieta');
      }
    }

    // ─── PROTOCOLO (continuação: após comissões) ───

