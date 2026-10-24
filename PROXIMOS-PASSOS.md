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

### Katiuschia — painel (`/admin.html`)

Feito para o computador (menu lateral) e continua funcionando no celular (menu no topo).

| Tela | O que tem |
|---|---|
| **Visão geral** | Saudação, indicadores (hoje, próximos 7 dias, aguardando sinal, recebido no mês), agenda de hoje e "Precisa da sua atenção" (sinais a confirmar, Pix aguardando, devoluções) |
| **Agenda** | Calendário da semana (seg–sáb) com os horários coloridos por status, folgas hachuradas, fora do expediente listrado e linha do "agora". No celular vira agenda do dia |
| **Agendamentos** | Tabela com período (próximos, este mês, mês passado, datas), filtro de status, busca por nome/telefone/código e **Baixar planilha** (CSV para Excel) |
| **Financeiro** | Por mês: recebido pelo site (Pix), faturamento, a receber no dia, sinais confirmados à mão, gráfico de Pix por dia e lista de pagamentos. Avisa devoluções pendentes |
| **Folgas** | Bloquear dia(s) inteiros ou faixa de horário, lista das próximas folgas e o horário de atendimento |
| **Serviços e horários** | Editar nome, categoria, duração e preço de cada serviço, tirar do site / voltar ao site, criar serviço novo e mudar o horário de atendimento da semana (várias faixas por dia). Tudo reflete no site na hora |

Clicar em qualquer agendamento abre a **gaveta de detalhes**: serviços, valores
(total, sinal, restante), situação do Pix, contato, observação e os botões
**Confirmar sinal recebido** / **Marcar como concluído** / **Cancelar**.

> O "recebido pelo site" vem do nosso banco (cada Pix aprovado fica registrado),
> não da API do Mercado Pago. São valores brutos: a taxa do Mercado Pago aparece
> só no extrato dela.

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

> O `seed.py` só grava os dados iniciais na primeira subida (banco vazio). Depois
> disso, a própria Katiuschia muda serviços, preços e horários pela tela
> **Serviços e horários** do painel — tudo fica no banco.
>
> ✅ Testado em PostgreSQL 16 (o mesmo do Neon) em 23/10: criação das tabelas,
> agendamento, checkout Pix, expiração, pagamento atrasado, painel completo e
> edição de serviços/horários.

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

## 3. Contas e deploy

Uma única aplicação: a API serve `/api/*` e o site (`frontend/`). Arquivos prontos:
`Dockerfile` (raiz) e `render.yaml` (começa em `PAGAMENTO_PROVEDOR=manual`).

| # | Onde | Link | Para quê |
|---|---|---|---|
| 1 | Gmail | <https://accounts.google.com/signup> | E-mail da loja — usar em todas as contas abaixo e no login do painel |
| 2 | Neon | <https://console.neon.tech/signup> | Banco de dados (Postgres gratuito) |
| 3 | Render | <https://dashboard.render.com/register> | Hospedagem do site + API (gratuito) |
| 4 | Registro.br *(opcional)* | <https://registro.br> | Domínio próprio `.com.br` (~R$ 40/ano). Sem ele o site fica em `….onrender.com` |
| 5 | Mercado Pago *(depois)* | <https://www.mercadopago.com.br/developers/panel/app> | Pix automático (seção 2) |

1. **E-mail da loja** — criar o Gmail (ex.: `kgespacosaude@gmail.com`). Ele vira o
   `ADMIN_EMAIL` do painel.
2. **Neon** — entrar com o Gmail da loja → criar projeto `kg-espaco-saude` (região
   mais próxima do Brasil) → copiar a **connection string**.
3. **Git** — `backup/master-AAAA-MM-DD` → merge `dev` → `master`.
4. **Render** — entrar com o Gmail da loja → conectar o GitHub (autorizar o
   repositório `kgmsaude`) → **New → Blueprint** → escolher o repositório. Preencher:
   `DATABASE_URL` (do Neon), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (forte, entregar a ela
   em mãos), `URL_PUBLICA` e `CORS_ORIGINS` com o endereço que o Render mostrar
   (`https://kg-espaco-saude.onrender.com` e `["https://kg-espaco-saude.onrender.com"]`).
   Deixar os campos do Mercado Pago vazios por enquanto.
5. **Testar no celular dela** — agendar pelo site, entrar no painel, confirmar o sinal.
6. **Instagram** — trocar o link da bio. Tag **`v2.0.0`**.
7. **Quando o Mercado Pago estiver pronto** — no Render, trocar
   `PAGAMENTO_PROVEDOR` para `mercado_pago`, colar o token, configurar o webhook
   (seção 2) e fazer um Pix real de valor baixo.

> Plano gratuito do Render "dorme" após 15 min sem acesso (a primeira visita
> demora ~30 s). Se incomodar, o plano Starter resolve.
> A API sobe com erro de propósito se estiver em produção com `PAGAMENTO_PROVEDOR=fake`
> ou sem o token do Mercado Pago.

---

## Ideias para depois

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
└── js/    api, carrinho, config, dom, formatadores, home, agendar (ES modules)
    └── painel/
        ├── painel.js      # login, menu, rotas (#/inicio, #/agenda, ...)
        ├── sessao.js      # JWT e requisições autenticadas
        ├── comum.js       # status, ações, ícones, datas
        ├── detalhe.js     # gaveta de detalhes do agendamento
        └── telas/         # visao-geral, agenda, agendamentos, financeiro, folgas
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
| GET | `/api/admin/agendamentos?data=` ou `?inicio=&fim=` | admin |
| PATCH | `/api/admin/agendamentos/{id}` — `{ "status": "CONFIRMADO" }` | admin |
| GET · POST · DELETE | `/api/admin/bloqueios` (`?inicio=&fim=` opcional) | admin |
| GET · PUT | `/api/admin/expediente` | admin |
| GET · POST | `/api/admin/servicos` · PATCH `/api/admin/servicos/{id}` | admin |
| GET | `/api/admin/financeiro?mes=2026-10-01` | admin |

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
