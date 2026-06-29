// ─── MÓDULO: PLANOS / ASSINATURA ─────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
    // ─── PLANOS / ASSINATURA ───
    function inicializarPlanos() {
      // Torna o CARD inteiro clicável (não só o botão). No mobile o botão fica
      // abaixo da dobra / atrás do menu inferior, e o usuário toca no card → nada
      // acontecia. Delegação: clicar em qualquer parte do card aciona o botão dele.
      if (!window._planosClickWired) {
        window._planosClickWired = true;
        var _pp = document.getElementById('page-planos');
        if (_pp) _pp.addEventListener('click', function(e) {
          if (e.target.closest('button') || e.target.closest('a')) return;
          var card = e.target.closest('.plan-card');
          if (!card) return;
          var b = card.querySelector('button[onclick]');
          if (b) b.click();
        });
      }
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email) return;
      var usuarios = _st.usuarios;
      var userData = usuarios[email] ? (usuarios[email].dados || {}) : {};
      var perfil = userData.perfil || userData.tipo || '';
      var isPersonal = !!localStorage.getItem('ironqi_personal_logado');
      if (isPersonal) perfil = 'personal';

      var tabs = document.getElementById('planos-categorias');
      var planosAluno = document.getElementById('planos-aluno');
      var planosPersonal = document.getElementById('planos-personal');

      // Esconde todos primeiro
      planosAluno.style.display = 'none';
      planosPersonal.style.display = 'none';
      tabs.style.display = 'flex';

      if (perfil === 'aluno_personal') {
        tabs.style.display = 'none';
        var herdado = getPlanoUsuario();
        var nomePlano = planoNomes[herdado] || herdado || 'PRO';
        planosAluno.innerHTML = '<div class="personal-empty"><div class="icon-big">🔗</div><h3>Plano vinculado ao Personal</h3><p>Seu plano é definido pelo Personal Trainer que você está vinculado. Você está herdando o plano <strong style="color:#CCFF00;">' + nomePlano + '</strong> automaticamente.</p></div>';
        planosAluno.style.display = 'flex';
      } else if (perfil === 'aluno_autonomo' || perfil.indexOf('aluno_') === 0) {
        tabs.style.display = 'none';
        planosAluno.style.display = 'flex';
        selecionarCategoriaPlano('aluno');
        var _trialDiv = document.getElementById('planos-trial-aluno');
        if (_trialDiv) _trialDiv.style.display = trialExpirado(email) || !_st.planos[email] ? '' : 'none';
      } else if (perfil === 'personal' || perfil.indexOf('personal_') === 0) {
        tabs.style.display = 'none';
        planosPersonal.style.display = 'flex';
        selecionarCategoriaPlano('personal');
      } else {
        perfil = _st.planos[email] || '';
        if (perfil.indexOf('personal_') === 0) {
          perfil = 'personal';
        } else if (perfil.indexOf('aluno_') === 0) {
          perfil = 'aluno_autonomo';
        }
        if (perfil === 'personal') {
          tabs.style.display = 'none';
          planosPersonal.style.display = 'flex';
          selecionarCategoriaPlano('personal');
        } else if (perfil === 'aluno_autonomo') {
          tabs.style.display = 'none';
          planosAluno.style.display = 'flex';
          selecionarCategoriaPlano('aluno');
        }
      }
    }

    var planoNomes = {
      'aluno_start': 'Aluno START (R$19,90)',
      'aluno_pro': 'Aluno PRO (R$29,90)',
      'aluno_elite': 'Aluno ELITE (R$49,90)',
      'personal_free': 'Personal FREE',
      'personal_pro': 'Personal PRO (R$39,90)',
      'personal_elite': 'Personal ELITE (R$79,90)'
    };

    function assinarPlano(tipo) {
      var email = localStorage.getItem('ironqi_logado') || localStorage.getItem('ironqi_personal_logado');
      if (!email && auth && auth.currentUser) email = auth.currentUser.email;
      if (!email) { alert('Faça login primeiro.'); return; }
      var nome = planoNomes[tipo] || tipo;
      _st.planos[email] = tipo;
      // Define vencimento da assinatura (30 dias) — planos grátis não vencem
      var _vence = (tipo === 'personal_free') ? '' : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      if (_vence) _st.planoVencimento[email] = _vence;
      else delete _st.planoVencimento[email];
      // Persiste no Firestore para sync cross-device
      if (!isDemo && db) {
        var _pUid = (auth && auth.currentUser) ? auth.currentUser.uid : emailToUid[email];
        if (_pUid) db.collection('usuarios').doc(_pUid).update({ plano: tipo, planoVencimento: _vence || null }).catch(function(e) { console.warn('Firestore plano update error:', e); });
      }
      alert('✅ Assinatura ' + nome + ' ativada com sucesso!');
      var usuarios = _st.usuarios;
      var user = usuarios[email];
      var dados = user && user.dados ? user.dados : {};
      var perfil = dados.perfil || dados.tipo || (tipo.indexOf('personal_') === 0 ? 'personal' : '');
      if (perfil === 'personal') { navigate('personal-home'); }
      else { navigate('dashboard'); }
    }

    // Exibe page-planos filtrando apenas a categoria do perfil do usuário
    function mostrarPlanosParaPerfil(cat) {
      navigate('planos');
      selecionarCategoriaPlano(cat);
      // Oculta tabs das outras categorias
      document.querySelectorAll('#planos-categorias .day-tab').forEach(function(btn) {
        btn.style.display = btn.getAttribute('data-cat') === cat ? '' : 'none';
      });
      // Mostra botão trial só para aluno_autonomo
      var trialDiv = document.getElementById('planos-trial-aluno');
      if (trialDiv) trialDiv.style.display = cat === 'aluno' ? '' : 'none';
    }

    function ativarTrial() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var expira = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      _st.planos[email] = 'trial';
      _st.trialExpira[email] = expira;
      if (!isDemo && db && auth && auth.currentUser) {
        db.collection('usuarios').doc(auth.currentUser.uid).update({
          plano: 'trial',
          trialExpira: expira
        }).catch(function(e) { console.warn('Firestore trial error:', e); });
      }
      var usuarios = _st.usuarios;
      var perfil = (usuarios[email] && usuarios[email].dados && usuarios[email].dados.perfil) || 'aluno_autonomo';
      navigate('dashboard');
      atualizarSidebar();
    }

    function trialExpirado(email) {
      if (!email) return false;
      if (_st.planos[email] !== 'trial') return false;
      var expira = _st.trialExpira[email];
      return !expira || new Date() > new Date(expira);
    }

    // Vencimento de planos pagos (assinaturas mensais). Planos grátis/trial não vencem aqui.
    function planoVencido(email) {
      if (!email) return false;
      var plano = _st.planos[email] || '';
      if (!plano || plano === 'trial' || plano === 'personal_free') return false;
      var vence = _st.planoVencimento[email];
      if (!vence) return false; // sem data registrada (assinatura legada) → não bloqueia
      return new Date() > new Date(vence);
    }

    // Chamada no início do dashboard para bloquear acesso se necessário
    function verificarAcessoPlano() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return false;
      var plano = _st.planos[email] || '';
      var usuarios = _st.usuarios;
      var perfil = (usuarios[email] && usuarios[email].dados && usuarios[email].dados.perfil) || '';

      // aluno_personal herda plano do personal — não bloqueia aqui
      if (perfil === 'aluno_personal' || perfil === 'alunoPersonal') return false;
      // personal e admin: verificar se tem plano
      if (perfil === 'personal') {
        // Sem plano definido = tier FREE (válido, "Até 2 alunos"). Não bloqueia o acesso.
        // Só bloqueia se um plano PAGO (personal_pro/elite) tiver vencido.
        if (planoVencido(email)) {
          var avisoP = document.getElementById('planos-aviso-trial');
          if (avisoP) { avisoP.style.display = ''; avisoP.textContent = '⏰ Sua assinatura venceu. Renove o plano para continuar.'; }
          mostrarPlanosParaPerfil('personal');
          return true;
        }
        return false;
      }
      // aluno_autonomo
      if (perfil === 'aluno_autonomo') {
        if (!plano) {
          mostrarPlanosParaPerfil('aluno');
          return true;
        }
        if (trialExpirado(email)) {
          var aviso = document.getElementById('planos-aviso-trial');
          if (aviso) { aviso.style.display = ''; aviso.textContent = '⏰ Seu trial expirou. Assine um plano para continuar acessando.'; }
          mostrarPlanosParaPerfil('aluno');
          return true;
        }
        if (planoVencido(email)) {
          var avisoA = document.getElementById('planos-aviso-trial');
          if (avisoA) { avisoA.style.display = ''; avisoA.textContent = '⏰ Sua assinatura venceu. Renove o plano para continuar.'; }
          mostrarPlanosParaPerfil('aluno');
          return true;
        }
      }
      return false;
    }

    function selecionarCategoriaPlano(cat) {
      document.querySelectorAll('#planos-categorias .day-tab').forEach(function(b) {
        b.classList.toggle('active', b.getAttribute('data-cat') === cat);
      });
      document.querySelectorAll('.planos-categoria').forEach(function(el) {
        el.style.display = el.id === 'planos-' + cat ? 'flex' : 'none';
      });
    }

    function getPlanoUsuario() {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return null;
      var usuarios = _st.usuarios;
      var user = usuarios[email];
      var dados = user && user.dados ? user.dados : {};
      var perfil = dados.perfil || dados.tipo || '';

      // REGRA 1: SOMENTE aluno_personal herda o plano do personal vinculado
      // (aluno_autonomo tem plano próprio, não herda o plano do Lukas)
      if (perfil === 'aluno_personal' || perfil === 'alunoPersonal') {
        var personalEmail = dados.personal_vinculado || PERSONAL_PRINCIPAL;
        var personalPlan = _st.planos[personalEmail];
        // Tenta o cache local do usuário do personal (populado pelo sincronizarPlanoPersonal)
        if (!personalPlan) {
          var pUser = usuarios[personalEmail];
          if (pUser && pUser.dados && pUser.dados.plano) {
            personalPlan = pUser.dados.plano;
            _st.planos[personalEmail] = personalPlan;
          }
        }
        if (personalPlan === 'personal_elite') return 'aluno_elite';
        if (personalPlan === 'personal_pro') return 'aluno_pro';
        if (personalPlan === 'personal_free') return 'aluno_start';
        return 'aluno_start';
      }

      // Demais perfis: verifica plano próprio (também lê campo 'plano' sincronizado do Firestore)
      var plano = _st.planos[email] || dados.plano || null;
      if (plano) {
        if (!_st.planos[email]) _st.planos[email] = plano;
        return plano;
      }
      // Fallback: aluno sem plano ganha START automaticamente
      if (perfil.indexOf('aluno_') === 0 || perfil === 'autonomo') {
        _st.planos[email] = 'aluno_start';
        return 'aluno_start';
      }
      return null;
    }

    function temAcessoPRO() {
      var email = localStorage.getItem('ironqi_logado');
      var plano = getPlanoUsuario();
      if (!plano) return false;
      if (plano === 'aluno_pro' || plano === 'aluno_elite' || plano === 'pro') return true;
      if (plano === 'personal_free') return false;
      // Planos personal também têm acesso
      if (plano.indexOf('personal_') === 0) return true;
      return false;
    }

    function temAcessoStart() {
      var plano = getPlanoUsuario();
      if (!plano) return false;
      return true; // qualquer plano ativo já libera o básico
    }

    function abrirDieta() {
      document.getElementById('modal-form').classList.remove('show');
      navigate('dieta');
    }

    // ─── LIMITES DE CICLO POR PLANO ───
    // START: 1 treino/90 dias | 1 dieta/45 dias
    // PRO:   1 treino/90 dias | 1 dieta/30 dias
    var _CICLO_DIAS = {
      treino: { aluno_start: 90, aluno_pro: 90 },
      dieta:  { aluno_start: 45, aluno_pro: 30 }
    };

    function verificarLimiteSolicitacao(tipo) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return { bloqueado: false };
      // Apenas alunos autônomos com plano START ou PRO têm limite
      var usuarios = _st.usuarios;
      var dados = (usuarios[email] && usuarios[email].dados) || {};
      var perfil = dados.perfil || dados.tipo || '';
      if (perfil !== 'aluno_autonomo' && perfil !== 'autonomo') return { bloqueado: false };
      var plano = getPlanoUsuario();
      var diasCiclo = (_CICLO_DIAS[tipo] || {})[plano];
      if (!diasCiclo) return { bloqueado: false };
      var ultimoAceite = _st.ultimoAceite[tipo + '_' + email];
      if (!ultimoAceite) return { bloqueado: false };
      var dataAceite = new Date(ultimoAceite);
      var diffDias = Math.floor((Date.now() - dataAceite) / 86400000);
      if (diffDias >= diasCiclo) return { bloqueado: false };
      var diasRestantes = diasCiclo - diffDias;
      var dataLiberacao = new Date(dataAceite.getTime() + diasCiclo * 86400000);
      return { bloqueado: true, diasRestantes: diasRestantes, dataLiberacao: dataLiberacao };
    }

    function mostrarModalCicloAtivo(tipo, diasRestantes, dataLiberacao) {
      var dataStr = dataLiberacao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
      var tipoNome = tipo === 'treino' ? 'Treino' : 'Dieta';
      var m = document.getElementById('modal-ciclo-ativo');
      document.getElementById('ciclo-ativo-titulo').textContent = tipoNome + ' em andamento';
      document.getElementById('ciclo-ativo-dias').textContent = diasRestantes;
      document.getElementById('ciclo-ativo-data').textContent = dataStr;
      document.getElementById('ciclo-ativo-tipo').textContent = tipoNome.toLowerCase();
      if (m) m.classList.add('show');
    }

    function fecharModalCicloAtivo() {
      var m = document.getElementById('modal-ciclo-ativo');
      if (m) m.classList.remove('show');
    }

    // ─── NOTIFICAÇÃO DE VENCIMENTO ───
    function verificarAlertaVencimento() {
      var bannerEl = document.getElementById('banner-vencimento');
      if (!bannerEl) return;
      var email = localStorage.getItem('ironqi_logado');
      if (!email) { bannerEl.style.display = 'none'; return; }
      var usuarios = _st.usuarios;
      var dados = (usuarios[email] && usuarios[email].dados) || {};
      var perfil = dados.perfil || dados.tipo || '';
      if (perfil !== 'aluno_autonomo' && perfil !== 'autonomo') { bannerEl.style.display = 'none'; return; }
      var plano = getPlanoUsuario();
      var alertas = [];
      ['treino', 'dieta'].forEach(function(tipo) {
        var diasCiclo = (_CICLO_DIAS[tipo] || {})[plano];
        if (!diasCiclo) return;
        var ultimoAceite = _st.ultimoAceite[tipo + '_' + email];
        if (!ultimoAceite) return;
        var diffDias = Math.floor((Date.now() - new Date(ultimoAceite)) / 86400000);
        var diasRestantes = diasCiclo - diffDias;
        if (diasRestantes > 0 && diasRestantes <= 30) alertas.push({ tipo: tipo, diasRestantes: diasRestantes });
      });
      if (alertas.length === 0) { bannerEl.style.display = 'none'; return; }
      var a = alertas[0];
      var tipoNome = a.tipo === 'treino' ? 'treino' : 'dieta';
      var titulo = alertas.length > 1
        ? 'Treino e dieta vencem em breve'
        : 'Seu ' + tipoNome + ' vence em ' + a.diasRestantes + ' dia' + (a.diasRestantes !== 1 ? 's' : '');
      var sub = alertas.length > 1 ? 'Solicite as renovações antes de vencer' : 'Solicite a renovação para continuar evoluindo';
      document.getElementById('banner-vencimento-titulo').textContent = titulo;
      document.getElementById('banner-vencimento-sub').textContent = sub;
      var btnEl = document.getElementById('banner-vencimento-btn');
      if (btnEl) {
        if (a.tipo === 'dieta' && alertas.length === 1) {
          btnEl.onclick = function() { navigate('dieta'); };
          btnEl.textContent = 'Renovar Dieta';
        } else {
          btnEl.onclick = function() { abrirFormulario(); };
          btnEl.textContent = 'Renovar Treino';
        }
      }
      bannerEl.style.display = 'flex';
    }

    // ─── AJUSTE DENTRO DO CICLO ───
    function verificarAjusteDisponivel(tipo) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return { disponivel: false };
      var ultimo = _st.ultimoAjuste[tipo + '_' + email];
      if (!ultimo) return { disponivel: true };
      var diffDias = Math.floor((Date.now() - new Date(ultimo)) / 86400000);
      if (diffDias < 30) return { disponivel: false, diasRestantes: 30 - diffDias };
      return { disponivel: true };
    }

    function pedirAjuste(tipo) {
      var ciclo = verificarLimiteSolicitacao(tipo);
      if (!ciclo.bloqueado) {
        alert('Você ainda não tem um ' + (tipo === 'treino' ? 'treino' : 'dieta') + ' ativo para ajustar. Use "Solicitar ' + (tipo === 'treino' ? 'Novo Treino' : 'Nova Dieta') + '" para começar.');
        return;
      }
      var ajuste = verificarAjusteDisponivel(tipo);
      if (!ajuste.disponivel) {
        alert('Você já usou seu ajuste deste mês. Próximo ajuste disponível em ' + ajuste.diasRestantes + ' dia' + (ajuste.diasRestantes !== 1 ? 's' : '') + '.');
        return;
      }
      _pendingEhAjuste = tipo;
      if (tipo === 'treino') abrirFormulario();
      else navigate('dieta');
    }

    function _atualizarBotaoAjuste(tipo) {
      var btnId = tipo === 'treino' ? 'btn-ajuste-treino' : 'btn-ajuste-dieta';
      var btnEl = document.getElementById(btnId);
      if (!btnEl) return;
      var email = localStorage.getItem('ironqi_logado');
      var usuarios = _st.usuarios;
      var dados = (usuarios[email] && usuarios[email].dados) || {};
      var perfil = dados.perfil || dados.tipo || '';
      var ehAluno = (perfil === 'aluno_autonomo' || perfil === 'autonomo' || perfil === 'aluno_personal');
      if (!ehAluno) { btnEl.style.display = 'none'; return; }
      var ciclo = verificarLimiteSolicitacao(tipo);
      btnEl.style.display = ciclo.bloqueado ? '' : 'none';
      if (window.lucide) window.lucide.createIcons();
    }

    function atualizarCicloBlockerDieta() {
      var blocker = document.getElementById('dieta-ciclo-blocker');
      if (!blocker) return;
      var limite = verificarLimiteSolicitacao('dieta');
      if (limite.bloqueado) {
        var dataStr = limite.dataLiberacao.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        document.getElementById('dieta-ciclo-dias').textContent = limite.diasRestantes;
        document.getElementById('dieta-ciclo-data').textContent = dataStr;
        blocker.style.display = 'flex';
      } else {
        blocker.style.display = 'none';
      }
    }

    function assinarPRO() {
      var email = localStorage.getItem('ironqi_logado');
      if (email) {
        _st.planos[email] = 'aluno_pro';
      }
      document.getElementById('modal-upgrade').classList.remove('show');
      document.getElementById('modal-form').classList.remove('show');
      _upgradeBlocked = true;
      navigate('planos');
      setTimeout(function() { _upgradeBlocked = false; }, 2000);
    }

    function fecharModalUpgrade() {
      document.getElementById('modal-upgrade').classList.remove('show');
      _upgradeBlocked = true;
      setTimeout(function() { _upgradeBlocked = false; }, 2000);
    }

    function fecharUpgrade() {
      fecharModalUpgrade();
    }

    function atualizarDietaBlocker() {
      var blocker = document.getElementById('dieta-blocker');
      if (!blocker) return;
      if (temAcessoPRO()) {
        blocker.style.display = 'none';
        // PRO: verifica limite de ciclo
        atualizarCicloBlockerDieta();
      } else {
        blocker.style.display = 'flex';
        // garante que o ciclo blocker não sobrepõe
        var cb = document.getElementById('dieta-ciclo-blocker');
        if (cb) cb.style.display = 'none';
      }
    }

    function fecharDietaBlock() {
      document.getElementById('dieta-blocker').style.display = 'none';
      _pendingEhAjuste = false;
      navigate('dashboard');
    }

    function atualizarIMCBlocker() {
      var blocker = document.getElementById('imc-blocker');
      if (!blocker) return;
      if (temAcessoPRO()) {
        blocker.style.display = 'none';
      } else {
        blocker.style.display = 'flex';
      }
    }

    function fecharIMCBlock() {
      document.getElementById('imc-blocker').style.display = 'none';
      navigate('dashboard');
    }