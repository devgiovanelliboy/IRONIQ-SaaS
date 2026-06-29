// ─── ESTADO GLOBAL EM MEMÓRIA ────────────────────────────────────────────────
// Fonte única de dados em runtime. Carregado do Firestore a cada sessão.
// localStorage guarda apenas flags de sessão: ironqi_logado, ironqi_personal_logado,
// ironqi_admin_logado, ultima_pagina, ironqi_evolucao_aluno, ironqi_protocolo_aluno,
// ironqi_protocolo, ironqi_dieta_texto.

var _st = {
  usuarios: {},
  pendentes: [],
  protocolos: [],
  comissoes: [],
  comissoesPagas: {},
  planos: {},
  planoVencimento: {},
  trialExpira: {},
  trialConfig: { ativo: true, duracao: 48, mensagem: 'Teste grátis de 48h — aproveite todos os recursos!' },
  ultimoAceite: {},
  ultimoAjuste: {},
  agua: {},
  imcHistorico: {},
  historico: {},
  notificacoes: [],
  adminPlanosConfig: {},
  cupons: [],
  configGeral: {},
  personalLimites: {},
  personalData: {},
  userStatus: {},
  chatMsgs: [],
  agendaSlots: [],
  agendaCheckins: []
};

// ─── CONSTANTES DE CONFIGURAÇÃO ──────────────────────────────────────────────

// Personal principal: gestor de todos os alunos autônomos.
// Sobrescrito pelo Firestore via carregarPersonalPrincipal().
var PERSONAL_PRINCIPAL = 'lukas.athademos@gmail.com';

// E-mail do revisor de protocolos de IA.
var REVISOR_EMAIL = 'lukas.athademos@gmail.com';

// ─── CACHE DE UID ────────────────────────────────────────────────────────────
// Mapeamento email→uid em memória. Não persiste entre sessões.
var emailToUid = {};
