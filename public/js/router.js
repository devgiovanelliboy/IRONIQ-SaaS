// ─── MÓDULO: ROUTER / NAVEGAÇÃO SPA ──────────────────────────────────────────
// Depende de: state.js (_st), auth.js (_perfilDoCache, _definirPapel, _sanearFlagsPapel,
//             fecharSidebarMobile), planos.js (verificarAcessoPlano),
//             dashboard.js (carregarDashboard, carregarHidratacao, currentReviewId),
//             protocolo-form.js (_pendingEhAjuste), dieta.js (atualizarDietaBlocker,
//             resetarDieta, carregarDietaAprovada, atualizarIMCBlocker, carregarPaginaIMC),
//             personal-alunos.js (carregarPainelAlunos), personal-review.js (carregarPendentes),
//             evolucao.js (carregarEvolucao), perfil.js (carregarPerfil),
//             treino-ativo.js (carregarTreinoAtivo, iniciarTreino),
//             agenda.js (carregarAgendaPersonal, carregarAgendaAluno),
//             chat.js (chatCarregar, chatAlunoAbrir)
// NOTA: Deve carregar APÓS todos os módulos e ANTES de auth.js (o IIFE de auth.js chama navigate).

    // ─── SPA NAVIGATION ───
    function navigate(pageId) {
      // Route guard: redirect alunos away from restricted pages
      var _navEmail = localStorage.getItem('ironqi_logado');
      if (_navEmail) {
        var _navUsers = _st.usuarios;
        var _navData = _navUsers[_navEmail] ? (_navUsers[_navEmail].dados || {}) : {};
        var _navPerfil = _navData.perfil || _navData.tipo || '';
        var _navStudent = _navPerfil.indexOf('aluno_') === 0 || _navPerfil === 'autonomo' || _navPerfil === 'alunoPersonal';
        if (_navStudent && ['personal-home','personal-dashboard','personal-review','admin','agenda-personal'].indexOf(pageId) !== -1) {
          pageId = 'dashboard';
        }
      }
      // Plano guard: bloqueia acesso sem plano ou com trial expirado
      if (pageId === 'dashboard' || pageId === 'personal-home') {
        if (typeof verificarAcessoPlano === 'function' && verificarAcessoPlano()) return;
      }
      fecharSidebarMobile();
      localStorage.setItem('ultima_pagina', pageId);
      const pages = document.querySelectorAll('.page');
      pages.forEach(p => p.classList.remove('active'));

      const target = document.getElementById('page-' + pageId);
      if (target) target.classList.add('active');

      // Alterna entre layout de autenticação e painel logado
      var appEl = document.getElementById('app');
      if (pageId === 'landing' || pageId === 'login' || pageId === 'cadastro') {
        appEl.classList.add('auth-layout');
        appEl.classList.remove('dashboard-layout');
        // Esconde totalmente os navs em telas de auth
        var _authN1 = document.getElementById('bottom-nav');
        var _authN2 = document.getElementById('bottom-nav-personal');
        if (_authN1) { _authN1.classList.remove('show'); _authN1.style.display = 'none'; }
        if (_authN2) { _authN2.classList.remove('show'); _authN2.style.display = 'none'; }
        var _authS1 = document.getElementById('sidebar-nav');
        var _authS2 = document.getElementById('sidebar-nav-personal');
        if (_authS1) { _authS1.classList.remove('show'); _authS1.style.display = 'none'; }
        if (_authS2) { _authS2.classList.remove('show'); _authS2.style.display = 'none'; }
        if (typeof lucide !== 'undefined') lucide.createIcons();
        return;
      } else {
        appEl.classList.remove('auth-layout');
        appEl.classList.add('dashboard-layout');
        // Restaura navs e define qual exibir com base no perfil logado (sem flash)
        var _n1 = document.getElementById('bottom-nav');
        var _n2 = document.getElementById('bottom-nav-personal');
        var _s1 = document.getElementById('sidebar-nav');
        var _s2 = document.getElementById('sidebar-nav-personal');
        // Decide o nav pelo PERFIL REAL do usuário logado (fonte única _definirPapel),
        // nunca pela flag avulsa — que pode ficar presa de uma sessão anterior e
        // mostrar o nav do papel errado, além de fazer telas lerem dados da conta errada.
        var _navEmailFix = localStorage.getItem('ironqi_logado');
        var _pfFix = _perfilDoCache(_navEmailFix);
        if (_pfFix) _definirPapel(_navEmailFix, _pfFix);
        // Cache pode não ter o perfil ainda (1º acesso). Mesmo assim, NUNCA confiar
        // numa flag de personal de OUTRA conta — saneia pela invariante email==logado.
        _sanearFlagsPapel();
        var _isPersonalNav = !!localStorage.getItem('ironqi_personal_logado');
        if (_n1) { _n1.style.display = ''; _n1.classList.toggle('show', !_isPersonalNav); }
        if (_n2) { _n2.style.display = ''; _n2.classList.toggle('show', _isPersonalNav); }
        if (_s1) { _s1.style.display = ''; _s1.classList.toggle('show', !_isPersonalNav); }
        if (_s2) { _s2.style.display = ''; _s2.classList.toggle('show', _isPersonalNav); }
      }

      // Personal nav
      const personalNav = document.getElementById('bottom-nav-personal');
      if (personalNav) {
        const personalBtns = personalNav.querySelectorAll('button');
        personalBtns.forEach(b => b.classList.remove('active'));
        const personalMatch = personalNav.querySelector(`button[data-page="${pageId}"]`);
        if (personalMatch) personalMatch.classList.add('active');
      }

      // Student nav
      const studentNav = document.getElementById('bottom-nav');
      if (studentNav) {
        const studentBtns = studentNav.querySelectorAll('button');
        studentBtns.forEach(b => b.classList.remove('active'));
        const studentMatch = studentNav.querySelector(`button[data-page="${pageId}"]`);
        if (studentMatch) studentMatch.classList.add('active');
      }

      // Sidebar nav (student)
      const sideNav = document.getElementById('sidebar-nav');
      if (sideNav) {
        const sideItems = sideNav.querySelectorAll('.sidebar-item');
        sideItems.forEach(i => i.classList.remove('active'));
        const sideMatch = sideNav.querySelector(`.sidebar-item[data-page="${pageId}"]`);
        if (sideMatch) sideMatch.classList.add('active');
      }
      // Sidebar nav (personal)
      const sideNavPersonal = document.getElementById('sidebar-nav-personal');
      if (sideNavPersonal) {
        const sideItemsPersonal = sideNavPersonal.querySelectorAll('.sidebar-item');
        sideItemsPersonal.forEach(i => i.classList.remove('active'));
        const sideMatchPersonal = sideNavPersonal.querySelector(`.sidebar-item[data-page="${pageId}"]`);
        if (sideMatchPersonal) sideMatchPersonal.classList.add('active');
      }

      // Re-initialize Lucide icons for new page content
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Inicialização específica de cada página
      if (pageId === 'dashboard') { carregarDashboard(); carregarHidratacao(); }
      if (pageId === 'iniciar-treino') iniciarTreino();
      if (pageId === 'treino-ativo') carregarTreinoAtivo();
      if (pageId === 'evolucao') carregarEvolucao();
      if (pageId === 'personal-home') carregarPainelAlunos();
      if (pageId === 'agenda-personal') carregarAgendaPersonal();
      if (pageId === 'agenda-aluno') carregarAgendaAluno();
      if (pageId === 'personal-dashboard') carregarPendentes();
      if (pageId === 'perfil') carregarPerfil();
      if (pageId === 'planos') inicializarPlanos();
      if (pageId === 'dieta') {
        if (!_pendingEhAjuste) atualizarDietaBlocker();
        else {
          // Ajuste: esconde todos os blockers para deixar o formulário aberto
          var _db = document.getElementById('dieta-blocker');
          var _cb = document.getElementById('dieta-ciclo-blocker');
          if (_db) _db.style.display = 'none';
          if (_cb) _cb.style.display = 'none';
        }
        resetarDieta();
        carregarDietaAprovada();
      }
      if (pageId === 'imc') {
        atualizarIMCBlocker();
        carregarPaginaIMC();
      }
      if (pageId === 'personal-review' && !currentReviewId) {
        document.getElementById('review-content').innerHTML = '<div class="personal-empty"><div class="icon-big">🔍</div><h3>Nenhum treino selecionado</h3><p>Volte para lista e clique em um treino para revisar.</p></div>';
        document.getElementById('review-actions').innerHTML = '<button class="btn btn-secondary" onclick="navigate(\'personal-dashboard\')">Voltar para lista</button>';
      }
    }

    // Patch: carrega chat ao navegar para páginas de chat
    var navigateOriginal = navigate;
    navigate = function(page) {
      navigateOriginal(page);
      if (page === 'chat') chatCarregar();
      if (page === 'aluno-chat') chatAlunoAbrir();
    };
