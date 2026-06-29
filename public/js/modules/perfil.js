// ─── MÓDULO: PERFIL / CONTA ───────────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth, storage)
//             services/firestore.js (setFsUserData), utils.js (escHtml)
    function carregarPerfil() {
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) { document.getElementById('perfil-nome').textContent = 'Não logado'; return; }

      var isPersonal = !!localStorage.getItem('ironqi_personal_logado');
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var tipo = userData.tipo || (isPersonal ? 'personal' : 'autonomo');

      var planos = {};
      Object.assign(planos, _st.planos);
      var plano = getPlanoUsuario() || planos[email] || '';
      var planoNome = '';
      if (plano === 'aluno_start') planoNome = 'Aluno START (R$19,90)';
      else if (plano === 'aluno_pro') planoNome = 'Aluno PRO (R$29,90)';
      else if (plano === 'aluno_elite') planoNome = 'Aluno ELITE (R$49,90)';
      else if (plano.indexOf('personal_') === 0) { var pmap = { 'personal_pro':'Personal PRO (R$39,90)','personal_elite':'Personal ELITE (R$79,90)','personal_free':'Personal FREE' }; planoNome = pmap[plano] || plano; }
      else if (plano) planoNome = plano;
      else planoNome = 'Nenhum plano ativo';

      var nome = userData.nome || '';
      if (tipo === 'personal') nome = nome || 'Lukas Athademos';
      var sobrenome = userData.sobrenome || '';
      var nomeCompleto = (nome + ' ' + sobrenome).trim() || email.split('@')[0];

      var avatarSrc = userData.fotoUrl || userData.avatarUrl || 'logo.webp';

      document.getElementById('perfil-left-avatar-img').src = avatarSrc;
      document.getElementById('perfil-left-name').textContent = nomeCompleto;
      document.getElementById('perfil-left-email').textContent = email;

      // Update sidebar avatar too
      var sidImg = document.getElementById('sidebar-avatar-img');
      var sidTxt = document.getElementById('sidebar-avatar-text');
      if (sidImg && sidTxt) {
        if (avatarSrc && avatarSrc !== 'logo.webp') {
          sidTxt.style.display = 'none';
          sidImg.src = avatarSrc;
          sidImg.style.display = 'block';
        } else {
          sidTxt.style.display = '';
          sidImg.style.display = 'none';
        }
      }
      var sidImgP = document.getElementById('sidebar-avatar-img-personal');
      var sidTxtP = document.getElementById('sidebar-avatar-text-personal');
      if (sidImgP && sidTxtP) {
        if (avatarSrc && avatarSrc !== 'logo.webp') {
          sidTxtP.style.display = 'none';
          sidImgP.src = avatarSrc;
          sidImgP.style.display = 'block';
        } else {
          sidTxtP.style.display = '';
          sidImgP.style.display = 'none';
        }
      }

      // Stats (exemplo baseado em dados disponíveis)
      var treinosCount = 0, diasCount = 0, metasCount = 0;
      try { var historico = (_st.historico[email] || []); treinosCount = historico.length; } catch(e) {}
      diasCount = Math.floor((Date.now() - new Date(usuarios[email] && usuarios[email].criadoEm || Date.now()).getTime()) / 86400000) || 1;
      metasCount = Math.floor(treinosCount * 0.7);
      document.getElementById('perfil-stat-treinos').textContent = treinosCount;
      document.getElementById('perfil-stat-dias').textContent = diasCount;
      document.getElementById('perfil-stat-metas').textContent = metasCount;

      // Resumo físico
      var resumoEl = document.getElementById('perfil-resumo');
      if (tipo === 'personal' || isPersonal) {
        var alunos = Object.keys(usuarios).filter(function(k) {
          var d = usuarios[k].dados || {};
          return d.personal_vinculado === email || d.tipo === 'alunoPersonal';
        }).length;
        resumoEl.textContent = 'Personal Trainer · ' + alunos + ' alunos';
        document.getElementById('perfil-about-text').textContent = (userData.sobre || 'Personal Trainer dedicado a transformar vidas através do treino inteligente.');
        document.getElementById('perfil-personal-tabs').style.display = 'flex';
        personalTab('perfil');
        renderKanban(email, usuarios);
        carregarComissoesPersonal();
      } else {
        var peso = userData.peso || '—';
        var altura = userData.altura || (userData.altura_cm || '—');
        var personalEmail = userData.personal_vinculado || '—';
        var idade = userData.idade || (userData.idade_anos || '—');
        var partes = [];
        if (nome) partes.push(nome);
        if (idade !== '—') partes.push(idade + ' anos');
        if (peso !== '—') partes.push(peso + 'kg');
        if (altura !== '—') partes.push(altura + 'cm');
        resumoEl.textContent = partes.join(' · ');
        document.getElementById('perfil-about-text').textContent = (userData.sobre || 'Atleta em busca da melhor versão de si mesmo. Treino, disciplina e evolução!');
      }
      if (tipo !== 'personal' && !isPersonal) {
        document.getElementById('perfil-personal-tabs').style.display = 'none';
        document.getElementById('perfil-kanban').style.display = 'none';
      }

      // Suporte prioritário
      var suporte = document.getElementById('perfil-suporte');
      var planoEfetivo = getPlanoUsuario() || plano;
      if (planoEfetivo === 'aluno_pro' || (planoEfetivo && planoEfetivo.indexOf('personal_') === 0)) {
        suporte.style.display = 'block';
        var config = _st.configGeral;
        var whatsapp = config.whatsapp || '';
        var emailSuporte = config.emailSuporte || '';
        if (whatsapp) {
          document.getElementById('perfil-suporte-texto').textContent = 'Fale conosco via WhatsApp';
          document.getElementById('perfil-suporte-link').href = 'https://wa.me/' + whatsapp;
          document.getElementById('perfil-suporte-link').textContent = '📱 Chamar no WhatsApp';
        } else if (emailSuporte) {
          document.getElementById('perfil-suporte-texto').textContent = 'Fale conosco por e-mail';
          document.getElementById('perfil-suporte-link').href = 'mailto:' + emailSuporte;
          document.getElementById('perfil-suporte-link').textContent = '✉️ Enviar E-mail';
        } else {
          document.getElementById('perfil-suporte-texto').textContent = 'Suporte prioritário disponível 24h';
          document.getElementById('perfil-suporte-link').style.display = 'none';
        }
      } else {
        suporte.style.display = 'none';
      }

      var perfilReal = userData.perfil || userData.tipo || '';
      atualizarNavVisibilidade(perfilReal || 'autonomo');
      if (bioEditando) {
        var ta = document.getElementById('perfil-bio-textarea');
        if (ta) ta.remove();
        document.getElementById('perfil-about-text').style.display = 'block';
        document.getElementById('btn-editar-bio').textContent = '✏️';
        document.getElementById('btn-editar-bio').disabled = false;
        bioEditando = false;
      }
    }

    // ─── FOTO DE PERFIL — UPLOAD ───
    function abrirSeletorFoto() {
      document.getElementById('input-foto-perfil').click();
    }

    function atualizarAvatarNaTela(url, email) {
      // Profile page avatar
      var img = document.getElementById('perfil-left-avatar-img');
      if (img) img.src = url;
      // Sidebar avatar (aluno)
      var sidImg = document.getElementById('sidebar-avatar-img');
      var sidTxt = document.getElementById('sidebar-avatar-text');
      if (sidImg && sidTxt) {
        sidTxt.style.display = 'none';
        sidImg.src = url;
        sidImg.style.display = 'block';
      }
      // Sidebar avatar (personal)
      var sidImgP = document.getElementById('sidebar-avatar-img-personal');
      var sidTxtP = document.getElementById('sidebar-avatar-text-personal');
      if (sidImgP && sidTxtP) {
        sidTxtP.style.display = 'none';
        sidImgP.src = url;
        sidImgP.style.display = 'block';
      }
      var usuarios = _st.usuarios;
      if (!usuarios[email]) usuarios[email] = { senha: '', dados: {} };
      usuarios[email].dados.fotoUrl = url;
      _st.usuarios = usuarios;
    }

    function uploadFotoPerfil(event) {
      var file = event.target.files[0];
      if (!file) return;

      if (file.size > 5 * 1024 * 1024) {
        alert('Arquivo muito grande. Máximo 5MB.');
        event.target.value = '';
        return;
      }

      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) { event.target.value = ''; return; }

      // Visual feedback
      document.getElementById('perfil-left-avatar-img').style.opacity = '0.4';
      document.querySelector('.perfil-avatar-overlay i').className = '';

      try {
        if (!isDemo && storage && auth && auth.currentUser) {
          var uid = auth.currentUser.uid;
          var ext = (file.name || 'foto.jpg').split('.').pop() || 'jpg';
          var fileName = 'perfil_' + Date.now() + '.' + ext;
          storage.ref('perfil_imagens/' + uid + '/' + fileName).put(file).then(function(snapshot) {
            return snapshot.ref.getDownloadURL();
          }).then(function(url) {
            atualizarAvatarNaTela(url, email);
            document.getElementById('perfil-left-avatar-img').style.opacity = '1';
            if (db) db.collection('usuarios').doc(uid).set({ fotoUrl: url }, { merge: true }).catch(function() {});
            if (auth.currentUser) auth.currentUser.updateProfile({ photoURL: url }).catch(function() {});
          }).catch(function(err) {
            console.warn('Storage error, fallback base64:', err);
            fallbackBase64(file, email);
          });
        } else {
          fallbackBase64(file, email);
        }
      } catch(e) {
        console.error('upload error:', e);
        fallbackBase64(file, email);
      }
      event.target.value = '';
    }

    function fallbackBase64(file, email) {
      var reader = new FileReader();
      reader.onload = function(e) {
        var dataUrl = e.target.result;
        document.getElementById('perfil-left-avatar-img').style.opacity = '1';
        atualizarAvatarNaTela(dataUrl, email);
      };
      reader.readAsDataURL(file);
    }

    // ─── BIO (SOBRE MIM) ───
    var bioEditando = false;
    function editarBio() {
      var btn = document.getElementById('btn-editar-bio');
      var texto = document.getElementById('perfil-about-text');
      var container = texto.parentNode;
      if (!bioEditando) {
        var atual = texto.textContent;
        var ta = document.createElement('textarea');
        ta.className = 'perfil-bio-textarea';
        ta.id = 'perfil-bio-textarea';
        ta.value = atual;
        texto.style.display = 'none';
        container.insertBefore(ta, texto.nextSibling);
        btn.textContent = '💾';
        bioEditando = true;
        ta.focus();
      } else {
        var ta = document.getElementById('perfil-bio-textarea');
        var novoTexto = ta.value.trim();
        if (!novoTexto) { alert('A bio não pode ficar vazia.'); return; }
        btn.textContent = '⏳';
        btn.disabled = true;
        var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
        if (!email) return;
        var usuarios = _st.usuarios;
        if (!usuarios[email]) usuarios[email] = { senha: '', dados: {} };
        usuarios[email].dados.sobre = novoTexto;
        setFsUserData(email, usuarios[email].dados);
        texto.textContent = novoTexto;
        texto.style.display = 'block';
        ta.remove();
        btn.textContent = '✏️';
        btn.disabled = false;
        bioEditando = false;
      }
    }

    // ─── MODAL EDITAR CADASTRO ───
    function abrirModalEditar() {
      var overlay = document.getElementById('modal-editar-perfil');
      var body = document.getElementById('modal-editar-perfil-body');
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) { overlay.style.display = 'none'; return; }
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var tipo = userData.tipo || (localStorage.getItem('ironqi_personal_logado') ? 'personal' : 'autonomo');

      var html = '';
      if (tipo === 'personal') {
        html += '<div class="bloco"><label>Nome</label><input id="modal-edit-nome" value="' + escHtml(userData.nome || '') + '"></div>';
        html += '<div class="bloco"><label>Registro / CREF</label><input id="modal-edit-registro" value="' + escHtml(userData.registro || '') + '"></div>';
      } else {
        html +=
          '<div class="modal-edit-grid">' +
            '<div class="bloco"><label>Nome</label><input id="modal-edit-nome" value="' + escHtml(userData.nome || '') + '"></div>' +
            '<div class="bloco"><label>Sobrenome</label><input id="modal-edit-sobrenome" value="' + escHtml(userData.sobrenome || '') + '"></div>' +
            '<div class="bloco"><label>Peso (kg)</label><input id="modal-edit-peso" type="number" step="0.1" value="' + escHtml(userData.peso || '') + '"></div>' +
            '<div class="bloco"><label>Altura (cm)</label><input id="modal-edit-altura" type="number" value="' + escHtml(userData.altura || userData.altura_cm || '') + '"></div>' +
            '<div class="bloco modal-edit-full"><label>E-mail</label><input id="modal-edit-email" type="text" value="' + escHtml(email) + '"></div>' +
            '<div class="bloco modal-edit-full"><label>Nova Senha</label><input id="modal-edit-senha" type="password" placeholder="Digite para alterar ou deixe em branco"></div>' +
          '</div>';
      }
      body.innerHTML = html;
      overlay.style.display = 'flex';
    }

    function fecharModalEditarPerfil() {
      document.getElementById('modal-editar-perfil').style.display = 'none';
      document.getElementById('btn-salvar-perfil').textContent = '💾 Salvar Alterações';
      document.getElementById('btn-salvar-perfil').disabled = false;
      var toast = document.getElementById('modal-editar-perfil-toast');
      toast.style.display = 'none';
      var senhaInput = document.getElementById('modal-edit-senha');
      if (senhaInput) senhaInput.value = '';
    }

    function salvarEdicaoPerfil() {
      var btn = document.getElementById('btn-salvar-perfil');
      btn.textContent = 'Salvando...';
      btn.disabled = true;

      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) { btn.textContent = '💾 Salvar Alterações'; btn.disabled = false; return; }
      var usuarios = _st.usuarios;
      if (!usuarios[email]) usuarios[email] = { senha: '', dados: {} };
      var d = usuarios[email].dados || {};
      var tipo = d.tipo || (localStorage.getItem('ironqi_personal_logado') ? 'personal' : 'autonomo');

      var promises = [];

      try {
        if (tipo === 'personal') {
          d.nome = document.getElementById('modal-edit-nome').value.trim();
          d.registro = document.getElementById('modal-edit-registro').value.trim();
        } else {
          d.nome = document.getElementById('modal-edit-nome').value.trim();
          d.sobrenome = document.getElementById('modal-edit-sobrenome').value.trim();
          var pesoVal = parseFloat(document.getElementById('modal-edit-peso').value);
          if (!isNaN(pesoVal)) d.peso = pesoVal;
          var alturaVal = parseInt(document.getElementById('modal-edit-altura').value);
          if (!isNaN(alturaVal)) d.altura = alturaVal;

          var novoEmail = document.getElementById('modal-edit-email').value.trim();
          var novaSenha = document.getElementById('modal-edit-senha').value;

          // If Firebase Auth is available, run email/password updates
          if (!isDemo && auth && auth.currentUser) {
            var user = auth.currentUser;
            if (novoEmail && novoEmail !== email) {
              promises.push(user.updateEmail(novoEmail).then(function() {
                var oldEmail = email;
                var newEmail = novoEmail;
                // Re-key localStorage data to new email
                var usuarios = _st.usuarios;
                if (usuarios[oldEmail]) {
                  usuarios[newEmail] = usuarios[oldEmail];
                  delete usuarios[oldEmail];
                  _st.usuarios = usuarios;
                }
                localStorage.setItem('ironqi_logado', newEmail);
                localStorage.removeItem('ironqi_personal_logado');
                email = newEmail;
                // update uid mapping
                var uid = emailToUid[oldEmail];
                if (uid) {
                  emailToUid[newEmail] = uid;
                  delete emailToUid[oldEmail];
                  
                }
              }));
            }
            if (novaSenha && novaSenha.length >= 6) {
              promises.push(user.updatePassword(novaSenha));
            }
          }
        }

        // Update Firestore doc
        if (!isDemo && db) {
          var uid = emailToUid[email] || (auth && auth.currentUser ? auth.currentUser.uid : null);
          if (uid) {
            promises.push(db.collection('usuarios').doc(uid).update({
              nome: d.nome || '',
              sobrenome: d.sobrenome || '',
              peso: d.peso || null,
              altura: d.altura || null
            }).catch(function(e) { console.warn('Firestore update error:', e); }));
          }
        }

        Promise.all(promises).then(function() {
          usuarios[email].dados = d;
          _st.usuarios = usuarios;
          mostrarToastPerfil('✅ Dados salvos com sucesso!');
          setTimeout(function() {
            fecharModalEditarPerfil();
            carregarPerfil();
          }, 800);
        }).catch(function(err) {
          console.error('Erro ao salvar:', err);
          if (err.code === 'auth/requires-recent-login') {
            alert('Por segurança, faça login novamente antes de alterar seus dados de acesso.');
          } else {
            mostrarToastPerfil('❌ Erro ao salvar. Tente novamente.');
          }
          btn.textContent = '💾 Salvar Alterações';
          btn.disabled = false;
        });
      } catch (e) {
        console.error('Erro ao salvar cadastro:', e);
        btn.textContent = '💾 Salvar Alterações';
        btn.disabled = false;
        mostrarToastPerfil('❌ Erro ao salvar. Tente novamente.');
      }
    }

    function mostrarToastPerfil(msg) {
      var toast = document.getElementById('modal-editar-perfil-toast');
      toast.textContent = msg;
      toast.style.display = 'block';
    }

    // escHtml() → js/utils.js

    function _limparEstadoSessao() {
      // Cancela listener do Firestore — evita que callbacks de sessão anterior
      // sejam chamados com o localStorage já apontando para o novo usuário
      if (_protocoloListener) { _protocoloListener(); _protocoloListener = null; }

      // Globals do fluxo do aluno
      _waitingProtocoloId = null;
      _waitingTipo = null;
      _aceitePendente = { treino: null, dieta: null };
      currentReviewId = null;
      workoutData = null;
      _pendingEhAjuste = false;

      // Globals do fluxo do personal
      _modalAprovacaoId = null;

      // Chaves de sessão sem escopo de email — podem vazar entre contas
      localStorage.removeItem('ironqi_evolucao_aluno');
      localStorage.removeItem('ironqi_dieta_texto');
      localStorage.removeItem('ironqi_protocolo');
      localStorage.removeItem('ironqi_protocolo_aluno');
      // Reseta todo o estado em memória — os dados serão recarregados do Firestore
      // após o próximo login, garantindo que nenhum dado de uma conta vaze para outra.
      _st.usuarios = {};
      _st.pendentes = [];
      _st.protocolos = [];
      _st.comissoes = [];
      _st.comissoesPagas = {};
      _st.planos = {};
      _st.planoVencimento = {};
      _st.trialExpira = {};
      _st.trialConfig = { ativo: true, duracao: 48, mensagem: 'Teste grátis de 48h — aproveite todos os recursos!' };
      _st.ultimoAceite = {};
      _st.ultimoAjuste = {};
      _st.agua = {};
      _st.imcHistorico = {};
      _st.historico = {};
      _st.notificacoes = [];
      _st.adminPlanosConfig = {};
      _st.cupons = [];
      _st.configGeral = {};
      _st.personalLimites = {};
      _st.personalData = {};
      _st.userStatus = {};
      _st.chatMsgs = [];
      _st.agendaSlots = [];
      _st.agendaCheckins = [];

      // Flags de PAPEL — decidem se o app mostra a tela de admin/personal.
      // Se não forem limpas aqui, vazam entre contas no mesmo dispositivo:
      // um aluno logando após um admin/personal (sem logout limpo) cairia na
      // tela errada. O login re-seta a flag correta logo depois, conforme o perfil.
      localStorage.removeItem('ironqi_admin_logado');
      localStorage.removeItem('ironqi_personal_logado');

      // Destrói instâncias de Chart.js para evitar estado visual stale
      if (window.evolucaoChart) { window.evolucaoChart.destroy(); window.evolucaoChart = null; }
      if (window.imcEvolucaoChart) { window.imcEvolucaoChart.destroy(); window.imcEvolucaoChart = null; }

      // Cancela chat do aluno
      if (typeof _chatAlunoListener !== 'undefined' && _chatAlunoListener) { _chatAlunoListener(); _chatAlunoListener = null; }
      if (typeof _chatAlunoPollInterval !== 'undefined' && _chatAlunoPollInterval) { clearInterval(_chatAlunoPollInterval); _chatAlunoPollInterval = null; }
      if (typeof _chatAlunoPersonal !== 'undefined') { _chatAlunoPersonal = null; }
      // Cancela chat do personal
      if (typeof _chatPersonalListener !== 'undefined' && _chatPersonalListener) { _chatPersonalListener(); _chatPersonalListener = null; }
      if (typeof _chatAlunoLastCount !== 'undefined') { _chatAlunoLastCount = 0; }
    }

    function sair() {
      if (!confirm('Deseja realmente sair?')) return;
      _limparEstadoSessao();
      // Reseta DOM dos containers principais para evitar lixo visual ao trocar de conta
      var wc = document.getElementById('workout-container');
      var ew = document.getElementById('empty-workout');
      var dc = document.getElementById('dieta-aprovada-container');
      var ed = document.getElementById('empty-dieta');
      var ec = document.getElementById('evolucao-content');
      if (wc) wc.style.display = 'none';
      if (ew) ew.style.display = 'flex';
      if (dc) dc.style.display = 'none';
      if (ed) ed.style.display = 'flex';
      if (ec) ec.innerHTML = '';
      localStorage.removeItem('ultima_pagina');
      localStorage.removeItem('ironqi_logado');
      localStorage.removeItem('ironqi_personal_logado');
      localStorage.removeItem('ironqi_admin_logado');
      if (auth) { auth.signOut(); }
      isDemo = false; // garante que próximo login vai ao Firebase, não ao cache local
      // Limpa campos do formulário de login para evitar autocomplete cruzado entre contas
      var eEl = document.getElementById('auth-email');
      var pEl = document.getElementById('auth-pass');
      if (eEl) eEl.value = '';
      if (pEl) pEl.value = '';
      navigate('landing');
    }