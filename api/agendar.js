const { Resend } = require("resend");
const { escapeHtml, formatBRL, computeOrder, EMAIL_RE, PERIODOS } = require("../lib/pedido.js");

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "Método não permitido." });
  }

  const body = req.body || {};
  const { servicos, nome, telefone, email, periodo, data } = body;

  if (!Array.isArray(servicos) || servicos.length === 0) {
    return res.status(400).json({ ok: false, error: "Selecione pelo menos um serviço." });
  }
  if (typeof nome !== "string" || nome.trim().length < 2) {
    return res.status(400).json({ ok: false, error: "Informe seu nome." });
  }
  if (typeof telefone !== "string" || telefone.replace(/\D/g, "").length < 10) {
    return res.status(400).json({ ok: false, error: "Informe um telefone válido com DDD." });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ ok: false, error: "Informe um e-mail válido." });
  }
  if (typeof periodo !== "string" || !PERIODOS[periodo]) {
    return res.status(400).json({ ok: false, error: "Selecione um período de preferência." });
  }

  const order = computeOrder(servicos);
  if (!order) {
    return res.status(400).json({ ok: false, error: "Um ou mais serviços selecionados são inválidos." });
  }
  const { escolhidos, subtotal, sinal, restante } = order;

  const orderEmail = process.env.ORDER_EMAIL;
  if (!orderEmail || !process.env.RESEND_API_KEY) {
    console.error("ORDER_EMAIL ou RESEND_API_KEY não configurados nas variáveis de ambiente.");
    return res.status(500).json({ ok: false, error: "Agendamento online indisponível no momento — chama a gente pelo WhatsApp." });
  }
  const resend = new Resend(process.env.RESEND_API_KEY);

  const nomeSeguro = escapeHtml(nome.trim());
  const telefoneSeguro = escapeHtml(telefone.trim());
  const emailSeguro = escapeHtml(email.trim());
  const dataSegura = data ? escapeHtml(String(data)) : null;
  const periodoLabel = PERIODOS[periodo];
  const listaServicosHtml = escolhidos
    .map((s) => `<li>${escapeHtml(s.nome)} — ${formatBRL(s.precoCentavos)}</li>`)
    .join("");

  try {
    await resend.emails.send({
      from: "KG Espaço Saúde <onboarding@resend.dev>",
      to: orderEmail,
      subject: `Novo agendamento — ${nomeSeguro}`,
      html: `
        <h2>Novo pedido de agendamento</h2>
        <ul>${listaServicosHtml}</ul>
        <p>
          <strong>Subtotal:</strong> ${formatBRL(subtotal)}<br>
          <strong>Sinal (50%):</strong> ${formatBRL(sinal)}<br>
          <strong>Restante no dia:</strong> ${formatBRL(restante)}
        </p>
        <h3>Cliente</h3>
        <p>
          Nome: ${nomeSeguro}<br>
          Telefone: ${telefoneSeguro}<br>
          E-mail: ${emailSeguro}<br>
          Preferência: ${periodoLabel}${dataSegura ? " — " + dataSegura : ""}
        </p>
      `,
    });

    await resend.emails.send({
      from: "KG Espaço Saúde <onboarding@resend.dev>",
      to: email.trim(),
      subject: "Recebemos seu pedido de agendamento — KG Espaço Saúde",
      html: `
        <h2>Olá, ${nomeSeguro}!</h2>
        <p>Recebemos sua seleção de serviços:</p>
        <ul>${listaServicosHtml}</ul>
        <p>
          <strong>Total:</strong> ${formatBRL(subtotal)}<br>
          <strong>Sinal para confirmar (50%):</strong> ${formatBRL(sinal)}<br>
          <strong>Restante no dia:</strong> ${formatBRL(restante)}
        </p>
        <p>A Katiuschia vai entrar em contato pelo WhatsApp em breve para combinar
        o pagamento do sinal e confirmar o horário.</p>
      `,
    });
  } catch (err) {
    console.error("Erro ao enviar e-mail via Resend:", err);
    return res.status(500).json({ ok: false, error: "Não conseguimos enviar a confirmação agora. Tente de novo ou chama no WhatsApp." });
  }

  return res.status(200).json({ ok: true, subtotal, sinal, restante });
};
