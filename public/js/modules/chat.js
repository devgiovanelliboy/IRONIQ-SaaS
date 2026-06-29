// ─── MÓDULO: CHAT ────────────────────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth),
//             utils.js (escHtml), uid-map.js (saveUidMapping)

    // ═══════════════════════════════════════════════
    //  CHAT — SISTEMA DE MENSAGENS
    //  Dados salvos em 'chat_messages' no localStorage
    //  { id, sender, receiver, text, timestamp, read }
    // ═══════════════════════════════════════════════
    var CONTATO_PERSONAL = 'lukas.athademos@gmail.com';
    var CONTATO_ADMIN = 'contato.ironiq@gmail.com';

    function chatGetMsgs() {
      return _st.chatMsgs;
    }
    function chatSetMsgs(msgs) {
      _st.chatMsgs = msgs;
    }
    function chatGetUserInfo() {
      var personalEmail = localStorage.getItem('ironqi_personal_logado');
      if (personalEmail) {
        return { role: 'personal', email: personalEmail, nome: 'Lukas Athademos' };
      }
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return null;
      var usuarios = _st.usuarios;
      var u = usuarios[email];
      var dados = u ? (u.dados || {}) : {};
      var tipo = dados.tipo || ({'aluno_autonomo':'autonomo','aluno_personal':'alunoPersonal','personal':'personal'})[dados.perfil] || 'autonomo';
      var nome = ((dados.nome || '') + ' ' + (dados.sobrenome || '')).trim() || email.split('@')[0];
      var perfilReal = dados.perfil || dados.tipo || '';
      if (perfilReal === 'aluno_personal' && dados.personal_vinculado) {
        return { role: 'aluno_personal', email: email, nome: nome, personalVinculado: dados.personal_vinculado };
      }
      if (tipo === 'autonomo') {
        return { role: 'autonomo', email: email, nome: nome };
      }
      return { role: 'autonomo', email: email, nome: nome };
    }

    function chatCarregar() {
      var info = chatGetUserInfo();
      if (!info) return;
      if (info.role === 'personal') {
        chatPersonalIniciarFirestore(info);
        chatRenderTwoCol(info);
      } else {
        chatRenderFull(info);
      }
    }

    // ─── TWO-COLUMN VIEW (personal) ───
    var chatContatoAtivo = null;
    var _chatPersonalListener = null;

    function chatPersonalIniciarFirestore(info) {
      if (isDemo || !db) return;
      var myEmail = info.email;
      if (_chatPersonalListener) { _chatPersonalListener(); _chatPersonalListener = null; }
      _chatPersonalListener = db.collection('mensagens_chat')
        .where('participants', 'array-contains', myEmail)
        .onSnapshot(function(snap) {
          var all = _st.chatMsgs;
          var existingIds = {};
          all.forEach(function(m) { existingIds[m.id] = true; });
          var mudou = false;
          snap.forEach(function(doc) {
            var d = doc.data();
            var lid = doc.id;
            if (!existingIds[lid]) {
              var ts = d.timestamp && d.timestamp.toDate ? d.timestamp.toDate().toISOString() : (d.timestamp || new Date().toISOString());
              all.push({ id: lid, sender: d.sender, receiver: d.receiver, text: d.text, timestamp: ts, read: d.read || false });
              existingIds[lid] = true;
              mudou = true;
            }
          });
          if (mudou) {
            _st.chatMsgs = all;
            chatRenderTwoCol(info);
          }
        }, function(err) {
          console.warn('[chatPersonal] Firestore listener error:', err.code || err);
        });
    }

    function chatRenderTwoCol(info) {
      document.getElementById('chat-twocol').style.display = 'flex';
      document.getElementById('chat-full').style.display = 'none';
      var isPersonal = info.role === 'personal';
      var myEmail = info.email;
      var msgs = chatGetMsgs();
      var usuarios = _st.usuarios;

      // montar contatos — alunos vinculados ao personal
      var contatos = {};
      if (isPersonal) {
        // alunos vinculados a este personal
        Object.keys(usuarios).forEach(function(uk) {
          var d = usuarios[uk].dados || {};
          // Atendente efetivo: chat_atendente (delegação) ou o personal vinculado.
          // Principal vê autônomos não delegados; interno vê os delegados a ele.
          if ((d.chat_atendente || d.personal_vinculado) === myEmail) {
            if (!contatos[uk]) {
              var conv = msgs.filter(function(m) { return (m.sender === uk && m.receiver === myEmail) || (m.sender === myEmail && m.receiver === uk); });
              var ultima = conv.length ? conv[conv.length - 1] : null;
              var naoLidas = conv.filter(function(m) { return m.receiver === myEmail && !m.read; }).length;
              var nome = ((d.nome || '') + ' ' + (d.sobrenome || '')).trim() || uk.split('@')[0];
              contatos[uk] = { email: uk, nome: nome, ultima: ultima, naoLidas: naoLidas };
            }
          }
        });
        // + contatos que mandaram msg mas não estão vinculados
        msgs.forEach(function(m) {
          var outro = m.sender === myEmail ? m.receiver : m.sender;
          if (outro === CONTATO_ADMIN) return;
          if (!contatos[outro]) {
            var d = usuarios[outro] ? (usuarios[outro].dados || {}) : {};
            var conv = msgs.filter(function(x) { return (x.sender === outro && x.receiver === myEmail) || (x.sender === myEmail && x.receiver === outro); });
            var ultima = conv.length ? conv[conv.length - 1] : null;
            var naoLidas = conv.filter(function(x) { return x.receiver === myEmail && !x.read; }).length;
            var nome = ((d.nome || '') + ' ' + (d.sobrenome || '')).trim() || outro.split('@')[0];
            contatos[outro] = { email: outro, nome: nome, ultima: ultima, naoLidas: naoLidas };
          } else {
            // atualizar naoLidas
            if (m.receiver === myEmail && !m.read && m.sender !== CONTATO_ADMIN) {
              contatos[outro].naoLidas = (contatos[outro].naoLidas || 0) + 1;
            }
          }
        });
      }

      // render contacts list
      var lista = document.getElementById('chat-contacts-list');
      lista.innerHTML = '';
      var chaves = Object.keys(contatos);
      if (!chaves.length) {
        lista.innerHTML = '<div class="chat-empty">Nenhum contato ainda</div>';
        return;
      }
      chaves.sort(function(a, b) {
        var ta = contatos[a].ultima ? new Date(contatos[a].ultima.timestamp).getTime() : 0;
        var tb = contatos[b].ultima ? new Date(contatos[b].ultima.timestamp).getTime() : 0;
        return tb - ta;
      });
      chaves.forEach(function(ck) {
        var c = contatos[ck];
        var item = document.createElement('div');
        item.className = 'chat-contact-item' + (chatContatoAtivo === ck ? ' active' : '');
        item.onclick = function() { chatAbrirContato(ck, info); };
        var avatarHtml = '<div class="chat-contact-avatar">👤</div>';
        var nomeDisplay = c.nome;
        var preview = c.ultima ? c.ultima.text : 'Nenhuma mensagem';
        var timeHtml = c.ultima ? '<div class="chat-contact-time">' + chatFormatTime(c.ultima.timestamp) + '</div>' : '';
        var badgeHtml = c.naoLidas > 0 ? '<div class="chat-contact-badge">' + c.naoLidas + '</div>' : '';
        item.innerHTML = avatarHtml +
          '<div class="chat-contact-info"><div class="chat-contact-name">' + escHtml(nomeDisplay) + '</div><div class="chat-contact-preview">' + escHtml(preview) + '</div></div>' +
          '<div class="chat-contact-meta">' + timeHtml + badgeHtml + '</div>';
        lista.appendChild(item);
      });

      // if there's an active contact, reload its conversation
      if (chatContatoAtivo && contatos[chatContatoAtivo]) {
        chatRenderConversa(info);
      } else {
        document.getElementById('chat-window-title').textContent = 'Selecione um contato';
        document.getElementById('chat-window-body').innerHTML = '<div class="chat-empty">👈 Selecione um aluno para conversar</div>';
        document.getElementById('chat-input-area-2col').style.display = 'none';
        var _ab = document.getElementById('chat-assign-btn'); if (_ab) _ab.style.display = 'none';
      }
    }

    function chatAbrirContato(email, info) {
      chatContatoAtivo = email;
      // mobile: hide contacts, show chat
      var panel = document.getElementById('chat-contacts-panel');
      if (window.innerWidth <= 640) {
        panel.classList.add('mobile-hidden');
      }
      document.getElementById('chat-window-title').textContent = email;
      document.getElementById('chat-input-area-2col').style.display = 'flex';
      chatRenderConversa(info);
      // recarregar lista para atualizar badge
      chatRenderTwoCol(info);
    }

    function chatMobileVoltar() {
      chatContatoAtivo = null;
      var _ab = document.getElementById('chat-assign-btn'); if (_ab) _ab.style.display = 'none';
      document.getElementById('chat-contacts-panel').classList.remove('mobile-hidden');
      document.getElementById('chat-window-title').textContent = 'Selecione um contato';
      document.getElementById('chat-window-body').innerHTML = '<div class="chat-empty">👈 Selecione um aluno para conversar</div>';
      document.getElementById('chat-input-area-2col').style.display = 'none';
    }

    function chatRenderConversa(info) {
      var email = chatContatoAtivo;
      if (!email) return;
      var myEmail = info.email;
      _atualizarBotaoAtribuir(info);
      var msgs = chatGetMsgs();
      // marcar como lidas
      msgs.forEach(function(m) { if (m.receiver === myEmail && m.sender === email) m.read = true; });
      chatSetMsgs(msgs);
      var conversa = msgs.filter(function(m) { return (m.sender === myEmail && m.receiver === email) || (m.sender === email && m.receiver === myEmail); });
      var container = document.getElementById('chat-window-body');
      container.innerHTML = '';
      conversa.forEach(function(m) {
        container.appendChild(chatCriarBolha(m, myEmail));
      });
      container.scrollTop = container.scrollHeight;
    }

    // Mostra o botão "Atendente" só para o Personal Principal quando o contato aberto
    // é um aluno autônomo (vinculado ao Principal). Permite delegar o chat a um interno.
    function _atualizarBotaoAtribuir(info) {
      var btn = document.getElementById('chat-assign-btn');
      if (!btn) return;
      var email = chatContatoAtivo;
      var ehPrincipal = info && info.role === 'personal' && info.email === PERSONAL_PRINCIPAL;
      var mostrar = false;
      if (ehPrincipal && email) {
        var usuarios = _st.usuarios;
        var d = (usuarios[email] && usuarios[email].dados) || {};
        var perfil = d.perfil || d.tipo || '';
        if (d.personal_vinculado === PERSONAL_PRINCIPAL || perfil === 'aluno_autonomo' || perfil === 'autonomo') mostrar = true;
      }
      btn.style.display = mostrar ? '' : 'none';
    }

    // Personal Principal delega (ou devolve) o atendimento de chat de um aluno autônomo.
    function atribuirAtendente(alunoEmail) {
      if (!alunoEmail) return;
      var myEmail = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado');
      if (myEmail !== PERSONAL_PRINCIPAL) { alert('Apenas o Personal Principal pode atribuir o atendimento.'); return; }
      var usuarios = _st.usuarios;
      var atual = (usuarios[alunoEmail] && usuarios[alunoEmail].dados && usuarios[alunoEmail].dados.chat_atendente) || '';
      var alvo = prompt('Atribuir o atendimento de chat de ' + alunoEmail + ' a um Personal Interno.\nDigite o e-mail do interno (vazio = devolver ao Principal):', atual);
      if (alvo === null) return;
      alvo = alvo.trim().toLowerCase();
      var novoValor = alvo || PERSONAL_PRINCIPAL;
      if (!usuarios[alunoEmail]) usuarios[alunoEmail] = { dados: {} };
      if (!usuarios[alunoEmail].dados) usuarios[alunoEmail].dados = {};
      usuarios[alunoEmail].dados.chat_atendente = novoValor;
      _st.usuarios = usuarios;
      var _okMsg = '✅ Atendimento ' + (alvo ? 'atribuído a ' + alvo : 'devolvido ao Principal') + '.';
      if (!isDemo && db) {
        var _save = function(uid) {
          db.collection('usuarios').doc(uid).update({ chat_atendente: novoValor })
            .then(function() { alert(_okMsg); })
            .catch(function(e) { alert('Salvo localmente. Erro no servidor: ' + (e.code || e)); });
        };
        var uid = emailToUid[alunoEmail];
        if (uid) _save(uid);
        else db.collection('uidMap').doc(alunoEmail.replace(/\./g, ',')).get()
          .then(function(m) { if (m.exists) { saveUidMapping(alunoEmail, m.data().uid); _save(m.data().uid); } else { alert('Salvo localmente (uid não encontrado).'); } })
          .catch(function() { alert('Salvo localmente.'); });
      } else {
        alert(_okMsg);
      }
      chatContatoAtivo = null;
      var info = chatGetUserInfo();
      if (info) chatRenderTwoCol(info);
    }

    function chat2ColEnviar() {
      var input = document.getElementById('chat-input-2col');
      var texto = input.value.trim();
      if (!texto || !chatContatoAtivo) return;
      var info = chatGetUserInfo();
      if (!info) return;
      var msgs = chatGetMsgs();
      msgs.push({ id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), sender: info.email, receiver: chatContatoAtivo, text: texto, timestamp: new Date().toISOString(), read: false });
      chatSetMsgs(msgs);
      input.value = '';
      _enviarMensagemFirestore(info.email, chatContatoAtivo, texto);
      chatRenderConversa(info);
      chatRenderTwoCol(info);
    }

    // ─── FULL-SCREEN VIEW (alunos) ───
    var chatFullContato = 'personal';

    function chatRenderFull(info) {
      document.getElementById('chat-full').style.display = 'flex';
      document.getElementById('chat-twocol').style.display = 'none';
      var myEmail = info.email;

      if (info.role === 'aluno_personal') {
        // chat direto com o personal trainer vinculado
        document.getElementById('chat-full-tabs').style.display = 'none';
        chatFullContato = info.personalVinculado;
        document.getElementById('chat-window-title').textContent = 'Personal Trainer';
        chatFullRenderConversa(info);
      } else {
        // autônomo: abas para escolher personal ou admin
        document.getElementById('chat-full-tabs').style.display = 'flex';
        chatFullRenderConversa(info);
      }
    }

    function chatFullAbrir(contato) {
      chatFullContato = contato === 'personal' ? CONTATO_PERSONAL : CONTATO_ADMIN;
      document.getElementById('tab-full-personal').className = contato === 'personal' ? 'active' : '';
      document.getElementById('tab-full-admin').className = contato === 'admin' ? 'active' : '';
      var info = chatGetUserInfo();
      if (info) chatFullRenderConversa(info);
    }

    function chatFullRenderConversa(info) {
      if (!info) return;
      var myEmail = info.email;
      var destino = chatFullContato;
      var msgs = chatGetMsgs();
      // marcar como lidas
      msgs.forEach(function(m) { if (m.receiver === myEmail && m.sender === destino) m.read = true; });
      chatSetMsgs(msgs);
      var conversa = msgs.filter(function(m) { return (m.sender === myEmail && m.receiver === destino) || (m.sender === destino && m.receiver === myEmail); });
      var container = document.getElementById('chat-full-body');
      container.innerHTML = '';
      if (!conversa.length) {
        container.innerHTML = '<div class="chat-empty">Nenhuma mensagem ainda. Envie algo!</div>';
        return;
      }
      conversa.forEach(function(m) {
        container.appendChild(chatCriarBolha(m, myEmail));
      });
      container.scrollTop = container.scrollHeight;
    }

    function chatFullEnviar() {
      var input = document.getElementById('chat-input-full');
      var texto = input.value.trim();
      if (!texto) return;
      var info = chatGetUserInfo();
      if (!info) return;
      var destino = info.role === 'aluno_personal' ? info.personalVinculado : chatFullContato;
      var msgs = chatGetMsgs();
      msgs.push({ id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), sender: info.email, receiver: destino, text: texto, timestamp: new Date().toISOString(), read: false });
      chatSetMsgs(msgs);
      input.value = '';
      _enviarMensagemFirestore(info.email, destino, texto);
      chatFullRenderConversa(info);
    }

    // Grava mensagem no Firestore (real-time + cross-device). Usado pelos envios do personal.
    function _enviarMensagemFirestore(remetente, destinatario, texto) {
      if (isDemo || !db || !destinatario) return;
      db.collection('mensagens_chat').add({
        sender:    remetente,
        receiver:  destinatario,
        text:      texto,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        read:      false,
        conversa:  _chatAlunoConversa(remetente, destinatario),
        participants: [remetente, destinatario]
      }).catch(function(e) { console.warn('[chat] Erro ao enviar no Firestore:', e.code || e); });
    }

    // ─── COMMON ───
    function chatCriarBolha(msg, myEmail) {
      var div = document.createElement('div');
      var isMe = msg.sender === myEmail;
      div.className = 'chat-msg ' + (isMe ? 'sent' : 'received');
      div.textContent = msg.text;
      var meta = document.createElement('div');
      meta.className = 'chat-msg-meta';
      var time = chatFormatTime(msg.timestamp);
      var readIcon = '';
      if (isMe) {
        if (msg.read) {
          readIcon = '<span class="chat-msg-read seen">✓✓</span>';
        } else {
          readIcon = '<span class="chat-msg-read">✓✓</span>';
        }
      }
      meta.innerHTML = time + ' ' + readIcon;
      div.appendChild(meta);
      return div;
    }

    function chatFormatTime(ts) {
      var d = new Date(ts);
      var h = d.getHours().toString().padStart(2, '0');
      var m = d.getMinutes().toString().padStart(2, '0');
      return h + ':' + m;
    }

    // ─── ADMIN MESSAGES (keep for admin panel) ───
    var adminMsgAlunoAtual = null;

    function adminMsgsRenderLista() {
      var msgs = chatGetMsgs();
      var users = {};
      msgs.filter(function(m) { return m.receiver === CONTATO_ADMIN || m.sender === CONTATO_ADMIN; }).forEach(function(m) {
        var outro = m.sender === CONTATO_ADMIN ? m.receiver : m.sender;
        if (!users[outro]) users[outro] = { msgs: [], lidas: 0 };
        users[outro].msgs.push(m);
        if (!m.read && m.receiver === CONTATO_ADMIN) users[outro].lidas++;
      });
      var container = document.getElementById('admin-msgs-lista');
      if (!container) return;
      container.innerHTML = '';
      var chaves = Object.keys(users);
      if (!chaves.length) {
        container.innerHTML = '<div class="chat-empty">Nenhuma conversa ainda.</div>';
        return;
      }
      chaves.forEach(function(email) {
        var u = users[email];
        var ultima = u.msgs[u.msgs.length - 1];
        var card = document.createElement('div');
        card.style.cssText = 'background:#161A1A;border-radius:12px;padding:12px 14px;cursor:pointer;border:1px solid #1F2525;transition:0.2s;';
        card.onmouseenter = function() { card.style.borderColor = '#CCFF00'; };
        card.onmouseleave = function() { card.style.borderColor = '#1F2525'; };
        card.onclick = function() { adminMsgsAbrir(email); };
        card.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;"><strong style="font-size:14px;color:#E8E8E8;">' + email + '</strong>' +
          (u.lidas > 0 ? '<span style="background:#CCFF00;color:#0E1111;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;">' + u.lidas + '</span>' : '') + '</div>' +
          '<div style="font-size:12px;color:#666;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + ultima.text + '</div>' +
          '<div style="font-size:10px;color:#444;margin-top:2px;">' + new Date(ultima.timestamp).toLocaleString('pt-BR') + '</div>';
        container.appendChild(card);
      });
    }

    function adminMsgsAbrir(email) {
      adminMsgAlunoAtual = email;
      document.getElementById('admin-msgs-lista').style.display = 'none';
      document.getElementById('admin-msgs-conversa').style.display = 'flex';
      document.getElementById('admin-msgs-com').textContent = 'Conversando com ' + email;
      adminMsgsRenderConversa();
    }

    function adminMsgsVoltar() {
      adminMsgAlunoAtual = null;
      document.getElementById('admin-msgs-lista').style.display = 'flex';
      document.getElementById('admin-msgs-conversa').style.display = 'none';
      adminMsgsRenderLista();
    }

    function adminMsgsRenderConversa() {
      var email = adminMsgAlunoAtual;
      if (!email) return;
      var msgs = chatGetMsgs();
      msgs.forEach(function(m) { if (m.receiver === CONTATO_ADMIN && m.sender === email) m.read = true; });
      chatSetMsgs(msgs);
      var conversa = msgs.filter(function(m) { return (m.sender === CONTATO_ADMIN && m.receiver === email) || (m.sender === email && m.receiver === CONTATO_ADMIN); });
      var container = document.getElementById('admin-msgs-content');
      container.innerHTML = '';
      conversa.forEach(function(m) {
        container.appendChild(chatCriarBolha(m, CONTATO_ADMIN));
      });
      container.scrollTop = container.scrollHeight;
    }

    function adminMsgsEnviar() {
      var input = document.getElementById('admin-msgs-input');
      var texto = input.value.trim();
      if (!texto || !adminMsgAlunoAtual) return;
      var msgs = chatGetMsgs();
      msgs.push({ id: (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)), sender: CONTATO_ADMIN, receiver: adminMsgAlunoAtual, text: texto, timestamp: new Date().toISOString(), read: false });
      chatSetMsgs(msgs);
      input.value = '';
      adminMsgsRenderConversa();
    }

    // ═══════════════════════════════════════════════
    //  CHAT DO ALUNO — WhatsApp style
    //  Usa Firestore (onSnapshot) com fallback localStorage
    //  Colecão Firestore: mensagens_chat
    //  Estrutura: { sender, receiver, text, timestamp, read, conversa }
    //  conversa = [email1, email2].sort().join('__')
    // ═══════════════════════════════════════════════

    var _chatAlunoListener    = null;
    var _chatAlunoPollInterval = null;
    var _chatAlunoPersonal    = null;
    var _chatAlunoLastCount   = 0;

    function _chatAlunoConversa(e1, e2) {
      return [e1, e2].sort().join('__');
    }

    function chatAlunoAbrir() {
      var meuEmail = localStorage.getItem('ironqi_logado');
      if (!meuEmail) return;

      // Determina o personal responsável pelo aluno
      var usuarios = _st.usuarios;
      var dados = (usuarios[meuEmail] && usuarios[meuEmail].dados) || {};
      // chat_atendente permite ao Personal Principal delegar o atendimento de um
      // aluno autônomo a um Personal Interno. Default: personal_vinculado (Principal).
      var personalEmail = dados.chat_atendente || dados.personal_vinculado || PERSONAL_PRINCIPAL || '';
      _chatAlunoPersonal = personalEmail;

      // Atualiza cabeçalho com nome do personal
      var nomePersonal = 'Personal Trainer';
      if (personalEmail) {
        if (usuarios[personalEmail]) {
          var dp = usuarios[personalEmail].dados || {};
          nomePersonal = ((dp.nome || '') + ' ' + (dp.sobrenome || '')).trim() || personalEmail.split('@')[0];
        } else {
          nomePersonal = personalEmail.split('@')[0];
        }
      }
      var nomeEl = document.getElementById('wachat-nome');
      if (nomeEl) nomeEl.textContent = nomePersonal;

      // Sem personal vinculado: mostra aviso
      var body = document.getElementById('wachat-body');
      if (!personalEmail) {
        if (body) body.innerHTML = '<div class="wachat-personal-nao-vinculado"><div style="font-size:32px;margin-bottom:8px;">🔗</div><p>Você ainda não tem um personal vinculado.<br>Solicite um treino para iniciar a conversa.</p></div>';
        return;
      }

      // Cancela listeners anteriores
      if (_chatAlunoListener) { _chatAlunoListener(); _chatAlunoListener = null; }
      if (_chatAlunoPollInterval) { clearInterval(_chatAlunoPollInterval); _chatAlunoPollInterval = null; }
      _chatAlunoLastCount = 0;

      if (!isDemo && db) {
        chatAlunoIniciarFirestore(meuEmail, personalEmail);
      } else {
        chatAlunoIniciarLocal(meuEmail, personalEmail);
      }
    }

    function chatAlunoIniciarFirestore(meuEmail, personalEmail) {
      var conversa = _chatAlunoConversa(meuEmail, personalEmail);
      // Sem orderBy para evitar índice composto — ordenamos no client
      _chatAlunoListener = db.collection('mensagens_chat')
        .where('participants', 'array-contains', meuEmail)
        .onSnapshot(function(snap) {
          var msgs = [];
          var batch = db.batch();
          var temNaoLida = false;
          snap.forEach(function(doc) {
            var d = doc.data();
            // Filtra só a conversa atual (participants traz todas as do usuário)
            if (d.conversa && d.conversa !== conversa) return;
            msgs.push(Object.assign({ _fsId: doc.id }, d));
            if (d.receiver === meuEmail && !d.read) {
              batch.update(doc.ref, { read: true });
              temNaoLida = true;
            }
          });
          if (temNaoLida) batch.commit().catch(function() {});
          // Ordena por timestamp no client
          msgs.sort(function(a, b) {
            var ta = a.timestamp && a.timestamp.toDate ? a.timestamp.toDate() : new Date(a.timestamp || 0);
            var tb = b.timestamp && b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp || 0);
            return ta - tb;
          });
          chatAlunoRenderMensagens(msgs, meuEmail);
          chatAlunoSincLocalStorage(msgs, meuEmail, personalEmail);
        }, function(err) {
          console.warn('[chatAluno] Firestore indisponível, usando localStorage:', err.code || err);
          chatAlunoIniciarLocal(meuEmail, personalEmail);
        });
    }

    function chatAlunoIniciarLocal(meuEmail, personalEmail) {
      function tick() {
        var all = _st.chatMsgs;
        var msgs = all.filter(function(m) {
          return (m.sender === meuEmail   && m.receiver === personalEmail) ||
                 (m.sender === personalEmail && m.receiver === meuEmail);
        }).sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        // Marca como lidas
        var mudou = false;
        all.forEach(function(m) {
          if (m.receiver === meuEmail && m.sender === personalEmail && !m.read) {
            m.read = true; mudou = true;
          }
        });
        if (mudou) _st.chatMsgs = all;
        if (msgs.length !== _chatAlunoLastCount) {
          _chatAlunoLastCount = msgs.length;
          chatAlunoRenderMensagens(msgs, meuEmail);
        }
      }
      tick();
      _chatAlunoPollInterval = setInterval(tick, 2000);
    }

    function chatAlunoSincLocalStorage(msgs, meuEmail, personalEmail) {
      // Mantém chat_messages em localStorage sincronizado com Firestore
      // para que o personal possa ver as mensagens no painel dele (que usa localStorage)
      try {
        var all = _st.chatMsgs;
        var ids = {};
        all.forEach(function(m) { ids[m.id] = true; });
        var mudou = false;
        msgs.forEach(function(m) {
          var lid = m._fsId || m.id;
          if (!ids[lid]) {
            all.push({ id: lid, sender: m.sender, receiver: m.receiver, text: m.text, timestamp: m.timestamp && m.timestamp.toDate ? m.timestamp.toDate().toISOString() : (m.timestamp || new Date().toISOString()), read: !!m.read });
            mudou = true;
          }
        });
        if (mudou) _st.chatMsgs = all;
      } catch(e) {}
    }

    function chatAlunoRenderMensagens(msgs, meuEmail) {
      var body = document.getElementById('wachat-body');
      if (!body) return;

      if (!msgs.length) {
        body.innerHTML = '<div class="wachat-empty-chat"><div style="font-size:48px;">💬</div><p>Nenhuma mensagem ainda.<br>Diga olá ao seu personal!</p></div>';
        return;
      }

      // Mantém scroll no final se o usuário estiver perto do bottom
      var scrolledBottom = (body.scrollHeight - body.scrollTop - body.clientHeight) < 80;
      body.innerHTML = '';

      var ultimaData = '';
      msgs.forEach(function(m) {
        var ts = m.timestamp;
        var dataStr = '';
        if (ts) {
          var d = ts.toDate ? ts.toDate() : new Date(ts);
          var hoje = new Date();
          var ontem = new Date(); ontem.setDate(ontem.getDate() - 1);
          if (d.toDateString() === hoje.toDateString()) dataStr = 'Hoje';
          else if (d.toDateString() === ontem.toDateString()) dataStr = 'Ontem';
          else dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
        }
        if (dataStr && dataStr !== ultimaData) {
          ultimaData = dataStr;
          var sep = document.createElement('div');
          sep.className = 'wachat-date-sep';
          sep.textContent = dataStr;
          body.appendChild(sep);
        }
        body.appendChild(chatAlunoCriarBolha(m, meuEmail));
      });

      if (scrolledBottom || msgs.length <= 5) body.scrollTop = body.scrollHeight;
    }

    function chatAlunoCriarBolha(msg, meuEmail) {
      var isMe = msg.sender === meuEmail;
      var div  = document.createElement('div');
      div.className = 'wachat-bub ' + (isMe ? 'sent' : 'received');

      var textoEl = document.createElement('div');
      textoEl.textContent = msg.text;
      div.appendChild(textoEl);

      var meta = document.createElement('div');
      meta.className = 'wachat-bub-meta';
      var ts = msg.timestamp;
      var hora = '';
      if (ts) {
        var d2 = ts.toDate ? ts.toDate() : new Date(ts);
        hora = d2.getHours().toString().padStart(2, '0') + ':' + d2.getMinutes().toString().padStart(2, '0');
      }
      var checkHtml = '';
      if (isMe) {
        checkHtml = msg.read
          ? '<span class="wachat-check lida">✓✓</span>'
          : '<span class="wachat-check">✓</span>';
      }
      meta.innerHTML = hora + ' ' + checkHtml;
      div.appendChild(meta);
      return div;
    }

    function chatAlunoEnviar() {
      var input = document.getElementById('wachat-input');
      if (!input) return;
      var texto = input.value.trim();
      if (!texto) return;
      var meuEmail = localStorage.getItem('ironqi_logado');
      if (!meuEmail || !_chatAlunoPersonal) return;

      input.value = '';
      input.focus();

      var agora = new Date().toISOString();
      var newId  = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

      // Sempre salva no localStorage (compatível com painel do personal)
      var all = _st.chatMsgs;
      all.push({ id: newId, sender: meuEmail, receiver: _chatAlunoPersonal, text: texto, timestamp: agora, read: false });
      _st.chatMsgs = all;

      // Salva no Firestore para real-time
      if (!isDemo && db) {
        db.collection('mensagens_chat').add({
          sender:    meuEmail,
          receiver:  _chatAlunoPersonal,
          text:      texto,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          read:      false,
          conversa:  _chatAlunoConversa(meuEmail, _chatAlunoPersonal),
          participants: [meuEmail, _chatAlunoPersonal]
        }).catch(function(e) { console.warn('[chatAluno] Erro ao enviar no Firestore:', e.code || e); });
      } else {
        // Fallback: re-renderiza do localStorage imediatamente
        var msgs = all.filter(function(m) {
          return (m.sender === meuEmail && m.receiver === _chatAlunoPersonal) ||
                 (m.sender === _chatAlunoPersonal && m.receiver === meuEmail);
        }).sort(function(a, b) { return new Date(a.timestamp) - new Date(b.timestamp); });
        _chatAlunoLastCount = msgs.length;
        chatAlunoRenderMensagens(msgs, meuEmail);
      }
    }

