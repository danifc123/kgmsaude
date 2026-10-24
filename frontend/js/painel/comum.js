import { el, icone } from "../dom.js";
import { dataIso, dataLocal, formatarMoeda, linkWhatsApp } from "../formatadores.js";

// region Status e ações

export const ROTULO_STATUS = {
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
  CONFIRMADO: "Confirmado",
  EXPIRADO: "Expirado",
  PENDENTE: "Aguardando sinal",
};

// Agendamentos que não vão acontecer — somem da agenda por padrão.
export const STATUS_FECHADOS = ["CANCELADO", "EXPIRADO"];

// Botões de cada status (as transições batem com TRANSICOES_PERMITIDAS da API).
export const ACOES_POR_STATUS = {
  CANCELADO: [],
  CONCLUIDO: [],
  CONFIRMADO: [
    { classe: "btn-primary", rotulo: "Marcar como concluído", status: "CONCLUIDO" },
    { classe: "btn-danger", confirmar: "Cancelar este agendamento? O horário volta a ficar livre.", rotulo: "Cancelar", status: "CANCELADO" },
  ],
  EXPIRADO: [],
  PENDENTE: [
    { classe: "btn-primary", rotulo: "Confirmar sinal recebido", status: "CONFIRMADO" },
    { classe: "btn-danger", confirmar: "Cancelar este agendamento? O horário volta a ficar livre.", rotulo: "Cancelar", status: "CANCELADO" },
  ],
};

export function seloStatus(status) {
  return el("span", { class: `status status-${status}` }, ROTULO_STATUS[status]);
}

// Sinal pago via Pix, mas o atendimento não vai acontecer: precisa devolver.
export function precisaDevolver(agendamento) {
  return agendamento.pagamento?.status === "APROVADO" && STATUS_FECHADOS.includes(agendamento.status);
}

// endregion

// region Ícones (traço 2px, 24x24)

export const ICONES = {
  agenda: "M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2ZM4 10h16M8 2v4M16 2v4",
  alerta: "M12 8v5M12 16.5v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z",
  baixar: "M12 3v12M7 10l5 5 5-5M5 21h14",
  buscar: "M21 21l-4.3-4.3M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z",
  check: "M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3",
  dinheiro: "M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6",
  direita: "M9 6l6 6-6 6",
  esquerda: "M15 18l-6-6 6-6",
  fechar: "M18 6 6 18M6 6l12 12",
  folga: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  inicio: "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
  lista: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  relogio: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z",
  servicos: "M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8ZM7.5 7.5h.01",
  telefone: "M4 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L14 13l5 2v4a2 2 0 0 1-2 2C9.5 21 3 14.5 3 6a2 2 0 0 1 1-2Z",
};

export function botaoIcone(nomeIcone, rotulo, onClick) {
  return el("button", { "aria-label": rotulo, class: "icon-btn", onClick, title: rotulo, type: "button" }, icone(ICONES[nomeIcone]));
}

// endregion

// region Datas

export function hojeIso() {
  return dataIso(new Date());
}

// Segunda-feira da semana de `data`.
export function inicioDaSemana(data) {
  const resultado = new Date(data.getFullYear(), data.getMonth(), data.getDate());
  resultado.setDate(resultado.getDate() - ((resultado.getDay() + 6) % 7));
  return resultado;
}

export function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

// "2026-10-23T14:30:00" → minutos desde 00:00 (870).
export function minutosDoDia(isoDataHora) {
  return Number(isoDataHora.slice(11, 13)) * 60 + Number(isoDataHora.slice(14, 16));
}

// "23 out"
export function formatarDataCurta(iso) {
  return dataLocal(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "short" }).replace(".", "");
}

// "sex., 23 out" → "sex 23/10"
export function formatarDiaCurto(iso) {
  const data = dataLocal(iso);
  const semana = data.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "");
  return `${semana} ${String(data.getDate()).padStart(2, "0")}/${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export function saudacao() {
  const hora = new Date().getHours();
  if (hora < 12) return "Bom dia";
  if (hora < 18) return "Boa tarde";
  return "Boa noite";
}

// endregion

// region Textos

export function textoServicos(agendamento) {
  return agendamento.itens.map((i) => i.nome).join(", ");
}

export function linkWhatsAppCliente(agendamento) {
  const primeiroNome = agendamento.clienteNome.split(" ")[0];
  const mensagem = `Olá, ${primeiroNome}! Aqui é a Katiuschia, sobre seu agendamento ${agendamento.codigo}.`;
  return linkWhatsApp(mensagem, agendamento.clienteTelefone);
}

export function plural(quantidade, singular, pluralTexto) {
  return `${quantidade} ${quantidade === 1 ? singular : pluralTexto}`;
}

export { formatarMoeda };

// endregion

// region Estados de carregamento

export function carregando() {
  return el("p", { class: "loading" }, "Carregando…");
}

export function erroCarregamento(mensagem) {
  return el("p", { class: "alert", role: "alert" }, mensagem);
}

// endregion
