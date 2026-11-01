# Tarefa agendada: artigo SEO do blog de 2 em 2 dias

## Links
- **Folha das palavras-chave** ("portaldotrespasse Keywords study"): https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/edit
  - separador `keywords-prod` (palavras-chave; linha N = artigo N): https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/edit?gid=1573281983#gid=1573281983
  - separador `memory` (A1 = número do último artigo feito): https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/edit?gid=1479828294#gid=1479828294
- **API de artigos:** `docs/API_ARTIGOS.md`.
- **Artigo de teste** (id 339, rascunho aprovado): https://portaldotrespasse.pt/admin/blog/339/

## Configuração da tarefa
- **Nome:** Artigo SEO do blog (2 em 2 dias)
- **Quando:** de 2 em 2 dias, às 7h23 de Lisboa: `CRON_TZ=Europe/Lisbon 23 7 */2 * *`. Nos meses de 31 dias, o artigo do dia 31 e o do dia 1 saem em dias seguidos.
- **Sessão:** uma sessão nova a cada execução, no ambiente "Default".
- **Conector:** Google Sheets, para atualizar a `memory`.
- **Variáveis de ambiente** (Edit cloud environment → Environment variables):
  - `PDT_BLOG_TOKEN`: obrigatória;
  - `UNSPLASH_ACCESS_KEY`: obrigatória se não houver `PEXELS_API_KEY`;
  - `PEXELS_API_KEY`: opcional.
- **Rede:** Full, ou pelo menos docs.google.com, *.googleusercontent.com, portaldotrespasse.pt, api.pexels.com, images.pexels.com, api.unsplash.com, images.unsplash.com e as fontes oficiais.

## O que a tarefa faz em cada execução
1. Lê `memory!A1` (M) e escolhe a linha N = M + 1 de `keywords-prod`. Não salta nenhuma linha; só passa à seguinte se essa palavra-chave já tiver um artigo feito pela API.
2. Pesquisa o tema; os factos legais e fiscais vêm só de fontes oficiais.
3. Escolhe uma imagem do Pexels ou do Unsplash, com texto alternativo e crédito.
4. Escreve o artigo: 1200 a 1600 palavras, 4 a 7 secções, perguntas frequentes, fontes e ligações internas.
5. Envia o artigo como rascunho e corrige os avisos de SEO.
6. Publica-o se a pontuação SEO for 85 ou mais e não houver dúvidas sobre os factos.
7. Escreve N em `memory!A1`.
8. Deixa um resumo: N, palavra-chave, título, estado, pontuação, links, imagem, fontes, memória atualizada e o que verificar à mão.

**Para fazer reset:** mude à mão o número em `memory!A1`. A próxima execução faz o número seguinte.

## Texto da tarefa (colar tal e qual)

Escreve e publica o próximo artigo de blog do Portal do Trespasse (https://portaldotrespasse.pt), em português de Portugal, usando a API de artigos. A chave está em `$PDT_BLOG_TOKEN` e nunca a mostras. Não mudes o código do site.

**Folha Google Sheets** "portaldotrespasse Keywords study", ID `1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA`. Usa o conector Google Sheets (ferramentas `mcp__Google_Sheets__*`; carrega-as com ToolSearch se for preciso):
- separador `keywords-prod`: 1 coluna, sem cabeçalho; a linha N (coluna A) é a palavra-chave do artigo N;
- separador `memory`: a célula A1 tem o número do último artigo feito. O dono pode mudá-lo à mão para fazer reset.

**Resumo da API** (se `docs/API_ARTIGOS.md` estiver disponível na sessão, lê-o também):
- Base: `https://portaldotrespasse.pt/api/v1/artigos/` (endereços terminam sempre em `/`). Cabeçalhos: `Authorization: Bearer $PDT_BLOG_TOKEN` e `Content-Type: application/json`.
- `GET /api/v1/artigos/contexto/` → `usedKeywords`, `posts` (title, url, focusKeyword), `categories`, `distritos`, `pages`, `usefulLinks`, `limits`.
- `POST /api/v1/artigos/` → 201 criado · 200 já existia (mesma `Idempotency-Key`) · 400 campos inválidos · 409 endereço em uso · 422 erros de SEO ou de imagem. Resposta: `id`, `status`, `slug`, `url`, `editUrl`, `seo` {score, errors, warnings, stats}.
- `PATCH /api/v1/artigos/{id}/` → só muda os campos enviados.
- Campos (campos desconhecidos dão 400): `title` (10–100, obrigatório), `focusKeyword` (obrigatório), `contentHtml` (obrigatório; só `<p> <h2> <h3> <ul> <ol> <li> <strong> <em> <a> <img> <blockquote> <table>`, sem `<h1>`, cada `<img>` com `alt`), `slug`, `status` ("draft"/"published"), `secondaryKeywords` (até 10), `seoTitle` (máx. 70), `seoDescription` (máx. 170), `excerpt` (até 300), `featuredImage` {`url`, `alt` (5–200), `caption`?, `credit`?, `creditUrl`?} só de `images.pexels.com` ou `images.unsplash.com`, `faq` [{`question`, `answer`}], `sources` [{`title`, `url`}], `tags` (até 10).
- Ligações internas só para endereços do contexto, anúncios (`/listing/…/`) ou concelhos (`/listing-location/distrito/concelho/`).

**1. Palavra-chave (por número de linha, sem saltos).**
- Lê `memory!A1` → M (número inteiro).
- Lê `keywords-prod!A:A`.
- Lê `GET https://portaldotrespasse.pt/api/v1/artigos/contexto/`.
- O artigo de hoje é a linha N = M + 1, e a palavra-chave é `keywords-prod!A{N}`.
- Proteção contra repetições: se essa palavra-chave (comparada sem maiúsculas e sem espaços à volta) já estiver em `usedKeywords`, avança para a linha seguinte até encontrares uma que não esteja, e explica no resumo.
- Não saltes nenhuma linha por outro motivo. Se o tema já tiver artigos antigos em `posts`, escreve num ângulo novo, com um título claramente diferente, e liga para o artigo antigo mais próximo.
- Se N passar da última linha preenchida, para e diz que as palavras-chave acabaram.
- Se o conector Google Sheets não estiver disponível, lê as folhas por CSV (`https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv&gid=1573281983` para keywords-prod e `https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv&gid=1479828294` para memory). Nesse caso, calcula também U = a linha mais alta de `keywords-prod` cuja palavra-chave está em `usedKeywords` (ignorando a linha 1, "trespasse", que foi um teste) e usa N = max(M, U) + 1. Avisa no resumo que a `memory` não foi atualizada e que o dono deve pôr N à mão.

**2. Pesquisa.**
- Pesquisa na web o que as pessoas procuram com esta palavra-chave em Portugal.
- Factos legais, fiscais ou de licenciamento (contrato de trespasse, impostos, licenças, arrendamento) só de fontes oficiais: portaldasfinancas.gov.pt, diariodarepublica.pt, eportugal.gov.pt, iapmei.pt, ine.pt, ou o site da câmara municipal. As páginas de legislação consolidada do diariodarepublica.pt precisam de JavaScript: usa o Playwright (já instalado; `require('playwright')`, `chromium.launch()`) para as ler. Código Civil: `https://diariodarepublica.pt/dr/legislacao-consolidada/decreto-lei/1966-34509075`; Código do Trabalho: `https://diariodarepublica.pt/dr/legislacao-consolidada/lei/2009-34546475`.
- Na dúvida, não ponhas números, prazos ou valores.
- Nunca inventes estatísticas, casos ou citações. Exemplos hipotéticos só se forem apresentados como tal ("Imagine…").

**3. Imagem de destaque.**
- Procura no **Pexels** (`GET https://api.pexels.com/v1/search?query=…&orientation=landscape&per_page=15`, cabeçalho `Authorization: $PEXELS_API_KEY`). Pesquisa em inglês, que dá mais resultados. Se `PEXELS_API_KEY` não existir, passa diretamente ao Unsplash.
  - Usa `src.large2x`, que é de `images.pexels.com`.
  - Crédito: `"Foto: {photographer} / Pexels"`, com `creditUrl` = `photographer_url`.
- Se não houver nada bom, usa o **Unsplash** (`GET https://api.unsplash.com/search/photos?query=…&orientation=landscape`, cabeçalho `Authorization: Client-ID $UNSPLASH_ACCESS_KEY`).
  - Usa `urls.raw`.
  - Chama `links.download_location` (com o mesmo cabeçalho), como as regras do Unsplash exigem.
  - Crédito: `"Foto: {user.name} / Unsplash"`, com `creditUrl` = `{user.links.html}?utm_source=portal_do_trespasse&utm_medium=referral`.
- Escolhe uma foto que mostre um negócio real (café, loja, restaurante, escritório), sem texto nem marcas visíveis. Vê a miniatura antes de escolher.
- `alt` em português, a descrever o que se vê, se fizer sentido com a palavra-chave. Ex.: "Balcão de um café com máquina de expresso".
- Opcional: 1 imagem a meio do texto, com as mesmas regras.

**4. Escrever.**
- **Título:** com a palavra-chave e diferente dos que já existem.
- **`seoTitle`:** 30 a 60 caracteres. **`seoDescription`:** 70 a 155, com a palavra-chave e um motivo para clicar.
- **`slug`:** curto, sem acentos, com a palavra-chave, e que não exista em `posts`.
- **`contentHtml`:** 1200 a 1600 palavras, em HTML simples, sem `<h1>` e com parágrafos curtos (até 120 palavras).
- **Estrutura:**
  - uma introdução que responde logo à pergunta de quem pesquisa, com a palavra-chave no primeiro parágrafo;
  - 4 a 7 secções `<h2>` (subsecções em `<h3>`), uma delas com a palavra-chave;
  - exemplos práticos de negócios em Portugal;
  - conclusão com convite a ver anúncios (`/all-ads/`) ou a publicar o anúncio grátis (`/post-an-ad/`).
- **Ligações internas:** 3 a 6, só para endereços que vieram do contexto (categorias, distritos, artigos relacionados, páginas úteis).
- **Ligações externas:** 1 a 2, para fontes oficiais.
- **`faq`:** 3 a 5 perguntas reais, com respostas curtas e diretas. Não as repitas no `contentHtml`.
- **`sources`:** as fontes oficiais usadas.
- **Também:** `secondaryKeywords` (2 a 5), `excerpt` (1 a 2 frases) e `tags` (2 a 4).
- **Tom:** próximo mas profissional, "você" e não "tu", português de Portugal ("renda", "contrato", "trespasse"; nunca "aluguel").

**5. Rever.**
- Lê o artigo como um revisor.
- Corta repetições e confirma os factos com as fontes.
- Confirma que cada ligação interna está no contexto.
- Conta as palavras e os `<h2>`.

**6. Enviar como rascunho.**
- `POST https://portaldotrespasse.pt/api/v1/artigos/`, com `"status": "draft"`, `focusKeyword` = a palavra-chave da linha N tal como está na folha, e o cabeçalho `Idempotency-Key: <slug>-<data de hoje>`.
- Se a resposta for `422` ou `409`, corrige e envia outra vez, no máximo 3 vezes.
- Vê os `seo.warnings` e corrige o que fizer sentido com `PATCH /api/v1/artigos/{id}/`.

**7. Publicar.**
- Se `seo.score` for **85 ou mais** e não tiveres dúvidas sobre os factos, faz `PATCH /api/v1/artigos/{id}/` com `{ "status": "published" }`.
- Senão, deixa em rascunho e explica porquê no resumo.

**8. Atualizar a memória.**
- Assim que o artigo ficar guardado no site (publicado ou em rascunho), escreve N em `memory!A1` (só o número, sem mais nada; não mexas nas outras células).
- Lê `memory!A1` outra vez para confirmar que ficou N.
- Se o artigo não chegou a ser guardado no site, não mexas na `memory`.

**9. Resumo final:**
- número do artigo (N) e palavra-chave;
- título;
- estado (publicado ou rascunho);
- pontuação SEO;
- `url` e `editUrl`;
- imagem e crédito;
- fontes usadas;
- se a `memory` foi atualizada para N;
- o que o dono deva verificar à mão.

**Se algo falhar** (folha inacessível, chave em falta, site em baixo, sem imagem adequada): não inventes nem uses outra via além das indicadas; termina com o erro exato. Nunca mostres nem escrevas as chaves.
