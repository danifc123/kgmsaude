# KG Espaço Saúde — status e próximos passos

## Onde estamos

- **`master`** (tag `v1.0.0`) — versão no ar hoje: página de link na bio,
  carrinho → WhatsApp com a chave Pix para o sinal.
- **`dev`** — **sistema de agendamento (fase 1) pronto e funcionando localmente.**
  Falta só publicar (ver [Deploy](#deploy)).

### O que a fase 1 entrega

**Cliente** (`/` → `/agendar.html`)

1. Escolhe os serviços na página inicial (catálogo vem da API).
2. Escolhe o dia (próximos 30) e um horário livre — a grade já desconta
   agendamentos, folgas e a antecedência mínima, e considera a duração somada
   dos serviços.
3. Informa nome, WhatsApp (e endereço, se for massagem a domicílio).
4. Recebe o código do agendamento (ex: `KG-7F3A`), o valor do sinal de 50% com a
   chave Pix para copiar e um botão para mandar o comprovante no WhatsApp com
   a mensagem pronta.

O horário fica **reservado como "Aguardando sinal"** — ninguém mais consegue
marcar por cima.

**Katiuschia** (`/admin.html`, login com e-mail e senha)

- Agenda por dia, "Todos os próximos" e filtro "Só pendentes".
- Botões: **Confirmar sinal** → **Concluir**, ou **Cancelar** (libera o horário).
- Link direto para o WhatsApp de cada cliente.
- **Folgas e bloqueios**: dia inteiro ou faixa de horário, com motivo.

> A conferência do Pix continua manual: ela vê o comprovante no WhatsApp e
> toca em "Confirmar sinal". O checkout automático fica para a fase 2.

---

## Decisões pendentes com a Katiuschia

Valores provisórios já estão no sistema — só ajustar quando ela responder.

| Pergunta | Hoje no sistema | Onde mudar |
|---|---|---|
| Duração da limpeza de pele e da massagem terapêutica | 60 min | `backend/app/seed.py` |
| Dias e horários de atendimento | seg–sex 9h–18h, sáb 9h–13h | `backend/app/seed.py` (`EXPEDIENTE`) |
| Antecedência mínima para agendar | 2h | `.env` → `ANTECEDENCIA_MINIMA_MINUTOS` |
| Até quantos dias à frente | 30 | `.env` → `DIAS_MAXIMOS_AGENDAMENTO` |
| Número do WhatsApp | `5522999879500` (o texto da página mostra `+55 99 98821-6488` — **conferir qual é o certo**) | `frontend/js/config.js` |
| Chave Pix | `63226867393` | `frontend/js/config.js` |
| Texto da mensagem do comprovante | genérico | `frontend/js/agendar.js` → `montarMensagemComprovante` |
| Política de cancelamento / devolução do sinal | não definida | — |

O seed só insere dados quando a tabela está vazia. Depois do deploy, mudanças
de expediente/serviço são feitas direto no banco (ou numa tela futura do painel).

---

## Deploy

Uma única aplicação: a API FastAPI serve `/api/*` e também os arquivos do
`frontend/`. Por isso não há CORS nem duas hospedagens.

1. **Banco**: criar um Postgres gratuito no [Neon](https://neon.tech) e copiar a
   connection string (`postgresql+psycopg://…`).
2. **API + site**: criar um Web Service no [Render](https://render.com) a partir
   do repositório.
   - Root directory: raiz do repo · Runtime: Python
   - Build: `pip install -r backend/requirements.txt`
   - Start: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Variáveis: `ENVIRONMENT=production`, `DATABASE_URL`, `JWT_SECRET` (gerar um
     novo), `ADMIN_EMAIL`, `ADMIN_PASSWORD` (senha forte, passar pra ela em mãos),
     `CORS_ORIGINS=["https://<dominio>"]`
3. Abrir o site, fazer um agendamento de teste, confirmar e cancelar no painel.
4. Trocar o link da bio do Instagram para o novo endereço.
5. Backup da `master` → merge `dev` → `master` → tag **`v2.0.0`**.

> O `backend/Dockerfile` copia só `app/`; se preferir deploy por Docker,
> ajustar para copiar também o `frontend/`.

---

## Fase 2 — checkout Pix automático (quando ela quiser)

Trocar a conferência manual por uma cobrança Pix dinâmica (Mercado Pago):
cada agendamento gera um QR code próprio e o webhook confirma sozinho.

- [ ] Conta Mercado Pago dela + credenciais de teste
- [ ] `app/gateways/` com `PaymentGateway` (interface) e `MercadoPagoGateway`
- [ ] Tabela `pagamentos` (id do provedor único, valor, status, copia e cola, QR)
- [ ] `POST /api/agendamentos` passa a devolver o QR code; reserva expira em 30 min sem pagamento
- [ ] `POST /api/pagamentos/webhook`: valida `x-signature`, consulta o pagamento na API, confirma (idempotente)
- [ ] Tela de checkout com QR + copia e cola + polling do status
- [ ] Rate limit no `POST /api/agendamentos`

## Ideias para depois

- Tela no painel para editar preços, durações e expediente.
- Lembrete automático no WhatsApp na véspera.
- Testes automatizados (unit + integração + E2E) — a estrutura `backend/tests/`
  já existe; prioridade para `gerar_horarios_livres` e `calcular_sinal`.
- Migrations com Alembic quando o banco de produção tiver dados que não podem
  ser recriados (hoje as tabelas são criadas com `create_all` na subida).

---

## Estrutura

```
backend/app/
├── main.py            # create_app: CORS, handlers, routers em /api, frontend em /
├── config.py          # Settings (.env)
├── database.py        # engine, SessionLocal, Base
├── dependencies.py    # get_db, services, get_current_admin (JWT)
├── exceptions.py      # AppError → 401/404/409/422
├── clock.py           # agora no fuso do espaço
├── seed.py            # serviços, expediente e admin iniciais
├── models/            # Servico, HorarioFuncionamento, Bloqueio, Agendamento(+Item), Usuario
├── schemas/           # Pydantic (snake_case ↔ camelCase)
├── repositories/      # acesso a dados
├── services/          # catálogo, agenda, agendamento, auth
└── routers/           # health, servicos, agenda, agendamentos, auth, admin

frontend/
├── index.html · agendar.html · admin.html
├── css/   base.css + um por página
├── js/    api, carrinho, config, dom, formatadores + um por página (ES modules)
└── assets/
```

### API

| Método | Rota | Acesso |
|---|---|---|
| GET | `/api/servicos` | público |
| GET | `/api/agenda/horarios?data=2026-10-05&servicos=a,b` | público |
| POST | `/api/agendamentos` | público |
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

- Site: http://127.0.0.1:8000
- Painel: http://127.0.0.1:8000/admin.html (e-mail/senha do `.env`)
- Para zerar os dados de teste: parar o servidor e apagar `backend/kg.db`.
