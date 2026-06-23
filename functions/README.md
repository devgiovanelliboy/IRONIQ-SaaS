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

## Passos para ativar (quando o Blaze estiver ligado)

1. Ative o Blaze no link acima.
2. Reative a seção no `firebase.json`:
   ```json
   "functions": { "source": "functions" },
   ```
3. `firebase deploy --only functions`
4. **Aí me chame** para a 2ª fase (que eu segurei de propósito para não quebrar produção):
   - Trocar `agendaCheckin`/`agendaCancelarCheckin` no `index.html` para chamar os callables
     (`firebase.functions().httpsCallable(...)`) em vez de gravar direto no Firestore.
   - Endurecer as regras: remover a escrita de `checkins` e de `agenda_slots.checkinCount`
     pelo cliente (passam a ser feitas só pelas functions / Admin SDK). Leitura continua igual.
   - Ligar `adminPersonalAlterarTipo` ao `setUserRole`.
   - Migrar `ironqi_personal_limites` (hoje só localStorage) para `configuracoes/limites_alunos`
     no Firestore, para o `enforceLimiteAlunos` enxergar os limites.
   - Re-rodar o E2E ao vivo (`backend/qa-agenda-live.test.js`).

## Enquanto o Blaze não é ativado

- **Papéis** já podem ser atribuídos hoje, sem Functions, pelo script local
  [../backend/admin-roles.js](../backend/admin-roles.js) (usa Admin SDK + `serviceAccount.json`).
- O check-in continua funcionando pelo caminho client-side atual (testado, 10/10). O único
  caveat é o `checkinCount` ser gravável pelo cliente — mitigado, não crítico (a verdade da
  presença é a subcoleção, que só o personal lê).
