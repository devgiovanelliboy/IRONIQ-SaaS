// ─── FIREBASE CONFIG ───
const firebaseConfig = {
  apiKey: "AIzaSyDrMebVU4Cu2dzLjbSJ-uaqABNv9igULVw",
  authDomain: "ironiq-e9f7e.firebaseapp.com",
  projectId: "ironiq-e9f7e",
  storageBucket: "ironiq-e9f7e.firebasestorage.app",
  messagingSenderId: "121999585607",
  appId: "1:121999585607:web:6fde26b2148740c7151c62",
  measurementId: "G-K8XEYBXBNS"
};

// ─── IA (Groq) ───
// A chave da Groq NÃO fica mais aqui. As chamadas de IA passam pela Cloud Function
// "groqProxy" (pasta functions/), que guarda a chave no servidor e exige usuário
// autenticado. Ver IA_PROXY_URL / _iaFetch em index.html.
//
// ⚠️ A chave antiga (gsk_Rv3p...) já esteve exposta publicamente — REVOGUE-A em
//    https://console.groq.com/keys, gere uma nova e coloque em functions/.env.
