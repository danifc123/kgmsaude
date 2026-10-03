import { ApiError, request } from "./api.js";
import { el } from "./dom.js";
import {
  dataIso,
  dataLocal,
  formatarDataLonga,
  formatarHora,
  formatarMoeda,
  formatarTelefone,
  linkWhatsApp,
} from "./formatadores.js";

const CHAVE_TOKEN = "kg-admin-token";

const ACOES_POR_STATUS = {
  CANCELADO: [],
  CONCLUIDO: [],
  CONFIRMADO: [
    { classe: "btn-primary", rotulo: "Concluir", status: "CONCLUIDO" },
    { classe: "btn-danger", confirmar: "Cancelar este agendamento?", rotulo: "Cancelar", status: "CANCELADO" },
  ],
  PENDENTE: [
    { classe: "btn-primary", rotulo: "Confirmar sinal", status: "CONFIRMADO" },
    { classe: "btn-danger", confirmar: "Cancelar este agendamento?", rotulo: "Cancelar", status: "CANCELADO" },
  ],
};

const ROTULO_STATUS = {
  CANCELADO: "Cancelado",
  CONCLUIDO: "Concluído",
  CONFIRMADO: "Confirmado",
  PENDENTE: "Aguardando sinal",
};

const estado = {
  data: dataIso(new Date()),
  modo: "dia", // "dia" | "proximos"
  somentePendentes: false,
  token: lerToken(),
};

// region Sessão

function lerToken() {
  try {
    return localStorage.getItem(CHAVE_TOKEN);
  } catch {
    return null;
  }
}

function salvarToken(token) {
  estado.token = token;
  try {
    if (token) localStorage.setItem(CHAVE_TOKEN, token);
    else localStorage.removeItem(CHAVE_TOKEN);
  } catch {
    // Sem storage o login dura só enquanto a página estiver aberta.
  }
}

// Requisição autenticada; em 401 volta para a tela de login.
async function requestAdmin(caminho, opcoes = {}) {
  try {
    return await request(caminho, { ...opcoes, token: estado.token });
  } catch (erro) {
    if (erro instanceof ApiError && erro.status === 401) sair();
    throw erro;
  }
}

async function entrar(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const erroEl = document.getElementById("erro-login");
  erroEl.hidden = true;
  try {
    const { accessToken } = await request("/auth/login", {
      body: { email: form.elements.email.value, senha: form.elements.senha.value },
      method: "POST",
    });
    salvarToken(accessToken);
    form.reset();
    mostrarPainel();
  } catch (erro) {
    erroEl.textContent = erro.message;
    erroEl.hidden = false;
  }
}

function mostrarPainel() {
  document.getElementById("tela-login").hidden = true;
  document.getElementById("tela-painel").hidden = false;
  carregarAgendamentos();
}

function sair() {
  salvarToken(null);
  document.getElementById("tela-painel").hidden = true;
  document.getElementById("tela-login").hidden = false;
}

// endregion

// region Agenda

function atualizarCabecalhoAgenda() {
  const hoje = dataIso(new Date());
  document.getElementById("dia-label").textContent =
    estado.modo === "proximos"
      ? "Próximos agendamentos"
      : dataLocal(estado.data).toLocaleDateString("pt-BR", { day: "numeric", month: "short", weekday: "long" });
  document.getElementById("filtro-hoje").setAttribute("aria-pressed", String(estado.modo === "dia" && estado.data === hoje));
  document.getElementById("filtro-proximos").setAttribute("aria-pressed", String(estado.modo === "proximos"));
  document.getElementById("filtro-pendentes").setAttribute("aria-pressed", String(estado.somentePendentes));
}

async function alterarStatus(agendamento, acao) {
  if (acao.confirmar && !window.confirm(acao.confirmar)) return;
  try {
    await requestAdmin(`/admin/agendamentos/${agendamento.id}`, {
      body: { status: acao.status },
      method: "PATCH",
    });
    carregarAgendamentos();
  } catch (erro) {
    mostrarErroAgenda(erro.message);
  }
}

async function carregarAgendamentos() {
  atualizarCabecalhoAgenda();
  mostrarErroAgenda("");
  const lista = document.getElementById("lista-agendamentos");
  lista.replaceChildren(el("p", { class: "loading" }, "Carregando…"));

  const query = estado.modo === "dia" ? `?data=${estado.data}` : "";
  try {
    let agendamentos = await requestAdmin(`/admin/agendamentos${query}`);
    if (estado.somentePendentes) agendamentos = agendamentos.filter((a) => a.status === "PENDENTE");
    lista.replaceChildren(
      ...(agendamentos.length
        ? agendamentos.map(criarCartaoAgendamento)
        : [el("p", { class: "empty" }, "Nenhum agendamento por aqui.")]),
    );
  } catch (erro) {
    lista.replaceChildren();
    mostrarErroAgenda(erro.message);
  }
}

function criarCartaoAgendamento(agendamento) {
  const fechado = agendamento.status === "CANCELADO" || agendamento.status === "CONCLUIDO";
  const saudacao = `Olá, ${agendamento.clienteNome.split(" ")[0]}! Aqui é a Katiuschia, sobre seu agendamento ${agendamento.codigo}.`;

  return el(
    "article",
    { class: `card${fechado ? " is-closed" : ""}` },
    el(
      "div",
      { class: "booking-head" },
      el(
        "div",
        {},
        el("div", { class: "booking-time" }, `${formatarHora(agendamento.inicio)} – ${formatarHora(agendamento.fim)}`),
        estado.modo === "proximos" && el("div", { class: "booking-date" }, formatarDataLonga(agendamento.inicio)),
      ),
      el("span", { class: `status status-${agendamento.status}` }, ROTULO_STATUS[agendamento.status]),
    ),
    el("div", { class: "booking-name" }, agendamento.clienteNome),
    el(
      "a",
      { class: "booking-phone", href: linkWhatsApp(saudacao, agendamento.clienteTelefone), rel: "noopener", target: "_blank" },
      `${formatarTelefone(agendamento.clienteTelefone)} · WhatsApp`,
    ),
    el("ul", { class: "booking-items" }, agendamento.itens.map((i) => el("li", {}, i.nome))),
    agendamento.endereco && criarExtra("Endereço", agendamento.endereco),
    agendamento.observacao && criarExtra("Obs.", agendamento.observacao),
    el(
      "div",
      { class: "booking-money" },
      el("span", {}, "Total ", el("strong", {}, formatarMoeda(agendamento.totalCentavos))),
      el("span", {}, "Sinal ", el("strong", {}, formatarMoeda(agendamento.sinalCentavos))),
    ),
    el(
      "div",
      { class: "booking-actions" },
      ACOES_POR_STATUS[agendamento.status].map((acao) =>
        el(
          "button",
          { class: `btn btn-sm ${acao.classe}`, onClick: () => alterarStatus(agendamento, acao), type: "button" },
          acao.rotulo,
        ),
      ),
    ),
  );
}

function criarExtra(rotulo, texto) {
  return el("div", { class: "booking-extra" }, el("span", { class: "label" }, `${rotulo}: `), texto);
}

function mostrarErroAgenda(mensagem) {
  const erroEl = document.getElementById("erro-agenda");
  erroEl.textContent = mensagem;
  erroEl.hidden = !mensagem;
}

function moverDia(delta) {
  const data = dataLocal(estado.data);
  data.setDate(data.getDate() + delta);
  estado.data = dataIso(data);
  estado.modo = "dia";
  carregarAgendamentos();
}

// endregion

// region Bloqueios

async function carregarBloqueios() {
  const lista = document.getElementById("lista-bloqueios");
  lista.replaceChildren(el("p", { class: "loading" }, "Carregando…"));
  try {
    const bloqueios = await requestAdmin("/admin/bloqueios");
    lista.replaceChildren(
      ...(bloqueios.length
        ? bloqueios.map(criarItemBloqueio)
        : [el("p", { class: "empty" }, "Nenhuma folga ou bloqueio marcado.")]),
    );
  } catch (erro) {
    lista.replaceChildren(el("p", { class: "alert" }, erro.message));
  }
}

async function criarBloqueio(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const erroEl = document.getElementById("erro-bloqueio");
  erroEl.hidden = true;

  const data = form.elements.data.value;
  const diaInteiro = form.elements.diaInteiro.checked;
  const fimData = dataLocal(data);
  fimData.setDate(fimData.getDate() + 1);

  try {
    await requestAdmin("/admin/bloqueios", {
      body: {
        fim: diaInteiro ? `${dataIso(fimData)}T00:00:00` : `${data}T${form.elements.fim.value}:00`,
        inicio: diaInteiro ? `${data}T00:00:00` : `${data}T${form.elements.inicio.value}:00`,
        motivo: form.elements.motivo.value || null,
      },
      method: "POST",
    });
    form.elements.motivo.value = "";
    carregarBloqueios();
  } catch (erro) {
    erroEl.textContent = erro.message;
    erroEl.hidden = false;
  }
}

function criarItemBloqueio(bloqueio) {
  const mesmoDia = bloqueio.inicio.slice(0, 10) === bloqueio.fim.slice(0, 10);
  const diaInteiro = bloqueio.inicio.endsWith("T00:00:00") && bloqueio.fim.endsWith("T00:00:00");
  let quando = formatarDataLonga(bloqueio.inicio);
  if (!diaInteiro && mesmoDia) quando += `, ${formatarHora(bloqueio.inicio)} – ${formatarHora(bloqueio.fim)}`;
  else if (!diaInteiro) quando += ` ${formatarHora(bloqueio.inicio)} até ${formatarDataLonga(bloqueio.fim)} ${formatarHora(bloqueio.fim)}`;

  return el(
    "div",
    { class: "card block" },
    el(
      "div",
      { class: "block-info" },
      el("div", { class: "block-when" }, quando),
      el("div", { class: "block-reason" }, bloqueio.motivo || (diaInteiro ? "Dia inteiro" : "Horário bloqueado")),
    ),
    el(
      "button",
      {
        class: "btn btn-sm btn-danger",
        onClick: async () => {
          if (!window.confirm("Liberar este período na agenda?")) return;
          await requestAdmin(`/admin/bloqueios/${bloqueio.id}`, { method: "DELETE" }).catch(() => {});
          carregarBloqueios();
        },
        type: "button",
      },
      "Remover",
    ),
  );
}

// endregion

function trocarAba(botao) {
  document.querySelectorAll(".tab").forEach((aba) => {
    const ativa = aba === botao;
    aba.setAttribute("aria-selected", String(ativa));
    document.getElementById(aba.dataset.aba).hidden = !ativa;
  });
  if (botao.dataset.aba === "aba-bloqueios") carregarBloqueios();
  else carregarAgendamentos();
}

function registrarEventos() {
  document.getElementById("form-login").addEventListener("submit", entrar);
  document.getElementById("sair").addEventListener("click", sair);
  document.querySelectorAll(".tab").forEach((aba) => aba.addEventListener("click", () => trocarAba(aba)));

  document.getElementById("dia-anterior").addEventListener("click", () => moverDia(-1));
  document.getElementById("dia-seguinte").addEventListener("click", () => moverDia(1));
  document.getElementById("filtro-hoje").addEventListener("click", () => {
    estado.data = dataIso(new Date());
    estado.modo = "dia";
    carregarAgendamentos();
  });
  document.getElementById("filtro-proximos").addEventListener("click", () => {
    estado.modo = estado.modo === "proximos" ? "dia" : "proximos";
    carregarAgendamentos();
  });
  document.getElementById("filtro-pendentes").addEventListener("click", () => {
    estado.somentePendentes = !estado.somentePendentes;
    carregarAgendamentos();
  });

  const formBloqueio = document.getElementById("form-bloqueio");
  formBloqueio.elements.data.value = dataIso(new Date());
  formBloqueio.elements.diaInteiro.addEventListener("change", (evento) => {
    document.getElementById("campos-horario").hidden = evento.currentTarget.checked;
  });
  formBloqueio.addEventListener("submit", criarBloqueio);
}

registrarEventos();
if (estado.token) mostrarPainel();
else sair();
