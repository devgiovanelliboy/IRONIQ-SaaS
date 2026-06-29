// ─── MÓDULO: PERSONAL KANBAN / GESTÃO DE ALUNOS ──────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             personal.js (carregarPainelAlunos, sincronizarAlunosDoPersonal)
    function personalTab(tab) {
      document.querySelectorAll('.perfil-personal-tabs button').forEach(function(b) { b.classList.remove('active'); });
      var btn = document.querySelector('.perfil-personal-tabs button[data-ptab="' + tab + '"]');
      if (btn) btn.classList.add('active');
      var perfilContent = document.querySelector('.perfil-duas-colunas');
      var kanban = document.getElementById('perfil-kanban');
      if (!perfilContent) return;
      if (tab === 'perfil') {
        perfilContent.style.display = 'grid';
        kanban.style.display = 'none';
      } else if (tab === 'alunos') {
        perfilContent.style.display = 'none';
        kanban.style.display = 'block';
      } else {
        perfilContent.style.display = 'none';
        kanban.style.display = 'none';
      }
    }

    // ─── RENDER KANBAN ───
    var kanbanCardCounter = 0;

    function getPendenciasAluno(email) {
      if (isDemo || !db) {
        var analises = _st.protocolos;
        return analises.filter(function(a) { return a.alunoEmail === email && a.status === 'pendente_aprovacao'; });
      }
      return [];
    }

    function renderKanban(email, usuarios) {
      kanbanCardCounter = 0;
      sincronizarAlunosDoPersonal(email, function() {
      sincronizarProtocolosPendentes(email, function() {
        var todosUsuarios = _st.usuarios;
        var vinculados = [], autonomos = [];
        var _kbInterno = isPersonalInterno(email);
        Object.keys(todosUsuarios).forEach(function(k) {
          var d = todosUsuarios[k].dados || {};
          var perfil = d.perfil || d.tipo || '';
          var ehMeu = d.personal_vinculado === email;
          var ehAutonomoInterno = _kbInterno && d.personal_vinculado === PERSONAL_PRINCIPAL;
          if (!ehMeu && !ehAutonomoInterno) return;
          if (perfil === 'aluno_autonomo' || perfil === 'autonomo') {
            autonomos.push({ email: k, dados: d });
          } else {
            vinculados.push({ email: k, dados: d });
          }
        });
        renderKanbanColuna('kanban-vinculados-body', 'kanban-vinculados-badge', vinculados, 'vinculados');
        renderKanbanColuna('kanban-autonomos-body', 'kanban-autonomos-badge', autonomos, 'autonomos');
        _atualizarLimiteAlunos(vinculados.length);
      }); // fim sincronizarProtocolosPendentes callback
      });
    }

    // Mostra o uso vs. limite de alunos do plano do personal e alerta quando atingido.
    // Retorna true se o limite foi atingido/excedido.
    function _atualizarLimiteAlunos(count) {
      var banner = document.getElementById('kanban-limite-banner');
      var badge = document.getElementById('kanban-vinculados-badge');
      var plano = getPlanoUsuario();
      var cfg = (typeof obterPlanosConfig === 'function') ? obterPlanosConfig() : {};
      var limite = (cfg[plano] && typeof cfg[plano].limiteAlunos === 'number') ? cfg[plano].limiteAlunos : 0;
      var atingido = limite > 0 && count >= limite;
      if (badge) badge.textContent = limite > 0 ? (count + ' / ' + limite) : String(count);
      if (banner) {
        if (atingido) {
          banner.style.display = 'block';
          banner.textContent = '⚠️ Limite de alunos do seu plano atingido (' + count + '/' + limite + '). Faça upgrade para vincular mais alunos.';
        } else {
          banner.style.display = 'none';
        }
      }
      return atingido;
    }

    function renderKanbanColuna(bodyId, badgeId, lista, tipo) {
      var body = document.getElementById(bodyId);
      var badge = document.getElementById(badgeId);
      var pendencias = _st.protocolos;
      badge.textContent = lista.length;
      if (!lista.length) {
        body.innerHTML = '<div class="kanban-empty">Nenhum aluno ' + (tipo === 'vinculados' ? 'vinculado' : 'autônomo') + ' encontrado.</div>';
        return;
      }
      var html = '';
      lista.forEach(function(a) {
        var idx = kanbanCardCounter++;
        var nome = (a.dados.nome || '') + ' ' + (a.dados.sobrenome || '');
        nome = nome.trim() || a.email.split('@')[0];
        var avatarSrc = a.dados.fotoUrl || a.dados.avatarUrl || '';
        var peso = a.dados.peso || '—';
        var altura = a.dados.altura || a.dados.altura_cm || '—';
        var imc = '—';
        if (peso !== '—' && altura !== '—') {
          var altM = parseFloat(altura) / 100;
          imc = altM > 0 ? (parseFloat(peso) / (altM * altM)).toFixed(1) : '—';
        }
        var avatarHtml = avatarSrc ? '<img src="' + escHtml(avatarSrc) + '" alt="">' : escHtml(a.dados.nome ? a.dados.nome[0].toUpperCase() : a.email[0].toUpperCase());

        // REGRA 3: verifica protocolos pendentes direcionados a este personal
        var temPendente = pendencias.some(function(p) {
          if (p.alunoEmail !== a.email || p.status !== 'pendente_aprovacao') return false;
          var pDir = p.direcionadoPara || PERSONAL_PRINCIPAL;
          return pDir === email || pDir === PERSONAL_PRINCIPAL || pDir === 'personal_principal';
        });
        var badgeHtml = temPendente
          ? '<div style="margin-top:6px;"><span class="status-badge status-pending" style="animation: blinkPulse 1.2s ease-in-out infinite; display:inline-block;">⚠️ REVISÃO PENDENTE</span></div>'
          : '';

        var onclickCard = temPendente ? 'abrirRevisaoPendente(\'' + a.email + '\')' : '';

        html +=
          '<div class="student-card" onclick="' + onclickCard + '" style="cursor:' + (temPendente ? 'pointer' : 'default') + '">' +
            '<div class="student-card-header">' +
              '<div class="student-card-avatar">' + avatarHtml + '</div>' +
              '<div class="student-card-info">' +
                '<div class="student-card-nome">' + escHtml(nome) + '</div>' +
                '<div class="student-card-email">' + escHtml(a.email) + '</div>' +
              '</div>' +
            '</div>' +
            '<div class="student-card-body">' +
              '<span>⚖️ Peso: ' + escHtml(peso) + ' kg</span>' +
              '<span>📏 Altura: ' + escHtml(altura) + ' cm</span>' +
              '<span>📊 IMC: ' + imc + '</span>' +
              badgeHtml +
            '</div>' +
            '<div class="student-card-menu">' +
              '<button class="student-card-menu-btn" onclick="event.stopPropagation();toggleStudentMenu(' + idx + ')">⋮</button>' +
              '<div class="student-card-menu-dropdown" id="menu-' + idx + '">' +
                '<button onclick="verFichaAluno(\'' + a.email + '\')">📋 Ver Ficha de Treino</button>' +
                '<button onclick="alterarSenhaAluno(\'' + a.email + '\')">🔑 Alterar Senha</button>' +
                '<button class="danger" onclick="desvincularAluno(\'' + a.email + '\')">❌ Desvincular Aluno</button>' +
              '</div>' +
            '</div>' +
          '</div>';
      });
      body.innerHTML = html;
    }

    function abrirRevisaoPendente(email) {
      var pendencias = _st.protocolos;
      var meuEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      for (var i = 0; i < pendencias.length; i++) {
        if (pendencias[i].alunoEmail !== email || pendencias[i].status !== 'pendente_aprovacao') continue;
        var dir = pendencias[i].direcionadoPara || 'personal_principal';
        if (dir !== meuEmail && dir !== 'personal_principal') continue;
        abrirModalAprovacao(pendencias[i].id);
        return;
      }
    }

    function toggleStudentMenu(idx) {
      var dropdown = document.getElementById('menu-' + idx);
      var isOpen = dropdown.classList.contains('open');
      document.querySelectorAll('.student-card-menu-dropdown').forEach(function(d) { d.classList.remove('open'); });
      if (!isOpen) dropdown.classList.add('open');
    }
    document.addEventListener('click', function(e) {
      if (!e.target.closest('.student-card-menu')) {
        document.querySelectorAll('.student-card-menu-dropdown').forEach(function(d) { d.classList.remove('open'); });
      }
    });

    function verFichaAluno(email) {
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
        navigate('treino-ativo');
        var n2 = document.getElementById('bottom-nav-personal');
        if (n2) { n2.classList.remove('show'); n2.style.display = 'none'; }
        var s2 = document.getElementById('sidebar-nav-personal');
        if (s2) { s2.classList.remove('show'); s2.style.display = 'none'; }
        var n1 = document.getElementById('bottom-nav');
        if (n1) n1.classList.remove('show');
      } else {
        alert('Este aluno ainda não possui um treino aprovado. Solicite um treino primeiro.');
      }
    }

    var _senhaAlunoEmail = '';
    function alterarSenhaAluno(email) {
      _senhaAlunoEmail = email;
      var usuarios = _st.usuarios;
      var nome = (usuarios[email] && usuarios[email].dados && usuarios[email].dados.nome) || email.split('@')[0];
      document.getElementById('modal-senha-aluno-info').textContent = 'Aluno: ' + nome + ' (' + email + ')';
      document.getElementById('modal-senha-input').value = Math.random().toString(36).slice(2, 8);
      document.getElementById('modal-senha-aluno').style.display = 'flex';
    }
    function salvarSenhaAluno() {
      var email = _senhaAlunoEmail;
      if (!email) return;
      var novaSenha = document.getElementById('modal-senha-input').value.trim();
      if (!novaSenha) { alert('Digite uma senha.'); return; }
      var usuarios = _st.usuarios;
      if (!usuarios[email]) usuarios[email] = { senha: '', dados: {} };
      usuarios[email].senha = novaSenha;
      _st.usuarios = usuarios;
      alert('Senha alterada com sucesso para: ' + email);
      fecharModalSenha();
    }
    function fecharModalSenha() {
      document.getElementById('modal-senha-aluno').style.display = 'none';
      _senhaAlunoEmail = '';
    }

    function desvincularAluno(email) {
      if (!confirm('Desvincular aluno ' + email + '? Ele passará a ser autônomo.')) return;
      var usuarios = _st.usuarios;
      if (usuarios[email] && usuarios[email].dados) {
        delete usuarios[email].dados.personal_vinculado;
        usuarios[email].dados.tipo = 'autonomo';
        usuarios[email].dados.perfil = 'aluno_autonomo';
        _st.usuarios = usuarios;
        var personalEmail = localStorage.getItem('ironqi_logado');
        renderKanban(personalEmail, usuarios);
      }
    }