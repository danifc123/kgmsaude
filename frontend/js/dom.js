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
