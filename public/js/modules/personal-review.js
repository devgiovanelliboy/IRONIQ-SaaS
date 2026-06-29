// ─── MÓDULO: PERSONAL / REVISÃO DE PROTOCOLOS ────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             personal-alunos.js (sincronizarAlunosDoPersonal)
//             personal-dieta.js (gerarDietaPersonal, abrirRevisaoDieta)
    // ─── PERSONAL DASHBOARD ───
    function carregarPendentes() {
      atualizarBadgeNotificacoes();
      document.getElementById('personal-pendentes-list').style.display = 'block';
      document.getElementById('notificacoes-list').style.display = 'none';
      var lista = document.getElementById('personal-pendentes-list');
      var meuEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!meuEmail) { lista.innerHTML = ''; return; }
      lista.innerHTML = '<div style="text-align:center;padding:20px;color:#888;font-size:13px;">Buscando solicitações...</div>';
      // Sincroniza do Firestore antes de renderizar — garante que não perdemos
      // protocolos enviados após o último login ou antes do painel carregar.
      sincronizarProtocolosPendentes(meuEmail, function() {
        var usuarios = _st.usuarios;
        var meusDados = usuarios[meuEmail] && usuarios[meuEmail].dados;
        var verAutonomos = meusDados && meusDados.verAlunosAutonomos === true;
        var pendentes = _st.pendentes;

        // Item é direcionado a mim (ou ao Principal, se eu posso ver autônomos)?
        function ehMeu(p) {
          var dir = p.direcionadoPara || 'personal_principal';
          if (dir === 'personal_principal') return !!verAutonomos;
          return dir === meuEmail || (verAutonomos && dir === PERSONAL_PRINCIPAL);
        }

        var aprovar = [];    // status pendente_aprovacao — preciso aprovar
        var aguardando = []; // status aguardando_aceite_aluno — já aprovei, falta o aluno aceitar
        for (var i = pendentes.length - 1; i >= 0; i--) {
          var p = pendentes[i];
          if (!ehMeu(p)) continue;
          if (p.status === 'pendente_aprovacao') aprovar.push(p);
          else if (p.status === 'aguardando_aceite_aluno') aguardando.push(p);
        }

        function card(p, clicavel) {
          var nome = getAlunoNome(p.alunoEmail);
          var dataStr = new Date(p.dataAprovado || p.dataGerado).toLocaleDateString('pt-BR');
          var icone = p.tipo === 'dieta' ? '🥗' : '🏋️';
          var tipoLabel = p.tipo === 'dieta' ? 'Dieta' : 'Treino';
          var badge = clicavel
            ? '<span class="status-badge status-pending">Pendente</span>'
            : '<span class="status-badge status-approved">Aguardando aluno</span>';
          var attrs = clicavel
            ? ' onclick="abrirRevisao(\'' + p.id + '\')" style="cursor:pointer;"'
            : ' style="opacity:.7;"';
          return '<div class="pending-card"' + attrs + '>' +
              '<div class="aluno-info">' + icone + ' ' + tipoLabel + '</div>' +
              '<div class="aluno-nome">' + escHtml(nome) + '</div>' +
              '<div class="aluno-email">' + escHtml(p.alunoEmail) + '</div>' +
              '<div class="footer-card">' + badge +
                '<span class="status-date">' + dataStr + '</span>' +
              '</div>' +
            '</div>';
        }

        function secao(titulo, itens, clicavel) {
          if (!itens.length) return '';
          var h = '<div style="font-size:12px;font-weight:700;color:#888;text-transform:uppercase;letter-spacing:.5px;margin:18px 4px 8px;">' + titulo + ' (' + itens.length + ')</div>';
          itens.forEach(function(p) { h += card(p, clicavel); });
          return h;
        }

        if (!aprovar.length && !aguardando.length) {
          lista.innerHTML = '<div class="personal-empty"><div class="icon-big">📋</div><h3>Nenhuma solicitação pendente</h3><p>Os treinos e dietas solicitados pelos alunos aparecerão aqui.</p></div>';
          return;
        }
        lista.innerHTML =
          secao('⏳ Aguardando você aprovar', aprovar, true) +
          secao('✅ Aguardando aceite do aluno', aguardando, false);
      });
    }

    // Autorização: o personal logado pode revisar/aprovar este protocolo?
    // Só se for direcionado a ele, ou ao Personal Principal e ele puder ver autônomos.
    function _podeRevisar(item) {
      if (!item) return false;
      var meuEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      var usuarios = _st.usuarios;
      var meusDados = usuarios[meuEmail] && usuarios[meuEmail].dados;
      var verAutonomos = meusDados && meusDados.verAlunosAutonomos === true;
      var dir = item.direcionadoPara || 'personal_principal';
      var ehPrincipal = (dir === 'personal_principal' || dir === PERSONAL_PRINCIPAL);
      if (ehPrincipal) return !!verAutonomos || meuEmail === PERSONAL_PRINCIPAL;
      return dir === meuEmail;
    }

    function _itemPendente(id) {
      var pend = _st.pendentes;
      for (var i = 0; i < pend.length; i++) { if (pend[i].id === id) return pend[i]; }
      return null;
    }

    // Guard de defesa em profundidade nas aprovações. Retorna true se deve abortar.
    function _bloquearAprovacaoNaoAutorizada() {
      var rev = _itemPendente(currentReviewId);
      if (rev && !_podeRevisar(rev)) { alert('Você não tem permissão para aprovar esta solicitação.'); return true; }
      return false;
    }

    function abrirRevisao(id) {
      var pendentes = _st.pendentes;
      var item = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === id) { item = pendentes[i]; break; }
      }
      if (!item) { alert('Solicitação não encontrada.'); return; }
      if (!_podeRevisar(item)) { alert('Esta solicitação não está direcionada a você.'); return; }
      currentReviewId = id;
      var container = document.getElementById('review-content');
      var nome = getAlunoNome(item.alunoEmail);

      if (item.tipo === 'dieta') {
        abrirRevisaoDieta(item, container, nome);
        return;
      }

      var protocolo = item.protocolo;
      var html =
        '<div class="card">' +
          '<p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Aluno</p>' +
          '<h3 style="margin-bottom:8px;">' + escHtml(nome) + '</h3>' +
          '<p style="font-size:13px; color:#666;">' + escHtml(item.alunoEmail) + '</p>' +
        '</div>' +
        '<div class="card card-green">' +
          '<h3 style="margin-bottom:2px;">' + (protocolo.nome || 'Protocolo') + '</h3>' +
          '<p style="font-size:12px; color:#888; margin-bottom:12px;">' + (protocolo.meta || '') + '</p>';
      var dias = protocolo.dias || [];
      for (var d = 0; d < dias.length; d++) {
        var dia = dias[d];
        html += '<div style="margin-bottom:12px;">' +
          '<p style="font-size:13px; font-weight:700; color:#CCFF00; margin-bottom:4px;">' + dia.nome + '</p>';
        var exs = dia.exercicios || [];
        for (var e = 0; e < exs.length; e++) {
          html +=
            '<div class="review-ex-row">' +
              '<input type="text" class="review-ex-input" value="' + exs[e].nome.replace(/"/g,'&quot;') + '" data-dia="' + d + '" data-ex="' + e + '" placeholder="Exercício">' +
              '<input type="text" class="review-reps-input" value="' + (exs[e].reps || '').replace(/"/g,'&quot;') + '" data-dia="' + d + '" data-ex="' + e + '" placeholder="Séries">' +
            '</div>';
        }
        html += '</div>';
      }
      html += '</div>';
      container.innerHTML = html;
      var actions = document.getElementById('review-actions');
      if (item.status === 'approved') {
        actions.innerHTML =
          '<div style="text-align:center; padding:12px; background:rgba(204,255,0,0.1); border-radius:12px;">' +
            '<span style="color:#CCFF00; font-weight:700;">✓ Treino já aprovado</span>' +
          '</div>' +
          '<button class="btn btn-outline" onclick="regenerarTreino()">🔄 Gerar Novo com IA</button>' +
          '<button class="btn btn-secondary" onclick="navigate(\'personal-dashboard\')">Voltar</button>';
      } else {
        actions.innerHTML =
          '<button class="btn btn-primary" onclick="salvarEdicoesEAprovar()">✓ Salvar e Aprovar</button>' +
          '<button class="btn btn-outline" onclick="regenerarTreino()">🔄 Gerar Novo com IA</button>' +
          '<button class="btn btn-secondary" onclick="navigate(\'personal-dashboard\')">Voltar</button>';
      }
      navigate('personal-review');
      document.getElementById('review-title').textContent = 'Revisar Treino — ' + nome.split(' ')[0];
    }

    function abrirRevisaoDieta(item, container, nome) {
      var d = item.protocolo;
      var html =
        '<div class="card">' +
          '<p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Aluno</p>' +
          '<h3 style="margin-bottom:8px;">' + escHtml(nome) + '</h3>' +
          '<p style="font-size:13px; color:#666;">' + escHtml(item.alunoEmail) + '</p>' +
        '</div>' +
        '<div class="card">' +
          '<h3 style="margin-bottom:12px;">📋 Dados da Solicitação</h3>' +
          '<div style="font-size:13px; line-height:1.8;">' +
            '<p><strong style="color:#CCFF00;">Tipo de alimentação:</strong> ' + (d.tipo || 'Tradicional') + '</p>' +
            (d.restricoesTexto && d.restricoesTexto.length ? '<p><strong style="color:#CCFF00;">Restrições:</strong> ' + d.restricoesTexto.join(', ') + '</p>' : '') +
            (d.restricoes ? '<p><strong style="color:#CCFF00;">Observações:</strong> ' + d.restricoes + '</p>' : '') +
          '</div>' +
        '</div>';

      if (item.status === 'approved' && d.resultado) {
        html += '<div class="card card-green" id="dieta-aprovada-content">' + d.resultado + '</div>';
      }

      container.innerHTML = html;
      var actions = document.getElementById('review-actions');
      if (item.status === 'approved') {
        actions.innerHTML =
          '<div style="text-align:center; padding:12px; background:rgba(204,255,0,0.1); border-radius:12px;">' +
            '<span style="color:#CCFF00; font-weight:700;">✓ Dieta já aprovada</span>' +
          '</div>' +
          '<button class="btn btn-outline" onclick="gerarDietaPersonal()">🔄 Gerar Nova com IA</button>' +
          '<button class="btn btn-secondary" onclick="navigate(\'personal-dashboard\')">Voltar</button>';
      } else {
        actions.innerHTML =
          '<button class="btn btn-primary" onclick="gerarDietaPersonal()">🤖 Gerar Dieta com IA</button>' +
          '<button class="btn btn-secondary" onclick="navigate(\'personal-dashboard\')">Voltar</button>';
      }
      navigate('personal-review');
      document.getElementById('review-title').textContent = 'Revisar Dieta — ' + nome.split(' ')[0];
    }

