// ─── MÓDULO: ADMIN / RELATÓRIOS + CONFIG ─────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db)
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

