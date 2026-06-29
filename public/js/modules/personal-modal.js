// ─── MÓDULO: PERSONAL / MODAL DE APROVAÇÃO ───────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             personal-dieta.js (gerarDietaPersonal, aprovarDietaPersonal)
//             personal-review.js (carregarPendentes)
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
