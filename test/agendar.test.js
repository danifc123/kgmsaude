const test = require("node:test");
const assert = require("node:assert/strict");
const handler = require("../api/agendar.js");

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    setHeader() {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
}

const payloadValido = {
  servicos: ["revitalizacao-facial"],
  nome: "Ana",
  telefone: "11999998888",
  email: "ana@exemplo.com",
  periodo: "tarde",
};

test("recusa método diferente de POST", async () => {
  const res = mockRes();
  await handler({ method: "GET", body: {} }, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.ok, false);
});

test("exige pelo menos um serviço", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, servicos: [] } }, res);
  assert.equal(res.statusCode, 400);
});

test("exige nome com pelo menos 2 caracteres", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, nome: "A" } }, res);
  assert.equal(res.statusCode, 400);
});

test("rejeita telefone curto demais", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, telefone: "123" } }, res);
  assert.equal(res.statusCode, 400);
});

test("rejeita e-mail inválido", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, email: "invalido" } }, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /e-mail/i);
});

test("rejeita período fora da lista permitida", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, periodo: "madrugada" } }, res);
  assert.equal(res.statusCode, 400);
});

test("rejeita serviço que não existe no catálogo", async () => {
  const res = mockRes();
  await handler({ method: "POST", body: { ...payloadValido, servicos: ["nao-existe"] } }, res);
  assert.equal(res.statusCode, 400);
});

test("sem RESEND_API_KEY/ORDER_EMAIL retorna erro amigável em vez de derrubar o processo", async () => {
  const antigaKey = process.env.RESEND_API_KEY;
  const antigoEmail = process.env.ORDER_EMAIL;
  delete process.env.RESEND_API_KEY;
  delete process.env.ORDER_EMAIL;

  const res = mockRes();
  await handler({ method: "POST", body: payloadValido }, res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.ok, false);

  if (antigaKey) process.env.RESEND_API_KEY = antigaKey;
  if (antigoEmail) process.env.ORDER_EMAIL = antigoEmail;
});
