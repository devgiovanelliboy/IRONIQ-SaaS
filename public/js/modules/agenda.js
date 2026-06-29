// ─── MÓDULO: AGENDA ──────────────────────────────────────────────────────────
// Depende de: state.js (_st), firebase-init.js (isDemo, db, auth)
    // ═══════════════════════════════════════════════════════════
    //  AGENDA DO PERSONAL — aulas presenciais + check-in do aluno
    //  Slots datados (com gerador de recorrência semanal). Check-in
    //  como subcoleção 1-doc-por-aluno. Só o personal vê a lista de
    //  presença; o aluno vê vagas restantes e o próprio status.
    // ═══════════════════════════════════════════════════════════
    function agendaGetSlots() { return _st.agendaSlots || []; }
    function agendaSetSlots(s) { _st.agendaSlots = s; }
    function agendaGetCheckins() { return _st.agendaCheckins || []; }
    function agendaSetCheckins(c) { _st.agendaCheckins = c; }

    function agendaToggleCapacidade() {
      var tipoEl = document.getElementById('agenda-tipo');
      var wrap = document.getElementById('agenda-capacidade-wrap');
      if (tipoEl && wrap) wrap.style.display = (tipoEl.value === 'aulao') ? 'none' : '';
    }

    function _agendaFmtData(iso) {
      var p = String(iso).split('-');
      return (p.length === 3) ? (p[2] + '/' + p[1] + '/' + p[0]) : iso;
    }
    function _agendaInicio(slot) { return new Date(slot.data + 'T' + (slot.hora || '00:00')); }
    function _agendaFuturos(slots) {
      var lim = Date.now() - 3600000; // tolera 1h após o início
      return slots.filter(function(s) { return _agendaInicio(s).getTime() >= lim; })
        .sort(function(a, b) { return _agendaInicio(a) - _agendaInicio(b); });
    }

    // ─── PERSONAL ───
    function carregarAgendaPersonal() {
      agendaToggleCapacidade();
      var email = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado');
      if (!email) return;
      agendaRenderSlotsPersonal();
      agendaSyncFirestore(email, true, function() { agendaRenderSlotsPersonal(); });
    }

    function agendaAddSlot() {
      var email = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado');
      if (!email) { alert('Faça login.'); return; }
      var data = document.getElementById('agenda-data').value;
      var hora = document.getElementById('agenda-hora').value;
      var tipo = document.getElementById('agenda-tipo').value;
      var cap = parseInt(document.getElementById('agenda-capacidade').value, 10);
      var titulo = document.getElementById('agenda-titulo').value.trim();
      if (!data || !hora) { alert('Preencha data e hora.'); return; }
      if (tipo === 'individual' && (!cap || cap < 1)) { alert('Informe o número de vagas.'); return; }
      var repetir = document.getElementById('agenda-repetir').checked;
      var semanas = repetir ? Math.max(1, Math.min(12, parseInt(document.getElementById('agenda-semanas').value, 10) || 1)) : 1;

      var slots = agendaGetSlots();
      var base = new Date(data + 'T00:00');
      var novos = [];
      for (var w = 0; w < semanas; w++) {
        var dt = new Date(base.getTime() + w * 7 * 86400000);
        var ds = dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0') + '-' + String(dt.getDate()).padStart(2, '0');
        var id = 'slot_' + Date.now().toString(36) + '_' + w + '_' + Math.random().toString(36).slice(2, 5);
        var slot = { id: id, personalEmail: email, data: ds, hora: hora, tipo: tipo, capacidade: tipo === 'aulao' ? 0 : cap, titulo: titulo, checkinCount: 0, criadoEm: new Date().toISOString() };
        slots.push(slot); novos.push(slot);
      }
      agendaSetSlots(slots);
      if (!isDemo && db) {
        novos.forEach(function(s) {
          db.collection('agenda_slots').doc(s.id).set({
            personalEmail: s.personalEmail, data: s.data, hora: s.hora, tipo: s.tipo,
            capacidade: s.capacidade, titulo: s.titulo, checkinCount: 0,
            criadoEm: firebase.firestore.FieldValue.serverTimestamp()
          }).catch(function(e) { console.warn('Erro ao salvar horário:', e.code || e); });
        });
      }
      document.getElementById('agenda-titulo').value = '';
      document.getElementById('agenda-repetir').checked = false;
      document.getElementById('agenda-semanas-wrap').style.display = 'none';
      alert('✅ ' + novos.length + ' horário(s) adicionado(s).');
      agendaRenderSlotsPersonal();
    }

    function agendaExcluirSlot(id) {
      if (!confirm('Excluir este horário? Os check-ins serão removidos.')) return;
      agendaSetSlots(agendaGetSlots().filter(function(s) { return s.id !== id; }));
      agendaSetCheckins(agendaGetCheckins().filter(function(c) { return c.slotId !== id; }));
      if (!isDemo && db) {
        db.collection('agenda_slots').doc(id).delete().catch(function(e) { console.warn('Erro ao excluir horário:', e.code || e); });
      }
      agendaRenderSlotsPersonal();
    }

    function agendaRenderSlotsPersonal() {
      var cont = document.getElementById('agenda-personal-lista');
      if (!cont) return;
      var email = localStorage.getItem('ironqi_personal_logado') || localStorage.getItem('ironqi_logado');
      var slots = _agendaFuturos(agendaGetSlots().filter(function(s) { return s.personalEmail === email; }));
      if (!slots.length) { cont.innerHTML = '<div class="card" style="text-align:center;color:#888;">Nenhum horário futuro. Adicione um acima.</div>'; return; }
      var checkins = agendaGetCheckins();
      var html = '';
      slots.forEach(function(s) {
        var cks = checkins.filter(function(c) { return c.slotId === s.id; });
        var n = cks.length;
        var badge = s.tipo === 'aulao'
          ? '<span style="background:#CCFF00;color:#0E1111;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">AULÃO · ' + n + '</span>'
          : '<span style="color:#888;font-size:12px;">' + n + '/' + s.capacidade + ' vagas</span>';
        var lista = n
          ? cks.map(function(c) { return '<div style="font-size:12px;color:#E8E8E8;padding:3px 0;border-top:1px solid #1c2222;">✅ ' + escHtml(c.alunoNome || c.alunoEmail) + '</div>'; }).join('')
          : '<div style="font-size:12px;color:#555;">Ninguém marcou ainda.</div>';
        html += '<div class="card" style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<div><strong style="color:#CCFF00;">' + _agendaFmtData(s.data) + '</strong> · ' + escHtml(s.hora) + (s.titulo ? ' · ' + escHtml(s.titulo) : '') + '</div>' + badge +
          '</div>' +
          '<div style="margin-top:8px;">' + lista + '</div>' +
          '<button class="btn btn-outline" style="margin-top:10px;padding:6px 12px;font-size:12px;" onclick="agendaExcluirSlot(\'' + s.id + '\')">Excluir</button>' +
        '</div>';
      });
      cont.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    // ─── ALUNO VINCULADO ───
    function carregarAgendaAluno() {
      var email = localStorage.getItem('ironqi_logado');
      var cont = document.getElementById('agenda-aluno-lista');
      if (!email || !cont) return;
      var usuarios = _st.usuarios;
      var dados = (usuarios[email] && usuarios[email].dados) || {};
      var personalEmail = dados.personal_vinculado;
      if (!personalEmail) { cont.innerHTML = '<div class="card" style="text-align:center;color:#888;">Você não está vinculado a um personal.</div>'; return; }
      agendaRenderSlotsAluno(personalEmail);
      agendaSyncFirestore(personalEmail, false, function() { agendaRenderSlotsAluno(personalEmail); });
    }

    function agendaRenderSlotsAluno(personalEmail) {
      var cont = document.getElementById('agenda-aluno-lista');
      if (!cont) return;
      var email = localStorage.getItem('ironqi_logado');
      var slots = _agendaFuturos(agendaGetSlots().filter(function(s) { return s.personalEmail === personalEmail; }));
      if (!slots.length) { cont.innerHTML = '<div class="card" style="text-align:center;color:#888;">Seu personal ainda não publicou horários.</div>'; return; }
      var checkins = agendaGetCheckins();
      var html = '';
      slots.forEach(function(s) {
        var meu = checkins.some(function(c) { return c.slotId === s.id && c.alunoEmail === email; });
        var n = (typeof s.checkinCount === 'number') ? s.checkinCount : 0;
        var lotado = s.tipo !== 'aulao' && n >= s.capacidade && !meu;
        var info = s.tipo === 'aulao'
          ? '<span style="background:#CCFF00;color:#0E1111;padding:2px 8px;border-radius:6px;font-size:11px;font-weight:700;">AULÃO</span>'
          : '<span style="color:#888;font-size:12px;">' + Math.max(0, s.capacidade - n) + ' vaga(s)</span>';
        var btn;
        if (meu) btn = '<button class="btn btn-outline" style="padding:6px 12px;font-size:12px;" onclick="agendaCancelarCheckin(\'' + s.id + '\')">Cancelar check-in</button>';
        else if (lotado) btn = '<button class="btn btn-secondary" style="padding:6px 12px;font-size:12px;opacity:0.6;" disabled>Esgotado</button>';
        else btn = '<button class="btn btn-primary" style="padding:6px 12px;font-size:12px;" onclick="agendaCheckin(\'' + s.id + '\')">Check-in</button>';
        html += '<div class="card" style="margin-bottom:10px;">' +
          '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">' +
            '<div><strong style="color:#CCFF00;">' + _agendaFmtData(s.data) + '</strong> · ' + escHtml(s.hora) + (s.titulo ? ' · ' + escHtml(s.titulo) : '') + '</div>' + info +
          '</div>' +
          (meu ? '<div style="font-size:12px;color:#CCFF00;margin-top:6px;">✅ Você está confirmado</div>' : '') +
          '<div style="margin-top:10px;">' + btn + '</div>' +
        '</div>';
      });
      cont.innerHTML = html;
      if (typeof lucide !== 'undefined') lucide.createIcons();
    }

    function agendaCheckin(slotId) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var usuarios = _st.usuarios;
      var dados = (usuarios[email] && usuarios[email].dados) || {};
      var nome = ((dados.nome || '') + ' ' + (dados.sobrenome || '')).trim() || email.split('@')[0];
      var slots = agendaGetSlots();
      var slot = null; for (var i = 0; i < slots.length; i++) { if (slots[i].id === slotId) { slot = slots[i]; break; } }
      if (!slot) return;
      var checkins = agendaGetCheckins();
      if (checkins.some(function(c) { return c.slotId === slotId && c.alunoEmail === email; })) return;
      var n = (typeof slot.checkinCount === 'number') ? slot.checkinCount : 0;
      if (slot.tipo !== 'aulao' && n >= slot.capacidade) { alert('Esgotado.'); agendaRenderSlotsAluno(slot.personalEmail); return; }
      // Otimista local
      checkins.push({ id: slotId + '__' + email, slotId: slotId, alunoEmail: email, alunoNome: nome, checkedInAt: new Date().toISOString() });
      agendaSetCheckins(checkins);
      slot.checkinCount = n + 1; agendaSetSlots(slots);
      agendaRenderSlotsAluno(slot.personalEmail);
      if (!isDemo && db && auth && auth.currentUser) {
        var uid = auth.currentUser.uid;
        var slotRef = db.collection('agenda_slots').doc(slotId);
        var ckRef = slotRef.collection('checkins').doc(uid);
        db.runTransaction(function(tx) {
          return tx.get(slotRef).then(function(doc) {
            if (!doc.exists) throw 'inexistente';
            var d = doc.data();
            var count = d.checkinCount || 0;
            if (d.tipo !== 'aulao' && count >= d.capacidade) throw 'lotado';
            tx.set(ckRef, { alunoEmail: email, alunoNome: nome, checkedInAt: firebase.firestore.FieldValue.serverTimestamp() });
            tx.update(slotRef, { checkinCount: count + 1 });
          });
        }).catch(function(e) {
          // Reverte o otimismo local
          agendaSetCheckins(agendaGetCheckins().filter(function(c) { return !(c.slotId === slotId && c.alunoEmail === email); }));
          var ss = agendaGetSlots(); for (var j = 0; j < ss.length; j++) { if (ss[j].id === slotId) { ss[j].checkinCount = Math.max(0, (ss[j].checkinCount || 1) - 1); break; } } agendaSetSlots(ss);
          alert(e === 'lotado' ? 'Esgotado — alguém marcou antes de você.' : 'Não foi possível marcar o check-in.');
          agendaRenderSlotsAluno(slot.personalEmail);
        });
      }
    }

    function agendaCancelarCheckin(slotId) {
      var email = localStorage.getItem('ironqi_logado');
      if (!email) return;
      var slots = agendaGetSlots();
      var slot = null; for (var i = 0; i < slots.length; i++) { if (slots[i].id === slotId) { slot = slots[i]; break; } }
      agendaSetCheckins(agendaGetCheckins().filter(function(c) { return !(c.slotId === slotId && c.alunoEmail === email); }));
      if (slot) { slot.checkinCount = Math.max(0, (slot.checkinCount || 1) - 1); agendaSetSlots(slots); }
      agendaRenderSlotsAluno(slot ? slot.personalEmail : null);
      if (!isDemo && db && auth && auth.currentUser) {
        var uid = auth.currentUser.uid;
        var slotRef = db.collection('agenda_slots').doc(slotId);
        var ckRef = slotRef.collection('checkins').doc(uid);
        db.runTransaction(function(tx) {
          return tx.get(slotRef).then(function(doc) {
            if (!doc.exists) return;
            var count = doc.data().checkinCount || 0;
            tx.delete(ckRef);
            tx.update(slotRef, { checkinCount: Math.max(0, count - 1) });
          });
        }).catch(function(e) { console.warn('Erro ao cancelar check-in:', e.code || e); });
      }
    }

    // Sincroniza horários do Firestore. Para o personal, também carrega a lista
    // real de check-ins (só ele pode ler). Para o aluno, lê apenas o próprio check-in.
    function agendaSyncFirestore(personalEmail, isPersonal, cb) {
      if (isDemo || !db || !personalEmail) { if (cb) cb(); return; }
      var meuEmail = localStorage.getItem('ironqi_logado');
      var meuUid = (auth && auth.currentUser) ? auth.currentUser.uid : null;
      db.collection('agenda_slots').where('personalEmail', '==', personalEmail).get().then(function(snap) {
        var byId = {}; agendaGetSlots().forEach(function(s) { byId[s.id] = s; });
        var checkins = agendaGetCheckins();
        var serverIds = {};
        var promessas = [];
        snap.forEach(function(doc) {
          var d = doc.data();
          serverIds[doc.id] = true;
          byId[doc.id] = { id: doc.id, personalEmail: d.personalEmail, data: d.data, hora: d.hora, tipo: d.tipo, capacidade: d.capacidade || 0, titulo: d.titulo || '', checkinCount: d.checkinCount || 0, criadoEm: (byId[doc.id] && byId[doc.id].criadoEm) || '' };
          if (isPersonal) {
            promessas.push(doc.ref.collection('checkins').get().then(function(cs) {
              checkins = checkins.filter(function(c) { return c.slotId !== doc.id; });
              cs.forEach(function(ck) { var cd = ck.data(); checkins.push({ id: doc.id + '__' + (cd.alunoEmail || ck.id), slotId: doc.id, alunoEmail: cd.alunoEmail || '', alunoNome: cd.alunoNome || '', checkedInAt: '' }); });
            }).catch(function() {}));
          } else if (meuUid) {
            promessas.push(doc.ref.collection('checkins').doc(meuUid).get().then(function(ck) {
              checkins = checkins.filter(function(c) { return !(c.slotId === doc.id && c.alunoEmail === meuEmail); });
              if (ck.exists) { var cd = ck.data(); checkins.push({ id: doc.id + '__' + meuEmail, slotId: doc.id, alunoEmail: meuEmail, alunoNome: cd.alunoNome || '', checkedInAt: '' }); }
            }).catch(function() {}));
          }
        });
        // Remove horários locais deste personal que sumiram do servidor
        var merged = Object.keys(byId).map(function(k) { return byId[k]; }).filter(function(s) { return s.personalEmail !== personalEmail || serverIds[s.id]; });
        Promise.all(promessas).then(function() {
          agendaSetSlots(merged);
          agendaSetCheckins(checkins);
          if (cb) cb();
        });
      }).catch(function(e) { console.warn('Erro ao sincronizar agenda:', e.code || e); if (cb) cb(); });
    }