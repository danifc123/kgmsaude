# KG Espaço Saúde — próxima etapa: carrinho + sinal de 50% + pedido por e-mail

## Contexto

`index.html` já é uma página completa (catálogo de serviços + botão de WhatsApp), no tema preto/dourado da marca. Hoje ela só serve como link-na-bio: o cliente vê os serviços e é direcionado pro WhatsApp manualmente.

**Sem imagens no momento** — a Katiuschia não gostou do logo/foto que estavam sendo usados e vai criar as artes dela mesma num programa de imagem (design definitivo) e mandar depois. Enquanto isso:
- Header usa uma wordmark em texto ("KG" + "Espaço Saúde & Bem-Estar") no lugar da logo.
- Favicon é um SVG inline simples (não depende de arquivo).
- A seção "Quem sou eu" ficou só com texto (título + bio + colunas de formação/pessoal), sem foto.

Quando ela mandar a logo e a foto definitivas: salvar em `assets/`, trocar a wordmark do header pela `<img>` da logo (era assim antes, ver histórico do git) e adicionar de volta o bloco de foto na seção "Quem sou eu".

Repositório git já inicializado (1 commit). Ainda **não publicado** num host de verdade — só rodou local / preview via artifact.

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

## Plano — fluxo de agendamento completo (carrinho + sinal 50% + e-mail)

**Status: só planejado, nada implementado ainda.** Escrito em 2026-09-22 pra não
perder a ideia — falta confirmar com a Katiuschia se é isso mesmo que ela quer
ou se ela prefere a versão mais simples descrita mais abaixo antes de eu
começar a construir.

### Confirmar com ela antes de implementar

- [ ] **Fluxo completo (sinal automático + 2 e-mails) ou versão simples (WhatsApp)?** — ver comparação no fim deste documento.
- [ ] **E-mail exato dela** para receber os pedidos (ela pediu pra ser o e-mail
      dela mesma, mas não passou o endereço ainda).
- [ ] Ela topa criar conta na **Vercel** (grátis) e conectar ao GitHub? Precisa
      ser feito por ela/pelo Daniel, login não pode ser feito em nome dela.
- [ ] Ela topa criar conta no **Resend** (grátis até 3.000 e-mails/mês) e gerar
      uma API key?
- [ ] O período de agendamento é só uma **preferência** (ex: "terça de manhã")
      que ela confirma manualmente pelo WhatsApp depois — ou ela quer algum
      tipo de checagem de disponibilidade real (agenda)? (Assumindo por
      enquanto que é só preferência, sem agenda real — é bem mais simples.)

### Arquitetura

- **Frontend**: o próprio `index.html`, com um pouco de JS puro (sem
  framework) pra controlar o estado do carrinho.
- **Backend**: uma função serverless na Vercel, em `/api/agendar.js` — é a
  única fonte confiável de preço (o JS do navegador pode ser adulterado, então
  o servidor recalcula tudo do zero a partir da própria lista de serviços,
  nunca confiando no total que vem do cliente).
- **E-mail**: Resend, dois e-mails por pedido (um pra ela, um pra o cliente).

### Passo a passo técnico

1. **Catálogo de serviços centralizado** — criar algo como `services.js` com
   `{ id, nome, categoria, duracao, precoCentavos }` pra cada serviço. Hoje a
   lista só existe "hardcoded" dentro do HTML; vira a fonte única usada tanto
   pra desenhar a página quanto pro servidor validar o pedido.
2. **Carrinho no `index.html`** — cada `.service` vira clicável (estado
   selecionado com borda/check dourado). A barra fixa de baixo (hoje é só o
   botão "Agendar no WhatsApp") passa a mostrar: quantos serviços foram
   escolhidos, subtotal, sinal (50%) e um botão "Continuar".
3. **Formulário de agendamento** — abre depois do carrinho (modal ou nova
   seção): nome, telefone, e-mail, período de preferência. Validação no
   navegador é só UX, não é o que decide o valor final.
4. **Endpoint `/api/agendar`** — recebe os IDs dos serviços escolhidos + dados
   do formulário (nunca o preço, isso o servidor calcula sozinho). Envia:
   - **Pra Katiuschia** (`ORDER_EMAIL`): pedido completo — serviços, total,
     sinal, contato do cliente.
   - **Pra o cliente**: confirmação da seleção, valor do sinal, aviso que ela
     entra em contato pelo WhatsApp pra combinar o pagamento.
5. **Variáveis de ambiente na Vercel**: `RESEND_API_KEY` e `ORDER_EMAIL` —
   nunca ficam no código, só configuradas no painel da Vercel.
6. **Deploy**: conectar o repositório GitHub à Vercel; a partir daí, todo push
   na branch `main` publica automaticamente.

### Fora de escopo (mesmo no fluxo completo)

- Cobrança automática de Pix — ela cobra o sinal manualmente pelo WhatsApp.
- Checagem real de agenda/disponibilidade — o sistema só coleta a preferência
  de período, ela confirma o horário exato manualmente.
- Painel administrativo pra ela editar conteúdo — já é um TODO separado, ver
  seção abaixo.

### Alternativa mais simples (se ela achar o plano acima grande demais)

Carrinho igual (serviços clicáveis, resumo de subtotal), mas **sem backend
nenhum**: o botão final monta a mensagem do WhatsApp já com os serviços
escolhidos e o total, abrindo o `wa.me` preenchido. Sem sinal calculado
automaticamente, sem e-mail, sem precisar de conta na Vercel nem no Resend —
dá pra publicar isso hoje mesmo. Serve como primeiro passo e não impede
evoluir pro fluxo completo depois, quando/se ela quiser.

## TODO futuro (fora do escopo desta etapa)

- **Painel simples para ela editar o próprio conteúdo pelo celular** (ex: trocar o
  @ do Instagram, textos, preços) sem precisar mexer no código. Ideia da própria
  Katiuschia — ela usa muito mais o celular que o computador, então qualquer
  painel administrativo deve ser desenhado mobile-first, igual o site. Ainda não
  desenhado nem estimado — avaliar depois que o carrinho/agendamento estiver
  pronto.

## Prompt para continuar (colar no Claude Code)

```
Estou continuando o projeto KG Espaço Saúde (pasta kgmsaude). Conversei com a
Katiuschia e o plano de agendamento (seção "Plano — fluxo de agendamento
completo" no PROXIMOS-PASSOS.md) está confirmado assim: [DESCREVER O QUE ELA
CONFIRMOU — fluxo completo, versão simples via WhatsApp, ou alguma mudança no
plano].

E-mail que deve receber os pedidos: [PREENCHER]
Já tenho conta na Vercel conectada ao repositório? [SIM / NÃO]
Já tenho conta e API key do Resend? [SIM, a key é ... / NÃO, preciso criar]
```

## Como retomar de casa

1. `git pull` (ou clonar o repositório, se for outra máquina)
2. Confirmar com a Katiuschia os itens marcados com `[ ]` na seção do plano
3. Preencher os campos `[...]` do prompt acima
4. Colar no Claude Code dentro da pasta do projeto
