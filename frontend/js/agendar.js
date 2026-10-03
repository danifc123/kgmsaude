import { ApiError, request } from "./api.js";
import * as carrinho from "./carrinho.js";
import { CONFIG } from "./config.js";
import { copiarTexto, el } from "./dom.js";
import {
  dataIso,
  formatarDataLonga,
  formatarDuracao,
  formatarHora,
  formatarMoeda,
  linkWhatsApp,
} from "./formatadores.js";

const DIAS_EXIBIDOS = 30;

const botaoConfirmar = document.getElementById("confirmar");
const diasEl = document.getElementById("dias");
const erroEl = document.getElementById("erro");
const form = document.getElementById("form-dados");
const horariosEl = document.getElementById("horarios");

const estado = {
  data: null,
  enviando: false,
  horario: null,
  requisicaoHorarios: 0,
  servicos: [],
};

// region Etapa 1 — resumo, dias e horários

function atualizarBotao() {
  botaoConfirmar.disabled = !estado.horario || estado.enviando;
  if (estado.enviando) botaoConfirmar.textContent = "Reservando…";
  else if (estado.horario) botaoConfirmar.textContent = `Reservar ${estado.horario}`;
  else botaoConfirmar.textContent = "Escolha um horário";
}

async function carregarHorarios() {
  const requisicao = ++estado.requisicaoHorarios;
  estado.horario = null;
  atualizarBotao();
  horariosEl.replaceChildren(el("p", { class: "loading" }, "Buscando horários…"));

  const ids = estado.servicos.map((s) => s.id).join(",");
  try {
    const resposta = await request(`/agenda/horarios?data=${estado.data}&servicos=${ids}`);
    if (requisicao !== estado.requisicaoHorarios) return;
    renderizarHorarios(resposta.horarios);
  } catch (erro) {
    if (requisicao !== estado.requisicaoHorarios) return;
    horariosEl.replaceChildren(el("p", { class: "alert" }, erro.message));
  }
}

function renderizarDias() {
  const hoje = new Date();
  const dias = Array.from({ length: DIAS_EXIBIDOS }, (_, i) => {
    const dia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + i);
    const iso = dataIso(dia);
    return el(
      "button",
      {
        "aria-pressed": String(iso === estado.data),
        class: "day",
        "data-data": iso,
        onClick: () => selecionarDia(iso),
        type: "button",
      },
      el("span", { class: "dow" }, dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")),
      el("span", { class: "num" }, dia.getDate()),
      el("span", { class: "mon" }, dia.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")),
    );
  });
  diasEl.replaceChildren(...dias);
}

function renderizarHorarios(horarios) {
  if (horarios.length === 0) {
    horariosEl.replaceChildren(
      el("p", { class: "empty" }, "Sem horários livres nesse dia. Que tal outro?"),
    );
    return;
  }
  const botoes = horarios.map((horario) =>
    el(
      "button",
      {
        "aria-pressed": "false",
        class: "slot",
        onClick: (evento) => {
          estado.horario = horario;
          horariosEl.querySelectorAll(".slot").forEach((b) => b.setAttribute("aria-pressed", "false"));
          evento.currentTarget.setAttribute("aria-pressed", "true");
          atualizarBotao();
        },
        type: "button",
      },
      horario,
    ),
  );
  horariosEl.replaceChildren(el("div", { class: "slots" }, botoes));
}

function renderizarResumo() {
  const total = estado.servicos.reduce((soma, s) => soma + s.precoCentavos, 0);
  const duracao = estado.servicos.reduce((soma, s) => soma + s.duracaoMinutos, 0);
  document.getElementById("resumo").replaceChildren(
    el(
      "ul",
      { class: "summary-list" },
      estado.servicos.map((s) =>
        el("li", {}, el("span", {}, s.nome), el("span", { class: "price" }, formatarMoeda(s.precoCentavos))),
      ),
    ),
    el(
      "div",
      { class: "summary-total" },
      el("span", {}, "Total"),
      el("span", { class: "price" }, formatarMoeda(total)),
    ),
    el("div", { class: "summary-meta" }, `Duração aproximada: ${formatarDuracao(duracao)}`),
    el("a", { class: "summary-edit", href: "index.html" }, "Alterar serviços"),
  );
  document.getElementById("campo-endereco").hidden = !estado.servicos.some((s) => s.exigeEndereco);
}

function selecionarDia(iso) {
  estado.data = iso;
  diasEl.querySelectorAll(".day").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.data === iso));
  });
  carregarHorarios();
}

// endregion

// region Etapa 2 — envio e confirmação

function mostrarErro(mensagem) {
  erroEl.textContent = mensagem;
  erroEl.hidden = !mensagem;
  if (mensagem) erroEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function reservar() {
  mostrarErro("");
  const enderecoInput = form.elements.endereco;
  enderecoInput.required = !document.getElementById("campo-endereco").hidden;
  if (!form.reportValidity()) return;

  estado.enviando = true;
  atualizarBotao();
  try {
    const agendamento = await request("/agendamentos", {
      body: {
        clienteNome: form.elements.nome.value,
        clienteTelefone: form.elements.telefone.value,
        endereco: enderecoInput.value || null,
        inicio: `${estado.data}T${estado.horario}:00`,
        observacao: form.elements.observacao.value || null,
        servicoIds: estado.servicos.map((s) => s.id),
      },
      method: "POST",
    });
    carrinho.limpar();
    renderizarSucesso(agendamento);
  } catch (erro) {
    mostrarErro(erro.message);
    if (erro instanceof ApiError && erro.status === 409) carregarHorarios();
  } finally {
    estado.enviando = false;
    atualizarBotao();
  }
}

function montarMensagemComprovante(agendamento) {
  const servicos = agendamento.itens.map((i) => i.nome).join(", ");
  return [
    "Olá, Katiuschia! Acabei de agendar pelo site.",
    "",
    `Código: ${agendamento.codigo}`,
    `Data: ${formatarDataLonga(agendamento.inicio)} às ${formatarHora(agendamento.inicio)}`,
    `Serviços: ${servicos}`,
    `Total: ${formatarMoeda(agendamento.totalCentavos)}`,
    `Sinal (50%): ${formatarMoeda(agendamento.sinalCentavos)}`,
    "",
    "Segue o comprovante do Pix 😊",
  ].join("\n");
}

function linhaDetalhe(rotulo, valor) {
  return el("div", { class: "detail-row" }, el("span", { class: "label" }, rotulo), el("span", { class: "value" }, valor));
}

function renderizarSucesso(agendamento) {
  const botaoCopiar = el("button", { class: "pix-copy", type: "button" }, "Copiar");
  botaoCopiar.addEventListener("click", () => copiarTexto(CONFIG.pixChave, botaoCopiar));

  const sucesso = document.getElementById("etapa-sucesso");
  sucesso.replaceChildren(
    el(
      "div",
      { class: "success" },
      el(
        "div",
        { class: "success-icon" },
        svgCheck(),
      ),
      el("h1", {}, "Horário reservado!"),
      el("p", { class: "lead" }, "Falta só o sinal para confirmar. Seu horário fica guardado enquanto isso."),
      el("span", { class: "code" }, agendamento.codigo),
      el(
        "div",
        { class: "card" },
        linhaDetalhe("Data", formatarDataLonga(agendamento.inicio)),
        linhaDetalhe("Horário", `${formatarHora(agendamento.inicio)} – ${formatarHora(agendamento.fim)}`),
        linhaDetalhe("Serviços", agendamento.itens.map((i) => i.nome).join(", ")),
        linhaDetalhe("Total", formatarMoeda(agendamento.totalCentavos)),
      ),
      el(
        "div",
        { class: "card" },
        el("p", { class: "deposit-title" }, "Sinal de 50% via Pix"),
        el("p", { class: "deposit-value" }, formatarMoeda(agendamento.sinalCentavos)),
        el(
          "p",
          { class: "deposit-text" },
          "Faça o Pix para a chave abaixo e envie o comprovante pelo WhatsApp. O restante é pago no dia do atendimento.",
        ),
        el("div", { class: "pix-key-row" }, el("code", { class: "pix-key" }, CONFIG.pixChave), botaoCopiar),
      ),
      el(
        "a",
        {
          class: "btn btn-primary",
          href: linkWhatsApp(montarMensagemComprovante(agendamento)),
          rel: "noopener",
          target: "_blank",
        },
        "Enviar comprovante no WhatsApp",
      ),
    ),
  );

  document.getElementById("etapa-agendamento").hidden = true;
  document.getElementById("cta-agendar").hidden = true;
  sucesso.hidden = false;
  window.scrollTo({ top: 0 });
}

function svgCheck() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M5 12.5l4.5 4.5L19 7.5");
  svg.append(path);
  return svg;
}

// endregion

async function iniciar() {
  const ids = carrinho.ler();
  if (ids.length === 0) {
    window.location.replace("index.html");
    return;
  }
  try {
    const catalogo = await request("/servicos");
    estado.servicos = catalogo.filter((s) => ids.includes(s.id));
  } catch (erro) {
    mostrarErro(erro.message);
    return;
  }
  if (estado.servicos.length === 0) {
    window.location.replace("index.html");
    return;
  }

  renderizarResumo();
  estado.data = dataIso(new Date());
  renderizarDias();
  carregarHorarios();
  botaoConfirmar.addEventListener("click", reservar);
}

iniciar();
