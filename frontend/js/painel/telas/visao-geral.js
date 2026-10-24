import { el, icone } from "../../dom.js";
import { dataIso, formatarDataLonga, formatarHora, formatarMoeda } from "../../formatadores.js";
import {
  ICONES,
  STATUS_FECHADOS,
  carregando,
  erroCarregamento,
  formatarDataCurta,
  hojeIso,
  plural,
  saudacao,
  seloStatus,
  somarDias,
  textoServicos,
} from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Visão geral";

function cartaoIndicador({ alerta = false, href, iconeNome, rotulo, sub, valor }) {
  const conteudo = [
    el("span", { class: "stat-label" }, icone(ICONES[iconeNome]), rotulo),
    el("span", { class: "stat-value" }, valor),
    el("span", { class: "stat-sub" }, sub),
  ];
  const classe = `card stat${alerta ? " is-warn" : ""}`;
  return href ? el("a", { class: classe, href }, ...conteudo) : el("div", { class: classe }, ...conteudo);
}

function listaDeHoje(deHoje, proximo, ctx) {
  if (deHoje.length === 0) {
    return el(
      "div",
      { class: "all-good" },
      icone(ICONES.folga),
      "Nenhum atendimento hoje.",
      proximo && `Próximo: ${formatarDataLonga(proximo.inicio)} às ${formatarHora(proximo.inicio)} — ${proximo.clienteNome}.`,
    );
  }
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  return el(
    "ul",
    { class: "timeline" },
    deHoje.map((a) => {
      const fimMin = Number(a.fim.slice(11, 13)) * 60 + Number(a.fim.slice(14, 16));
      return el(
        "li",
        { class: fimMin < agoraMin ? "is-passado" : "", onClick: () => ctx.abrirDetalhe(a), tabindex: "0", onKeydown: (e) => e.key === "Enter" && ctx.abrirDetalhe(a) },
        el("span", { class: "hora" }, formatarHora(a.inicio), el("small", {}, `até ${formatarHora(a.fim)}`)),
        el("span", { class: "quem" }, el("strong", {}, a.clienteNome), el("span", {}, textoServicos(a))),
        seloStatus(a.status),
      );
    }),
  );
}

function listaDeAtencao(pendentes, devolucoes, ctx) {
  const itens = [
    ...devolucoes.map((p) =>
      el(
        "li",
        { class: "danger", onClick: () => ctx.navegar("#/financeiro"), tabindex: "0" },
        icone(ICONES.alerta),
        el("div", {}, el("strong", {}, `Devolver ${formatarMoeda(p.valorCentavos)} para ${p.clienteNome}`), el("span", {}, `Pix do agendamento ${p.agendamentoCodigo}, que não vai acontecer.`)),
      ),
    ),
    ...pendentes.map((a) =>
      el(
        "li",
        { class: "warn", onClick: () => ctx.abrirDetalhe(a), tabindex: "0", onKeydown: (e) => e.key === "Enter" && ctx.abrirDetalhe(a) },
        icone(ICONES.relogio),
        el(
          "div",
          {},
          el("strong", {}, a.pagamento ? `Aguardando Pix de ${a.clienteNome}` : `Confirmar sinal de ${a.clienteNome}`),
          el(
            "span",
            {},
            `${formatarDataCurta(a.inicio)} às ${formatarHora(a.inicio)} · sinal ${formatarMoeda(a.sinalCentavos)}` +
              (a.pagamento ? ` · confirma sozinho até ${formatarHora(a.pagamento.expiraEm)}` : " · veja o comprovante no WhatsApp"),
          ),
        ),
      ),
    ),
  ];
  if (itens.length === 0) return el("div", { class: "all-good" }, icone(ICONES.check), "Tudo em dia por aqui.");
  return el("ul", { class: "attention" }, itens);
}

export async function renderizar(container, ctx) {
  container.replaceChildren(carregando());
  let proximos;
  let financeiro;
  try {
    [proximos, financeiro] = await Promise.all([requestAdmin("/admin/agendamentos"), requestAdmin("/admin/financeiro")]);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  const hoje = hojeIso();
  const limiteSemana = dataIso(somarDias(new Date(), 7));
  const ativos = proximos.filter((a) => !STATUS_FECHADOS.includes(a.status));
  const deHoje = ativos.filter((a) => a.inicio.startsWith(hoje));
  const daSemana = ativos.filter((a) => a.inicio.slice(0, 10) < limiteSemana);
  const pendentes = ativos.filter((a) => a.status === "PENDENTE");
  const proximoDepoisDeHoje = ativos.find((a) => a.inicio.slice(0, 10) > hoje);
  const proximoHoje = deHoje.find((a) => a.fim.slice(11, 16) > new Date().toTimeString().slice(0, 5));

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, formatarDataLonga(hoje)), el("h1", { class: "page-title" }, `${saudacao()}, Katiuschia`)),
      el("div", { class: "page-actions" }, el("a", { class: "btn btn-ghost btn-sm", href: "#/agenda" }, icone(ICONES.agenda), "Abrir agenda da semana")),
    ),
    el(
      "div",
      { class: "grid grid-4" },
      cartaoIndicador({
        iconeNome: "relogio",
        rotulo: "Hoje",
        sub: proximoHoje
          ? `próximo às ${formatarHora(proximoHoje.inicio)} com ${proximoHoje.clienteNome.split(" ")[0]}`
          : deHoje.length
            ? "todos os de hoje já passaram"
            : "dia livre",
        valor: String(deHoje.length),
      }),
      cartaoIndicador({ href: "#/agenda", iconeNome: "agenda", rotulo: "Próximos 7 dias", sub: "confirmados e aguardando sinal", valor: String(daSemana.length) }),
      cartaoIndicador({
        alerta: pendentes.length > 0,
        href: "#/agendamentos?status=PENDENTE",
        iconeNome: "alerta",
        rotulo: "Aguardando sinal",
        sub: pendentes.length ? "toque para ver quem falta pagar" : "nenhum sinal pendente",
        valor: String(pendentes.length),
      }),
      cartaoIndicador({
        href: "#/financeiro",
        iconeNome: "dinheiro",
        rotulo: "Recebido no mês",
        sub: `via Pix pelo site · ${plural(financeiro.pagamentos.length, "pagamento", "pagamentos")}`,
        valor: formatarMoeda(financeiro.recebidoPixCentavos),
      }),
    ),
    el(
      "div",
      { class: "grid grid-2", style: "margin-top:18px" },
      el(
        "section",
        { class: "card" },
        el("h2", { class: "card-title" }, "Agenda de hoje", el("a", { class: "link", href: "#/agenda" }, "Ver semana")),
        listaDeHoje(deHoje, proximoDepoisDeHoje, ctx),
      ),
      el(
        "section",
        { class: "card" },
        el("h2", { class: "card-title" }, "Precisa da sua atenção"),
        listaDeAtencao(pendentes, financeiro.devolucoes, ctx),
      ),
    ),
  );
}
