// Lógica pura do pedido de agendamento — sem I/O (sem rede, sem env vars),
// pra poder ser testada isoladamente. api/agendar.js cuida só do HTTP e do
// envio de e-mail; a matemática e a validação moram aqui.
const KG_SERVICES = require("../services.js");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PERIODOS = { manha: "Manhã", tarde: "Tarde", noite: "Noite" };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatBRL(centavos) {
  return "R$ " + (centavos / 100).toFixed(2).replace(".", ",");
}

// Recalcula o pedido a partir do catálogo do servidor — nunca confia no
// preço vindo do navegador. Retorna null se algum serviço for desconhecido
// ou se a lista vier vazia.
function computeOrder(servicos) {
  const idsUnicos = new Set(servicos || []);
  const escolhidos = KG_SERVICES.filter((s) => idsUnicos.has(s.id));
  if (escolhidos.length === 0 || escolhidos.length !== idsUnicos.size) {
    return null;
  }
  const subtotal = escolhidos.reduce((soma, s) => soma + s.precoCentavos, 0);
  const sinal = Math.round(subtotal / 2);
  const restante = subtotal - sinal;
  return { escolhidos, subtotal, sinal, restante };
}

module.exports = { escapeHtml, formatBRL, computeOrder, EMAIL_RE, PERIODOS };
