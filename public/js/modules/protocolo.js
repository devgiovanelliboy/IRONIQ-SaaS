// ─── MÓDULO: PROTOCOLO / TREINO ──────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             comissoes.js (registrarComissao), dashboard.js (pessoalTemComissao)
//             planos.js (verificarLimiteSolicitacao, getPlanoUsuario)
    // ─── SELEÇÃO DE TIPO DE TREINO ───
    function selectTrainType(type) {
      if (isDemo) {
        var email = localStorage.getItem('ironqi_logado');
        if (email) {
          var usuarios = _st.usuarios;
          if (usuarios[email]) { usuarios[email].dados.tipoTreino = type; _st.usuarios = usuarios; }
        }
      } else {
        var user = auth.currentUser;
        if (user) { db.collection('usuarios').doc(user.uid).update({ tipoTreino: type }).catch(function(e) { console.warn('Firestore tipoTreino update error:', e.code || e); }); }
      }
      var _email = email || (auth && auth.currentUser ? auth.currentUser.email : null);
      var _usuarios = _st.usuarios;
      var _user = _usuarios[_email];
      var _dados = _user && _user.dados ? _user.dados : {};
      var _perfil = _dados.perfil || _dados.tipo || '';
      if (_perfil === 'personal') { navigate('personal-home'); }
      else { navigate('dashboard'); }
    }

    // ─── MODAL FORMULÁRIO ───
    var workoutData = null;
    var _pendingEhAjuste = false;

    var _upgradeBlocked = false;

    function abrirFormulario() {
      document.getElementById('modal-upgrade').classList.remove('show');
      // Treino liberado para qualquer usuário logado (START ou PRO)
      if (!temAcessoStart()) {
        if (!_upgradeBlocked) {
          document.getElementById('modal-upgrade').classList.add('show');
        }
        return;
      }
      // Verifica limite de ciclo por plano (ajustes ignoram bloqueio)
      if (!_pendingEhAjuste) {
        if (temSolicitacaoAtiva('treino')) {
          alert('Você já tem uma solicitação de treino em andamento. Aguarde a análise ou o aceite antes de solicitar outra.');
          return;
        }
        var _limTreino = verificarLimiteSolicitacao('treino');
        if (_limTreino.bloqueado) {
          mostrarModalCicloAtivo('treino', _limTreino.diasRestantes, _limTreino.dataLiberacao);
          return;
        }
      }
      document.getElementById('modal-form').classList.add('show');
    }

    function fecharFormulario() {
      document.getElementById('modal-form').classList.remove('show');
      document.getElementById('modal-upgrade').classList.remove('show');
      _pendingEhAjuste = false;
      navigate('dashboard');
    }

    function getDirecionadoPara() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return PERSONAL_PRINCIPAL;
      var usuarios = _st.usuarios;
      var user = usuarios[email];
      var dados = user && user.dados ? user.dados : {};
      var perfil = dados.perfil || dados.tipo || '';
      // REGRA 2: qualquer aluno tem personal_vinculado definido (autônomo → PERSONAL_PRINCIPAL; personal → email do personal)
      if (dados.personal_vinculado) return dados.personal_vinculado;
      if (perfil === 'aluno_personal' || perfil === 'alunoPersonal') return PERSONAL_PRINCIPAL;
      return PERSONAL_PRINCIPAL;
    }

    // Verifica se já existe solicitação ativa (em análise ou aguardando aceite) do mesmo tipo.
    function temSolicitacaoAtiva(tipo, email) {
      email = email || localStorage.getItem('ironqi_logado');
      if (!email) return false;
      var pend = _st.pendentes;
      return pend.some(function(p) {
        return p.alunoEmail === email && p.tipo === tipo &&
          (p.status === 'pendente_aprovacao' || p.status === 'aguardando_aceite_aluno');
      });
    }

    function salvarPendente(protocolo, tipo) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var tipoReal0 = tipo || 'treino';
      // Trava final anti-duplicidade (ajustes são permitidos)
      if (!_pendingEhAjuste && temSolicitacaoAtiva(tipoReal0, email)) {
        alert('Você já tem uma solicitação de ' + (tipoReal0 === 'dieta' ? 'dieta' : 'treino') + ' em andamento. Aguarde a análise ou o aceite antes de solicitar outra.');
        return;
      }
      var direcionado = getDirecionadoPara();
      var pendentes = _st.pendentes;
      var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      var tipoReal = tipo || 'treino';
      var ehAjuste = !!_pendingEhAjuste;
      _pendingEhAjuste = false;
      if (ehAjuste) _st.ultimoAjuste[tipoReal + '_' + email] = new Date().toISOString();
      var entrada = {
        id: id,
        tipo: tipoReal,
        alunoEmail: email,
        dataGerado: new Date().toISOString(),
        status: 'pendente_aprovacao',
        direcionadoPara: direcionado,
        protocolo: protocolo
      };
      if (ehAjuste) entrada.ehAjuste = true;
      pendentes.push(entrada);
      _st.pendentes = pendentes;
      salvarProtocoloAnalise(protocolo, tipoReal, id, direcionado);
    }

    function salvarProtocoloAnalise(protocolo, tipo, localId, direcionado) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var direcionadoPara = direcionado || getDirecionadoPara();
      if (isDemo || !db) {
        var analises = _st.protocolos;
        var nome = getAlunoNome(email);
        analises.push({
          id: localId,
          alunoEmail: email,
          alunoNome: nome,
          reviewerEmail: direcionadoPara,
          direcionadoPara: direcionadoPara,
          tipo: tipo,
          status: 'pendente_aprovacao',
          protocolo: protocolo,
          dataGerado: new Date().toISOString()
        });
        _st.protocolos = analises;
        return;
      }
      var analises = _st.protocolos;
      var _nomeAluno = getAlunoNome(email);
      analises.push({
        id: localId,
        alunoEmail: email,
        alunoNome: _nomeAluno,
        reviewerEmail: direcionadoPara,
        direcionadoPara: direcionadoPara,
        tipo: tipo,
        status: 'pendente_aprovacao',
        protocolo: protocolo,
        dataGerado: new Date().toISOString()
      });
      _st.protocolos = analises;
      db.collection('protocolos_analise').add({
        alunoEmail: email,
        alunoNome: _nomeAluno,
        reviewerEmail: direcionadoPara,
        direcionadoPara: direcionadoPara,
        tipo: tipo,
        status: 'pendente_aprovacao',
        protocolo: protocolo,
        dataGerado: firebase.firestore.FieldValue.serverTimestamp()
      }).then(function(docRef) {
        var fsId = docRef.id;
        console.log('[IRONQI] Protocolo salvo no Firestore OK. ID:', fsId, '| direcionadoPara:', direcionadoPara, '| tipo:', tipo);
        var pend = _st.pendentes;
        for (var pi = 0; pi < pend.length; pi++) { if (pend[pi].id === localId) { pend[pi].id = fsId; break; } }
        _st.pendentes = pend;
        var anls = _st.protocolos;
        for (var ai = 0; ai < anls.length; ai++) { if (anls[ai].id === localId) { anls[ai].id = fsId; break; } }
        _st.protocolos = anls;
      }).catch(function(err) {
        console.error('[IRONQI] ERRO ao salvar protocolo no Firestore:', err.code, err.message);
        alert('⚠️ Erro ao enviar solicitação para o servidor (código: ' + (err.code || err.message) + '). Tente novamente.');
      });
      salvarNaSubcolecaoDoAluno(email, protocolo, tipo, 'pendente_aprovacao');
    }

    function salvarNaSubcolecaoDoAluno(alunoEmail, dados, tipo, status) {
      if (isDemo || !db) return;
      var alunoUid = emailToUid[alunoEmail];
      if (!alunoUid) return;
      var colecao = tipo === 'dieta' ? 'dietas' : 'treinos';
      db.collection('usuarios').doc(alunoUid).collection(colecao).doc('atual').set({
        dados: dados,
        status: status,
        dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function(e) { console.warn('Erro ao salvar na subcoleção do aluno:', e.code || e); });
    }

    function getAlunoNome(email) {
      var usuarios = _st.usuarios;
      if (usuarios[email] && usuarios[email].dados && usuarios[email].dados.nome) {
        return usuarios[email].dados.nome + ' ' + (usuarios[email].dados.sobrenome || '');
      }
      return email.split('@')[0];
    }

    function gerarTreino() {
      var data = {
        objetivo: document.getElementById('q-objetivo').value,
        nivel: document.getElementById('q-nivel').value,
        genero: document.getElementById('q-genero').value,
        dias: document.getElementById('q-dias').value,
        tempo: document.getElementById('q-tempo').value,
        foco: document.getElementById('q-foco').value,
        lesao: document.getElementById('q-lesao').value,
        local: document.getElementById('q-local').value
      };

      var u = auth && auth.currentUser ? auth.currentUser : null;
      if (isDemo) {
        var email = localStorage.getItem('ironqi_logado');
        if (email) {
          var usuarios = _st.usuarios;
          if (usuarios[email]) { usuarios[email].dados.ultimoTreino = data; _st.usuarios = usuarios; }
        }
      } else if (u) {
        db.collection('usuarios').doc(u.uid).update({ ultimoTreino: data }).catch(function(e) { console.warn('Firestore ultimoTreino update error:', e.code || e); });
      }

      if (!isDemo && auth && auth.currentUser) {
        gerarTreinoComIA(data);
      } else {
        document.getElementById('modal-actions').style.display = 'none';
        document.getElementById('modal-loading').style.display = 'block';
        setTimeout(function() {
          var protocolo = montarTreinoMock(data);
          salvarPendente(protocolo);
          document.getElementById('modal-loading').style.display = 'none';
          document.getElementById('modal-actions').style.display = 'block';
          fecharFormulario();
          navigate('dashboard');
          setTimeout(mostrarTelaEspera, 300);
        }, 2000);
      }
    }

    // ─── IA: CHAMADA GROK ───
    function gerarTreinoComIA(data) {
      document.getElementById('modal-actions').style.display = 'none';
      document.getElementById('modal-loading').style.display = 'block';

      var systemMsg =
        'Você é o Treinador Chefe da metodologia IRONIQA, especialista em fisiologia do exercício e hipertrofia de alta performance. ' +
        'Sua única função é receber dados físicos e montar protocolos de treino divisíveis (A, B, C, D, E) com séries, repetições e cadência. ' +
        'Não fale sobre comida. Sempre retorne APENAS um JSON válido, sem markdown, sem comentários, sem explicações.';

      var temCardio = data.objetivo === 'Emagrecimento' || data.objetivo === 'Condicionamento';
      var cardioNote = temCardio
        ? ' - Finalize com 15min de bicicleta ou esteira'
        : ' - NÃO inclua cardio (apenas musculação)';

      var freqIA = parseInt(data.dias, 10) || 4;
      var splitMap = {
        5: [
          '  Treino A — Peito e Tríceps' + cardioNote,
          '  Treino B — Costas e Bíceps' + cardioNote,
          '  Treino C — Perna (ênfase em Quadríceps)' + cardioNote,
          '  Treino D — Ombro' + cardioNote,
          '  Treino E — Posterior de Coxa e Abdômen' + cardioNote
        ],
        4: [
          '  Treino A — Peito e Tríceps' + cardioNote,
          '  Treino B — Costas e Bíceps' + cardioNote,
          '  Treino C — Ombro' + cardioNote,
          '  Treino D — Perna' + cardioNote
        ],
        3: [
          '  Treino A — Peito e Tríceps' + cardioNote,
          '  Treino B — Costas e Bíceps' + cardioNote,
          '  Treino C — Ombro e Perna' + cardioNote
        ],
        2: [
          '  Treino A — Peito e Tríceps' + cardioNote,
          '  Treino B — Costas e Bíceps' + cardioNote
        ],
        1: [
          '  Treino Full Body' + cardioNote
        ]
      };
      var splitLines = (splitMap[freqIA] || splitMap[4]).join('\n');

      var userMsg =
        'Monte um protocolo de treino completo para um aluno com o perfil abaixo.\n\n' +
        'Perfil do aluno:\n' +
        '- Objetivo: ' + data.objetivo + '\n' +
        '- Nível: ' + data.nivel + '\n' +
        '- Gênero: ' + data.genero + '\n' +
        '- Dias por semana: ' + data.dias + '\n' +
        '- Tempo por treino: ' + data.tempo + '\n' +
        '- Foco muscular: ' + data.foco + '\n' +
        '- Lesões/limitações: ' + (data.lesao || 'Nenhuma') + '\n' +
        '- Local de treino: ' + data.local + '\n\n' +
        'Divida o protocolo em ' + freqIA + ' dias seguindo esta divisão de grupos musculares:\n' +
        splitLines + '\n\n' +
        'Formato JSON obrigatório:\n' +
        '{\n' +
        '  "nome": "Protocolo IRONIQA",\n' +
        '  "meta": "Objetivo · Nível (ex: Hipertrofia · Intermediário)",\n' +
        '  "dias": [\n' +
        '    {\n' +
        '      "nome": "Treino A — Peito e Tríceps",\n' +
        '      "slug": "A",\n' +
        '      "exercicios": [\n' +
        '        { "nome": "Nome do exercício", "detalhe": "Equipamento · séries", "icon": "🏋️", "reps": "4×12" }\n' +
        '      ]\n' +
        '    }\n' +
        '  ]\n' +
        '}\n\n' +
        'Regras importantes:\n' +
        '- Gere EXATAMENTE 8 exercícios por treino, sem exceção\n' +
        '- Para treinos com 2 grupos musculares: EXATAMENTE 4 exercícios do grupo PRIMÁRIO + EXATAMENTE 4 exercícios do grupo SECUNDÁRIO (total = 8)\n' +
        '- Para treinos com 1 grupo muscular: 8 exercícios variados daquele grupo\n' +
        '- SEMPRE liste todos os exercícios do grupo primário antes dos do secundário\n' +
        '- Treino de Ombro: 8 exercícios específicos de ombro\n' +
        '- Treino de Perna: 8 exercícios específicos de perna\n' +
        '- Se incluir cardio, coloque sempre por ÚLTIMO como "Bicicleta 15min" ou "Esteira 15min"\n' +
        '- Use ícones variados (🏋️💪🦵📐💥🔥🧠🚴)\n' +
        '- Respeite as lesões/limitações informadas — adapte ou substitua exercícios problemáticos\n' +
        '- Adapte séries e repetições conforme objetivo e nível\n' +
        '- Para iniciante: cargas moderadas, foque em execução correta\n' +
        '- Para avançado: inclua técnicas intensas (drop-set, bi-set, falha)\n' +
        '- Considere o gênero para volumes adequados (feminino: maior foco em inferiores)\n' +
        '- Se for treino em casa, use apenas peso corporal e elásticos\n' +
        '- Inclua aquecimento específico antes de cada treino\n' +
        '- Retorne APENAS o JSON, sem nenhum texto adicional';

      _iaFetch({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemMsg },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.7,
        max_tokens: 2048
      })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(json) {
        var text = '';
        try { text = json.choices[0].message.content; } catch(e) {}
        if (!text) throw new Error('Resposta vazia da IA');

        text = text.replace(/```json/gi, '').replace(/```/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        var protocolo = null;
        try {
          protocolo = JSON.parse(text);
        } catch(e) {
          var match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { protocolo = JSON.parse(match[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')); } catch(e2) {}
          }
        }
        if (!protocolo) throw new Error('JSON inválido da IA');

        if (!protocolo.dias || !protocolo.dias.length) throw new Error('Formato inválido');

        salvarPendente(protocolo);
        document.getElementById('modal-loading').style.display = 'none';
        document.getElementById('modal-actions').style.display = 'block';
        fecharFormulario();
        navigate('dashboard');
        setTimeout(mostrarTelaEspera, 300);
      })
      .catch(function(err) {
        console.log('Erro IA, usando fallback:', err);
        var protocolo = montarTreinoMock(data);
        salvarPendente(protocolo);
        document.getElementById('modal-loading').style.display = 'none';
        document.getElementById('modal-actions').style.display = 'block';
        fecharFormulario();
        navigate('dashboard');
        setTimeout(mostrarTelaEspera, 300);
      });
    }

    // ─── TELA DE ESPERA + LISTENER APROVAÇÃO ───
    var _waitingProtocoloId = null;
    var _waitingTipo = null;
    var _aceitePendente = { treino: null, dieta: null };
    // Cada entrada: { id, personalEmail, protocolo, dataAprovado }

    function mostrarTelaEspera() {
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'flex';
      document.getElementById('workout-container').style.display = 'none';
      document.getElementById('empty-workout').style.display = 'none';
      document.getElementById('empty-workout-btn').style.display = 'none';
      document.getElementById('waiting-approved').style.display = 'none';
    }

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

    function protocoloAprovado(data) {
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';

      // Salva no localStorage para compatibilidade
      var pendentes = _st.pendentes;
      pendentes.push({
        id: _waitingProtocoloId || Date.now().toString(36),
        tipo: _waitingTipo || data.tipo || 'treino',
        alunoEmail: data.alunoEmail,
        dataGerado: data.dataGerado || new Date().toISOString(),
        dataAprovado: new Date().toISOString(),
        status: 'approved',
        protocolo: data.protocolo
      });
      _st.pendentes = pendentes;

      if (_waitingTipo === 'dieta' || data.tipo === 'dieta') {
        if (data.protocolo && data.protocolo.resultado) {
          exibirDietaAprovada(data.protocolo.resultado);
        }
      } else {
        if (data.protocolo) {
          exibirTreino(data.protocolo);
        }
      }

      // Atualiza status no Firestore
      if (!isDemo && db && _waitingProtocoloId) {
        db.collection('protocolos_analise').doc(_waitingProtocoloId).update({
          vistoEm: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function(e) { console.warn('Firestore protocolo vistoEm update error:', e.code || e); });
      }
      _waitingProtocoloId = null;
      _waitingTipo = null;
    }

    // ─── MOCK (fallback sem IA) ───
    function montarTreinoMock(d) {
      var meta = d.objetivo + ' · ' + d.nivel;
      var temCardio = d.objetivo === 'Emagrecimento' || d.objetivo === 'Condicionamento';

      var banco = {
        'Hipertrofia': {
          peito: [
            { nome: 'Supino Reto', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Crucifixo', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Supino Inclinado', detalhe: 'Halteres · 4 séries', icon: '🏋️', reps: '4×10' },
            { nome: 'Crossover', detalhe: 'Polia · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Supino Declinado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×10' }
          ],
          triceps: [
            { nome: 'Tríceps Pulley', detalhe: 'Corda · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps Testa', detalhe: 'Barra W · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps Coice', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Flexão', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×15' }
          ],
          costas: [
            { nome: 'Puxada Aberta', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Remada Curvada', detalhe: 'Halteres · 4 séries', icon: '🏋️', reps: '4×10' },
            { nome: 'Serrote', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×12' },
            { nome: 'Puxada Fechada', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Remada Unilateral', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×12' }
          ],
          biceps: [
            { nome: 'Rosca Direta', detalhe: 'Barra W · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Concentrada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Scott', detalhe: 'Banco · 3 séries', icon: '💪', reps: '3×10' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 4 séries', icon: '📐', reps: '4×12' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Elevação Frontal', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×12' },
            { nome: 'Encolhimento', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento Livre', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Leg Press', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×12' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Panturrilha em Pé', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×15' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          quadriceps: [
            { nome: 'Agachamento Livre', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Leg Press', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×12' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Passada', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Sumô', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          posterior: [
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Elevação Pélvica', detalhe: 'Barra · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Cadeira Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Bom Dia', detalhe: 'Barra · 3 séries', icon: '🦵', reps: '3×10' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Russian Twist', detalhe: 'Halteres · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Prancha Lateral', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×30s' }
          ]
        },
        'Emagrecimento': {
          peito: [
            { nome: 'Supino Reto', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Flexão', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×20' },
            { nome: 'Crucifixo', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Flexão Inclinada', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×15' }
          ],
          triceps: [
            { nome: 'Tríceps Banco', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Corda', detalhe: 'Polia · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Extensão de Tríceps', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Testa Leve', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×15' }
          ],
          costas: [
            { nome: 'Remada Unilateral', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Puxada Frontal', detalhe: 'Polia · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Remada Curvada', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Barra Fixa', detalhe: 'Peso corporal · 3 séries', icon: '🏋️', reps: '3×8' }
          ],
          biceps: [
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Concentrada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca 21', detalhe: 'Barra · 3 séries', icon: '💪', reps: '3×21' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Polichinelo', detalhe: 'Aquecimento', icon: '🔥', reps: '3×30s' },
            { nome: 'Remada Alta', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' },
            { nome: 'Afundo', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Panturrilha', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' }
          ],
          quadriceps: [
            { nome: 'Agachamento', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' },
            { nome: 'Afundo', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Polichinelo Agachado', detalhe: 'Peso corporal', icon: '🔥', reps: '3×15' }
          ],
          posterior: [
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Stiff', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Cadeira Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Bicicleta no Solo', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' }
          ]
        },
        'Força': {
          peito: [
            { nome: 'Supino Reto Pesado', detalhe: 'Barra · 5 séries', icon: '🏋️', reps: '5×5' },
            { nome: 'Supino Inclinado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×6' },
            { nome: 'Flexão Ponderada', detalhe: 'Carga · 3 séries', icon: '💪', reps: '3×8' },
            { nome: 'Crossover na Polia', detalhe: 'Polia · 4 séries', icon: '📐', reps: '4×8' }
          ],
          triceps: [
            { nome: 'Tríceps Pulley', detalhe: 'Polia · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Tríceps Testa', detalhe: 'Barra · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Mergulho entre Bancos', detalhe: 'Peso corporal · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Extensão Tríceps Pesada', detalhe: 'Halteres · 4 séries', icon: '💥', reps: '4×6' }
          ],
          costas: [
            { nome: 'Terra Convencional', detalhe: 'Barra · 5 séries', icon: '🏋️', reps: '5×5' },
            { nome: 'Remada Curvada', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×6' },
            { nome: 'Barra Fixa', detalhe: 'Peso corporal · 4 séries', icon: '💪', reps: '4×6' },
            { nome: 'Puxada no Pulley', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×6' }
          ],
          biceps: [
            { nome: 'Rosca Direta', detalhe: 'Barra · 4 séries', icon: '💪', reps: '4×8' },
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×8' },
            { nome: 'Rosca Inclinada', detalhe: 'Halteres · 4 séries', icon: '💪', reps: '4×8' },
            { nome: 'Rosca Concentrada Pesada', detalhe: 'Halteres · 4 séries', icon: '💪', reps: '4×6' }
          ],
          ombro: [
            { nome: 'Desenvolvimento Militar', detalhe: 'Barra · 5 séries', icon: '📐', reps: '5×5' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 4 séries', icon: '📐', reps: '4×8' },
            { nome: 'Remada Alta', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×8' },
            { nome: 'Encolhimento Pesado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×8' }
          ],
          perna: [
            { nome: 'Agachamento Profundo', detalhe: 'Barra · 5 séries', icon: '🦵', reps: '5×5' },
            { nome: 'Leg Press Pesado', detalhe: 'Máquina · 5 séries', icon: '🦵', reps: '5×8' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' }
          ],
          quadriceps: [
            { nome: 'Agachamento Profundo', detalhe: 'Barra · 5 séries', icon: '🦵', reps: '5×5' },
            { nome: 'Leg Press Pesado', detalhe: 'Máquina · 5 séries', icon: '🦵', reps: '5×8' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 4 séries', icon: '🦵', reps: '4×6' },
            { nome: 'Passada', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' }
          ],
          posterior: [
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' },
            { nome: 'Bom Dia', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Elevação Pélvica', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×60s' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Russian Twist', detalhe: 'Halteres · 3 séries', icon: '🧠', reps: '3×12' },
            { nome: 'Dragon Flag', detalhe: 'Banco · 3 séries', icon: '🧠', reps: '3×8' }
          ]
        },
        'Condicionamento': {
          peito: [
            { nome: 'Flexão Explosiva', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Burpee', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Mountain Climber', detalhe: 'Peso corporal · 3 séries', icon: '🔥', reps: '3×30s' },
            { nome: 'Flexão com Palmas', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' }
          ],
          triceps: [
            { nome: 'Mergulho', detalhe: 'Banco · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Corda', detalhe: 'Polia · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps com Elástico', detalhe: 'Elástico · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Mergulho no Banco', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×12' }
          ],
          costas: [
            { nome: 'Remada Rápida', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Puxada na Polia', detalhe: 'Polia · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Superman', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×12' },
            { nome: 'Barra Fixa Explosiva', detalhe: 'Pliométrico · 3 séries', icon: '🏋️', reps: '3×6' }
          ],
          biceps: [
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca com Elástico', detalhe: 'Elástico · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Isométrica', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×30s' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×12' },
            { nome: 'Polichinelo', detalhe: 'Peso corporal', icon: '🔥', reps: '3×30s' },
            { nome: 'Circulação', detalhe: 'Peso corporal', icon: '🔥', reps: '3×30s' },
            { nome: 'Rotação de Ombro', detalhe: 'Elástico · 3 séries', icon: '📐', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento com Salto', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Box Jump', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' },
            { nome: 'Afundo Saltado', detalhe: 'Pliométrico · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Pular Corda', detalhe: 'Intervalado', icon: '🔥', reps: '5×1min' }
          ],
          quadriceps: [
            { nome: 'Agachamento com Salto', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Box Jump', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' },
            { nome: 'Afundo Saltado', detalhe: 'Pliométrico · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Corrida Estacionária', detalhe: 'Alta intensidade', icon: '🔥', reps: '3×30s' }
          ],
          posterior: [
            { nome: 'Stiff', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Superman', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×12' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Bicicleta no Solo', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Montanha', detalhe: 'Peso corporal · 3 séries', icon: '🔥', reps: '3×30s' }
          ]
        }
      };

      var grupo = banco[d.objetivo] || banco['Hipertrofia'];

      function sortear(lista, n) {
        var copia = lista.slice();
        for (var i = copia.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = copia[i]; copia[i] = copia[j]; copia[j] = temp;
        }
        return copia.slice(0, Math.min(n, copia.length));
      }

      function aplicarLesao(exercicios, lesao) {
        if (!lesao) return;
        var l = lesao.toLowerCase();
        for (var e = 0; e < exercicios.length; e++) {
          var ex = exercicios[e];
          if (l.indexOf('ombro') !== -1 && (ex.nome.indexOf('Desenvolvimento') !== -1 || ex.nome.indexOf('Supino') !== -1)) ex.detalhe += ' [Evitar sobrecarga]';
          if ((l.indexOf('coluna') !== -1 || l.indexOf('lombar') !== -1 || l.indexOf('costas') !== -1) && ex.nome.indexOf('Terra') !== -1) ex.detalhe += ' [Substituir por Remada]';
          if (l.indexOf('joelho') !== -1 && (ex.nome.indexOf('Agachamento') !== -1 || ex.nome.indexOf('Leg') !== -1)) ex.detalhe += ' [Carga leve]';
          if (l.indexOf('punho') !== -1 && (ex.nome.indexOf('Rosca') !== -1 || ex.nome.indexOf('Puxada') !== -1)) ex.detalhe += ' [Evitar flexão]';
        }
      }

      var freq = parseInt(d.dias, 10) || 4;

      var configMap = {
        5: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Perna (Quadríceps)', slug: 'C', grupos: ['quadriceps'] },
          { nome: 'Treino D — Ombro', slug: 'D', grupos: ['ombro'] },
          { nome: 'Treino E — Posterior e Abdômen', slug: 'E', grupos: ['posterior', 'abdomen'] }
        ],
        4: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Ombro', slug: 'C', grupos: ['ombro'] },
          { nome: 'Treino D — Perna', slug: 'D', grupos: ['perna'] }
        ],
        3: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Ombro e Perna', slug: 'C', grupos: ['ombro', 'perna'] }
        ],
        2: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] }
        ],
        1: [
          { nome: 'Treino Full Body', slug: 'A', grupos: ['peito', 'costas', 'perna'] }
        ]
      };

      var dias = configMap[freq] || configMap[4];
      var qtd = 8;
      var metade = 4;
      var cardioOpts = ['Bicicleta 15min', 'Esteira 15min'];
      for (var i = 0; i < dias.length; i++) {
        var exs = [];
        var grupos = dias[i].grupos;

        for (var g = 0; g < grupos.length; g++) {
          var lista = grupo[grupos[g]];
          if (lista) {
            var nPorGrupo;
            if (grupos.length === 1) {
              nPorGrupo = Math.min(qtd, lista.length);
            } else {
              // sempre 4 de cada grupo (metade), independente de quantos já foram sorteados
              nPorGrupo = Math.min(metade, lista.length);
            }
            var sorteio = sortear(lista, nPorGrupo);
            if (d.lesao) aplicarLesao(sorteio, d.lesao);
            exs = exs.concat(sorteio);
          }
        }

        if (temCardio) {
          exs.push({
            nome: cardioOpts[i % 2],
            detalhe: 'Cardio · Intensidade moderada',
            icon: '🚴',
            reps: '15min'
          });
        }

        dias[i].exercicios = exs;
      }

      return { nome: 'Protocolo IRONIQA', meta: meta, dias: dias };
    }

    function exibirTreino(protocolo) {
      document.getElementById('empty-workout').style.display = 'none';
      document.getElementById('empty-workout-btn').style.display = 'none';
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';
      document.getElementById('waiting-approved').style.display = 'none';
      var container = document.getElementById('workout-container');
      container.style.display = 'flex';

      document.getElementById('workout-name').textContent = protocolo.nome || 'Protocolo IRONIQA';
      document.getElementById('workout-meta').textContent = protocolo.meta || '';

      // Salva protocolo no localStorage vinculado ao aluno atual
      localStorage.setItem('ironqi_protocolo', JSON.stringify(protocolo));
      var _ownerEmail = localStorage.getItem('ironqi_logado') || '';
      if (_ownerEmail) localStorage.setItem('ironqi_protocolo_aluno', _ownerEmail);

      var dias = protocolo.dias || [];
      var tabContainer = document.getElementById('day-tabs');
      var dayContainer = document.getElementById('workout-days');
      tabContainer.innerHTML = '';
      dayContainer.innerHTML = '';

      for (var i = 0; i < dias.length; i++) {
        var d = dias[i];
        var slug = d.slug || String.fromCharCode(65 + i);

        var tab = document.createElement('button');
        tab.className = 'day-tab' + (i === 0 ? ' active' : '');
        tab.textContent = 'Treino ' + slug;
        tab.onclick = (function(idx) { return function() { selecionarDia(idx); }; })(i);
        tabContainer.appendChild(tab);

        var dayDiv = document.createElement('div');
        dayDiv.className = 'workout-day' + (i === 0 ? ' active' : '');
        dayDiv.id = 'day-panel-' + i;

        var html = '<div class="day-title">' + escHtml(d.nome) + '</div>';
        html += '<div class="day-sub">' + (d.exercicios ? d.exercicios.length + ' exercícios' : '') + '</div>';

        var exs = d.exercicios || [];
        for (var e = 0; e < exs.length; e++) {
          var ex = exs[e];
          html +=
            '<div class="workout-item">' +
              '<div class="icon-circle">' + escHtml(ex.icon || '🏋️') + '</div>' +
              '<div class="info">' +
                '<div class="name">' + escHtml(ex.nome) + '</div>' +
                '<div class="detail">' + escHtml(ex.detalhe || '') + '</div>' +
              '</div>' +
              '<div class="sets">' + escHtml(ex.reps || '') + '</div>' +
            '</div>';
        }

        dayDiv.innerHTML = html;
        dayContainer.appendChild(dayDiv);
      }
      _atualizarBotaoAjuste('treino');
    }

    function exibirDietaAprovada(htmlContent) {
      document.getElementById('empty-dieta').style.display = 'none';
      document.getElementById('empty-dieta-btn').style.display = 'none';
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';
      document.getElementById('waiting-approved').style.display = 'none';
      var container = document.getElementById('dieta-aprovada-container');
      container.style.display = 'flex';
      document.getElementById('dieta-aprovada-content').innerHTML = formatarTextoDieta(htmlContent);
      _atualizarBotaoAjuste('dieta');
    }

    function selecionarDia(idx) {
      var dias = document.querySelectorAll('.workout-day');
      dias.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
      var tabs = document.querySelectorAll('.day-tab');
      tabs.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
      var tabContainer = document.getElementById('day-tabs');
      if (tabContainer && tabContainer.children[idx]) {
        tabContainer.children[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
