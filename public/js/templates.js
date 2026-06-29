// ─── TEMPLATES.JS ────────────────────────────────────────────────────────────
// Injeta o HTML de todas as páginas não-críticas no #app de forma SÍNCRONA,
// antes dos módulos JS carregarem. Garante que o DOM existe quando auth.js
// dispara o IIFE de autologin.
// Carrega ANTES de todos os módulos e ANTES de router.js / auth.js.
// Páginas críticas (landing, login, cadastro, train-type, dashboard, navs)
// permanecem inline em app.html por serem destinos diretos do autologin.

(function() {
  var app = document.getElementById('app');
  var ref = document.getElementById('bottom-nav');

  function inj(html) {
    var d = document.createElement('div');
    d.innerHTML = html;
    while (d.firstChild) {
      app.insertBefore(d.firstChild, ref);
    }
  }

  // ─── PERFIL ───────────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-perfil">
      <div class="page-grid-container" id="perfil-grid">
        <div class="perfil-personal-tabs grid-full" id="perfil-personal-tabs" style="display:none; padding:0;">
          <button class="active" data-ptab="perfil" onclick="personalTab('perfil')"><i data-lucide="user"></i> Meu Perfil</button>
          <button data-ptab="alunos" onclick="personalTab('alunos')"><i data-lucide="dumbbell"></i> Painel de Alunos</button>
          <button data-ptab="config" onclick="personalTab('config')"><i data-lucide="settings"></i> Configurações</button>
        </div>
        <div class="grid-full perfil-duas-colunas" style="display:grid; grid-template-columns: 350px 1fr; gap:24px; align-items:start;">
          <div class="iron-card" style="justify-content:flex-start; gap:20px; padding:30px;">
            <div class="perfil-left-avatar" onclick="abrirSeletorFoto()" title="Clique para alterar foto" style="width:100px; height:100px; border-radius:50%; border:2px solid #CCFF00; background:#000; overflow:hidden; flex-shrink:0; position:relative; cursor:pointer; transition:opacity 0.3s;">
              <img id="perfil-left-avatar-img" src="logo.webp" alt="Avatar" style="width:100%; height:100%; object-fit:cover;">
              <div class="perfil-avatar-overlay" style="position:absolute;inset:0;border-radius:50%;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;font-size:24px;opacity:0;transition:opacity 0.3s;"><i data-lucide="camera"></i></div>
            </div>
            <div class="perfil-left-name" id="perfil-left-name" style="font-size:18px; font-weight:700;">—</div>
            <div class="perfil-resumo" id="perfil-resumo" style="font-size:12px; color:#666;"></div>
            <div class="perfil-left-email" id="perfil-left-email" style="font-size:12px; color:#888; word-break:break-all;">—</div>
            <div class="perfil-stats" style="display:flex; gap:8px; width:100%; padding-top:20px; border-top:1px solid #1F2525;">
              <div class="perfil-stat" style="flex:1; text-align:center; padding:8px 4px;">
                <div class="perfil-stat-num" style="font-size:20px; font-weight:800; color:#CCFF00; line-height:1.2;" id="perfil-stat-treinos">0</div>
                <div class="perfil-stat-label" style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Treinos</div>
              </div>
              <div class="perfil-stat" style="flex:1; text-align:center; padding:8px 4px;">
                <div class="perfil-stat-num" style="font-size:20px; font-weight:800; color:#CCFF00; line-height:1.2;" id="perfil-stat-dias">0</div>
                <div class="perfil-stat-label" style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Dias</div>
              </div>
              <div class="perfil-stat" style="flex:1; text-align:center; padding:8px 4px;">
                <div class="perfil-stat-num" style="font-size:20px; font-weight:800; color:#CCFF00; line-height:1.2;" id="perfil-stat-metas">0</div>
                <div class="perfil-stat-label" style="font-size:10px; color:#666; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Metas</div>
              </div>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div class="iron-card" id="perfil-section-about" style="text-align:left; align-items:stretch; padding:24px;">
              <div style="display:flex; justify-content:space-between; align-items:center; width:100%; margin-bottom:8px;">
                <h3 style="font-size:15px; font-weight:700; margin:0;">Sobre mim</h3>
                <button id="btn-editar-bio" onclick="editarBio()" title="Editar" style="background:none; border:none; color:#555; font-size:16px; cursor:pointer; padding:4px;"><i data-lucide="edit"></i></button>
              </div>
              <p class="perfil-about-text" id="perfil-about-text" style="font-size:13px; color:#888; line-height:1.7; width:100%;">Carregando...</p>
            </div>
            <div class="iron-card" style="text-align:left; align-items:stretch; padding:24px;">
              <div style="display:flex; gap:10px; flex-wrap:wrap; width:100%;">
                <button class="btn-perfil-edit" onclick="abrirModalEditar()" style="flex:1; min-width:120px; background:#CCFF00; color:#0E1111; border:none; display:inline-flex; align-items:center; justify-content:center; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; gap:6px; transition:all 0.2s;"><i data-lucide="edit"></i> EDITAR CADASTRO</button>
                <button class="btn-perfil-plans" onclick="navigate('planos')" id="perfil-btn-planos" style="flex:1; min-width:120px; background:transparent; border:1.5px solid #CCFF00; color:#CCFF00; display:inline-flex; align-items:center; justify-content:center; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; gap:6px; transition:all 0.2s;"><i data-lucide="diamond"></i> PLANOS</button>
                <button class="btn-perfil-exit" onclick="sair()" style="flex:1; min-width:120px; background:#1F2525; color:#888; border:none; display:inline-flex; align-items:center; justify-content:center; padding:12px 20px; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer; font-family:inherit; gap:6px; transition:all 0.2s;"><i data-lucide="log-out"></i> SAIR</button>
              </div>
            </div>
            <div class="iron-card" id="perfil-comissoes" style="display:none; text-align:left; align-items:stretch; padding:24px;">
              <div style="display:flex;justify-content:space-between;align-items:center;width:100%;margin-bottom:16px;">
                <h3 style="font-size:15px;font-weight:700;margin:0;"><i data-lucide="dollar-sign"></i> Minhas Comissões</h3>
                <span style="font-size:11px;color:#555;">Atualizado automaticamente</span>
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;" id="perfil-comissoes-stats">
                <div style="background:#1F2525;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#CCFF00;" id="comm-treinos-aceitos">0</div>
                  <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Treinos aceitos</div>
                </div>
                <div style="background:#1F2525;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#CCFF00;" id="comm-dietas-aceitas">0</div>
                  <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">Dietas aceitas</div>
                </div>
                <div style="background:#1F2525;border-radius:10px;padding:14px;text-align:center;">
                  <div style="font-size:22px;font-weight:800;color:#CCFF00;" id="comm-total-receber">R$0</div>
                  <div style="font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">A receber</div>
                </div>
              </div>
              <div style="font-size:11px;color:#444;text-align:center;">Comissão: R$4 por treino aceito · R$1 por dieta aceita</div>
            </div>
            <div class="iron-card" id="perfil-suporte" style="display:none; text-align:center; align-items:center; padding:24px;">
              <p style="font-size:13px; color:#CCFF00; font-weight:700; margin-bottom:6px;"><i data-lucide="message-square"></i> Suporte Prioritário</p>
              <p style="font-size:12px; color:#888;" id="perfil-suporte-texto">Fale conosco no WhatsApp</p>
              <a id="perfil-suporte-link" href="#" target="_blank" style="display:inline-block; margin-top:8px; padding:10px 20px; background:#25D366; color:#fff; border-radius:8px; text-decoration:none; font-size:12px; font-weight:600;"><i data-lucide="smartphone"></i> Chamar no WhatsApp</a>
            </div>
          </div>
        </div>
        <div id="perfil-kanban" style="display:none;" class="grid-full">
          <div id="kanban-limite-banner" style="display:none; background:rgba(255,107,107,0.12); border:1px solid #FF6B6B; color:#FF6B6B; font-size:13px; font-weight:600; padding:12px 16px; border-radius:10px; margin-bottom:16px;"></div>
          <div class="kanban-container" style="display:grid; grid-template-columns:1fr 1fr; gap:20px;">
            <div class="kanban-column iron-card" id="kanban-vinculados" style="text-align:left; align-items:stretch; padding:20px; min-height:400px;">
              <div class="kanban-column-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; width:100%;">
                <h3 style="font-size:15px; font-weight:700;"><i data-lucide="clipboard-list"></i> Alunos Vinculados</h3>
                <span class="kanban-badge" style="background:rgba(204,255,0,0.1); color:#CCFF00; font-size:11px; font-weight:700; padding:3px 10px; border-radius:12px;" id="kanban-vinculados-badge">0</span>
              </div>
              <div class="kanban-column-body" id="kanban-vinculados-body" style="display:flex; flex-direction:column; gap:12px; flex:1;"></div>
            </div>
            <div class="kanban-column iron-card" id="kanban-autonomos" style="text-align:left; align-items:stretch; padding:20px; min-height:400px;">
              <div class="kanban-column-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; width:100%;">
                <h3 style="font-size:15px; font-weight:700;"><i data-lucide="dumbbell"></i> Alunos Autônomos</h3>
                <span class="kanban-badge" style="background:rgba(204,255,0,0.1); color:#CCFF00; font-size:11px; font-weight:700; padding:3px 10px; border-radius:12px;" id="kanban-autonomos-badge">0</span>
              </div>
              <div class="kanban-column-body" id="kanban-autonomos-body" style="display:flex; flex-direction:column; gap:12px; flex:1;"></div>
            </div>
          </div>
        </div>
        <div class="iron-card grid-full" id="perfil-loading" style="display:none; text-align:center; align-items:center; padding:40px;">
          <div style="font-size:32px; margin-bottom:8px;"><i data-lucide="loader" class="lucide-animate-spin"></i></div>
          <div style="color:#555;">Carregando...</div>
        </div>
      </div>
      <div id="modal-senha-aluno" class="modal-overlay" style="display:none;" onclick="if(event.target===this)fecharModalSenha()">
        <div class="modal-content">
          <h3><i data-lucide="key"></i> Alterar Senha</h3>
          <p style="font-size:13px;color:#888;" id="modal-senha-aluno-info">Aluno: —</p>
          <div class="perfil-edit-row">
            <label>Nova Senha</label>
            <input class="perfil-edit-input" id="modal-senha-input" type="text" placeholder="Digite a nova senha">
          </div>
          <div style="display:flex;gap:8px;margin-top:12px;">
            <button class="btn btn-primary btn-small" style="flex:1;" onclick="salvarSenhaAluno()"><i data-lucide="save"></i> Salvar</button>
            <button class="btn btn-secondary btn-small" style="flex:1;" onclick="fecharModalSenha()">Cancelar</button>
          </div>
        </div>
      </div>
      <div id="modal-editar-perfil" class="modal-overlay" style="display:none;" onclick="if(event.target===this)fecharModalEditarPerfil()">
        <div class="modal modal-editar-perfil">
          <button class="modal-close-btn" onclick="fecharModalEditarPerfil()">✕</button>
          <h2><i data-lucide="edit"></i> Editar Cadastro</h2>
          <p class="sub">Altere seus dados de cadastro</p>
          <div id="modal-editar-perfil-body"></div>
          <div class="modal-editar-perfil-footer">
            <button class="btn btn-primary btn-small" id="btn-salvar-perfil" onclick="salvarEdicaoPerfil()"><i data-lucide="save"></i> Salvar Alterações</button>
            <button class="btn btn-secondary btn-small" onclick="fecharModalEditarPerfil()">Cancelar</button>
          </div>
          <div id="modal-editar-perfil-toast" style="display:none;"></div>
        </div>
      </div>
    </div>
  `);

  // ─── CHAT (personal — two-column) ────────────────────────────────────────
  inj(`
    <div class="page" id="page-chat">
      <div id="chat-twocol" style="display:none;flex:1;min-height:0;">
        <div class="chat-layout">
          <div class="chat-contacts" id="chat-contacts-panel">
            <div class="chat-contacts-header"><i data-lucide="message-square"></i> Contatos</div>
            <div class="chat-contacts-list" id="chat-contacts-list"></div>
          </div>
          <div class="chat-window" id="chat-window-panel">
            <div class="chat-window-header">
              <button class="back-btn" onclick="chatMobileVoltar()">←</button>
              <span id="chat-window-title" style="font-size:14px;font-weight:600;color:#888;">Selecione um contato</span>
              <button id="chat-assign-btn" onclick="atribuirAtendente(chatContatoAtivo)" title="Atribuir atendimento deste aluno autônomo a um Personal Interno" style="display:none;margin-left:auto;background:none;border:1px solid #333;color:#CCFF00;border-radius:8px;padding:4px 10px;font-size:12px;cursor:pointer;font-weight:600;white-space:nowrap;">👤➜ Atendente</button>
            </div>
            <div class="chat-window-body" id="chat-window-body">
              <div class="chat-empty"><i data-lucide="arrow-left"></i> Selecione um aluno para conversar</div>
            </div>
            <div class="chat-input-area" id="chat-input-area-2col" style="display:none;">
              <input type="text" id="chat-input-2col" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter')chat2ColEnviar()">
              <button onclick="chat2ColEnviar()"><i data-lucide="arrow-right"></i></button>
            </div>
          </div>
        </div>
      </div>
      <div id="chat-full" style="display:none;flex:1;flex-direction:column;min-height:0;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
          <h2 style="font-size:20px;"><i data-lucide="message-square"></i> Mensagens</h2>
          <button onclick="navigate('dashboard')" style="background:none;border:none;color:#888;font-size:14px;cursor:pointer;font-weight:600;">Fechar</button>
        </div>
        <div class="chat-tabs" id="chat-full-tabs" style="display:none;">
          <button id="tab-full-personal" class="active" onclick="chatFullAbrir('personal')"><i data-lucide="target"></i> Personal</button>
          <button id="tab-full-admin" onclick="chatFullAbrir('admin')"><i data-lucide="settings"></i> Administrador</button>
        </div>
        <div style="flex:1;display:flex;flex-direction:column;min-height:0;">
          <div class="chat-window-body" id="chat-full-body" style="background:#161A1A;border-radius:14px 14px 0 0;"></div>
          <div class="chat-input-area" id="chat-input-area-full">
            <input type="text" id="chat-input-full" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter')chatFullEnviar()">
            <button onclick="chatFullEnviar()"><i data-lucide="arrow-right"></i></button>
          </div>
        </div>
      </div>
    </div>
  `);

  // ─── CHAT ALUNO (WhatsApp style) ─────────────────────────────────────────
  inj(`
    <div class="page" id="page-aluno-chat">
      <div class="wachat-header">
        <button class="wachat-back" onclick="navigate('dashboard')" title="Voltar"><i data-lucide="arrow-left"></i></button>
        <div class="wachat-avatar"><i data-lucide="user"></i></div>
        <div class="wachat-info">
          <div class="wachat-nome" id="wachat-nome">Personal Trainer</div>
          <div class="wachat-online" id="wachat-online">online</div>
        </div>
      </div>
      <div class="wachat-body" id="wachat-body">
        <div class="wachat-empty-chat" id="wachat-empty">
          <div style="font-size:48px;">💬</div>
          <p>Nenhuma mensagem ainda.<br>Diga olá ao seu personal!</p>
        </div>
      </div>
      <div class="wachat-input-row">
        <input type="text" id="wachat-input" placeholder="Mensagem..." onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();chatAlunoEnviar();}">
        <button class="wachat-send-btn" onclick="chatAlunoEnviar()" title="Enviar"><i data-lucide="send"></i></button>
      </div>
    </div>
  `);

  // ─── AGENDA PERSONAL ─────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-agenda-personal">
      <div style="flex:1; display:flex; flex-direction:column;">
        <h2 style="font-size:20px; margin-bottom:4px;"><i data-lucide="calendar"></i> Agenda</h2>
        <p style="font-size:13px;color:#888;margin-bottom:16px;">Defina seus horários de aula presencial. Visível só para você e seus alunos vinculados.</p>
        <div class="card" style="margin-bottom:16px;">
          <h3 style="margin-bottom:12px;font-size:15px;">Novo horário</h3>
          <div style="display:flex;flex-wrap:wrap;gap:10px;">
            <div style="flex:1;min-width:130px;">
              <label style="font-size:12px;color:#888;">Data</label>
              <input type="date" id="agenda-data" style="width:100%;padding:10px;background:#0d0d0d;border:1px solid #2A3232;border-radius:10px;color:#E8E8E8;">
            </div>
            <div style="flex:1;min-width:110px;">
              <label style="font-size:12px;color:#888;">Hora</label>
              <input type="time" id="agenda-hora" style="width:100%;padding:10px;background:#0d0d0d;border:1px solid #2A3232;border-radius:10px;color:#E8E8E8;">
            </div>
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;">
            <div style="flex:1;min-width:150px;">
              <label style="font-size:12px;color:#888;">Tipo</label>
              <select id="agenda-tipo" onchange="agendaToggleCapacidade()" style="width:100%;padding:10px;background:#0d0d0d;border:1px solid #2A3232;border-radius:10px;color:#E8E8E8;">
                <option value="individual">Individual (vagas limitadas)</option>
                <option value="aulao">Aulão (todos os alunos)</option>
              </select>
            </div>
            <div style="flex:1;min-width:90px;" id="agenda-capacidade-wrap">
              <label style="font-size:12px;color:#888;">Vagas</label>
              <input type="number" id="agenda-capacidade" min="1" value="1" style="width:100%;padding:10px;background:#0d0d0d;border:1px solid #2A3232;border-radius:10px;color:#E8E8E8;">
            </div>
          </div>
          <div style="margin-top:10px;">
            <label style="font-size:12px;color:#888;">Título (opcional)</label>
            <input type="text" id="agenda-titulo" placeholder="Ex: Treino funcional" style="width:100%;padding:10px;background:#0d0d0d;border:1px solid #2A3232;border-radius:10px;color:#E8E8E8;">
          </div>
          <div style="margin-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <input type="checkbox" id="agenda-repetir" onchange="document.getElementById('agenda-semanas-wrap').style.display=this.checked?'inline':'none'">
            <label for="agenda-repetir" style="font-size:13px;color:#E8E8E8;cursor:pointer;">Repetir semanalmente</label>
            <span id="agenda-semanas-wrap" style="display:none;font-size:13px;color:#E8E8E8;">
              por <input type="number" id="agenda-semanas" min="1" max="12" value="4" style="width:56px;padding:6px;background:#0d0d0d;border:1px solid #2A3232;border-radius:8px;color:#E8E8E8;"> semanas
            </span>
          </div>
          <button class="btn btn-primary" style="margin-top:14px;" onclick="agendaAddSlot()">Adicionar horário</button>
        </div>
        <h3 style="font-size:15px;margin-bottom:10px;">Próximos horários</h3>
        <div id="agenda-personal-lista"></div>
      </div>
    </div>
  `);

  // ─── AGENDA ALUNO ─────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-agenda-aluno">
      <div style="flex:1; display:flex; flex-direction:column;">
        <h2 style="font-size:20px; margin-bottom:4px;"><i data-lucide="calendar"></i> Agenda do Personal</h2>
        <p style="font-size:13px;color:#888;margin-bottom:16px;">Marque seu check-in nos horários disponíveis de aula presencial.</p>
        <div id="agenda-aluno-lista"></div>
      </div>
    </div>
  `);

  // ─── PLANOS ───────────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-planos">
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Planos</p>
            <h2 style="font-size:24px;">Escolha seu <span class="text-green">Plano</span></h2>
          </div>
          <img src="logo.webp" alt="IRONIQ" style="width:40px; height:40px; border-radius:10px;">
        </div>
        <div id="planos-aviso-trial" style="display:none; background:rgba(255,80,80,0.1); border:1px solid #ff5050; border-radius:10px; padding:12px 14px; margin-bottom:14px; font-size:12px; color:#ff7070; line-height:1.5;"></div>
        <div id="planos-categorias" style="display:flex; gap:6px; margin-bottom:16px; overflow-x:auto; scrollbar-width:none; padding-bottom:4px;">
          <button class="day-tab active" data-cat="aluno" onclick="selecionarCategoriaPlano('aluno')"><i data-lucide="user"></i> Aluno</button>
          <button class="day-tab" data-cat="personal" onclick="selecionarCategoriaPlano('personal')"><i data-lucide="target"></i> Personal</button>
        </div>
        <div id="planos-aluno" class="planos-categoria">
          <div class="plan-card" style="border-color:#CCFF00;">
            <h3>START</h3>
            <div class="price">R$ 19,90<small>/mês</small></div>
            <ul>
              <li>Treino autônomo completo</li>
              <li>Gráfico de evolução de cargas</li>
              <li>Protocolo alimentar com IA</li>
              <li>Avaliação física (IMC + dobras)</li>
              <li>Cancele quando quiser</li>
            </ul>
            <button class="btn btn-primary" onclick="assinarPlano('aluno_start')">Assinar START</button>
          </div>
          <div class="plan-card highlight">
            <div class="badge"><i data-lucide="flame"></i> MAIS POPULAR</div>
            <h3>PRO</h3>
            <div class="price">R$ 29,90<small>/mês</small></div>
            <ul>
              <li>Tudo do START</li>
              <li>Treino com Personal Trainer virtual</li>
              <li>Fiscalização e aprovação por Personal real</li>
              <li>Suporte prioritário</li>
              <li>Sem limites de protocolos</li>
            </ul>
            <button class="btn btn-primary" onclick="assinarPlano('aluno_pro')">Assinar PRO</button>
          </div>
        </div>
        <div id="planos-trial-aluno" style="display:none; margin-top:4px;">
          <div style="text-align:center; padding:16px 0 4px; font-size:12px; color:#555;">— ou —</div>
          <button onclick="ativarTrial()" style="width:100%; padding:14px; background:transparent; border:1px dashed #444; border-radius:12px; color:#888; font-size:13px; cursor:pointer; font-family:inherit; transition:all 0.2s;" onmouseover="this.style.borderColor='#CCFF00';this.style.color='#CCFF00';" onmouseout="this.style.borderColor='#444';this.style.color='#888';">
            ⏱ Experimentar por 24h grátis
          </button>
          <p style="font-size:10px; color:#444; text-align:center; margin-top:8px;">Após 24h, o acesso é bloqueado até você assinar um plano.</p>
        </div>
        <div id="planos-personal" class="planos-categoria" style="display:none;">
          <div class="plan-card">
            <h3>FREE</h3>
            <div class="price">Grátis<small></small></div>
            <p style="font-size:12px; color:#888; margin-bottom:8px;">Até <strong style="color:#CCFF00;">2 alunos</strong></p>
            <ul>
              <li>Gestão de alunos</li>
              <li>Criação e aprovação de treinos</li>
              <li>Teste sem compromisso</li>
              <li>Sem custos</li>
            </ul>
            <button class="btn btn-outline" onclick="assinarPlano('personal_free')">Começar Grátis</button>
          </div>
          <div class="plan-card highlight">
            <div class="badge"><i data-lucide="star"></i> PRINCIPAL</div>
            <h3>PRO</h3>
            <div class="price">R$ 39,90<small>/mês</small></div>
            <p style="font-size:12px; color:#888; margin-bottom:8px;">Até <strong style="color:#CCFF00;">15 alunos</strong></p>
            <ul>
              <li><i data-lucide="check-circle"></i> Gestão de alunos</li>
              <li><i data-lucide="check-circle"></i> Treinos inteligentes</li>
              <li><i data-lucide="check-circle"></i> Evolução completa</li>
              <li><i data-lucide="check-circle"></i> Avaliações físicas</li>
              <li><i data-lucide="check-circle"></i> Dietas com IA</li>
            </ul>
            <button class="btn btn-primary" onclick="assinarPlano('personal_pro')">Assinar PRO</button>
          </div>
          <div class="plan-card" style="border-color:#CCFF00;">
            <h3>ELITE</h3>
            <div class="price">R$ 79,90<small>/mês</small></div>
            <p style="font-size:12px; color:#888; margin-bottom:8px;">Até <strong style="color:#CCFF00;">100 alunos</strong></p>
            <ul>
              <li><i data-lucide="check-circle"></i> Tudo do PRO</li>
              <li><i data-lucide="check-circle"></i> Relatórios avançados</li>
              <li><i data-lucide="check-circle"></i> Prioridade no suporte</li>
              <li><i data-lucide="check-circle"></i> Mais alunos</li>
            </ul>
            <button class="btn btn-primary" onclick="assinarPlano('personal_elite')">Assinar ELITE</button>
          </div>
        </div>
      </div>
    </div>
  `);

  // ─── PERSONAL HOME ────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-personal-home">
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Personal</p>
            <h2 style="font-size:24px;">Painel de <span class="text-green">Alunos</span></h2>
          </div>
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="font-size:12px; color:#888; white-space:nowrap;" id="personal-home-count">0 alunos</span>
            <img src="logo.webp" alt="IRONIQ" style="width:36px; height:36px; border-radius:10px;">
          </div>
        </div>
        <div class="personal-stats-bar" id="personal-stats-bar">
          <div class="stat-card"><div class="stat-num" id="ph-stat-alunos">0</div><div class="stat-label">Alunos</div></div>
          <div class="stat-card"><div class="stat-num" id="ph-stat-pendentes">0</div><div class="stat-label">Pendentes</div></div>
          <div class="stat-card"><div class="stat-num" id="ph-stat-revisao">0</div><div class="stat-label">Em Revisão</div></div>
        </div>
        <input type="text" class="personal-home-search" id="personal-home-search" placeholder="Buscar aluno por nome ou e-mail..." oninput="carregarPainelAlunos()">
        <div id="personal-home-grid" class="personal-home-grid"></div>
      </div>
    </div>
  `);

  // ─── PERSONAL DASHBOARD ───────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-personal-dashboard">
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <div>
            <p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Personal</p>
            <h2 style="font-size:24px;">Treinos Pendentes</h2>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span id="notificacao-badge" style="display:none; background:#FF4444; color:#fff; font-size:11px; font-weight:700; padding:2px 8px; border-radius:10px; cursor:pointer;" onclick="abrirNotificacoes()">0</span>
            <img src="logo.webp" alt="IRONIQ" style="width:40px; height:40px; border-radius:10px;">
          </div>
        </div>
        <div style="display:flex; gap:8px; margin-bottom:16px;">
          <button class="btn btn-outline" style="flex:1; font-size:12px;" onclick="carregarPendentes()"><i data-lucide="clipboard-list"></i> Pendentes</button>
          <button class="btn btn-outline personal-tab-btn" style="flex:1; font-size:12px;" onclick="abrirNotificacoes()"><i data-lucide="bell"></i> Alertas</button>
        </div>
        <div id="personal-pendentes-list"></div>
        <div id="notificacoes-list" style="display:none;"></div>
      </div>
    </div>
  `);

  // ─── PERSONAL REVIEW ──────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-personal-review">
      <div style="flex:1; display:flex; flex-direction:column;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div>
            <p style="font-size:12px; color:#888; text-transform:uppercase; letter-spacing:1px;">Revisão</p>
            <h2 style="font-size:22px;" id="review-title">Revisar Treino</h2>
          </div>
          <button onclick="navigate('personal-dashboard')" style="background:none; border:none; color:#888; font-size:14px; cursor:pointer; font-weight:600;">Voltar</button>
        </div>
        <div id="review-content" class="gap-12"></div>
        <div class="review-actions" id="review-actions">
          <button class="btn btn-primary" onclick="aprovarTreino()">✓ Aprovar Treino</button>
          <button class="btn btn-outline" onclick="regenerarTreino()"><i data-lucide="refresh-cw"></i> Gerar Novo com IA</button>
          <button class="btn btn-secondary" onclick="navigate('personal-dashboard')">Voltar</button>
        </div>
      </div>
    </div>
  `);

  // ─── MODAL SOLICITAR TREINO ───────────────────────────────────────────────
  inj(`
    <div class="modal-overlay" id="modal-form" onclick="if(event.target===this)fecharFormulario()">
      <div class="modal">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:4px;">
          <h2>Solicitar <span class="text-green">Treino</span></h2>
          <button onclick="fecharFormulario()" style="background:none; border:none; color:#555; font-size:24px; cursor:pointer; padding:0 4px;">✕</button>
        </div>
        <p class="sub">Responda abaixo para montarmos o treino ideal para você.</p>
        <div class="bloco">
          <h3><i data-lucide="target"></i> Objetivo e Perfil</h3>
          <label>Qual é o seu objetivo principal?</label>
          <select id="q-objetivo">
            <option value="Hipertrofia">Hipertrofia (Ganho de Massa)</option>
            <option value="Emagrecimento">Emagrecimento / Definição</option>
            <option value="Força">Força Bruta</option>
            <option value="Condicionamento">Condicionamento Físico</option>
          </select>
          <label>Qual é o seu nível de experiência?</label>
          <select id="q-nivel">
            <option value="Iniciante">Iniciante</option>
            <option value="Intermediário">Intermediário</option>
            <option value="Avançado">Avançado</option>
          </select>
          <label>Qual o seu gênero biológico?</label>
          <select id="q-genero">
            <option value="Masculino">Masculino</option>
            <option value="Feminino">Feminino</option>
          </select>
        </div>
        <div class="bloco">
          <h3><i data-lucide="loader" class="lucide-animate-spin"></i> Disponibilidade e Rotina</h3>
          <label>Quantos dias na semana?</label>
          <select id="q-dias">
            <option value="3">3 dias</option>
            <option value="4">4 dias</option>
            <option value="5">5 dias</option>
            <option value="6">6 dias</option>
          </select>
          <label>Quanto tempo por treino?</label>
          <select id="q-tempo">
            <option value="45min">Até 45 minutos (Express)</option>
            <option value="1h">1 hora (Padrão)</option>
            <option value="1h30">Até 1h30 (Volumoso)</option>
          </select>
        </div>
        <div class="bloco">
          <h3><i data-lucide="shield"></i> Personalização e Segurança</h3>
          <label>Foco muscular prioritário?</label>
          <select id="q-foco">
            <option value="Geral">Equilibrado (Geral)</option>
            <option value="Superiores">Membros Superiores</option>
            <option value="Inferiores">Membros Inferiores</option>
            <option value="Core">Core e Abdômen</option>
          </select>
          <label>Possui alguma lesão ou limitação?</label>
          <input type="text" id="q-lesao" placeholder="Ex: joelho, ombro, coluna... (deixe em branco se não tiver)">
          <label>Onde vai treinar?</label>
          <select id="q-local">
            <option value="Academia">Academia Completa</option>
            <option value="Casa">Em Casa (peso corporal + elásticos)</option>
          </select>
        </div>
        <div id="modal-loading" style="display:none; text-align:center; padding:20px 0;">
          <div id="loading-text-content">
            <div style="font-size:32px; margin-bottom:12px;"><i data-lucide="loader" class="lucide-animate-spin"></i></div>
            <h3 class="blink-text" style="color:#CCFF00; font-size:18px;">Metodologia digital IRONIQA ativada</h3>
            <p style="font-size:13px; margin-top:10px; color:#aaa; line-height:1.7;">
              Enviando seu protocolo para a banca de professores<br>
              para fiscalização técnica...<br>
              Seu treino será liberado em instantes.
            </p>
            <div style="margin-top:16px; width:100%; height:4px; background:#1F2525; border-radius:4px; overflow:hidden;">
              <div style="width:100%; height:100%; background:#CCFF00; animation: loadingBar 1.5s infinite ease-in-out;"></div>
            </div>
          </div>
          <div id="personal-info" style="display:none; padding:8px 0;">
            <div style="font-size:40px; margin-bottom:8px;"><i data-lucide="check-circle"></i></div>
            <h3 style="color:#CCFF00; font-size:16px;">Personal responsável</h3>
            <p style="font-size:18px; font-weight:700; color:#E8E8E8; margin-top:10px;" id="personal-nome">Lukas Athademos</p>
            <p style="font-size:14px; color:#888; margin-top:4px;" id="personal-instagram">@lukas_athademos</p>
          </div>
        </div>
        <div id="modal-actions">
          <button class="btn btn-primary" onclick="gerarTreino()">Montar Meu Treino</button>
          <button class="btn btn-secondary mt-8" onclick="fecharFormulario()">Cancelar</button>
        </div>
      </div>
    </div>
  `);

  // ─── TREINO ATIVO ─────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-treino-ativo">
      <div id="treino-ativo-grid" class="treino-container">
        <div class="treino-header">
          <h1 class="treino-titulo" id="treino-ativo-nome">Protocolo IRONIQA</h1>
          <p class="treino-subtitulo" id="treino-ativo-meta">Força • Iniciante</p>
        </div>
        <div class="treino-tabs" id="treino-ativo-dias"></div>
        <div class="treino-table-wrap" id="treino-ativo-exercicios">
          <div class="treino-empty">Nenhum exercício disponível.</div>
        </div>
        <div class="treino-card rest-timer-bar" id="treino-ativo-timer-card">
          <div class="rest-timer-icon"><i data-lucide="clock"></i></div>
          <div class="rest-timer-info">
            <div class="rest-timer-label">Descanso entre séries</div>
            <div class="rest-timer-countdown" id="treino-ativo-timer">60s</div>
          </div>
          <button class="rest-timer-btn" onclick="iniciarDescansoAtivo()">Iniciar</button>
        </div>
        <div class="treino-card" id="treino-ativo-obs-card">
          <label class="treino-obs-label"><i data-lucide="clipboard-list"></i> Observações do treino</label>
          <textarea id="treino-ativo-obs" rows="3" placeholder="Ex: Senti cansaço nas pernas hoje, dor no ombro direito ao fazer supino..."></textarea>
          <button class="btn btn-primary treino-concluir-btn" onclick="concluirTreinoAtivo()">CONCLUIR TREINO</button>
        </div>
        <div class="treino-card" id="treino-ativo-gerencial" style="display:none;">
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn btn-outline" onclick="editarTreinoAtivo()" style="flex:1; min-width:120px; border-color:#deff9a; color:#deff9a;">✏️ Editar Treino</button>
            <button class="btn btn-primary" onclick="regenerarTreino()" style="flex:1; min-width:120px; background:#CCFF00; color:#0E1111;">🔄 Gerar Novo Protocolo</button>
          </div>
        </div>
      </div>
    </div>
  `);

  // ─── EVOLUÇÃO ─────────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-evolucao">
      <div class="page-grid-container" id="evolucao-grid">
        <div class="iron-card grid-full" style="text-align:left; align-items:stretch;">
          <div class="iron-card-header">
            <div>
              <p style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Evolução</p>
              <h3 style="font-size:20px; margin:2px 0 0;">Minha Evolução</h3>
            </div>
            <img src="logo.webp" alt="IRONIQ" style="width:36px; height:36px; border-radius:10px;">
          </div>
          <p style="font-size:13px; color:#888; width:100%; text-align:left;">Acompanhe a progressão das suas cargas ao longo do tempo.</p>
        </div>
        <div class="iron-card grid-full" id="evolucao-content" style="text-align:left; align-items:stretch; padding:24px;">
          <div class="evolucao-empty" id="evolucao-empty" style="padding:32px 16px;">
            <h3>Nenhum dado ainda</h3>
            <p>Finalize alguns treinos na aba "Treinar" para ver sua evolução aqui.</p>
          </div>
          <div id="evolucao-chart-area" style="display:none; width:100%;">
            <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
              <button id="personal-home-aluno-indicator" style="display:none;" onclick="voltarEvolucaoPersonal()">← Ver meus dados</button>
              <select id="evolucao-select" class="chart-select" style="flex:1;"></select>
            </div>
            <div class="chart-wrapper" style="background:#161A1A; border-radius:12px; padding:16px; width:100%;">
              <canvas id="graficoEvolucao" style="width:100%;"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  // ─── DIETA ────────────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-dieta">
      <div class="dieta-blocker" id="dieta-blocker">
        <div class="dieta-blocker-card">
          <div class="lock-icon"><i data-lucide="lock"></i></div>
          <h2>Recurso exclusivo do <span class="text-green">Plano PRO</span></h2>
          <p><strong>Plano PRO (R$29,90/mês)</strong>. Faça o upgrade agora e libere seu Protocolo Alimentar, Avaliação Física e Suporte Prioritário.</p>
          <button class="btn btn-primary" onclick="assinarPRO()">Upgrade para PRO</button>
          <button class="btn btn-secondary" onclick="fecharDietaBlock()">Agora não</button>
        </div>
      </div>
      <div class="dieta-blocker" id="dieta-ciclo-blocker" style="display:none;">
        <div class="dieta-blocker-card">
          <div class="lock-icon"><i data-lucide="clock"></i></div>
          <h2>Dieta em <span class="text-green">andamento</span></h2>
          <p>Você ainda está no ciclo atual da sua dieta.<br>Uma nova solicitação será liberada em <strong id="dieta-ciclo-data">—</strong>.</p>
          <div style="background:#0d0d0d; border:1px solid #2A3232; border-radius:12px; padding:16px; margin:8px 0 16px;">
            <div style="font-size:40px; font-weight:800; color:#CCFF00; line-height:1;" id="dieta-ciclo-dias">—</div>
            <div style="font-size:12px; color:#555; margin-top:4px;">dias restantes</div>
          </div>
          <button class="btn btn-primary" onclick="navigate('dashboard')">Voltar ao início</button>
        </div>
      </div>
      <div class="main-content">
      <div class="page-grid-container" id="dieta-grid">
        <div class="iron-card grid-full" style="text-align:left; align-items:stretch;">
          <div class="iron-card-header">
            <div>
              <p style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Dieta</p>
              <h3 style="font-size:20px; margin:2px 0 0;">Protocolo <span style="color:#CCFF00;">Alimentar</span></h3>
            </div>
            <img src="logo.webp" alt="IRONIQ" style="width:36px; height:36px; border-radius:10px;">
          </div>
        </div>
        <div id="dieta-form-card" class="iron-card grid-full" style="text-align:left; align-items:stretch; padding:24px;">
          <h3 style="margin-bottom:12px;"><i data-lucide="utensils-crossed"></i> Seu Protocolo</h3>
          <p style="font-size:13px; color:#888; margin-bottom:16px; width:100%;">Preencha suas preferências alimentares para solicitar seu protocolo personalizado.</p>
          <label>Tipo de Alimentação</label>
          <select id="dieta-tipo">
            <option value="Tradicional">Tradicional (Como de tudo)</option>
            <option value="Vegetariano">Vegetariano</option>
            <option value="Vegano">Vegano</option>
          </select>
          <div style="height:12px;"></div>
          <label>Intolerâncias e Alergias</label>
          <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
            <label style="display:flex; align-items:center; gap:10px; font-size:14px; color:#AAA; font-weight:400; text-transform:none; letter-spacing:0; cursor:pointer;">
              <input type="checkbox" id="dieta-lactose" style="width:18px; height:18px; accent-color:#CCFF00;">
              Intolerância à Lactose
            </label>
            <label style="display:flex; align-items:center; gap:10px; font-size:14px; color:#AAA; font-weight:400; text-transform:none; letter-spacing:0; cursor:pointer;">
              <input type="checkbox" id="dieta-gluten" style="width:18px; height:18px; accent-color:#CCFF00;">
              Alergia a Glúten (Celíaco)
            </label>
            <label style="display:flex; align-items:center; gap:10px; font-size:14px; color:#AAA; font-weight:400; text-transform:none; letter-spacing:0; cursor:pointer;">
              <input type="checkbox" id="dieta-nozes" style="width:18px; height:18px; accent-color:#CCFF00;">
              Alergia a Amendoim/Nozes
            </label>
          </div>
          <label>Restrições Pessoais</label>
          <input type="text" id="dieta-restricoes" placeholder="Ex: fígado, passas, coentro (deixe em branco se não tiver)">
          <button class="btn btn-primary" onclick="gerarDieta()" style="margin-top:16px;">Solicitar Protocolo Alimentar</button>
        </div>
        <div id="dieta-loading" style="display:none;" class="grid-full">
          <div class="iron-card" style="text-align:center; padding:32px 20px;">
            <div id="dieta-loading-mensagem" style="font-size:14px; color:#aaa; min-height:80px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:12px;">
              <div style="font-size:32px;"><i data-lucide="loader" class="lucide-animate-spin"></i></div>
              <h3 class="blink-text" style="color:#CCFF00; font-size:16px;" id="dieta-loading-text">Preparando seu protocolo alimentar...</h3>
            </div>
            <div style="margin-top:20px; width:100%; max-width:300px; height:4px; background:#1F2525; border-radius:4px; overflow:hidden;">
              <div style="width:100%; height:100%; background:#CCFF00; animation: loadingBar 1.5s infinite ease-in-out;" id="dieta-loading-bar"></div>
            </div>
          </div>
        </div>
        <div id="dieta-result" style="display:none;" class="grid-full">
          <div class="iron-card grid-full" id="dieta-warning-card" style="display:none; border:1px solid #CCFF00; text-align:left; align-items:stretch; padding:20px 24px;">
            <p style="font-size:12px; color:#CCFF00; font-weight:700;" id="dieta-warning-text"></p>
          </div>
          <div id="dieta-result-content" class="dieta-texto-container grid-full" style="text-align:left; align-items:stretch; padding:24px;"></div>
          <button class="btn btn-outline mt-16 grid-full" onclick="gerarDieta()" style="border-radius:8px; padding:14px; font-weight:700;"><i data-lucide="refresh-cw"></i> Gerar Novo Protocolo</button>
        </div>
      </div>
      </div>
    </div>
  `);

  // ─── IMC ──────────────────────────────────────────────────────────────────
  inj(`
    <div class="page" id="page-imc">
      <div class="dieta-blocker" id="imc-blocker">
        <div class="dieta-blocker-card">
          <div class="lock-icon"><i data-lucide="lock"></i></div>
          <h2>Recurso exclusivo do <span class="text-green">Plano PRO</span></h2>
          <p><strong>Plano PRO (R$29,90/mês)</strong>. Faça o upgrade agora e libere sua Avaliação Física (IMC + dobras), Protocolo Alimentar e Suporte Prioritário.</p>
          <button class="btn btn-primary" onclick="assinarPRO()">Upgrade para PRO</button>
          <button class="btn btn-secondary" onclick="fecharIMCBlock()">Agora não</button>
        </div>
      </div>
      <div class="page-grid-container" id="imc-grid">
        <div class="iron-card grid-full" style="text-align:left; align-items:stretch;">
          <div class="iron-card-header">
            <div>
              <p style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">IMC</p>
              <h3 style="font-size:20px; margin:2px 0 0;">Avaliação <span style="color:#CCFF00;">Física</span></h3>
            </div>
            <img src="logo.webp" alt="IRONIQ" style="width:36px; height:36px; border-radius:10px;">
          </div>
        </div>
        <div class="iron-card grid-full" id="imc-atual-card" style="text-align:left; align-items:stretch; padding:24px;">
          <div style="display:flex; justify-content:space-between; align-items:center; width:100%;">
            <div>
              <p style="font-size:11px; color:#888; text-transform:uppercase; letter-spacing:1px;">Seu IMC</p>
              <h2 style="font-size:32px; margin:4px 0;" id="imc-valor">—</h2>
            </div>
            <div style="text-align:right;">
              <div style="font-size:14px; font-weight:700; color:#CCFF00;" id="imc-classificacao">—</div>
              <div style="font-size:11px; color:#888;" id="imc-detalhe"></div>
            </div>
          </div>
          <button class="btn btn-outline" onclick="abrirFormularioPeso()" style="width:100%; margin-top:16px; padding:14px; font-weight:700; border-radius:12px;"><i data-lucide="scale"></i> Atualizar Peso/Altura</button>
        </div>
        <div id="imc-form-card" class="iron-card grid-full" style="display:none; text-align:left; align-items:stretch; padding:24px;">
          <h3 style="margin-bottom:12px;"><i data-lucide="edit-3"></i> Atualizar Medidas</h3>
          <div style="width:100%;">
            <label>Peso (kg)</label>
            <input type="number" id="imc-peso" placeholder="Ex: 75" step="0.1" min="1" max="500">
            <div style="height:12px;"></div>
            <label>Altura (cm)</label>
            <input type="number" id="imc-altura" placeholder="Ex: 175" min="50" max="280">
            <div style="height:12px;"></div>
            <label>Gênero Biológico</label>
            <select id="imc-genero">
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </div>
          <div style="display:flex; gap:8px; margin-top:16px;">
            <button class="btn btn-primary" onclick="salvarPesoAltura()" style="flex:1;">Salvar</button>
            <button class="btn btn-secondary" onclick="fecharFormularioPeso()" style="flex:1;">Cancelar</button>
          </div>
        </div>
        <div class="iron-card grid-full" id="imc-evolucao-card" style="display:none; text-align:left; align-items:stretch; padding:24px;">
          <h3 style="margin-bottom:4px;"><i data-lucide="bar-chart-3"></i> Sua Evolução</h3>
          <p style="font-size:12px; color:#888; margin-bottom:12px;">Acompanhe seu peso e IMC ao longo do tempo.</p>
          <select id="imc-grafico-select" class="chart-select" style="width:100%; margin-bottom:12px;">
            <option value="peso">Peso (kg)</option>
            <option value="imc">IMC</option>
          </select>
          <div class="chart-wrapper" style="background:#161A1A; border-radius:12px; padding:16px; width:100%;">
            <canvas id="graficoIMCEvolucao"></canvas>
          </div>
        </div>
      </div>
    </div>
  `);

  // ─── MODAL APROVAR PROTOCOLO ──────────────────────────────────────────────
  inj(`
    <div class="modal-overlay" id="modal-aprovar-protocolo" style="display:none;" onclick="if(event.target===this)fecharModalAprovacao()">
      <div class="modal">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <h2 style="font-size:20px;" id="modal-aprovar-titulo">Revisar <span class="text-green">Protocolo</span></h2>
          <button onclick="fecharModalAprovacao()" style="background:none; border:none; color:#555; font-size:24px; cursor:pointer; padding:0 4px;">✕</button>
        </div>
        <div id="modal-aprovar-conteudo" class="gap-12" style="max-height:60dvh; overflow-y:auto;"></div>
        <div id="modal-aprovar-acoes" style="display:flex; gap:8px; margin-top:12px;">
          <button class="btn btn-primary" style="flex:1;" onclick="aprovarModal()"><i data-lucide="check-circle"></i> Aprovar Protocolo</button>
          <button class="btn btn-outline" style="flex:1;" onclick="ajustarModal()"><i data-lucide="x-circle"></i> Ajustar</button>
          <button class="btn btn-secondary btn-small" onclick="fecharModalAprovacao()">Fechar</button>
        </div>
      </div>
    </div>
  `);

  // ─── MODAL UPGRADE PLANO ──────────────────────────────────────────────────
  inj(`
    <div class="modal-overlay" id="modal-upgrade" onclick="if(event.target===this)fecharModalUpgrade()">
      <div class="modal" style="text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="lock"></i></div>
        <h2>Plano <span class="text-green">PRO</span></h2>
        <p style="font-size:13px; color:#888; margin:8px 0 16px; line-height:1.7;">
          Recurso exclusivo do <strong style="color:#CCFF00;">Plano PRO (R$29,90/mês)</strong>. Faça o upgrade agora e libere:<br>
          <i data-lucide="check-circle"></i> Protocolo Alimentar<br>
          <i data-lucide="check-circle"></i> Avaliação Física (IMC + Dobras)<br>
          <i data-lucide="check-circle"></i> Suporte Prioritário
        </p>
        <button class="btn btn-primary" onclick="assinarPRO()">Upgrade para PRO</button>
        <button class="btn btn-secondary mt-8" onclick="fecharModalUpgrade()">Agora não</button>
      </div>
    </div>
  `);

  // ─── MODAL CICLO ATIVO ────────────────────────────────────────────────────
  inj(`
    <div class="modal-overlay" id="modal-ciclo-ativo" onclick="if(event.target===this)fecharModalCicloAtivo()">
      <div class="modal" style="text-align:center;">
        <div style="font-size:48px; margin-bottom:12px;"><i data-lucide="clock"></i></div>
        <h2 id="ciclo-ativo-titulo">Treino em andamento</h2>
        <p style="font-size:13px; color:#888; margin:12px 0 4px; line-height:1.7;">
          Você ainda está no ciclo atual do seu <span id="ciclo-ativo-tipo">treino</span>.<br>
          Uma nova solicitação será liberada em:
        </p>
        <div style="background:#0d0d0d; border:1px solid #2A3232; border-radius:16px; padding:20px 16px; margin:16px 0;">
          <div style="font-size:48px; font-weight:800; color:#CCFF00; line-height:1;" id="ciclo-ativo-dias">—</div>
          <div style="font-size:12px; color:#555; margin-top:4px;">dias restantes</div>
          <div style="font-size:12px; color:#888; margin-top:8px;">Libera em <strong id="ciclo-ativo-data">—</strong></div>
        </div>
        <button class="btn btn-primary" onclick="fecharModalCicloAtivo()">Entendido</button>
      </div>
    </div>
  `);

  // ─── ADMIN ────────────────────────────────────────────────────────────────
  inj(`
    <div class="page no-nav" id="page-admin">
      <div class="admin-layout">
        <aside class="admin-sidebar">
          <div class="admin-logo">
            <img src="logo.webp" alt="IRONIQ">
            <div class="admin-logo-text">IRON<span>IQ</span>IA</div>
          </div>
          <nav class="admin-nav">
            <button class="admin-nav-item active" data-section="admin-dashboard" onclick="adminNav('admin-dashboard')"><span class="icon"><i data-lucide="bar-chart-3"></i></span> <span>Dashboard</span></button>
            <button class="admin-nav-item" data-section="admin-usuarios" onclick="adminNav('admin-usuarios')"><span class="icon"><i data-lucide="users"></i></span> <span>Usuários</span></button>
            <button class="admin-nav-item" data-section="admin-planos" onclick="adminNav('admin-planos')"><span class="icon"><i data-lucide="credit-card"></i></span> <span>Planos</span></button>
            <button class="admin-nav-item" data-section="admin-personais" onclick="adminNav('admin-personais')"><span class="icon"><i data-lucide="dumbbell"></i></span> <span>Personais</span></button>
            <button class="admin-nav-item" data-section="admin-comissoes" onclick="adminNav('admin-comissoes')"><span class="icon"><i data-lucide="dollar-sign"></i></span> <span>Comissões</span></button>
            <button class="admin-nav-item" data-section="admin-config" onclick="adminNav('admin-config')"><span class="icon"><i data-lucide="settings"></i></span> <span>Configurações</span></button>
          </nav>
          <button class="admin-sair" onclick="sairAdmin()"><i data-lucide="log-out" style="width:16px;height:16px;"></i> <span>SAIR</span></button>
        </aside>
        <main class="admin-content">
          <button class="admin-mobile-toggle" onclick="toggleAdminSidebar()" id="admin-menu-toggle"><i data-lucide="menu"></i></button>
          <div class="admin-backdrop" id="admin-backdrop" onclick="toggleAdminSidebar()"></div>
          <div id="admin-dashboard" class="admin-section active">
            <div class="admin-header"><h2><i data-lucide="bar-chart-3"></i> Dashboard</h2><span style="font-size:12px;color:#555;" id="admin-dash-date"></span></div>
            <div class="page-grid-container">
              <div class="banner-trial-premium" id="admin-banner-trial">
                <div>
                  <div class="text"><i data-lucide="clock"></i> TESTE GRÁTIS ATIVO</div>
                  <div style="font-size:12px; color:#888; margin-top:2px;">Usuários aproveitam 48h liberadas</div>
                </div>
                <div class="countdown" id="admin-trial-status" style="font-size:16px;">48h</div>
              </div>
              <div class="admin-dash-metrics" id="admin-dash-cards"></div>
              <div class="iron-card" style="justify-content:center; padding:20px;"><canvas id="chart-crescimento-usuarios" height="180"></canvas></div>
              <div class="iron-card" style="justify-content:center; padding:20px;"><canvas id="chart-crescimento-assinaturas" height="180"></canvas></div>
              <div class="iron-card" style="justify-content:center; padding:20px;"><canvas id="chart-distribuicao-planos" height="180"></canvas></div>
              <div class="iron-card" style="align-items:flex-start; text-align:left; gap:12px;">
                <div class="label" style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.8px;font-weight:600;width:100%;">Atividade Recente</div>
                <div id="admin-dash-activity" style="font-size:13px;color:#888;width:100%;">Nenhuma atividade registrada.</div>
              </div>
            </div>
          </div>
          <div id="admin-usuarios" class="admin-section">
            <div class="admin-header"><h2><i data-lucide="users"></i> Usuários</h2><span style="font-size:12px;color:#555;" id="admin-users-count"></span></div>
            <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;">
              <input type="text" id="admin-users-search" placeholder="Buscar por nome ou e-mail..." oninput="carregarAdminUsuarios()" style="flex:1;min-width:180px;padding:10px 14px;border-radius:10px;background:#1F2525;border:1px solid #2A3232;color:#E8E8E8;font-size:13px;outline:none;font-family:inherit;">
              <div style="display:flex;gap:4px;flex-wrap:wrap;" id="admin-users-filters">
                <button class="admin-filter-btn active" data-filter="todos" onclick="adminFiltrarUsuarios('todos')">Todos</button>
                <button class="admin-filter-btn" data-filter="alunos" onclick="adminFiltrarUsuarios('alunos')">Alunos</button>
                <button class="admin-filter-btn" data-filter="personais" onclick="adminFiltrarUsuarios('personais')">Personais</button>
                <button class="admin-filter-btn" data-filter="ativos" onclick="adminFiltrarUsuarios('ativos')">Ativos</button>
                <button class="admin-filter-btn" data-filter="bloqueados" onclick="adminFiltrarUsuarios('bloqueados')">Bloqueados</button>
              </div>
            </div>
            <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>E-mail</th><th>Tipo</th><th>Plano</th><th>Status</th><th>Cadastro</th><th style="text-align:center;">Ações</th></tr></thead><tbody id="admin-users-tbody"></tbody></table></div>
          </div>
          <div class="modal-overlay" id="modal-admin-user">
            <div class="modal">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                <h2>Editar <span class="text-green">Usuário</span></h2>
                <button onclick="fecharModalAdmin('modal-admin-user')" style="background:none;border:none;color:#555;font-size:24px;cursor:pointer;">✕</button>
              </div>
              <p class="sub" id="admin-user-modal-sub">Gerenciar conta do usuário</p>
              <input type="hidden" id="admin-user-edit-email">
              <div class="admin-form-row">
                <div class="admin-form-group"><label>Nome</label><input type="text" id="admin-user-edit-nome"></div>
                <div class="admin-form-group"><label>Sobrenome</label><input type="text" id="admin-user-edit-sobrenome"></div>
              </div>
              <div class="admin-form-row">
                <div class="admin-form-group"><label>Plano</label><select id="admin-user-edit-plano"><option value="">— Sem plano —</option><option value="aluno_start">Aluno START</option><option value="aluno_pro">Aluno PRO</option><option value="personal_free">Personal FREE</option><option value="personal_pro">Personal PRO</option><option value="personal_elite">Personal ELITE</option></select></div>
                <div class="admin-form-group"><label>Status</label><select id="admin-user-edit-status"><option value="ativo">Ativo</option><option value="bloqueado">Bloqueado</option></select></div>
              </div>
              <div style="display:flex;gap:8px;margin-top:16px;">
                <button class="btn btn-primary" onclick="adminSalvarEdicaoUsuario()">Salvar</button>
                <button class="btn btn-secondary" onclick="fecharModalAdmin('modal-admin-user')">Cancelar</button>
              </div>
            </div>
          </div>
          <div id="admin-planos" class="admin-section">
            <div class="admin-header">
              <h2><i data-lucide="credit-card"></i> Planos</h2>
              <div style="display:flex;gap:6px;">
                <button class="btn btn-primary btn-small" onclick="adminSalvarPlanos()"><i data-lucide="save"></i> Salvar</button>
                <button class="btn btn-secondary btn-small" onclick="adminResetarPlanos()"><i data-lucide="refresh-cw"></i> Restaurar</button>
              </div>
            </div>
            <p class="sub" style="margin-bottom:16px;">Edite os planos abaixo. Todas as alterações são salvas no navegador.</p>
            <div class="plan-editor" id="admin-planos-editor"></div>
          </div>
          <div id="admin-personais" class="admin-section">
            <div class="admin-header"><h2><i data-lucide="dumbbell"></i> Personais</h2><span style="font-size:12px;color:#555;" id="admin-personais-count"></span></div>
            <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Nome</th><th>Tipo</th><th>E-mail</th><th>Alunos</th><th>Plano</th><th>Limite</th><th>Status</th><th style="text-align:center;">Ações</th></tr></thead><tbody id="admin-personais-tbody"></tbody></table></div>
          </div>
          <div id="admin-comissoes" class="admin-section">
            <div class="admin-header">
              <h2><i data-lucide="dollar-sign"></i> Comissões de Personais</h2>
              <span style="font-size:12px;color:#555;" id="admin-comissoes-count"></span>
            </div>
            <div class="iron-card" style="padding:20px;margin-bottom:16px;justify-content:center;">
              <canvas id="chart-comissoes-personais" height="160"></canvas>
            </div>
            <div class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr><th>Personal</th><th>E-mail</th><th>Treinos Aceitos</th><th>Dietas Aceitas</th><th>Total Gerado</th><th>Já Pago</th><th>A Pagar</th><th style="text-align:center;">Ações</th></tr></thead>
                <tbody id="admin-comissoes-tbody"></tbody>
              </table>
            </div>
          </div>
          <div id="admin-config" class="admin-section">
            <div class="admin-header"><h2><i data-lucide="settings"></i> Configurações Gerais</h2><button class="btn btn-primary btn-small" onclick="adminSalvarConfig()"><i data-lucide="save"></i> Salvar Alterações</button></div>
            <div class="card" style="background:#161A1A;border-radius:14px;padding:20px;border:1px solid #1F2525;">
              <div class="admin-form-row">
                <div class="admin-form-group"><label>Nome do Sistema</label><input type="text" id="config-nome-sistema" placeholder="IRONIQA"></div>
                <div class="admin-form-group"><label>Logo URL</label><input type="text" id="config-logo" placeholder="logo.webp"></div>
              </div>
              <div class="admin-form-row">
                <div class="admin-form-group"><label>Cor Principal</label><input type="color" id="config-cor-principal" value="#CCFF00" style="height:40px;padding:2px;background:#0E1111;border:2px solid #2A3232;border-radius:8px;"></div>
                <div class="admin-form-group"><label>WhatsApp Suporte</label><input type="text" id="config-whatsapp" placeholder="5511999999999"></div>
              </div>
              <div class="admin-form-row">
                <div class="admin-form-group"><label>E-mail Suporte</label><input type="email" id="config-email-suporte" placeholder="suporte@ironqia.com"></div>
                <div class="admin-form-group"><label>Admin E-mail</label><input type="email" id="admin-config-email" placeholder="admin@admin.com"></div>
              </div>
              <div class="admin-form-row">
                <div class="admin-form-group"><label>Admin Senha</label><input type="text" id="admin-config-senha" placeholder="1123456"></div>
                <div class="admin-form-group"><label>Duração Trial (horas)</label><input type="number" id="admin-config-trial" placeholder="48" min="1" max="720"></div>
              </div>
              <div class="admin-form-group"><label>Mensagem de Manutenção</label><textarea id="config-manutencao" rows="2" style="background:#1F2525;border:1px solid #2A3232;border-radius:8px;padding:8px 10px;color:#E8E8E8;font-size:13px;outline:none;font-family:inherit;width:100%;resize:vertical;" placeholder="Deixe vazio para desativar"></textarea></div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `);

})();
