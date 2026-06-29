// ─── MÓDULO: PERSONAL / PAINEL DE ALUNOS ─────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db)
//             personal-kanban.js (renderKanban), evolucao.js (carregarEvolucao)
// ─── MÓDULO: PERSONAL (painel, revisão, protocolos) ──────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             comissoes.js (pessoalTemComissao), utils.js (escHtml)
    // Busca alunos do personal no Firestore e merge no localStorage para uso offline
    // Personal Interno também vê alunos autônomos (vinculados ao Personal Principal)
    function sincronizarAlunosDoPersonal(myEmail, callback) {
      if (isDemo || !db) { if (callback) callback(); return; }
      // Alunos vinculados diretamente + alunos autônomos delegados a mim via chat_atendente.
      // (As regras do Firestore permitem o personal ler docs onde personal_vinculado OU
      //  chat_atendente == seu e-mail; a antiga query ampla por PERSONAL_PRINCIPAL era
      //  negada para o interno e derrubava toda a sincronização.)
      var queries = [
        db.collection('usuarios').where('personal_vinculado', '==', myEmail).get(),
        db.collection('usuarios').where('chat_atendente', '==', myEmail).get()
      ];
      Promise.all(queries).then(function(snaps) {
        var usuarios = _st.usuarios;
        snaps.forEach(function(snap) {
          snap.forEach(function(doc) {
            var data = doc.data();
            var aEmail = data.email;
            if (aEmail) {
              if (!usuarios[aEmail]) usuarios[aEmail] = { dados: {}, criadoEm: new Date().toISOString() };
              for (var k in data) usuarios[aEmail].dados[k] = data[k];
              saveUidMapping(aEmail, doc.id);
            }
          });
        });
        _st.usuarios = usuarios;
        if (callback) callback();
      }).catch(function(e) {
        console.warn('Firestore student sync error:', e.code || e);
        if (callback) callback();
      });
    }

    function carregarPainelAlunos() {
      var grid = document.getElementById('personal-home-grid');
      if (!grid) return;
      var myEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!myEmail) { grid.innerHTML = '<div class="personal-home-empty"><div class="icon-big">🔒</div><h3>Faça login primeiro</h3></div>'; return; }
      // Sincroniza alunos e protocolos pendentes do Firestore antes de renderizar
      sincronizarAlunosDoPersonal(myEmail, function() {
      sincronizarProtocolosPendentes(myEmail, function() {
      var searchTerm = (document.getElementById('personal-home-search').value || '').toLowerCase().trim();
      var usuarios = _st.usuarios;
      var pendentes = _st.pendentes;
      var pendencias = _st.protocolos;
      var alunos = [];
      var _meInterno = isPersonalInterno(myEmail);
      Object.keys(usuarios).forEach(function(k) {
        var d = usuarios[k].dados || {};
        var ehMeu = d.personal_vinculado === myEmail;
        var ehAutonomoInterno = _meInterno && d.personal_vinculado === PERSONAL_PRINCIPAL;
        if (ehMeu || ehAutonomoInterno) alunos.push({ email: k, dados: d });
      });
      var pendentesCount = 0, revisaoCount = 0;
      pendencias.forEach(function(p) {
        if (p.status === 'pendente_aprovacao') pendentesCount++;
        else if (p.status === 'aguardando_aceite_aluno') revisaoCount++;
      });

      document.getElementById('ph-stat-alunos').textContent = alunos.length;
      document.getElementById('ph-stat-pendentes').textContent = pendentesCount;
      document.getElementById('ph-stat-revisao').textContent = revisaoCount;
      document.getElementById('personal-home-count').textContent = alunos.length + ' aluno' + (alunos.length !== 1 ? 's' : '');

      if (!alunos.length) {
        grid.innerHTML = '<div class="personal-home-empty"><div class="icon-big">📋</div><h3>Nenhum aluno vinculado</h3><p>Compartilhe seu e-mail com seus alunos para que eles possam se vincular a você.</p></div>';
        return;
      }
      var html = '';
      alunos.forEach(function(a) {
        var nome = (a.dados.nome || '') + ' ' + (a.dados.sobrenome || '');
        nome = nome.trim() || a.email.split('@')[0];
        var show = !searchTerm || nome.toLowerCase().indexOf(searchTerm) !== -1 || a.email.toLowerCase().indexOf(searchTerm) !== -1;
        if (!show) return;
        var avatarSrc = a.dados.fotoUrl || a.dados.avatarUrl || '';
        var idade = a.dados.idade || a.dados.idade_anos || '—';
        var peso = a.dados.peso || '—';
        var altura = a.dados.altura || a.dados.altura_cm || '—';
        var imc = '—';
        if (peso !== '—' && altura !== '—') {
          var altM = parseFloat(altura) / 100;
          imc = altM > 0 ? (parseFloat(peso) / (altM * altM)).toFixed(1) : '—';
        }
        var hasPendente = pendencias.some(function(p) { return p.alunoEmail === a.email && p.status === 'pendente_aprovacao'; });
        var avatarHtml = avatarSrc
          ? '<img src="' + escHtml(avatarSrc) + '" alt="">'
          : (a.dados.nome ? a.dados.nome[0].toUpperCase() : a.email[0].toUpperCase());
        var emailEsc = a.email.replace(/'/g, "\\'");
        html +=
          '<div class="aluno-card">' +
            '<div class="aluno-card-header">' +
              '<div class="aluno-avatar">' + avatarHtml + '</div>' +
              '<div>' +
                '<div class="aluno-card-nome">' + escHtml(nome) + '</div>' +
                '<div class="aluno-card-email">' + escHtml(a.email) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="aluno-card-info">' +
              '<span><span class="info-label">Idade:</span> <span class="info-value">' + idade + '</span></span>' +
              '<span><span class="info-label">Peso:</span> <span class="info-value">' + peso + ' kg</span></span>' +
              '<span><span class="info-label">IMC:</span> <span class="info-value">' + imc + '</span></span>' +
              (hasPendente ? '<span style="color:#FFB700;font-weight:700;">⚠️ Revisão</span>' : '') +
            '</div>' +
            '<div class="aluno-card-actions">' +
              '<button onclick="abrirTreinoAluno(\'' + emailEsc + '\')">🏋️ Ver Treino</button>' +
              '<button onclick="abrirDietaAluno(\'' + emailEsc + '\')">🥗 Ver Dieta</button>' +
              '<button onclick="abrirEvolucaoAluno(\'' + emailEsc + '\')">📊 Evolução</button>' +
            '</div>' +
          '</div>';
      });
      if (!html) {
        grid.innerHTML = '<div class="personal-home-empty"><div class="icon-big">🔍</div><h3>Nenhum aluno encontrado</h3><p>Tente um termo de busca diferente.</p></div>';
        return;
      }
      grid.innerHTML = html;
      }); // fim sincronizarProtocolosPendentes callback
      }); // fim sincronizarAlunosDoPersonal callback
    }

    function abrirTreinoAluno(email) {
      var pendentes = _st.pendentes;
      var aprovado = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].alunoEmail === email && pendentes[i].status === 'approved' && pendentes[i].protocolo) {
          if (!aprovado || pendentes[i].dataAprovado > aprovado.dataAprovado) {
            aprovado = pendentes[i];
          }
        }
      }
      if (aprovado && aprovado.protocolo) {
        localStorage.setItem('ironqi_protocolo', JSON.stringify(aprovado.protocolo));
        localStorage.setItem('ironqi_protocolo_aluno', email);
        currentReviewId = aprovado.id;
        navigate('treino-ativo');
      } else {
        alert('Nenhum treino aprovado encontrado para este aluno.');
      }
    }

    function abrirDietaAluno(email) {
      var pendentes = _st.pendentes;
      var aprovado = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].alunoEmail === email && pendentes[i].tipo === 'dieta' && pendentes[i].status === 'approved' && pendentes[i].dieta) {
          if (!aprovado || pendentes[i].dataAprovado > aprovado.dataAprovado) {
            aprovado = pendentes[i];
          }
        }
      }
      if (aprovado && aprovado.dieta) {
        localStorage.setItem('ironqi_dieta_texto', aprovado.dieta);
        navigate('dieta');
      } else {
        alert('Nenhuma dieta aprovada encontrada para este aluno.');
      }
    }

    function abrirEvolucaoAluno(email) {
      localStorage.setItem('ironqi_evolucao_aluno', email);
      navigate('evolucao');
    }

    function voltarEvolucaoPersonal() {
      localStorage.removeItem('ironqi_evolucao_aluno');
      carregarEvolucao();
    }

