// ─── MÓDULO: PROTOCOLO / RENDER + MOCK ───────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, _iaFetch)
//             comissoes.js (registrarComissao)
    function protocoloAprovado(data) {
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';

      // Salva no localStorage para compatibilidade
      var pendentes = _st.pendentes;
      pendentes.push({
        id: _waitingProtocoloId || Date.now().toString(36),
        tipo: _waitingTipo || data.tipo || 'treino',
        alunoEmail: data.alunoEmail,
        dataGerado: data.dataGerado || new Date().toISOString(),
        dataAprovado: new Date().toISOString(),
        status: 'approved',
        protocolo: data.protocolo
      });
      _st.pendentes = pendentes;

      if (_waitingTipo === 'dieta' || data.tipo === 'dieta') {
        if (data.protocolo && data.protocolo.resultado) {
          exibirDietaAprovada(data.protocolo.resultado);
        }
      } else {
        if (data.protocolo) {
          exibirTreino(data.protocolo);
        }
      }

      // Atualiza status no Firestore
      if (!isDemo && db && _waitingProtocoloId) {
        db.collection('protocolos_analise').doc(_waitingProtocoloId).update({
          vistoEm: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function(e) { console.warn('Firestore protocolo vistoEm update error:', e.code || e); });
      }
      _waitingProtocoloId = null;
      _waitingTipo = null;
    }

    // ─── MOCK (fallback sem IA) ───
    function montarTreinoMock(d) {
      var meta = d.objetivo + ' · ' + d.nivel;
      var temCardio = d.objetivo === 'Emagrecimento' || d.objetivo === 'Condicionamento';

      var banco = {
        'Hipertrofia': {
          peito: [
            { nome: 'Supino Reto', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Crucifixo', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Supino Inclinado', detalhe: 'Halteres · 4 séries', icon: '🏋️', reps: '4×10' },
            { nome: 'Crossover', detalhe: 'Polia · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Supino Declinado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×10' }
          ],
          triceps: [
            { nome: 'Tríceps Pulley', detalhe: 'Corda · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps Testa', detalhe: 'Barra W · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps Coice', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Flexão', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×15' }
          ],
          costas: [
            { nome: 'Puxada Aberta', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Remada Curvada', detalhe: 'Halteres · 4 séries', icon: '🏋️', reps: '4×10' },
            { nome: 'Serrote', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×12' },
            { nome: 'Puxada Fechada', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×12' },
            { nome: 'Remada Unilateral', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×12' }
          ],
          biceps: [
            { nome: 'Rosca Direta', detalhe: 'Barra W · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Concentrada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca Scott', detalhe: 'Banco · 3 séries', icon: '💪', reps: '3×10' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 4 séries', icon: '📐', reps: '4×12' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Elevação Frontal', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×12' },
            { nome: 'Encolhimento', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento Livre', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Leg Press', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×12' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Panturrilha em Pé', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×15' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          quadriceps: [
            { nome: 'Agachamento Livre', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Leg Press', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×12' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Passada', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Sumô', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          posterior: [
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Elevação Pélvica', detalhe: 'Barra · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Cadeira Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Bom Dia', detalhe: 'Barra · 3 séries', icon: '🦵', reps: '3×10' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Russian Twist', detalhe: 'Halteres · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Prancha Lateral', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×30s' }
          ]
        },
        'Emagrecimento': {
          peito: [
            { nome: 'Supino Reto', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Flexão', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×20' },
            { nome: 'Crucifixo', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Flexão Inclinada', detalhe: 'Peso corporal · 3 séries', icon: '💪', reps: '3×15' }
          ],
          triceps: [
            { nome: 'Tríceps Banco', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Corda', detalhe: 'Polia · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Extensão de Tríceps', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Testa Leve', detalhe: 'Halteres · 3 séries', icon: '💥', reps: '3×15' }
          ],
          costas: [
            { nome: 'Remada Unilateral', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Puxada Frontal', detalhe: 'Polia · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Remada Curvada', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Barra Fixa', detalhe: 'Peso corporal · 3 séries', icon: '🏋️', reps: '3×8' }
          ],
          biceps: [
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Concentrada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca 21', detalhe: 'Barra · 3 séries', icon: '💪', reps: '3×21' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' },
            { nome: 'Polichinelo', detalhe: 'Aquecimento', icon: '🔥', reps: '3×30s' },
            { nome: 'Remada Alta', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' },
            { nome: 'Afundo', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Panturrilha', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' }
          ],
          quadriceps: [
            { nome: 'Agachamento', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×20' },
            { nome: 'Afundo', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Polichinelo Agachado', detalhe: 'Peso corporal', icon: '🔥', reps: '3×15' }
          ],
          posterior: [
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Stiff', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Cadeira Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Bicicleta no Solo', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' }
          ]
        },
        'Força': {
          peito: [
            { nome: 'Supino Reto Pesado', detalhe: 'Barra · 5 séries', icon: '🏋️', reps: '5×5' },
            { nome: 'Supino Inclinado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×6' },
            { nome: 'Flexão Ponderada', detalhe: 'Carga · 3 séries', icon: '💪', reps: '3×8' },
            { nome: 'Crossover na Polia', detalhe: 'Polia · 4 séries', icon: '📐', reps: '4×8' }
          ],
          triceps: [
            { nome: 'Tríceps Pulley', detalhe: 'Polia · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Tríceps Testa', detalhe: 'Barra · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Mergulho entre Bancos', detalhe: 'Peso corporal · 4 séries', icon: '💥', reps: '4×8' },
            { nome: 'Extensão Tríceps Pesada', detalhe: 'Halteres · 4 séries', icon: '💥', reps: '4×6' }
          ],
          costas: [
            { nome: 'Terra Convencional', detalhe: 'Barra · 5 séries', icon: '🏋️', reps: '5×5' },
            { nome: 'Remada Curvada', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×6' },
            { nome: 'Barra Fixa', detalhe: 'Peso corporal · 4 séries', icon: '💪', reps: '4×6' },
            { nome: 'Puxada no Pulley', detalhe: 'Polia · 4 séries', icon: '🏋️', reps: '4×6' }
          ],
          biceps: [
            { nome: 'Rosca Direta', detalhe: 'Barra · 4 séries', icon: '💪', reps: '4×8' },
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×8' },
            { nome: 'Rosca Inclinada', detalhe: 'Halteres · 4 séries', icon: '💪', reps: '4×8' },
            { nome: 'Rosca Concentrada Pesada', detalhe: 'Halteres · 4 séries', icon: '💪', reps: '4×6' }
          ],
          ombro: [
            { nome: 'Desenvolvimento Militar', detalhe: 'Barra · 5 séries', icon: '📐', reps: '5×5' },
            { nome: 'Elevação Lateral', detalhe: 'Halteres · 4 séries', icon: '📐', reps: '4×8' },
            { nome: 'Remada Alta', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×8' },
            { nome: 'Encolhimento Pesado', detalhe: 'Barra · 4 séries', icon: '🏋️', reps: '4×8' }
          ],
          perna: [
            { nome: 'Agachamento Profundo', detalhe: 'Barra · 5 séries', icon: '🦵', reps: '5×5' },
            { nome: 'Leg Press Pesado', detalhe: 'Máquina · 5 séries', icon: '🦵', reps: '5×8' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' }
          ],
          quadriceps: [
            { nome: 'Agachamento Profundo', detalhe: 'Barra · 5 séries', icon: '🦵', reps: '5×5' },
            { nome: 'Leg Press Pesado', detalhe: 'Máquina · 5 séries', icon: '🦵', reps: '5×8' },
            { nome: 'Cadeira Extensora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Agachamento Búlgaro', detalhe: 'Halteres · 4 séries', icon: '🦵', reps: '4×6' },
            { nome: 'Passada', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' }
          ],
          posterior: [
            { nome: 'Stiff', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' },
            { nome: 'Bom Dia', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×8' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 4 séries', icon: '🦵', reps: '4×10' },
            { nome: 'Elevação Pélvica', detalhe: 'Barra · 4 séries', icon: '🦵', reps: '4×10' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×60s' },
            { nome: 'Elevação de Pernas', detalhe: 'Solo · 3 séries', icon: '🧠', reps: '3×15' },
            { nome: 'Russian Twist', detalhe: 'Halteres · 3 séries', icon: '🧠', reps: '3×12' },
            { nome: 'Dragon Flag', detalhe: 'Banco · 3 séries', icon: '🧠', reps: '3×8' }
          ]
        },
        'Condicionamento': {
          peito: [
            { nome: 'Flexão Explosiva', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Burpee', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Mountain Climber', detalhe: 'Peso corporal · 3 séries', icon: '🔥', reps: '3×30s' },
            { nome: 'Flexão com Palmas', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' }
          ],
          triceps: [
            { nome: 'Mergulho', detalhe: 'Banco · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Tríceps Corda', detalhe: 'Polia · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Tríceps com Elástico', detalhe: 'Elástico · 3 séries', icon: '💥', reps: '3×15' },
            { nome: 'Mergulho no Banco', detalhe: 'Peso corporal · 3 séries', icon: '💥', reps: '3×12' }
          ],
          costas: [
            { nome: 'Remada Rápida', detalhe: 'Halteres · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Puxada na Polia', detalhe: 'Polia · 3 séries', icon: '🏋️', reps: '3×15' },
            { nome: 'Superman', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×12' },
            { nome: 'Barra Fixa Explosiva', detalhe: 'Pliométrico · 3 séries', icon: '🏋️', reps: '3×6' }
          ],
          biceps: [
            { nome: 'Rosca Alternada', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Martelo', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×12' },
            { nome: 'Rosca com Elástico', detalhe: 'Elástico · 3 séries', icon: '💪', reps: '3×15' },
            { nome: 'Rosca Isométrica', detalhe: 'Halteres · 3 séries', icon: '💪', reps: '3×30s' }
          ],
          ombro: [
            { nome: 'Desenvolvimento', detalhe: 'Halteres · 3 séries', icon: '📐', reps: '3×12' },
            { nome: 'Polichinelo', detalhe: 'Peso corporal', icon: '🔥', reps: '3×30s' },
            { nome: 'Circulação', detalhe: 'Peso corporal', icon: '🔥', reps: '3×30s' },
            { nome: 'Rotação de Ombro', detalhe: 'Elástico · 3 séries', icon: '📐', reps: '3×15' }
          ],
          perna: [
            { nome: 'Agachamento com Salto', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Box Jump', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' },
            { nome: 'Afundo Saltado', detalhe: 'Pliométrico · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Pular Corda', detalhe: 'Intervalado', icon: '🔥', reps: '5×1min' }
          ],
          quadriceps: [
            { nome: 'Agachamento com Salto', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×12' },
            { nome: 'Box Jump', detalhe: 'Pliométrico · 3 séries', icon: '💥', reps: '3×10' },
            { nome: 'Afundo Saltado', detalhe: 'Pliométrico · 3 séries', icon: '🦵', reps: '3×10' },
            { nome: 'Corrida Estacionária', detalhe: 'Alta intensidade', icon: '🔥', reps: '3×30s' }
          ],
          posterior: [
            { nome: 'Stiff', detalhe: 'Halteres · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Elevação Pélvica', detalhe: 'Peso corporal · 3 séries', icon: '🦵', reps: '3×15' },
            { nome: 'Mesa Flexora', detalhe: 'Máquina · 3 séries', icon: '🦵', reps: '3×12' },
            { nome: 'Superman', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×12' }
          ],
          abdomen: [
            { nome: 'Prancha', detalhe: 'Isométrico · 3 séries', icon: '🧠', reps: '3×45s' },
            { nome: 'Crunch', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Bicicleta no Solo', detalhe: 'Peso corporal · 3 séries', icon: '🧠', reps: '3×20' },
            { nome: 'Montanha', detalhe: 'Peso corporal · 3 séries', icon: '🔥', reps: '3×30s' }
          ]
        }
      };

      var grupo = banco[d.objetivo] || banco['Hipertrofia'];

      function sortear(lista, n) {
        var copia = lista.slice();
        for (var i = copia.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var temp = copia[i]; copia[i] = copia[j]; copia[j] = temp;
        }
        return copia.slice(0, Math.min(n, copia.length));
      }

      function aplicarLesao(exercicios, lesao) {
        if (!lesao) return;
        var l = lesao.toLowerCase();
        for (var e = 0; e < exercicios.length; e++) {
          var ex = exercicios[e];
          if (l.indexOf('ombro') !== -1 && (ex.nome.indexOf('Desenvolvimento') !== -1 || ex.nome.indexOf('Supino') !== -1)) ex.detalhe += ' [Evitar sobrecarga]';
          if ((l.indexOf('coluna') !== -1 || l.indexOf('lombar') !== -1 || l.indexOf('costas') !== -1) && ex.nome.indexOf('Terra') !== -1) ex.detalhe += ' [Substituir por Remada]';
          if (l.indexOf('joelho') !== -1 && (ex.nome.indexOf('Agachamento') !== -1 || ex.nome.indexOf('Leg') !== -1)) ex.detalhe += ' [Carga leve]';
          if (l.indexOf('punho') !== -1 && (ex.nome.indexOf('Rosca') !== -1 || ex.nome.indexOf('Puxada') !== -1)) ex.detalhe += ' [Evitar flexão]';
        }
      }

      var freq = parseInt(d.dias, 10) || 4;

      var configMap = {
        5: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Perna (Quadríceps)', slug: 'C', grupos: ['quadriceps'] },
          { nome: 'Treino D — Ombro', slug: 'D', grupos: ['ombro'] },
          { nome: 'Treino E — Posterior e Abdômen', slug: 'E', grupos: ['posterior', 'abdomen'] }
        ],
        4: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Ombro', slug: 'C', grupos: ['ombro'] },
          { nome: 'Treino D — Perna', slug: 'D', grupos: ['perna'] }
        ],
        3: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] },
          { nome: 'Treino C — Ombro e Perna', slug: 'C', grupos: ['ombro', 'perna'] }
        ],
        2: [
          { nome: 'Treino A — Peito e Tríceps', slug: 'A', grupos: ['peito', 'triceps'] },
          { nome: 'Treino B — Costas e Bíceps', slug: 'B', grupos: ['costas', 'biceps'] }
        ],
        1: [
          { nome: 'Treino Full Body', slug: 'A', grupos: ['peito', 'costas', 'perna'] }
        ]
      };

      var dias = configMap[freq] || configMap[4];
      var qtd = 8;
      var metade = 4;
      var cardioOpts = ['Bicicleta 15min', 'Esteira 15min'];
      for (var i = 0; i < dias.length; i++) {
        var exs = [];
        var grupos = dias[i].grupos;

        for (var g = 0; g < grupos.length; g++) {
          var lista = grupo[grupos[g]];
          if (lista) {
            var nPorGrupo;
            if (grupos.length === 1) {
              nPorGrupo = Math.min(qtd, lista.length);
            } else {
              // sempre 4 de cada grupo (metade), independente de quantos já foram sorteados
              nPorGrupo = Math.min(metade, lista.length);
            }
            var sorteio = sortear(lista, nPorGrupo);
            if (d.lesao) aplicarLesao(sorteio, d.lesao);
            exs = exs.concat(sorteio);
          }
        }

        if (temCardio) {
          exs.push({
            nome: cardioOpts[i % 2],
            detalhe: 'Cardio · Intensidade moderada',
            icon: '🚴',
            reps: '15min'
          });
        }

        dias[i].exercicios = exs;
      }

      return { nome: 'Protocolo IRONIQA', meta: meta, dias: dias };
    }

    function exibirTreino(protocolo) {
      document.getElementById('empty-workout').style.display = 'none';
      document.getElementById('empty-workout-btn').style.display = 'none';
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';
      document.getElementById('waiting-approved').style.display = 'none';
      var container = document.getElementById('workout-container');
      container.style.display = 'flex';

      document.getElementById('workout-name').textContent = protocolo.nome || 'Protocolo IRONIQA';
      document.getElementById('workout-meta').textContent = protocolo.meta || '';

      // Salva protocolo no localStorage vinculado ao aluno atual
      localStorage.setItem('ironqi_protocolo', JSON.stringify(protocolo));
      var _ownerEmail = localStorage.getItem('ironqi_logado') || '';
      if (_ownerEmail) localStorage.setItem('ironqi_protocolo_aluno', _ownerEmail);

      var dias = protocolo.dias || [];
      var tabContainer = document.getElementById('day-tabs');
      var dayContainer = document.getElementById('workout-days');
      tabContainer.innerHTML = '';
      dayContainer.innerHTML = '';

      for (var i = 0; i < dias.length; i++) {
        var d = dias[i];
        var slug = d.slug || String.fromCharCode(65 + i);

        var tab = document.createElement('button');
        tab.className = 'day-tab' + (i === 0 ? ' active' : '');
        tab.textContent = 'Treino ' + slug;
        tab.onclick = (function(idx) { return function() { selecionarDia(idx); }; })(i);
        tabContainer.appendChild(tab);

        var dayDiv = document.createElement('div');
        dayDiv.className = 'workout-day' + (i === 0 ? ' active' : '');
        dayDiv.id = 'day-panel-' + i;

        var html = '<div class="day-title">' + escHtml(d.nome) + '</div>';
        html += '<div class="day-sub">' + (d.exercicios ? d.exercicios.length + ' exercícios' : '') + '</div>';

        var exs = d.exercicios || [];
        for (var e = 0; e < exs.length; e++) {
          var ex = exs[e];
          html +=
            '<div class="workout-item">' +
              '<div class="icon-circle">' + escHtml(ex.icon || '🏋️') + '</div>' +
              '<div class="info">' +
                '<div class="name">' + escHtml(ex.nome) + '</div>' +
                '<div class="detail">' + escHtml(ex.detalhe || '') + '</div>' +
              '</div>' +
              '<div class="sets">' + escHtml(ex.reps || '') + '</div>' +
            '</div>';
        }

        dayDiv.innerHTML = html;
        dayContainer.appendChild(dayDiv);
      }
      _atualizarBotaoAjuste('treino');
    }

    function exibirDietaAprovada(htmlContent) {
      document.getElementById('empty-dieta').style.display = 'none';
      document.getElementById('empty-dieta-btn').style.display = 'none';
      var waiting = document.getElementById('waiting-review');
      if (waiting) waiting.style.display = 'none';
      document.getElementById('waiting-approved').style.display = 'none';
      var container = document.getElementById('dieta-aprovada-container');
      container.style.display = 'flex';
      document.getElementById('dieta-aprovada-content').innerHTML = formatarTextoDieta(htmlContent);
      _atualizarBotaoAjuste('dieta');
    }

    function selecionarDia(idx) {
      var dias = document.querySelectorAll('.workout-day');
      dias.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
      var tabs = document.querySelectorAll('.day-tab');
      tabs.forEach(function(el, i) { el.classList.toggle('active', i === idx); });
      var tabContainer = document.getElementById('day-tabs');
      if (tabContainer && tabContainer.children[idx]) {
        tabContainer.children[idx].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
