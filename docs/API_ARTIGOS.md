# API de artigos do Portal do Trespasse

Para criar, corrigir e publicar artigos do blog a partir de outro programa (ex.: uma tarefa agendada do Claude).

- **Endereços:**
  - produção: `https://portaldotrespasse.pt/api/v1/artigos/`
  - testes: `https://dev.portaldotrespasse.pt/api/v1/artigos/`
  - Os endereços terminam sempre em `/`.
- **Chave:** cabeçalho `Authorization: Bearer <chave>`. A chave está no Secret Manager (`pdt-blog-api-token`); ver `deploy/gcp-blog-api.sh`. Sem chave, a resposta é `401`.
- **Formato:** JSON (`Content-Type: application/json`), até 1 MB por pedido, 300 pedidos por hora.
- **Respostas de erro:** `{ "error": "…", "details": [...] }` ou `{ "error": "…", "seo": {...} }`, com mensagens em português.

## Pedidos

| Pedido | Para quê | Respostas |
|---|---|---|
| `GET /api/v1/artigos/contexto/` | O que é preciso antes de escrever (ver abaixo) | 200 |
| `POST /api/v1/artigos/` | Criar um artigo | 201 criado · 200 já existia (mesma `Idempotency-Key`) · 400 campos inválidos · 409 endereço em uso · 422 erros de SEO ou de imagem |
| `GET /api/v1/artigos/` | Os últimos 50 artigos criados pela API | 200 |
| `GET /api/v1/artigos/{id}/` | Um artigo, com a pontuação SEO atual | 200 · 404 |
| `PATCH /api/v1/artigos/{id}/` | Corrigir ou publicar um artigo criado pela API; só muda os campos enviados | 200 · 400 · 403 (artigo feito no back-office) · 404 · 409 · 422 |

Não há pedido para apagar: apaga-se no back-office (Blog → artigo → "Apagar artigo"). Se o artigo estava publicado, o endereço passa a levar ao `/blog/`.

### `GET /contexto/`
```json
{
  "usedKeywords": ["trespasse de café", "..."],
  "posts": [{ "title": "...", "url": "/como-avaliar-um-negocio/", "focusKeyword": "..." }],
  "categories": [{ "name": "Restauração", "url": "/listing-category/restauracao/" }],
  "distritos": [{ "name": "Lisboa", "url": "/listing-location/lisboa/" }],
  "pages": [{ "title": "FAQ", "url": "/faq/" }],
  "usefulLinks": [{ "title": "Publicar anúncio (grátis)", "url": "/post-an-ad/" }],
  "imageHosts": { "images.pexels.com": "copiada para o site", "images.unsplash.com": "fica no Unsplash (creditar o fotógrafo)" },
  "limits": { "seoTitleIdeal": 60, "seoTitleMax": 70, "seoDescriptionMin": 70, "seoDescriptionIdeal": 155, "seoDescriptionMax": 170, "minWords": 300 }
}
```

As ligações internas de um artigo só podem apontar para endereços que existam no site. Os da lista acima existem todos; também são aceites anúncios (`/listing/…/`) e concelhos (`/listing-location/distrito/concelho/`).

## Campos de um artigo

| Campo | Obrigatório no POST | Regras |
|---|---|---|
| `title` | sim | 10 a 100 caracteres. É o `<h1>` da página. |
| `focusKeyword` | sim | A palavra-chave principal (2 a 100 caracteres). |
| `contentHtml` | sim | HTML simples: `<p> <h2> <h3> <ul> <ol> <li> <strong> <em> <a> <img> <blockquote> <table>`. **Sem `<h1>`.** Mínimo 300 palavras. Cada `<img>` precisa de `alt`. |
| `slug` | não | Endereço (`/slug/`). Vazio = gerado do título. |
| `status` | não | `"draft"` (por omissão) ou `"published"`. |
| `secondaryKeywords` | não | Até 10. |
| `seoTitle` | não | Título para o Google: ideal 30 a 60 caracteres, máximo 70. Vazio = `title`. |
| `seoDescription` | não | Descrição para o Google: ideal 70 a 155, máximo 170. |
| `excerpt` | não | Resumo para a lista do blog (até 300). Vazio = início do texto. |
| `featuredImage` | não | `{ "url", "alt", "caption"?, "credit"?, "creditUrl"? }`. `alt` obrigatório (5 a 200). Só `images.pexels.com` ou `images.unsplash.com`. No PATCH, `null` tira a imagem. |
| `faq` | não | `[{ "question", "answer" }]`, até 15. Aparecem no fim do artigo e nos dados estruturados `FAQPage`. |
| `sources` | não | `[{ "title", "url" }]`, até 15. Secção "Fontes" no fim do artigo. |
| `tags` | não | Até 10 etiquetas. |

Campos desconhecidos são recusados (`400`), para apanhar erros de escrita.

**Imagens.**
- **Pexels** (`images.pexels.com`): o site descarrega e guarda uma cópia em WebP (400, 800 e 1600 px).
- **Unsplash** (`images.unsplash.com`): fica nos servidores do Unsplash, como as regras da API deles exigem, e o site pede-lhes os tamanhos.
- **Créditos:** em `credit` e `creditUrl`, por exemplo `"Foto: Ana Silva / Pexels"` com o link do fotógrafo.
- **Unsplash, obrigação de quem usa a API deles:** chamar o `links.download_location` da foto quando a usa.
- **Imagens dentro do texto** (`<img src="https://images.pexels.com/…" alt="…">`) seguem as mesmas regras.

**Cabeçalho `Idempotency-Key`** (opcional, no POST): se o mesmo pedido for repetido com a mesma chave (ex.: depois de uma falha de rede), devolve o artigo já criado em vez de criar outro.

## Pontuação SEO

Cada resposta traz `seo` com `score`, `errors`, `warnings` e `stats`:
- `score`: 0 a 100.
- `errors`: impedem gravar; a resposta é `422` e nada fica guardado.
- `warnings`: baixam a nota.
- `stats`: palavras, intertítulos, ligações, imagens, perguntas.

O que conta para a nota:
- palavra-chave no título, no título para o Google, na descrição, no endereço, no primeiro parágrafo e num `<h2>`;
- densidade da palavra-chave entre 0,5% e 2,5%;
- tamanhos do título e da descrição para o Google;
- 900 palavras ou mais (melhor com 1200);
- 3 ou mais `<h2>`;
- 3 ou mais ligações internas;
- 1 ou mais ligações externas;
- imagem de destaque com alt;
- 3 ou mais perguntas frequentes;
- resumo;
- parágrafos até 150 palavras.

O mesmo painel aparece no back-office, ao editar qualquer artigo.

## O que o site gera sozinho
- `<title>` e `<meta name="description">`, `canonical`, `keywords`.
- Open Graph (`og:image` com `alt`, datas e etiquetas) e Twitter `summary_large_image`.
- Dados estruturados `BlogPosting` (título, descrição, imagem, palavras-chave, datas, autor "Equipa Portal do Trespasse", editor com logótipo) e `FAQPage`.
- Imagem com `alt`, legenda e crédito, em vários tamanhos (`srcset`).
- Entrada no `sitemap.xml`.
- Mudar o endereço de um artigo publicado cria um redirect permanente.
- Email à equipa quando chega um artigo ou quando é publicado.

## Exemplo
```bash
curl -sS -X POST https://dev.portaldotrespasse.pt/api/v1/artigos/ \
  -H "Authorization: Bearer $PDT_BLOG_TOKEN" -H "Content-Type: application/json" \
  -H "Idempotency-Key: trespasse-de-cafe-2026-11-03" \
  -d '{
    "title": "Trespasse de café: o que verificar antes de comprar",
    "focusKeyword": "trespasse de café",
    "secondaryKeywords": ["café à venda", "comprar café"],
    "seoTitle": "Trespasse de café: 7 coisas a verificar antes",
    "seoDescription": "Contrato, renda, licenças e faturação: o que confirmar antes de um trespasse de café para não ter surpresas depois da compra.",
    "excerpt": "Os pontos a confirmar antes de assinar um trespasse de café.",
    "contentHtml": "<p>Um trespasse de café …</p><h2>…</h2><p>…</p>",
    "featuredImage": { "url": "https://images.pexels.com/photos/302899/pexels-photo-302899.jpeg?auto=compress&cs=tinysrgb&w=1600", "alt": "Balcão de um café com máquina de expresso", "credit": "Foto: Nome do fotógrafo / Pexels", "creditUrl": "https://www.pexels.com/@fotografo" },
    "faq": [{ "question": "Quanto custa um trespasse de café?", "answer": "…" }],
    "sources": [{ "title": "Portal das Finanças", "url": "https://www.portaldasfinancas.gov.pt/" }],
    "tags": ["trespasse", "café"],
    "status": "draft"
  }'
```
Resposta (`201`):
```json
{ "id": 412, "status": "draft", "slug": "trespasse-de-cafe-o-que-verificar-antes-de-comprar",
  "url": "https://dev.portaldotrespasse.pt/trespasse-de-cafe-o-que-verificar-antes-de-comprar/",
  "editUrl": "https://dev.portaldotrespasse.pt/admin/blog/412/",
  "seo": { "score": 91, "errors": [], "warnings": ["…"], "stats": { "words": 1340, "h2": 6, "internalLinks": 4, "externalLinks": 1, "images": 1, "faq": 4, "keywordDensity": 1.1 } } }
```
Publicar depois: `PATCH /api/v1/artigos/412/` com `{ "status": "published" }`.

## Testes
`node e2e/api-artigos.mjs http://localhost:3100` (35 verificações, com um banco de imagens falso; ver o topo do ficheiro).
