import { el } from "../../dom.js";
import { dataIso, dataLocal, formatarDataLonga, formatarHora } from "../../formatadores.js";
import { carregando, erroCarregamento, somarDias } from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Folgas";

const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

function descreverBloqueio(bloqueio) {
  const diaInteiro = bloqueio.inicio.endsWith("T00:00:00") && bloqueio.fim.endsWith("T00:00:00");
  const ultimoDia = diaInteiro ? dataIso(somarDias(dataLocal(bloqueio.fim), -1)) : bloqueio.fim.slice(0, 10);
  const variosDias = bloqueio.inicio.slice(0, 10) !== ultimoDia;

  if (diaInteiro && !variosDias) return { quando: formatarDataLonga(bloqueio.inicio), tipo: "Dia inteiro" };
  if (diaInteiro) return { quando: `${formatarDataLonga(bloqueio.inicio)} até ${formatarDataLonga(ultimoDia)}`, tipo: "Dias inteiros" };
  if (!variosDias) return { quando: `${formatarDataLonga(bloqueio.inicio)}, ${formatarHora(bloqueio.inicio)} – ${formatarHora(bloqueio.fim)}`, tipo: "Horário bloqueado" };
  return { quando: `${formatarDataLonga(bloqueio.inicio)} ${formatarHora(bloqueio.inicio)} até ${formatarDataLonga(bloqueio.fim)} ${formatarHora(bloqueio.fim)}`, tipo: "Período bloqueado" };
}

function criarFormulario(aoSalvar) {
  const erroEl = el("p", { class: "alert", hidden: true, role: "alert" });
  const camposHorario = el(
    "div",
    { class: "row", hidden: true },
    el("label", { class: "field" }, el("span", {}, "Das"), el("input", { name: "inicio", step: "1800", type: "time", value: "08:00" })),
    el("label", { class: "field" }, el("span", {}, "Até"), el("input", { name: "fim", step: "1800", type: "time", value: "11:00" })),
  );
  const amanha = dataIso(somarDias(new Date(), 1));

  const form = el(
    "form",
    {
      onSubmit: async (evento) => {
        evento.preventDefault();
        erroEl.hidden = true;
        const campos = form.elements;
        const de = campos.de.value;
        const ate = campos.ate.value || de;
        const diaInteiro = campos.diaInteiro.checked;
        try {
          await requestAdmin("/admin/bloqueios", {
            body: {
              fim: diaInteiro ? `${dataIso(somarDias(dataLocal(ate), 1))}T00:00:00` : `${ate}T${campos.fim.value}:00`,
              inicio: diaInteiro ? `${de}T00:00:00` : `${de}T${campos.inicio.value}:00`,
              motivo: campos.motivo.value || null,
            },
            method: "POST",
          });
          aoSalvar();
        } catch (erro) {
          erroEl.textContent = erro.message;
          erroEl.hidden = false;
        }
      },
    },
    el(
      "div",
      { class: "row" },
      el("label", { class: "field" }, el("span", {}, "De"), el("input", { name: "de", required: true, type: "date", value: amanha })),
      el("label", { class: "field" }, el("span", {}, "Até (opcional)"), el("input", { name: "ate", type: "date" })),
    ),
    el(
      "label",
      { class: "check" },
      el("input", { checked: true, name: "diaInteiro", onChange: (e) => (camposHorario.hidden = e.currentTarget.checked), type: "checkbox" }),
      "Dia inteiro",
    ),
    camposHorario,
    el("label", { class: "field" }, el("span", {}, "Motivo (opcional)"), el("input", { maxlength: "120", name: "motivo", placeholder: "Folga, curso, consulta…" })),
    erroEl,
    el("button", { class: "btn btn-primary", style: "width:100%", type: "submit" }, "Bloquear na agenda"),
  );
  return form;
}

function criarListaBloqueios(bloqueios, aoRemover) {
  if (bloqueios.length === 0) return el("p", { class: "empty" }, "Nenhuma folga ou bloqueio marcado.");
  return el(
    "div",
    { class: "blocks" },
    bloqueios.map((b) => {
      const { quando, tipo } = descreverBloqueio(b);
      return el(
        "div",
        { class: "block" },
        el("div", { class: "block-info" }, el("div", { class: "block-when" }, quando), el("div", { class: "block-reason" }, b.motivo ? `${tipo} · ${b.motivo}` : tipo)),
        el(
          "button",
          {
            class: "btn btn-sm btn-danger",
            onClick: async () => {
              if (!window.confirm("Liberar este período na agenda?")) return;
              await requestAdmin(`/admin/bloqueios/${b.id}`, { method: "DELETE" }).catch(() => {});
              aoRemover();
            },
            type: "button",
          },
          "Remover",
        ),
      );
    }),
  );
}

function criarExpediente(expediente) {
  return el(
    "ul",
    { class: "expediente" },
    DIAS.map((nome, dia) => {
      const faixas = expediente.filter((f) => f.diaSemana === dia);
      return el(
        "li",
        {},
        el("span", {}, nome),
        faixas.length
          ? el("span", {}, faixas.map((f) => `${f.abreAs.slice(0, 5)} – ${f.fechaAs.slice(0, 5)}`).join("  ·  "))
          : el("span", { class: "fechado" }, "Fechado"),
      );
    }),
  );
}

export async function renderizar(container) {
  const recarregar = () => renderizar(container);
  container.replaceChildren(carregando());
  let bloqueios;
  let expediente;
  try {
    [bloqueios, expediente] = await Promise.all([requestAdmin("/admin/bloqueios"), requestAdmin("/admin/expediente")]);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, "Dias e horários sem atendimento"), el("h1", { class: "page-title" }, "Folgas e bloqueios")),
    ),
    el(
      "div",
      { class: "grid grid-2-igual" },
      el(
        "div",
        { class: "stack" },
        el("section", { class: "card" }, el("h2", { class: "card-title" }, "Bloquear um período"), criarFormulario(recarregar)),
        el(
          "section",
          { class: "card" },
          el("h2", { class: "card-title" }, "Seu horário de atendimento"),
          criarExpediente(expediente),
          el("p", { class: "rodape-nota" }, "Para um dia específico, use o bloqueio acima. ", el("a", { class: "link", href: "#/servicos" }, "Mudar o horário fixo →")),
        ),
      ),
      el("section", { class: "card" }, el("h2", { class: "card-title" }, "Próximas folgas e bloqueios"), criarListaBloqueios(bloqueios, recarregar)),
    ),
  );
}
