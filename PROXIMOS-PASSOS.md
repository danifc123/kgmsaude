# KG Espaço Saúde — próximos passos

## Onde estamos

- **`master`** — versão no ar hoje: página de link na bio (catálogo + carrinho →
  WhatsApp). HTML/CSS/JS puro, sem build. Já tem logo, foto da seção "Quem sou
  eu" e galeria (`assets/`).
- **`dev`** — nova branch para transformar a página num **sistema de
  agendamento com sinal de 50% via Pix**. Ambiente do backend já preparado
  (ver [Fase 0](#fase-0--ambiente-concluída)).

> ⚠️ **Confirmar com a Katiuschia antes de começar.** Em 23/09 uma versão com
> carrinho + sinal de 50% foi implementada e **removida a pedido dela** — ela
> preferia combinar valor e pagamento no WhatsApp (commit `2165102`). Vale
> alinhar se ela mudou de ideia e fechar as [decisões pendentes](#decisões-pendentes-com-a-katiuschia)
> antes de escrever código.

## Dados do negócio

- Marca: KG Espaço Saúde e Bem Estar (KG Clínica de Estética)
- Proprietária: Katiuschia Garcia — enfermeira e esteticista
- WhatsApp: +55 99 98821-6488 · Instagram: @katiuschia_garcia
- Endereço: Rua Bela Vista, 550 — Bairro São Luís
- Categorias: **Facial** e **Corporal**

| Serviço | Categoria | Duração | Preço |
|---|---|---|---|
| Revitalização labial | Facial | 15 min | R$ 50 |
| Revitalização facial | Facial | 1h | R$ 70 |
| Limpeza de pele | Facial | **a definir** | R$ 150 |
| Ventosa terapia | Corporal | 30 min | R$ 80 |
| Esfoliação corporal | Corporal | 30 min | R$ 100 |
| Detox termal | Corporal | 30 min | R$ 120 |
| Massagem relaxante | Corporal | 45 min | R$ 120 |
| Massagem terapêutica | Corporal | **a definir** | R$ 130 |
| Massagem a domicílio | Corporal | 1h | R$ 180 |

Hoje a fonte da verdade é `services.js`. No sistema novo ela passa a ser a
tabela `servicos` do banco (seed inicial gerado a partir desse arquivo).

---

## Visão do sistema

Continua sendo **uma página de vendas**, não um app. Nada de framework, nada
de componentes: HTML + CSS + JavaScript puro (ES modules) no front, e uma API
pequena em FastAPI por trás. Sem preocupação com escala — um único serviço,
um único banco.

### Fluxo do cliente

```
Catálogo ──► Carrinho ──► Data e horário ──► Dados (nome, WhatsApp)
                                                   │
                                                   ▼
                         Checkout Pix (QR code + copia e cola, 50% do total)
                                                   │  cliente paga no app do banco
                                                   ▼
             Mercado Pago ──webhook──► API confirma pagamento ──► agendamento CONFIRMADO
                                                   │
                                                   ▼
                  Tela de confirmação + botão "Falar no WhatsApp" (mensagem com o código)
```

- O horário fica **reservado por 30 min** enquanto o Pix não é pago. Passado
  isso, o agendamento expira e o horário volta a ficar livre.
- A tela de checkout consulta o status do agendamento a cada poucos segundos e
  troca sozinha para "confirmado" quando o webhook chega.
- Os outros 50% são pagos no atendimento, direto com ela.

### Por que um gateway (e não a chave Pix dela)

Uma chave Pix estática não diz **quem** pagou nem **qual** agendamento foi pago
— ela teria que conferir extrato e cruzar na mão. Com uma **cobrança Pix
dinâmica** via gateway, cada agendamento gera um QR code próprio (com `txid`),
e o gateway avisa a API por webhook quando aquele pagamento específico cai.

**Gateway recomendado: Mercado Pago** (API de Pix madura, sandbox para testes,
webhook assinado, taxa de Pix baixa, conta PF ou PJ). Alternativas se ela já
tiver conta: Asaas ou Efí (Gerencianet). A integração fica atrás de uma
interface (`PaymentGateway`), então trocar de provedor não mexe nas regras de
negócio.

---

## Stack

| Camada | Escolha | Motivo |
|---|---|---|
| Frontend | HTML + CSS + JS (ES modules) | É uma página de vendas; framework seria peso morto |
| API | Python 3.13 + FastAPI | Estrutura padrão das skills; tipagem e validação com Pydantic |
| ORM / migrations | SQLAlchemy 2 + Alembic | Models tipados; migrations versionadas |
| Banco | SQLite em dev · PostgreSQL em produção | Zero setup local; Postgres gerenciado gratuito em produção |
| Pagamento | Mercado Pago (Pix) | Ver seção acima |
| Testes | pytest (unit + integração) · Playwright Python (E2E) | Tudo em Python, sem precisar de Node |
| Lint / format | Ruff (Python) · ESLint (JS do front) | ESLint exige Node — instalar Node LTS na Fase 5 |
| Deploy | Front na Vercel · API no Render (Docker) · Postgres no Neon | Planos gratuitos dão conta do volume |

---

## Arquitetura do backend

Camadas: **router → service → repository → model**. Router só fala HTTP;
service tem as regras de negócio; repository isola o acesso a dados; a
integração com o Mercado Pago fica numa camada `gateways/`. Módulos nomeados
pela área de negócio.

```
backend/
├── app/
│   ├── main.py                 # create_app(): middlewares + routers
│   ├── config.py               # Settings (pydantic-settings, lê .env)
│   ├── database.py             # engine, SessionLocal, Base
│   ├── dependencies.py         # get_db, get_current_admin, get_payment_gateway
│   ├── models/
│   │   ├── agendamento.py      # Agendamento, AgendamentoItem
│   │   ├── agenda.py           # HorarioFuncionamento, Bloqueio
│   │   ├── cliente.py
│   │   ├── pagamento.py
│   │   ├── servico.py
│   │   └── usuario.py          # admin (login da Katiuschia)
│   ├── schemas/                # Pydantic: *Create, *Read, por módulo
│   ├── repositories/           # um por model, só queries
│   ├── services/
│   │   ├── agenda_service.py        # cálculo de horários livres
│   │   ├── agendamento_service.py   # criar, expirar, confirmar, cancelar
│   │   ├── auth_service.py          # hash de senha, JWT
│   │   ├── catalogo_service.py
│   │   └── pagamento_service.py     # criar cobrança, processar webhook
│   ├── gateways/
│   │   ├── payment_gateway.py       # Protocol: create_pix_charge, get_payment
│   │   ├── mercado_pago.py
│   │   └── fake_gateway.py          # usado nos testes e no dev offline
│   └── routers/
│       ├── admin.py
│       ├── agenda.py
│       ├── agendamentos.py
│       ├── auth.py
│       ├── catalogo.py
│       ├── health.py           ✅ já existe
│       └── pagamentos.py       # webhook
├── alembic/                    # migrations
├── tests/
│   ├── unit/                   # regras de negócio com repositories mockados
│   ├── integration/            # API + banco real (SQLite temporário / Postgres)
│   └── e2e/                    # Playwright: fluxo completo no navegador
├── .env.example
├── Dockerfile
├── pyproject.toml              # config do pytest e do ruff
├── requirements.txt
└── requirements-dev.txt
```

### Frontend (reorganizado, ainda sem framework)

```
frontend/
├── index.html                  # catálogo + "Quem sou eu" + galeria (o que já existe)
├── agendar.html                # data/horário → dados → checkout → confirmação
├── css/
│   ├── base.css                # tokens (preto/dourado), reset, tipografia
│   └── agendar.css
├── js/
│   ├── api.js                  # fetch da API, um lugar só
│   ├── carrinho.js             # estado do carrinho (sessionStorage)
│   ├── agenda.js               # calendário e grade de horários
│   ├── checkout.js             # QR code, copia e cola, polling de status
│   └── formatadores.js         # moeda, data, telefone
└── assets/
```

O `index.html` atual continua funcionando; a mudança é tirar CSS e JS inline
para arquivos próprios e trocar o botão "Continuar no WhatsApp" por
"Escolher horário".

---

## Modelo de dados

```
servicos            id (slug) · nome · categoria · duracao_minutos · preco_centavos · ativo
clientes            id · nome · telefone · email (opcional) · criado_em
agendamentos        id (uuid) · codigo (ex: KG-7F3A) · cliente_id · inicio · fim · status
                    total_centavos · sinal_centavos · expira_em · criado_em
agendamento_itens   agendamento_id · servico_id · preco_centavos · duracao_minutos   ← cópia do preço na hora da compra
pagamentos          id · agendamento_id · provedor · provedor_pagamento_id (único) · status
                    valor_centavos · pix_copia_cola · pix_qr_base64 · pago_em · criado_em
horarios_funcionamento  dia_semana · abre_as · fecha_as
bloqueios           inicio · fim · motivo                 ← folgas, feriados, compromissos
usuarios            id · email · senha_hash · role (admin)
```

Dinheiro sempre em **centavos (inteiro)**, como já é hoje no `services.js`.

### Status do agendamento

```
AGUARDANDO_PAGAMENTO ──pagou──► CONFIRMADO ──atendeu──► CONCLUIDO
        │                           │
        └──30 min sem pagar──► EXPIRADO      └──admin cancela──► CANCELADO
```

---

## Regras de negócio

1. **Preço é calculado no servidor.** O front manda só os `ids` dos serviços;
   total e sinal saem do banco. Nunca confiar em valor vindo do navegador.
2. **Sinal = 50% do total, arredondado para cima no centavo.** Ex.: R$ 125,01
   → sinal R$ 62,51.
3. **Duração do agendamento = soma das durações** dos serviços escolhidos.
4. **Horários livres** = horário de funcionamento − bloqueios − agendamentos
   `CONFIRMADO` − agendamentos `AGUARDANDO_PAGAMENTO` ainda dentro do prazo.
   Grade de 30 em 30 min; o atendimento inteiro tem que caber antes do
   fechamento.
5. **Antecedência mínima** para agendar (ex.: 2h) — valor configurável.
6. **Conflito de horário:** a checagem de sobreposição e a criação acontecem na
   mesma transação; na confirmação do pagamento a checagem é refeita.
7. **Webhook idempotente:** o mesmo aviso pode chegar mais de uma vez;
   `provedor_pagamento_id` é único e um pagamento já processado é ignorado.
8. **Webhook não é fonte de verdade:** valida a assinatura (`x-signature`) e
   depois **consulta o pagamento na API do Mercado Pago** antes de confirmar.
9. **Pagamento depois de expirar:** se o horário ainda estiver livre, confirma
   normalmente; se não, marca para estorno manual e avisa no painel.
10. **Massagem a domicílio** exige endereço no formulário.

---

## API (REST)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/api/health` | API no ar ✅ | público |
| GET | `/api/servicos` | Catálogo ativo | público |
| GET | `/api/agenda/horarios?data=2026-10-05&servicos=a,b` | Horários livres no dia | público |
| POST | `/api/agendamentos` | Cria agendamento + cobrança Pix → `201` com QR code | público (rate limit) |
| GET | `/api/agendamentos/{id}` | Status (usado no polling do checkout) | público (uuid) |
| POST | `/api/pagamentos/webhook` | Aviso do Mercado Pago | assinatura |
| POST | `/api/auth/login` | Login da Katiuschia → JWT | público |
| GET | `/api/admin/agendamentos?data=` | Agenda do dia | admin |
| PATCH | `/api/admin/agendamentos/{id}` | Concluir / cancelar | admin |
| GET/POST/DELETE | `/api/admin/bloqueios` | Folgas e bloqueios | admin |
| PUT | `/api/admin/horarios-funcionamento` | Horário de funcionamento | admin |
| PATCH | `/api/admin/servicos/{id}` | Preço, duração, ativo | admin |

Exemplo de `POST /api/agendamentos`:

```json
// request
{
  "servicoIds": ["massagem-relaxante", "detox-termal"],
  "inicio": "2026-10-05T14:00:00-03:00",
  "cliente": { "nome": "Maria Souza", "telefone": "99988887777" }
}

// 201
{
  "id": "5b1c…",
  "codigo": "KG-7F3A",
  "status": "AGUARDANDO_PAGAMENTO",
  "inicio": "2026-10-05T14:00:00-03:00",
  "fim": "2026-10-05T15:15:00-03:00",
  "totalCentavos": 24000,
  "sinalCentavos": 12000,
  "expiraEm": "2026-10-04T10:30:00-03:00",
  "pix": { "copiaCola": "00020126…", "qrCodeBase64": "iVBORw0…" }
}
```

---

## Segurança

- Segredos (`MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`,
  `JWT_SECRET`) só no `.env` e nas variáveis do host, nunca no git.
- CORS liberado só para o domínio do front.
- Rate limit (`slowapi`) no `POST /api/agendamentos`, para ninguém travar a
  agenda com reservas falsas.
- Senha do admin com hash (`argon2`/`bcrypt`); JWT com expiração curta; role
  `admin` checada por dependência.
- LGPD: coletar só nome e telefone (e endereço na massagem a domicílio), com
  aviso curto de privacidade no formulário.
- Rodar a skill `security-review` antes do merge da Fase 4 e antes do deploy.

---

## Testes (TDD — teste antes do código, padrão AAA)

| Tipo | O que cobre | Exemplos de nome |
|---|---|---|
| Unitário | `agenda_service`, cálculo do sinal, transições de status, validação do webhook | `test_deveria_arredondar_sinal_para_cima_quando_total_tiver_centavo_impar` · `test_deveria_nao_oferecer_horario_quando_atendimento_ultrapassar_fechamento` |
| Integração | Routers + services + repositories + banco real, com `FakeGateway` | `test_deveria_retornar_409_quando_horario_ja_estiver_reservado` · `test_deveria_confirmar_agendamento_apenas_uma_vez_quando_webhook_chegar_duplicado` |
| E2E | Playwright: escolher serviços → horário → checkout → webhook simulado → tela de confirmação | `test_deveria_mostrar_confirmacao_quando_pix_for_pago` |

Integração roda com SQLite temporário no dia a dia e contra Postgres
(container Docker) antes do deploy, para validar o que muda entre os bancos.

---

## Roteiro por fases

Cada fase fecha com testes verdes, commit(s) em Conventional Commits na `dev`
e, nos marcos, uma tag.

### Fase 0 — Ambiente (concluída)

- [x] Branch `dev` criada a partir da `master`
- [x] Esqueleto `backend/` em camadas (models, schemas, repositories, services, routers)
- [x] `config.py` com pydantic-settings, `database.py` com SQLAlchemy 2, `get_db`
- [x] `requirements.txt` / `requirements-dev.txt`, `pyproject.toml` (pytest + ruff), `Dockerfile`, `.env.example`
- [x] `.venv` criado e dependências instaladas
- [x] Primeiro teste (`GET /api/health`) escrito antes da rota e passando
- [x] `.gitignore` atualizado (`.venv`, `.env`, `*.db`, caches)

### Fase 1 — Catálogo no banco

- [ ] Alembic configurado + migration inicial (`servicos`)
- [ ] Seed a partir do `services.js`
- [ ] `GET /api/servicos` (unit + integração)
- [ ] Front passa a ler o catálogo da API (o `services.js` sai)

### Fase 2 — Agenda

- [ ] Tabelas `horarios_funcionamento` e `bloqueios`
- [ ] `agenda_service.calcular_horarios_livres()`, a parte mais testada do projeto
- [ ] `GET /api/agenda/horarios`

### Fase 3 — Agendamento

- [ ] Tabelas `clientes`, `agendamentos`, `agendamento_itens`
- [ ] `POST /api/agendamentos` com `FakeGateway` (409 em conflito, 422 em dados inválidos)
- [ ] `GET /api/agendamentos/{id}`
- [ ] Expiração: ao consultar horários, `AGUARDANDO_PAGAMENTO` vencido vira `EXPIRADO` (sem precisar de cron)

### Fase 4 — Pagamento Pix (Mercado Pago)

- [ ] Conta Mercado Pago da Katiuschia + credenciais de **teste**
- [ ] `MercadoPagoGateway.create_pix_charge()` / `get_payment()`
- [ ] `POST /api/pagamentos/webhook`: assinatura → consulta → confirma (idempotente)
- [ ] Teste local do webhook com túnel (`cloudflared` ou `ngrok`)
- [ ] `security-review` · **tag `v2.0.0-beta.1`**

### Fase 5 — Frontend do agendamento

- [ ] Instalar Node LTS (para ESLint) e extrair CSS/JS inline para `frontend/`
- [ ] `agendar.html`: calendário, grade de horários, formulário, checkout Pix (QR + copiar), polling, confirmação
- [ ] Botão final "Falar no WhatsApp" com código do agendamento na mensagem
- [ ] Mobile-first e acessível (contraste do dourado, foco visível, `aria-live` no status)
- [ ] Testes E2E com Playwright

### Fase 6 — Painel da Katiuschia (mobile)

- [ ] Login (JWT, role `admin`)
- [ ] Agenda do dia, concluir/cancelar
- [ ] Folgas e horário de funcionamento
- [ ] Editar preço/duração dos serviços (cobre o antigo "TODO: painel pelo celular")

### Fase 7 — Deploy

- [ ] Postgres no Neon + `alembic upgrade head`
- [ ] API no Render (Dockerfile já existe) com variáveis de ambiente
- [ ] Front na Vercel apontando para a API; CORS com o domínio final
- [ ] Webhook de **produção** cadastrado no Mercado Pago
- [ ] Pix real de R$ 1 de ponta a ponta
- [ ] Backup da `master` → merge `dev` → `master` → **tag `v2.0.0`**

> Sugestão: antes de começar a Fase 1, marcar o estado atual da `master` como
> **`v1.0.0`** (link na bio com carrinho → WhatsApp), para ter um ponto de
> retorno claro.

---

## Decisões pendentes com a Katiuschia

- [ ] **Ela quer mesmo o sinal de 50% agora?** (ver aviso no topo)
- [ ] Duração de **Limpeza de pele** e **Massagem terapêutica**
- [ ] Dias e horários de atendimento; intervalo entre clientes
- [ ] Antecedência mínima para agendar e prazo máximo (ex.: até 30 dias à frente)
- [ ] Política de cancelamento: o sinal é devolvido? Até quantas horas antes?
- [ ] Massagem a domicílio: área atendida, taxa de deslocamento?
- [ ] Conta no Mercado Pago (PF ou PJ) em nome dela
- [ ] Texto da mensagem do WhatsApp (pendência antiga, continua valendo na tela de confirmação)

---

## Como rodar

**Página (front atual):**

```bash
python -m http.server 8843        # na raiz do projeto
# http://127.0.0.1:8843/index.html
```

**API:**

```bash
cd backend
python -m venv .venv                          # só na primeira vez
.venv\Scripts\activate                        # Windows (Linux/Mac: source .venv/bin/activate)
pip install -r requirements-dev.txt           # só na primeira vez
copy .env.example .env                        # só na primeira vez
uvicorn app.main:app --reload                 # http://127.0.0.1:8000/docs
pytest                                        # testes
ruff check . && ruff format .                 # lint + format
```
