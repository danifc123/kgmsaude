import { el } from "../../dom.js";
import { dataIso, formatarHora } from "../../formatadores.js";
import {
  STATUS_FECHADOS,
  botaoIcone,
  carregando,
  erroCarregamento,
  hojeIso,
  inicioDaSemana,
  minutosDoDia,
  plural,
  somarDias,
  textoServicos,
} from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Agenda";

const PX_POR_MINUTO = 64 / 60; // igual a --hora no CSS
const NOMES_STATUS = { CONCLUIDO: "Concluído", CONFIRMADO: "Confirmado", PENDENTE: "Aguardando sinal" };

// Estado da tela (sobrevive à troca de abas).
const estado = { inicio: null, mostrarFechados: false };
let expedienteCache = null;

function ehCelular() {
  return window.matchMedia("(max-width: 860px)").matches;
}

// Dias exibidos: no computador, a semana (seg–sáb, + domingo se houver algo); no celular, 1 dia.
function diasVisiveis(agendamentos) {
  if (ehCelular()) return [estado.inicio];
  const semana = Array.from({ length: 7 }, (_, i) => somarDias(estado.inicio, i));
  const domingo = dataIso(semana[6]);
  const temDomingo = expedienteCache.some((f) => f.diaSemana === 6) || agendamentos.some((a) => a.inicio.startsWith(domingo));
  return temDomingo ? semana : semana.slice(0, 6);
}

// Janela de horas do calendário: do primeiro horário de abertura ao último de fechamento.
function janelaDeHoras(agendamentos) {
  const minutos = [
    ...expedienteCache.flatMap((f) => [minutosDoDia(`2000-01-01T${f.abreAs}`), minutosDoDia(`2000-01-01T${f.fechaAs}`)]),
    ...agendamentos.flatMap((a) => [minutosDoDia(a.inicio), minutosDoDia(a.fim)]),
  ];
  const inicio = minutos.length ? Math.floor(Math.min(...minutos) / 60) * 60 : 8 * 60;
  const fim = minutos.length ? Math.ceil(Math.max(...minutos) / 60) * 60 : 19 * 60;
  return { fim, inicio };
}

function rotuloPeriodo(dias) {
  const primeiro = dias[0];
  const ultimo = dias.at(-1);
  if (dias.length === 1) return primeiro.toLocaleDateString("pt-BR", { day: "numeric", month: "long", weekday: "long" });
  const mesmoMes = primeiro.getMonth() === ultimo.getMonth();
  const inicioTexto = primeiro.toLocaleDateString("pt-BR", mesmoMes ? { day: "numeric" } : { day: "numeric", month: "short" }).replace(".", "");
  const fimTexto = ultimo.toLocaleDateString("pt-BR", { day: "numeric", month: "long", year: "numeric" });
  return `${inicioTexto} – ${fimTexto}`;
}

function criarEvento(agendamento, janela, ctx, aoAlterar) {
  const inicio = minutosDoDia(agendamento.inicio);
  const fim = minutosDoDia(agendamento.fim);
  const altura = Math.max((fim - inicio) * PX_POR_MINUTO - 2, 20);
  const compacto = altura < 34; // uma linha: hora + nome
  const semServicos = altura < 62; // duas linhas: horário e nome
  const fechado = STATUS_FECHADOS.includes(agendamento.status);
  const horario = `${formatarHora(agendamento.inicio)}–${formatarHora(agendamento.fim)}`;

  return el(
    "button",
    {
      "aria-label": `${horario}, ${agendamento.clienteNome}, ${textoServicos(agendamento)}`,
      class: `evento${compacto ? " is-compacto" : ""}${fechado ? " is-fechado" : ""}`,
      onClick: () => ctx.abrirDetalhe(agendamento, aoAlterar),
      style: `top:${(inicio - janela.inicio) * PX_POR_MINUTO + 1}px;height:${altura}px;--cor:var(--status-${agendamento.status})`,
      type: "button",
    },
    el("span", { class: "t" }, compacto ? formatarHora(agendamento.inicio) : horario),
    el("span", { class: "n" }, agendamento.clienteNome),
    !semServicos && el("span", { class: "s" }, textoServicos(agendamento)),
  );
}

// Parte de um bloqueio (que pode durar vários dias) que cai neste dia e na janela visível.
function criarBloqueio(bloqueio, diaIso, janela) {
  const inicioDia = `${diaIso}T00:00:00`;
  const fimDia = `${dataIso(somarDias(new Date(`${diaIso}T00:00:00`), 1))}T00:00:00`;
  if (bloqueio.fim <= inicioDia || bloqueio.inicio >= fimDia) return null;

  const de = Math.max(bloqueio.inicio <= inicioDia ? 0 : minutosDoDia(bloqueio.inicio), janela.inicio);
  const ate = Math.min(bloqueio.fim >= fimDia ? 24 * 60 : minutosDoDia(bloqueio.fim), janela.fim);
  if (ate <= de) return null;
  return el(
    "div",
    { class: "bloqueio", style: `top:${(de - janela.inicio) * PX_POR_MINUTO + 1}px;height:${(ate - de) * PX_POR_MINUTO - 2}px` },
    bloqueio.motivo || "Bloqueado",
  );
}

function criarCalendario(dias, agendamentos, bloqueios, ctx, aoAlterar) {
  const janela = janelaDeHoras(agendamentos);
  const alturaTotal = (janela.fim - janela.inicio) * PX_POR_MINUTO;
  const hoje = hojeIso();
  const agoraMin = new Date().getHours() * 60 + new Date().getMinutes();
  const horas = Array.from({ length: (janela.fim - janela.inicio) / 60 + 1 }, (_, i) => janela.inicio / 60 + i);

  const cabecalhos = dias.map((dia) => {
    const iso = dataIso(dia);
    const doDia = agendamentos.filter((a) => a.inicio.startsWith(iso) && !STATUS_FECHADOS.includes(a.status));
    return el(
      "div",
      { class: `cal-head${iso === hoje ? " is-hoje" : ""}` },
      el("span", { class: "dow" }, dia.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", "")),
      el("span", { class: "num" }, dia.getDate()),
      el("span", { class: "qtd" }, doDia.length ? plural(doDia.length, "horário", "horários") : "livre"),
    );
  });

  const colunas = dias.map((dia) => {
    const iso = dataIso(dia);
    const faixas = expedienteCache.filter((f) => f.diaSemana === (dia.getDay() + 6) % 7);
    return el(
      "div",
      { class: "cal-col", style: `height:${alturaTotal}px` },
      faixas.map((f) => {
        const de = minutosDoDia(`2000-01-01T${f.abreAs}`);
        const ate = minutosDoDia(`2000-01-01T${f.fechaAs}`);
        return el("div", { class: "cal-aberto", style: `top:${(de - janela.inicio) * PX_POR_MINUTO}px;height:${(ate - de) * PX_POR_MINUTO}px` });
      }),
      horas.slice(1).map((h) => el("div", { class: "cal-linha", style: `top:${(h * 60 - janela.inicio) * PX_POR_MINUTO}px` })),
      bloqueios.map((b) => criarBloqueio(b, iso, janela)),
      agendamentos.filter((a) => a.inicio.startsWith(iso)).map((a) => criarEvento(a, janela, ctx, aoAlterar)),
      iso === hoje && agoraMin > janela.inicio && agoraMin < janela.fim && el("div", { class: "agora", style: `top:${(agoraMin - janela.inicio) * PX_POR_MINUTO}px`, title: "Agora" }),
    );
  });

  const gutter = el(
    "div",
    { class: "cal-gutter", style: `height:${alturaTotal}px` },
    horas.map((h) => el("span", { style: `top:${(h * 60 - janela.inicio) * PX_POR_MINUTO}px` }, `${String(h).padStart(2, "0")}:00`)),
  );

  return el(
    "div",
    { class: "cal", style: `grid-template-columns:56px repeat(${dias.length}, minmax(0, 1fr));${dias.length === 1 ? "min-width:0" : ""}` },
    el("div", { class: "cal-corner" }),
    ...cabecalhos,
    gutter,
    ...colunas,
  );
}

function legenda() {
  const item = (cor, texto, classe = "") => el("span", {}, el("i", { class: classe, style: cor ? `--cor:${cor}` : "" }), texto);
  return el(
    "div",
    { class: "legenda" },
    ...Object.entries(NOMES_STATUS).map(([status, texto]) => item(`var(--status-${status})`, texto)),
    item(null, "Folga / bloqueio", "hachura"),
    el("span", {}, "Fundo listrado = fora do horário de atendimento"),
  );
}

export async function renderizar(container, ctx) {
  estado.inicio ??= ehCelular() ? new Date(new Date().setHours(0, 0, 0, 0)) : inicioDaSemana(new Date());
  const recarregar = () => renderizar(container, ctx);
  const mover = (delta) => {
    estado.inicio = somarDias(estado.inicio, ehCelular() ? delta : delta * 7);
    recarregar();
  };
  const irParaHoje = () => {
    estado.inicio = ehCelular() ? new Date(new Date().setHours(0, 0, 0, 0)) : inicioDaSemana(new Date());
    recarregar();
  };

  container.replaceChildren(carregando());
  const ultimoDia = somarDias(estado.inicio, ehCelular() ? 0 : 6);
  const periodo = `inicio=${dataIso(estado.inicio)}&fim=${dataIso(ultimoDia)}`;
  let agendamentos;
  let bloqueios;
  try {
    [agendamentos, bloqueios, expedienteCache] = await Promise.all([
      requestAdmin(`/admin/agendamentos?${periodo}`),
      requestAdmin(`/admin/bloqueios?${periodo}`),
      expedienteCache ? Promise.resolve(expedienteCache) : requestAdmin("/admin/expediente"),
    ]);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  const visiveis = estado.mostrarFechados ? agendamentos : agendamentos.filter((a) => !STATUS_FECHADOS.includes(a.status));
  const dias = diasVisiveis(visiveis);
  const fechados = agendamentos.length - agendamentos.filter((a) => !STATUS_FECHADOS.includes(a.status)).length;

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, ehCelular() ? "Agenda do dia" : "Agenda da semana"), el("h1", { class: "page-title" }, "Agenda")),
      el("div", { class: "page-actions" }, el("a", { class: "btn btn-ghost btn-sm", href: "#/folgas" }, "Marcar folga ou bloqueio")),
    ),
    el(
      "div",
      { class: "toolbar" },
      botaoIcone("esquerda", ehCelular() ? "Dia anterior" : "Semana anterior", () => mover(-1)),
      el("span", { class: "periodo" }, rotuloPeriodo(dias)),
      botaoIcone("direita", ehCelular() ? "Próximo dia" : "Próxima semana", () => mover(1)),
      el("button", { class: "btn btn-ghost btn-sm", onClick: irParaHoje, type: "button" }, "Hoje"),
      el("span", { class: "spacer" }),
      fechados > 0 &&
        el(
          "label",
          { class: "toggle" },
          el("input", {
            checked: estado.mostrarFechados,
            onChange: (e) => {
              estado.mostrarFechados = e.currentTarget.checked;
              recarregar();
            },
            type: "checkbox",
          }),
          `Mostrar cancelados e expirados (${fechados})`,
        ),
    ),
    el("section", { class: "card calendar" }, el("div", { class: "cal-scroll" }, criarCalendario(dias, visiveis, bloqueios, ctx, recarregar)), legenda()),
  );
}
