import { el, icone } from "../dom.js";
import { formatarDataLonga, formatarDuracao, formatarHora, formatarMoeda, formatarTelefone } from "../formatadores.js";
import {
  ACOES_POR_STATUS,
  ICONES,
  ROTULO_STATUS,
  linkWhatsAppCliente,
  minutosDoDia,
  precisaDevolver,
  seloStatus,
} from "./comum.js";
import { requestAdmin } from "./sessao.js";

// Gaveta lateral com tudo de um agendamento e as ações disponíveis.
const gaveta = document.getElementById("gaveta");
let focoAnterior = null;

function fechar() {
  gaveta.replaceChildren();
  document.removeEventListener("keydown", fecharComEsc);
  focoAnterior?.focus?.();
}

function fecharComEsc(evento) {
  if (evento.key === "Escape") fechar();
}

function linha(rotulo, valor, classe = "") {
  return el("div", { class: `linha ${classe}` }, el("span", { class: "rot" }, rotulo), el("span", { class: "val" }, valor));
}

function secao(titulo, ...conteudo) {
  return el("section", { class: "drawer-sec" }, el("h3", {}, titulo), ...conteudo);
}

function textoPagamento(agendamento) {
  const pix = agendamento.pagamento;
  if (!pix) {
    return agendamento.status === "PENDENTE"
      ? "Sinal combinado pelo WhatsApp (chave Pix). Confirme quando receber."
      : "Sinal confirmado manualmente.";
  }
  if (pix.status === "APROVADO") return `Pix pago em ${formatarDataLonga(pix.pagoEm)} às ${formatarHora(pix.pagoEm)}.`;
  if (pix.status === "CANCELADO") return "O Pix não foi pago.";
  return `Aguardando o Pix até ${formatarHora(pix.expiraEm)} — confirma sozinho quando cair.`;
}

/**
 * Abre a gaveta do agendamento. `aoAlterar` é chamado depois de mudar o status,
 * para a tela atual recarregar.
 */
export function abrirDetalhe(agendamento, aoAlterar) {
  focoAnterior = document.activeElement;
  const duracao = minutosDoDia(agendamento.fim) - minutosDoDia(agendamento.inicio);
  const erroEl = el("p", { class: "alert", hidden: true, role: "alert" });

  const executar = async (acao) => {
    if (acao.confirmar && !window.confirm(acao.confirmar)) return;
    try {
      await requestAdmin(`/admin/agendamentos/${agendamento.id}`, { body: { status: acao.status }, method: "PATCH" });
      fechar();
      aoAlterar?.();
    } catch (erro) {
      erroEl.textContent = erro.message;
      erroEl.hidden = false;
    }
  };

  const botaoFechar = el("button", { "aria-label": "Fechar", class: "icon-btn", onClick: fechar, type: "button" }, icone(ICONES.fechar));
  const acoes = ACOES_POR_STATUS[agendamento.status];

  const painel = el(
    "aside",
    { "aria-label": `Agendamento ${agendamento.codigo}`, "aria-modal": "true", class: "drawer", role: "dialog" },
    el(
      "div",
      { class: "drawer-head" },
      el("div", {}, el("span", { class: "codigo" }, agendamento.codigo), el("h2", {}, agendamento.clienteNome)),
      botaoFechar,
    ),
    el("div", {}, seloStatus(agendamento.status)),
    precisaDevolver(agendamento) &&
      el(
        "p",
        { class: "aviso" },
        `O sinal de ${formatarMoeda(agendamento.pagamento.valorCentavos)} foi pago, mas o agendamento está ${ROTULO_STATUS[agendamento.status].toLowerCase()}. Devolva o valor pelo app do Mercado Pago.`,
      ),
    el(
      "a",
      { class: "btn btn-ghost", href: linkWhatsAppCliente(agendamento), rel: "noopener", target: "_blank" },
      icone(ICONES.telefone),
      `Chamar no WhatsApp · ${formatarTelefone(agendamento.clienteTelefone)}`,
    ),
    secao(
      "Quando",
      linha("Data", formatarDataLonga(agendamento.inicio)),
      linha("Horário", `${formatarHora(agendamento.inicio)} – ${formatarHora(agendamento.fim)}`),
      linha("Duração", formatarDuracao(duracao)),
    ),
    secao(
      "Serviços",
      ...agendamento.itens.map((item) => linha(item.nome, formatarMoeda(item.precoCentavos))),
      linha("Total", formatarMoeda(agendamento.totalCentavos), "total"),
      linha("Sinal (50%)", formatarMoeda(agendamento.sinalCentavos)),
      linha("Restante no dia", formatarMoeda(agendamento.totalCentavos - agendamento.sinalCentavos)),
    ),
    secao("Pagamento do sinal", el("p", { class: `nota ${agendamento.pagamento?.status === "APROVADO" ? "pix-ok" : ""}` }, textoPagamento(agendamento))),
    secao(
      "Cliente",
      linha("WhatsApp", formatarTelefone(agendamento.clienteTelefone)),
      agendamento.clienteEmail && linha("E-mail", agendamento.clienteEmail),
      agendamento.endereco && linha("Endereço", agendamento.endereco),
      linha("Agendou em", `${formatarDataLonga(agendamento.criadoEm)} às ${formatarHora(agendamento.criadoEm)}`),
    ),
    agendamento.observacao && secao("Observação da cliente", el("p", { class: "nota" }, agendamento.observacao)),
    erroEl,
    acoes.length > 0 &&
      el(
        "div",
        { class: "acoes" },
        acoes.map((acao) => el("button", { class: `btn ${acao.classe}`, onClick: () => executar(acao), type: "button" }, acao.rotulo)),
      ),
  );

  const overlay = el("div", { class: "drawer-overlay", onClick: (evento) => evento.target === overlay && fechar() }, painel);
  gaveta.replaceChildren(overlay);
  document.addEventListener("keydown", fecharComEsc);
  botaoFechar.focus();
}
