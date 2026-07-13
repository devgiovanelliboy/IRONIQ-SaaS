# IRONQI — Cloud Functions (prontas, aguardando plano Blaze)

Todo o código está escrito, com dependências instaladas e sintaxe validada.
**Bloqueio:** o projeto `ironiq-e9f7e` está no plano **Spark (grátis)**. Cloud Functions
exigem o plano **Blaze (pay-as-you-go)** — o deploy falhou ao tentar habilitar
`artifactregistry.googleapis.com`. Ativar o Blaze exige adicionar forma de pagamento
(ação da conta, só o dono pode fazer):
https://console.firebase.google.com/project/ironiq-e9f7e/usage/details

> Custo na prática: para este volume, o Blaze fica dentro da cota grátis (≈ R$0). Você só
> paga se escalar muito. Dá pra definir um **orçamento/alerta** para garantir.

## O que cada função faz

| Função | Tipo | Papel |
|---|---|---|
| `agendaCheckIn` | callable | Check-in **autoritativo**: valida vínculo + capacidade e grava `checkins/{uid}` + `checkinCount` numa transação no servidor. |
| `agendaCancelCheckIn` | callable | Cancela o check-in e decrementa o contador. |
| `reconcileCheckinCount` | trigger | Recalcula `checkinCount` pela contagem real da subcoleção (defesa contra divergência). |
| `setUserRole` | callable (admin) | Atribui `perfil`/`tipoPersonal` a outro usuário (doc + custom claim) e troca o Personal Principal. Faz o painel admin **persistir** mudança de tipo. |
| `enforceLimiteAlunos` | trigger | Reverte o vínculo de um aluno que exceda o limite do personal (limite em `configuracoes/limites_alunos`). |
| `activateTrial` | callable | Ativa uma única avaliação gratuita de 24h no servidor. |
| `acceptProtocol` | callable | Finaliza aceite, ciclo, protocolo atual e comissão em operação autoritativa. |
| `adminDeleteUser` | callable (admin) | Exclui Firebase Auth, perfil, subcoleções e referências relacionadas. |
| `syncUidMap` | trigger | Mantém o mapa e-mail → UID sem permitir escrita do cliente. |

## Passos para ativar (quando o Blaze estiver ligado)

1. Ative o Blaze no link acima.
2. Defina orçamento e alertas no Google Cloud.
3. Publique funções, regras e hosting juntos: `firebase deploy --only functions,firestore:rules,hosting`.
4. Re-rodar os E2E ao vivo de dieta, identidade e agenda.

## Enquanto o Blaze não é ativado

- **Papéis** já podem ser atribuídos hoje, sem Functions, pelo script local
  [../backend/admin-roles.js](../backend/admin-roles.js) (usa Admin SDK + `serviceAccount.json`).
- Não publique isoladamente o novo hosting/regras: aceite, trial, exclusão e check-in já
  dependem das Functions. O deploy deve ser conjunto após ativar o Blaze.
