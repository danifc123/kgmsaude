import { el, icone } from "../dom.js";
import { ICONES, STATUS_FECHADOS } from "./comum.js";
import { abrirDetalhe } from "./detalhe.js";
import { definirAoExpirar, emailLogado, entrar, requestAdmin, sair, temSessao } from "./sessao.js";
import * as agenda from "./telas/agenda.js";
import * as agendamentos from "./telas/agendamentos.js";
import * as financeiro from "./telas/financeiro.js";
import * as folgas from "./telas/folgas.js";
import * as servicos from "./telas/servicos.js";
import * as visaoGeral from "./telas/visao-geral.js";

// Telas do painel, na ordem do menu. A rota é o trecho depois de "#/".
const TELAS = [
  { icone: "inicio", modulo: visaoGeral, rota: "inicio" },
  { icone: "agenda", modulo: agenda, rota: "agenda" },
  { icone: "lista", modulo: agendamentos, rota: "agendamentos" },
  { icone: "dinheiro", modulo: financeiro, rota: "financeiro" },
  { icone: "folga", modulo: folgas, rota: "folgas" },
  { icone: "servicos", modulo: servicos, rota: "servicos" },
];

const conteudo = document.getElementById("conteudo");
const nav = document.getElementById("nav");
const telaLogin = document.getElementById("tela-login");
const telaPainel = document.getElementById("tela-painel");

// region Navegação

function lerRota() {
  const [caminho, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const tela = TELAS.find((t) => t.rota === caminho) ?? TELAS[0];
  return { params: new URLSearchParams(query), tela };
}

function montarMenu() {
  nav.replaceChildren(
    ...TELAS.map((t) =>
      el("a", { "data-rota": t.rota, href: `#/${t.rota}` }, icone(ICONES[t.icone]), el("span", {}, t.modulo.titulo)),
    ),
  );
}

async function atualizarContadorPendentes() {
  try {
    const proximos = await requestAdmin("/admin/agendamentos");
    const pendentes = proximos.filter((a) => a.status === "PENDENTE" && !STATUS_FECHADOS.includes(a.status)).length;
    const link = nav.querySelector('[data-rota="agendamentos"]');
    link.querySelector(".badge")?.remove();
    if (pendentes) link.append(el("span", { "aria-label": `${pendentes} aguardando sinal`, class: "badge" }, pendentes));
  } catch {
    // O contador é só um atalho; a tela continua funcionando sem ele.
  }
}

function mostrarTela() {
  if (!temSessao()) return;
  const { params, tela } = lerRota();
  nav.querySelectorAll("a").forEach((a) => {
    if (a.dataset.rota === tela.rota) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = `${tela.modulo.titulo} · Painel KG`;

  const ctx = {
    abrirDetalhe: (agendamento, aoAlterar) =>
      abrirDetalhe(agendamento, () => {
        atualizarContadorPendentes();
        (aoAlterar ?? mostrarTela)();
      }),
    navegar: (hash) => {
      window.location.hash = hash;
    },
    params,
  };
  // Cada navegação ganha uma área nova: se a tela anterior ainda estiver carregando,
  // a resposta atrasada dela cai numa área que já saiu da página e não sobrescreve esta.
  const area = el("div");
  conteudo.replaceChildren(area);
  tela.modulo.renderizar(area, ctx);
  window.scrollTo({ top: 0 });
}

// endregion

// region Sessão

function abrirLogin() {
  telaPainel.hidden = true;
  telaLogin.hidden = false;
  document.title = "Painel · KG Espaço Saúde";
}

function abrirPainel() {
  telaLogin.hidden = true;
  telaPainel.hidden = false;
  document.getElementById("usuario").textContent = emailLogado();
  mostrarTela();
  atualizarContadorPendentes();
}

async function enviarLogin(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  const erroEl = document.getElementById("erro-login");
  erroEl.hidden = true;
  try {
    await entrar(form.elements.email.value, form.elements.senha.value);
    form.reset();
    abrirPainel();
  } catch (erro) {
    erroEl.textContent = erro.message;
    erroEl.hidden = false;
  }
}

// endregion

montarMenu();
definirAoExpirar(abrirLogin);
document.getElementById("form-login").addEventListener("submit", enviarLogin);
document.getElementById("sair").addEventListener("click", () => {
  sair();
  abrirLogin();
});
window.addEventListener("hashchange", mostrarTela);

if (temSessao()) abrirPainel();
else abrirLogin();
