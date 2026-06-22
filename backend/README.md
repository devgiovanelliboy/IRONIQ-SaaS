# IRONQI — Backend de papéis (Frente 2: hardening de segurança)

## Por que existe

As regras do Firestore confiavam em `perfil` / `tipoPersonal` lidos do **próprio documento do
usuário**, que o usuário pode escrever. Isso permitia auto-escalação: um aluno setava
`perfil: 'admin'` no próprio doc e passava a poder trocar o Personal Principal, ler/quitar
todas as comissões e ler protocolos de todos os autônomos.

As regras foram endurecidas (`firestore.rules`): o cliente **não consegue mais** gravar
`perfil: 'admin'` nem `tipoPersonal: 'personal_interno' | 'personal_principal'` no próprio doc.
Portanto papéis privilegiados agora só são atribuídos por aqui, via **Admin SDK** (ambiente
confiável, ignora as regras).

## O que mudou nas regras (já aplicado em `firestore.rules`)

- `usuarios/{uid}` `create`: bloqueia nascer com papel privilegiado.
- `usuarios/{uid}` `update` (dono): pode manter o papel atual, mas não pode **escalar**
  `perfil`/`tipoPersonal` para valor privilegiado.
- `usuarios/{uid}` `read`: personal lê alunos onde `personal_vinculado` **ou** `chat_atendente`
  é o e-mail dele (suporte à delegação de chat — Frente 1).
- `usuarios/{uid}` `update` (delegação): o Personal Principal pode alterar **somente**
  `chat_atendente` do aluno autônomo.

## Setup (uma vez)

1. Firebase Console → ⚙️ Configurações do projeto → **Contas de serviço** →
   **Gerar nova chave privada**. Salve como `backend/serviceAccount.json`.
2. **Não comite** esse arquivo (já está no `.gitignore`).
3. Na raiz do projeto: `npm install` (o `firebase-admin` já está em `package.json`).

## Uso

```bash
node backend/admin-roles.js whoami        <email>           # inspeciona papel atual
node backend/admin-roles.js set-admin     <email>           # promove a admin
node backend/admin-roles.js unset-admin   <email>
node backend/admin-roles.js set-tipo      <email> personal_interno
node backend/admin-roles.js set-principal <email>           # vira Personal Principal (rebaixa o anterior)
```

> Após mudar papel, o usuário precisa **relogar** para o novo token/claim valer.

## Ordem de deploy segura

1. `firebase deploy --only firestore:rules` — aplica o hardening.
2. Rode `set-admin` / `set-tipo` para os usuários que **já** eram privilegiados
   (eles mantêm o papel mesmo sem isso, mas isto grava o custom claim e padroniza).
3. Daqui pra frente, todo novo admin/interno/principal é criado por este script.

## Limitação conhecida (painel admin)

O botão "alterar tipo" no painel admin (`adminPersonalAlterarTipo`) tenta gravar o doc de
**outro** usuário — o que as regras (corretamente) negam. Ele só atualiza o `localStorage` da
sessão do admin. A atribuição **autoritativa** de papel é feita por este script. Uma evolução
futura seria expor estes comandos via Cloudflare Worker autenticado como admin, para o painel
chamar um endpoint em vez do script local.
