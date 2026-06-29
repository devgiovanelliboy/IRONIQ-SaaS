// ─── UTILITÁRIOS GLOBAIS ───────────────────────────────────────────────────
// Funções puras sem dependências externas. Carregadas antes de qualquer módulo.

function tratarErro(code) {
  var erros = {
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha inválidos.',
    'auth/email-already-in-use': 'Este e-mail já está cadastrado.',
    'auth/weak-password': 'A senha deve ter no mínimo 6 caracteres.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Tente novamente mais tarde.',
    'auth/insufficient-permission': 'Permissão negada pelo Firebase. O sistema continuará funcionando no armazenamento local.',
    'permission-denied': 'Permissão negada pelo Firebase. O sistema continuará funcionando no armazenamento local.'
  };
  return erros[code] || 'Erro ao conectar. Verifique sua internet.';
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#039;');
}
