// Teste end-to-end da API de artigos (/api/v1/artigos/), com um banco de imagens falso.
// Uso: node e2e/api-artigos.mjs http://localhost:3100
// O site tem de arrancar com BLOG_API_TOKEN=teste-api-artigos-0123456789 e BLOG_IMAGE_TEST_ORIGIN=http://127.0.0.1:3198
// (SITE_ENV=development). Antes: npx tsx scripts/e2e-fixtures.ts (cria admin.teste).
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");
const BASE = process.argv[2] ?? "http://localhost:3100";
const IMG = "http://127.0.0.1:3198";
const TOKEN = "teste-api-artigos-0123456789";
const results = [];
const check = (name, cond, extra = "") => results.push([cond ? "OK  " : "FAIL", name, extra]);

// Banco de imagens falso (faz de Pexels).
const jpeg = (color) => sharp({ create: { width: 1600, height: 900, channels: 3, background: color } }).jpeg().toBuffer();
const photos = { "/destaque.jpg": await jpeg("#1b766f"), "/dentro.jpg": await jpeg("#f6c8a0") };
const imgServer = createServer((req, res) => {
  const body = photos[req.url];
  if (!body) { res.writeHead(200, { "Content-Type": "text/html" }); return res.end("<html>não sou imagem</html>"); }
  res.writeHead(200, { "Content-Type": "image/jpeg", "Content-Length": body.length });
  res.end(body);
});
await new Promise((r) => imgServer.listen(3198, "127.0.0.1", r));

const api = async (method, path, body, headers = {}) => {
  const res = await fetch(`${BASE}/api/v1/artigos/${path}`, {
    method, headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...headers }, body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const n = Date.now() % 100000;
const words = (k) => "palavra ".repeat(k);
const article = (title, extra = {}) => ({
  title, focusKeyword: "trespasse de café", secondaryKeywords: ["café à venda", "comprar café"],
  seoTitle: `Trespasse de café: guia ${n}`,
  seoDescription: "Tudo o que precisa de saber antes de um trespasse de café: contrato, licenças, renda e como avaliar o negócio com segurança.",
  excerpt: "Guia prático para quem quer comprar um café em Portugal.",
  contentHtml: [
    `<p>Um trespasse de café é uma das formas mais rápidas de ter o seu negócio. ${words(70)}</p>`,
    `<h2>Como funciona o trespasse de café</h2><p>${words(140)} trespasse de café</p><p>${words(140)}</p>`,
    `<h2>Contrato e renda</h2><p>Veja os <a href="/all-ads/">anúncios</a> e o <a href="https://www.portaldasfinancas.gov.pt/">Portal das Finanças</a>. ${words(140)}</p><p>${words(140)}</p>`,
    `<h2>Licenças</h2><p>Leia o <a href="/blog/">blog</a> e <a href="https://portaldotrespasse.pt/post-an-ad/">publique o seu anúncio</a>. ${words(140)} trespasse de café</p>`,
    `<p><img src="${IMG}/dentro.jpg" alt="Esplanada de um café"></p><h2>Conclusão</h2><p>${words(140)} trespasse de café</p>`,
  ].join(""),
  featuredImage: { url: `${IMG}/destaque.jpg`, alt: "Balcão de um café com máquina de expresso", caption: "Um café de bairro em Lisboa", credit: "Foto: Ana Silva / Pexels", creditUrl: "https://www.pexels.com/" },
  faq: [
    { question: "Quanto custa um trespasse de café?", answer: "Depende da localização, da faturação e do equipamento." },
    { question: "O que deve vir no contrato?", answer: "O valor, o que está incluído e a situação da renda." },
    { question: "Preciso de licença nova?", answer: "Confirme na câmara municipal se a licença passa para si." },
  ],
  sources: [{ title: "Portal das Finanças", url: "https://www.portaldasfinancas.gov.pt/" }],
  tags: ["trespasse", "café"],
  ...extra,
});

// 1. Chave
const noKey = await fetch(`${BASE}/api/v1/artigos/contexto/`);
check("sem chave: 401", noKey.status === 401);
const badKey = await api("GET", "contexto/", null, { Authorization: "Bearer errada-errada-errada-errada" });
check("chave errada: 401", badKey.status === 401);

// 2. Contexto
const ctx = await api("GET", "contexto/");
check("contexto: categorias, distritos, artigos e limites", ctx.status === 200 && ctx.json.categories?.length > 5 && ctx.json.distritos?.length >= 18 && ctx.json.posts?.length > 0 && ctx.json.limits?.seoTitleIdeal === 60, `${ctx.status}`);
const catUrl = ctx.json.categories?.[0]?.url;

// 3. Erros
const bad = await api("POST", "", { title: "Curto", focusKeyword: "x", contentHtml: "<p>pouco</p>" });
check("campos inválidos: 400 com detalhes", bad.status === 400 && bad.json.details?.length > 0);
const seoBad = await api("POST", "", article(`Artigo com erros ${n}`, { contentHtml: `<h1>Outro</h1>${article("x").contentHtml}<p><a href="/nao-existe-${n}/">x</a></p>` }));
check("erros de SEO: 422 com explicação", seoBad.status === 422 && seoBad.json.seo?.errors?.some((e) => e.includes("<h1>")) && seoBad.json.seo?.errors?.some((e) => e.includes(`/nao-existe-${n}/`)), JSON.stringify(seoBad.json.seo?.errors));
const noAlt = await api("POST", "", article(`Artigo sem alt ${n}`, { featuredImage: { url: `${IMG}/destaque.jpg`, alt: "" } }));
check("imagem sem texto alternativo: recusada", noAlt.status === 400 && JSON.stringify(noAlt.json.details).includes("alt"));
const foreign = await api("POST", "", article(`Imagem de fora ${n}`, { featuredImage: { url: "https://exemplo.com/foto.jpg", alt: "Uma foto qualquer de teste" } }));
check("imagem de outro sítio: recusada", foreign.status === 422 && /Pexels|Unsplash/.test(foreign.json.error ?? ""));

// 4. Criar e publicar
const title = `Trespasse de café: o guia completo ${n}`;
const created = await api("POST", "", article(title, { status: "published", contentHtml: article("x").contentHtml + (catUrl ? `<p>Veja a <a href="${catUrl}">categoria</a>.</p>` : "") }), { "Idempotency-Key": `teste-${n}` });
check("criar e publicar: 201", created.status === 201 && created.json.status === "published", `${created.status} ${created.json.error ?? ""}`);
check("pontuação SEO alta", created.json.seo?.score >= 85, `score ${created.json.seo?.score}: ${created.json.seo?.warnings?.join(" | ")}`);
const id = created.json.id;
const slug = created.json.slug;

// 5. Página pública
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${BASE}/${slug}/`);
check("página pública com o título (h1)", (await page.locator("h1", { hasText: title }).count()) === 1);
check("imagem de destaque com alt", (await page.locator('figure img[alt="Balcão de um café com máquina de expresso"]').count()) === 1);
check("legenda e crédito do fotógrafo", (await page.locator("figcaption", { hasText: "Foto: Ana Silva / Pexels" }).count()) === 1);
check("imagem copiada para o site (WebP)", ((await page.locator("figure img").getAttribute("src")) ?? "").startsWith("/media/blog/api/"));
check("imagem dentro do texto copiada, com alt e srcset", (await page.locator('.prose-content img[alt="Esplanada de um café"][srcset]').count()) === 1 && ((await page.locator(".prose-content img").getAttribute("src")) ?? "").startsWith("/media/"));
check("perguntas frequentes no fim", (await page.locator("#faq-artigo").count()) === 1 && (await page.locator("section details").count()) === 3);
check("fontes", (await page.locator('section[aria-labelledby="fontes-artigo"] a', { hasText: "Portal das Finanças" }).count()) === 1);
const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
check("dados estruturados: BlogPosting e FAQPage", ld.some((t) => t.includes('"BlogPosting"') && t.includes("trespasse de café")) && ld.some((t) => t.includes('"FAQPage"')));
check("título e descrição para o Google", (await page.title()).startsWith(`Trespasse de café: guia ${n}`) && ((await page.locator('meta[name="description"]').getAttribute("content")) ?? "").startsWith("Tudo o que precisa"));
check("imagem para redes sociais (og:image e twitter)", ((await page.locator('meta[property="og:image"]').getAttribute("content")) ?? "").startsWith("http") && (await page.locator('meta[name="twitter:card"][content="summary_large_image"]').count()) === 1);

// 6. Reenviar não duplica; mesmo endereço é recusado
const replay = await api("POST", "", article(title, { status: "published" }), { "Idempotency-Key": `teste-${n}` });
check("reenviar com a mesma Idempotency-Key: mesmo artigo", replay.status === 200 && replay.json.id === id && replay.json.idempotentReplay === true);
const dup = await api("POST", "", article(title));
check("mesmo endereço: 409 com o id existente", dup.status === 409 && dup.json.existingId === id);

// 7. Ler e corrigir
const got = await api("GET", `${id}/`);
check("GET com pontuação SEO", got.status === 200 && typeof got.json.seo?.score === "number");
const patched = await api("PATCH", `${id}/`, { title: `Trespasse de café: guia atualizado ${n}`, slug: `trespasse-de-cafe-guia-${n}` });
check("PATCH muda título e endereço", patched.status === 200 && patched.json.slug === `trespasse-de-cafe-guia-${n}`, `${patched.status} ${JSON.stringify(patched.json.seo?.errors ?? patched.json.error)}`);
const old = await fetch(`${BASE}/${slug}/`, { redirect: "manual" });
// 308 = redirect permanente moderno (o Google trata-o como um 301).
check("endereço antigo redireciona (permanente)", [301, 308].includes(old.status) && (old.headers.get("location") ?? "").includes(`trespasse-de-cafe-guia-${n}`), `${old.status} ${old.headers.get("location")}`);
const manualPost = ctx.json.posts?.[0]?.url;
const listed = await api("GET", "");
check("lista dos artigos da API", listed.status === 200 && listed.json.articles?.some((a) => a.id === id));
const foreignPatch = await (async () => {
  // um artigo antigo (importado do WordPress) não pode ser alterado pela API
  const r = await fetch(`${BASE}/api/v1/artigos/1/`, { method: "PATCH", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ title: "Não devia mudar nada aqui" }) });
  return r.status;
})();
check("artigos feitos no back-office não se mexem pela API", foreignPatch === 403 || foreignPatch === 404, `${foreignPatch} (${manualPost})`);

// 8. Rascunho não é público
const draft = await api("POST", "", article(`Rascunho de teste ${n}`));
check("rascunho criado", draft.status === 201 && draft.json.status === "draft");
check("rascunho não é público", (await fetch(`${BASE}/${draft.json.slug}/`)).status === 404);

// 9. Back-office
const adm = await browser.newPage();
await adm.goto(`${BASE}/my-account/`);
await adm.fill("#login-identifier", "admin.teste");
await adm.fill("#login-password", "admin-teste-123");
await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST"), adm.getByRole("button", { name: "Entrar", exact: true }).click()]);
await adm.waitForTimeout(400);
await adm.goto(`${BASE}/admin/blog/?q=${n}`);
check("lista do blog marca 'Via API'", (await adm.locator("tr", { hasText: `Rascunho de teste ${n}` }).locator("text=Via API").count()) === 1);
await adm.goto(`${BASE}/admin/blog/${id}/`);
check("edição mostra a pontuação SEO", Number(await adm.locator('[data-testid="seo-score"]').textContent().then((t) => t.replace("/100", ""))) >= 80);
check("edição mostra as 3 perguntas e o alt", (await adm.locator('input[value="Quanto custa um trespasse de café?"]').count()) === 1 && (await adm.inputValue('input[name="featuredImageAlt"]')) === "Balcão de um café com máquina de expresso");
await adm.goto(`${BASE}/dev/emails/`);
check("equipa avisada por email", (await adm.locator('details[data-template="admin_post_api"]', { hasText: `${n}` }).count()) >= 2);

// 10. Artigo feito à mão com perguntas frequentes (editor do back-office)
await adm.goto(`${BASE}/admin/blog/novo/`);
await adm.fill('input[name="title"]', `Artigo à mão com perguntas ${n}`);
await adm.fill('textarea[name="contentHtml"]', `<p>Texto do artigo feito no back-office. ${words(40)}</p>`);
await adm.getByRole("button", { name: "Acrescentar pergunta" }).click();
await adm.getByLabel("Pergunta 1").fill("Posso editar estas perguntas?");
await adm.getByLabel("Resposta").fill("Sim, no back-office, artigo a artigo.");
await adm.fill('textarea[name="sources"]', "Diário da República | https://diariodarepublica.pt/");
await adm.selectOption('select[name="status"]', "published");
await Promise.all([adm.waitForResponse((r) => r.request().method() === "POST"), adm.getByRole("button", { name: "Guardar", exact: true }).click()]);
await adm.waitForURL(/criado=1/);
await page.goto(`${BASE}/artigo-a-mao-com-perguntas-${n}/`);
check("pergunta feita à mão aparece no artigo", (await page.locator("#faq-artigo").count()) === 1 && (await page.locator("summary", { hasText: "Posso editar estas perguntas?" }).count()) === 1);
check("fonte feita à mão aparece", (await page.locator('section[aria-labelledby="fontes-artigo"] a', { hasText: "Diário da República" }).count()) === 1);

// 11. Apagar no back-office (publicado → endereço leva ao blog)
await adm.goto(`${BASE}/admin/blog/${id}/`);
await adm.locator("summary", { hasText: "Apagar artigo" }).click();
await adm.locator("details[open] form input[name=confirm]").check();
await Promise.all([adm.waitForURL(/apagado=1/), adm.locator("details[open] form").getByRole("button", { name: "Confirmar" }).click()]);
const gone = await fetch(`${BASE}/trespasse-de-cafe-guia-${n}/`, { redirect: "manual" });
check("artigo apagado: endereço redireciona para o blog", [301, 308].includes(gone.status) && (gone.headers.get("location") ?? "").endsWith("/blog/"), `${gone.status} ${gone.headers.get("location")}`);

await browser.close();
imgServer.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
