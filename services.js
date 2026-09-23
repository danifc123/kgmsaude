// Fonte única de verdade dos serviços — usada pelo index.html (renderizar)
// e pela função serverless /api/agendar (validar e recalcular o preço).
// Preço sempre em centavos, pra evitar erro de ponto flutuante.
var KG_SERVICES = [
  { id: "revitalizacao-labial", nome: "Revitalização labial", categoria: "Facial", duracao: "15 min", precoCentavos: 5000 },
  { id: "revitalizacao-facial", nome: "Revitalização facial", categoria: "Facial", duracao: "1h", precoCentavos: 7000 },
  { id: "limpeza-pele", nome: "Limpeza de pele", categoria: "Facial", duracao: null, precoCentavos: 15000 },
  { id: "ventosa-terapia", nome: "Ventosa terapia", categoria: "Corporal", duracao: "30 min", precoCentavos: 8000 },
  { id: "esfoliacao-corporal", nome: "Esfoliação corporal", categoria: "Corporal", duracao: "30 min", precoCentavos: 10000 },
  { id: "detox-termal", nome: "Detox termal", categoria: "Corporal", duracao: "30 min", precoCentavos: 12000 },
  { id: "massagem-relaxante", nome: "Massagem relaxante", categoria: "Corporal", duracao: "45 min", precoCentavos: 12000 },
  { id: "massagem-terapeutica", nome: "Massagem terapêutica", categoria: "Corporal", duracao: null, precoCentavos: 13000 }
];

if (typeof module !== "undefined" && module.exports) {
  module.exports = KG_SERVICES;
}
if (typeof window !== "undefined") {
  window.KG_SERVICES = KG_SERVICES;
}
