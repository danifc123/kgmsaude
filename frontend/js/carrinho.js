// Serviços escolhidos, guardados na sessão para sobreviver à troca de página.
const CHAVE = "kg-carrinho";

export function alternar(id) {
  const ids = ler();
  const posicao = ids.indexOf(id);
  if (posicao === -1) ids.push(id);
  else ids.splice(posicao, 1);
  salvar(ids);
  return ids;
}

export function ler() {
  try {
    const salvo = JSON.parse(sessionStorage.getItem(CHAVE));
    return Array.isArray(salvo) ? salvo : [];
  } catch {
    return [];
  }
}

export function limpar() {
  salvar([]);
}

function salvar(ids) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(ids));
  } catch {
    // Navegação privada pode bloquear o storage; o carrinho só não persiste.
  }
}
