# Blog com API de artigos e pontuação SEO: especificação para replicar noutro site

Esta é a descrição completa do blog do Portal do Trespasse: páginas públicas, back-office, API de artigos e pontuação SEO.
Serve para pedir a outro chat do Claude que implemente **o mesmo** noutro website. Colar tudo o que está abaixo da linha
e acrescentar no início: o endereço do outro site, o repositório dele e a língua dos textos.

---

Quero que implementes neste website um blog igual ao do Portal do Trespasse: as mesmas páginas, o mesmo back-office, a mesma API de artigos e a mesma pontuação SEO. A especificação está abaixo.

Há uma **implementação de referência** num repositório público: https://github.com/tiagomendesmarques/portal-do-trespasse (ramo `main`). É Next.js 16 + TypeScript + PostgreSQL/Drizzle. Os ficheiros estão na secção 12: lê-os para copiar a lógica, mas **adapta à tecnologia, ao design e às convenções deste site**.

**Antes de começar:**
1. Vê como este site está feito: tecnologia, base de dados, autenticação e back-office, onde guarda imagens, como faz deploy e testes.
2. Propõe-me como encaixar o blog. Diz-me o que já existe e pode ser reaproveitado, e o que tem de ser criado.
3. Pergunta-me o que não for óbvio:
   - endereço dos artigos (`/blog/{slug}/` ou `/{slug}/`);
   - se já existe blog e artigos para migrar;
   - quem pode usar o back-office.

## 1. Visão geral

- **Blog público:**
  - lista paginada de artigos;
  - página de cada artigo com imagem, texto, perguntas frequentes e fontes;
  - tudo otimizado para o Google (metadados, dados estruturados, mapa do site, RSS).
- **Back-office:**
  - criar, editar, publicar e apagar artigos;
  - painel com pontuação SEO de 0 a 100 e o que falta corrigir.
- **API REST (`/api/v1/artigos/`):**
  - outro programa (ex.: uma tarefa agendada do Claude) cria, corrige e publica artigos;
  - protegida por uma chave;
  - recusa artigos com erros graves e devolve a pontuação SEO.
- **Imagens de bancos grátis:**
  - **Pexels**: o site guarda uma cópia;
  - **Unsplash**: fica nos servidores deles, como as regras da API exigem;
  - texto alternativo sempre obrigatório.

## 2. Dados

**Tabela `posts`:**

| Campo | Tipo | Notas |
|---|---|---|
| `id` | inteiro | |
| `slug` | texto, único | Endereço. Não pode coincidir com uma página do site. |
| `title` | texto | O `<h1>`. |
| `excerpt` | texto | Resumo para a lista; vazio = início do texto (~220 caracteres). |
| `content_html` | texto | HTML limpo (secção 8). |
| `status` | `draft` ou `published` | |
| `published_at` | data | Definida na primeira publicação e mantida depois. |
| `created_at`, `updated_at` | data | `updated_at` vai para `dateModified`. |
| `seo_title` | texto | Título para o Google (ideal ≤60, máximo 70). |
| `seo_description` | texto | Descrição para o Google (ideal 70–155, máximo 170). |
| `focus_keyword` | texto | Palavra-chave principal. |
| `secondary_keywords` | lista de texto | |
| `tags` | lista de texto | |
| `featured_image_key` | texto | Imagem guardada no site (ver secção 5). |
| `featured_image_url` | texto | Imagem do Unsplash (link direto). Só um dos dois tem valor. |
| `featured_image_alt` | texto | Obrigatório se houver imagem. |
| `featured_image_caption` | texto | Legenda. |
| `featured_image_credit` | texto | Ex.: "Foto: Ana Silva / Pexels". |
| `featured_image_credit_url` | texto | Link do fotógrafo. |
| `faq` | JSON `[{question, answer}]` | Perguntas frequentes (máx. 15). |
| `sources` | JSON `[{title, url}]` | Fontes (máx. 15). |
| `created_via` | texto | `"api"` quando veio da API. |
| `api_idempotency_key` | texto, único | Para reenvios não duplicarem. |
| `author_id` | referência | Opcional. |

**Outras tabelas usadas** (criar se o site não tiver equivalentes):
- `redirects (from_path único, to_path, status_code, note)`: redirects permanentes.
- `audit_log`: quem fez o quê.
- Limitador de pedidos (`rate_limits`).
- Modelos de email editáveis.

## 3. Páginas públicas

**Lista `/blog/`** e **páginas seguintes `/blog/page/{n}/`:**
- 12 artigos por página, só os publicados, do mais recente para o mais antigo;
- cada cartão tem imagem 16:9 (com `alt` e `srcset`), data, título e resumo cortado a 3 linhas;
- paginação com Anterior, números à volta da página atual com "…", e Seguinte;
- uma página que não existe dá 404.

**Artigo** (`/{slug}/` ou `/blog/{slug}/`):
- caminho "Início › Blog";
- data em letra pequena e o título em `<h1>`;
- **imagem de destaque** num `<figure>`:
  - `<img>` com `alt`, `srcset` (400, 800 e 1600 px), `sizes` e `fetchpriority="high"`;
  - `<figcaption>` com a legenda e o crédito (o crédito é link para o fotógrafo, com `rel="noopener nofollow"`);
- **texto** (`content_html`), com largura de leitura de cerca de 70 caracteres;
- **"Perguntas frequentes"**: `<h2>` e cada pergunta num `<details>/<summary>` (a primeira aberta);
- **"Fontes"**: lista de links externos com `rel="noopener nofollow"` e `target="_blank"`;
- etiquetas;
- **barra lateral** com o convite principal do site (no Portal: "Publicar anúncio" e "Ver anúncios");
- rascunhos não são públicos: dão 404.

**Metadados de cada artigo:**
- `<title>` = `seo_title` ou `title`; `<meta description>` = `seo_description` ou `excerpt`;
- `canonical` = o endereço do artigo;
- `keywords` = principal e secundárias;
- **Open Graph:** `type=article`, título, descrição, url, site_name, locale, `published_time`, `modified_time`, `tags`, e imagem de 1600 px com `alt`;
- **Twitter:** `summary_large_image` (ou `summary` sem imagem);
- **JSON-LD `BlogPosting`:**
  - `headline`, `description`, `inLanguage`, `datePublished`, `dateModified`;
  - `image` (endereço absoluto), `keywords`;
  - `author` (Organização "Equipa {Site}");
  - `publisher` (Organização com `logo` 512×512);
  - `mainEntityOfPage`;
- **JSON-LD `FAQPage`** quando houver perguntas;
- em cada JSON-LD, escapar `<` como `<`.

**Outros:**
- **RSS** (`/feed/`): os últimos 20 artigos publicados, com título, link, guid, data e resumo.
- **`sitemap.xml`:** os artigos publicados, com `lastmod` = `updated_at`.
- **Mudar o endereço** de um artigo publicado cria um redirect permanente do antigo para o novo.
- **Apagar** um artigo publicado cria um redirect do endereço dele para `/blog/`, para não haver 404.

## 4. Back-office (só para a equipa)

**Lista:**
- pesquisa pelo título, estado (Publicado/Rascunho), data e paginação de 30;
- etiqueta **"Via API"** nos artigos vindos da API;
- aviso "Artigo apagado" depois de apagar.

**Editar ou criar.** Coluna principal:
- título e resumo;
- texto (editor de HTML com botões Título, Subtítulo, Parágrafo, Negrito, Itálico, Lista, Ligação e Pré-visualizar);
- **Perguntas frequentes**: linhas pergunta/resposta com "Acrescentar pergunta", "Subir" e "Remover", enviadas como JSON num campo escondido;
- **Fontes**: área de texto, uma por linha, no formato `Título | https://…`.

Coluna lateral:
- **painel SEO** (secção 7): nota grande colorida (≥80 verde, ≥60 laranja, abaixo vermelho, vermelho também se houver erros), estatísticas, erros a vermelho e avisos;
- estado e endereço (com aviso de que mudar cria um redirect) e etiquetas;
- palavra-chave principal (com exemplo), secundárias, título e descrição para o Google (com os limites);
- **imagem de destaque**:
  - carregar, trocar ou tirar;
  - se vier do Unsplash: mostrar a imagem com a opção "Tirar esta imagem";
  - texto alternativo (obrigatório com imagem), legenda, crédito e link do crédito.

Cabeçalho: etiqueta "Via API", "Ver artigo" (se publicado) e **"Apagar artigo"** com confirmação.

**Validações ao gravar:**
- título ≥5 caracteres;
- endereço único (nem outro artigo nem uma página);
- texto ≥50 caracteres;
- perguntas completas;
- fontes com link válido;
- alt obrigatório com imagem.

Cada criação, edição e apagamento fica registado na auditoria.

## 5. Imagens

- **Guardadas no site:** convertidas para WebP em 3 larguras (400, 800 e 1600 px, qualidade ~78), com a orientação EXIF corrigida, servidas em `/media/{key}-{w}.webp` com `Cache-Control: public, max-age=31536000, immutable`. Usar o armazenamento que o site já tiver (disco, S3 ou GCS).
- **Bancos permitidos (lista fechada):**
  - `images.pexels.com`: **copiar** (descarregar e guardar como acima);
  - `images.unsplash.com` e `plus.unsplash.com`: **link** (fica o endereço; os tamanhos pedem-se ao Unsplash com `?w=400|800|1600&q=80&auto=format&fit=max`, mantendo os parâmetros que o endereço já tem).
- **Qualquer outro sítio, ou `http://`:** recusado.
- **Ao descarregar:**
  - sem seguir redirects (`redirect: "manual"`, só aceita 200);
  - `content-type` tem de começar por `image/`;
  - limite de 15 MB e 20 segundos;
  - a imagem tem de ser legível pela biblioteca de imagens.
- **Imagens dentro do texto (`<img>`):** as do Pexels são copiadas e o `src` passa a ser o do site, com `srcset`, `sizes`, `width`, `height` e `loading="lazy"`. As do Unsplash ficam com `srcset` do Unsplash. O `alt` mantém-se e é obrigatório.
- **Limpeza:** uma tarefa diária apaga as imagens guardadas que já nenhum artigo usa, com mais de 1 dia, e com um travão: não apaga nada se mais de metade parecer órfã.
- **Testes:** em ambientes que não são produção, uma variável (`BLOG_IMAGE_TEST_ORIGIN`) permite um banco de imagens falso. Em produção é ignorada.

## 6. API REST

**Base, chave e limites:**
- **Base:** `https://{site}/api/v1/artigos/` (sempre com `/` no fim).
- **Chave:** `Authorization: Bearer {BLOG_API_TOKEN}`, comparada em tempo constante.
  - sem `BLOG_API_TOKEN` definido (ou com menos de 24 caracteres): `503`, "A API de artigos está desligada";
  - chave errada: `401`.
- **A API não passa pela proteção por password** do site de testes, se existir: tem a sua própria chave.
- **Limites:** 300 pedidos por hora, corpo até 1 MB (`413`), JSON inválido dá `400`.

| Pedido | Para quê | Respostas |
|---|---|---|
| `GET /contexto/` | O que quem escreve precisa (ver abaixo) | 200 |
| `POST /` | Criar | 201 · 200 se já existia (mesma `Idempotency-Key`, com `idempotentReplay: true`) · 400 · 409 (endereço em uso, com `existingId`) · 422 (erros de SEO ou de imagem) |
| `GET /` | Os últimos 50 artigos criados pela API (sem o texto) | 200 |
| `GET /{id}/` | Um artigo, com a pontuação SEO atual | 200 · 404 |
| `PATCH /{id}/` | Corrigir ou publicar; só muda os campos enviados | 200 · 400 · 403 (artigo feito no back-office) · 404 · 409 · 422 |

**Não há DELETE:** apaga-se no back-office.

**`GET /contexto/` devolve:**
- `usedKeywords`;
- `posts` publicados (`title`, `url`, `focusKeyword`);
- `categories`, `distritos` e `pages` (`name`/`title` + `url`), ou o equivalente neste site, ou seja, as páginas para onde faz sentido ligar;
- `usefulLinks`;
- `imageHosts`;
- `limits` (os da secção 7).

**Campos aceites** (JSON; campos desconhecidos dão `400`):
- **Obrigatórios no POST:** `title` (10–100), `focusKeyword` (2–100), `contentHtml` (50–200 000 caracteres).
- **Opcionais:**
  - `slug` (vazio = gerado do título);
  - `status` (`draft` por omissão, ou `published`);
  - `secondaryKeywords` (≤10);
  - `seoTitle` (≤70), `seoDescription` (≤170), `excerpt` (≤300);
  - `featuredImage` `{ url, alt (5–200), caption?, credit?, creditUrl? }`; no PATCH, `null` tira a imagem;
  - `faq` `[{question (5–300), answer (5–2000)}]` (≤15);
  - `sources` `[{title, url}]` (≤15);
  - `tags` (≤10).

**Ordem ao gravar (POST e PATCH):**
1. Validar os campos e juntá-los com o artigo existente (no PATCH).
2. Gerar e confirmar o endereço: único, e não de uma página.
3. **Correr a pontuação SEO com o HTML original, antes de descarregar imagens.** Se houver erros: `422` e nada é gravado nem descarregado.
4. Tratar as imagens: a de destaque e as do texto.
5. Limpar o HTML.
6. Gravar:
   - `published_at` na primeira publicação;
   - `created_via="api"`;
   - `api_idempotency_key`;
   - redirect se um artigo publicado mudar de endereço.
7. Registar na auditoria (`post.api_create` ou `post.api_update`, com estado e pontuação).
8. Avisar a equipa por email quando o artigo é criado e quando passa a publicado. O email diz o título, "publicado" ou "guardado como rascunho", a pontuação e os links para o back-office e para o site.

**A resposta** traz o artigo: `id`, `status`, `slug`, `url`, `editUrl`, os campos, `featuredImage { stored: "site"|"unsplash", … }`, `publishedAt`, `updatedAt` e `seo`.

O PATCH só altera artigos com `created_via="api"`. Os feitos no back-office dão `403`.

## 7. Pontuação SEO

Função **pura**, testável sem base de dados, usada pela API e pelo painel do back-office.

**Recebe:** título, slug, `seoTitle`, `seoDescription`, excerpt, HTML, palavra-chave, se há imagem de destaque e o alt dela, faq, sources, e uma função `existe(caminho)` para validar as ligações internas.

**Devolve** `{ score 0–100, errors[], warnings[], stats { words, h2, internalLinks, externalLinks, images, faq, keywordDensity } }`.

**Antes de comparar:** normalizar o texto (minúsculas, sem acentos, "café" = "cafe") e tirar as tags HTML.

- **Ligação interna:** começa por `/` (mas não `//`) ou pelo domínio do site. Normalizar: sem `?` nem `#`, com `/` no fim.
- **Ligação externa:** `http(s)://` de outro domínio.

**Erros** (impedem gravar pela API):
- título com menos de 10 ou mais de 100 caracteres;
- texto com menos de 300 palavras;
- `<h1>` no texto;
- `<img>` sem `alt` preenchido;
- imagem de destaque sem alt;
- título para o Google com mais de 70 caracteres (vazio = título);
- descrição com mais de 170 caracteres;
- ligações internas para páginas que não existem (listá-las);
- pergunta frequente sem pergunta ou sem resposta.

**Pontos:**

| Regra | Pontos |
|---|---|
| Tem palavra-chave principal | 5 |
| Palavra-chave no título | 10 |
| … no título para o Google | 5 |
| … na descrição | 5 |
| … no endereço (slug da palavra-chave contido no slug) | 5 |
| … no primeiro parágrafo | 10 |
| … num `<h2>` | 5 |
| Densidade entre 0,5% e 2,5% (aviso "demasiadas vezes" acima de 2,5%) | 5 |
| Título para o Google com 30–60 caracteres | 5 |
| Descrição com 70–155 caracteres | 5 |
| ≥900 palavras | 5 |
| ≥1200 palavras | 5 |
| ≥3 `<h2>` | 5 |
| ≥3 ligações internas | 10 |
| ≥1 ligação externa | 5 |
| Tem imagem de destaque | 5 |
| ≥3 perguntas frequentes | 5 |
| Tem resumo | 5 |
| Nenhum parágrafo com mais de 150 palavras | 5 |

**Cálculo:**
- `score = round(pontos obtidos / 110 × 100)`;
- sem palavra-chave, as 7 regras dela contam como falhadas;
- cada regra falhada gera um aviso em linguagem simples, com o valor atual (ex.: "O título para o Google deve ter 30 a 60 caracteres (tem 72).");
- aviso extra se não houver fontes nem ligações externas: "em temas legais ou fiscais, indique de onde vem a informação";
- **densidade** = ocorrências da palavra-chave × nº de palavras da palavra-chave × 100 / total de palavras.

## 8. Segurança

- **HTML dos artigos** passa por um filtro com lista de permissões:
  - tags normais de texto, mais `img`, `figure`, `figcaption`, `h1`, `h2`;
  - atributos: `a[href,title,target,rel]`, `img[src,srcset,sizes,alt,width,height,loading]`, `*[id]`;
  - esquemas: `http`, `https`, `mailto`, `tel`;
  - links externos ganham `rel="noopener nofollow"` e `target="_blank"`;
  - imagens ganham `loading="lazy"`.
- **Chave da API** num gestor de segredos (no Portal, o Google Secret Manager), nunca no código. Os scripts de deploy têm de a manter em cada deploy.
- **Imagens:** só os anfitriões da lista, sem redirects, com limites de tamanho e tempo. Isto evita usar o servidor para ir buscar endereços internos.
- **Outros controlos:** limite de pedidos, auditoria, campos desconhecidos recusados, `Idempotency-Key` com até 100 caracteres.

## 9. Testes

- **Unitários:**
  - pontuação SEO: artigo bom sem erros e com nota ≥90; cada erro; ligações partidas; acentos; excesso de palavra-chave; normalização de ligações;
  - imagens: anfitriões permitidos e recusados, tamanhos do Unsplash.
- **De ponta a ponta**, com um banco de imagens falso (35 verificações no Portal):
  - chave em falta ou errada;
  - contexto;
  - campos inválidos, erros de SEO (`<h1>`, ligação partida), imagem sem alt, imagem de outro sítio;
  - criar e publicar com nota alta;
  - página pública: h1, figure com alt, legenda e crédito, imagem copiada, imagem do texto com srcset, perguntas, fontes, JSON-LD, título e descrição, og:image e twitter;
  - reenvio idempotente; endereço repetido dá 409;
  - GET com SEO; PATCH com mudança de endereço e redirect permanente; lista;
  - PATCH de artigo do back-office dá 403;
  - rascunho não público;
  - back-office: etiqueta "Via API", painel SEO, perguntas e alt visíveis, email à equipa;
  - artigo feito à mão com perguntas e fontes pelo editor;
  - apagar um artigo publicado cria redirect para `/blog/`.

## 10. Para ligar em produção

1. Gerar a chave (64 caracteres aleatórios), guardá-la no gestor de segredos e passá-la ao site como `BLOG_API_TOKEN`.
2. Confirmar: `GET /api/v1/artigos/contexto/` sem chave dá `401`.
3. Documentar a API num ficheiro `docs/API_ARTIGOS.md`, com um exemplo `curl` completo, para quem a for usar.

## 11. Ordem recomendada

1. Dados (migração) e limpeza de HTML.
2. Pontuação SEO, com testes.
3. Imagens, com testes.
4. Páginas públicas e metadados.
5. Back-office.
6. API.
7. Testes de ponta a ponta.
8. Documentação e chave.

Mostrar-me no ambiente de testes antes de pôr em produção.

## 12. Implementação de referência (repositório do Portal do Trespasse)

| O quê | Ficheiro |
|---|---|
| Tabela `posts` | `src/db/schema.ts` (procurar `export const posts`) e `drizzle/0005_artigos-api.sql` |
| Pontuação SEO | `src/lib/blog/seo.ts` + `seo.test.ts` |
| Imagens (Pexels/Unsplash) | `src/lib/blog/images.ts` + `images.test.ts`; armazenamento em `src/lib/media.ts` |
| Ligações internas válidas | `src/lib/blog/links.ts` |
| Lógica da API (chave, campos, gravar) | `src/lib/blog/api.ts`, `src/lib/blog/api-route.ts` |
| Endereços da API | `src/app/api/v1/artigos/route.ts`, `[id]/route.ts`, `contexto/route.ts` |
| Página do artigo e metadados | `src/app/(site)/[slug]/page.tsx` |
| Lista do blog e cartão | `src/components/blog-index.tsx`, `src/components/post-card.tsx`, `src/app/(site)/blog/` |
| RSS e mapa do site | `src/app/feed/route.ts`, `src/app/sitemap.ts` |
| Limpeza de HTML | `src/lib/html.ts` (`sanitizeContentHtml`) |
| Back-office | `src/app/admin/blog/` (`page.tsx`, `post-form.tsx`, `[id]/page.tsx`), `src/components/admin/faq-editor.tsx`, `seo-panel.tsx`, `html-editor.tsx`, `image-picker.tsx` |
| Gravar e apagar no back-office | `src/lib/admin/content-actions.ts` (`savePostAction`, `deletePostAction`) |
| Email à equipa | `src/lib/email/defaults.ts` (modelo `admin_post_api`) |
| Limpeza diária de imagens | `src/lib/jobs/daily.ts` |
| Teste de ponta a ponta | `e2e/api-artigos.mjs` |
| Documentação da API | `docs/API_ARTIGOS.md` |
| Chave no Google Cloud | `deploy/gcp-blog-api.sh` |
| Tarefa agendada que escreve os artigos | `docs/PROMPT_ARTIGOS_SEO.md` (para reutilizar depois com o novo site) |
