# KG Espaço Saúde — próxima etapa: carrinho + sinal de 50% + pedido por e-mail

## Contexto

`index.html` já é uma página completa (catálogo de serviços + botão de WhatsApp), no tema preto/dourado da marca. Hoje ela só serve como link-na-bio: o cliente vê os serviços e é direcionado pro WhatsApp manualmente.

**Sem imagens no momento** — a Katiuschia não gostou do logo/foto que estavam sendo usados e vai criar as artes dela mesma num programa de imagem (design definitivo) e mandar depois. Enquanto isso:
- Header usa uma wordmark em texto ("KG" + "Espaço Saúde & Bem-Estar") no lugar da logo.
- Favicon é um SVG inline simples (não depende de arquivo).
- A seção "Quem sou eu" ficou só com texto (título + bio + colunas de formação/pessoal), sem foto.

Quando ela mandar a logo e a foto definitivas: salvar em `assets/`, trocar a wordmark do header pela `<img>` da logo (era assim antes, ver histórico do git) e adicionar de volta o bloco de foto na seção "Quem sou eu".

Repositório git com histórico de commits na branch `dev`. Ainda **não
publicado** num host de verdade — só rodou local via `python -m http.server`.

## Dados do negócio

- Marca: KG Espaço Saúde e Bem Estar (KG Clínica de Estética)
- Proprietária: Katiuschia Garcia — enfermeira e esteticista
- WhatsApp: +55 99 98821-6488
- Instagram: @katiuschia_garcia
- Endereço: Rua Bela Vista, 550 — Bairro São Luís

Categorias de serviço na página: **Facial** e **Corporal** (não "Rosto"/"Corpo").

Seção "Quem sou eu" com bio (formação, especialidades, lado pessoal) recriada em
HTML/CSS a partir do conteúdo do post de Instagram que ela mandou como referência
(`assets/referencia-conheca-katiuschia.jpg`, local apenas, não versionado — ver
`.gitignore`). Falta a foto dela nessa seção (pendente, ver nota acima).

### Serviços (nome — duração — preço)

- Revitalização facial — 1h — R$ 70
- Revitalização labial — 15 min — R$ 50
- Limpeza de pele — R$ 150
- Detox termal — 30 min — R$ 120
- Esfoliação corporal — 30 min — R$ 100
- Massagem relaxante — 45 min — R$ 120
- Massagem terapêutica — R$ 130
- Ventosa terapia — 30 min — R$ 80

## Agendamento completo (carrinho + sinal 50% + e-mail) — CÓDIGO PRONTO

**Status: implementado em 2026-09-23, ainda não publicado.** A Katiuschia
confirmou que quer o sistema de verdade (não só WhatsApp). O código está
todo pronto e testado localmente — falta só publicar (ver checklist de deploy
mais abaixo).

O que já funciona (testado localmente com Playwright + testes de Node direto
na função serverless):
- Cada serviço é clicável (bolinha com check dourado) nas duas categorias.
- Barra fixa de baixo troca pro resumo do carrinho assim que algo é
  selecionado (quantidade + subtotal), com botão "Continuar".
- Modal de confirmação mostra os serviços escolhidos, subtotal, **sinal
  (50%)** e o restante a pagar no dia, mais o formulário (nome, telefone,
  e-mail, período de preferência, data opcional).
- Ao enviar, chama `POST /api/agendar`, que **recalcula tudo no servidor**
  a partir de `services.js` (nunca confia no preço vindo do navegador) e
  dispara os dois e-mails pelo Resend.
- Erros (rede fora do ar, Resend não configurado, dados inválidos) mostram
  mensagem amigável no modal, sem quebrar a página.

### Ainda pendente (bloqueia só o deploy, não o código)

- [ ] **E-mail exato dela** para receber os pedidos (`ORDER_EMAIL`) — ela
      confirmou que quer ser o e-mail dela mesma, mas o endereço ainda não
      foi passado.
- [ ] Criar conta na **Vercel** (grátis) e conectar a este repositório do
      GitHub — precisa ser feito por vocês, login não pode ser feito em nome
      dela.
- [ ] Criar conta no **Resend** (grátis até 3.000 e-mails/mês) e gerar uma
      API key.
- [ ] **Importante sobre o Resend**: enquanto não for verificado um domínio
      próprio (ex: `kgmsaude.com.br`) na conta Resend, o modo sandbox só
      permite enviar e-mail para o próprio endereço cadastrado na conta —
      ou seja, o e-mail de confirmação pro *cliente* não vai chegar de
      verdade em produção até isso ser feito. Pra testar rápido sem
      domínio, dá pra usar o mesmo e-mail em `ORDER_EMAIL` e no formulário
      de teste. Verificar domínio é simples (adicionar registros DNS no
      Resend) mas precisa que o domínio já exista.
- [ ] O período de agendamento é só uma **preferência** (ex: "terça de
      manhã") que ela confirma manualmente pelo WhatsApp depois — não tem
      checagem de disponibilidade real (agenda). Assumido assim por ser bem
      mais simples; avisar se ela esperava outra coisa.

### Arquivos do sistema

- `services.js` — catálogo de serviços (id, nome, categoria, duração, preço
  em centavos). Fonte única usada tanto pelo `index.html` quanto pela função
  serverless. **Se mudar preço/serviço, é só editar aqui** — o site e o
  e-mail se atualizam sozinhos.
- `api/agendar.js` — função serverless (Node) que valida o pedido, recalcula
  o total a partir de `services.js` e envia os e-mails via Resend.
- `package.json` — declara a dependência `resend` (a Vercel instala sozinha
  no deploy).

### Checklist de deploy (fazer quando tiver os dados acima)

1. Criar conta na [vercel.com](https://vercel.com), importar este
   repositório do GitHub.
2. No painel do projeto na Vercel → Settings → Environment Variables,
   adicionar:
   - `RESEND_API_KEY` — a key gerada no Resend.
   - `ORDER_EMAIL` — o e-mail da Katiuschia que recebe os pedidos.
3. Deploy (a Vercel faz automaticamente a cada push na branch `main`).
4. Testar um agendamento de verdade no link publicado.
5. Se o e-mail pro cliente não chegar: provavelmente é a limitação do modo
   sandbox do Resend (ver nota acima) — verificar domínio resolve.

### Arquitetura (referência)

- **Frontend**: o próprio `index.html`, com um pouco de JS puro (sem
  framework) pra controlar o estado do carrinho.
- **Backend**: uma função serverless na Vercel, em `/api/agendar.js` — é a
  única fonte confiável de preço (o JS do navegador pode ser adulterado, então
  o servidor recalcula tudo do zero a partir da própria lista de serviços,
  nunca confiando no total que vem do cliente).
- **E-mail**: Resend, dois e-mails por pedido (um pra ela, um pra o cliente).

### Fora de escopo (mesmo no fluxo completo)

- Cobrança automática de Pix — ela cobra o sinal manualmente pelo WhatsApp.
- Checagem real de agenda/disponibilidade — o sistema só coleta a preferência
  de período, ela confirma o horário exato manualmente.
- Painel administrativo pra ela editar conteúdo — já é um TODO separado, ver
  seção abaixo.

## TODO futuro (fora do escopo desta etapa)

- **Painel simples para ela editar o próprio conteúdo pelo celular** (ex: trocar o
  @ do Instagram, textos, preços) sem precisar mexer no código. Ideia da própria
  Katiuschia — ela usa muito mais o celular que o computador, então qualquer
  painel administrativo deve ser desenhado mobile-first, igual o site. Ainda não
  desenhado nem estimado — avaliar depois que o carrinho/agendamento estiver
  pronto.

## Prompt para continuar (colar no Claude Code)

```
Estou continuando o projeto KG Espaço Saúde (pasta kgmsaude). O sistema de
agendamento (carrinho + sinal 50% + e-mail) já está implementado em
services.js + api/agendar.js — falta só publicar. Preciso:

1. Criar/conectar conta na Vercel a este repositório do GitHub.
2. Configurar as variáveis de ambiente RESEND_API_KEY e ORDER_EMAIL.
3. Fazer o primeiro deploy e testar um agendamento de ponta a ponta.

E-mail que deve receber os pedidos (ORDER_EMAIL): [PREENCHER]
Já tenho conta na Vercel conectada ao repositório? [SIM / NÃO]
Já tenho conta e API key do Resend? [SIM, a key é ... / NÃO, preciso criar]
Já tenho um domínio pra verificar no Resend, ou vamos testar só com o
e-mail da própria conta por enquanto? [PREENCHER]
```

## Como retomar de casa

1. `git pull` (ou clonar o repositório, se for outra máquina)
2. `npm install` (instala a dependência `resend` localmente, se for testar)
3. Seguir o "Checklist de deploy" da seção de agendamento acima
4. Preencher os campos `[...]` do prompt acima e colar no Claude Code
