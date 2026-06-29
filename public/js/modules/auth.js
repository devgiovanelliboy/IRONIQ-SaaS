// ─── MÓDULO: AUTH / LOGIN / SIDEBAR ──────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
//             services/firestore.js (setFsUserData, loadUserFromFirebase)
//             services/uid-map.js (saveUidMapping, loadUidMap)
// NOTA: O IIFE de autologin (onAuthStateChanged bootstrap) fica no inline script
//        pois chama navigate() que é declarado no inline script.
    // ─── AUTH ───

    function irParaLogin() {
      navigate('login');
    }

    function atualizarNavVisibilidade(perfil) {
      var navChat = document.getElementById('nav-chat');
      var navPlanos = document.getElementById('nav-planos');
      var navChatSide = document.getElementById('nav-chat-side');
      var navPlanosSide = document.getElementById('nav-planos-side');
      var perfilBtnPlanos = document.getElementById('perfil-btn-planos');
      var ehAluno = perfil && (perfil === 'aluno' || perfil.indexOf('aluno_') === 0);
      var plano = getPlanoUsuario();
      // Chat liberado para: aluno PRO/ELITE, aluno vinculado a personal, personais.
      // START fica sem chat (só treinos e gráficos). NÃO usar early-return por "ehAluno":
      // isso escondia o chat até para o aluno PRO, que deve poder falar com o personal principal.
      var mostrarChat = (
        perfil === 'aluno_personal' ||
        plano === 'aluno_pro' || plano === 'aluno_elite' ||
        (plano && plano.indexOf('personal_') === 0)
      );
      if (navChat) navChat.style.display = mostrarChat ? 'flex' : 'none';
      if (navChatSide) navChatSide.style.display = mostrarChat ? 'flex' : 'none';
      // Planos: ocultos no nav/perfil para alunos (autônomo faz upgrade pelo blocker; vinculado herda do personal)
      var ocultarPlanos = ehAluno || perfil === 'aluno_personal';
      if (navPlanos) navPlanos.style.display = ocultarPlanos ? 'none' : '';
      if (navPlanosSide) navPlanosSide.style.display = ocultarPlanos ? 'none' : '';
      if (perfilBtnPlanos) perfilBtnPlanos.style.display = ocultarPlanos ? 'none' : '';
      // Agenda do personal: só para aluno vinculado a um personal
      var mostrarAgenda = perfil === 'aluno_personal';
      var navAgenda = document.getElementById('nav-agenda');
      var navAgendaSide = document.getElementById('nav-agenda-side');
      if (navAgenda) navAgenda.style.display = mostrarAgenda ? '' : 'none';
      if (navAgendaSide) navAgendaSide.style.display = mostrarAgenda ? 'flex' : 'none';
    }

    // ════════════════════════════════════════════════════════════════
    //  FONTE ÚNICA DE VERDADE DO PAPEL (SESSÃO)
    //  ironqi_logado = email da conta atual (sempre).
    //  ironqi_personal_logado / ironqi_admin_logado = flags de PAPEL, que
    //  SÓ existem se o usuário logado for daquele papel — e sempre com o
    //  MESMO email de ironqi_logado. Mantendo essa invariante, qualquer
    //  leitura (personal||logado OU logado||personal) resolve o mesmo
    //  usuário, eliminando vazamento de papel/identidade entre contas.
    //  Use SEMPRE _definirPapel() para escrever essas flags.
    // ════════════════════════════════════════════════════════════════
    function _ehPapelPersonal(perfil) {
      return perfil === 'personal' || perfil === 'personal_interno' || perfil === 'personal_principal';
    }
    function _definirPapel(email, perfil) {
      if (!email) return;
      localStorage.setItem('ironqi_logado', email);
      if (_ehPapelPersonal(perfil)) localStorage.setItem('ironqi_personal_logado', email);
      else localStorage.removeItem('ironqi_personal_logado');
      if (perfil === 'admin') localStorage.setItem('ironqi_admin_logado', email);
      else localStorage.removeItem('ironqi_admin_logado');
    }
    function _perfilDoCache(email) {
      if (!email) return '';
      try {
        var u = _st.usuarios;
        var d = u[email] ? (u[email].dados || {}) : {};
        return d.perfil || d.tipo || '';
      } catch (e) { return ''; }
    }
    // Invariante de segurança: uma flag de PAPEL só vale se o email dela for
    // EXATAMENTE o de ironqi_logado. Toda escrita legítima usa o mesmo email
    // (ver _definirPapel e os fluxos de login), então uma flag com email
    // DIFERENTE é resto de uma sessão anterior (outra conta) — é o que faz o
    // aluno ver o nav/dados de PERSONAL. Independe do cache de perfil estar
    // populado, então fecha o buraco mesmo no primeiro acesso de um Safari/PWA
    // que já tinha logado um personal antes. Default seguro = ALUNO.
    function _sanearFlagsPapel() {
      var atual = localStorage.getItem('ironqi_logado');
      var p = localStorage.getItem('ironqi_personal_logado');
      var a = localStorage.getItem('ironqi_admin_logado');
      if (!atual) {
        if (p) localStorage.removeItem('ironqi_personal_logado');
        if (a) localStorage.removeItem('ironqi_admin_logado');
        return;
      }
      if (p && p !== atual) localStorage.removeItem('ironqi_personal_logado');
      if (a && a !== atual) localStorage.removeItem('ironqi_admin_logado');
    }
    // Reconcilia as flags de papel a partir do usuário já logado (cache),
    // ANTES de qualquer rota/leitura — fecha o buraco do autologin por cache.
    function _reconciliarSessaoInicial() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var perfil = _perfilDoCache(email);
      if (perfil) _definirPapel(email, perfil);
      // Mesmo sem perfil no cache, remove flags de OUTRA conta (email != logado).
      _sanearFlagsPapel();
    }

    function rotearPorPerfil(perfil, isNovoRegistro) {
      switch (perfil) {
        case 'aluno_autonomo':
        case 'aluno_personal':
          document.getElementById('bottom-nav').classList.add('show');
          document.getElementById('bottom-nav-personal').classList.remove('show');
          document.getElementById('sidebar-nav').classList.add('show');
          document.getElementById('sidebar-nav-personal').classList.remove('show');
          if (isNovoRegistro && perfil === 'aluno_autonomo') {
            mostrarPlanosParaPerfil('aluno');
          } else {
            navigate('dashboard');
          }
          break;
        case 'personal':
          document.getElementById('bottom-nav-personal').classList.add('show');
          document.getElementById('sidebar-nav').classList.remove('show');
          document.getElementById('sidebar-nav-personal').classList.add('show');
          if (isNovoRegistro) {
            mostrarPlanosParaPerfil('personal');
          } else {
            navigate('personal-home');
          }
          break;
        case 'admin':
          document.getElementById('page-login').classList.remove('active');
          document.getElementById('page-login').style.display = 'none';
          document.getElementById('app').classList.remove('auth-layout');
          document.getElementById('app').classList.add('dashboard-layout');
          document.getElementById('page-admin').classList.add('active');
          setTimeout(function() { carregarAdminDashboard(); }, 100);
          break;
        default:
          document.getElementById('bottom-nav').classList.add('show');
          document.getElementById('bottom-nav-personal').classList.remove('show');
          document.getElementById('sidebar-nav').classList.add('show');
          document.getElementById('sidebar-nav-personal').classList.remove('show');
          navigate('dashboard');
      }
      atualizarNavVisibilidade(perfil);
    }

    // isDemo, auth, db, storage, _protocoloListener, IA_PROXY_URL, _iaFetch, Firebase init → js/firebase-init.js

    // PERSONAL_PRINCIPAL, _st, emailToUid → js/state.js

    // loadUidMap(), saveUidMapping() → js/services/uid-map.js

    // Lê configuracoes/sistema para saber quem é o Personal Principal atual
    function carregarPersonalPrincipal() {
      if (isDemo || !db) return;
      db.collection('configuracoes').doc('sistema').get().then(function(doc) {
        if (doc.exists && doc.data().personalPrincipal) {
          PERSONAL_PRINCIPAL = doc.data().personalPrincipal;
          // PERSONAL_PRINCIPAL já atualizado em memória
          console.log('[IRONQI] Personal Principal carregado do Firestore:', PERSONAL_PRINCIPAL);
          // Mantém tipoPersonal do PP em sincronia no localStorage (evita discrepância no admin)
          var _ppUsers = _st.usuarios;
          if (_ppUsers[PERSONAL_PRINCIPAL] && (_ppUsers[PERSONAL_PRINCIPAL].dados || {}).tipoPersonal !== 'personal_principal') {
            if (!_ppUsers[PERSONAL_PRINCIPAL].dados) _ppUsers[PERSONAL_PRINCIPAL].dados = {};
            _ppUsers[PERSONAL_PRINCIPAL].dados.tipoPersonal = 'personal_principal';
            _st.usuarios = _ppUsers;
          }
          // Migração: se o aluno autônomo logado tem personal_vinculado desatualizado, corrige
          var _user = auth && auth.currentUser;
          if (_user && _user.email) {
            var _uEmail = _user.email;
            var _uUsuarios = _st.usuarios;
            var _uDados = (_uUsuarios[_uEmail] && _uUsuarios[_uEmail].dados) || {};
            var _uPerfil = _uDados.perfil || _uDados.tipo || '';
            if ((_uPerfil === 'aluno_autonomo' || _uPerfil === 'autonomo') && _uDados.personal_vinculado !== PERSONAL_PRINCIPAL) {
              console.log('[IRONQI] Corrigindo personal_vinculado de', _uEmail, ':', _uDados.personal_vinculado, '→', PERSONAL_PRINCIPAL);
              _uDados.personal_vinculado = PERSONAL_PRINCIPAL;
              if (!_uUsuarios[_uEmail]) _uUsuarios[_uEmail] = {};
              _uUsuarios[_uEmail].dados = _uDados;
              _st.usuarios = _uUsuarios;
              db.collection('usuarios').doc(_user.uid).update({ personal_vinculado: PERSONAL_PRINCIPAL }).catch(function(e) {
                console.warn('[IRONQI] Erro ao corrigir personal_vinculado no Firestore:', e.code);
              });
            }
          }
        } else {
          console.log('[IRONQI] configuracoes/sistema sem personalPrincipal — usando valor padrão:', PERSONAL_PRINCIPAL);
        }
      }).catch(function() {});
    }

    // Busca o plano do personal vinculado no Firestore e salva em localStorage
    function sincronizarPlanoPersonal(dadosAluno, alunoEmail) {
      if (isDemo || !db) return;
      var perfil = dadosAluno.perfil || dadosAluno.tipo || '';
      if (perfil !== 'aluno_personal' && perfil !== 'alunoPersonal') return;
      var personalEmail = dadosAluno.personal_vinculado;
      if (!personalEmail) return;
      var lookup = function(pUid) {
        db.collection('usuarios').doc(pUid).get().then(function(pDoc) {
          if (pDoc.exists && pDoc.data().plano) {
            _st.planos[personalEmail] = pDoc.data().plano;
          }
        }).catch(function() {});
      };
      var pUid = emailToUid[personalEmail];
      if (pUid) { lookup(pUid); return; }
      db.collection('uidMap').doc(personalEmail.replace(/\./g, ',')).get().then(function(mapDoc) {
        if (mapDoc.exists) { saveUidMapping(personalEmail, mapDoc.data().uid); lookup(mapDoc.data().uid); }
      }).catch(function() {});
    }

    // setFsUserData(), loadUserFromFirebase() → js/services/firestore.js

    // ─── SIDEBAR COLLAPSE (desktop) ───
    function toggleSidebarCollapse() {
      var side = document.getElementById('sidebar-nav');
      var sideP = document.getElementById('sidebar-nav-personal');
      var app = document.getElementById('app');
      var collapsed = side.classList.contains('collapsed');
      if (collapsed) {
        side.classList.remove('collapsed');
        sideP.classList.remove('collapsed');
        app.classList.remove('sidebar-collapsed');
      } else {
        side.classList.add('collapsed');
        sideP.classList.add('collapsed');
        app.classList.add('sidebar-collapsed');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ─── SIDEBAR MOBILE TOGGLE ───
    function toggleSidebarMobile() {
      var side = document.getElementById('sidebar-nav');
      var sideP = document.getElementById('sidebar-nav-personal');
      var backdrop = document.getElementById('sidebar-backdrop');
      var open1 = side.classList.contains('open');
      if (open1) {
        side.classList.remove('open');
        sideP.classList.remove('open');
        backdrop.classList.remove('open');
      } else {
        side.classList.add('open');
        sideP.classList.add('open');
        backdrop.classList.add('open');
      }
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }
    function fecharSidebarMobile() {
      document.getElementById('sidebar-nav').classList.remove('open');
      document.getElementById('sidebar-nav-personal').classList.remove('open');
      document.getElementById('sidebar-backdrop').classList.remove('open');
    }

    // ─── SIDEBAR DYNAMIC UPDATE ───
    function atualizarSidebar() {
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) return;
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var nome = userData.nome || 'Aluno IRONQIA';
      var planos = _st.planos;
      var isPersonal = !!localStorage.getItem('ironqi_personal_logado');
      var plano = isPersonal ? (planos[email] || '') : (getPlanoUsuario() || planos[email] || '');
      var planoNome = 'GRÁTIS';
      if (plano.indexOf('pro') >= 0 || plano.indexOf('elite') >= 0) planoNome = plano.toUpperCase().replace('ALUNO_', '').replace('PERSONAL_', '');
      else if (plano) planoNome = plano.toUpperCase();
      var sideName = document.getElementById('sidebar-user-name');
      if (sideName) sideName.textContent = nome;
      var sideBadge = document.getElementById('sidebar-plan-badge');
      if (sideBadge) sideBadge.textContent = planoNome;
      var sideNameP = document.getElementById('sidebar-user-name-personal');
      if (sideNameP) sideNameP.textContent = nome;
      var sideBadgeP = document.getElementById('sidebar-plan-badge-personal');
      if (sideBadgeP) sideBadgeP.textContent = planoNome;

      // Sidebar avatar foto (fotoUrl vem dos dados do usuário no _st.usuarios)
      var avatarUrl = userData.fotoUrl || userData.avatarUrl || '';
      [['sidebar-avatar-text','sidebar-avatar-img'],['sidebar-avatar-text-personal','sidebar-avatar-img-personal']].forEach(function(ids) {
        var textEl = document.getElementById(ids[0]);
        var imgEl = document.getElementById(ids[1]);
        if (!textEl || !imgEl) return;
        if (avatarUrl) {
          textEl.style.display = 'none';
          imgEl.src = avatarUrl;
          imgEl.style.display = 'block';
        } else {
          textEl.style.display = '';
          imgEl.style.display = 'none';
        }
      });
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ─── LOGIN ───
    function login() {
      const email = document.getElementById('auth-email').value.trim();
      const pass = document.getElementById('auth-pass').value.trim();

      if (!email || !pass) { alert('Preencha todos os campos.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Informe um e-mail válido.'); return; }
      if (pass.length < 6) { alert('A senha deve ter no mínimo 6 caracteres.'); return; }

      _limparEstadoSessao();

      const btn = document.getElementById('auth-btn');
      btn.disabled = true;
      btn.textContent = 'Entrando...';

      autologin = false;

      // Se Firebase Auth está disponível, SEMPRE usa Firebase — nunca demo cache — independente de isDemo
      if (isDemo && !auth) {
        var usuarios = _st.usuarios;
        if (!usuarios[email]) { alert('Usuário não encontrado.'); btn.disabled = false; btn.textContent = 'Entrar'; return; }
        if (usuarios[email].senha !== pass) { alert('Senha incorreta.'); btn.disabled = false; btn.textContent = 'Entrar'; return; }

        localStorage.setItem('ironqi_logado', email);
        var dados = usuarios[email].dados || {};
        var perfil = dados.perfil || dados.tipo || '';

        document.getElementById('page-login').style.display = 'none';
        if (perfil === 'admin') {
          localStorage.setItem('ironqi_admin_logado', email);
          rotearPorPerfil('admin');
        } else if (perfil === 'personal') {
          localStorage.setItem('ironqi_personal_logado', email);
          rotearPorPerfil(perfil);
        } else {
          rotearPorPerfil(perfil);
        }
        atualizarSidebar();
        btn.disabled = false;
        btn.textContent = 'Entrar';
        return;
      }

      auth.signInWithEmailAndPassword(email, pass)
        .then(function(cred) {
          localStorage.setItem('ironqi_logado', email);
          document.getElementById('page-login').style.display = 'none';
          return db.collection('usuarios').doc(cred.user.uid).get().then(function(doc) {
            if (doc.exists) {
              var data = doc.data();
              // Conta bloqueada ou excluída — rejeita login
              if (data.status === 'excluido') {
                auth.signOut();
                localStorage.removeItem('ironqi_logado');
                document.getElementById('page-login').style.removeProperty('display');
                alert('Esta conta foi removida. Para voltar a usar o app, crie um novo cadastro.');
                btn.disabled = false; btn.textContent = 'Entrar';
                return;
              }
              if (data.status === 'bloqueado') {
                auth.signOut();
                localStorage.removeItem('ironqi_logado');
                document.getElementById('page-login').style.removeProperty('display');
                alert('Esta conta está bloqueada. Entre em contato com o suporte.');
                btn.disabled = false; btn.textContent = 'Entrar';
                return;
              }
              // Migração: aluno autônomo sem personal_vinculado → atribui PERSONAL_PRINCIPAL
              if ((data.perfil === 'aluno_autonomo' || data.tipo === 'autonomo') && !data.personal_vinculado) {
                data.personal_vinculado = PERSONAL_PRINCIPAL;
                db.collection('usuarios').doc(cred.user.uid).update({ personal_vinculado: PERSONAL_PRINCIPAL }).catch(function() {});
              }
              // Sincroniza plano do Firestore para localStorage
              if (data.plano) _st.planos[email] = data.plano;
              if (data.planoVencimento) _st.planoVencimento[email] = data.planoVencimento;
              setFsUserData(email, data);
              saveUidMapping(email, cred.user.uid);
              sincronizarPlanoPersonal(data, email);
              carregarPersonalPrincipal();

              var perfil = data.perfil || data.tipo || '';
              document.getElementById('page-login').style.display = 'none';
              if (perfil === 'admin') {
                localStorage.setItem('ironqi_admin_logado', email);
                rotearPorPerfil('admin');
              } else if (perfil === 'personal') {
                localStorage.setItem('ironqi_personal_logado', email);
                rotearPorPerfil(perfil);
              } else {
                rotearPorPerfil(perfil);
              }
              atualizarSidebar();
            } else {
              // Perfil Firestore ausente — tenta recuperar do cache local (pode ter havido falha de write no registro)
              var _cache = _st.usuarios;
              var _dadosCache = _cache[email] ? _cache[email].dados : null;
              if (_dadosCache && _dadosCache.perfil) {
                console.warn('Firestore doc ausente — recriando perfil a partir do cache local');
                db.collection('usuarios').doc(cred.user.uid).set(_dadosCache).catch(function() {});
                saveUidMapping(email, cred.user.uid);
                var _pRecup = _dadosCache.perfil || '';
                if (_pRecup === 'admin') {
                  localStorage.setItem('ironqi_admin_logado', email);
                  rotearPorPerfil('admin');
                } else if (_pRecup === 'personal') {
                  localStorage.setItem('ironqi_personal_logado', email);
                  rotearPorPerfil(_pRecup);
                } else {
                  rotearPorPerfil(_pRecup);
                }
              } else {
                // Sem cache — joga pro dashboard genérico
                document.getElementById('page-login').style.display = 'none';
                navigate('dashboard');
                atualizarNavVisibilidade('');
              }
              atualizarSidebar();
            }
            btn.disabled = false;
            btn.textContent = 'Entrar';
          }).catch(function(e) {
            // Autenticação JÁ deu certo — o erro é só na leitura do doc/rota pós-login
            // (ex.: hiccup transitório do Firestore). NÃO mostrar "sem internet": o
            // usuário está logado. Entra com o que houver em cache e segue.
            console.warn('Pós-login falhou (entrando com cache):', e && (e.code || e.message || e));
            try {
              var _cache = _st.usuarios;
              var _d = _cache[email] ? _cache[email].dados : null;
              var _p = _d ? (_d.perfil || _d.tipo || '') : '';
              document.getElementById('page-login').style.display = 'none';
              if (_p === 'admin') { localStorage.setItem('ironqi_admin_logado', email); rotearPorPerfil('admin'); }
              else if (_p === 'personal') { localStorage.setItem('ironqi_personal_logado', email); rotearPorPerfil('personal'); }
              else if (_p) { rotearPorPerfil(_p); }
              else { navigate('dashboard'); }
              atualizarSidebar();
            } catch (e2) { console.warn('Fallback de rota pós-login falhou:', e2); }
            btn.disabled = false;
            btn.textContent = 'Entrar';
          });
        })
        .catch(function(err) {
          // Fallback para localStorage (demo) SOMENTE se Firebase SDK não estiver disponível
          // Quando auth existe mas a senha está errada, mostra erro — não entra em demo mode
          if (!auth) {
            var usuarios = _st.usuarios;
            if (usuarios[email] && usuarios[email].senha === pass) {
              isDemo = true;
              localStorage.setItem('ironqi_logado', email);
              var dados = usuarios[email].dados || {};
              var perfil = dados.perfil || dados.tipo || '';
              document.getElementById('page-login').style.display = 'none';
              if (perfil === 'admin') {
                localStorage.setItem('ironqi_admin_logado', email);
                rotearPorPerfil('admin');
              } else if (perfil === 'personal') {
                localStorage.setItem('ironqi_personal_logado', email);
                rotearPorPerfil(perfil);
              } else {
                rotearPorPerfil(perfil);
              }
              btn.disabled = false;
              btn.textContent = 'Entrar';
              return;
            }
          }
          btn.disabled = false;
          btn.textContent = 'Entrar';
          if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
            alert('E-mail ou senha inválidos. Se estiver no ambiente local, use ?demo na URL.');
          } else if (err.code === 'auth/invalid-email') {
            alert('E-mail inválido.');
          } else if (err.code === 'auth/too-many-requests') {
            alert('Muitas tentativas. Tente novamente mais tarde.');
          } else {
            alert('Erro ao conectar. Verifique sua internet.');
          }
        });
    }

    // ─── ALTERNAR ENTRE LOGIN E CADASTRO ───
    function exibirCadastro() {
      navigate('cadastro');
      document.getElementById('reg-email').value = document.getElementById('auth-email').value;
      setTimeout(regToggleCampos, 50);
    }
    function exibirLogin() {
      document.getElementById('page-login').style.removeProperty('display');
      navigate('login');
      document.getElementById('auth-btn').disabled = false;
      document.getElementById('auth-btn').textContent = 'Entrar';
      // Limpa os campos para evitar autocomplete errado do gerenciador de senhas do celular
      document.getElementById('auth-email').value = '';
      document.getElementById('auth-pass').value = '';
    }

    function toggleVerSenha(inputId, btnId) {
      var input = document.getElementById(inputId);
      var btn = document.getElementById(btnId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        if (btn) btn.textContent = '🙈';
      } else {
        input.type = 'password';
        if (btn) btn.textContent = '👁';
      }
    }

    // ─── TOGGLE CAMPOS EXTRAS DO CADASTRO ───
    function regToggleCampos() {
      var perfil = document.getElementById('reg-perfil').value;
      var isAluno = (perfil === 'aluno_autonomo' || perfil === 'aluno_personal');
      document.getElementById('reg-campos-aluno').style.display = isAluno ? 'block' : 'none';
      document.getElementById('reg-campo-personal').style.display = (perfil === 'aluno_personal') ? 'block' : 'none';
    }
    document.addEventListener('DOMContentLoaded', function() {
      var sel = document.getElementById('reg-perfil');
      if (sel) sel.addEventListener('change', regToggleCampos);
    });

    function montarDadosRegistro() {
      var nome = document.getElementById('reg-nome').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var perfil = document.getElementById('reg-perfil').value;
      var tipoMap = { 'aluno_autonomo': 'autonomo', 'aluno_personal': 'alunoPersonal', 'personal': 'personal' };
      var dados = { nome: nome, email: email, perfil: perfil, tipo: tipoMap[perfil] || 'autonomo' };

      if (perfil === 'aluno_autonomo' || perfil === 'aluno_personal') {
        var idade = document.getElementById('reg-idade').value.trim();
        var peso = document.getElementById('reg-peso').value.trim();
        var altura = document.getElementById('reg-altura').value.trim();
        var sexo = document.getElementById('reg-sexo').value;
        if (idade) dados.idade = parseInt(idade);
        if (peso) dados.peso = parseFloat(peso);
        if (altura) dados.altura = parseInt(altura);
        if (sexo) dados.sexo = sexo;
        if (perfil === 'aluno_personal') {
          var personalEmail = document.getElementById('reg-personal-email').value.trim();
          if (personalEmail) dados.personal_vinculado = personalEmail;
        }
        if (perfil === 'aluno_autonomo') {
          dados.personal_vinculado = PERSONAL_PRINCIPAL || '';
        }
      }
      return dados;
    }

    // ─── CADASTRO ───
    function register() {
      var nome = document.getElementById('reg-nome').value.trim();
      var email = document.getElementById('reg-email').value.trim();
      var pass = document.getElementById('reg-pass').value.trim();
      var pass2 = document.getElementById('reg-pass2').value.trim();
      var perfil = document.getElementById('reg-perfil').value;

      if (!nome || !email || !pass || !pass2) { alert('Preencha todos os campos.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { alert('Informe um e-mail válido.'); return; }
      if (pass.length < 6) { alert('A senha deve ter no mínimo 6 caracteres.'); return; }
      if (pass !== pass2) { alert('As senhas não conferem.'); return; }

      _limparEstadoSessao();

      // Validação específica por perfil
      if (perfil === 'aluno_personal') {
        var personalEmail = document.getElementById('reg-personal-email').value.trim();
        if (!personalEmail) { alert('Informe o e-mail do Personal Trainer.'); return; }
      }

      var btn = document.getElementById('reg-btn');
      btn.disabled = true;
      btn.textContent = 'Cadastrando...';

      var dados = montarDadosRegistro();

      if (!auth) {
        var usuarios = _st.usuarios;
        if (usuarios[email]) { alert('Este e-mail já está cadastrado.'); btn.disabled = false; btn.textContent = 'Cadastrar'; return; }
        usuarios[email] = {
          senha: pass,
          dados: dados,
          criadoEm: new Date().toISOString()
        };
        _st.usuarios = usuarios;
        localStorage.setItem('ironqi_logado', email);
        if (perfil === 'personal') localStorage.setItem('ironqi_personal_logado', email);
        document.getElementById('page-landing').classList.remove('active');
        document.getElementById('page-cadastro').classList.remove('active');
        rotearPorPerfil(perfil, perfil === 'aluno_autonomo' || perfil === 'personal');
        atualizarSidebar();
        btn.disabled = false;
        btn.textContent = 'Cadastrar';
        return;
      }

      auth.createUserWithEmailAndPassword(email, pass)
        .then(function(cred) {
          var uid = cred.user.uid;
          dados.email = email;
          saveUidMapping(email, uid);

          // Salva localmente ANTES do Firestore — usuário está autenticado independente do Firestore
          localStorage.setItem('ironqi_logado', email);
          setFsUserData(email, dados);
          if (perfil === 'personal') localStorage.setItem('ironqi_personal_logado', email);

          // Firestore write com retry automático — falha aqui não bloqueia o usuário
          var tentarEscreverPerfil = function(tentativa) {
            db.collection('usuarios').doc(uid).set(dados)
              .then(function() {
              })
              .catch(function(fsErr) {
                console.warn('Firestore registro falhou (tentativa ' + tentativa + '):', fsErr.code);
                if (tentativa < 4) setTimeout(function() { tentarEscreverPerfil(tentativa + 1); }, 3000 * tentativa);
              });
          };
          tentarEscreverPerfil(1);

          document.getElementById('page-landing').classList.remove('active');
          document.getElementById('page-cadastro').classList.remove('active');
          rotearPorPerfil(perfil, perfil === 'aluno_autonomo' || perfil === 'personal');
          atualizarSidebar();
          btn.disabled = false;
          btn.textContent = 'Cadastrar';
        })
        .catch(function(err) {
          if (err.code === 'auth/email-already-in-use' && !isDemo && db && auth) {
            // Verifica se é conta excluída — permite re-cadastro com mesmas credenciais
            auth.signInWithEmailAndPassword(email, pass)
              .then(function(cred) {
                return db.collection('usuarios').doc(cred.user.uid).get().then(function(doc) {
                  if (doc.exists && doc.data().status === 'excluido') {
                    dados.email = email;
                    saveUidMapping(email, cred.user.uid);
                    return db.collection('usuarios').doc(cred.user.uid).set(dados).then(function() {
                      localStorage.setItem('ironqi_logado', email);
                      setFsUserData(email, dados);
                      if (perfil === 'personal') localStorage.setItem('ironqi_personal_logado', email);
                      rotearPorPerfil(perfil, perfil === 'aluno_autonomo' || perfil === 'personal');
                      atualizarSidebar();
                      btn.disabled = false; btn.textContent = 'Cadastrar';
                    });
                  } else {
                    auth.signOut();
                    alert('Este e-mail já está cadastrado.');
                    btn.disabled = false; btn.textContent = 'Cadastrar';
                  }
                });
              })
              .catch(function() {
                alert('E-mail já cadastrado.\nSe sua conta foi removida, use o link enviado ao seu e-mail para criar uma nova senha e tente se cadastrar novamente com ela.');
                btn.disabled = false; btn.textContent = 'Cadastrar';
              });
            return;
          }
          alert(tratarErro(err.code));
          btn.disabled = false;
          btn.textContent = 'Cadastrar';
        });
    }

    // tratarErro() → js/utils.js

    // ─── SEED: CRIA CONTAS DEMO SE VAZIO ───
    // Roda sempre (inclusive em modo Firebase) para fallback do login
    (function() {
        var usuarios = _st.usuarios;

        // Conta existente
        if (!usuarios['daniloteste@gmail.com']) {
          usuarios['daniloteste@gmail.com'] = {
            senha: '123456',
            dados: { nome: 'Danilo', sobrenome: 'Teste', email: 'daniloteste@gmail.com', tipoTreino: 'autonomo', perfil: 'aluno_autonomo' },
            criadoEm: new Date().toISOString()
          };
        }

        // Aluno Autônomo — plano START (R$19,90)
        if (!usuarios['aluno_start@teste.com']) {
          usuarios['aluno_start@teste.com'] = {
            senha: '123456',
            dados: { nome: 'Aluno', sobrenome: 'Start', email: 'aluno_start@teste.com', perfil: 'aluno_autonomo', idade: 22, peso: 72, altura: 178, sexo: 'Masculino' },
            criadoEm: new Date().toISOString()
          };
        } else {
          // Garante que o perfil e dados básicos SEMPRE estejam atualizados
          usuarios['aluno_start@teste.com'].dados = usuarios['aluno_start@teste.com'].dados || {};
          usuarios['aluno_start@teste.com'].dados.perfil = 'aluno_autonomo';
        }
        _st.planos['aluno_start@teste.com'] = 'aluno_start';
        _st.usuarios = usuarios;

        // Aluno Autônomo — plano PRO (R$29,90)
        if (!usuarios['aluno_pro@teste.com']) {
          usuarios['aluno_pro@teste.com'] = {
            senha: '123456',
            dados: { nome: 'Aluno', sobrenome: 'Pro', email: 'aluno_pro@teste.com', perfil: 'aluno_autonomo', idade: 28, peso: 80, altura: 182, sexo: 'Masculino' },
            criadoEm: new Date().toISOString()
          };
        }
        _st.planos['aluno_pro@teste.com'] = 'aluno_pro';

        // Personal Trainer
        if (!usuarios['personal@teste.com']) {
          usuarios['personal@teste.com'] = {
            senha: '123456',
            dados: { nome: 'Personal', sobrenome: 'Demo', email: 'personal@teste.com', perfil: 'personal', registro: 'CREF-12345-G' },
            criadoEm: new Date().toISOString()
          };
        }
        _st.planos['personal@teste.com'] = 'personal_pro';

        // Admin
        if (!usuarios['admin@ironqi.com']) {
          usuarios['admin@ironqi.com'] = {
            senha: '123456',
            dados: { nome: 'Admin', sobrenome: 'IRONIQ', email: 'admin@ironqi.com', perfil: 'admin' },
            criadoEm: new Date().toISOString()
          };
        }

        // Aluno Vinculado ao Personal Trainer
        if (!usuarios['aluno_vinculado@teste.com']) {
          usuarios['aluno_vinculado@teste.com'] = {
            senha: '123456',
            dados: { nome: 'Aluno', sobrenome: 'Vinculado', email: 'aluno_vinculado@teste.com', perfil: 'aluno_personal', personal_vinculado: 'personal@teste.com', idade: 26, peso: 75, altura: 176, sexo: 'Masculino' },
            criadoEm: new Date().toISOString()
          };
        }

        // Personal Trainer Lukas Athademos (Revisor Chefe)
        if (!usuarios[REVISOR_EMAIL]) {
          usuarios[REVISOR_EMAIL] = {
            senha: '123456',
            dados: { nome: 'Lukas', sobrenome: 'Athademos', email: REVISOR_EMAIL, perfil: 'personal', registro: 'CREF-98765-G', instagram: '@lukas_athademos', verAlunosAutonomos: true },
            criadoEm: new Date().toISOString()
          };
          _st.planos[REVISOR_EMAIL] = 'personal_pro';
        } else {
          var ld = usuarios[REVISOR_EMAIL].dados;
          if (ld) ld.verAlunosAutonomos = true;
        }

        _st.usuarios = usuarios;
      })();


    // ─── REDEFINIR SENHA ───
    function resetarSenha() {
      var email = prompt('Digite seu e-mail para redefinir a senha:');
      if (!email) return;
      if (isDemo) {
        alert('Modo demo: redefinição de senha não disponível. Configure o Firebase.');
      } else {
        auth.sendPasswordResetEmail(email.trim())
          .then(function() { alert('E-mail de redefinição enviado! Verifique sua caixa de entrada.'); })
          .catch(function(err) { alert(tratarErro(err.code)); });
      }
    }

    // ─── AUTOLOGIN IIFE ──────────────────────────────────────────────────────
    // Executa imediatamente ao carregar auth.js (após todas as declarações de função).
    // Depende de navigate() em router.js (que carrega antes de auth.js).

    var autologin = true;

    (function() {
      var loadingEl = document.getElementById('app-loading');

      // Escape hatch: app.html?reset limpa o estado LOCAL corrompido (cache/flags de
      // papel) sem tocar em NADA no servidor, e recarrega limpo. Resolve devices que
      // ficaram com papel errado no localStorage (no iOS, remover o PWA não limpa isso).
      if (location.search.indexOf('reset') !== -1) {
        try { localStorage.clear(); } catch (e) {}
        location.replace('app.html');
        return;
      }

      // Safety timeout: esconde loading após 5s mesmo que Firebase falhe
      setTimeout(function() {
        if (loadingEl && loadingEl.style.display !== 'none') {
          loadingEl.style.display = 'none';
        }
      }, 5000);

      function _irParaDestino(perfil, email) {
        var ultima = localStorage.getItem('ultima_pagina');
        document.getElementById('page-landing').classList.remove('active');

        // Fonte única de verdade do papel — mantém as flags coerentes com o perfil real.
        _definirPapel(email, perfil);

        if (perfil === 'admin') {
          document.getElementById('page-login').classList.remove('active');
          document.getElementById('page-login').style.display = 'none';
          document.getElementById('app').classList.remove('auth-layout');
          document.getElementById('app').classList.add('dashboard-layout');
          document.getElementById('page-admin').classList.add('active');
          setTimeout(function() {
            if (ultima && ultima.indexOf('admin-') === 0) {
              adminNav(ultima);
            } else {
              carregarAdminDashboard();
            }
          }, 100);
        } else {
          rotearPorPerfil(perfil);
          var _gatePages = ['login', 'landing', 'cadastro', 'planos'];
          if (ultima && _gatePages.indexOf(ultima) === -1 && document.getElementById('page-' + ultima)) {
            setTimeout(function() { navigate(ultima); }, 150);
          }
        }
      }

      // Reconcilia as flags de papel ANTES de qualquer rota/leitura de dados —
      // fecha o buraco do autologin por cache (flag de papel presa de outra sessão).
      _reconciliarSessaoInicial();

      // 1. Tenta restaurar do localStorage primeiro (rápido, funciona em ambos os modos)
      var lsEmail = localStorage.getItem('ironqi_logado');
      if (lsEmail) {
        var usuarios = _st.usuarios;
        if (usuarios[lsEmail]) {
          autologin = false;
          var dados = usuarios[lsEmail].dados || {};
          _irParaDestino(dados.perfil || dados.tipo || '', lsEmail);
          atualizarSidebar();
          if (loadingEl) loadingEl.style.display = 'none';
          // Sincroniza com Firebase em segundo plano se disponível
          if (!isDemo && auth) {
            auth.onAuthStateChanged(function(fbUser) {
              if (!fbUser) return;
              if (fbUser.email !== lsEmail) {
                // O localStorage aponta para OUTRA conta (ex.: login feito por outra
                // porta de entrada, como a landing, que não atualizou ironqi_logado).
                // O Firebase é a fonte da verdade: corrige o cache para o usuário real
                // e recarrega para rotear o perfil certo (evita aluno cair no admin).
                localStorage.setItem('ironqi_logado', fbUser.email);
                localStorage.removeItem('ironqi_admin_logado');
                localStorage.removeItem('ironqi_personal_logado');
                window.location.reload();
                return;
              }
              var uid2 = emailToUid[lsEmail] || fbUser.uid;
              db.collection('usuarios').doc(uid2).get().then(function(doc) {
                if (doc.exists) {
                  var _d = doc.data();
                  setFsUserData(lsEmail, _d);
                  saveUidMapping(lsEmail, uid2);
                  if (_d.plano) _st.planos[lsEmail] = _d.plano;
                  if (_d.ultimoAceiteTreino) _st.ultimoAceite['treino_' + lsEmail] = _d.ultimoAceiteTreino;
                  if (_d.ultimoAceiteDieta) _st.ultimoAceite['dieta_' + lsEmail] = _d.ultimoAceiteDieta;
                  // Firestore é a FONTE DA VERDADE do papel. Se o cache local estava
                  // com o papel errado (ex.: device antigo com um aluno marcado como
                  // personal), corrige as flags e re-roteia para o destino correto.
                  var _pFS = _d.perfil || _d.tipo || '';
                  if (_pFS) {
                    var _antesP = !!localStorage.getItem('ironqi_personal_logado');
                    var _antesA = !!localStorage.getItem('ironqi_admin_logado');
                    _definirPapel(lsEmail, _pFS);
                    var _mudouPapel = (_antesP !== !!localStorage.getItem('ironqi_personal_logado')) ||
                                      (_antesA !== !!localStorage.getItem('ironqi_admin_logado'));
                    if (_mudouPapel) {
                      _irParaDestino(_pFS, lsEmail);
                      atualizarSidebar();
                    }
                  }
                }
              }).catch(function(e) { console.warn('Sync Firebase (auto):', e); });
              // Busca configuração de Trial do Firestore
              db.collection('configuracoes').doc('gerais').get().then(function(cfgDoc) {
                if (cfgDoc.exists && cfgDoc.data().duracaoTrial) {
                  var cfg = _st.trialConfig;
                  cfg.duracao = cfgDoc.data().duracaoTrial;
                  _st.trialConfig = cfg;
                }
              }).catch(function(e) { console.warn('Firestore config fetch error:', e.code || e); });
            });
          }
          return;
        }
      }

      // 2. Fallback: Firebase onAuthStateChanged
      if (!isDemo && auth) {
        if (loadingEl) loadingEl.style.display = 'flex';
        auth.onAuthStateChanged(function(user) {
          if (user) {
            var sideEl = document.getElementById('sidebar-user-name');
            if (sideEl) sideEl.textContent = user.displayName || 'Aluno IRONQIA';
            var sideElP = document.getElementById('sidebar-user-name-personal');
            if (sideElP) sideElP.textContent = user.displayName || 'Aluno IRONQIA';
          } else {
            if (!localStorage.getItem('ironqi_logado') && !localStorage.getItem('ironqi_personal_logado')) {
              var sideEl = document.getElementById('sidebar-user-name');
              if (sideEl) sideEl.textContent = '';
              var sideElP = document.getElementById('sidebar-user-name-personal');
              if (sideElP) sideElP.textContent = '';
            }
          }
          if (user && autologin) {
            autologin = false;
            db.collection('usuarios').doc(user.uid).get().then(function(doc) {
              if (doc.exists) {
                var data = doc.data();
                // Migração: aluno autônomo sem personal_vinculado → atribui PERSONAL_PRINCIPAL
                if ((data.perfil === 'aluno_autonomo' || data.tipo === 'autonomo') && !data.personal_vinculado) {
                  data.personal_vinculado = PERSONAL_PRINCIPAL;
                  db.collection('usuarios').doc(user.uid).update({ personal_vinculado: PERSONAL_PRINCIPAL }).catch(function() {});
                }
                if (data.plano) _st.planos[user.email] = data.plano;
                if (data.ultimoAceiteTreino) _st.ultimoAceite['treino_' + user.email] = data.ultimoAceiteTreino;
                if (data.ultimoAceiteDieta) _st.ultimoAceite['dieta_' + user.email] = data.ultimoAceiteDieta;
                setFsUserData(user.email, data);
                saveUidMapping(user.email, user.uid);
                sincronizarPlanoPersonal(data, user.email);
                carregarPersonalPrincipal();
                _irParaDestino(data.perfil || data.tipo || '', user.email);
                atualizarSidebar();
              } else {
                localStorage.setItem('ironqi_logado', user.email);
                document.getElementById('page-landing').classList.remove('active');
                document.getElementById('bottom-nav').classList.add('show');
                document.getElementById('sidebar-nav').classList.add('show');
                var _ultimaAuth = localStorage.getItem('ultima_pagina') || 'dashboard';
                var _gateAuthPages = ['planos', 'login', 'landing', 'cadastro'];
                if (_gateAuthPages.indexOf(_ultimaAuth) !== -1) _ultimaAuth = 'dashboard';
                navigate(_ultimaAuth);
                atualizarSidebar();
              }
              if (loadingEl) loadingEl.style.display = 'none';
              // Busca configuração de Trial do Firestore
              db.collection('configuracoes').doc('gerais').get().then(function(cfgDoc) {
                if (cfgDoc.exists && cfgDoc.data().duracaoTrial) {
                  var cfg = _st.trialConfig;
                  cfg.duracao = cfgDoc.data().duracaoTrial;
                  _st.trialConfig = cfg;
                }
              }).catch(function(e) { console.warn('Firestore config fetch error:', e.code || e); });
            }).catch(function(e) {
              console.error('Erro ao restaurar sessão:', e);
              if (loadingEl) loadingEl.style.display = 'none';
            });
          } else {
            if (loadingEl) loadingEl.style.display = 'none';
          }
        });
      } else {
        if (loadingEl) loadingEl.style.display = 'none';
      }
    })();