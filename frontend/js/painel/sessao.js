import { ApiError, request } from "../api.js";

// Login do painel: guarda o JWT no navegador e avisa quando ele expira.
const CHAVE_TOKEN = "kg-admin-token";

let aoExpirar = () => {};
let token = lerToken();

function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

function salvarToken(novo) {
  token = novo;
  try {
    if (novo) localStorage.setItem(CHAVE_TOKEN, novo);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // Sem storage o login dura só enquanto a página estiver aberta.
  }
}

export function definirAoExpirar(callback) {
  aoExpirar = callback;
}

// E-mail de quem está logado, lido do próprio token.
export function emailLogado() {
  try {
    return JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).sub;
  } catch {
    return "";
  }
}

export async function entrar(email, senha) {
  const { accessToken } = await request("/auth/login", { body: { email, senha }, method: "POST" });
  salvarToken(accessToken);
}

/** Requisição autenticada. Em 401 encerra a sessão e volta para o login. */
export async function requestAdmin(caminho, opcoes = {}) {
  try {
    return await request(caminho, { ...opcoes, token });
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 401) {
      salvarToken(null);
      aoExpirar();
    }
    throw erro;
  }
}

export function sair() {
  salvarToken(null);
}

export function temSessao() {
  return Boolean(token);
}
