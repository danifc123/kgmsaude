import { el, icone } from "../../dom.js";
import { formatarDuracao, formatarMoeda } from "../../formatadores.js";
import { ICONES, carregando, erroCarregamento } from "../comum.js";
import { requestAdmin } from "../sessao.js";

export const titulo = "Serviços e horários";

const CATEGORIAS = ["Facial", "Corporal"];
const DIAS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

// region Utilitários

// "150", "150,00", "1.250,50" → centavos. null se não for um valor válido.
function lerReais(texto) {
  const normalizado = texto.trim().replace(/^R\$\s*/, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalizado)) return null;
  return Math.round(Number(normalizado) * 100);
}

function reaisParaCampo(centavos) {
  return (centavos / 100).toFixed(2).replace(".", ",");
}

function feedback() {
  return el("span", { "aria-live": "polite", class: "salvo" });
}

function mostrarFeedback(alvo, texto, erro = false) {
  alvo.textContent = texto;
  alvo.classList.toggle("is-erro", erro);
  if (!erro) setTimeout(() => (alvo.textContent = ""), 2500);
}

// endregion

// region Serviços

function campo(rotulo, controle, classe = "") {
  return el("label", { class: `field ${classe}` }, el("span", {}, rotulo), controle);
}

function selectCategoria(valor) {
  return el("select", { name: "categoria" }, CATEGORIAS.map((c) => el("option", { selected: c === valor, value: c }, c)));
}

function criarLinhaServico(servico) {
  const status = feedback();
  const botaoSalvar = el("button", { class: "btn btn-primary btn-sm", disabled: true, type: "submit" }, "Salvar");

  const form = el(
    "form",
    {
      class: `svc-edit${servico.ativo ? "" : " is-inativo"}`,
      onInput: () => (botaoSalvar.disabled = false),
      onSubmit: async (evento) => {
        evento.preventDefault();
        const c = form.elements;
        const preco = lerReais(c.preco.value);
        if (preco === null) return mostrarFeedback(status, "Preço inválido. Ex.: 150,00", true);
        try {
          const salvo = await requestAdmin(`/admin/servicos/${servico.id}`, {
            body: {
              ativo: c.ativo.checked,
              categoria: c.categoria.value,
              duracaoMinutos: Number(c.duracao.value),
              exigeEndereco: c.endereco.checked,
              nome: c.nome.value,
              precoCentavos: preco,
            },
            method: "PATCH",
          });
          Object.assign(servico, salvo);
          form.classList.toggle("is-inativo", !salvo.ativo);
          botaoSalvar.disabled = true;
          mostrarFeedback(status, "Salvo ✓");
        } catch (erro) {
          mostrarFeedback(status, erro.message, true);
        }
      },
    },
    campo("Nome", el("input", { maxlength: "80", minlength: "2", name: "nome", required: true, value: servico.nome }), "svc-nome"),
    campo("Categoria", selectCategoria(servico.categoria)),
    campo("Duração (min)", el("input", { max: "480", min: "10", name: "duracao", required: true, step: "5", type: "number", value: servico.duracaoMinutos })),
    campo("Preço (R$)", el("input", { inputmode: "decimal", name: "preco", required: true, value: reaisParaCampo(servico.precoCentavos) })),
    el(
      "div",
      { class: "svc-opcoes" },
      el("label", { class: "check" }, el("input", { checked: servico.ativo, name: "ativo", type: "checkbox" }), "Aparece no site"),
      el("label", { class: "check" }, el("input", { checked: servico.exigeEndereco, name: "endereco", type: "checkbox" }), "Pede endereço"),
    ),
    el("div", { class: "svc-salvar" }, status, botaoSalvar),
  );
  return form;
}

function criarFormNovoServico(aoCriar) {
  const status = feedback();
  const form = el(
    "form",
    {
      class: "svc-edit svc-novo",
      onSubmit: async (evento) => {
        evento.preventDefault();
        const c = form.elements;
        const preco = lerReais(c.preco.value);
        if (preco === null) return mostrarFeedback(status, "Preço inválido. Ex.: 150,00", true);
        try {
          await requestAdmin("/admin/servicos", {
            body: {
              categoria: c.categoria.value,
              duracaoMinutos: Number(c.duracao.value),
              exigeEndereco: c.endereco.checked,
              nome: c.nome.value,
              precoCentavos: preco,
            },
            method: "POST",
          });
          aoCriar();
        } catch (erro) {
          mostrarFeedback(status, erro.message, true);
        }
      },
    },
    campo("Nome do serviço", el("input", { maxlength: "80", minlength: "2", name: "nome", placeholder: "Ex.: Drenagem linfática", required: true }), "svc-nome"),
    campo("Categoria", selectCategoria("Facial")),
    campo("Duração (min)", el("input", { max: "480", min: "10", name: "duracao", required: true, step: "5", type: "number", value: "60" })),
    campo("Preço (R$)", el("input", { inputmode: "decimal", name: "preco", placeholder: "0,00", required: true })),
    el("div", { class: "svc-opcoes" }, el("label", { class: "check" }, el("input", { name: "endereco", type: "checkbox" }), "Pede endereço (a domicílio)")),
    el("div", { class: "svc-salvar" }, status, el("button", { class: "btn btn-primary btn-sm", type: "submit" }, "Adicionar")),
  );
  return form;
}

function criarCartaoServicos(servicos, recarregar) {
  const novo = el("div", { hidden: true }, criarFormNovoServico(recarregar));
  const botaoNovo = el(
    "button",
    {
      class: "btn btn-ghost btn-sm",
      onClick: () => {
        novo.hidden = !novo.hidden;
        if (!novo.hidden) novo.querySelector("input")?.focus();
      },
      type: "button",
    },
    "+ Novo serviço",
  );

  return el(
    "section",
    { class: "card" },
    el("h2", { class: "card-title" }, "Serviços", botaoNovo),
    el("p", { class: "rodape-nota", style: "margin:0 0 14px" }, "Mudanças aparecem no site na hora. Agendamentos já feitos mantêm o preço e a duração de quando foram marcados."),
    novo,
    ...CATEGORIAS.map((categoria) => {
      const daCategoria = servicos.filter((s) => s.categoria === categoria);
      return el(
        "div",
        { class: "svc-grupo" },
        el("h3", {}, categoria, el("small", {}, ` · ${daCategoria.length}`)),
        daCategoria.length ? daCategoria.map(criarLinhaServico) : el("p", { class: "empty" }, "Nenhum serviço nesta categoria."),
      );
    }),
  );
}

// endregion

// region Horário de atendimento

function criarCartaoExpediente(expediente) {
  // Estado editável: faixas por dia, como "HH:MM".
  const faixasPorDia = DIAS.map((_, dia) =>
    expediente.filter((f) => f.diaSemana === dia).map((f) => ({ abre: f.abreAs.slice(0, 5), fecha: f.fechaAs.slice(0, 5) })),
  );
  const status = feedback();
  const botaoSalvar = el("button", { class: "btn btn-primary", disabled: true, type: "button" }, "Salvar horário");
  const lista = el("div", { class: "exp-dias" });
  const marcarAlterado = () => (botaoSalvar.disabled = false);

  const desenhar = () => {
    lista.replaceChildren(
      ...DIAS.map((nome, dia) => {
        const faixas = faixasPorDia[dia];
        return el(
          "div",
          { class: `exp-dia${faixas.length ? "" : " is-fechado"}` },
          el("span", { class: "exp-nome" }, nome),
          el(
            "div",
            { class: "exp-faixas" },
            faixas.length === 0 && el("span", { class: "exp-fechado" }, "Fechado"),
            faixas.map((faixa, i) =>
              el(
                "div",
                { class: "exp-faixa" },
                el("input", { "aria-label": `${nome}, início`, onChange: (e) => ((faixa.abre = e.currentTarget.value), marcarAlterado()), step: "1800", type: "time", value: faixa.abre }),
                el("span", {}, "às"),
                el("input", { "aria-label": `${nome}, fim`, onChange: (e) => ((faixa.fecha = e.currentTarget.value), marcarAlterado()), step: "1800", type: "time", value: faixa.fecha }),
                el(
                  "button",
                  {
                    "aria-label": `Remover horário de ${nome}`,
                    class: "icon-btn exp-remover",
                    onClick: () => {
                      faixas.splice(i, 1);
                      marcarAlterado();
                      desenhar();
                    },
                    type: "button",
                  },
                  icone(ICONES.fechar),
                ),
              ),
            ),
          ),
          el(
            "button",
            {
              class: "link",
              onClick: () => {
                const ultima = faixas.at(-1);
                faixas.push(ultima ? { abre: ultima.fecha, fecha: "19:00" } : { abre: "08:00", fecha: "12:00" });
                marcarAlterado();
                desenhar();
              },
              type: "button",
            },
            faixas.length ? "+ horário" : "+ abrir",
          ),
        );
      }),
    );
  };

  botaoSalvar.addEventListener("click", async () => {
    const faixas = faixasPorDia.flatMap((lista_, dia) =>
      lista_.map((f) => ({ abreAs: `${f.abre}:00`, diaSemana: dia, fechaAs: `${f.fecha}:00` })),
    );
    try {
      await requestAdmin("/admin/expediente", { body: { faixas }, method: "PUT" });
      botaoSalvar.disabled = true;
      mostrarFeedback(status, "Horário salvo ✓");
    } catch (erro) {
      mostrarFeedback(status, erro.message, true);
    }
  });

  desenhar();
  return el(
    "section",
    { class: "card" },
    el("h2", { class: "card-title" }, "Horário de atendimento"),
    el("p", { class: "rodape-nota", style: "margin:0 0 14px" }, "Dias e faixas em que as clientes podem agendar. Para um dia específico (folga, curso), use a tela Folgas."),
    lista,
    el("div", { class: "svc-salvar", style: "margin-top:16px" }, status, botaoSalvar),
  );
}

// endregion

function resumo(servicos) {
  const ativos = servicos.filter((s) => s.ativo);
  if (!ativos.length) return "Nenhum serviço aparecendo no site.";
  const precos = ativos.map((s) => s.precoCentavos);
  const duracoes = ativos.map((s) => s.duracaoMinutos);
  return `${ativos.length} no site · de ${formatarMoeda(Math.min(...precos))} a ${formatarMoeda(Math.max(...precos))} · ${formatarDuracao(Math.min(...duracoes))} a ${formatarDuracao(Math.max(...duracoes))}`;
}

export async function renderizar(container) {
  const recarregar = () => renderizar(container);
  container.replaceChildren(carregando());
  let servicos;
  let expediente;
  try {
    [servicos, expediente] = await Promise.all([requestAdmin("/admin/servicos"), requestAdmin("/admin/expediente")]);
  } catch (erro) {
    container.replaceChildren(erroCarregamento(erro.message));
    return;
  }

  container.replaceChildren(
    el(
      "header",
      { class: "page-head" },
      el("div", {}, el("p", { class: "page-eyebrow" }, resumo(servicos)), el("h1", { class: "page-title" }, "Serviços e horários")),
      el("div", { class: "page-actions" }, el("a", { class: "btn btn-ghost btn-sm", href: "index.html", rel: "noopener", target: "_blank" }, "Ver como aparece no site")),
    ),
    el("div", { class: "grid grid-servicos" }, criarCartaoServicos(servicos, recarregar), criarCartaoExpediente(expediente)),
  );
}
