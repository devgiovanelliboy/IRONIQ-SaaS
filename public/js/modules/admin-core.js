// ─── MÓDULO: ADMIN / CORE + DASHBOARD ────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             services/firestore.js (setFsUserData)
    // ─── ADMIN PAINEL ───

    // Resolve o UID de qualquer email: tenta cache em memória, depois uidMap do Firestore.
    function _adminGetUid(email, cb) {
      var uid = emailToUid[email];
      if (uid) { cb(uid); return; }
      if (!db) { cb(null); return; }
      db.collection('uidMap').doc(email.replace(/\./g, ',')).get()
        .then(function(d) {
          if (d.exists) { var u = d.data().uid; saveUidMapping(email, u); cb(u); }
          else cb(null);
        })
        .catch(function() { cb(null); });
    }

    // Escreve campos no doc Firestore do usuário (lookup via uidMap se necessário).
    function _adminFsUpdate(email, fields, onOk, onErr) {
      if (isDemo || !db) { if (onOk) onOk(); return; }
      _adminGetUid(email, function(uid) {
        if (!uid) { if (onErr) onErr('uid_not_found'); return; }
        db.collection('usuarios').doc(uid).update(fields)
          .then(function() { if (onOk) onOk(); })
          .catch(function(e) { if (onErr) onErr(e.code || e.message || e); });
      });
    }

    function adminNav(sectionId) {
      localStorage.setItem('ultima_pagina', sectionId);
      document.querySelectorAll('.admin-nav-item').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-section') === sectionId);
      });
      document.querySelectorAll('.admin-section').forEach(function(s) {
        s.classList.toggle('active', s.id === sectionId);
      });
      if (sectionId === 'admin-dashboard') carregarAdminDashboard();
      if (sectionId === 'admin-usuarios') carregarAdminUsuarios();
      if (sectionId === 'admin-planos') carregarAdminPlanos();
      if (sectionId === 'admin-personais') carregarAdminPersonais();
      if (sectionId === 'admin-comissoes') carregarAdminComissoes();
      if (sectionId === 'admin-config') carregarAdminConfig();
    }

    function sairAdmin() {
      if (!confirm('Sair do painel administrativo?')) return;
      _limparEstadoSessao();
      localStorage.removeItem('ultima_pagina');
      localStorage.removeItem('ironqi_admin_logado');
      localStorage.removeItem('ironqi_logado');
      localStorage.removeItem('ironqi_personal_logado');
      if (auth) { auth.signOut(); }
      document.getElementById('page-admin').classList.remove('active');
      document.querySelectorAll('.page').forEach(function(p) { p.classList.remove('active'); });
      document.getElementById('page-landing').classList.add('active');
      document.getElementById('page-login').style.removeProperty('display');
      document.getElementById('app').classList.remove('auth-layout', 'dashboard-layout', 'sidebar-collapsed');
    }

    function toggleAdminSidebar() {
      var sidebar = document.querySelector('.admin-sidebar');
      var backdrop = document.getElementById('admin-backdrop');
      if (!sidebar) return;
      var open = sidebar.classList.toggle('mobile-open');
      if (backdrop) backdrop.classList.toggle('open', open);
    }

    function carregarAdminDashboard() {
      document.getElementById('admin-dash-date').textContent = new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      var adminBanner = document.getElementById('admin-banner-trial');
      if (adminBanner) adminBanner.style.display = 'none';

      // Admin sempre carrega todos os usuários direto do Firestore (sem cache localStorage)
      var _renderAdmin = function() {
        var usuarios = _st.usuarios;
        var pendentes = _st.pendentes;
        var userStatus = _st.userStatus;
        var planos = {};
        Object.assign(planos, _st.planos);
        _renderAdminDashboardInner(usuarios, pendentes, planos);
      };
      if (!isDemo && db && Object.keys(_st.usuarios).length === 0) {
        db.collection('usuarios').get().then(function(snap) {
          snap.forEach(function(doc) {
            var d = doc.data();
            if (d.email) {
              _st.usuarios[d.email] = { dados: d, criadoEm: d.criadoEm || '' };
              if (d.plano) _st.planos[d.email] = d.plano;
              if (d.planoVencimento) _st.planoVencimento[d.email] = d.planoVencimento;
              saveUidMapping(d.email, doc.id);
            }
          });
          _renderAdmin();
        }).catch(function(e) {
          console.warn('Admin load users error:', e.code || e);
          _renderAdmin();
        });
      } else {
        _renderAdmin();
      }
    }
    function _renderAdminDashboardInner(usuarios, pendentes, planos) {
      var keys = Object.keys(usuarios);
      var totalUsers = keys.length;
      var totalAutonomos = 0, totalPersonais = 0;
      keys.forEach(function(e) { var d = usuarios[e].dados || {}; var t = d.perfil || d.tipo || ''; if (t === 'autonomo' || t === 'aluno_autonomo' || t === '') totalAutonomos++; else if (t === 'personal' || t === 'aluno_personal') totalPersonais++; });
      var totalPlanos = Object.keys(planos).length;
      var receitaMap = { 'aluno_start': 19.90, 'aluno_pro': 29.90, 'personal_pro': 39.90, 'personal_elite': 79.90 };
      var receitaMensal = 0, expiradas = 0;
      Object.keys(planos).forEach(function(k) { var p = planos[k]; if (receitaMap[p]) receitaMensal += receitaMap[p]; else if (p === 'personal_free') { /* free */ } else expiradas++; });
      document.getElementById('admin-dash-cards').innerHTML =
        '<div class="iron-card" style="cursor:default;"><div class="label">Total de Usuários</div><div class="value">' + totalUsers + '</div><div class="sub">Todas as contas</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Alunos Autônomos</div><div class="value">' + totalAutonomos + '</div><div class="sub">Contas de aluno</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Personais</div><div class="value">' + totalPersonais + '</div><div class="sub">Personal trainers</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Assinaturas Ativas</div><div class="value">' + totalPlanos + '</div><div class="sub">Planos vigentes</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Assinaturas Expiradas</div><div class="value">' + expiradas + '</div><div class="sub">Sem renovação</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Receita Mensal</div><div class="value">R$ ' + receitaMensal.toFixed(2) + '</div><div class="sub">Estimativa atual</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Receita Anual</div><div class="value">R$ ' + (receitaMensal * 12).toFixed(2) + '</div><div class="sub">Projeção 12 meses</div></div>';

      var atv = document.getElementById('admin-dash-activity');
      if (pendentes.length) {
        var ultimo = pendentes[pendentes.length - 1];
        atv.innerHTML = '<div style="color:#999;">📋 ' + getAlunoNome(ultimo.alunoEmail) + ' solicitou treino — ' + new Date(ultimo.dataGerado).toLocaleString('pt-BR') + '</div>';
      } else { atv.innerHTML = '<span style="color:#888;">Nenhuma atividade registrada.</span>'; }

      var trialConf = _st.trialConfig;
      var trialBanner = document.getElementById('admin-banner-trial');
      if (trialBanner) {
        var trialStatus = trialConf.ativo ? 'TESTE GRÁTIS ATIVO' : 'TESTE GRÁTIS INATIVO';
        trialBanner.querySelector('.text').innerHTML = '<i data-lucide="' + (trialConf.ativo ? 'clock' : 'alert-circle') + '"></i> ' + trialStatus;
        trialBanner.querySelector('.countdown').textContent = trialConf.duracao + 'h liberadas';
        trialBanner.style.borderColor = trialConf.ativo ? 'rgba(204,255,0,0.35)' : 'rgba(255,68,68,0.3)';
      }

      renderAdminCharts(usuarios, planos, keys);
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    var adminCharts = {};

    function renderAdminCharts(usuarios, planos, userKeys) {
      if (adminCharts.crescimentoUsuarios) adminCharts.crescimentoUsuarios.destroy();
      if (adminCharts.crescimentoAssinaturas) adminCharts.crescimentoAssinaturas.destroy();
      if (adminCharts.distribuicaoPlanos) adminCharts.distribuicaoPlanos.destroy();

      ensureChartJs(function() {
        var ctx1 = document.getElementById('chart-crescimento-usuarios').getContext('2d');
        var datas = [];
        var contagem = [];
        var sorted = userKeys.slice().sort(function(a, b) {
          var da = usuarios[a].criadoEm || ''; var db = usuarios[b].criadoEm || '';
          return da < db ? -1 : da > db ? 1 : 0;
        });
        var acc = 0;
        sorted.forEach(function(e) {
          var d = usuarios[e].criadoEm ? new Date(usuarios[e].criadoEm).toLocaleDateString('pt-BR') : '—';
          if (datas.length === 0 || datas[datas.length - 1] !== d) {
            datas.push(d); acc = 1;
          } else { acc++; }
          contagem.push(acc);
        });
        if (!datas.length) { datas = ['Sem dados']; contagem = [0]; }

        adminCharts.crescimentoUsuarios = new Chart(ctx1, {
          type: 'line', data: { labels: datas, datasets: [{ label: 'Usuários', data: contagem, borderColor: '#CCFF00', backgroundColor: 'rgba(204,255,0,0.08)', borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#555', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#CCFF00', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
        });

        var ctx2 = document.getElementById('chart-crescimento-assinaturas').getContext('2d');
        var planosKeys = Object.keys(planos);
        var datasP = [];
        var contagemP = [];
        var sortedP = planosKeys.slice().sort();
        var accP = 0;
        sortedP.forEach(function(e) {
          accP++;
          if (datasP.length < 10) { datasP.push(e.split('@')[0] + '…'); contagemP.push(accP); }
        });
        if (!datasP.length) { datasP = ['Sem dados']; contagemP = [0]; }
        adminCharts.crescimentoAssinaturas = new Chart(ctx2, {
          type: 'line', data: { labels: datasP, datasets: [{ label: 'Assinaturas', data: contagemP, borderColor: '#4ECDC4', backgroundColor: 'rgba(78,205,196,0.08)', borderWidth: 2, pointRadius: 2, fill: true, tension: 0.3 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888', font: { size: 11 } } } }, scales: { x: { ticks: { color: '#555', font: { size: 9 }, maxTicksLimit: 8 }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#4ECDC4', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
        });

        var ctx3 = document.getElementById('chart-distribuicao-planos').getContext('2d');
        var nomes = { 'aluno_start': 'Aluno START', 'aluno_pro': 'Aluno PRO', 'personal_free': 'Personal FREE', 'personal_pro': 'Personal PRO', 'personal_elite': 'Personal ELITE' };
        var contPlano = {}; planosKeys.forEach(function(k) { var p = planos[k]; contPlano[p] = (contPlano[p] || 0) + 1; });
        var labelsP = []; var dataP = []; var cores = ['#CCFF00','#4ECDC4','#FF6B6B','#45B7D1','#FFD93D','#DDA0DD','#6BCB77','#FF8C42'];
        Object.keys(contPlano).forEach(function(p, i) { labelsP.push(nomes[p] || p); dataP.push(contPlano[p]); });
        if (!labelsP.length) { labelsP = ['Sem planos']; dataP = [1]; }
        adminCharts.distribuicaoPlanos = new Chart(ctx3, {
          type: 'doughnut', data: { labels: labelsP, datasets: [{ data: dataP, backgroundColor: cores.slice(0, labelsP.length), borderColor: '#0E1111', borderWidth: 2 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#aaa', font: { size: 10 }, boxWidth: 12, padding: 8 } } } }
        });
      });
    }

