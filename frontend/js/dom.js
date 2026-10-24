/**
 * Cria um elemento com atributos e filhos. Texto entra sempre como textContent,
 * então dados digitados por clientes nunca viram HTML.
 */
export function el(tag, atributos = {}, ...filhos) {
  const elemento = document.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === false || valor === null || valor === undefined) continue;
    if (nome.startsWith("on")) elemento.addEventListener(nome.slice(2).toLowerCase(), valor);
    else if (nome === "class") elemento.className = valor;
    else elemento.setAttribute(nome, valor === true ? "" : valor);
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    elemento.append(filho instanceof Node ? filho : String(filho));
  }
  return elemento;
}

// Texto de carregamento que, se demorar, explica que o servidor pode estar "acordando".
export function carregandoComAviso(alvo, texto = "Carregando…", esperaMs = 5000) {
  const paragrafo = el("p", { "aria-live": "polite", class: "loading" }, texto);
  alvo.replaceChildren(paragrafo);
  const aviso = setTimeout(() => {
    paragrafo.textContent = `${texto} Na primeira visita do dia o site pode levar até 1 minuto para abrir.`;
  }, esperaMs);
  return () => clearTimeout(aviso);
}

// Mensagem de erro com botão para recarregar a página.
export function erroComNovaTentativa(alvo, mensagem) {
  alvo.replaceChildren(
    el(
      "div",
      { class: "alert", role: "alert" },
      el("p", { style: "margin:0 0 10px" }, mensagem),
      el("button", { class: "btn btn-ghost btn-sm", onClick: () => window.location.reload(), type: "button" }, "Tentar de novo"),
    ),
  );
}

// Ícone SVG de traço a partir de um path.
export function icone(d) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  svg.append(path);
  return svg;
}

// Copia o texto e dá feedback no próprio botão.
export async function copiarTexto(texto, botao) {
  const original = botao.textContent;
  try {
    await navigator.clipboard.writeText(texto);
    botao.textContent = "Copiado!";
    botao.classList.add("copied");
  } catch {
    botao.textContent = "Toque e segure para copiar";
  }
  setTimeout(() => {
    botao.textContent = original;
    botao.classList.remove("copied");
  }, 1800);
}
