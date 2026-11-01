# Prompt para o novo chat: artigos SEO automáticos de 2 em 2 dias

O site já tem a **API de artigos** (ver `docs/API_ARTIGOS.md`). O novo chat não precisa de mexer no código do site:
liga as peças, faz um artigo de teste e agenda a tarefa de 2 em 2 dias.

## Antes de abrir o chat (feito por si)

1. **API ligada:** fazer o `docs/PROMPT_CHROME_BLOG_API.md` com o Claude no Chrome. Fica com a chave da API (`PDT_BLOG_TOKEN`).
2. **Google Sheets:** Partilhar → Acesso geral → "Qualquer pessoa com o link" → **Leitor**.
3. **Chaves grátis dos bancos de imagens:**
   - Pexels: https://www.pexels.com/api/ → "Get started" → a chave aparece na conta.
   - Unsplash: https://unsplash.com/developers → "New Application" → copiar a "Access Key". O modo demo, com 50 pedidos por hora, chega e sobra.
4. **Ambiente do Claude Code** (menu do ambiente, na barra do título da sessão → Edit):
   - **Network access → Allowed domains:**
     - `docs.google.com`, `*.googleusercontent.com`
     - `portaldotrespasse.pt`, `dev.portaldotrespasse.pt`
     - `api.pexels.com`, `images.pexels.com`
     - `api.unsplash.com`, `images.unsplash.com`
   - **Variáveis de ambiente** (ou "Network secrets"):
     - `PDT_BLOG_TOKEN`: a chave da API de artigos;
     - `PEXELS_API_KEY`;
     - `UNSPLASH_ACCESS_KEY`.
   - **Nunca cole estas chaves no chat.**

Depois, abrir um chat novo do **Claude Code** (claude.ai/code) com este repositório e esse ambiente, e colar tudo o que está abaixo da linha.

---

Sou o dono do **Portal do Trespasse** (https://portaldotrespasse.pt), um site gratuito de anúncios de trespasses e negócios à venda em Portugal. Escrevo em português de Portugal.

Quero **um artigo de blog otimizado para SEO de 2 em 2 dias**, escrito por ti (Claude) a partir das palavras-chave que escolhi neste Google Sheets:
https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/edit
(exportação em CSV: `https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv`).

**O site já tem uma API de artigos.** A documentação está em `docs/API_ARTIGOS.md` neste repositório: lê-a primeiro.
- A chave está na variável de ambiente `PDT_BLOG_TOKEN`.
- As chaves dos bancos de imagens estão em `PEXELS_API_KEY` e `UNSPLASH_ACCESS_KEY`.
- **Nunca mostres nem escrevas estas chaves.**
- **Não é preciso mudar o código do site.** Se achares que é, pergunta-me primeiro. O fluxo é ramo `claude/…` → `dev` → eu testo → `main`.

## Passo 1: confirmar acessos
1. Lê `GET https://portaldotrespasse.pt/api/v1/artigos/contexto/`.
2. Descarrega o CSV e diz-me que colunas tem a folha e quantas palavras-chave há.
3. Faz uma pesquisa de teste no Pexels e no Unsplash.

Se alguma coisa falhar, diz-me o que está em falta (rede, variável, partilha da folha) e para.

## Passo 2: artigo de teste
Faz um artigo com a primeira palavra-chave, seguindo as regras do texto da tarefa (abaixo). **Fica como rascunho** (não faças o passo 7 dessas regras), para eu ver a qualidade no back-office. Dá-me o `editUrl`.

## Passo 3: agendar
Quando eu disser que está bem, cria a **tarefa agendada**:
- uma sessão nova a cada execução, neste ambiente;
- de 2 em 2 dias, às 7h23 de Lisboa: `CRON_TZ=Europe/Lisbon 23 7 */2 * *`;
- com o texto abaixo, tal e qual.

Confirma-me a data da primeira execução.

## Texto da tarefa (de 2 em 2 dias)

> Escreve e publica o próximo artigo de blog do Portal do Trespasse (https://portaldotrespasse.pt), em português de Portugal, usando a API de artigos (documentação em `docs/API_ARTIGOS.md` no repositório; chave em `$PDT_BLOG_TOKEN`, que nunca mostras).
>
> **1. Palavra-chave.**
> - Descarrega o CSV: `https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv`.
> - Lê `GET https://portaldotrespasse.pt/api/v1/artigos/contexto/`.
> - Escolhe a primeira palavra-chave da folha que não esteja em `usedKeywords`. Respeita as colunas de prioridade, estado ou notas, se existirem.
> - Se o tema já estiver bem coberto por um artigo em `posts`, salta para a seguinte e explica no resumo.
>
> **2. Pesquisa.**
> - Pesquisa na web o que as pessoas procuram com esta palavra-chave em Portugal.
> - Factos legais, fiscais ou de licenciamento (contrato de trespasse, impostos, licenças, arrendamento) só de fontes oficiais: portaldasfinancas.gov.pt, diariodarepublica.pt, eportugal.gov.pt, iapmei.pt, ine.pt, ou o site da câmara municipal.
> - Na dúvida, não ponhas números, prazos ou valores.
> - Nunca inventes estatísticas, casos ou citações.
>
> **3. Imagem de destaque.**
> - Procura no **Pexels** (`GET https://api.pexels.com/v1/search?query=…&orientation=landscape&per_page=15`, cabeçalho `Authorization: $PEXELS_API_KEY`). Pesquisa em inglês, que dá mais resultados.
>   - Usa `src.large2x`, que é de `images.pexels.com`.
>   - Crédito: `"Foto: {photographer} / Pexels"`, com `creditUrl` = `photographer_url`.
> - Se não houver nada bom, usa o **Unsplash** (`GET https://api.unsplash.com/search/photos?query=…&orientation=landscape`, cabeçalho `Authorization: Client-ID $UNSPLASH_ACCESS_KEY`).
>   - Usa `urls.raw`.
>   - Chama `links.download_location` (com o mesmo cabeçalho), como as regras do Unsplash exigem.
>   - Crédito: `"Foto: {user.name} / Unsplash"`, com `creditUrl` = `{user.links.html}?utm_source=portal_do_trespasse&utm_medium=referral`.
> - Escolhe uma foto que mostre um negócio real (café, loja, restaurante, escritório), sem texto nem marcas visíveis.
> - `alt` em português, a descrever o que se vê, se fizer sentido com a palavra-chave. Ex.: "Balcão de um café com máquina de expresso".
> - Opcional: 1 imagem a meio do texto, com as mesmas regras.
>
> **4. Escrever.**
> - **Título:** com a palavra-chave e diferente dos que já existem.
> - **`seoTitle`:** 30 a 60 caracteres. **`seoDescription`:** 70 a 155, com a palavra-chave e um motivo para clicar.
> - **`slug`:** curto, sem acentos, com a palavra-chave.
> - **`contentHtml`:** 1200 a 1600 palavras, em HTML simples, sem `<h1>` e com parágrafos curtos (até 120 palavras).
> - **Estrutura:**
>   - uma introdução que responde logo à pergunta de quem pesquisa, com a palavra-chave no primeiro parágrafo;
>   - 4 a 7 secções `<h2>`, uma delas com a palavra-chave;
>   - exemplos práticos de negócios em Portugal;
>   - conclusão com convite a ver anúncios (`/all-ads/`) ou a publicar o anúncio grátis (`/post-an-ad/`).
> - **Ligações internas:** 3 a 6, só para endereços que vieram do contexto (categorias, distritos, artigos relacionados, páginas úteis).
> - **Ligações externas:** 1 a 2, para fontes oficiais.
> - **`faq`:** 3 a 5 perguntas reais, com respostas curtas e diretas. Não as repitas no `contentHtml`.
> - **`sources`:** as fontes oficiais usadas.
> - **Também:** `secondaryKeywords` (2 a 5), `excerpt` (1 a 2 frases) e `tags` (2 a 4).
> - **Tom:** próximo mas profissional, "você" e não "tu", português de Portugal ("renda", "contrato", "trespasse"; nunca "aluguel").
>
> **5. Rever.**
> - Lê o artigo como um revisor.
> - Corta repetições e confirma os factos com as fontes.
> - Confirma que cada ligação interna está no contexto.
>
> **6. Enviar como rascunho.**
> - `POST https://portaldotrespasse.pt/api/v1/artigos/`, com `"status": "draft"` e o cabeçalho `Idempotency-Key: <slug>-<data de hoje>`.
> - Se a resposta for `422` ou `409`, corrige e envia outra vez, no máximo 3 vezes.
> - Vê os `seo.warnings` e corrige o que fizer sentido com `PATCH /api/v1/artigos/{id}/`.
>
> **7. Publicar.**
> - Se `seo.score` for **85 ou mais** e não tiveres dúvidas sobre os factos, faz `PATCH /api/v1/artigos/{id}/` com `{ "status": "published" }`.
> - Senão, deixa em rascunho e explica porquê no resumo.
>
> **8. Resumo final:**
> - palavra-chave;
> - título;
> - estado (publicado ou rascunho);
> - pontuação SEO;
> - `url` e `editUrl`;
> - imagem e crédito;
> - fontes usadas;
> - o que eu deva verificar à mão.
>
> **Se algo falhar** (folha inacessível, chave em falta, site em baixo, sem imagem adequada): não inventes nem uses outra via; termina com o erro exato.

## Decisões já tomadas
- **Publicação automática:** quando a pontuação SEO é 85 ou mais. Se eu não gostar de um artigo, apago-o ou edito-o no back-office.
- **Imagens:** do Pexels (preferido) ou do Unsplash, sempre com texto alternativo e crédito ao fotógrafo.
- **Assinatura:** "Equipa Portal do Trespasse" (automática no site).
- **Custo:** corre no meu plano do Claude, sem conta da API da Anthropic à parte.
