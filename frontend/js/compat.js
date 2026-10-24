/* Aviso para navegadores antigos que não conseguem rodar o site.
   Arquivo em JavaScript "clássico" de propósito (sem módulos, sem sintaxe nova),
   para funcionar justamente onde o resto do site não funciona. */
(function () {
  var avisado = false;

  function mostrarAviso() {
    if (avisado) return;
    avisado = true;
    var alvo = document.getElementById("resumo") || document.getElementById("catalogo");
    if (!alvo) return;
    alvo.innerHTML =
      '<div class="alert" role="alert">' +
      "Este navegador está desatualizado e não consegue abrir o agendamento. " +
      "Atualize o celular (ou use outro navegador) ou agende pelo WhatsApp: " +
      '<a href="https://api.whatsapp.com/send?phone=5599988216488" style="text-decoration:underline">(99) 98821-6488</a>.' +
      "</div>";
  }

  // Erro de sintaxe ao carregar os scripts do site (ex.: iOS muito antigo).
  window.addEventListener("error", function (evento) {
    if (evento && evento.filename && evento.filename.indexOf("/js/") !== -1) mostrarAviso();
  });

  // Navegador sem suporte a módulos: o script principal nem é carregado.
  var teste = document.createElement("script");
  if (!("noModule" in teste)) {
    document.addEventListener("DOMContentLoaded", mostrarAviso);
  }
})();
