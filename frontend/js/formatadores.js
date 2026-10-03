import { CONFIG } from "./config.js";

const moeda = new Intl.NumberFormat("pt-BR", { currency: "BRL", style: "currency" });

// "2026-10-05" → Date local (sem o deslocamento de fuso do construtor com string).
export function dataLocal(iso) {
  const [ano, mes, dia] = iso.slice(0, 10).split("-").map(Number);
  return new Date(ano, mes - 1, dia);
}

// Date → "2026-10-05".
export function dataIso(data) {
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${mes}-${dia}`;
}

// "segunda-feira, 5 de outubro"
export function formatarDataLonga(iso) {
  return dataLocal(iso).toLocaleDateString("pt-BR", { day: "numeric", month: "long", weekday: "long" });
}

// 75 → "1h15", 45 → "45 min"
export function formatarDuracao(minutos) {
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}

// "2026-10-05T09:30:00" → "09:30"
export function formatarHora(isoDataHora) {
  return isoDataHora.slice(11, 16);
}

export function formatarMoeda(centavos) {
  return moeda.format(centavos / 100);
}

// "99988887777" → "(99) 98888-7777"
export function formatarTelefone(digitos) {
  const d = digitos.replace(/^55(?=\d{10,11}$)/, "");
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return digitos;
}

// Link do WhatsApp com mensagem pronta. Sem número, abre o da Katiuschia.
export function linkWhatsApp(mensagem, numero = CONFIG.whatsappNumero) {
  const destino = numero.length <= 11 ? `55${numero}` : numero;
  return `https://api.whatsapp.com/send?phone=${destino}&text=${encodeURIComponent(mensagem)}`;
}
