// ─── MÓDULO: ADMIN / USUÁRIOS + PLANOS ───────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db)
//             admin-core.js (_adminGetUid, _adminFsUpdate, fecharModalAdmin)
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
