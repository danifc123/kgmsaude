import { CONFIG } from "./config.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

// Extrai uma mensagem legível do corpo de erro do FastAPI.
function extrairMensagem(corpo) {
  if (typeof corpo?.detail === "string") return corpo.detail;
  if (Array.isArray(corpo?.detail) && corpo.detail.length) {
    return corpo.detail[0].msg.replace(/^Value error, /, "");
  }
  return "Algo deu errado. Tente novamente.";
}

/**
 * Faz a requisição à API e devolve o JSON da resposta (ou null em 204).
 * Lança ApiError com a mensagem do servidor quando o status não é 2xx.
 */
export async function request(caminho, { body, method = "GET", token } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${CONFIG.apiUrl}${caminho}`, {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers,
      method,
    });
  } catch {
    throw new ApiError("Sem conexão. Verifique a internet e tente novamente.", 0);
  }

  if (resposta.status === 204) return null;
  const corpo = await resposta.json().catch(() => null);
  if (!resposta.ok) throw new ApiError(extrairMensagem(corpo), resposta.status);
  return corpo;
}
