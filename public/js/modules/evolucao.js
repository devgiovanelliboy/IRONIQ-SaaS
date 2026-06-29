// ─── MÓDULO: EVOLUÇÃO / GRÁFICOS ─────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
    // ─── Carregamento sob demanda do Chart.js ───
    var _chartJsLoaded = false;
    var _chartJsQueue = [];
    function ensureChartJs(callback) {
      if (typeof Chart !== 'undefined') { callback(); return; }
      if (_chartJsLoaded) { _chartJsQueue.push(callback); return; }
      _chartJsLoaded = true;
      var s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/chart.js';
      s.onload = function() {
        callback();
        _chartJsQueue.forEach(function(fn) { fn(); });
        _chartJsQueue = [];
      };
      document.head.appendChild(s);
    }

    // ─── MINHA EVOLUÇÃO ───
    var CORES_NEON = ['#CCFF00','#FF6B6B','#4ECDC4','#45B7D1','#FFD93D','#DDA0DD','#6BCB77','#FF8C42'];

    // Busca histórico de treinos do Firestore e mescla no cache local (cross-device
    // e visão do personal). Chama cb(mudou) quando termina.
    function _carregarHistoricoFirestore(email, cb) {
      if (isDemo || !db || !email) return;
      var uid = emailToUid[email];
      if (!uid) return;
      db.collection('usuarios').doc(uid).collection('historico_treinos').get().then(function(snap) {
        var local = (_st.historico[email] || []);
        var seen = {};
        local.forEach(function(e) { if (e.timestamp) seen[e.timestamp] = true; });
        var mudou = false;
        snap.forEach(function(doc) {
          var d = doc.data();
          var ts = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toISOString() : d.timestamp;
          if (ts && !seen[ts]) { d.timestamp = ts; local.push(d); seen[ts] = true; mudou = true; }
        });
        if (mudou) {
          local.sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
          _st.historico[email] = local;
        }
        if (cb) cb(mudou);
      }).catch(function(e) { console.warn('Erro ao carregar histórico do Firestore:', e.code || e); });
    }

    function carregarEvolucao() {
      var alunoEmail = localStorage.getItem('ironqi_evolucao_aluno');
      var email = alunoEmail || localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      var indicator = document.getElementById('personal-home-aluno-indicator');
      if (indicator) {
        if (alunoEmail) {
          var nome = getAlunoNome(alunoEmail);
          indicator.style.display = 'inline-flex';
          indicator.textContent = '← Dados de ' + nome;
        } else {
          indicator.style.display = 'none';
        }
      }
      // Render imediato do cache local + busca Firestore e re-render se houver dados novos
      _renderEvolucao(email);
      _carregarHistoricoFirestore(email, function(mudou) { if (mudou) _renderEvolucao(email); });
    }

    function _renderEvolucao(email) {
      var historico = (_st.historico[email] || []);
      var empty = document.getElementById('evolucao-empty');
      var chartArea = document.getElementById('evolucao-chart-area');
      var select = document.getElementById('evolucao-select');

      if (!historico.length) {
        empty.style.display = 'block';
        chartArea.style.display = 'none';
        return;
      }

      empty.style.display = 'none';
      chartArea.style.display = 'block';

      var grupos = {};
      historico.forEach(function(entry) {
        var g = entry.treino || entry.treinoLetra || '';
        if (g) grupos[g] = true;
      });
      var grupoNomes = Object.keys(grupos).sort();

      if (!grupoNomes.length) {
        chartArea.innerHTML = '<div class="evolucao-empty"><h3>Sem grupos registrados</h3><p>Conclua treinos para ver sua evolução.</p></div>';
        return;
      }

      select.innerHTML = '';
      grupoNomes.forEach(function(letra) {
        var opt = document.createElement('option');
        opt.value = letra;
        opt.textContent = 'Treino ' + letra;
        select.appendChild(opt);
      });

      select.onchange = function() { renderGrafico(historico, select.value); };
      renderGrafico(historico, grupoNomes[0]);
    }

    function renderGrafico(historico, grupoLetra) {
      var wrapper = document.querySelector('.chart-wrapper');
      wrapper.innerHTML = '<canvas id="graficoEvolucao"></canvas>';
      var ctx = document.getElementById('graficoEvolucao').getContext('2d');

      if (window.evolucaoChart) {
        window.evolucaoChart.destroy();
      }

      var entradas = historico.filter(function(e) { return (e.treino || e.treinoLetra || '') === grupoLetra; });

      entradas.sort(function(a, b) {
        var da = a.data.split('/');
        var db = b.data.split('/');
        return new Date(da[2], da[1]-1, da[0]) - new Date(db[2], db[1]-1, db[0]);
      });

      if (!entradas.length) {
        wrapper.innerHTML = '<div class="evolucao-empty"><p>Este grupo não possui registros.</p></div>';
        return;
      }

      var labels = entradas.map(function(e) { return e.data; });

      var exercicioNomes = {};
      entradas.forEach(function(entry) {
        entry.exercicios.forEach(function(ex) {
          if (ex.peso > 0) exercicioNomes[ex.nome] = true;
        });
      });
      var nomes = Object.keys(exercicioNomes);

      var datasets = [];
      nomes.forEach(function(nome, i) {
        var valores = [];
        entradas.forEach(function(entry) {
          var encontrado = false;
          entry.exercicios.forEach(function(ex) {
            if (ex.nome === nome && ex.peso > 0) {
              valores.push(ex.peso);
              encontrado = true;
            }
          });
          if (!encontrado) valores.push(null);
        });

        datasets.push({
          label: nome,
          data: valores,
          borderColor: CORES_NEON[i % CORES_NEON.length],
          backgroundColor: CORES_NEON[i % CORES_NEON.length] + '22',
          borderWidth: 2,
          pointBackgroundColor: CORES_NEON[i % CORES_NEON.length],
          pointBorderColor: '#0E1111',
          pointBorderWidth: 1.5,
          pointRadius: 4,
          pointHoverRadius: 7,
          tension: 0.3,
          fill: false,
          spanGaps: false
        });
      });

      if (!datasets.length) {
        wrapper.innerHTML = '<div class="evolucao-empty"><p>Nenhuma carga registrada neste grupo.</p></div>';
        return;
      }

      ensureChartJs(function() {
        window.evolucaoChart = new Chart(ctx, {
          type: 'line',
          data: { labels: labels, datasets: datasets },
          options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
              legend: {
                labels: { color: '#E8E8E8', font: { size: 11 }, boxWidth: 14, padding: 12, usePointStyle: true }
              }
            },
            scales: {
              x: {
                ticks: { color: '#888', font: { size: 11 } },
                grid: { color: 'rgba(255,255,255,0.04)' }
              },
              y: {
                beginAtZero: false,
                ticks: { color: '#CCFF00', font: { size: 11 }, callback: function(v) { return v + 'kg'; } },
                grid: { color: 'rgba(255,255,255,0.04)' }
              }
            }
          }
        });
      });
    }

    // ─── COUNTDOWN TIMER (dinâmico via configuração) ───
    (function startCountdown() {
      const el = document.getElementById('countdown');
      if (!el) return;
      var trialCfg = _st.trialConfig;
      var horas = trialCfg.duracao || 48;
      const end = Date.now() + horas * 60 * 60 * 1000;
      var _cdInterval = null;
      function tick() {
        // Para o timer se o elemento saiu do DOM (evita interval rodando para sempre)
        if (!document.body.contains(el)) { if (_cdInterval) clearInterval(_cdInterval); return; }
        const diff = Math.max(0, end - Date.now());
        const h = Math.floor(diff / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        el.textContent =
          String(h).padStart(2, '0') + ':' +
          String(m).padStart(2, '0') + ':' +
          String(s).padStart(2, '0');
        if (diff <= 0 && _cdInterval) clearInterval(_cdInterval);
      }
      tick();
      _cdInterval = setInterval(tick, 1000);
    })();