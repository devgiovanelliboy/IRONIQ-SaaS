// ─── MÓDULO: PERSONAL / DIETA + APROVAÇÃO ────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             comissoes.js (registrarComissao), protocolo-render.js (exibirTreino)
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

