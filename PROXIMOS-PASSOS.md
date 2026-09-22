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

## O que falta construir

Transformar o catálogo estático num fluxo de agendamento:

1. Cada serviço fica selecionável (carrinho), acumulando no mesmo `index.html`.
2. Resumo fixo mostra subtotal, **sinal (50%)** e o restante a pagar no dia.
3. Formulário: nome, telefone, e-mail e data/período de preferência.
4. Ao confirmar, uma função serverless recalcula o total **no servidor** (nunca confiar no valor vindo do navegador, pra ninguém adulterar o preço) e envia dois e-mails:
   - **Para a Katiuschia:** pedido completo (serviços, total, sinal, contato do cliente).
   - **Para o cliente:** confirmação da seleção + valor do sinal + aviso que ela vai entrar em contato pelo WhatsApp pra combinar o pagamento.

Cobrança automática de Pix fica para depois (fase posterior) — por enquanto ela cobra o sinal manualmente pelo WhatsApp.

## TODO futuro (fora do escopo desta etapa)

- **Painel simples para ela editar o próprio conteúdo pelo celular** (ex: trocar o
  @ do Instagram, textos, preços) sem precisar mexer no código. Ideia da própria
  Katiuschia — ela usa muito mais o celular que o computador, então qualquer
  painel administrativo deve ser desenhado mobile-first, igual o site. Ainda não
  desenhado nem estimado — avaliar depois que o carrinho/agendamento estiver
  pronto.

## Decisões técnicas já tomadas

- Hospedagem: **Vercel** (grátis, roda funções serverless nativas em `/api` sem precisar de framework)
- E-mail: **Resend** (grátis até 3.000 e-mails/mês, sem cartão)

## Pendência

Falta definir o e-mail que vai receber os pedidos dela (o dela mesmo, ou um seu provisório enquanto ela não usa o sistema sozinha) — sem isso a função de envio não pode ser configurada.

## Prompt para continuar (colar no Claude Code)

```
Estou continuando o projeto KG Espaço Saúde (pasta kgmsaude). Já existe um
index.html estático (catálogo + botão de WhatsApp) versionado no git, hoje sem
logo/foto (wordmark em texto, aguardando arte definitiva da cliente). Preciso
agora implementar:

1. Seleção de serviços tipo carrinho na mesma página, com resumo fixo
   mostrando subtotal, sinal de 50% e restante a pagar no dia.
2. Formulário de agendamento (nome, telefone, e-mail, data/período de
   preferência).
3. Uma função serverless na Vercel (pasta /api) que recebe o pedido,
   recalcula o total no servidor (nunca confiando no valor vindo do
   cliente) e envia dois e-mails via Resend: um para [EMAIL_DA_KATIUSCHIA]
   com o pedido completo, outro para o cliente confirmando a seleção e o
   valor do sinal.
4. Não implementar cobrança automática de Pix ainda — só avisar que ela
   vai entrar em contato pelo WhatsApp para combinar o pagamento.

E-mail que deve receber os pedidos: [PREENCHER]
Já tenho conta e API key da Resend? [SIM, a key é ... / NÃO, preciso criar]
```

## Como retomar de casa

1. `git pull` (ou clonar o repositório, se for outra máquina)
2. Preencher os dois campos `[...]` do prompt acima
3. Colar no Claude Code dentro da pasta do projeto
