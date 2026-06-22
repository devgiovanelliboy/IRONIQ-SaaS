# Proxy da IA no Cloudflare Workers (grátis, sem cartão)

Objetivo: tirar a chave da Groq do navegador. O app passa a chamar este Worker,
que guarda a chave e só responde a usuários logados do seu Firebase.

## Passo a passo (≈5 min, tudo pelo navegador)

1. **Crie uma conta grátis** em https://dash.cloudflare.com/sign-up
   (não pede cartão de crédito).

2. No painel, vá em **Workers & Pages → Create → Create Worker**.
   - Dê um nome, ex.: `ironqi-groq-proxy`.
   - Clique **Deploy** (cria um worker "hello world").

3. Clique em **Edit code** (ou "Quick edit").
   - Apague tudo e **cole o conteúdo de** `cloudflare-worker/groq-proxy.js`.
   - Clique **Deploy**.

4. Configure os segredos: **Settings → Variables and Secrets**.
   - Adicione **Secret** `GROQ_API_KEY` = sua chave da Groq (a NOVA, ver abaixo).
   - Adicione **Variable** `FIREBASE_PROJECT_ID` = `ironiq-e9f7e`.
   - Salve / **Deploy** de novo.

5. Copie a **URL do Worker** (algo como
   `https://ironqi-groq-proxy.SEU-SUBDOMINIO.workers.dev`).

6. **Me mande essa URL.** Eu coloco no app (`IA_PROXY_URL`) e publico o hosting.
   (O hosting do Firebase NÃO precisa de Blaze.)

## ⚠️ Segurança da chave
A chave antiga (`gsk_Rv3p...`) já esteve exposta publicamente.
- **Revogue-a** em https://console.groq.com/keys
- Gere uma **nova** e use-a no passo 4 (`GROQ_API_KEY`).
- A chave fica só no Cloudflare (secret), nunca no app.

## Como funciona
- App pega o ID token do usuário logado (Firebase Auth) e chama o Worker.
- O Worker valida o token (assinatura RS256 + aud/iss/exp do projeto `ironiq-e9f7e`)
  e só então repassa o pedido à Groq com a chave do servidor.
- CORS liberado para o app; modelos/tokens limitados para evitar abuso.
