// ─── MÓDULO: DIETA / IMC / HIDRATAÇÃO ───────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, storage, _iaFetch)
//             utils.js (escHtml), planos.js (getPlanoUsuario, verificarAcessoPlano)
    // ─── PÁGINA IMC ───
    function carregarPaginaIMC() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;

      // Carrega último IMC salvo
      var historico = (_st.imcHistorico[email] || []);
      if (historico.length > 0) {
        var ultimo = historico[historico.length - 1];
        var imcVal = ultimo.imc;
        var pesoVal = ultimo.peso;

        document.getElementById('imc-valor').textContent = imcVal.toFixed(1);

        var classificacao = '';
        var detalhe = '';
        if (imcVal < 18.5) { classificacao = 'Abaixo do peso'; detalhe = 'Busque orientação nutricional.'; }
        else if (imcVal < 24.9) { classificacao = 'Peso normal'; detalhe = 'Parabéns! Mantenha o foco.'; }
        else if (imcVal < 29.9) { classificacao = 'Sobrepeso'; detalhe = 'Atenção à alimentação.'; }
        else if (imcVal < 34.9) { classificacao = 'Obesidade Grau I'; detalhe = 'Consulte um profissional.'; }
        else if (imcVal < 39.9) { classificacao = 'Obesidade Grau II'; detalhe = 'Acompanhamento médico é essencial.'; }
        else { classificacao = 'Obesidade Grau III'; detalhe = 'Busque ajuda profissional urgente.'; }

        document.getElementById('imc-classificacao').textContent = classificacao;
        document.getElementById('imc-detalhe').textContent = detalhe;
      }

      renderizarGraficoIMC();
    }

    function abrirFormularioPeso() {
      if (!temAcessoPRO()) {
        atualizarIMCBlocker();
        return;
      }
      document.getElementById('imc-form-card').style.display = 'block';
      // Preenche com últimos valores conhecidos
      var email = localStorage.getItem('ironqi_logado');
      if (email) {
        var historico = (_st.imcHistorico[email] || []);
        if (historico.length > 0) {
          var ultimo = historico[historico.length - 1];
          document.getElementById('imc-peso').value = ultimo.peso || '';
        }
      }
    }

    function fecharFormularioPeso() {
      document.getElementById('imc-form-card').style.display = 'none';
    }

    function salvarPesoAltura() {
      var peso = parseFloat(document.getElementById('imc-peso').value);
      var altura = parseFloat(document.getElementById('imc-altura').value);

      if (!peso || !altura) { alert('Preencha peso e altura.'); return; }

      var alturaM = altura / 100;
      var imc = peso / (alturaM * alturaM);

      var classificacao = '';
      var detalhe = '';
      if (imc < 18.5) { classificacao = 'Abaixo do peso'; detalhe = 'Busque orientação nutricional.'; }
      else if (imc < 24.9) { classificacao = 'Peso normal'; detalhe = 'Parabéns! Mantenha o foco.'; }
      else if (imc < 29.9) { classificacao = 'Sobrepeso'; detalhe = 'Atenção à alimentação.'; }
      else if (imc < 34.9) { classificacao = 'Obesidade Grau I'; detalhe = 'Consulte um profissional.'; }
      else if (imc < 39.9) { classificacao = 'Obesidade Grau II'; detalhe = 'Acompanhamento médico é essencial.'; }
      else { classificacao = 'Obesidade Grau III'; detalhe = 'Busque ajuda profissional urgente.'; }

      document.getElementById('imc-valor').textContent = imc.toFixed(1);
      document.getElementById('imc-classificacao').textContent = classificacao;
      document.getElementById('imc-detalhe').textContent = detalhe;

      // Salva no histórico
      var email = localStorage.getItem('ironqi_logado');
      if (email) {
        var historico = (_st.imcHistorico[email] || []);
        var hoje = new Date();
        var dataStr = hoje.getDate().toString().padStart(2,'0') + '/' +
          (hoje.getMonth()+1).toString().padStart(2,'0') + '/' +
          hoje.getFullYear();
        historico.push({ data: dataStr, peso: peso, imc: parseFloat(imc.toFixed(1)) });
        _st.imcHistorico[email] = historico;
      }

      // Salva no Firestore
      if (!isDemo && db) {
        var uid = emailToUid[email];
        if (uid) {
          db.collection('usuarios').doc(uid).collection('imc_historico').add({
            data: new Date(),
            peso: peso,
            altura: altura,
            imc: parseFloat(imc.toFixed(1))
          }).catch(function(e) { console.warn('Firestore imc save error:', e); });
        }
      }

      document.getElementById('imc-form-card').style.display = 'none';
      renderizarGraficoIMC();
    }

    // Mescla histórico de IMC do Firestore no cache local (cross-device).
    function _carregarImcFirestore(email, cb) {
      if (isDemo || !db || !email) return;
      var uid = emailToUid[email];
      if (!uid) return;
      db.collection('usuarios').doc(uid).collection('imc_historico').get().then(function(snap) {
        var local = (_st.imcHistorico[email] || []);
        var seen = {};
        local.forEach(function(e) { seen[e.data + '|' + e.peso + '|' + e.imc] = true; });
        var mudou = false;
        snap.forEach(function(doc) {
          var d = doc.data();
          var dt = d.data && d.data.toDate ? d.data.toDate() : (d.data ? new Date(d.data) : null);
          if (!dt || isNaN(dt.getTime())) return;
          var ds = dt.getDate().toString().padStart(2,'0') + '/' + (dt.getMonth()+1).toString().padStart(2,'0') + '/' + dt.getFullYear();
          var key = ds + '|' + d.peso + '|' + d.imc;
          if (!seen[key]) { local.push({ data: ds, peso: d.peso, imc: d.imc }); seen[key] = true; mudou = true; }
        });
        if (mudou) {
          function _parseBR(s) { var p = String(s).split('/'); return new Date(p[2], (p[1]||1)-1, p[0]||1).getTime(); }
          local.sort(function(a, b) { return _parseBR(a.data) - _parseBR(b.data); });
          _st.imcHistorico[email] = local;
        }
        if (cb) cb(mudou);
      }).catch(function(e) { console.warn('Erro ao carregar IMC do Firestore:', e.code || e); });
    }

    function renderizarGraficoIMC() {
      var _email = localStorage.getItem('ironqi_logado');
      _renderGraficoIMC();
      _carregarImcFirestore(_email, function(mudou) { if (mudou) _renderGraficoIMC(); });
    }

    function _renderGraficoIMC() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var historico = (_st.imcHistorico[email] || []);
      if (historico.length < 1) {
        document.getElementById('imc-evolucao-card').style.display = 'none';
        return;
      }

      document.getElementById('imc-evolucao-card').style.display = 'block';

      if (window.imcEvolucaoChart) {
        window.imcEvolucaoChart.destroy();
      }

      var select = document.getElementById('imc-grafico-select');

      function desenhar() {
        var metrica = select.value;
        var labels = historico.map(function(e) { return e.data; });
        var valores = historico.map(function(e) { return metrica === 'peso' ? e.peso : e.imc; });
        var cor = metrica === 'peso' ? '#CCFF00' : '#4ECDC4';
        var unidade = metrica === 'peso' ? 'kg' : '';

        if (window.imcEvolucaoChart) {
          window.imcEvolucaoChart.destroy();
        }

        var ctx = document.getElementById('graficoIMCEvolucao').getContext('2d');
        ensureChartJs(function() {
          window.imcEvolucaoChart = new Chart(ctx, {
            type: 'line',
            data: {
              labels: labels,
              datasets: [{
                label: metrica === 'peso' ? 'Peso (kg)' : 'IMC',
                data: valores,
                borderColor: cor,
                backgroundColor: cor + '22',
                borderWidth: 2.5,
                pointBackgroundColor: cor,
                pointBorderColor: '#0E1111',
                pointBorderWidth: 1.5,
                pointRadius: 4,
                pointHoverRadius: 7,
                tension: 0.3,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: true,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  ticks: { color: '#888', font: { size: 10 } },
                  grid: { color: 'rgba(255,255,255,0.04)' }
                },
                y: {
                  beginAtZero: false,
                  ticks: { color: cor, font: { size: 11 }, callback: function(v) { return v + unidade; } },
                  grid: { color: 'rgba(255,255,255,0.04)' }
                }
              }
            }
          });
        });
      }

      select.onchange = desenhar;
      desenhar();
    }

    function resetarDieta() {
      document.getElementById('dieta-form-card').style.display = 'block';
      document.getElementById('dieta-loading').style.display = 'none';
      document.getElementById('dieta-result').style.display = 'none';
      document.getElementById('dieta-warning-card').style.display = 'none';
      document.getElementById('dieta-result-content').innerHTML = '';
      dietaGenerated = false;
    }

    function carregarDietaAprovada() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      if (!temAcessoPRO()) return;
      var pendentes = _st.pendentes;
      var aprovadoDieta = null;
      for (var i = 0; i < pendentes.length; i++) {
        if (pendentes[i].alunoEmail === email &&
            pendentes[i].tipo === 'dieta' &&
            pendentes[i].status === 'approved' &&
            pendentes[i].protocolo &&
            pendentes[i].protocolo.resultado) {
          if (!aprovadoDieta || pendentes[i].dataAprovado > aprovadoDieta.dataAprovado) {
            aprovadoDieta = pendentes[i];
          }
        }
      }
      if (aprovadoDieta) {
        document.getElementById('dieta-form-card').style.display = 'none';
        document.getElementById('dieta-loading').style.display = 'none';
        document.getElementById('dieta-result').style.display = 'block';
        document.getElementById('dieta-warning-card').style.display = 'none';
        var rawText = aprovadoDieta.protocolo.resultado;
        document.getElementById('dieta-result-content').innerHTML = formatarTextoDieta(rawText);
      }
    }

    // ─── GERAÇÃO DE DIETA COM IA GROQ ───
    var DIETA_LOADING_MSGS = [
      'Preparando seu protocolo alimentar personalizado...',
      'Metodologia digital IRONIQA calculando macronutrientes...',
      'Enviando protocolo para a banca de professores...',
      '✓ Protocolo fiscalizado, aprovado e liberado pelo Personal Trainer Responsável!'
    ];

    var DIETA_LOADING_POS_MSG = 'Ainda processando, aguarde um momento...';

    function gerarDieta() {
      if (!temAcessoPRO()) {
        atualizarDietaBlocker();
        return;
      }
      if (!_pendingEhAjuste) {
        if (temSolicitacaoAtiva('dieta')) {
          alert('Você já tem uma solicitação de dieta em andamento. Aguarde a análise ou o aceite antes de solicitar outra.');
          return;
        }
        var _limDieta = verificarLimiteSolicitacao('dieta');
        if (_limDieta.bloqueado) {
          atualizarCicloBlockerDieta();
          return;
        }
      }
      var tipo = document.getElementById('dieta-tipo').value;
      var lactose = document.getElementById('dieta-lactose').checked;
      var gluten = document.getElementById('dieta-gluten').checked;
      var nozes = document.getElementById('dieta-nozes').checked;
      var restricoes = document.getElementById('dieta-restricoes').value.trim();

      var restricoesTexto = [];
      if (lactose) restricoesTexto.push('Intolerância à Lactose');
      if (gluten) restricoesTexto.push('Alergia a Glúten (Celíaco)');
      if (nozes) restricoesTexto.push('Alergia a Amendoim/Nozes');

      // Salva como pendente para o personal trainer revisar
      var dadosDieta = {
        tipo: tipo,
        restricoesTexto: restricoesTexto,
        restricoes: restricoes,
        status: 'pendente_aprovacao',
        direcionadoPara: getDirecionadoPara()
      };

      // Mostra loading
      document.getElementById('dieta-form-card').style.display = 'none';
      document.getElementById('dieta-loading').style.display = 'block';

      salvarPendente(dadosDieta, 'dieta');
      navigate('dashboard');
      setTimeout(mostrarTelaEspera, 300);
    }

    function formatarTextoDieta(textoCru) {
      if (!textoCru) return '';
      var lines = textoCru.split('\n');
      var avisos = [];
      var refeicoes = [];
      var currentMeal = null;
      var suplementos = [];
      var inSuplementos = false;

      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line) continue;

        if (/^(ADVERTÊNCIA|ATENÇÃO|AVISO|⚠️?)/i.test(line)) {
          avisos.push(line);
          continue;
        }

        if (/^=+\s*/.test(line)) {
          if (currentMeal) refeicoes.push(currentMeal);
          var mealName = line.replace(/^=+\s*|\s*=+$/g, '').trim();
          if (!mealName) continue;
          currentMeal = { nome: mealName, items: [], ingredientes: [] };
          inSuplementos = false;
          continue;
        }

        if (line.indexOf('💊') !== -1 || /SUPLEMENTAÇÃO|SUPLEMENTOS/i.test(line)) {
          if (currentMeal) refeicoes.push(currentMeal);
          currentMeal = null;
          inSuplementos = true;
          continue;
        }

        if (inSuplementos) {
          if (line.indexOf('- ') === 0) suplementos.push(line.replace(/^- /, ''));
          else suplementos.push(line);
          continue;
        }

        if (currentMeal) {
          if (line.indexOf('📋') !== -1 || line.toLowerCase().indexOf('ingrediente') !== -1) {
            continue;
          }
          if (line.indexOf('- ') === 0) {
            currentMeal.ingredientes.push(line.replace(/^- /, ''));
            continue;
          }
          if (line.indexOf('🍽') !== -1) {
            currentMeal.items.push({ type: 'refeicao', text: line.replace(/^.*?🍽\s*/, '') });
            continue;
          }
          if (line.indexOf('🕐') !== -1) {
            currentMeal.items.push({ type: 'horario', text: line.replace(/^.*?🕐\s*/, '') });
            continue;
          }
          currentMeal.items.push({ type: 'text', text: line });
        }
      }
      if (currentMeal) refeicoes.push(currentMeal);

      var html = '';

      if (avisos.length > 0) {
        html += '<div class="dieta-aviso">';
        for (var a = 0; a < avisos.length; a++) {
          html += '<p>' + avisos[a] + '</p>';
        }
        html += '</div>';
      }

      for (var r = 0; r < refeicoes.length; r++) {
        var meal = refeicoes[r];
        html += '<div class="refeicao-card">';
        html += '<h3>' + meal.nome + '</h3>';
        html += '<ul>';
        for (var j = 0; j < meal.items.length; j++) {
          var item = meal.items[j];
          if (item.type === 'refeicao') {
            var nomeRef = item.text.replace(/Refeição:\s*/i, '').trim();
            html += '<li><strong>Refeição:</strong> ' + nomeRef + '</li>';
          } else if (item.type === 'horario') {
            var horario = item.text.replace(/Horário\s*sugerido:\s*/i, '').trim();
            html += '<li><strong>Horário:</strong> ' + horario + '</li>';
          } else {
            html += '<li>' + item.text + '</li>';
          }
        }
        if (meal.ingredientes.length > 0) {
          html += '<li><strong>Ingredientes:</strong><ul>';
          for (var k = 0; k < meal.ingredientes.length; k++) {
            html += '<li>' + meal.ingredientes[k] + '</li>';
          }
          html += '</ul></li>';
        }
        html += '</ul>';
        html += '</div>';
      }

      if (suplementos.length > 0) {
        html += '<div class="refeicao-card" style="border-color:rgba(204,255,0,0.3);">';
        html += '<h3>💊 Suplementação</h3>';
        html += '<ul>';
        for (var s = 0; s < suplementos.length; s++) {
          html += '<li>• ' + suplementos[s] + '</li>';
        }
        html += '</ul></div>';
      }

      return html;
    }

    function mostrarDietaResultado(texto, restricoesTexto, restricoesLivres) {
      document.getElementById('dieta-loading').style.display = 'none';
      document.getElementById('dieta-result').style.display = 'block';

      // Warning de restrições
      var warnCard = document.getElementById('dieta-warning-card');
      var warnText = document.getElementById('dieta-warning-text');
      if (restricoesTexto.length > 0 || restricoesLivres) {
        var warnings = [];
        if (restricoesTexto.length > 0) {
          warnings.push('⚠️ Protocolo Adaptado: 100% ' + restricoesTexto.join(', '));
        }
        if (restricoesLivres) {
          warnings.push('Sem ' + restricoesLivres);
        }
        warnCard.style.display = 'block';
        warnText.textContent = warnings.join(' — ');
      } else {
        warnCard.style.display = 'none';
      }

      // Formata o texto da dieta com cards estruturados
      var html = formatarTextoDieta(texto);

      document.getElementById('dieta-result-content').innerHTML = html;
      dietaGenerated = true;

      // dieta salva via protocolo no Firestore
    }

    function mostrarDietaMock(restricoesTexto, restricoesLivres) {
      var mock =
        'ADVERTÊNCIA: Protocolo de exemplo (modo demo). Configure a Groq API para dietas reais.\n\n' +
        '== CAFÉ DA MANHÃ ==\n' +
        '🍽 Refeição: Vitamina de banana com aveia\n' +
        '🕐 Horário sugerido: 06:30 - 07:30\n' +
        '📋 Ingredientes:\n' +
        '- 1 banana média\n' +
        '- 2 colheres (sopa) de aveia\n' +
        '- 200ml de leite desnatado\n' +
        '- 1 colher (sopa) de pasta de amendoim\n\n' +
        '== ALMOÇO ==\n' +
        '🍽 Refeição: Frango grelhado com arroz e feijão\n' +
        '🕐 Horário sugerido: 12:00 - 13:00\n' +
        '📋 Ingredientes:\n' +
        '- 150g de peito de frango grelhado\n' +
        '- 4 colheres (sopa) de arroz branco\n' +
        '- 2 conchas de feijão carioca\n' +
        '- Salada de alface e tomate à vontade\n' +
        '- 1 fio de azeite\n\n' +
        '== LANCHE ==\n' +
        '🍽 Refeição: Iogurte com granola e fruta\n' +
        '🕐 Horário sugerido: 15:30 - 16:30\n' +
        '📋 Ingredientes:\n' +
        '- 1 pote de iogurte natural (170g)\n' +
        '- 2 colheres (sopa) de granola\n' +
        '- 1 maçã picada\n\n' +
        '== JANTAR ==\n' +
        '🍽 Refeição: Omelete com legumes\n' +
        '🕐 Horário sugerido: 19:00 - 20:00\n' +
        '📋 Ingredientes:\n' +
        '- 3 ovos\n' +
        '- 1/2 tomate picado\n' +
        '- 1/4 cebola picada\n' +
        '- 1 porção de brócolis\n' +
        '- Sal e pimenta a gosto\n\n' +
        '💊 SUPLEMENTAÇÃO:\n' +
        '- Whey Protein: 1 scoop no pós-treino\n' +
        '- Creatina: 5g diários\n' +
        '- Vitamina D: 2000 UI pela manhã';

      mostrarDietaResultado(mock, restricoesTexto || [], restricoesLivres || '');
    }

    // ─── CRONÔMETRO DE DESCANSO ───
    let restTimerInterval = null;
    let restTimeLeft = 60;
    let restRunning = false;

    function iniciarDescanso() {
      const display = document.getElementById('rest-timer-countdown');
      const btn = document.getElementById('rest-timer-btn');

      if (restRunning) {
        clearInterval(restTimerInterval);
        restTimerInterval = null;
        restRunning = false;
        display.textContent = '60s';
        display.className = 'rest-timer-countdown';
        btn.textContent = 'Iniciar';
        btn.className = 'rest-timer-btn';
        restTimeLeft = 60;
        return;
      }

      restTimeLeft = 60;
      restRunning = true;
      display.textContent = '60';
      display.className = 'rest-timer-countdown';
      btn.textContent = 'Parar';
      btn.className = 'rest-timer-btn active';

      restTimerInterval = setInterval(function() {
        restTimeLeft--;
        display.textContent = restTimeLeft;

        if (restTimeLeft <= 0) {
          clearInterval(restTimerInterval);
          restTimerInterval = null;
          restRunning = false;
          display.textContent = '⚡ GO!';
          display.className = 'rest-timer-countdown alert';
          btn.textContent = 'Iniciar';
          btn.className = 'rest-timer-btn';

          setTimeout(function() {
            display.textContent = '60s';
            display.className = 'rest-timer-countdown';
            restTimeLeft = 60;
          }, 4000);
        }
      }, 1000);
    }

    // ─── CONTADOR DE HIDRATAÇÃO ───
    const META_AGUA = 3500;
    const PASSO_AGUA = 350;

    function carregarHidratacao() {
      const hoje = new Date().toISOString().split('T')[0];
      const dados = _st.agua;
      const total = dados[hoje] || 0;
      atualizarHidratacao(total);
    }

    function atualizarHidratacao(total) {
      const bar = document.getElementById('hyd-bar');
      const totalEl = document.getElementById('hyd-total');
      const percentEl = document.getElementById('hyd-percent');
      const btn = document.getElementById('hyd-btn');
      // Defensivo: se a tela de hidratação não está montada, não quebra o dashboard.
      if (!bar || !totalEl || !percentEl || !btn) return;

      totalEl.textContent = total;
      const percent = Math.min(100, Math.round((total / META_AGUA) * 100));
      bar.style.width = percent + '%';
      percentEl.textContent = percent + '%';

      if (total >= META_AGUA) {
        btn.textContent = '✔ Meta atingida!';
        btn.disabled = true;
      } else {
        btn.textContent = '+ 350ml';
        btn.disabled = false;
      }

      const hoje = new Date().toISOString().split('T')[0];
      const dados = _st.agua;
      dados[hoje] = total;
      _st.agua = dados;
    }

    function addAgua() {
      const hoje = new Date().toISOString().split('T')[0];
      const dados = _st.agua;
      const total = (dados[hoje] || 0) + PASSO_AGUA;
      atualizarHidratacao(total);
    }