const test = require("node:test");
const assert = require("node:assert/strict");
const { computeOrder, escapeHtml, formatBRL, EMAIL_RE } = require("../lib/pedido.js");

test("computeOrder soma os preços certos e calcula sinal de 50%", () => {
  const order = computeOrder(["revitalizacao-facial", "massagem-relaxante"]);
  assert.ok(order);
  assert.equal(order.subtotal, 19000);
  assert.equal(order.sinal, 9500);
  assert.equal(order.restante, 9500);
});

test("computeOrder arredonda o sinal quando o subtotal é ímpar", () => {
  // limpeza-pele (15000) + ventosa-terapia (8000) = 23000, metade é 11500 (exato)
  // revitalizacao-labial sozinho = 5000, metade exata = 2500
  const order = computeOrder(["revitalizacao-labial"]);
  assert.equal(order.subtotal, 5000);
  assert.equal(order.sinal, 2500);
  assert.equal(order.restante, 2500);
});

test("computeOrder ignora duplicatas de id", () => {
  const order = computeOrder(["detox-termal", "detox-termal"]);
  assert.equal(order.subtotal, 12000);
});

test("computeOrder retorna null pra serviço desconhecido", () => {
  assert.equal(computeOrder(["nao-existe"]), null);
});

test("computeOrder retorna null pra lista vazia", () => {
  assert.equal(computeOrder([]), null);
});

test("computeOrder retorna null se qualquer serviço da lista for inválido", () => {
  assert.equal(computeOrder(["detox-termal", "nao-existe"]), null);
});

test("escapeHtml escapa caracteres perigosos", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
  );
});

test("formatBRL formata centavos em reais", () => {
  assert.equal(formatBRL(9500), "R$ 95,00");
  assert.equal(formatBRL(100), "R$ 1,00");
  assert.equal(formatBRL(5), "R$ 0,05");
});

test("EMAIL_RE aceita e-mails válidos e rejeita inválidos", () => {
  assert.ok(EMAIL_RE.test("ana@exemplo.com"));
  assert.ok(!EMAIL_RE.test("invalido"));
  assert.ok(!EMAIL_RE.test("sem-arroba.com"));
});
