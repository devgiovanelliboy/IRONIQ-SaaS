// ─── MÓDULO: ADMIN PAINEL ────────────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth),
//             uid-map.js (saveUidMapping, emailToUid), utils.js (escapeHtml)

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

    var adminFiltroAtual = 'todos';
    var adminBuscaAtual = '';

    function adminFiltrarUsuarios(filtro) {
      adminFiltroAtual = filtro;
      document.querySelectorAll('#admin-users-filters .admin-filter-btn').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-filter') === filtro);
      });
      carregarAdminUsuarios();
    }

    function _renderAdminUsuarios() {
      var usuarios = _st.usuarios;
      var userStatus = _st.userStatus;
      var planos = {};
      Object.assign(planos, _st.planos);
      var nomesPlanos = { 'aluno_start': 'Aluno START', 'aluno_pro': 'Aluno PRO', 'personal_free': 'Personal FREE', 'personal_pro': 'Personal PRO', 'personal_elite': 'Personal ELITE' };
      var busca = (document.getElementById('admin-users-search').value || '').toLowerCase().trim();
      var filtro = adminFiltroAtual || 'todos';
      var keys = Object.keys(usuarios);
      var html = ''; var count = 0;
      keys.forEach(function(email) {
        var u = usuarios[email]; var d = u.dados || {};
        var nome = ((d.nome || '') + ' ' + (d.sobrenome || '')).trim() || '—';
        var tipo = d.tipo || ({'aluno_autonomo':'autonomo','aluno_personal':'alunoPersonal','personal':'personal'})[d.perfil] || 'autonomo';
        var plano = planos[email] ? (nomesPlanos[planos[email]] || planos[email]) : '—';
        var status = userStatus[email] || d.status || 'ativo';
        var criado = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString('pt-BR') : '—';

        // Excluídos nunca aparecem na listagem
        if (status === 'excluido') return;

        if (filtro === 'alunos' && tipo !== 'autonomo' && tipo !== 'alunoPersonal') return;
        if (filtro === 'personais' && tipo !== 'personal') return;
        if (filtro === 'ativos' && status !== 'ativo') return;
        if (filtro === 'bloqueados' && status !== 'bloqueado') return;
        if (busca && nome.toLowerCase().indexOf(busca) === -1 && email.toLowerCase().indexOf(busca) === -1) return;

        count++;
        var statusBadge = status === 'bloqueado' ? '<span class="badge red">Bloqueado</span>' : '<span class="badge green">Ativo</span>';
        var tipoLabel = tipo === 'autonomo' ? 'Aluno' : tipo === 'alunoPersonal' ? 'Aluno (Personal)' : tipo.charAt(0).toUpperCase() + tipo.slice(1);
        var emailEsc = email.replace(/'/g, "\\'");
        html += '<tr>' +
          '<td>' + escHtml(nome) + '</td>' +
          '<td>' + email + '</td>' +
          '<td>' + tipoLabel + '</td>' +
          '<td>' + plano + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td>' + criado + '</td>' +
          '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="admin-action-btn edit" title="Editar" onclick="adminEditarUsuario(\'' + emailEsc + '\')">✏️</button>' +
            (status === 'bloqueado'
              ? '<button class="admin-action-btn unlock" title="Liberar" onclick="adminLiberarUsuario(\'' + emailEsc + '\')">🔓</button>'
              : '<button class="admin-action-btn block" title="Bloquear" onclick="adminBloquearUsuario(\'' + emailEsc + '\')">🔒</button>') +
            '<button class="admin-action-btn delete" title="Excluir" onclick="adminExcluirUsuario(\'' + emailEsc + '\')">🗑️</button>' +
          '</td>' +
        '</tr>';
      });
      document.getElementById('admin-users-tbody').innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:#555;padding:24px;">Nenhum usuário encontrado.</td></tr>';
      document.getElementById('admin-users-count').textContent = count + ' registro' + (count !== 1 ? 's' : '');
    }

    function carregarAdminUsuarios() {
      // Renderiza imediatamente do cache local
      _renderAdminUsuarios();
      // Sincroniza com Firestore em segundo plano e re-renderiza com dados atualizados
      if (isDemo || !db) return;
      db.collection('usuarios').get().then(function(snap) {
        var usuarios = _st.usuarios;
        var userStatus = _st.userStatus;
        var emailsNoFirestore = {};
        snap.forEach(function(doc) {
          var data = doc.data();
          var email = data.email;
          if (!email) return;
          emailsNoFirestore[email] = true;
          saveUidMapping(email, doc.id);
          if (!usuarios[email]) usuarios[email] = { senha: '', dados: {}, criadoEm: data.criadoEm || new Date().toISOString() };
          for (var k in data) { usuarios[email].dados[k] = data[k]; }
          userStatus[email] = data.status || 'ativo';
          if (data.plano) _st.planos[email] = data.plano;
        });
        // Remove do localStorage qualquer usuário que não existe no Firestore
        Object.keys(usuarios).forEach(function(email) {
          if (!emailsNoFirestore[email]) {
            delete usuarios[email];
            delete userStatus[email];
            delete _st.planos[email];
          }
        });
        _st.usuarios = usuarios;
        _st.userStatus = userStatus;
        _renderAdminUsuarios();
      }).catch(function(e) {
        console.warn('[IRONQI] Admin: erro ao sincronizar usuários do Firestore:', e.code || e);
      });
    }

    function adminEditarUsuario(email) {
      var usuarios = _st.usuarios;
      var planos = {};
      Object.assign(planos, _st.planos);
      var userStatus = _st.userStatus;
      var u = usuarios[email]; if (!u) { alert('Usuário não encontrado.'); return; }
      var d = u.dados || {};
      document.getElementById('admin-user-edit-email').value = email;
      document.getElementById('admin-user-edit-nome').value = d.nome || '';
      document.getElementById('admin-user-edit-sobrenome').value = d.sobrenome || '';
      document.getElementById('admin-user-edit-plano').value = planos[email] || '';
      document.getElementById('admin-user-edit-status').value = userStatus[email] || 'ativo';
      document.getElementById('admin-user-modal-sub').textContent = 'Editando: ' + email;
      document.getElementById('modal-admin-user').classList.add('show');
    }

    function adminSalvarEdicaoUsuario() {
      var email = document.getElementById('admin-user-edit-email').value;
      var nome = document.getElementById('admin-user-edit-nome').value.trim();
      var sobrenome = document.getElementById('admin-user-edit-sobrenome').value.trim();
      var plano = document.getElementById('admin-user-edit-plano').value;
      var status = document.getElementById('admin-user-edit-status').value;
      if (!email) return;
      // 1. Atualiza localStorage
      var usuarios = _st.usuarios;
      if (usuarios[email]) {
        if (!usuarios[email].dados) usuarios[email].dados = {};
        usuarios[email].dados.nome = nome;
        usuarios[email].dados.sobrenome = sobrenome;
        usuarios[email].dados.status = status;
        if (plano) usuarios[email].dados.plano = plano;
        _st.usuarios = usuarios;
      }
      if (plano) { _st.planos[email] = plano; }
      else { delete _st.planos[email]; }
      var userStatus = _st.userStatus;
      userStatus[email] = status;
      _st.userStatus = userStatus;
      document.getElementById('modal-admin-user').classList.remove('show');
      carregarAdminUsuarios();
      // 2. Persiste no Firestore
      var fsFields = { nome: nome, sobrenome: sobrenome, status: status };
      if (plano) fsFields.plano = plano;
      _adminFsUpdate(email, fsFields,
        function() { alert('✅ Usuário atualizado e salvo no servidor!'); },
        function(err) { alert('✅ Salvo localmente.\n⚠️ Erro ao salvar no servidor: ' + err + '\nVerifique se o admin está com permissão no Firestore.'); }
      );
    }

    function adminBloquearUsuario(email) {
      if (!confirm('Bloquear o usuário ' + email + '?')) return;
      var userStatus = _st.userStatus;
      userStatus[email] = 'bloqueado';
      _st.userStatus = userStatus;
      carregarAdminUsuarios();
      _adminFsUpdate(email, { status: 'bloqueado' }, null, function(e) { console.warn('[IRONQI] Admin bloqueio Firestore erro:', e); });
    }

    function adminLiberarUsuario(email) {
      var userStatus = _st.userStatus;
      userStatus[email] = 'ativo';
      _st.userStatus = userStatus;
      carregarAdminUsuarios();
      _adminFsUpdate(email, { status: 'ativo' }, null, function(e) { console.warn('[IRONQI] Admin liberar Firestore erro:', e); });
    }

    function adminExcluirUsuario(email) {
      if (!confirm('Excluir permanentemente o usuário ' + email + '?\n\nO usuário será bloqueado e não poderá fazer login.')) return;
      // Marca status 'excluido' no localStorage (a tela filtra e não exibe)
      var userStatus = _st.userStatus;
      userStatus[email] = 'excluido';
      _st.userStatus = userStatus;
      var usuarios = _st.usuarios;
      if (usuarios[email] && usuarios[email].dados) usuarios[email].dados.status = 'excluido';
      _st.usuarios = usuarios;
      carregarAdminUsuarios();
      // Marca no Firestore — bloqueia login do usuário
      _adminFsUpdate(email, { status: 'excluido' },
        function() {
          if (auth) auth.sendPasswordResetEmail(email).catch(function() {});
          alert('✅ Usuário ' + email + ' removido.\nUm link foi enviado ao e-mail do usuário para que possa se recadastrar com nova senha.');
        },
        function(err) { alert('⚠️ Removido localmente.\nErro ao atualizar servidor: ' + err); }
      );
    }

    function fecharModalAdmin(id) {
      document.getElementById(id).classList.remove('show');
    }

    var PLANOS_PADRAO = {
      aluno_start:     { nome:'Aluno START',     valor:19.90,  recursos:['App exclusivo','Ficha de treino básica','Suporte por e-mail'],                          limiteAlunos:0,  cor:'#CCFF00',  ativo:true  },
      aluno_pro:       { nome:'Aluno PRO',       valor:29.90,  recursos:['App exclusivo','Ficha personalizada','Suporte prioritário','Acesso a dietas'],            limiteAlunos:0,  cor:'#4ECDC4', ativo:true  },
      personal_pro:    { nome:'Personal PRO',    valor:39.90,  recursos:['Gestão de alunos','Até 20 alunos','Agenda de treinos','Relatórios'],                       limiteAlunos:20, cor:'#45B7D1', ativo:true  },
      personal_elite:  { nome:'Personal ELITE',  valor:79.90,  recursos:['Gestão de alunos','Alunos ilimitados','Agenda avançada','Relatórios','Prioridade suporte'],  limiteAlunos:0,  cor:'#DDA0DD', ativo:true  }
    };

    function obterPlanosConfig() {
      var salvos = _st.adminPlanosConfig;
      var completo = {};
      Object.keys(PLANOS_PADRAO).forEach(function(id) {
        completo[id] = Object.assign({}, PLANOS_PADRAO[id], salvos[id] || {});
      });
      return completo;
    }

    function carregarAdminPlanos() {
      var planos = obterPlanosConfig();
      var ids = ['aluno_start','aluno_pro','personal_pro','personal_elite'];
      var html = '';
      ids.forEach(function(id) {
        var p = planos[id];
        html += '<div class="plan-edit-card' + (p.ativo ? '' : ' inactive') + '" data-plan-id="' + id + '" style="border-left-color:' + p.cor + ';">';
        html += '<div class="plan-edit-header">';
        html += '<input type="text" value="' + p.nome.replace(/"/g,'&quot;') + '" data-field="nome" data-plan="' + id + '" placeholder="Nome do plano">';
        html += '<input type="color" value="' + p.cor + '" data-field="cor" data-plan="' + id + '">';
        html += '<button class="plan-edit-toggle' + (p.ativo ? ' active' : '') + '" data-field="ativo" data-plan="' + id + '" onclick="adminTogglePlanAtivo(\'' + id + '\')"></button>';
        html += '</div>';
        html += '<div class="plan-edit-body">';
        html += '<div class="plan-edit-field"><label>Valor (R$)</label><input type="number" step="0.01" min="0" value="' + p.valor + '" data-field="valor" data-plan="' + id + '"></div>';
        if (id.indexOf('personal') === 0) {
          html += '<div class="plan-edit-field"><label>Limite de Alunos</label><input type="number" min="0" value="' + p.limiteAlunos + '" data-field="limiteAlunos" data-plan="' + id + '" placeholder="0 = ilimitado"></div>';
        } else {
          html += '<div class="plan-edit-field"><label>Limite de Alunos</label><input type="number" min="0" value="' + p.limiteAlunos + '" data-field="limiteAlunos" data-plan="' + id + '" disabled style="opacity:0.4;"></div>';
        }
        html += '</div>';
        html += '<div class="plan-edit-field" style="margin-top:6px;"><label>Recursos (um por linha)</label>';
        html += '<div class="recursos-list" id="rec-list-' + id + '">';
        (p.recursos || []).forEach(function(r, i) {
          html += '<div style="display:flex;align-items:center;gap:4px;"><input type="text" value="' + r.replace(/"/g,'&quot;') + '" data-field="recurso_' + i + '" data-plan="' + id + '"><span class="plan-edit-remove-rec" onclick="adminRemoverRecurso(\'' + id + '\',' + i + ')">✕</span></div>';
        });
        html += '</div>';
        html += '<button class="plan-edit-add-rec" onclick="adminAdicionarRecurso(\'' + id + '\')">+ Recurso</button>';
        html += '</div>';
        html += '</div>';
      });
      document.getElementById('admin-planos-editor').innerHTML = html;
    }

    function adminTogglePlanAtivo(id) {
      var planos = obterPlanosConfig();
      planos[id].ativo = !planos[id].ativo;
      _st.adminPlanosConfig = planos;
      carregarAdminPlanos();
    }

    function adminAdicionarRecurso(id) {
      var div = document.getElementById('rec-list-' + id);
      if (!div) return;
      var count = div.children.length;
      var el = document.createElement('div');
      el.style.cssText = 'display:flex;align-items:center;gap:4px;';
      el.innerHTML = '<input type="text" value="" data-field="recurso_' + count + '" data-plan="' + id + '" placeholder="Novo recurso..."><span class="plan-edit-remove-rec" onclick="adminRemoverRecurso(\'' + id + '\',' + count + ')">✕</span>';
      div.appendChild(el);
    }

    function adminRemoverRecurso(id, index) {
      var planos = obterPlanosConfig();
      planos[id].recursos.splice(index, 1);
      _st.adminPlanosConfig = planos;
      carregarAdminPlanos();
    }

    function adminSalvarPlanos() {
      var planos = obterPlanosConfig();
      var cards = document.querySelectorAll('.plan-edit-card');
      cards.forEach(function(card) {
        var id = card.getAttribute('data-plan-id');
        if (!id || !planos[id]) return;
        card.querySelectorAll('[data-field]').forEach(function(el) {
          var field = el.getAttribute('data-field');
          if (field === 'recurso') return; // skip individual recurso fields
          if (field && field.indexOf('recurso_') === 0) return; // handled separately
          var val = el.value;
          if (field === 'ativo') return; // handled by toggle
          if (field === 'valor' || field === 'limiteAlunos') val = parseFloat(val) || 0;
          planos[id][field] = val;
        });
        // coletar recursos
        var recursos = [];
        card.querySelectorAll('.recursos-list input[type="text"]').forEach(function(inp) {
          var v = inp.value.trim();
          if (v) recursos.push(v);
        });
        planos[id].recursos = recursos;
      });
      _st.adminPlanosConfig = planos;
      alert('Planos salvos com sucesso!');
      carregarAdminPlanos();
    }

    function adminResetarPlanos() {
      if (!confirm('Restaurar todos os planos para os valores padrão?')) return;
      
      carregarAdminPlanos();
    }

    /* ─── CUPONS ─── */
    function carregarAdminCupons() {
      var cupons = _st.cupons;
      var html = '';
      cupons.forEach(function(c, i) {
        var val = new Date(c.validade + 'T23:59:59');
        var expirado = val < new Date();
        var status = c.status === 'inativo' ? 'inativo' : (expirado ? 'expirado' : 'ativo');
        var badge = status === 'ativo' ? 'green' : 'red';
        var label = status === 'ativo' ? 'Ativo' : status === 'expirado' ? 'Expirado' : 'Inativo';
        var limite = c.limite || 0;
        var usos = c.usos || 0;
        var esgotado = limite > 0 && usos >= limite;
        if (esgotado) { badge = 'red'; label = 'Esgotado'; }
        html += '<tr>' +
          '<td>' + c.codigo + '</td>' +
          '<td>' + c.desconto + '%</td>' +
          '<td>' + val.toLocaleDateString('pt-BR') + '</td>' +
          '<td>' + (limite > 0 ? limite : '∞') + '</td>' +
          '<td>' + usos + '</td>' +
          '<td><span class="badge ' + badge + '">' + label + '</span></td>' +
          '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="admin-action-btn edit" title="Editar" onclick="adminEditarCupom(' + i + ')">✏️</button>' +
            '<button class="admin-action-btn delete" title="Excluir" onclick="adminExcluirCupom(' + i + ')">🗑️</button>' +
          '</td>' +
        '</tr>';
      });
      document.getElementById('admin-cupons-tbody').innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:#555;padding:24px;">Nenhum cupom criado.</td></tr>';
    }

    function adminMostrarCupomForm() {
      var form = document.getElementById('admin-cupom-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }

    function adminSalvarCupom() {
      var codigo = document.getElementById('cupom-codigo').value.trim().toUpperCase();
      var desconto = parseInt(document.getElementById('cupom-desconto').value, 10);
      var validade = document.getElementById('cupom-validade').value;
      var limite = parseInt(document.getElementById('cupom-limite').value, 10) || 0;
      var status = document.getElementById('cupom-status').value;
      if (!codigo || !desconto || !validade) { alert('Preencha todos os campos.'); return; }
      if (desconto < 1 || desconto > 100) { alert('Desconto deve ser entre 1% e 100%.'); return; }
      var cupons = _st.cupons;
      if (cupons.some(function(c) { return c.codigo === codigo; })) { alert('Já existe um cupom com este código.'); return; }
      cupons.push({ codigo: codigo, desconto: desconto, validade: validade, limite: limite, status: status, usos: 0, criadoEm: new Date().toISOString() });
      _st.cupons = cupons;
      alert('Cupom ' + codigo + ' criado com sucesso!');
      document.getElementById('admin-cupom-form').style.display = 'none';
      document.getElementById('cupom-codigo').value = '';
      document.getElementById('cupom-desconto').value = '';
      document.getElementById('cupom-validade').value = '';
      document.getElementById('cupom-limite').value = '';
      document.getElementById('cupom-status').value = 'ativo';
      carregarAdminCupons();
    }

    function adminEditarCupom(index) {
      var cupons = _st.cupons;
      var c = cupons[index];
      if (!c) return;
      document.getElementById('cupom-edit-original').value = index;
      document.getElementById('cupom-edit-codigo').value = c.codigo;
      document.getElementById('cupom-edit-desconto').value = c.desconto;
      document.getElementById('cupom-edit-validade').value = c.validade;
      document.getElementById('cupom-edit-limite').value = c.limite || 0;
      document.getElementById('cupom-edit-status').value = c.status || 'ativo';
      document.getElementById('admin-cupom-modal-sub').textContent = 'Editando: ' + c.codigo;
      document.getElementById('modal-admin-cupom').classList.add('show');
    }

    function adminSalvarEdicaoCupom() {
      var index = parseInt(document.getElementById('cupom-edit-original').value, 10);
      var cupons = _st.cupons;
      if (!cupons[index]) return;
      cupons[index].codigo = document.getElementById('cupom-edit-codigo').value.trim().toUpperCase();
      cupons[index].desconto = parseInt(document.getElementById('cupom-edit-desconto').value, 10);
      cupons[index].validade = document.getElementById('cupom-edit-validade').value;
      cupons[index].limite = parseInt(document.getElementById('cupom-edit-limite').value, 10) || 0;
      cupons[index].status = document.getElementById('cupom-edit-status').value;
      _st.cupons = cupons;
      document.getElementById('modal-admin-cupom').classList.remove('show');
      alert('Cupom atualizado com sucesso!');
      carregarAdminCupons();
    }

    function adminExcluirCupom(index) {
      if (!confirm('Excluir este cupom permanentemente?')) return;
      var cupons = _st.cupons;
      cupons.splice(index, 1);
      _st.cupons = cupons;
      carregarAdminCupons();
    }

    /* ─── TRIAL ─── */
    function obterTrialConfig() {
      return _st.trialConfig;
    }

    function carregarAdminTrial() {
      var config = obterTrialConfig();
      document.getElementById('trial-toggle').className = 'plan-edit-toggle' + (config.ativo ? ' active' : '');
      document.getElementById('trial-duracao').value = config.duracao;
      document.getElementById('trial-mensagem').value = config.mensagem;
      document.getElementById('admin-trial-duracao').textContent = config.duracao + 'h';
      var usuarios = _st.usuarios;
      var agora = Date.now();
      var emTrial = 0;
      var html = '';
      Object.keys(usuarios).forEach(function(email) {
        var u = usuarios[email];
        if (u.criadoEm) {
          var criado = new Date(u.criadoEm).getTime();
          var diffH = (agora - criado) / 3600000;
          if (diffH < config.duracao) {
            emTrial++;
            var restanteH = Math.round((config.duracao - diffH) * 10) / 10;
            var expira = new Date(criado + config.duracao * 3600000);
            html += '<tr><td>' + email + '</td><td>' + new Date(criado).toLocaleDateString('pt-BR') + '</td><td>' + expira.toLocaleDateString('pt-BR') + '</td><td>' + restanteH + 'h</td><td><span class="badge green">Ativo</span></td></tr>';
          }
        }
      });
      document.getElementById('admin-trial-count').textContent = emTrial;
      document.getElementById('admin-trial-tbody').innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#555;padding:24px;">Nenhum usuário em período de trial.</td></tr>';
    }

    function adminToggleTrial() {
      var config = obterTrialConfig();
      config.ativo = !config.ativo;
      _st.trialConfig = config;
      carregarAdminTrial();
    }

    function adminSalvarTrial() {
      var config = obterTrialConfig();
      config.ativo = document.getElementById('trial-toggle').classList.contains('active');
      config.duracao = parseInt(document.getElementById('trial-duracao').value, 10) || 48;
      config.mensagem = document.getElementById('trial-mensagem').value.trim();
      _st.trialConfig = config;
      alert('Configurações de Trial salvas!');
      carregarAdminTrial();
    }

    /* ─── PERSONAIS ─── */
    function carregarAdminPersonais() {
      var usuarios = _st.usuarios;
      var personalData = (_st.personalData && Array.isArray(_st.personalData) ? _st.personalData : []);
      var planos = {};
      Object.assign(planos, _st.planos);
      var nomesPlanos = { 'personal_free': 'FREE', 'personal_pro': 'PRO', 'personal_elite': 'ELITE' };
      var userStatus = _st.userStatus;
      var pessoalLimites = _st.personalLimites;
      var emails = [];
      personalData.forEach(function(p) { if (emails.indexOf(p.email) === -1) emails.push(p.email); });
      Object.keys(usuarios).forEach(function(email) {
        var d = usuarios[email].dados || {};
        if ((d.tipo === 'personal' || d.perfil === 'personal') && emails.indexOf(email) === -1) emails.push(email);
      });
      var html = '';
      emails.forEach(function(email) {
        var p = personalData.find(function(x) { return x.email === email; }) || {};
        var d = (usuarios[email] || {}).dados || {};
        var nome = p.nome || d.nome || '—';
        var alunos = p.alunos || 0;
        var plano = planos[email];
        var planoNome = nomesPlanos[plano] || (plano ? plano.split('_').pop().toUpperCase() : '—');
        var limite = pessoalLimites[email] || 0;
        var status = userStatus[email] || 'ativo';
        var statusBadge = status === 'bloqueado' ? '<span class="badge red">Bloqueado</span>' : '<span class="badge green">Ativo</span>';
        var emailEsc = email.replace(/'/g, "\\'");
        var tipoPersonal = d.tipoPersonal || 'personal';
        var tipoSelect =
          '<select onchange="adminPersonalAlterarTipo(\'' + emailEsc + '\', this.value)" ' +
          'style="background:#1F2525;border:1px solid #2A3232;color:#E8E8E8;font-size:12px;border-radius:6px;padding:4px 6px;font-family:inherit;cursor:pointer;">' +
            '<option value="personal"' + (tipoPersonal === 'personal' ? ' selected' : '') + '>Personal</option>' +
            '<option value="personal_interno"' + (tipoPersonal === 'personal_interno' ? ' selected' : '') + '>Interno</option>' +
            '<option value="personal_principal"' + (tipoPersonal === 'personal_principal' ? ' selected' : '') + '>Principal ⭐</option>' +
          '</select>';
        html += '<tr>' +
          '<td>' + escHtml(nome) + '</td>' +
          '<td>' + tipoSelect + '</td>' +
          '<td>' + email + '</td>' +
          '<td>' + alunos + '</td>' +
          '<td>' + planoNome + '</td>' +
          '<td>' + (limite > 0 ? limite : '∞') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="admin-action-btn edit" title="Alterar Limite" onclick="adminPersonalAlterarLimite(\'' + emailEsc + '\')">📋</button>' +
            (status === 'bloqueado'
              ? '<button class="admin-action-btn unlock" title="Liberar" onclick="adminPersonalLiberar(\'' + emailEsc + '\')">🔓</button>'
              : '<button class="admin-action-btn block" title="Bloquear" onclick="adminPersonalBloquear(\'' + emailEsc + '\')">🔒</button>') +
            '<button class="admin-action-btn edit" title="Upgrade Plano" onclick="adminPersonalUpgrade(\'' + emailEsc + '\')">⬆</button>' +
          '</td>' +
        '</tr>';
      });
      document.getElementById('admin-personais-count').textContent = emails.length + ' registro' + (emails.length !== 1 ? 's' : '');
      document.getElementById('admin-personais-tbody').innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:#555;padding:24px;">Nenhum personal cadastrado.</td></tr>';
    }

    function adminPersonalAlterarTipo(email, tipo) {
      // 1. Atualiza localStorage
      var usuarios = _st.usuarios;
      if (usuarios[email]) {
        if (!usuarios[email].dados) usuarios[email].dados = {};
        usuarios[email].dados.tipoPersonal = tipo;
        _st.usuarios = usuarios;
      }
      // 2. Se virou Principal: substitui o PP anterior e atualiza configuracoes
      if (tipo === 'personal_principal') {
        var _antigoPP = PERSONAL_PRINCIPAL;
        // Rebaixa o antigo PP para personal_interno (se diferente do novo)
        if (_antigoPP && _antigoPP !== email && usuarios[_antigoPP]) {
          if (!usuarios[_antigoPP].dados) usuarios[_antigoPP].dados = {};
          usuarios[_antigoPP].dados.tipoPersonal = 'personal_interno';
          _st.usuarios = usuarios;
        }
        PERSONAL_PRINCIPAL = email;
        if (!isDemo && db) {
          db.collection('configuracoes').doc('sistema').set({ personalPrincipal: email }, { merge: true })
            .then(function() { alert('✅ ' + email + ' definido como Personal Principal.\nNovos alunos autônomos serão direcionados a ele.'); })
            .catch(function(e) { console.warn('Erro ao salvar personal principal:', e); alert('✅ Salvo localmente. Erro ao salvar no servidor: ' + (e.code || e)); });
        } else {
          alert('✅ ' + email + ' definido como Personal Principal.');
        }
      } else if (email === PERSONAL_PRINCIPAL) {
        // Removendo o tipo principal de quem ainda É o PERSONAL_PRINCIPAL
        alert('⚠️ Atenção: ' + email + ' ainda está configurado como Personal Principal no sistema.\nDefina outro personal como Principal antes de alterar este tipo.\nA configuração de roteamento NÃO foi alterada.');
        // Reverte o select no localStorage para o valor anterior
        if (usuarios[email] && usuarios[email].dados) {
          usuarios[email].dados.tipoPersonal = 'personal_principal';
          _st.usuarios = usuarios;
        }
        carregarAdminPersonais();
        return;
      }
      // 3. Atualiza doc do usuário no Firestore
      if (!isDemo && db) {
        var uid = emailToUid[email];
        if (uid) {
          db.collection('usuarios').doc(uid).update({ tipoPersonal: tipo }).catch(function(e) { console.warn('Erro tipoPersonal Firestore:', e); });
        } else {
          db.collection('uidMap').doc(email.replace(/\./g, ',')).get().then(function(mapDoc) {
            if (mapDoc.exists) {
              var foundUid = mapDoc.data().uid;
              saveUidMapping(email, foundUid);
              db.collection('usuarios').doc(foundUid).update({ tipoPersonal: tipo }).catch(function(e) { console.warn('Erro tipoPersonal Firestore (map):', e); });
            }
          }).catch(function() {});
        }
      }
      carregarAdminPersonais();
    }

    function adminPersonalAlterarLimite(email) {
      var pessoalLimites = _st.personalLimites;
      var atual = pessoalLimites[email] || 0;
      var novo = prompt('Alterar limite de alunos para ' + email + ':\n(0 = ilimitado)', atual);
      if (novo === null) return;
      var num = parseInt(novo, 10);
      if (isNaN(num) || num < 0) { alert('Valor inválido.'); return; }
      pessoalLimites[email] = num;
      _st.personalLimites = pessoalLimites;
      carregarAdminPersonais();
    }

    function adminPersonalBloquear(email) {
      if (!confirm('Bloquear personal ' + email + '?')) return;
      var userStatus = _st.userStatus;
      userStatus[email] = 'bloqueado';
      _st.userStatus = userStatus;
      carregarAdminPersonais();
    }

    function adminPersonalLiberar(email) {
      var userStatus = _st.userStatus;
      userStatus[email] = 'ativo';
      _st.userStatus = userStatus;
      carregarAdminPersonais();
    }

    function adminPersonalUpgrade(email) {
      var planos = {};
      Object.assign(planos, _st.planos);
      var atual = planos[email] || 'personal_free';
      var opcoes = { 'personal_free': 'FREE (Grátis)', 'personal_pro': 'PRO (R$39,90)', 'personal_elite': 'ELITE (R$79,90)' };
      var nova = prompt('Alterar plano de ' + email + ':\nAtual: ' + (opcoes[atual] || atual) + '\n\nDigite: personal_pro, personal_elite ou personal_free', atual);
      if (!nova) return;
      if (!opcoes[nova]) { alert('Plano inválido. Use: personal_free, personal_pro ou personal_elite'); return; }
      _st.planos[email] = nova;
      carregarAdminPersonais();
    }

    function carregarAdminComissoes() {
      var comissoes = _st.comissoes;
      // Agrupa por personalEmail
      var porPersonal = {};
      comissoes.forEach(function(c) {
        if (!c.personalEmail) return;
        if (!porPersonal[c.personalEmail]) porPersonal[c.personalEmail] = { treinos: 0, dietas: 0, totalGerado: 0 };
        if (c.status === 'confirmado') {
          if (c.tipo === 'treino') porPersonal[c.personalEmail].treinos++;
          else porPersonal[c.personalEmail].dietas++;
          porPersonal[c.personalEmail].totalGerado += (c.valor || 0);
        }
      });
      var emailsLocal = Object.keys(porPersonal);

      // Carrega comissoes_pagas do Firestore, merge com localStorage e renderiza
      function _renderComPagas() {
        var lsPagas = _st.comissoesPagas;
        if (!isDemo && db) {
          db.collection('configuracoes').doc('comissoes_pagas').get().then(function(doc) {
            var fsPagas = doc.exists ? (doc.data() || {}) : {};
            var merged = Object.assign({}, lsPagas);
            Object.keys(fsPagas).forEach(function(k) {
              merged[k] = Math.max(parseFloat(merged[k] || 0), parseFloat(fsPagas[k] || 0));
            });
            _st.comissoesPagas = merged;
            renderAdminComissoesTabela(porPersonal, merged);
          }).catch(function() { renderAdminComissoesTabela(porPersonal, lsPagas); });
        } else {
          renderAdminComissoesTabela(porPersonal, lsPagas);
        }
      }

      // Se não há comissões locais, tenta buscar do Firestore primeiro
      if (emailsLocal.length === 0 && !isDemo && db) {
        db.collection('comissoes').get().then(function(snap) {
          snap.forEach(function(doc) {
            var d = doc.data();
            if (!d.personalEmail) return;
            if (!porPersonal[d.personalEmail]) porPersonal[d.personalEmail] = { treinos: 0, dietas: 0, totalGerado: 0 };
            if (d.status === 'confirmado') {
              if (d.tipo === 'treino') porPersonal[d.personalEmail].treinos++;
              else porPersonal[d.personalEmail].dietas++;
              porPersonal[d.personalEmail].totalGerado += (d.valor || 0);
              var lc = _st.comissoes;
              if (!lc.some(function(c) { return c.firestoreId === doc.id; })) {
                lc.push({ id: 'comm_' + doc.id, firestoreId: doc.id, personalEmail: d.personalEmail, alunoEmail: d.alunoEmail, tipo: d.tipo, valor: d.valor || 0, status: d.status, protocoloId: d.protocoloId || '', dataPago: d.dataPago || null, dataConfirmado: d.dataConfirmado && d.dataConfirmado.toDate ? d.dataConfirmado.toDate().toISOString() : new Date().toISOString() });
                _st.comissoes = lc;
              }
            }
          });
          _renderComPagas();
        }).catch(function(e) { console.warn('Erro ao buscar comissões do Firestore:', e); _renderComPagas(); });
      } else {
        _renderComPagas();
      }
    }

    function renderAdminComissoesTabela(porPersonal, comissoesPagas) {
      var usuarios = _st.usuarios;
      var emails = Object.keys(porPersonal).filter(function(e) { return pessoalTemComissao(e); });
      document.getElementById('admin-comissoes-count').textContent = emails.length + ' personal' + (emails.length !== 1 ? 'is' : '');
      var html = '';
      emails.forEach(function(email) {
        var stats = porPersonal[email];
        var totalGerado = stats.totalGerado;
        var pago = parseFloat(comissoesPagas[email] || 0);
        var aPagar = Math.max(0, totalGerado - pago);
        var d = (usuarios[email] && usuarios[email].dados) || {};
        var nome = d.nome || email.split('@')[0];
        var emailEsc = email.replace(/'/g, "\\'");
        html +=
          '<tr>' +
          '<td>' + escHtml(nome) + '</td>' +
          '<td style="font-size:11px;color:#666;">' + email + '</td>' +
          '<td style="text-align:center;">' + stats.treinos + '</td>' +
          '<td style="text-align:center;">' + stats.dietas + '</td>' +
          '<td style="text-align:center;color:#CCFF00;font-weight:700;">R$' + totalGerado.toFixed(0) + '</td>' +
          '<td style="text-align:center;color:#888;">R$' + pago.toFixed(0) + '</td>' +
          '<td style="text-align:center;color:' + (aPagar > 0 ? '#CCFF00' : '#555') + ';font-weight:700;">R$' + aPagar.toFixed(0) + '</td>' +
          '<td style="text-align:center;">' +
            (aPagar > 0 ? '<button class="admin-action-btn edit" title="Marcar como pago" onclick="adminMarcarComissaoPaga(\'' + emailEsc + '\', ' + aPagar + ')">💰 Pagar</button>' : '<span style="font-size:11px;color:#555;">Em dia</span>') +
          '</td>' +
          '</tr>';
      });
      document.getElementById('admin-comissoes-tbody').innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:#555;padding:24px;">Nenhuma comissão registrada ainda.</td></tr>';
      // Gráfico de barras simples
      renderChartComissoes(emails, porPersonal, comissoesPagas);
    }

    function renderChartComissoes(emails, porPersonal, comissoesPagas) {
      var canvas = document.getElementById('chart-comissoes-personais');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (emails.length === 0) { ctx.fillStyle = '#555'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Nenhum dado disponível', canvas.width / 2, 80); return; }
      var usuarios = _st.usuarios;
      var barW = Math.min(60, Math.floor((canvas.width - 40) / emails.length) - 10);
      var maxVal = 1;
      emails.forEach(function(e) { if (porPersonal[e].totalGerado > maxVal) maxVal = porPersonal[e].totalGerado; });
      var chartH = 120;
      var startY = 10;
      emails.forEach(function(email, i) {
        var stats = porPersonal[email];
        var pago = parseFloat((comissoesPagas || {})[email] || 0);
        var aPagar = Math.max(0, stats.totalGerado - pago);
        var x = 20 + i * ((canvas.width - 40) / emails.length);
        var hGerado = Math.round((stats.totalGerado / maxVal) * chartH);
        var hPago = Math.round((pago / maxVal) * chartH);
        ctx.fillStyle = '#2A3232';
        ctx.fillRect(x, startY + chartH - hGerado, barW, hGerado);
        ctx.fillStyle = '#CCFF00';
        ctx.fillRect(x, startY + chartH - hPago, barW, hPago);
        var d = (usuarios[email] && usuarios[email].dados) || {};
        var nome = (d.nome || email.split('@')[0]).substring(0, 8);
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nome, x + barW / 2, startY + chartH + 14);
        ctx.fillStyle = '#CCFF00';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('R$' + stats.totalGerado, x + barW / 2, startY + chartH - hGerado - 4);
      });
      // Legenda
      ctx.fillStyle = '#2A3232'; ctx.fillRect(canvas.width - 100, 4, 12, 10); ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Gerado', canvas.width - 84, 13);
      ctx.fillStyle = '#CCFF00'; ctx.fillRect(canvas.width - 100, 18, 12, 10); ctx.fillStyle = '#666'; ctx.fillText('Pago', canvas.width - 84, 27);
    }

    function adminMarcarComissaoPaga(email, valor) {
      if (!confirm('Marcar R$' + valor.toFixed(0) + ' como pago para ' + email + '?')) return;
      var comissoesPagas = _st.comissoesPagas;
      comissoesPagas[email] = (parseFloat(comissoesPagas[email] || 0) + valor);
      _st.comissoesPagas = comissoesPagas;
      if (!isDemo && db) {
        db.collection('configuracoes').doc('comissoes_pagas').set(comissoesPagas, { merge: true })
          .catch(function(e) { console.warn('Erro ao salvar pagamento no Firestore:', e); });
      }
      alert('✅ Pagamento de R$' + valor.toFixed(0) + ' registrado para ' + email);
      carregarAdminComissoes();
    }

    /* ─── RELATÓRIOS ─── */
    var adminRelChart = {};

    function carregarAdminRelatorios() {
      var usuarios = _st.usuarios;
      var userStatus = _st.userStatus;
      var planos = {};
      Object.assign(planos, _st.planos);
      var receitaMap = { 'aluno_start': 19.90, 'aluno_pro': 29.90, 'personal_pro': 39.90, 'personal_elite': 79.90 };
      var receita = 0;
      var contPlano = {};
      Object.keys(planos).forEach(function(k) {
        var p = planos[k];
        if (receitaMap[p]) receita += receitaMap[p];
        contPlano[p] = (contPlano[p] || 0) + 1;
      });
      var totalUsers = Object.keys(usuarios).length;
      var ativos = Object.keys(userStatus).filter(function(k) { return userStatus[k] === 'ativo'; }).length + Object.keys(usuarios).filter(function(k) { return !userStatus[k]; }).length;
      var totalPlanos = Object.keys(planos).length;

      document.getElementById('admin-relatorios-cards').innerHTML =
        '<div class="iron-card" style="cursor:default;"><div class="label">Usuários Cadastrados</div><div class="value">' + totalUsers + '</div><div class="sub">Total de contas</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Usuários Ativos</div><div class="value">' + ativos + '</div><div class="sub">Contas em atividade</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Receita Estimada</div><div class="value">R$ ' + receita.toFixed(2) + '</div><div class="sub">Mensal</div></div>' +
        '<div class="iron-card" style="cursor:default;"><div class="label">Planos Vendidos</div><div class="value">' + totalPlanos + '</div><div class="sub">Assinaturas ativas</div></div>';

      ensureChartJs(function() {
        // gráfico distribuição planos
        if (adminRelChart.planos) adminRelChart.planos.destroy();
        var nomes = { 'aluno_start':'Aluno START','aluno_pro':'Aluno PRO','personal_pro':'Personal PRO','personal_elite':'Personal ELITE' };
        var ctxP = document.getElementById('chart-rel-planos').getContext('2d');
        var labelsP = []; var dataP = []; var cores = ['#CCFF00','#4ECDC4','#45B7D1','#DDA0DD','#FF6B6B','#FFD93D','#FF8C42'];
        Object.keys(contPlano).forEach(function(p, i) { labelsP.push(nomes[p] || p); dataP.push(contPlano[p]); });
        if (!labelsP.length) { labelsP = ['Sem dados']; dataP = [1]; }
        adminRelChart.planos = new Chart(ctxP, {
          type: 'doughnut', data: { labels: labelsP, datasets: [{ data: dataP, backgroundColor: cores.slice(0, labelsP.length), borderColor: '#0E1111', borderWidth: 2 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#aaa', font: { size: 10 }, boxWidth: 12, padding: 8 } } } }
        });

        // gráfico receita por tipo
        if (adminRelChart.receita) adminRelChart.receita.destroy();
        var ctxR = document.getElementById('chart-rel-receita').getContext('2d');
        var recPorTipo = { aluno: 0, personal: 0 };
        Object.keys(planos).forEach(function(k) {
          var p = planos[k];
          if (p.indexOf('aluno') === 0) recPorTipo.aluno += receitaMap[p] || 0;
          else if (p.indexOf('personal') === 0) recPorTipo.personal += receitaMap[p] || 0;
        });
        adminRelChart.receita = new Chart(ctxR, {
          type: 'bar', data: { labels: ['Alunos', 'Personais'], datasets: [{ label: 'Receita (R$)', data: [recPorTipo.aluno, recPorTipo.personal], backgroundColor: ['#CCFF00','#4ECDC4'], borderRadius: 4 }] },
          options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { color: '#888' }, grid: { color: 'rgba(255,255,255,0.03)' } }, y: { ticks: { color: '#888', callback: function(v) { return 'R$' + v; } }, grid: { color: 'rgba(255,255,255,0.03)' } } } }
        });
      });
    }

    function adminExportarCSV() {
      var usuarios = _st.usuarios;
      var userStatus = _st.userStatus;
      var planos = {};
      Object.assign(planos, _st.planos);
      var linhas = ['"Nome","Email","Tipo","Plano","Status","Cadastro"'];
      Object.keys(usuarios).forEach(function(email) {
        var u = usuarios[email]; var d = u.dados || {};
        var nome = ((d.nome || '') + ' ' + (d.sobrenome || '')).trim();
        var tipo = d.tipo || ({'aluno_autonomo':'autonomo','aluno_personal':'alunoPersonal','personal':'personal'})[d.perfil] || 'autonomo';
        var plano = planos[email] || '—';
        var status = userStatus[email] || 'ativo';
        var data = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString('pt-BR') : '—';
        linhas.push('"' + nome + '","' + email + '","' + tipo + '","' + plano + '","' + status + '","' + data + '"');
      });
      var csv = linhas.join('\n');
      var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
      var link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = 'relatorio_ironqi_' + new Date().toISOString().slice(0,10) + '.csv';
      link.click(); URL.revokeObjectURL(link.href);
    }

    function adminExportarExcel() {
      var usuarios = _st.usuarios;
      var userStatus = _st.userStatus;
      var planos = {};
      Object.assign(planos, _st.planos);
      var linhas = ['<table><tr><th>Nome</th><th>Email</th><th>Tipo</th><th>Plano</th><th>Status</th><th>Cadastro</th></tr>'];
      Object.keys(usuarios).forEach(function(email) {
        var u = usuarios[email]; var d = u.dados || {};
        var nome = ((d.nome || '') + ' ' + (d.sobrenome || '')).trim();
        var tipo = d.tipo || ({'aluno_autonomo':'autonomo','aluno_personal':'alunoPersonal','personal':'personal'})[d.perfil] || 'autonomo';
        var plano = planos[email] || '—';
        var status = userStatus[email] || 'ativo';
        var data = u.criadoEm ? new Date(u.criadoEm).toLocaleDateString('pt-BR') : '—';
        linhas.push('<tr><td>' + nome + '</td><td>' + email + '</td><td>' + tipo + '</td><td>' + plano + '</td><td>' + status + '</td><td>' + data + '</td></tr>');
      });
      linhas.push('</table>');
      var html = '<html><head><meta charset="utf-8"></head><body>' + linhas.join('') + '</body></html>';
      var blob = new Blob([html], { type: 'application/vnd.ms-excel;charset=utf-8' });
      var link = document.createElement('a'); link.href = URL.createObjectURL(blob);
      link.download = 'relatorio_ironqi_' + new Date().toISOString().slice(0,10) + '.xls';
      link.click(); URL.revokeObjectURL(link.href);
    }

    /* ─── CONFIGURAÇÕES ─── */
    function carregarAdminConfig() {
      var config = _st.configGeral;
      document.getElementById('config-nome-sistema').value = config.nomeSistema || 'IRONIQA';
      document.getElementById('config-logo').value = config.logo || 'logo.webp';
      document.getElementById('config-cor-principal').value = config.corPrincipal || '#CCFF00';
      document.getElementById('config-whatsapp').value = config.whatsapp || '';
      document.getElementById('config-email-suporte').value = config.emailSuporte || '';
      document.getElementById('config-manutencao').value = config.manutencao || '';
      document.getElementById('admin-config-email').value = 'contato.ironiq@gmail.com';
      document.getElementById('admin-config-senha').value = '';
      var trialCfg = _st.trialConfig;
      document.getElementById('admin-config-trial').value = trialCfg.duracao || '48';
    }

    function adminSalvarConfig() {
      var config = {
        nomeSistema: document.getElementById('config-nome-sistema').value.trim(),
        logo: document.getElementById('config-logo').value.trim(),
        corPrincipal: document.getElementById('config-cor-principal').value,
        whatsapp: document.getElementById('config-whatsapp').value.trim(),
        emailSuporte: document.getElementById('config-email-suporte').value.trim(),
        manutencao: document.getElementById('config-manutencao').value.trim()
      };
      if (!config.nomeSistema) { alert('Preencha o nome do sistema.'); return; }
      _st.configGeral = config;
      var email = document.getElementById('admin-config-email').value.trim();
      var senha = document.getElementById('admin-config-senha').value.trim();
      var trial = document.getElementById('admin-config-trial').value;
      if (!email || !senha) { alert('Preencha e-mail e senha do admin.'); return; }
      // configurações de email/senha do admin não são salvas em localStorage (segurança)
      var trialCfg = _st.trialConfig;
      trialCfg.duracao = parseInt(trial, 10) || 48;
      _st.trialConfig = trialCfg;
      // salvar duracaoTrial no Firestore — coleção configuracoes, doc gerais
      if (!isDemo && db) {
        db.collection('configuracoes').doc('gerais').set({
          duracaoTrial: parseInt(trial, 10) || 48,
          atualizadoEm: new Date().toISOString()
        }, { merge: true }).catch(function(e) { console.warn('Firestore config save error:', e.code || e); });
      }
      // aplicar cor principal
      document.querySelector('meta[name="theme-color"]') && document.querySelector('meta[name="theme-color"]').setAttribute('content', config.corPrincipal);
      alert('Configurações salvas com sucesso!');
    }

