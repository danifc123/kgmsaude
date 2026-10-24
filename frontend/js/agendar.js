import { ApiError, request } from "./api.js";
import * as carrinho from "./carrinho.js";
import { CONFIG } from "./config.js";
import { carregandoComAviso, copiarTexto, el, erroComNovaTentativa, icone } from "./dom.js";
import {
  dataIso,
  formatarDataLonga,
  formatarDuracao,
  formatarHora,
  formatarMoeda,
  linkWhatsApp,
} from "./formatadores.js";

const INTERVALO_POLLING_MS = 4000;

const ICONE_ALERTA = "M12 8v5M12 16.5v.5M10.3 3.9 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z";
const ICONE_CHECK = "M5 12.5l4.5 4.5L19 7.5";
const ICONE_RELOGIO = "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z";

const botaoConfirmar = document.getElementById("confirmar");
const diasEl = document.getElementById("dias");
const erroEl = document.getElementById("erro");
const form = document.getElementById("form-dados");
const horariosEl = document.getElementById("horarios");
const resultadoEl = document.getElementById("etapa-resultado");

const estado = {
  configAgenda: { antecedenciaMinimaDias: 1, diasMaximosAgendamento: 30 },
  configPagamento: { pixAutomatico: false, provedor: "manual", sinalPercentual: 50 },
  data: null,
  enviando: false,
  horario: null,
  requisicaoHorarios: 0,
  servicos: [],
  timers: [],
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

// Primeiro dia que a cliente pode escolher ("marcar um dia antes" → amanhã).
function primeiroDiaPermitido() {
  const hoje = new Date();
  return new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + estado.configAgenda.antecedenciaMinimaDias);
}

function renderizarDias() {
  const { antecedenciaMinimaDias, diasMaximosAgendamento } = estado.configAgenda;
  const primeiro = primeiroDiaPermitido();
  const quantidade = diasMaximosAgendamento - antecedenciaMinimaDias + 1;
  const dias = Array.from({ length: quantidade }, (_, i) => {
    const dia = new Date(primeiro.getFullYear(), primeiro.getMonth(), primeiro.getDate() + i);
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
    el(
      "div",
      { class: "summary-meta" },
      `Pagamento de ${estado.configPagamento.sinalPercentual}% antecipado para garantir seu horário. ` +
        `Agendamentos com no mínimo ${textoDias(estado.configAgenda.antecedenciaMinimaDias)} de antecedência.`,
    ),
    el("a", { class: "summary-edit", href: "index.html" }, "Alterar serviços"),
  );
  document.getElementById("campo-endereco").hidden = !estado.servicos.some((s) => s.exigeEndereco);
  document.getElementById("campo-email").hidden = !estado.configPagamento.pixAutomatico;
}

function textoDias(quantidade) {
  return quantidade === 1 ? "1 dia" : `${quantidade} dias`;
}

function selecionarDia(iso) {
  estado.data = iso;
  diasEl.querySelectorAll(".day").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.data === iso));
  });
  carregarHorarios();
}

// endregion

// region Etapa 2 — envio

function mostrarErro(mensagem) {
  erroEl.textContent = mensagem;
  erroEl.hidden = !mensagem;
  if (mensagem) erroEl.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function reservar() {
  mostrarErro("");
  form.elements.endereco.required = !document.getElementById("campo-endereco").hidden;
  form.elements.email.required = estado.configPagamento.pixAutomatico;
  if (!form.reportValidity()) return;

  estado.enviando = true;
  atualizarBotao();
  try {
    const agendamento = await request("/agendamentos", {
      body: {
        clienteEmail: form.elements.email.value || null,
        clienteNome: form.elements.nome.value,
        clienteTelefone: form.elements.telefone.value,
        endereco: form.elements.endereco.value || null,
        inicio: `${estado.data}T${estado.horario}:00`,
        observacao: form.elements.observacao.value || null,
        servicoIds: estado.servicos.map((s) => s.id),
      },
      method: "POST",
    });
    // Com Pix automático o link guarda o checkout: recarregar a página não perde o QR code.
    if (agendamento.pagamento) history.replaceState(null, "", `?agendamento=${agendamento.id}`);
    else carrinho.limpar();
    renderizarAgendamento(agendamento);
  } catch (erro) {
    mostrarErro(erro.message);
    if (erro instanceof ApiError && erro.status === 409) carregarHorarios();
  } finally {
    estado.enviando = false;
    atualizarBotao();
  }
}

// endregion

// region Etapa 3 — checkout Pix e resultado

function abrirResultado(...conteudo) {
  estado.timers.forEach(clearInterval);
  estado.timers = [];
  document.getElementById("etapa-agendamento").hidden = true;
  document.getElementById("cta-agendar").hidden = true;
  resultadoEl.replaceChildren(el("div", { class: "result" }, ...conteudo));
  resultadoEl.hidden = false;
  window.scrollTo({ top: 0 });
}

function botaoCopiar(texto, rotulo = "Copiar") {
  const botao = el("button", { class: "pix-copy", type: "button" }, rotulo);
  botao.addEventListener("click", () => copiarTexto(texto, botao));
  return botao;
}

function cabecalho(iconeD, titulo, texto, variante = "") {
  return [
    el("div", { class: `result-icon ${variante}` }, icone(iconeD)),
    el("h1", {}, titulo),
    el("p", { class: "lead" }, texto),
  ];
}

function cartaoDetalhes(agendamento) {
  return el(
    "div",
    { class: "card" },
    linhaDetalhe("Data", formatarDataLonga(agendamento.inicio)),
    linhaDetalhe("Horário", `${formatarHora(agendamento.inicio)} – ${formatarHora(agendamento.fim)}`),
    linhaDetalhe("Serviços", agendamento.itens.map((i) => i.nome).join(", ")),
    linhaDetalhe("Total", formatarMoeda(agendamento.totalCentavos)),
    linhaDetalhe("Sinal (50%)", formatarMoeda(agendamento.sinalCentavos)),
  );
}

function iniciarContagem(expiraEm, saidaEl, aoExpirar) {
  const limite = new Date(`${expiraEm}${CONFIG.fusoHorario}`).getTime();
  const atualizar = () => {
    const restante = Math.max(0, Math.round((limite - Date.now()) / 1000));
    const minutos = String(Math.floor(restante / 60)).padStart(2, "0");
    const segundos = String(restante % 60).padStart(2, "0");
    saidaEl.textContent = `${minutos}:${segundos}`;
    if (restante === 0) aoExpirar();
  };
  atualizar();
  estado.timers.push(setInterval(atualizar, 1000));
}

function iniciarPolling(agendamentoId) {
  let consultando = false;
  const consultar = async () => {
    if (consultando) return;
    consultando = true;
    try {
      const atual = await request(`/agendamentos/${agendamentoId}`);
      if (atual.status !== "PENDENTE") renderizarAgendamento(atual);
    } catch {
      // Falha de rede momentânea: tenta de novo no próximo ciclo.
    } finally {
      consultando = false;
    }
  };
  estado.timers.push(setInterval(consultar, INTERVALO_POLLING_MS));
  return consultar;
}

function linhaDetalhe(rotulo, valor) {
  return el("div", { class: "detail-row" }, el("span", { class: "label" }, rotulo), el("span", { class: "value" }, valor));
}

function linkFalarComKatiuschia(agendamento, texto, rotulo) {
  const mensagem = [
    texto,
    "",
    `Código: ${agendamento.codigo}`,
    `Data: ${formatarDataLonga(agendamento.inicio)} às ${formatarHora(agendamento.inicio)}`,
    `Serviços: ${agendamento.itens.map((i) => i.nome).join(", ")}`,
  ].join("\n");
  return el(
    "a",
    { class: "btn btn-primary", href: linkWhatsApp(mensagem), rel: "noopener", target: "_blank" },
    rotulo,
  );
}

function renderizarAgendamento(agendamento) {
  const pagamento = agendamento.pagamento;
  if (agendamento.status === "CONFIRMADO" || agendamento.status === "CONCLUIDO") return renderizarConfirmado(agendamento);
  if (agendamento.status === "PENDENTE" && pagamento) return renderizarCheckout(agendamento);
  if (agendamento.status === "PENDENTE") return renderizarSinalManual(agendamento);
  if (pagamento?.status === "APROVADO") return renderizarPagoSemHorario(agendamento);
  return renderizarExpirado(agendamento);
}

function renderizarCheckout(agendamento) {
  const pix = agendamento.pagamento;
  const contagemEl = el("strong", { class: "countdown" }, "--:--");
  const statusEl = el("p", { "aria-live": "polite", class: "pay-status" }, el("span", { class: "pulse" }), "Aguardando o pagamento…");
  const consultarAgora = iniciarPolling(agendamento.id);

  abrirResultado(
    ...cabecalho(ICONE_RELOGIO, "Pague o sinal via Pix", "Assim que o Pix cair, seu horário é confirmado automaticamente."),
    el("span", { class: "code" }, agendamento.codigo),
    el(
      "div",
      { class: "card checkout" },
      el("p", { class: "deposit-title" }, "Sinal de 50%"),
      el("p", { class: "deposit-value" }, formatarMoeda(pix.valorCentavos)),
      pix.pixQrBase64 &&
        el("img", {
          alt: "QR code do Pix",
          class: "qr",
          height: "220",
          src: `data:image/png;base64,${pix.pixQrBase64}`,
          width: "220",
        }),
      el("p", { class: "deposit-text" }, "Abra o app do seu banco, escolha Pix copia e cola e cole o código:"),
      el("div", { class: "pix-key-row" }, el("code", { class: "pix-key" }, pix.pixCopiaCola), botaoCopiar(pix.pixCopiaCola)),
      el("p", { class: "expires" }, "O horário fica reservado por ", contagemEl),
      statusEl,
      estado.configPagamento.provedor === "fake" &&
        el(
          "button",
          {
            class: "btn btn-ghost dev-pay",
            onClick: async () => {
              await request(`/dev/pagamentos/${agendamento.id}/aprovar`, { method: "POST" }).catch(() => {});
              consultarAgora();
            },
            type: "button",
          },
          "Simular pagamento (ambiente de teste)",
        ),
    ),
    cartaoDetalhes(agendamento),
  );

  iniciarContagem(pix.expiraEm, contagemEl, consultarAgora);
}

function renderizarConfirmado(agendamento) {
  carrinho.limpar();
  abrirResultado(
    ...cabecalho(ICONE_CHECK, "Agendamento confirmado!", "Recebemos seu sinal. Te esperamos no dia — qualquer dúvida, é só chamar."),
    el("span", { class: "code" }, agendamento.codigo),
    cartaoDetalhes(agendamento),
    el("p", { class: "deposit-text center" }, `O restante (${formatarMoeda(agendamento.totalCentavos - agendamento.sinalCentavos)}) é pago no dia do atendimento.`),
    linkFalarComKatiuschia(agendamento, "Olá, Katiuschia! Acabei de confirmar meu agendamento pelo site 😊", "Falar com a Katiuschia no WhatsApp"),
  );
}

function renderizarExpirado(agendamento) {
  abrirResultado(
    ...cabecalho(ICONE_ALERTA, "O prazo do Pix acabou", "Como o pagamento não chegou a tempo, o horário foi liberado. Você pode escolher outro.", "warn"),
    el("span", { class: "code" }, agendamento.codigo),
    el("a", { class: "btn btn-primary", href: "agendar.html" }, "Escolher outro horário"),
  );
}

function renderizarPagoSemHorario(agendamento) {
  abrirResultado(
    ...cabecalho(ICONE_ALERTA, "Recebemos seu Pix", "Mas ele chegou depois do prazo e o horário já foi ocupado. A Katiuschia vai te chamar para remarcar ou devolver o sinal.", "warn"),
    el("span", { class: "code" }, agendamento.codigo),
    cartaoDetalhes(agendamento),
    linkFalarComKatiuschia(agendamento, "Olá, Katiuschia! Paguei o sinal, mas o prazo do meu horário tinha acabado.", "Falar com a Katiuschia no WhatsApp"),
  );
}

function renderizarSinalManual(agendamento) {
  abrirResultado(
    ...cabecalho(ICONE_CHECK, "Horário reservado!", "Falta só o sinal para confirmar. Seu horário fica guardado enquanto isso."),
    el("span", { class: "code" }, agendamento.codigo),
    cartaoDetalhes(agendamento),
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
      el("div", { class: "pix-key-row" }, el("code", { class: "pix-key" }, CONFIG.pixChave), botaoCopiar(CONFIG.pixChave)),
    ),
    linkFalarComKatiuschia(
      agendamento,
      `Olá, Katiuschia! Acabei de agendar pelo site. Segue o comprovante do Pix do sinal (${formatarMoeda(agendamento.sinalCentavos)}) 😊`,
      "Enviar comprovante no WhatsApp",
    ),
  );
}

// endregion

// Primeiro dia (até uma semana à frente) com horário livre; evita abrir num domingo fechado.
async function primeiroDiaComHorario() {
  const ids = estado.servicos.map((s) => s.id).join(",");
  for (let i = 0; i < 7; i++) {
    const dia = dataIso(somarDias(primeiroDiaPermitido(), i));
    try {
      const resposta = await request(`/agenda/horarios?data=${dia}&servicos=${ids}`);
      if (resposta.horarios.length) return dia;
    } catch {
      break;
    }
  }
  return dataIso(primeiroDiaPermitido());
}

function somarDias(data, dias) {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate() + dias);
}

async function iniciar() {
  const agendamentoId = new URLSearchParams(window.location.search).get("agendamento");
  const resumoEl = document.getElementById("resumo");
  const pararAviso = carregandoComAviso(resumoEl);
  try {
    const [catalogo, configPagamento, configAgenda] = await Promise.all([
      request("/servicos"),
      request("/pagamentos/config"),
      request("/agenda/config"),
    ]);
    estado.configAgenda = configAgenda;
    estado.configPagamento = configPagamento;

    if (agendamentoId) {
      renderizarAgendamento(await request(`/agendamentos/${agendamentoId}`));
      return;
    }

    const ids = carrinho.ler();
    estado.servicos = catalogo.filter((s) => ids.includes(s.id));
  } catch (erro) {
    // O erro aparece no lugar do "Carregando…", com botão para tentar de novo.
    erroComNovaTentativa(resumoEl, erro.message);
    return;
  } finally {
    pararAviso();
  }

  if (estado.servicos.length === 0) {
    window.location.replace("index.html");
    return;
  }
  renderizarResumo();
  horariosEl.replaceChildren(el("p", { class: "loading" }, "Buscando o primeiro dia com horário…"));
  estado.data = await primeiroDiaComHorario();
  renderizarDias();
  diasEl.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "center" });
  carregarHorarios();
  botaoConfirmar.addEventListener("click", reservar);
}

iniciar();
