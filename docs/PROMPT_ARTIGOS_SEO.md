# Prompt para o novo chat: artigos SEO automáticos de 2 em 2 dias

Abrir um chat novo do **Claude Code** (claude.ai/code) com este repositório e colar tudo o que está abaixo da linha.
O chat faz a preparação uma vez (Parte A) e deixa uma tarefa agendada que escreve um artigo de 2 em 2 dias (Parte B).

**Antes de abrir o chat (5 minutos, feito por si):**
1. **Google Sheets:** Partilhar → Acesso geral → "Qualquer pessoa com o link" → **Leitor**.
2. **Rede do ambiente do Claude Code:** no menu do ambiente (barra do título da sessão → Edit) → Network access → Allowed domains, acrescentar:
   - `docs.google.com`
   - `*.googleusercontent.com`
   - `portaldotrespasse.pt`
   - `dev.portaldotrespasse.pt`
3. **A chave do blog:** o chat novo vai criá-la e explicar onde a pôr. Nunca a cole no chat.

---

## Contexto

Sou o dono do **Portal do Trespasse** (https://portaldotrespasse.pt), um site gratuito de anúncios de trespasses e negócios à venda em Portugal. Escrevo em português de Portugal.

Quero **um artigo de blog otimizado para SEO de 2 em 2 dias**, feito por ti (Claude), a partir das palavras-chave que escolhi neste Google Sheets:
https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/edit
(exportação em CSV: `https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv`). Vê tu as colunas que lá estão.

**Cada artigo entra como rascunho** no back-office. Eu reviso e publico. Mais tarde posso pedir publicação automática.

### O site (este repositório)

**Código e ramos:**
- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, PostgreSQL com Drizzle ORM e Node 22.
- Em desenvolvimento local usa PGlite: `DATABASE_URL=pglite:./.data/pglite`.
- **Ramos e deploy automático (Cloud Build → Cloud Run, região `europe-west1`):**
  - `dev` → https://dev.portaldotrespasse.pt (site de testes, com password);
  - `main` → https://portaldotrespasse.pt.
- **Como trabalhamos:** fazes o trabalho num ramo `claude/…`, envias para `dev`, eu testo, e só com o meu OK passas para `main` (fast-forward).
- **Testes:** unitários com `npx vitest run`; end-to-end com os scripts `e2e/*.mjs` contra o servidor local (ver o README).

**O blog:**
- Tabela `posts` (`src/db/schema.ts`): `slug`, `title`, `excerpt`, `contentHtml`, `featuredImageKey`, `tags`, `status` (`draft` ou `published`), `seoTitle`, `seoDescription`, `authorId` e `publishedAt`.
- Endereços públicos: os artigos ficam em `/{slug}/`, a lista em `/blog/`, a edição em `/admin/blog/{id}/`.
- Há 336 artigos antigos, importados do WordPress.
- O HTML dos artigos é limpo com `sanitizeContentHtml` (`src/lib/html.ts`).
- A gravação pelo back-office está em `savePostAction` (`src/lib/admin/content-actions.ts`): valida o título, evita endereços repetidos e não deixa um artigo usar o endereço de uma página.

**Padrões a seguir:**
- Endpoint protegido por segredo: `src/app/api/cron/daily/route.ts` (cabeçalho com `timingSafeEqual`).
- Emails editáveis: `src/lib/email/defaults.ts`; `notifyAdmins` em `src/lib/email/send.ts`.
- Credenciais no Google Cloud: o script `deploy/gcp-google-login.sh` guarda segredos no Secret Manager e liga-os aos serviços com `--update-secrets`. O `deploy/gcp-setup.sh` mantém-nos nos deploys seguintes (ver a variável `GOOGLE_LOGIN`). Faz igual para o segredo novo.
- Eu peço ao Claude no Chrome para fazer o que é na consola do Google Cloud. Dá-me o texto pronto a colar, no estilo de `docs/PROMPT_CHROME_GOOGLE.md`.
- **Nunca peças passwords ou chaves no chat.** Segredos vão para o Secret Manager ou para as variáveis do ambiente.

## Parte A — Preparação (uma vez)

### A1. "Porta" para rascunhos no site (código)
Uma API pequena, protegida por uma chave (`BLOG_API_TOKEN`, no cabeçalho `Authorization: Bearer …`, comparada com `timingSafeEqual`). Recusa tudo se a chave não estiver definida.

**`GET /api/blog/contexto/`** devolve o que é preciso para escrever sem erros:
- os títulos e endereços de todos os artigos, para não repetir temas;
- as palavras-chave já usadas;
- as categorias, com nome e `/listing-category/{slug}/`;
- os distritos, com `/listing-location/{distrito}/`;
- as páginas úteis: `/all-ads/`, `/post-an-ad/`, `/blog/`, `/faq/`, `/como-vender-o-seu-negocio/`.

**`POST /api/blog/rascunhos/`** cria **só rascunhos** (nunca publica). Recebe JSON com:
- `keyword`, `title`, `slug`, `seoTitle` (até 60 caracteres), `seoDescription` (até 155), `excerpt`, `contentHtml`, `tags`.

Regras do `POST`:
- valida tudo, limpa o HTML com `sanitizeContentHtml` e recusa endereços repetidos (de artigos ou de páginas);
- recusa ligações internas que não existam;
- guarda a palavra-chave numa coluna nova `posts.seo_keyword`, com uma migração Drizzle;
- limita os pedidos (`rateLimit`);
- regista na auditoria;
- envia à equipa um email novo e editável, "Rascunho de artigo pronto para rever", com o link `/admin/blog/{id}/`;
- devolve `{ id, editUrl }`.

**Back-office:** na lista do blog, mostrar a etiqueta "Automático" nos rascunhos criados pela API.

**Testes:** unitários e um e2e. Depois envia para `dev` e dá-me os passos para eu testar.

### A2. A chave no Google Cloud
1. Cria `deploy/gcp-blog-token.sh` (como o `gcp-google-login.sh`):
   - gera uma chave aleatória;
   - guarda-a no Secret Manager como `pdt-blog-api-token`;
   - liga-a ao dev e à produção com `--update-secrets=BLOG_API_TOKEN=…`;
   - no fim mostra **uma vez** a chave, para eu a pôr no ambiente do Claude Code.
2. Atualiza o `gcp-setup.sh` para manter este segredo.
3. Dá-me o prompt para o Claude no Chrome correr o script no Cloud Shell.
4. Diz-me exatamente onde pôr a chave: nas definições do ambiente do Claude Code, como variável `PDT_BLOG_TOKEN`, que só a tarefa agendada lê.

### A3. Tarefa agendada
1. Depois de eu confirmar que o rascunho de teste chegou ao back-office, cria a **tarefa agendada**:
   - uma sessão nova a cada execução, neste ambiente;
   - de 2 em 2 dias, às 7h23 de Lisboa: `CRON_TZ=Europe/Lisbon 23 7 */2 * *`;
   - com o texto da Parte B.
2. Antes de agendar, faz **um artigo de teste** com a primeira palavra-chave, para eu ver a qualidade.

## Parte B — Texto da tarefa agendada (de 2 em 2 dias)

> Escreve o próximo artigo de blog do Portal do Trespasse (https://portaldotrespasse.pt), em português de Portugal.
>
> **1. Palavras-chave.** Descarrega o CSV:
> `https://docs.google.com/spreadsheets/d/1OKE5Df8Hi2Qm6NcShIU_Cd-BhypBBxtUL8hmzSHPqCA/export?format=csv`
>
> **2. Contexto do site.** Lê `GET https://portaldotrespasse.pt/api/blog/contexto/`, com o cabeçalho `Authorization: Bearer $PDT_BLOG_TOKEN`.
>
> **3. Escolher a palavra-chave.** É a primeira da folha que ainda não está em "palavras-chave já usadas". Se a folha tiver colunas de prioridade, estado ou notas, respeita-as. Se o tema já estiver bem coberto por um artigo existente, escolhe a seguinte e diz porquê no resumo.
>
> **4. Pesquisar.** Pesquisa na web o que as pessoas procuram com esta palavra-chave em Portugal.
> - Factos legais, fiscais ou de licenciamento (contrato de trespasse, impostos, licenças, arrendamento) só de fontes oficiais: portaldasfinancas.gov.pt, diariodarepublica.pt, eportugal.gov.pt, iapmei.pt, ine.pt, ou o site da câmara municipal.
> - Na dúvida, não ponhas números, prazos ou valores.
> - Nunca inventes estatísticas, casos ou citações.
>
> **5. Escrever.**
> - **Título:** inclui a palavra-chave e não pode ser igual a títulos que já existem.
> - **Título para o Google:** até 60 caracteres. **Descrição:** até 155, com a palavra-chave e um motivo para clicar.
> - **Endereço:** curto, sem acentos, com a palavra-chave.
> - **Tamanho:** 1200 a 1600 palavras, em HTML simples (`<p>`, `<h2>`, `<h3>`, `<ul>`, `<ol>`, `<strong>`, `<a>`), sem `<h1>`.
> - **Estrutura:**
>   - uma introdução que responde logo à pergunta de quem pesquisa;
>   - 4 a 7 secções `<h2>`;
>   - exemplos práticos de negócios em Portugal: cafés, restaurantes, lojas, clínicas, cabeleireiros;
>   - uma secção "Perguntas frequentes", com 3 a 5 perguntas reais em `<h3>` e respostas curtas;
>   - uma conclusão com convite a ver anúncios (`/all-ads/`) ou a publicar o anúncio grátis (`/post-an-ad/`).
> - **Ligações internas:** 3 a 6, só para endereços que vieram do contexto (categorias, distritos, artigos relacionados, páginas úteis).
> - **Ligações externas:** no máximo 2, para fontes oficiais.
> - **Tom:** próximo mas profissional, "você" e não "tu", frases curtas, português de Portugal ("contrato", "renda", "trespasse"; nunca "aluguel").
> - **Palavra-chave:** natural no título, na introdução, num `<h2>` e na conclusão, sem a repetir à força.
> - **Também:** `excerpt` com 1 a 2 frases e 2 a 4 `tags`.
>
> **6. Rever antes de enviar.**
> - Lê o artigo como um revisor.
> - Corta repetições, confirma os factos com as fontes e verifica que todas as ligações internas estão na lista do contexto.
> - Confirma os limites de caracteres.
>
> **7. Enviar como rascunho.** Faz `POST https://portaldotrespasse.pt/api/blog/rascunhos/` com o mesmo cabeçalho e o JSON (`keyword`, `title`, `slug`, `seoTitle`, `seoDescription`, `excerpt`, `contentHtml`, `tags`).
> - Se o site recusar (ex.: endereço repetido), corrige e tenta outra vez, no máximo 2 vezes.
> - Nunca publiques: só rascunhos.
>
> **8. Terminar com um resumo curto:** palavra-chave, título, link de edição (`editUrl`), fontes usadas, e qualquer coisa que eu deva verificar à mão.
>
> **Se algo falhar** (folha inacessível, chave em falta, site em baixo): não inventes nem tentes outra via; termina com o erro exato.

## Decisões já tomadas
- **Rascunho para rever**, não publicação automática. O Google penaliza texto automático publicado sem revisão, e um erro sobre impostos ou contratos prejudica o portal.
- **Sem imagem de destaque automática** por agora: escolho-a ao rever.
- **Assinatura:** "Equipa Portal do Trespasse".
- **Custo:** corre no meu plano do Claude, sem conta da API à parte.
