# KG Espaço Saúde — status e próximos passos

## Onde estamos

- **`master`** (tag `v1.0.0`) — versão no ar hoje: link na bio, carrinho → WhatsApp.
- **`dev`** — **sistema completo, pronto para publicar**: agendamento online,
  checkout Pix com Mercado Pago e painel da Katiuschia. Testado localmente com o
  Pix simulado.

**O código está pronto. O que falta depende de contas e respostas dela:**

1. [Respostas da Katiuschia](#1-respostas-da-katiuschia) — ✅ quase tudo respondido em 12/10;
   faltam o e-mail do painel e a política de cancelamento
2. [Credenciais do Mercado Pago](#2-mercado-pago) da conta dela
3. [Deploy](#3-deploy) (Neon + Render) e um Pix real de teste
4. Merge na `master` + tag `v2.0.0` + trocar o link da bio

---

## Como funciona

### Cliente (`/` → `/agendar.html`)

1. Escolhe os serviços (catálogo vem da API).
2. Escolhe o dia e um horário livre — a grade desconta agendamentos, folgas e a
   antecedência mínima, e considera a duração somada dos serviços.
3. Informa nome, WhatsApp, e-mail (exigido pelo Mercado Pago para o Pix) e
   endereço, se for massagem a domicílio.
4. **Checkout**: QR code + Pix copia e cola do sinal (50%), com contagem
   regressiva. O horário fica segurado por 30 min.
5. Quando o Pix cai, a tela vira **"Agendamento confirmado!"** sozinha.
   Se o prazo acabar, o horário é liberado e ela pode escolher outro.

O link do checkout (`agendar.html?agendamento=…`) pode ser recarregado sem perder o QR.

### Katiuschia (`/admin.html`)

- Agenda por dia, "Todos os próximos" e "Só pendentes".
- Cada cartão mostra a situação do Pix (aguardando até hh:mm / pago em …).
- **Confirmar sinal** (manual, se ela receber por fora) → **Concluir**, ou **Cancelar**.
- **Aviso de devolução**: se o Pix caiu depois que o horário já foi ocupado, ou
  se ela cancelou um agendamento pago, o cartão pede para devolver o sinal.
- Folgas e bloqueios (dia inteiro ou faixa de horário).

### Regras do pagamento

| Situação | O que acontece |
|---|---|
| Pix pago dentro do prazo | Agendamento → **CONFIRMADO** |
| Prazo de 30 min venceu sem pagamento | → **EXPIRADO**, horário liberado |
| Pix pago depois do prazo, horário ainda livre | → **CONFIRMADO** normalmente |
| Pix pago depois do prazo, horário já ocupado | Fica **EXPIRADO** + aviso de devolução no painel |
| Aviso do Mercado Pago repetido | Ignorado (idempotente) |
| Valor pago menor que o sinal | Não confirma; fica registrado no log |

A confirmação chega por dois caminhos: o **webhook** do Mercado Pago e a própria
tela de checkout, que consulta o status a cada 4 s (e a API pergunta ao Mercado
Pago). Um cobre o outro.

### Modos de cobrança (`PAGAMENTO_PROVEDOR`)

| Valor | Uso |
|---|---|
| `fake` | Desenvolvimento. Pix simulado + botão "Simular pagamento". Bloqueado em produção. |
| `mercado_pago` | Produção. Pix real com confirmação automática. |
| `manual` | Plano B: chave Pix fixa + comprovante no WhatsApp, ela confirma no painel. |

---

## 1. Respostas da Katiuschia

Respostas recebidas em 12/10/2026 e já aplicadas:

| Pergunta | Resposta (no sistema) | Onde mudar |
|---|---|---|
| Horário de atendimento | seg–sex 8h–11h e 14h–19h · sáb 8h–11h e 13h–18h · dom fechado | `backend/app/seed.py` → `EXPEDIENTE` |
| Limpeza de pele | 1h40 (100 min) | `backend/app/seed.py` → `SERVICOS` |
| Massagem terapêutica | 50 min | `backend/app/seed.py` → `SERVICOS` |
| WhatsApp | (99) 98821-6488 → `5599988216488` | `frontend/js/config.js` e `frontend/index.html` |
| Antecedência | "marcar um dia antes": nada no mesmo dia, a partir de amanhã | env `ANTECEDENCIA_MINIMA_DIAS` (1) |
| Sinal | 50% antecipado para garantir o horário (texto no resumo e na página inicial) | env `SINAL_PERCENTUAL` |

Ainda em aberto:

| Pergunta | Hoje | Onde mudar |
|---|---|---|
| E-mail de acesso ao painel | — | env `ADMIN_EMAIL` no deploy |
| Política de cancelamento / devolução do sinal | não definida | texto na tela de confirmação, se ela quiser |
| Até quantos dias à frente | 30 | env `DIAS_MAXIMOS_AGENDAMENTO` |
| Prazo para pagar o Pix | 30 min | env `PAGAMENTO_EXPIRA_MINUTOS` |

> O seed só insere quando a tabela está vazia. Ajuste o `seed.py` **antes** do
> primeiro deploy; depois disso, mudanças vão direto no banco.

## 2. Mercado Pago

Na conta **dela** (a que vai receber):

1. Entrar em <https://www.mercadopago.com.br/developers/panel/app> → **Criar aplicação**
   (tipo "Pagamentos online", integração via "Checkout Transparente / API").
2. **Credenciais de produção** → copiar o **Access Token** (`APP_USR-…`) →
   variável `MERCADO_PAGO_ACCESS_TOKEN`.
3. A conta precisa ter uma **chave Pix cadastrada** no Mercado Pago, senão a API
   não gera o QR code.
4. Depois do deploy: **Webhooks → Configurar notificações** → URL
   `https://<dominio>/api/pagamentos/webhook`, evento **Pagamentos** → salvar e copiar a
   **assinatura secreta** → variável `MERCADO_PAGO_WEBHOOK_SECRET`.

> O ambiente de testes do Mercado Pago não permite pagar um Pix de verdade. O
> teste final é um agendamento real com sinal pequeno (ex.: criar um serviço de
> R$ 2 temporário) e conferir a confirmação automática.

## 3. Deploy

Uma única aplicação: a API serve `/api/*` e o site (`frontend/`). Arquivos prontos:
`Dockerfile` (raiz) e `render.yaml`.

1. **Banco** — criar um Postgres gratuito no [Neon](https://neon.tech) e copiar a
   connection string (pode colar como `postgresql://…`; a API ajusta o driver).
2. **Render** — New → **Blueprint** → este repositório (branch `master` depois do
   merge). Preencher as variáveis pedidas:
   `DATABASE_URL`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (forte, entregar a ela em mãos),
   `MERCADO_PAGO_ACCESS_TOKEN`, `URL_PUBLICA` (`https://…onrender.com`),
   `CORS_ORIGINS` (`["https://…onrender.com"]`). `JWT_SECRET` é gerado sozinho.
3. Configurar o webhook (passo 2.4) e adicionar `MERCADO_PAGO_WEBHOOK_SECRET`.
4. Teste ponta a ponta com Pix real; no painel, conferir "Pix pago em…".
5. Instagram: trocar o link da bio.
6. Git: `backup/master-AAAA-MM-DD` → merge `dev` → `master` → tag **`v2.0.0`**.

> Plano gratuito do Render "dorme" após 15 min sem acesso (a primeira visita
> demora ~30 s). Se incomodar, o plano Starter resolve.
> A API sobe com erro de propósito se estiver em produção com `PAGAMENTO_PROVEDOR=fake`
> ou sem o token do Mercado Pago.

---

## Ideias para depois

- Tela no painel para editar preços, durações e expediente.
- Lembrete automático no WhatsApp na véspera.
- Estorno do sinal pelo painel (API de reembolso do Mercado Pago).
- Testes automatizados — prioridade: `gerar_horarios_livres`, `calcular_sinal`,
  `PagamentoService._aplicar` e a assinatura do webhook.
- Alembic quando o banco de produção tiver dados (hoje: `create_all` na subida —
  **coluna nova em tabela existente não é criada sozinha**).

---

## Estrutura

```
backend/app/
├── main.py            # create_app: valida config, routers em /api, site em /
├── config.py          # Settings (.env) + ProvedorPagamento
├── database.py · dependencies.py · exceptions.py · clock.py · rate_limit.py · seed.py
├── models/            # Servico, HorarioFuncionamento, Bloqueio, Agendamento(+Item), Pagamento, Usuario
├── schemas/           # Pydantic (snake_case ↔ camelCase)
├── repositories/      # acesso a dados
├── services/          # catálogo, agenda, agendamento, pagamento, auth
├── gateways/          # PaymentGateway (interface), MercadoPagoGateway, FakeGateway
└── routers/           # health, servicos, agenda, agendamentos, pagamentos, auth, admin

frontend/
├── index.html · agendar.html · admin.html
├── css/   base.css + um por página
└── js/    api, carrinho, config, dom, formatadores + um por página (ES modules)
```

### API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/servicos` | público |
| GET | `/api/agenda/horarios?data=2026-10-05&servicos=a,b` | público |
| POST | `/api/agendamentos` — devolve o Pix | público (10 por IP a cada 10 min) |
| GET | `/api/agendamentos/{id}` — status para o checkout | público (id é UUID) |
| GET | `/api/pagamentos/config` | público |
| POST | `/api/pagamentos/webhook` | assinatura do Mercado Pago |
| POST | `/api/dev/pagamentos/{id}/aprovar` | só com `PAGAMENTO_PROVEDOR=fake` |
| POST | `/api/auth/login` | público |
| GET | `/api/admin/agendamentos?data=` | admin |
| PATCH | `/api/admin/agendamentos/{id}` — `{ "status": "CONFIRMADO" }` | admin |
| GET · POST · DELETE | `/api/admin/bloqueios` | admin |

Documentação interativa: http://127.0.0.1:8000/docs

---

## Como rodar localmente

```bash
cd backend
python -m venv .venv                          # só na primeira vez
.venv\Scripts\activate                        # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements-dev.txt           # só na primeira vez
copy .env.example .env                        # só na primeira vez — ajustar senha e JWT_SECRET
uvicorn app.main:app --reload
```

- Site: http://127.0.0.1:8000 (Pix simulado — use "Simular pagamento" no checkout)
- Painel: http://127.0.0.1:8000/admin.html (e-mail/senha do `.env`)
- Zerar os dados: parar o servidor e apagar `backend/kg.db` (necessário também
  depois de mudanças nos models).
