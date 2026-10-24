import { el, icone } from "../../dom.js";
import { dataIso, dataLocal, formatarDataLonga, formatarHora, formatarMoeda } from "../../formatadores.js";
import { ICONES, ROTULO_STATUS, botaoIcone, carregando, erroCarregamento, plural } from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Financeiro";

const estado = { mes: null };

// region Gráfico de barras (uma série: Pix recebidos por dia)

const SVG = "http://www.w3.org/2000/svg";
const LARGURA = 1000;
const ALTURA = 250;
const MARGEM = { baixo: 26, cima: 12, direita: 8, esquerda: 52 };

function svg(tag, atributos = {}) {
  const elemento = document.createElementNS(SVG, tag);
  for (const [nome, valor] of Object.entries(atributos)) elemento.setAttribute(nome, valor);
  return elemento;
}

// Teto "redondo" e próximo do maior valor: 100, 200, 300, 400, 500, 600, 800, 1000...
function tetoRedondo(valor) {
  if (valor <= 0) return 10000;
  const potencia = 10 ** Math.floor(Math.log10(valor));
  const passo = [1, 2, 3, 4, 5, 6, 8, 10].find((m) => m * potencia >= valor);
  return passo * potencia;
}

// Barra com cantos de 4px só no topo, presa na linha de base.
function caminhoBarra(x, y, largura, altura) {
  const r = Math.min(4, largura / 2, altura);
  const base = y + altura;
  return `M${x},${base}V${y + r}Q${x},${y} ${x + r},${y}H${x + largura - r}Q${x + largura},${y} ${x + largura},${y + r}V${base}Z`;
}

function moedaCurta(centavos) {
  return `R$ ${Math.round(centavos / 100).toLocaleString("pt-BR")}`;
}

function criarGrafico(porDia) {
  const area = { altura: ALTURA - MARGEM.cima - MARGEM.baixo, largura: LARGURA - MARGEM.esquerda - MARGEM.direita };
  const teto = tetoRedondo(Math.max(...porDia.map((d) => d.valorCentavos)));
  const passo = area.largura / porDia.length;
  const larguraBarra = Math.max(Math.min(passo * 0.62, 18), 2);
  const y = (valor) => MARGEM.cima + area.altura - (valor / teto) * area.altura;

  const raiz = svg("svg", { "aria-label": "Pix recebidos por dia no mês", role: "img", viewBox: `0 0 ${LARGURA} ${ALTURA}` });

  for (const fracao of [0, 0.5, 1]) {
    const valor = teto * fracao;
    raiz.append(svg("line", { class: fracao === 0 ? "base" : "grade", x1: MARGEM.esquerda, x2: LARGURA - MARGEM.direita, y1: y(valor), y2: y(valor) }));
    const rotulo = svg("text", { class: "eixo", "text-anchor": "end", x: MARGEM.esquerda - 8, y: y(valor) + 4 });
    rotulo.textContent = moedaCurta(valor);
    raiz.append(rotulo);
  }

  const tooltip = el("div", { class: "tooltip", hidden: true });
  const container = el("div", { class: "chart" }, raiz, tooltip);

  porDia.forEach((dia, i) => {
    const centro = MARGEM.esquerda + passo * i + passo / 2;
    const numeroDia = Number(dia.data.slice(8, 10));
    if ([1, 5, 10, 15, 20, 25].includes(numeroDia) || i === porDia.length - 1) {
      const rotulo = svg("text", { class: "eixo", "text-anchor": "middle", x: centro, y: ALTURA - 8 });
      rotulo.textContent = String(numeroDia);
      raiz.append(rotulo);
    }

    // Alvo invisível com a coluna inteira: bem maior que a barra, fácil de acertar.
    const alvo = svg("rect", { class: "alvo", height: area.altura, tabindex: "0", width: passo, x: centro - passo / 2, y: MARGEM.cima });
    alvo.setAttribute("aria-label", `${formatarDataLonga(dia.data)}: ${formatarMoeda(dia.valorCentavos)}`);
    raiz.append(alvo);

    let barra = null;
    if (dia.valorCentavos > 0) {
      const topo = y(dia.valorCentavos);
      barra = svg("path", { class: "barra", d: caminhoBarra(centro - larguraBarra / 2, topo, larguraBarra, MARGEM.cima + area.altura - topo) });
      barra.style.pointerEvents = "none";
      raiz.append(barra);
    }

    const mostrar = () => {
      const escala = raiz.getBoundingClientRect().width / LARGURA;
      tooltip.replaceChildren(el("strong", {}, formatarMoeda(dia.valorCentavos)), el("span", {}, formatarDataLonga(dia.data)));
      tooltip.style.left = `${centro * escala}px`;
      tooltip.style.top = `${y(Math.max(dia.valorCentavos, 0)) * escala}px`;
      tooltip.hidden = false;
      barra?.classList.add("is-ativa");
    };
    const esconder = () => {
      tooltip.hidden = true;
      barra?.classList.remove("is-ativa");
    };
    alvo.addEventListener("mouseenter", mostrar);
    alvo.addEventListener("focus", mostrar);
    alvo.addEventListener("mouseleave", esconder);
    alvo.addEventListener("blur", esconder);
  });

  return container;
}

// endregion

function indicador(rotulo, valor, sub, iconeNome, alerta = false) {
  return el(
    "div",
    { class: `card stat${alerta ? " is-warn" : ""}` },
    el("span", { class: "stat-label" }, icone(ICONES[iconeNome]), rotulo),
    el("span", { class: "stat-value" }, valor),
    el("span", { class: "stat-sub" }, sub),
  );
}

function tabelaPagamentos(pagamentos, vazio) {
  if (pagamentos.length === 0) return el("p", { class: "empty" }, vazio);
  return el(
    "table",
    { class: "tabela" },
    el("thead", {}, el("tr", {}, el("th", {}, "Pago em"), el("th", {}, "Cliente"), el("th", {}, "Agendamento"), el("th", { class: "num" }, "Valor"))),
    el(
      "tbody",
      {},
      pagamentos.map((p) =>
        el(
          "tr",
          {},
          el("td", { "data-label": "Pago em" }, `${dataLocal(p.pagoEm).toLocaleDateString("pt-BR")} ${formatarHora(p.pagoEm)}`),
          el("td", { class: "forte", "data-label": "Cliente" }, p.clienteNome),
          el("td", { "data-label": "Agendamento" }, p.agendamentoCodigo, el("span", { class: "muted" }, ` · ${ROTULO_STATUS[p.agendamentoStatus]}`)),
          el("td", { class: "num", "data-label": "Valor" }, formatarMoeda(p.valorCentavos)),
        ),
      ),
    ),
  );
}

export async function renderizar(container) {
  estado.mes ??= new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const recarregar = () => renderizar(container);
  const mover = (delta) => {
    estado.mes = new Date(estado.mes.getFullYear(), estado.mes.getMonth() + delta, 1);
    recarregar();
  };

  container.replaceChildren(carregando());
  let dados;
  try {
    dados = await requestAdmin(`/admin/financeiro?mes=${dataIso(estado.mes)}`);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  const nomeMes = estado.mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const totalDevolver = dados.devolucoes.reduce((s, p) => s + p.valorCentavos, 0);

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, "Dinheiro dos agendamentos"), el("h1", { class: "page-title" }, "Financeiro")),
      el("div", { class: "toolbar", style: "margin:0" }, botaoIcone("esquerda", "Mês anterior", () => mover(-1)), el("span", { class: "periodo" }, nomeMes), botaoIcone("direita", "Próximo mês", () => mover(1))),
    ),
    dados.devolucoes.length > 0 &&
      el(
        "p",
        { class: "aviso", style: "margin:0 0 18px" },
        `${plural(dados.devolucoes.length, "sinal precisa", "sinais precisam")} ser devolvido${dados.devolucoes.length === 1 ? "" : "s"} (${formatarMoeda(totalDevolver)}): ${dados.devolucoes.map((p) => `${p.clienteNome} (${p.agendamentoCodigo})`).join(", ")}. Faça o estorno pelo app do Mercado Pago.`,
      ),
    el(
      "div",
      { class: "grid grid-4" },
      indicador("Recebido pelo site", formatarMoeda(dados.recebidoPixCentavos), `sinais pagos via Pix · ${plural(dados.pagamentos.length, "pagamento", "pagamentos")}`, "dinheiro"),
      indicador("Faturamento do mês", formatarMoeda(dados.faturamentoCentavos), `valor total de ${plural(dados.atendimentosConfirmados, "atendimento confirmado", "atendimentos confirmados")}`, "agenda"),
      indicador("A receber no dia", formatarMoeda(dados.aReceberCentavos), "os outros 50% dos confirmados", "relogio"),
      indicador("Sinais confirmados à mão", formatarMoeda(dados.sinaisManuaisCentavos), "Pix pela chave, conferidos no WhatsApp", "check"),
    ),
    el(
      "section",
      { class: "card", style: "margin-top:18px" },
      el("h2", { class: "card-title" }, "Pix recebidos por dia", el("small", {}, `${nomeMes} · passe o mouse nas barras`)),
      criarGrafico(dados.porDia),
      el("p", { class: "rodape-nota" }, "Valores brutos. A taxa do Mercado Pago é descontada no extrato do app do Mercado Pago."),
    ),
    el(
      "section",
      { class: "card table-card", style: "margin-top:18px" },
      el("h2", { class: "card-title", style: "padding:18px 16px 0" }, "Pagamentos recebidos pelo site", el("small", {}, plural(dados.pagamentos.length, "pagamento", "pagamentos"))),
      tabelaPagamentos([...dados.pagamentos].reverse(), `Nenhum Pix recebido pelo site em ${nomeMes}.`),
      dados.pagamentos.length > 0 && el("div", { class: "tabela-rodape" }, el("span", {}, "Total do mês"), el("strong", {}, formatarMoeda(dados.recebidoPixCentavos))),
    ),
  );
}
