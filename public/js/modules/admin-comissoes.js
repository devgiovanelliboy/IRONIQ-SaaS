// ─── MÓDULO: ADMIN / COMISSÕES + PERSONAIS ───────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db)
//             admin-core.js (_adminGetUid, _adminFsUpdate)
    function carregarAdminCupons() {
      var cupons = _st.cupons;
      var html = '';
      cupons.forEach(function(c, i) {
        var val = new Date(c.validade + 'T23:59:59');
        var expirado = val < new Date();
        var status = c.status === 'inativo' ? 'inativo' : (expirado ? 'expirado' : 'ativo');
        var badge = status === 'ativo' ? 'green' : 'red';
        var label = status === 'ativo' ? 'Ativo' : status === 'expirado' ? 'Expirado' : 'Inativo';
        var limite = c.limite || 0;
        var usos = c.usos || 0;
        var esgotado = limite > 0 && usos >= limite;
        if (esgotado) { badge = 'red'; label = 'Esgotado'; }
        html += '<tr>' +
          '<td>' + c.codigo + '</td>' +
          '<td>' + c.desconto + '%</td>' +
          '<td>' + val.toLocaleDateString('pt-BR') + '</td>' +
          '<td>' + (limite > 0 ? limite : '∞') + '</td>' +
          '<td>' + usos + '</td>' +
          '<td><span class="badge ' + badge + '">' + label + '</span></td>' +
          '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="admin-action-btn edit" title="Editar" onclick="adminEditarCupom(' + i + ')">✏️</button>' +
            '<button class="admin-action-btn delete" title="Excluir" onclick="adminExcluirCupom(' + i + ')">🗑️</button>' +
          '</td>' +
        '</tr>';
      });
      document.getElementById('admin-cupons-tbody').innerHTML = html || '<tr><td colspan="7" style="text-align:center;color:#555;padding:24px;">Nenhum cupom criado.</td></tr>';
    }

    function adminMostrarCupomForm() {
      var form = document.getElementById('admin-cupom-form');
      form.style.display = form.style.display === 'none' ? 'block' : 'none';
    }

    function adminSalvarCupom() {
      var codigo = document.getElementById('cupom-codigo').value.trim().toUpperCase();
      var desconto = parseInt(document.getElementById('cupom-desconto').value, 10);
      var validade = document.getElementById('cupom-validade').value;
      var limite = parseInt(document.getElementById('cupom-limite').value, 10) || 0;
      var status = document.getElementById('cupom-status').value;
      if (!codigo || !desconto || !validade) { alert('Preencha todos os campos.'); return; }
      if (desconto < 1 || desconto > 100) { alert('Desconto deve ser entre 1% e 100%.'); return; }
      var cupons = _st.cupons;
      if (cupons.some(function(c) { return c.codigo === codigo; })) { alert('Já existe um cupom com este código.'); return; }
      cupons.push({ codigo: codigo, desconto: desconto, validade: validade, limite: limite, status: status, usos: 0, criadoEm: new Date().toISOString() });
      _st.cupons = cupons;
      alert('Cupom ' + codigo + ' criado com sucesso!');
      document.getElementById('admin-cupom-form').style.display = 'none';
      document.getElementById('cupom-codigo').value = '';
      document.getElementById('cupom-desconto').value = '';
      document.getElementById('cupom-validade').value = '';
      document.getElementById('cupom-limite').value = '';
      document.getElementById('cupom-status').value = 'ativo';
      carregarAdminCupons();
    }

    function adminEditarCupom(index) {
      var cupons = _st.cupons;
      var c = cupons[index];
      if (!c) return;
      document.getElementById('cupom-edit-original').value = index;
      document.getElementById('cupom-edit-codigo').value = c.codigo;
      document.getElementById('cupom-edit-desconto').value = c.desconto;
      document.getElementById('cupom-edit-validade').value = c.validade;
      document.getElementById('cupom-edit-limite').value = c.limite || 0;
      document.getElementById('cupom-edit-status').value = c.status || 'ativo';
      document.getElementById('admin-cupom-modal-sub').textContent = 'Editando: ' + c.codigo;
      document.getElementById('modal-admin-cupom').classList.add('show');
    }

    function adminSalvarEdicaoCupom() {
      var index = parseInt(document.getElementById('cupom-edit-original').value, 10);
      var cupons = _st.cupons;
      if (!cupons[index]) return;
      cupons[index].codigo = document.getElementById('cupom-edit-codigo').value.trim().toUpperCase();
      cupons[index].desconto = parseInt(document.getElementById('cupom-edit-desconto').value, 10);
      cupons[index].validade = document.getElementById('cupom-edit-validade').value;
      cupons[index].limite = parseInt(document.getElementById('cupom-edit-limite').value, 10) || 0;
      cupons[index].status = document.getElementById('cupom-edit-status').value;
      _st.cupons = cupons;
      document.getElementById('modal-admin-cupom').classList.remove('show');
      alert('Cupom atualizado com sucesso!');
      carregarAdminCupons();
    }

    function adminExcluirCupom(index) {
      if (!confirm('Excluir este cupom permanentemente?')) return;
      var cupons = _st.cupons;
      cupons.splice(index, 1);
      _st.cupons = cupons;
      carregarAdminCupons();
    }

    /* ─── TRIAL ─── */
    function obterTrialConfig() {
      return _st.trialConfig;
    }

    function carregarAdminTrial() {
      var config = obterTrialConfig();
      document.getElementById('trial-toggle').className = 'plan-edit-toggle' + (config.ativo ? ' active' : '');
      document.getElementById('trial-duracao').value = config.duracao;
      document.getElementById('trial-mensagem').value = config.mensagem;
      document.getElementById('admin-trial-duracao').textContent = config.duracao + 'h';
      var usuarios = _st.usuarios;
      var agora = Date.now();
      var emTrial = 0;
      var html = '';
      Object.keys(usuarios).forEach(function(email) {
        var u = usuarios[email];
        if (u.criadoEm) {
          var criado = new Date(u.criadoEm).getTime();
          var diffH = (agora - criado) / 3600000;
          if (diffH < config.duracao) {
            emTrial++;
            var restanteH = Math.round((config.duracao - diffH) * 10) / 10;
            var expira = new Date(criado + config.duracao * 3600000);
            html += '<tr><td>' + email + '</td><td>' + new Date(criado).toLocaleDateString('pt-BR') + '</td><td>' + expira.toLocaleDateString('pt-BR') + '</td><td>' + restanteH + 'h</td><td><span class="badge green">Ativo</span></td></tr>';
          }
        }
      });
      document.getElementById('admin-trial-count').textContent = emTrial;
      document.getElementById('admin-trial-tbody').innerHTML = html || '<tr><td colspan="5" style="text-align:center;color:#555;padding:24px;">Nenhum usuário em período de trial.</td></tr>';
    }

    function adminToggleTrial() {
      var config = obterTrialConfig();
      config.ativo = !config.ativo;
      _st.trialConfig = config;
      carregarAdminTrial();
    }

    function adminSalvarTrial() {
      var config = obterTrialConfig();
      config.ativo = document.getElementById('trial-toggle').classList.contains('active');
      config.duracao = parseInt(document.getElementById('trial-duracao').value, 10) || 48;
      config.mensagem = document.getElementById('trial-mensagem').value.trim();
      _st.trialConfig = config;
      alert('Configurações de Trial salvas!');
      carregarAdminTrial();
    }

    /* ─── PERSONAIS ─── */
    function carregarAdminPersonais() {
      var usuarios = _st.usuarios;
      var personalData = (_st.personalData && Array.isArray(_st.personalData) ? _st.personalData : []);
      var planos = {};
      Object.assign(planos, _st.planos);
      var nomesPlanos = { 'personal_free': 'FREE', 'personal_pro': 'PRO', 'personal_elite': 'ELITE' };
      var userStatus = _st.userStatus;
      var pessoalLimites = _st.personalLimites;
      var emails = [];
      personalData.forEach(function(p) { if (emails.indexOf(p.email) === -1) emails.push(p.email); });
      Object.keys(usuarios).forEach(function(email) {
        var d = usuarios[email].dados || {};
        if ((d.tipo === 'personal' || d.perfil === 'personal') && emails.indexOf(email) === -1) emails.push(email);
      });
      var html = '';
      emails.forEach(function(email) {
        var p = personalData.find(function(x) { return x.email === email; }) || {};
        var d = (usuarios[email] || {}).dados || {};
        var nome = p.nome || d.nome || '—';
        var alunos = p.alunos || 0;
        var plano = planos[email];
        var planoNome = nomesPlanos[plano] || (plano ? plano.split('_').pop().toUpperCase() : '—');
        var limite = pessoalLimites[email] || 0;
        var status = userStatus[email] || 'ativo';
        var statusBadge = status === 'bloqueado' ? '<span class="badge red">Bloqueado</span>' : '<span class="badge green">Ativo</span>';
        var emailEsc = email.replace(/'/g, "\\'");
        var tipoPersonal = d.tipoPersonal || 'personal';
        var tipoSelect =
          '<select onchange="adminPersonalAlterarTipo(\'' + emailEsc + '\', this.value)" ' +
          'style="background:#1F2525;border:1px solid #2A3232;color:#E8E8E8;font-size:12px;border-radius:6px;padding:4px 6px;font-family:inherit;cursor:pointer;">' +
            '<option value="personal"' + (tipoPersonal === 'personal' ? ' selected' : '') + '>Personal</option>' +
            '<option value="personal_interno"' + (tipoPersonal === 'personal_interno' ? ' selected' : '') + '>Interno</option>' +
            '<option value="personal_principal"' + (tipoPersonal === 'personal_principal' ? ' selected' : '') + '>Principal ⭐</option>' +
          '</select>';
        html += '<tr>' +
          '<td>' + escHtml(nome) + '</td>' +
          '<td>' + tipoSelect + '</td>' +
          '<td>' + email + '</td>' +
          '<td>' + alunos + '</td>' +
          '<td>' + planoNome + '</td>' +
          '<td>' + (limite > 0 ? limite : '∞') + '</td>' +
          '<td>' + statusBadge + '</td>' +
          '<td style="text-align:center;white-space:nowrap;">' +
            '<button class="admin-action-btn edit" title="Alterar Limite" onclick="adminPersonalAlterarLimite(\'' + emailEsc + '\')">📋</button>' +
            (status === 'bloqueado'
              ? '<button class="admin-action-btn unlock" title="Liberar" onclick="adminPersonalLiberar(\'' + emailEsc + '\')">🔓</button>'
              : '<button class="admin-action-btn block" title="Bloquear" onclick="adminPersonalBloquear(\'' + emailEsc + '\')">🔒</button>') +
            '<button class="admin-action-btn edit" title="Upgrade Plano" onclick="adminPersonalUpgrade(\'' + emailEsc + '\')">⬆</button>' +
          '</td>' +
        '</tr>';
      });
      document.getElementById('admin-personais-count').textContent = emails.length + ' registro' + (emails.length !== 1 ? 's' : '');
      document.getElementById('admin-personais-tbody').innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:#555;padding:24px;">Nenhum personal cadastrado.</td></tr>';
    }

    function adminPersonalAlterarTipo(email, tipo) {
      // 1. Atualiza localStorage
      var usuarios = _st.usuarios;
      if (usuarios[email]) {
        if (!usuarios[email].dados) usuarios[email].dados = {};
        usuarios[email].dados.tipoPersonal = tipo;
        _st.usuarios = usuarios;
      }
      // 2. Se virou Principal: substitui o PP anterior e atualiza configuracoes
      if (tipo === 'personal_principal') {
        var _antigoPP = PERSONAL_PRINCIPAL;
        // Rebaixa o antigo PP para personal_interno (se diferente do novo)
        if (_antigoPP && _antigoPP !== email && usuarios[_antigoPP]) {
          if (!usuarios[_antigoPP].dados) usuarios[_antigoPP].dados = {};
          usuarios[_antigoPP].dados.tipoPersonal = 'personal_interno';
          _st.usuarios = usuarios;
        }
        PERSONAL_PRINCIPAL = email;
        if (!isDemo && db) {
          db.collection('configuracoes').doc('sistema').set({ personalPrincipal: email }, { merge: true })
            .then(function() { alert('✅ ' + email + ' definido como Personal Principal.\nNovos alunos autônomos serão direcionados a ele.'); })
            .catch(function(e) { console.warn('Erro ao salvar personal principal:', e); alert('✅ Salvo localmente. Erro ao salvar no servidor: ' + (e.code || e)); });
        } else {
          alert('✅ ' + email + ' definido como Personal Principal.');
        }
      } else if (email === PERSONAL_PRINCIPAL) {
        // Removendo o tipo principal de quem ainda É o PERSONAL_PRINCIPAL
        alert('⚠️ Atenção: ' + email + ' ainda está configurado como Personal Principal no sistema.\nDefina outro personal como Principal antes de alterar este tipo.\nA configuração de roteamento NÃO foi alterada.');
        // Reverte o select no localStorage para o valor anterior
        if (usuarios[email] && usuarios[email].dados) {
          usuarios[email].dados.tipoPersonal = 'personal_principal';
          _st.usuarios = usuarios;
        }
        carregarAdminPersonais();
        return;
      }
      // 3. Atualiza doc do usuário no Firestore
      if (!isDemo && db) {
        var uid = emailToUid[email];
        if (uid) {
          db.collection('usuarios').doc(uid).update({ tipoPersonal: tipo }).catch(function(e) { console.warn('Erro tipoPersonal Firestore:', e); });
        } else {
          db.collection('uidMap').doc(email.replace(/\./g, ',')).get().then(function(mapDoc) {
            if (mapDoc.exists) {
              var foundUid = mapDoc.data().uid;
              saveUidMapping(email, foundUid);
              db.collection('usuarios').doc(foundUid).update({ tipoPersonal: tipo }).catch(function(e) { console.warn('Erro tipoPersonal Firestore (map):', e); });
            }
          }).catch(function() {});
        }
      }
      carregarAdminPersonais();
    }

    function adminPersonalAlterarLimite(email) {
      var pessoalLimites = _st.personalLimites;
      var atual = pessoalLimites[email] || 0;
      var novo = prompt('Alterar limite de alunos para ' + email + ':\n(0 = ilimitado)', atual);
      if (novo === null) return;
      var num = parseInt(novo, 10);
      if (isNaN(num) || num < 0) { alert('Valor inválido.'); return; }
      pessoalLimites[email] = num;
      _st.personalLimites = pessoalLimites;
      carregarAdminPersonais();
    }

    function adminPersonalBloquear(email) {
      if (!confirm('Bloquear personal ' + email + '?')) return;
      var userStatus = _st.userStatus;
      userStatus[email] = 'bloqueado';
      _st.userStatus = userStatus;
      carregarAdminPersonais();
    }

    function adminPersonalLiberar(email) {
      var userStatus = _st.userStatus;
      userStatus[email] = 'ativo';
      _st.userStatus = userStatus;
      carregarAdminPersonais();
    }

    function adminPersonalUpgrade(email) {
      var planos = {};
      Object.assign(planos, _st.planos);
      var atual = planos[email] || 'personal_free';
      var opcoes = { 'personal_free': 'FREE (Grátis)', 'personal_pro': 'PRO (R$39,90)', 'personal_elite': 'ELITE (R$79,90)' };
      var nova = prompt('Alterar plano de ' + email + ':\nAtual: ' + (opcoes[atual] || atual) + '\n\nDigite: personal_pro, personal_elite ou personal_free', atual);
      if (!nova) return;
      if (!opcoes[nova]) { alert('Plano inválido. Use: personal_free, personal_pro ou personal_elite'); return; }
      _st.planos[email] = nova;
      carregarAdminPersonais();
    }

    function carregarAdminComissoes() {
      var comissoes = _st.comissoes;
      // Agrupa por personalEmail
      var porPersonal = {};
      comissoes.forEach(function(c) {
        if (!c.personalEmail) return;
        if (!porPersonal[c.personalEmail]) porPersonal[c.personalEmail] = { treinos: 0, dietas: 0, totalGerado: 0 };
        if (c.status === 'confirmado') {
          if (c.tipo === 'treino') porPersonal[c.personalEmail].treinos++;
          else porPersonal[c.personalEmail].dietas++;
          porPersonal[c.personalEmail].totalGerado += (c.valor || 0);
        }
      });
      var emailsLocal = Object.keys(porPersonal);

      // Carrega comissoes_pagas do Firestore, merge com localStorage e renderiza
      function _renderComPagas() {
        var lsPagas = _st.comissoesPagas;
        if (!isDemo && db) {
          db.collection('configuracoes').doc('comissoes_pagas').get().then(function(doc) {
            var fsPagas = doc.exists ? (doc.data() || {}) : {};
            var merged = Object.assign({}, lsPagas);
            Object.keys(fsPagas).forEach(function(k) {
              merged[k] = Math.max(parseFloat(merged[k] || 0), parseFloat(fsPagas[k] || 0));
            });
            _st.comissoesPagas = merged;
            renderAdminComissoesTabela(porPersonal, merged);
          }).catch(function() { renderAdminComissoesTabela(porPersonal, lsPagas); });
        } else {
          renderAdminComissoesTabela(porPersonal, lsPagas);
        }
      }

      // Se não há comissões locais, tenta buscar do Firestore primeiro
      if (emailsLocal.length === 0 && !isDemo && db) {
        db.collection('comissoes').get().then(function(snap) {
          snap.forEach(function(doc) {
            var d = doc.data();
            if (!d.personalEmail) return;
            if (!porPersonal[d.personalEmail]) porPersonal[d.personalEmail] = { treinos: 0, dietas: 0, totalGerado: 0 };
            if (d.status === 'confirmado') {
              if (d.tipo === 'treino') porPersonal[d.personalEmail].treinos++;
              else porPersonal[d.personalEmail].dietas++;
              porPersonal[d.personalEmail].totalGerado += (d.valor || 0);
              var lc = _st.comissoes;
              if (!lc.some(function(c) { return c.firestoreId === doc.id; })) {
                lc.push({ id: 'comm_' + doc.id, firestoreId: doc.id, personalEmail: d.personalEmail, alunoEmail: d.alunoEmail, tipo: d.tipo, valor: d.valor || 0, status: d.status, protocoloId: d.protocoloId || '', dataPago: d.dataPago || null, dataConfirmado: d.dataConfirmado && d.dataConfirmado.toDate ? d.dataConfirmado.toDate().toISOString() : new Date().toISOString() });
                _st.comissoes = lc;
              }
            }
          });
          _renderComPagas();
        }).catch(function(e) { console.warn('Erro ao buscar comissões do Firestore:', e); _renderComPagas(); });
      } else {
        _renderComPagas();
      }
    }

    function renderAdminComissoesTabela(porPersonal, comissoesPagas) {
      var usuarios = _st.usuarios;
      var emails = Object.keys(porPersonal).filter(function(e) { return pessoalTemComissao(e); });
      document.getElementById('admin-comissoes-count').textContent = emails.length + ' personal' + (emails.length !== 1 ? 'is' : '');
      var html = '';
      emails.forEach(function(email) {
        var stats = porPersonal[email];
        var totalGerado = stats.totalGerado;
        var pago = parseFloat(comissoesPagas[email] || 0);
        var aPagar = Math.max(0, totalGerado - pago);
        var d = (usuarios[email] && usuarios[email].dados) || {};
        var nome = d.nome || email.split('@')[0];
        var emailEsc = email.replace(/'/g, "\\'");
        html +=
          '<tr>' +
          '<td>' + escHtml(nome) + '</td>' +
          '<td style="font-size:11px;color:#666;">' + email + '</td>' +
          '<td style="text-align:center;">' + stats.treinos + '</td>' +
          '<td style="text-align:center;">' + stats.dietas + '</td>' +
          '<td style="text-align:center;color:#CCFF00;font-weight:700;">R$' + totalGerado.toFixed(0) + '</td>' +
          '<td style="text-align:center;color:#888;">R$' + pago.toFixed(0) + '</td>' +
          '<td style="text-align:center;color:' + (aPagar > 0 ? '#CCFF00' : '#555') + ';font-weight:700;">R$' + aPagar.toFixed(0) + '</td>' +
          '<td style="text-align:center;">' +
            (aPagar > 0 ? '<button class="admin-action-btn edit" title="Marcar como pago" onclick="adminMarcarComissaoPaga(\'' + emailEsc + '\', ' + aPagar + ')">💰 Pagar</button>' : '<span style="font-size:11px;color:#555;">Em dia</span>') +
          '</td>' +
          '</tr>';
      });
      document.getElementById('admin-comissoes-tbody').innerHTML = html || '<tr><td colspan="8" style="text-align:center;color:#555;padding:24px;">Nenhuma comissão registrada ainda.</td></tr>';
      // Gráfico de barras simples
      renderChartComissoes(emails, porPersonal, comissoesPagas);
    }

    function renderChartComissoes(emails, porPersonal, comissoesPagas) {
      var canvas = document.getElementById('chart-comissoes-personais');
      if (!canvas) return;
      var ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (emails.length === 0) { ctx.fillStyle = '#555'; ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Nenhum dado disponível', canvas.width / 2, 80); return; }
      var usuarios = _st.usuarios;
      var barW = Math.min(60, Math.floor((canvas.width - 40) / emails.length) - 10);
      var maxVal = 1;
      emails.forEach(function(e) { if (porPersonal[e].totalGerado > maxVal) maxVal = porPersonal[e].totalGerado; });
      var chartH = 120;
      var startY = 10;
      emails.forEach(function(email, i) {
        var stats = porPersonal[email];
        var pago = parseFloat((comissoesPagas || {})[email] || 0);
        var aPagar = Math.max(0, stats.totalGerado - pago);
        var x = 20 + i * ((canvas.width - 40) / emails.length);
        var hGerado = Math.round((stats.totalGerado / maxVal) * chartH);
        var hPago = Math.round((pago / maxVal) * chartH);
        ctx.fillStyle = '#2A3232';
        ctx.fillRect(x, startY + chartH - hGerado, barW, hGerado);
        ctx.fillStyle = '#CCFF00';
        ctx.fillRect(x, startY + chartH - hPago, barW, hPago);
        var d = (usuarios[email] && usuarios[email].dados) || {};
        var nome = (d.nome || email.split('@')[0]).substring(0, 8);
        ctx.fillStyle = '#888';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(nome, x + barW / 2, startY + chartH + 14);
        ctx.fillStyle = '#CCFF00';
        ctx.font = 'bold 11px sans-serif';
        ctx.fillText('R$' + stats.totalGerado, x + barW / 2, startY + chartH - hGerado - 4);
      });
      // Legenda
      ctx.fillStyle = '#2A3232'; ctx.fillRect(canvas.width - 100, 4, 12, 10); ctx.fillStyle = '#666'; ctx.font = '10px sans-serif'; ctx.textAlign = 'left'; ctx.fillText('Gerado', canvas.width - 84, 13);
      ctx.fillStyle = '#CCFF00'; ctx.fillRect(canvas.width - 100, 18, 12, 10); ctx.fillStyle = '#666'; ctx.fillText('Pago', canvas.width - 84, 27);
    }

    function adminMarcarComissaoPaga(email, valor) {
      if (!confirm('Marcar R$' + valor.toFixed(0) + ' como pago para ' + email + '?')) return;
      var comissoesPagas = _st.comissoesPagas;
      comissoesPagas[email] = (parseFloat(comissoesPagas[email] || 0) + valor);
      _st.comissoesPagas = comissoesPagas;
      if (!isDemo && db) {
        db.collection('configuracoes').doc('comissoes_pagas').set(comissoesPagas, { merge: true })
          .catch(function(e) { console.warn('Erro ao salvar pagamento no Firestore:', e); });
      }
      alert('✅ Pagamento de R$' + valor.toFixed(0) + ' registrado para ' + email);
      carregarAdminComissoes();
    }

    /* ─── RELATÓRIOS ─── */
