// ─── MÓDULO: PROTOCOLO / FORM + GERAÇÃO ──────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             comissoes.js (registrarComissao), planos.js (verificarLimiteSolicitacao, getPlanoUsuario)
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

