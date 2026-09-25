# KG Espaço Saúde — status do projeto

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

## Agendamento — carrinho + redirecionamento pro WhatsApp (IMPLEMENTADO)

**Status: pronto, funcionando localmente.** Depois de conversar com a
Katiuschia, ficou claro que o pedido original tinha sido mal entendido: ela
**não quer** sinal automático, e-mail, nem nenhum método de pagamento no
site. O fluxo certo é: o cliente escolhe os serviços e é encaminhado direto
pro WhatsApp dela com a seleção já escrita na mensagem — ela confirma valor,
horário e pagamento na conversa, como sempre fez.

> Chegamos a implementar uma versão com carrinho + sinal de 50% + e-mail
> automático (Resend/Vercel functions), mas foi removida em 2026-09-23 por
> não ser o que ela queria. Se um dia isso mudar, o código ainda existe no
> histórico do git (branch `dev`, commits de 23/09) e pode ser recuperado.

Como funciona hoje:
- Cada serviço é clicável (bolinha com check dourado) nas duas categorias.
- Barra fixa de baixo troca pro resumo do carrinho assim que algo é
  selecionado (quantidade + subtotal), com botão **"Continuar no WhatsApp"**.
- Ao tocar no botão, abre o WhatsApp dela (mesmo número do resto do site)
  com uma mensagem pronta listando os serviços escolhidos e o total.
- `services.js` continua sendo o catálogo único (id, nome, categoria,
  duração, preço) usado pra desenhar a lista e montar a mensagem — mudar
  preço é só editar esse arquivo. **Importante**: depois de editar, também
  aumentar o número em `services.js?v=2` (o `<script src="services.js?v=2">`
  no final do `index.html`) — senão o navegador de quem já visitou o site
  pode continuar usando os preços antigos em cache.

### Pendente

- [ ] **Texto da mensagem do WhatsApp**: a Katiuschia mandou um texto
      pronto pra usar nessa mensagem — o Daniel vai repassar. Hoje o texto é
      um padrão genérico ("Olá! Gostaria de agendar: ..."), gerado em
      `index.html` dentro do `<script>` no final do arquivo (função do botão
      `#cart-continue`). Trocar pelo texto dela assim que chegar.

## TODO futuro (fora do escopo desta etapa)

- **Painel simples para ela editar o próprio conteúdo pelo celular** (ex: trocar o
  @ do Instagram, textos, preços) sem precisar mexer no código. Ideia da própria
  Katiuschia — ela usa muito mais o celular que o computador, então qualquer
  painel administrativo deve ser desenhado mobile-first, igual o site. Ainda não
  desenhado nem estimado — avaliar depois que o carrinho/agendamento estiver
  pronto.

## Prompt para continuar (colar no Claude Code)

```
Estou continuando o projeto KG Espaço Saúde (pasta kgmsaude). O carrinho já
redireciona pro WhatsApp com os serviços escolhidos. Preciso trocar o texto
da mensagem pelo que a Katiuschia mandou:

[COLAR O TEXTO DELA AQUI]

Ele deve ir no lugar do texto padrão dentro do <script> no final do
index.html, na função do botão #cart-continue.
```

## Como retomar de casa

1. `git pull` (ou clonar o repositório, se for outra máquina)
2. Abrir o `index.html` direto no navegador, ou rodar
   `python -m http.server 8843` e abrir http://127.0.0.1:8843/index.html
3. Colar o prompt acima no Claude Code com o texto que a Katiuschia mandou
