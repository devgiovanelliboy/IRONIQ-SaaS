// ─── MÓDULO: TREINO ATIVO (diário de treino) ─────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             utils.js (escHtml), planos.js (verificarAcessoPlano)
    // ─── TREINO ATIVO (diário de treino) ───
    var _treinoAtivoDiaAtual = 0;
    var _treinoAtivoTimerInterval = null;
    var _treinoAtivoRestRunning = false;
    var _treinoAtivoRestTime = 60;

    function carregarTreinoAtivo() {
      var protocolo = null;
      try { protocolo = JSON.parse(localStorage.getItem('ironqi_protocolo')); } catch(e) { protocolo = null; }
      _treinoAtivoDiaAtual = 0;

      // Garante que o protocolo em cache pertence ao usuário atual
      var _emailAtual = localStorage.getItem('ironqi_logado');
      var _protocoloAluno = localStorage.getItem('ironqi_protocolo_aluno');
      if (_emailAtual && _protocoloAluno && _protocoloAluno !== _emailAtual && !localStorage.getItem('ironqi_personal_logado')) {
        protocolo = null;
        localStorage.removeItem('ironqi_protocolo');
        localStorage.removeItem('ironqi_protocolo_aluno');
      }

      if (!protocolo || !protocolo.dias || !protocolo.dias.length) {
        document.getElementById('treino-ativo-nome').textContent = 'Nenhum treino disponível';
        document.getElementById('treino-ativo-meta').textContent = '';
        document.getElementById('treino-ativo-dias').innerHTML = '';
        document.getElementById('treino-ativo-exercicios').innerHTML =
          '<div class="treino-empty">' +
            '<h3>Nenhum treino gerado</h3>' +
            '<p>Solicite um treino na aba Home primeiro.</p>' +
          '</div>';
        return;
      }

      document.getElementById('treino-ativo-nome').textContent = protocolo.nome || 'Protocolo IRONIQA';
      document.getElementById('treino-ativo-meta').textContent = protocolo.meta || '';

      var dias = protocolo.dias;
      var tabContainer = document.getElementById('treino-ativo-dias');
      tabContainer.innerHTML = '';

      dias.forEach(function(d, i) {
        var btn = document.createElement('button');
        btn.className = 'treino-tab' + (i === 0 ? ' active' : '');
        var slug = d.slug || String.fromCharCode(65 + i);
        btn.textContent = 'Treino ' + slug;
        btn.onclick = function() {
          tabContainer.querySelectorAll('.treino-tab').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          _treinoAtivoDiaAtual = i;
          renderizarExerciciosAtivos(d);
        };
        tabContainer.appendChild(btn);
      });

      if (dias.length > 0) renderizarExerciciosAtivos(dias[0]);
      if (typeof lucide !== 'undefined') lucide.createIcons();

      // Role-based visibility
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      var isPersonal = !!localStorage.getItem('ironqi_personal_logado');
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var perfil = userData.perfil || userData.tipo || '';
      var isAdmin = perfil === 'admin' || !!document.getElementById('page-admin') && document.getElementById('page-admin').classList.contains('active');
      var isGerente = isPersonal || perfil === 'personal' || perfil.indexOf('personal_') === 0 || isAdmin;

      var timerCard = document.getElementById('treino-ativo-timer-card');
      var obsCard = document.getElementById('treino-ativo-obs-card');
      var gerencial = document.getElementById('treino-ativo-gerencial');

      if (isGerente) {
        if (timerCard) timerCard.style.display = 'none';
        if (obsCard) obsCard.style.display = 'none';
        if (gerencial) gerencial.style.display = 'block';
      } else {
        if (timerCard) timerCard.style.display = '';
        if (obsCard) obsCard.style.display = '';
        if (gerencial) gerencial.style.display = 'none';
      }
    }

    function renderizarExerciciosAtivos(dia) {
      var container = document.getElementById('treino-ativo-exercicios');
      var exs = dia.exercicios || [];

      if (!exs.length) {
        container.innerHTML = '<div class="treino-empty"><p>Nenhum exercício neste treino.</p></div>';
        return;
      }

      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      var isPersonal = !!localStorage.getItem('ironqi_personal_logado');
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var perfil = userData.perfil || userData.tipo || '';
      var isAdmin = perfil === 'admin' || !!document.getElementById('page-admin') && document.getElementById('page-admin').classList.contains('active');
      var isGerente = isPersonal || perfil === 'personal' || perfil.indexOf('personal_') === 0 || isAdmin;

      function esc(s) { return escHtml(s); }

      var html = '<div class="treino-table">';

      exs.forEach(function(ex, idx) {
        var exId = 'ex_' + idx + '_' + Date.now();
        var reps = ex.reps || '';
        var icon = ex.icon || '🏋️';
        html +=
          '<div class="treino-row">' +
            '<div class="ex-thumb">' + icon + '</div>' +
            '<div class="ex-info">' +
              '<div class="ex-name">' + esc(ex.nome) + '</div>' +
              '<div class="ex-detail">' + esc(ex.detalhe || '') + '</div>' +
            '</div>' +
            '<div class="ex-set">' + (ex.set || '') + '</div>' +
            '<div class="ex-reps">' + reps + '</div>' +
            (isGerente
              ? '<div class="ex-carga"><span class="carga-static">—</span></div>'
              : '<div class="ex-carga">' +
                  '<input type="number" class="input-carga" id="' + exId + '" data-exercicio-id="' + exId + '" data-exercicio-nome="' + esc(ex.nome) + '" data-exercicio-reps="' + esc(reps) + '" placeholder="0" min="0" step="0.5">' +
                  '<span class="carga-label">kg</span>' +
                '</div>'
            ) +
          '</div>';
      });

      html += '</div>';
      container.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function concluirTreinoAtivo() {
      var inputs = document.querySelectorAll('#treino-ativo-exercicios .input-carga');
      var exercicios = [];
      var allFilled = true;

      inputs.forEach(function(inp) {
        var peso = inp.value.trim();
        if (peso === '') {
          allFilled = false;
          inp.style.borderColor = '#FF4444';
        } else {
          inp.style.borderColor = '';
          exercicios.push({
            nome: inp.getAttribute('data-exercicio-nome'),
            peso: parseFloat(peso),
            reps: inp.getAttribute('data-exercicio-reps')
          });
        }
      });

      if (!allFilled) {
        if (!confirm('Alguns pesos não foram preenchidos. Deseja continuar mesmo assim?')) return;
        exercicios = [];
        inputs.forEach(function(inp) {
          var peso = inp.value.trim();
          if (peso !== '') {
            exercicios.push({
              nome: inp.getAttribute('data-exercicio-nome'),
              peso: parseFloat(peso),
              reps: inp.getAttribute('data-exercicio-reps')
            });
          }
        });
      }

      var activeBtn = document.querySelector('#treino-ativo-dias .treino-tab.active');
      var treinoLetra = activeBtn ? activeBtn.textContent.replace('Treino ', '') : '';
      var treinoNome = '';
      var protocolo = JSON.parse(localStorage.getItem('ironqi_protocolo') || '{}');
      if (protocolo.dias && protocolo.dias[_treinoAtivoDiaAtual]) {
        treinoNome = protocolo.dias[_treinoAtivoDiaAtual].nome || '';
      }

      var hoje = new Date();
      var dataStr = hoje.getDate().toString().padStart(2,'0') + '/' +
        (hoje.getMonth()+1).toString().padStart(2,'0') + '/' +
        hoje.getFullYear();
      var timestamp = hoje.toISOString();

      var email = localStorage.getItem('ironqi_logado');
      var observacoes = document.getElementById('treino-ativo-obs').value.trim();

      var entry = {
        data: dataStr,
        timestamp: timestamp,
        treino: treinoLetra,
        treinoLetra: treinoLetra,
        treinoNome: treinoNome,
        diaNome: protocolo.nome || '',
        exercicios: exercicios
      };
      if (observacoes) entry.observacoes = observacoes;

      // Salva no localStorage (demo / fallback)
      var historico = (_st.historico[email] || []);
      historico.push(entry);
      _st.historico[email] = historico;

      // Salva no Firestore subcoleção historico_treinos
      if (!isDemo && db && email) {
        var uid = emailToUid[email];
        if (!uid && auth && auth.currentUser) {
          uid = auth.currentUser.uid;
        }
        if (uid) {
          db.collection('usuarios').doc(uid).collection('historico_treinos').add(entry)
            .then(function() {
              alert('Treino Concluído com Sucesso!');
              navigate('dashboard');
              if (observacoes) analisarObservacoes(email, observacoes, treinoLetra);
            })
            .catch(function(err) {
              console.warn('Erro ao salvar histórico no Firestore:', err);
              alert('Treino Concluído com Sucesso! (salvo localmente)');
              navigate('dashboard');
              if (observacoes) analisarObservacoes(email, observacoes, treinoLetra);
            });
        } else {
          alert('Treino Concluído com Sucesso!');
          navigate('dashboard');
          if (observacoes) analisarObservacoes(email, observacoes, treinoLetra);
        }
      } else {
        alert('Treino Concluído com Sucesso!');
        navigate('dashboard');
        if (observacoes) analisarObservacoes(email, observacoes, treinoLetra);
      }
    }

    function iniciarDescansoAtivo() {
      var display = document.getElementById('treino-ativo-timer');
      var btn = document.querySelector('#page-treino-ativo .rest-timer-btn');

      if (_treinoAtivoRestRunning) {
        clearInterval(_treinoAtivoTimerInterval);
        _treinoAtivoTimerInterval = null;
        _treinoAtivoRestRunning = false;
        display.textContent = '60s';
        display.className = 'rest-timer-countdown';
        btn.textContent = 'Iniciar';
        btn.className = 'rest-timer-btn';
        _treinoAtivoRestTime = 60;
        return;
      }

      _treinoAtivoRestTime = 60;
      _treinoAtivoRestRunning = true;
      display.textContent = '60';
      display.className = 'rest-timer-countdown';
      btn.textContent = 'Parar';
      btn.className = 'rest-timer-btn active';

      _treinoAtivoTimerInterval = setInterval(function() {
        _treinoAtivoRestTime--;
        display.textContent = _treinoAtivoRestTime;

        if (_treinoAtivoRestTime <= 0) {
          clearInterval(_treinoAtivoTimerInterval);
          _treinoAtivoTimerInterval = null;
          _treinoAtivoRestRunning = false;
          display.textContent = '⚡ GO!';
          display.className = 'rest-timer-countdown alert';
          btn.textContent = 'Iniciar';
          btn.className = 'rest-timer-btn';

          setTimeout(function() {
            display.textContent = '60s';
            display.className = 'rest-timer-countdown';
            _treinoAtivoRestTime = 60;
          }, 4000);
        }
      }, 1000);
    }

    // ─── INICIAR TREINO ───
    function iniciarTreino() {
      var protocolo = null;
      try { protocolo = JSON.parse(localStorage.getItem('ironqi_protocolo')); } catch(e) { protocolo = null; }
      var container = document.getElementById('letter-selector');
      var exContainer = document.getElementById('exercicios-container');
      if (!container || !exContainer) return; // página não montada — evita crash

      container.innerHTML = '';
      exContainer.innerHTML = '';

      // Garante que o protocolo em cache pertence ao usuário logado (não vaza entre contas)
      var _emailAtual = localStorage.getItem('ironqi_logado');
      var _protocoloAluno = localStorage.getItem('ironqi_protocolo_aluno');
      if (_emailAtual && _protocoloAluno && _protocoloAluno !== _emailAtual && !localStorage.getItem('ironqi_personal_logado')) {
        protocolo = null;
        localStorage.removeItem('ironqi_protocolo');
        localStorage.removeItem('ironqi_protocolo_aluno');
      }

      if (!protocolo || !protocolo.dias || !protocolo.dias.length) {
        exContainer.innerHTML = '<div class="evolucao-empty"><h3>Nenhum treino gerado</h3><p>Solicite um treino na aba Home primeiro.</p></div>';
        return;
      }

      var dias = protocolo.dias;
      dias.forEach(function(d, i) {
        var btn = document.createElement('button');
        btn.className = 'letter-btn' + (i === 0 ? ' active' : '');
        btn.textContent = d.slug || String.fromCharCode(65 + i);
        btn.onclick = function() {
          document.querySelectorAll('.letter-btn').forEach(function(b) { b.classList.remove('active'); });
          btn.classList.add('active');
          renderExercicios(d);
        };
        container.appendChild(btn);
      });

      if (dias.length > 0) renderExercicios(dias[0]);
    }

    function renderExercicios(dia) {
      var container = document.getElementById('exercicios-container');
      var exs = dia.exercicios || [];
      if (!exs.length) {
        container.innerHTML = '<div class="evolucao-empty"><p>Nenhum exercício neste treino.</p></div>';
        return;
      }

      var html = '<div class="card"><h3 style="margin-bottom:12px; color:#CCFF00;">' + dia.nome + '</h3>';

      exs.forEach(function(ex) {
        var nomeUpper = ex.nome.toUpperCase();
        var isCardio = nomeUpper.indexOf('CARDIO') !== -1 || nomeUpper.indexOf('CÁRDIO') !== -1;

        html += '<div class="exercise-row">' +
          '<div class="ex-info">' +
            '<div class="ex-name">' + ex.nome + '</div>' +
            '<div class="ex-detail">' + (ex.detalhe || '') + '</div>' +
          '</div>' +
          '<div class="ex-sets">' + (ex.reps || '') + '</div>';

        if (isCardio) {
          html += '<span class="ex-cardio-label">Cardio</span>';
        } else {
          html += '<input type="number" class="exercise-weight-input" placeholder="kg" data-exercicio="' + ex.nome.replace(/"/g, '&quot;') + '">';
        }

        html += '</div>';
      });

      html += '</div>';
      container.innerHTML = html;
    }

    function concluirTreino() {
      var inputs = document.querySelectorAll('#exercicios-container .exercise-weight-input');
      var exercicios = [];
      var allFilled = true;

      inputs.forEach(function(inp) {
        var peso = inp.value.trim();
        if (peso === '') {
          allFilled = false;
          inp.style.borderColor = '#FF4444';
        } else {
          inp.style.borderColor = '';
          exercicios.push({ nome: inp.getAttribute('data-exercicio'), peso: parseFloat(peso) });
        }
      });

      // Coleta exercícios de cardio (sem input)
      document.querySelectorAll('#exercicios-container .ex-cardio-label').forEach(function(label) {
        var row = label.closest('.exercise-row');
        if (row) {
          var nameEl = row.querySelector('.ex-name');
          if (nameEl) exercicios.push({ nome: nameEl.textContent, peso: 0 });
        }
      });

      if (!allFilled) {
        if (!confirm('Alguns pesos não foram preenchidos. Deseja continuar mesmo assim?')) return;
        exercicios = [];
        inputs.forEach(function(inp) {
          var peso = inp.value.trim();
          if (peso !== '') {
            exercicios.push({ nome: inp.getAttribute('data-exercicio'), peso: parseFloat(peso) });
          }
        });
        document.querySelectorAll('#exercicios-container .ex-cardio-label').forEach(function(label) {
          var row = label.closest('.exercise-row');
          if (row) {
            var nameEl = row.querySelector('.ex-name');
            if (nameEl) exercicios.push({ nome: nameEl.textContent, peso: 0 });
          }
        });
      }

      var activeBtn = document.querySelector('.letter-btn.active');
      var treinoLetra = activeBtn ? activeBtn.textContent : '';

      var hoje = new Date();
      var dataStr = hoje.getDate().toString().padStart(2,'0') + '/' +
        (hoje.getMonth()+1).toString().padStart(2,'0') + '/' +
        hoje.getFullYear();

      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      var observacoes = document.getElementById('observacoes-treino').value.trim();
      var historico = (_st.historico[email] || []);
      var entry = {
        data: dataStr,
        treino: treinoLetra,
        exercicios: exercicios
      };
      if (observacoes) entry.observacoes = observacoes;
      historico.push(entry);
      _st.historico[email] = historico;

      alert('Treino concluído! Cargas salvas com sucesso.');
      navigate('dashboard');

      if (observacoes) {
        analisarObservacoes(email, observacoes, treinoLetra);
      }
    }

    function analisarObservacoes(email, texto, treinoLetra) {
      if (isDemo || !auth || !auth.currentUser) return;

      var prompt = 'Analise o texto abaixo escrito por um aluno após o treino ' + treinoLetra + '. ' +
        'Identifique se há sinais de alerta como: cansaço excessivo, dores (musculares, articulares), ' +
        'fadiga extrema, desânimo, tontura, falta de ar ou qualquer sintoma físico preoculpante. ' +
        'Responda APENAS com um JSON no formato: {"alerta": true/false, "tipo": "cansaço|dor|fadiga|tontura|outro", "descricao": "descrição curta em português"}. ' +
        'Se não houver nada preocupante, retorne {"alerta": false}. ' +
        'Texto do aluno: "' + texto + '"';

      _iaFetch({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Você é um analisador de bem-estar de alunos de academia. Retorne APENAS o JSON solicitado, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 256
      })
      .then(function(res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function(json) {
        var text = '';
        try { text = json.choices[0].message.content; } catch(e) {}
        if (!text) return;
        text = text.replace(/```json/gi, '').replace(/```/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
        var result = null;
        try {
          result = JSON.parse(text);
        } catch(e) {
          var match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { result = JSON.parse(match[0].replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')); } catch(e2) {}
          }
        }
        if (result && result.alerta) {
          var notificacoes = _st.notificacoes;
          notificacoes.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            alunoEmail: email,
            treino: treinoLetra,
            tipo: result.tipo || 'alerta',
            descricao: result.descricao || 'Sinal de alerta detectado',
            texto: texto,
            data: new Date().toISOString(),
            lida: false
          });
          _st.notificacoes = notificacoes;
        }
      })
      .catch(function(err) {
        console.log('Erro ao analisar observações:', err);
      });
    }