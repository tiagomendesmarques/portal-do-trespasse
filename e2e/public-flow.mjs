// Teste end-to-end das páginas públicas. Uso: node e2e/public-flow.mjs http://localhost:3100
// Precisa da base de dados com os anúncios importados e SITE_ENV=development (caixa /dev/emails/).
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright");
const BASE = process.argv[2] ?? "http://localhost:3100";
const SLUG = "trespasse-clinica-desde-2012-loja-online";
const results = [];
const check = (name, cond, extra = "") => results.push([cond ? "OK  " : "FAIL", name, extra]);

const browser = await browserLaunch();
async function browserLaunch() { return chromium.launch(); }
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const prices = async () =>
  (await page.locator("article [data-price]").evaluateAll((els) => els.map((e) => e.getAttribute("data-price")))).map((v) => (v ? Number(v) : Infinity));
async function submitAndWait(action) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), action()]);
  await page.waitForTimeout(400);
}

// 1. Pesquisa na página inicial, sem acentos
await page.goto(`${BASE}/`);
await page.fill('input[name="q"]', "cafe");
await page.getByRole("button", { name: "Procurar" }).click();
await page.waitForURL(/all-ads\/\?q=cafe/);
const count = await page.locator("[aria-live=polite]").textContent();
check('pesquisa "cafe" encontra "café"', /de [1-9]\d* an/.test(count), count);

// 2. Distrito → concelho (o select de concelho atualiza e submete)
await page.goto(`${BASE}/all-ads/`);
await page.selectOption('select[name="distrito"]', "lisboa");
await page.waitForURL(/distrito=lisboa/);
check("filtro de distrito no URL", page.url().includes("distrito=lisboa"));
const concelhoOptions = await page.locator('select[name="concelho"] option').count();
check("concelhos do distrito disponíveis", concelhoOptions === 17, `${concelhoOptions - 1} concelhos`);
await page.selectOption('select[name="concelho"]', "sintra");
await page.waitForURL(/concelho=sintra/);
check("filtro de concelho", /A mostrar 1–3 de 3/.test(await page.locator("[aria-live=polite]").textContent()));

// 3. Ordenação por preço
await page.goto(`${BASE}/all-ads/`);
await page.selectOption('select[aria-label="Ordenar"]', "price-asc");
await page.waitForURL(/orderby=price-asc/);
const p = await prices();
check("ordenar por preço crescente", p.length > 1 && p.every((v, i) => i === 0 || p[i - 1] <= v), p.slice(0, 4).join(", "));

// 3b. Filtros rápidos ("Mostrar só") e "Mais filtros"
const total = async () => Number((await page.locator("[aria-live=polite]").textContent()).match(/de (\d+)/)?.[1] ?? 0);
await page.goto(`${BASE}/all-ads/`);
const all = await total();
check('"Mais filtros" começa fechado', !(await page.locator('input[name="renda-mensal_max"]').isVisible()) && (await page.locator("summary", { hasText: "Mais filtros" }).isVisible()));
check("esplanada só aparece em restauração/hotelaria", (await page.locator('input[name="esplanada"]').count()) === 0);
for (const [param, label, proof] of [["urgente", "Venda urgente", "Venda urgente"], ["negociavel", "Preço negociável", "Negociável"], ["fotos", "Com fotografias", null]]) {
  await page.goto(`${BASE}/all-ads/`);
  await page.getByLabel(label, { exact: true }).check();
  await page.waitForURL(new RegExp(`${param}=1`));
  const n = await total();
  let ok = n > 0 && n < all;
  if (ok && proof) {
    await page.locator("article a[href^='/listing/']").first().click();
    await page.waitForURL(/\/listing\//);
    ok = (await page.locator(`text=${proof}`).count()) > 0;
  }
  if (ok && param === "fotos") ok = (await page.locator("article img").count()) === (await page.locator("article").count());
  check(`filtro "${label}"`, ok, `${n} de ${all}`);
}
await page.goto(`${BASE}/all-ads/?urgente=1&negociavel=1&pagina=1`);
const both = await total();
await page.selectOption('select[name="categoria"]', "restauracao");
await page.waitForURL(/categoria=restauracao/);
check("filtros rápidos mantêm-se ao mudar de categoria", page.url().includes("urgente=1") && page.url().includes("negociavel=1") && (await total()) <= both);
check("esplanada aparece em restauração", await page.getByLabel("Com esplanada").isVisible());
await page.getByLabel("Com esplanada").check();
await page.waitForURL(/esplanada=1/);
await page.selectOption('select[name="categoria"]', "saude");
await page.waitForURL(/categoria=saude/);
{
  // O pedido ainda leva esplanada=1, mas fora de restauração/hotelaria é ignorado: mesmo resultado que sem ele.
  const n = await total();
  const gone = (await page.locator('input[name="esplanada"]').count()) === 0;
  await page.goto(`${BASE}/all-ads/?categoria=saude&urgente=1&negociavel=1`);
  check("esplanada deixa de contar noutra categoria", gone && n === (await total()));
}
await page.goto(`${BASE}/all-ads/?renda-mensal_max=900`);
check('"Mais filtros" abre quando está em uso', await page.locator('input[name="renda-mensal_max"]').isVisible());

// 4. Página do anúncio sem sessão
await page.goto(`${BASE}/listing/${SLUG}/`);
check("anúncio mostra o preço", (await page.locator("text=95.000 € >> visible=true").count()) >= 1);
check("telefone escondido sem sessão", await page.locator("text=Entre para ver o número").isVisible());
const ld = await page.locator('script[type="application/ld+json"]').textContent();
check("dados estruturados do anúncio", JSON.parse(ld)["@type"] === "Product" && JSON.parse(ld).offers?.price === 95000);
check("Open Graph com imagem", Boolean(await page.locator('meta[property="og:image"]').getAttribute("content")));
await page.getByRole("button", { name: "Foto seguinte" }).click();
check("galeria avança", (await page.locator("text=2 / 9").count()) === 1);
check("campo a zero não aparece", (await page.locator("text=sem termo").count()) === 0);

// 5. Criar conta e confirmar (para ver telefone e contactar)
const u = `visitante${Date.now() % 100000}`;
await page.goto(`${BASE}/my-account/?next=/listing/${SLUG}/`);
await page.fill("#reg-username", u);
await page.fill("#reg-email", `${u}@exemplo.pt`);
await page.fill("#reg-password", "segura-123");
await page.fill("#reg-password2", "segura-123");
await page.check('input[name="privacy"]');
await submitAndWait(() => page.getByRole("button", { name: "Criar conta" }).click());
await page.goto(`${BASE}/dev/emails/`);
const verify = (await page.locator('details[data-template="verify_email"] [data-email-text]').first().textContent()).match(/https?:\/\/\S+/)[0];
await page.goto(verify);
await page.goto(`${BASE}/listing/${SLUG}/`);

// 6. Telefone, mensagem, favoritos, denúncia
await page.getByRole("button", { name: /Mostrar número/ }).click();
await page.waitForSelector('a[href^="tel:"]');
check("telefone aparece com sessão", /\d{9}/.test((await page.locator('a[href^="tel:"]').textContent()).replace(/\s/g, "")));
await page.getByText("Enviar mensagem", { exact: true }).click();
await submitAndWait(() => page.getByRole("button", { name: "Enviar", exact: true }).click());
check("mensagem ao anunciante enviada", await page.locator("text=Mensagem enviada").isVisible());
await submitAndWait(() => page.getByRole("button", { name: /Guardar nos favoritos/ }).click());
check("guardar nos favoritos", (await page.getByRole("button", { name: /Guardado nos favoritos/ }).getAttribute("aria-pressed")) === "true");
await page.getByText("Denunciar abuso").click();
await page.fill("#report-reason", "Teste automático: anúncio de exemplo.");
await submitAndWait(() => page.getByRole("button", { name: "Enviar denúncia" }).click());
check("denúncia enviada", await page.locator("text=Obrigado. A equipa vai rever").isVisible());
await page.goto(`${BASE}/dev/emails/`);
check("email de contacto registado para o anunciante", (await page.locator('details[data-template="listing_contact"]').count()) >= 1);

// 7. Formulário de contactos do site
await page.goto(`${BASE}/contact/`);
await page.fill("#ct-name", "Visitante de teste");
await page.fill("#ct-email", "visitante@exemplo.pt");
await page.fill("#ct-message", "Olá, isto é um teste do formulário de contactos.");
await submitAndWait(() => page.getByRole("button", { name: "Enviar mensagem" }).click());
check("formulário de contactos", await page.locator("text=Mensagem enviada").isVisible());

// 8. Menu no telemóvel e páginas sem overflow horizontal
await page.setViewportSize({ width: 390, height: 844 });
await page.goto(`${BASE}/`);
await page.getByRole("button", { name: "Abrir menu" }).click();
check("menu de telemóvel abre", await page.locator("#menu-movel").isVisible());
for (const path of ["/", "/all-ads/", `/listing/${SLUG}/`, "/blog/", "/faq/", "/contact/"]) {
  await page.goto(BASE + path);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(`sem scroll horizontal em ${path}`, overflow <= 0, overflow > 0 ? `${overflow}px` : "");
}

// 9. SEO
const sm = await (await fetch(`${BASE}/sitemap.xml`)).text();
check("sitemap.xml com anúncios e artigos", sm.includes(`/listing/${SLUG}/`) && (sm.match(/<loc>/g) ?? []).length > 350, `${(sm.match(/<loc>/g) ?? []).length} URLs`);
check("sitemap_index.xml redireciona", (await fetch(`${BASE}/sitemap_index.xml`, { redirect: "manual" })).status === 308);

// Dados para o Google ("Fichas de comerciantes", "Fragmentos do produto"): um Product tem sempre imagem e oferta com preço.
{
  const html = await (await fetch(`${BASE}/all-ads/?pagina=1`)).text();
  const paths = [...new Set([...html.matchAll(/href="(\/listing\/[^"]+)"/g)].map((m) => m[1]))];
  let withProduct = 0;
  const bad = [];
  for (const path of paths) {
    const body = await (await fetch(`${BASE}${path}`)).text();
    for (const m of body.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      const ld = JSON.parse(m[1]);
      if (ld["@type"] !== "Product") continue;
      withProduct++;
      if (!Array.isArray(ld.image) || ld.image.length === 0 || !(ld.offers?.price > 0) || !ld.offers?.priceCurrency) bad.push(path);
    }
  }
  check("dados de produto para o Google têm sempre imagem e preço", bad.length === 0 && withProduct > 0, `${withProduct} com produto; incompletos: ${bad.join(", ")}`);
}
check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
