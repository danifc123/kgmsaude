import { el, icone } from "../../dom.js";
import { dataIso, formatarHora, formatarMoeda, formatarTelefone } from "../../formatadores.js";
import {
  ICONES,
  ROTULO_STATUS,
  carregando,
  erroCarregamento,
  formatarDiaCurto,
  plural,
  precisaDevolver,
  seloStatus,
  textoServicos,
} from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Agendamentos";

const PERIODOS = [
  { id: "proximos", rotulo: "Próximos" },
  { id: "mes", rotulo: "Este mês" },
  { id: "mes-anterior", rotulo: "Mês passado" },
  { id: "personalizado", rotulo: "Escolher datas" },
];

const FILTROS_STATUS = [
  { id: "TODOS", rotulo: "Todos os status" },
  { id: "PENDENTE", rotulo: "Aguardando sinal" },
  { id: "CONFIRMADO", rotulo: "Confirmados" },
  { id: "CONCLUIDO", rotulo: "Concluídos" },
  { id: "FECHADOS", rotulo: "Cancelados e expirados" },
];

const estado = { ate: "", busca: "", de: "", periodo: "proximos", status: "TODOS" };

// Query string da API para o período escolhido.
function queryDoPeriodo() {
  const hoje = new Date();
  const mes = (deslocamento) => {
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento, 1);
    const fim = new Date(hoje.getFullYear(), hoje.getMonth() + deslocamento + 1, 0);
    return `?inicio=${dataIso(inicio)}&fim=${dataIso(fim)}`;
  };
  if (estado.periodo === "mes") return mes(0);
  if (estado.periodo === "mes-anterior") return mes(-1);
  if (estado.periodo === "personalizado" && estado.de && estado.ate) return `?inicio=${estado.de}&fim=${estado.ate}`;
  return "";
}

function filtrar(agendamentos) {
  const termo = estado.busca.trim().toLowerCase();
  const digitos = termo.replace(/\D/g, "");
  return agendamentos.filter((a) => {
    if (estado.status === "FECHADOS" && !["CANCELADO", "EXPIRADO"].includes(a.status)) return false;
    if (!["TODOS", "FECHADOS"].includes(estado.status) && a.status !== estado.status) return false;
    if (!termo) return true;
    return (
      a.clienteNome.toLowerCase().includes(termo) ||
      a.codigo.toLowerCase().includes(termo) ||
      textoServicos(a).toLowerCase().includes(termo) ||
      (digitos.length >= 3 && a.clienteTelefone.includes(digitos))
    );
  });
}

// Planilha CSV no formato do Excel em português (";" e vírgula decimal).
function exportarCsv(agendamentos) {
  const reais = (centavos) => (centavos / 100).toFixed(2).replace(".", ",");
  const celula = (valor) => `"${String(valor ?? "").replace(/"/g, '""')}"`;
  const cabecalho = ["Código", "Data", "Início", "Fim", "Cliente", "WhatsApp", "E-mail", "Serviços", "Total (R$)", "Sinal (R$)", "Status", "Pix"];
  const linhas = agendamentos.map((a) => [
    a.codigo,
    a.inicio.slice(0, 10).split("-").reverse().join("/"),
    formatarHora(a.inicio),
    formatarHora(a.fim),
    a.clienteNome,
    formatarTelefone(a.clienteTelefone),
    a.clienteEmail,
    textoServicos(a),
    reais(a.totalCentavos),
    reais(a.sinalCentavos),
    ROTULO_STATUS[a.status],
    a.pagamento ? { APROVADO: "Pago", CANCELADO: "Não pago", PENDENTE: "Aguardando" }[a.pagamento.status] : "Manual",
  ]);
  const csv = "﻿" + [cabecalho, ...linhas].map((l) => l.map(celula).join(";")).join("\r\n");
  const link = el("a", { download: `agendamentos-${dataIso(new Date())}.csv`, href: URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })) });
  link.click();
  URL.revokeObjectURL(link.href);
}

function situacaoPix(agendamento) {
  if (precisaDevolver(agendamento)) return el("span", { class: "status status-PENDENTE" }, "Devolver sinal");
  if (!agendamento.pagamento) return el("span", { class: "muted" }, "Manual");
  return el("span", { class: agendamento.pagamento.status === "APROVADO" ? "pix-ok" : "muted" }, { APROVADO: "Pago", CANCELADO: "Não pago", PENDENTE: "Aguardando" }[agendamento.pagamento.status]);
}

function criarTabela(agendamentos, ctx, aoAlterar) {
  if (agendamentos.length === 0) return el("p", { class: "empty" }, "Nenhum agendamento encontrado com esses filtros.");
  const total = agendamentos.filter((a) => ["CONFIRMADO", "CONCLUIDO"].includes(a.status)).reduce((s, a) => s + a.totalCentavos, 0);

  return el(
    "div",
    {},
    el(
      "table",
      { class: "tabela" },
      el("thead", {}, el("tr", {}, ["Data", "Horário", "Cliente", "Serviços", "Total", "Sinal", "Pix", "Status"].map((t, i) => el("th", { class: i === 4 || i === 5 ? "num" : "" }, t)))),
      el(
        "tbody",
        {},
        agendamentos.map((a) =>
          el(
            "tr",
            { onClick: () => ctx.abrirDetalhe(a, aoAlterar), onKeydown: (e) => e.key === "Enter" && ctx.abrirDetalhe(a, aoAlterar), tabindex: "0" },
            el("td", { class: "forte", "data-label": "Data" }, formatarDiaCurto(a.inicio)),
            el("td", { class: "nowrap", "data-label": "Horário" }, `${formatarHora(a.inicio)} – ${formatarHora(a.fim)}`),
            el("td", { "data-label": "Cliente" }, el("div", { class: "forte" }, a.clienteNome), el("div", { class: "muted" }, formatarTelefone(a.clienteTelefone))),
            el("td", { "data-label": "Serviços" }, textoServicos(a)),
            el("td", { class: "num", "data-label": "Total" }, formatarMoeda(a.totalCentavos)),
            el("td", { class: "num", "data-label": "Sinal" }, formatarMoeda(a.sinalCentavos)),
            el("td", { "data-label": "Pix" }, situacaoPix(a)),
            el("td", {}, seloStatus(a.status)),
          ),
        ),
      ),
    ),
    el(
      "div",
      { class: "tabela-rodape" },
      el("span", {}, plural(agendamentos.length, "agendamento", "agendamentos")),
      el("span", {}, "Confirmados e concluídos: ", el("strong", {}, formatarMoeda(total))),
    ),
  );
}

export async function renderizar(container, ctx) {
  if (ctx.params.get("status")) estado.status = ctx.params.get("status");
  const recarregar = () => renderizar(container, { ...ctx, params: new URLSearchParams() });

  container.replaceChildren(carregando());
  let agendamentos;
  try {
    agendamentos = await requestAdmin(`/admin/agendamentos${queryDoPeriodo()}`);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  const areaTabela = el("section", { class: "card table-card" });
  const desenharTabela = () => areaTabela.replaceChildren(criarTabela(filtrar(agendamentos), ctx, recarregar));

  const campoBusca = el("input", {
    "aria-label": "Buscar por nome, telefone, código ou serviço",
    class: "control",
    onInput: (e) => {
      estado.busca = e.currentTarget.value;
      desenharTabela();
    },
    placeholder: "Buscar cliente, telefone ou código",
    type: "search",
    value: estado.busca,
  });

  const selectStatus = el(
    "select",
    {
      "aria-label": "Filtrar por status",
      class: "control",
      onChange: (e) => {
        estado.status = e.currentTarget.value;
        desenharTabela();
      },
    },
    FILTROS_STATUS.map((f) => el("option", { selected: f.id === estado.status, value: f.id }, f.rotulo)),
  );

  const campoData = (chave, rotulo) =>
    el("input", {
      "aria-label": rotulo,
      class: "control",
      onChange: (e) => {
        estado[chave] = e.currentTarget.value;
        if (estado.de && estado.ate) recarregar();
      },
      type: "date",
      value: estado[chave],
    });

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, "Todos os horários marcados pelo site"), el("h1", { class: "page-title" }, "Agendamentos")),
      el(
        "div",
        { class: "page-actions" },
        el("button", { class: "btn btn-ghost btn-sm", onClick: () => exportarCsv(filtrar(agendamentos)), type: "button" }, icone(ICONES.baixar), "Baixar planilha"),
      ),
    ),
    el(
      "div",
      { class: "toolbar" },
      el(
        "div",
        { class: "segmented", role: "group", "aria-label": "Período" },
        PERIODOS.map((p) =>
          el(
            "button",
            {
              "aria-pressed": String(p.id === estado.periodo),
              onClick: () => {
                estado.periodo = p.id;
                if (p.id !== "personalizado" || (estado.de && estado.ate)) recarregar();
                else renderizar(container, { ...ctx, params: new URLSearchParams() });
              },
              type: "button",
            },
            p.rotulo,
          ),
        ),
      ),
      estado.periodo === "personalizado" && campoData("de", "De"),
      estado.periodo === "personalizado" && campoData("ate", "Até"),
      selectStatus,
      el("div", { class: "search" }, icone(ICONES.buscar), campoBusca),
    ),
    areaTabela,
  );
  desenharTabela();
}
