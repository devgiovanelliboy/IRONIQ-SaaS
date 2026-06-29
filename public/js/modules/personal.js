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

    function gerarDietaPersonal() {
      if (!currentReviewId) return;
      var pendentes = _st.pendentes;
      var item = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) { item = pendentes[i]; break; }
      }
      // Procura também em protocolos_analise se não encontrou em pendentes
      if (!item || !item.protocolo) {
        var analises = _st.protocolos;
        for (var a = 0; a < analises.length; a++) {
          if (analises[a].id === currentReviewId) {
            pendentes.push(JSON.parse(JSON.stringify(analises[a])));
            _st.pendentes = pendentes;
            item = pendentes[pendentes.length - 1];
            break;
          }
        }
      }
      if (!item || !item.protocolo) return;
      var d = item.protocolo;

      var restricoesTexto = d.restricoesTexto || [];
      var restricoes = d.restricoes || '';

      document.getElementById('review-content').innerHTML =
        '<div style="text-align:center; padding:32px;">' +
          '<div style="font-size:32px; margin-bottom:12px;">⏳</div>' +
          '<h3 style="color:#CCFF00;">Gerando dieta personalizada...</h3>' +
          '<p style="color:#888; font-size:13px; margin-top:8px;">A IA está montando o protocolo alimentar.</p>' +
        '</div>';

      var regrasSeguranca = '';
      if (restricoesTexto.indexOf('Intolerância à Lactose') !== -1) {
        regrasSeguranca += '\n- PROIBIÇÃO MÁXIMA: O usuário possui Intolerância à Lactose. É expressamente proibido incluir leite de vaca, queijos tradicionais, iogurtes com lactose, whey protein concentrado ou qualquer derivado lácteo na dieta. Substitua por fontes zero lactose ou vegetais.';
      }
      if (restricoesTexto.indexOf('Alergia a Glúten (Celíaco)') !== -1) {
        regrasSeguranca += '\n- PROIBIÇÃO MÁXIMA: O usuário possui Alergia a Glúten (Celíaco). É expressamente proibido usar trigo, aveia tradicional, centeio, cevada ou qualquer ingrediente com glúten. Substitua por arroz, quinoa, aveia sem glúten, batata-doce, mandioca.';
      }
      if (restricoesTexto.indexOf('Alergia a Amendoim/Nozes') !== -1) {
        regrasSeguranca += '\n- PROIBIÇÃO MÁXIMA: O usuário possui Alergia a Amendoim/Nozes. É expressamente proibido incluir amendoim, castanhas, nozes, amêndoas, pistache ou qualquer oleaginosa. Substitua por sementes de abóbora, girassol ou linhaça.';
      }
      if (restricoes) {
        regrasSeguranca += '\n- O usuário informou as seguintes restrições pessoais: "' + restricoes + '". É PROIBIDO incluir qualquer um desses itens na dieta. Leia atentamente e remova sumariamente esses ingredientes de todas as refeições.';
      }

      var userMsg =
        'Você é um Médico Nutricionista Sênior especializado em alimentação esportiva. ' +
        'Monte uma dieta simples, barata e acessível com alimentos do dia a dia (nada de salmão, alimentos importados ou caros). ' +
        'Use alimentos como: frango, ovos, arroz, feijão, batata-doce, banana, aveia, pão integral, leite (se permitido), etc. ' +
        'A dieta deve ser dividida em 4 refeições: Café da Manhã, Almoço, Lanche, Jantar.\n\n' +
        'Dados da solicitação do aluno:\n' +
        '- Tipo de alimentação: ' + (d.tipo || 'Tradicional') + '\n' +
        '- Restrições: ' + ((d.restricoesTexto && d.restricoesTexto.length ? d.restricoesTexto.join(', ') : 'Nenhuma') + (d.restricoes ? ' / ' + d.restricoes : '')) + '\n\n' +
        'REGRAS CRÍTICAS DE SEGURANÇA:' + regrasSeguranca + '\n\n' +
        'Formato de resposta OBRIGATÓRIO (retorne APENAS este formato, sem markdown, sem explicações):\n' +
        'ADVERTÊNCIA: [Listar aqui as restrições que foram aplicadas]\n\n' +
        '== CAFÉ DA MANHÃ ==\n' +
        '🍽 Refeição: [nome]\n' +
        '🕐 Horário sugerido: 06:30 - 07:30\n' +
        '📋 Ingredientes:\n' +
        '- [ingrediente 1]: [quantidade]\n' +
        '- [ingrediente 2]: [quantidade]\n\n' +
        '== ALMOÇO ==\n' +
        '🍽 Refeição: [nome]\n' +
        '🕐 Horário sugerido: 12:00 - 13:00\n' +
        '📋 Ingredientes:\n' +
        '- [ingrediente 1]: [quantidade]\n\n' +
        '== LANCHE ==\n' +
        '🍽 Refeição: [nome]\n' +
        '🕐 Horário sugerido: 15:30 - 16:30\n' +
        '📋 Ingredientes:\n' +
        '- [ingrediente 1]: [quantidade]\n\n' +
        '== JANTAR ==\n' +
        '🍽 Refeição: [nome]\n' +
        '🕐 Horário sugerido: 19:00 - 20:00\n' +
        '📋 Ingredientes:\n' +
        '- [ingrediente 1]: [quantidade]\n\n' +
        '💊 SUPLEMENTAÇÃO:\n' +
        '- [suplemento 1]: [quantidade e horário]\n\n' +
        'Regras importantes:\n' +
        '- Use quantidades em gramas (g), colheres ou unidades\n' +
        '- Prefira alimentos baratos e acessíveis no Brasil\n' +
        '- Adapte as calorias para um déficit/mutenção conforme o IMC\n' +
        '- Inclua suplementos básicos quando cabíveis (whey, creatina, etc, desde que respeitem restrições)\n' +
        '- Se vegetariano/vegano: use proteínas vegetais (grão-de-bico, lentilha, tofu, proteína de soja)\n' +
        '- Se IMC > 25: dieta levemente hipocalórica\n' +
        '- Se IMC < 18.5: dieta hipercalórica com mais proteínas\n' +
        '- Retorne APENAS o texto formatado, sem markdown';

      var controller = new AbortController();
      var timeoutId = setTimeout(function() { controller.abort(); }, 45000);

      _iaFetch({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Você é um Médico Nutricionista Sênior focado em alimentação esportiva. Retorne APENAS o formato solicitado, sem markdown, sem explicações. Prefira alimentos simples, baratos e acessíveis no Brasil. Respeite rigorosamente todas as restrições alimentares informadas.' },
          { role: 'user', content: userMsg }
        ],
        temperature: 0.5,
        max_tokens: 2048
      }, controller.signal)
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(json) {
        clearTimeout(timeoutId);
        var text = '';
        try { text = json.choices[0].message.content; } catch(e) {}
        if (!text) throw new Error('Resposta vazia da IA');
        text = text.replace(/```/g, '').trim();

        // Salva o resultado no pending item
        item.protocolo.resultado = text;
        _st.pendentes = pendentes;

        // Atualiza também no protocolos_analise
        var analises = _st.protocolos;
        for (var a = 0; a < analises.length; a++) {
          if (analises[a].id === currentReviewId) {
            analises[a].protocolo = item.protocolo;
            break;
          }
        }
        _st.protocolos = analises;

        // Mostra o resultado com botão de aprovar
        var html =
          '<div class="card card-green" style="font-size:13px; line-height:1.6;">' + formatarTextoDieta(text) + '</div>' +
          '<div style="display:flex; gap:8px; margin-top:12px;">' +
            '<button class="btn btn-primary" onclick="aprovarDietaPersonal()">✓ Aprovar Dieta</button>' +
            '<button class="btn btn-outline" onclick="gerarDietaPersonal()">🔄 Gerar Novamente</button>' +
            '<button class="btn btn-secondary" onclick="cancelarDietaPersonal()">Cancelar</button>' +
          '</div>';
        document.getElementById('review-content').innerHTML = html;
      })
      .catch(function(err) {
        clearTimeout(timeoutId);
        console.log('Erro IA dieta personal:', err);
        alert('Erro ao gerar dieta com IA. Tente novamente.');
      });
    }

    function atualizarProtocoloAnalise(id, updates) {
      // Atualiza no localStorage
      var analises = _st.protocolos;
      for (var i = 0; i < analises.length; i++) {
        if (analises[i].id === id) {
          for (var k in updates) analises[i][k] = updates[k];
          break;
        }
      }
      _st.protocolos = analises;
      // Atualiza no Firestore
      if (!isDemo && db && id) {
        db.collection('protocolos_analise').doc(id).update(updates).catch(function(err) {
          // Se falhou (modo leitura), tenta buscar pelo campo alunoEmail
          db.collection('protocolos_analise').where('alunoEmail', '==', updates.alunoEmail || '').get().then(function(snap) {
            snap.forEach(function(doc) {
              db.collection('protocolos_analise').doc(doc.id).update(updates).catch(function(e) { console.warn('Firestore protocolo nested update error:', e.code || e); });
            });
          }).catch(function(e) { console.warn('Firestore protocolo query error:', e.code || e); });
        });
      }
    }

    function aprovarDietaPersonal() {
      if (!currentReviewId) return;
      if (_bloquearAprovacaoNaoAutorizada()) return;
      var dataAprovado = new Date().toISOString();
      var personalEmail = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado') || '';
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) {
          pendentes[i].status = 'aguardando_aceite_aluno';
          pendentes[i].dataAprovado = dataAprovado;
          pendentes[i].aprovadoPor = personalEmail;
          break;
        }
      }
      _st.pendentes = pendentes;
      atualizarProtocoloAnalise(currentReviewId, { status: 'aguardando_aceite_aluno', dataAprovado: dataAprovado, aprovadoPor: personalEmail });
      salvarNaSubcolecaoPendente(currentReviewId);
      alert('✅ Dieta enviada para avaliação do aluno!');
      navigate('personal-dashboard');
    }

    function cancelarDietaPersonal() {
      if (!currentReviewId) return;
      if (!confirm('Descartar a dieta gerada?')) return;
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) {
          delete pendentes[i].protocolo.resultado;
          break;
        }
      }
      _st.pendentes = pendentes;
      navigate('personal-dashboard');
    }

    function salvarEdicoes() {
      if (!currentReviewId) return;
      var pendentes = _st.pendentes;
      var item = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) { item = pendentes[i]; break; }
      }
      if (!item || !item.protocolo) return;
      var protocolo = item.protocolo;
      var inputs = document.querySelectorAll('#review-content .review-ex-input, #review-content .review-reps-input');
      inputs.forEach(function(inp) {
        var d = parseInt(inp.getAttribute('data-dia'), 10);
        var e = parseInt(inp.getAttribute('data-ex'), 10);
        if (protocolo.dias[d] && protocolo.dias[d].exercicios[e]) {
          if (inp.classList.contains('review-ex-input')) {
            protocolo.dias[d].exercicios[e].nome = inp.value.trim();
          } else {
            protocolo.dias[d].exercicios[e].reps = inp.value.trim();
          }
        }
      });
      _st.pendentes = pendentes;
    }

    function salvarNaSubcolecaoPendente(id) {
      if (isDemo || !db) return;
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === id) {
          var p = pendentes[i];
          var personalEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado') || '';
          var colecao = (p.tipo || 'treino') === 'dieta' ? 'dietas' : 'treinos';
          var dadosSubcol = {
            dados: p.protocolo,
            status: 'aguardando_aceite_aluno',
            aprovadoPor: personalEmail,
            dataCriacao: firebase.firestore.FieldValue.serverTimestamp()
          };
          var _alunoEmail = p.alunoEmail;
          var escreverNaSubcol = function(uid) {
            db.collection('usuarios').doc(uid).collection(colecao).doc('atual').set(dadosSubcol)
              .catch(function(e) { console.warn('Erro ao salvar subcoleção do aluno:', e.code || e); });
          };
          if (emailToUid[_alunoEmail]) {
            escreverNaSubcol(emailToUid[_alunoEmail]);
          } else {
            db.collection('usuarios').where('email', '==', _alunoEmail).limit(1).get().then(function(snap) {
              if (!snap.empty) {
                var uid = snap.docs[0].id;
                saveUidMapping(_alunoEmail, uid);
                escreverNaSubcol(uid);
              } else {
                console.warn('UID não encontrado para aluno:', _alunoEmail);
              }
            }).catch(function(e) { console.warn('Erro ao buscar UID do aluno:', e.code || e); });
          }
          break;
        }
      }
    }

    function salvarEdicoesEAprovar() {
      salvarEdicoes();
      if (!currentReviewId) return;
      if (_bloquearAprovacaoNaoAutorizada()) return;
      var dataAprovado = new Date().toISOString();
      var personalEmail = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado') || '';
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) {
          pendentes[i].status = 'aguardando_aceite_aluno';
          pendentes[i].dataAprovado = dataAprovado;
          pendentes[i].aprovadoPor = personalEmail;
          break;
        }
      }
      _st.pendentes = pendentes;
      atualizarProtocoloAnalise(currentReviewId, { status: 'aguardando_aceite_aluno', dataAprovado: dataAprovado, aprovadoPor: personalEmail });
      salvarNaSubcolecaoPendente(currentReviewId);
      alert('Treino salvo e enviado para avaliação do aluno!');
      navigate('personal-dashboard');
    }

    function aprovarTreino() {
      if (!currentReviewId) return;
      if (_bloquearAprovacaoNaoAutorizada()) return;
      var dataAprovado = new Date().toISOString();
      var personalEmail = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado') || '';
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) {
          pendentes[i].status = 'aguardando_aceite_aluno';
          pendentes[i].dataAprovado = dataAprovado;
          pendentes[i].aprovadoPor = personalEmail;
          break;
        }
      }
      _st.pendentes = pendentes;
      atualizarProtocoloAnalise(currentReviewId, { status: 'aguardando_aceite_aluno', dataAprovado: dataAprovado, aprovadoPor: personalEmail });
      salvarNaSubcolecaoPendente(currentReviewId);
      alert('Treino enviado para avaliação do aluno!');
      navigate('personal-dashboard');
    }

    function regenerarTreino() {
      if (!currentReviewId) return;
      if (!confirm('Gerar um novo treino com IA? O treino atual será substituído.')) return;
      var pendentes = _st.pendentes;
      var item = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) { item = pendentes[i]; break; }
      }
      if (!item) return;
      // Gera novo protocolo mock
      var data = { objetivo: 'Hipertrofia', nivel: 'Intermediário', genero: 'Masculino', dias: '4', tempo: '1h', foco: 'Geral', lesao: '', local: 'Academia' };
      var novo = montarTreinoMock(data);
      item.protocolo = novo;
      item.status = 'pending';
      item.dataGerado = new Date().toISOString();
      _st.pendentes = pendentes;
      alert('Novo treino gerado! Revise e aprove.');
      abrirRevisao(currentReviewId);
    }

    function editarTreinoAtivo() {
      var protocolo = JSON.parse(localStorage.getItem('ironqi_protocolo'));
      var alunoEmail = localStorage.getItem('ironqi_protocolo_aluno');
      if (!protocolo || !alunoEmail) {
        alert('Nenhum treino ativo para editar.');
        return;
      }
      var pendentes = _st.pendentes;
      var encontrado = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].alunoEmail === alunoEmail && pendentes[i].protocolo) {
          encontrado = pendentes[i];
          break;
        }
      }
      if (!encontrado) {
        alert('Treino não encontrado nos registros de solicitação.');
        return;
      }
      currentReviewId = encontrado.id;
      abrirRevisao(encontrado.id);
    }

    // ─── MODAL DE APROVAÇÃO (Kanban) ───
    var _modalAprovacaoId = null;

    function abrirModalAprovacao(id) {
      _modalAprovacaoId = id;
      var pendentes = _st.pendentes;
      var item = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === id) { item = pendentes[i]; break; }
      }
      if (!item) {
        // Tenta buscar do protocolos_analise
        var analises = _st.protocolos;
        for (var i = 0; i < analises.length; i++) {
          if (analises[i].id === id) {
            item = analises[i];
            break;
          }
        }
      }
      if (!item) { alert('Protocolo não encontrado.'); return; }

      var nome = getAlunoNome(item.alunoEmail);
      document.getElementById('modal-aprovar-titulo').innerHTML = 'Revisar <span class="text-green">' + (item.tipo === 'dieta' ? 'Dieta' : 'Treino') + '</span>';
      var container = document.getElementById('modal-aprovar-conteudo');
      var html = '';

      if (item.tipo === 'dieta') {
        var d = item.protocolo;
        html +=
          '<div class="card">' +
            '<p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:0.5px;">Aluno</p>' +
            '<h3 style="margin-bottom:8px;">' + escHtml(nome) + '</h3>' +
            '<p style="font-size:13px; color:#666;">' + escHtml(item.alunoEmail) + '</p>' +
          '</div>' +
          '<div class="card">' +
            '<h3 style="margin-bottom:12px;">📋 Dados da Solicitação</h3>' +
            '<div style="font-size:13px; line-height:1.8;">' +
              '<p><strong style="color:#CCFF00;">Tipo:</strong> ' + (d.tipo || 'Tradicional') + '</p>' +
              (d.restricoesTexto && d.restricoesTexto.length ? '<p><strong style="color:#CCFF00;">Restrições:</strong> ' + d.restricoesTexto.join(', ') + '</p>' : '') +
              (d.restricoes ? '<p><strong style="color:#CCFF00;">Obs:</strong> ' + d.restricoes + '</p>' : '') +
            '</div>' +
          '</div>';
        if (d.resultado) {
          html += '<div class="card card-green" style="white-space:pre-wrap; font-size:13px; line-height:1.6;">' + d.resultado + '</div>';
        } else {
          html += '<div class="card" style="text-align:center; padding:20px;"><p style="color:#888;">Clique em <strong style="color:#CCFF00;">Ajustar</strong> para gerar a dieta com IA antes de aprovar.</p></div>';
        }
        var actions = document.getElementById('modal-aprovar-acoes');
        if (d.resultado) {
          actions.innerHTML =
            '<button class="btn btn-primary" style="flex:1;" onclick="aprovarModal()">✅ Aprovar Protocolo</button>' +
            '<button class="btn btn-outline" style="flex:1;" onclick="regenerarDietaModal()">🔄 Gerar Novamente</button>' +
            '<button class="btn btn-secondary btn-small" onclick="fecharModalAprovacao()">Fechar</button>';
        } else {
          actions.innerHTML =
            '<button class="btn btn-primary" style="flex:1;" onclick="gerarDietaModal()">🤖 Gerar Dieta com IA</button>' +
            '<button class="btn btn-secondary btn-small" onclick="fecharModalAprovacao()">Fechar</button>';
        }
      } else {
        var protocolo = item.protocolo;
        html +=
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
        document.getElementById('modal-aprovar-acoes').innerHTML =
          '<button class="btn btn-primary" style="flex:1;" onclick="aprovarModal()">✅ Aprovar Protocolo</button>' +
          '<button class="btn btn-outline" style="flex:1;" onclick="ajustarModal()">❌ Ajustar</button>' +
          '<button class="btn btn-secondary btn-small" onclick="fecharModalAprovacao()">Fechar</button>';
      }

      container.innerHTML = html;
      document.getElementById('modal-aprovar-protocolo').style.display = 'flex';
    }

    function fecharModalAprovacao() {
      document.getElementById('modal-aprovar-protocolo').style.display = 'none';
      _modalAprovacaoId = null;
    }

    function aprovarModal() {
      if (!_modalAprovacaoId) return;
      var _revModal = _itemPendente(_modalAprovacaoId);
      if (_revModal && !_podeRevisar(_revModal)) { alert('Você não tem permissão para aprovar esta solicitação.'); return; }
      // Salva edições se houver
      var inputs = document.querySelectorAll('#modal-aprovar-conteudo .review-ex-input, #modal-aprovar-conteudo .review-reps-input');
      if (inputs.length) {
        var pendentes = _st.pendentes;
        var item = null;
        for (var i = 0; i < pendentes.length; i++) {
          if (pendentes[i].id === _modalAprovacaoId) { item = pendentes[i]; break; }
        }
        if (item && item.protocolo && item.protocolo.dias) {
          inputs.forEach(function(inp) {
            var d = parseInt(inp.getAttribute('data-dia'), 10);
            var e = parseInt(inp.getAttribute('data-ex'), 10);
            if (item.protocolo.dias[d] && item.protocolo.dias[d].exercicios[e]) {
              if (inp.classList.contains('review-ex-input')) {
                item.protocolo.dias[d].exercicios[e].nome = inp.value.trim();
              } else {
                item.protocolo.dias[d].exercicios[e].reps = inp.value.trim();
              }
            }
          });
          _st.pendentes = pendentes;
        }
      }
      // Atualiza status — usa 'aguardando_aceite_aluno' para que o aluno passe pelo fluxo de aceite
      var _apDataAprovado = new Date().toISOString();
      var _apPersonalEmail = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado') || '';
      var pendentes = _st.pendentes;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === _modalAprovacaoId) {
          pendentes[i].status = 'aguardando_aceite_aluno';
          pendentes[i].dataAprovado = _apDataAprovado;
          pendentes[i].aprovadoPor = _apPersonalEmail;
          break;
        }
      }
      _st.pendentes = pendentes;
      atualizarProtocoloAnalise(_modalAprovacaoId, { status: 'aguardando_aceite_aluno', dataAprovado: _apDataAprovado, aprovadoPor: _apPersonalEmail });
      salvarNaSubcolecaoPendente(_modalAprovacaoId);
      fecharModalAprovacao();
      alert('✅ Protocolo aprovado! O aluno será notificado em tempo real.');
      var personalEmail = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (personalEmail) {
        var usuarios = _st.usuarios;
        renderKanban(personalEmail, usuarios);
      }
    }

    function ajustarModal() {
      // Torna os inputs editáveis e foca no primeiro
      var inputs = document.querySelectorAll('#modal-aprovar-conteudo input');
      inputs.forEach(function(inp) { inp.removeAttribute('readonly'); inp.style.borderColor = '#CCFF00'; });
      if (inputs.length) inputs[0].focus();
      document.getElementById('modal-aprovar-acoes').innerHTML =
        '<button class="btn btn-primary" style="flex:1;" onclick="aprovarModal()">✅ Salvar e Aprovar</button>' +
        '<button class="btn btn-secondary btn-small" onclick="fecharModalAprovacao()">Cancelar</button>';
    }

    function gerarDietaModal() {
      if (!_modalAprovacaoId) return;
      currentReviewId = _modalAprovacaoId;
      fecharModalAprovacao();
      // Garante que o item existe em pendentes
      var pendentes = _st.pendentes;
      var existe = false;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].id === currentReviewId) { existe = true; break; }
      }
      if (!existe) {
        var analises = _st.protocolos;
        for (var a = 0; a < analises.length; a++) {
          if (analises[a].id === currentReviewId) {
            pendentes.push(JSON.parse(JSON.stringify(analises[a])));
            break;
          }
        }
        _st.pendentes = pendentes;
      }
      abrirRevisao(currentReviewId);
    }

    function regenerarDietaModal() {
      if (!_modalAprovacaoId) return;
      currentReviewId = _modalAprovacaoId;
      fecharModalAprovacao();
      abrirRevisao(currentReviewId);
    }