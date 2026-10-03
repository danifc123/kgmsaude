import { request } from "./api.js";
import * as carrinho from "./carrinho.js";
import { CONFIG } from "./config.js";
import { el } from "./dom.js";
import { formatarDuracao, formatarMoeda, linkWhatsApp } from "./formatadores.js";

const CATEGORIAS = ["Facial", "Corporal"];
const MENSAGEM_PADRAO = "Olá! Vim pelo Instagram e gostaria de agendar um horário 😊";

const catalogoEl = document.getElementById("catalogo");
const ctaCart = document.getElementById("cta-cart");
const ctaDefault = document.getElementById("cta-default");

let servicosPorId = new Map();

function atualizarCarrinho() {
  const ids = carrinho.ler().filter((id) => servicosPorId.has(id));
  const total = ids.reduce((soma, id) => soma + servicosPorId.get(id).precoCentavos, 0);

  document.querySelectorAll(".service[data-id]").forEach((item) => {
    const selecionado = ids.includes(item.dataset.id);
    item.classList.toggle("selected", selecionado);
    item.setAttribute("aria-checked", String(selecionado));
  });

  ctaDefault.hidden = ids.length > 0;
  ctaCart.hidden = ids.length === 0;
  document.getElementById("cart-count").textContent =
    ids.length === 1 ? "1 serviço selecionado" : `${ids.length} serviços selecionados`;
  document.getElementById("cart-total").textContent = formatarMoeda(total);
}

function criarItemServico(servico) {
  const alternar = () => {
    carrinho.alternar(servico.id);
    atualizarCarrinho();
  };
  return el(
    "div",
    {
      "aria-checked": "false",
      class: "service",
      "data-id": servico.id,
      onClick: alternar,
      onKeydown: (evento) => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        evento.preventDefault();
        alternar();
      },
      role: "checkbox",
      tabindex: "0",
    },
    el("div", { "aria-hidden": "true", class: "svc-check" }),
    el(
      "div",
      { class: "svc-info" },
      el("div", { class: "svc-name" }, servico.nome),
      el("span", { class: "svc-dur" }, formatarDuracao(servico.duracaoMinutos)),
    ),
    el("div", { class: "svc-price" }, formatarMoeda(servico.precoCentavos)),
  );
}

function criarTituloSecao(texto) {
  return el(
    "div",
    { class: "eyebrow" },
    el("div", { class: "line" }),
    el("span", {}, texto),
    el("div", { class: "line" }),
  );
}

async function carregarCatalogo() {
  try {
    const servicos = await request("/servicos");
    servicosPorId = new Map(servicos.map((s) => [s.id, s]));
    catalogoEl.replaceChildren(
      ...CATEGORIAS.flatMap((categoria) => [
        criarTituloSecao(categoria),
        el(
          "div",
          { class: "menu-group" },
          servicos.filter((s) => s.categoria === categoria).map(criarItemServico),
        ),
      ]),
    );
    atualizarCarrinho();
  } catch (erro) {
    catalogoEl.replaceChildren(el("p", { class: "alert" }, erro.message));
  }
}

function configurarLinks() {
  const link = linkWhatsApp(MENSAGEM_PADRAO);
  ["wa-icon", "wa-text", "wa-cta"].forEach((id) => {
    document.getElementById(id).href = link;
  });
  document.querySelectorAll("[data-instagram]").forEach((a) => {
    a.href = CONFIG.instagram;
  });
}

configurarLinks();
carregarCatalogo();
