// Teste end-to-end da área do anunciante. Uso: node e2e/advertiser-flow.mjs http://localhost:3100
// Precisa de SITE_ENV=development (caixa /dev/emails/) e de `npx tsx scripts/e2e-fixtures.ts` antes (limites de tentativas).
import { mkdtempSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");
const BASE = process.argv[2] ?? "http://localhost:3100";
const results = [];
const check = (name, cond, extra = "") => results.push([cond ? "OK  " : "FAIL", name, extra]);

// Fotografias de teste geradas na hora + um ficheiro falso com extensão .jpg.
const dir = mkdtempSync(join(tmpdir(), "pdt-e2e-"));
const photo = async (name, color) => {
  const p = join(dir, name);
  await sharp({ create: { width: 1200, height: 900, channels: 3, background: color } }).jpeg().toFile(p);
  return p;
};
const fotoA = await photo("fachada.jpg", "#1b766f");
const fotoB = await photo("interior.jpg", "#f6c8a0");
const fake = join(dir, "virus.jpg");
writeFileSync(fake, "isto não é uma imagem");

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
async function submit(button) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(400);
}
const emailLink = async (template) => {
  await page.goto(`${BASE}/dev/emails/`);
  return (await page.locator(`details[data-template="${template}"] [data-email-text]`).first().textContent()).match(/https?:\/\/\S+/)?.[0];
};

// 1. Conta nova e confirmada
const u = `anunciante${Date.now() % 100000}`;
await page.goto(`${BASE}/my-account/`);
await page.fill("#reg-username", u);
await page.fill("#reg-email", `${u}@exemplo.pt`);
await page.fill("#reg-password", "segura-123");
await page.fill("#reg-password2", "segura-123");
await page.check('input[name="privacy"]');
await submit(page.getByRole("button", { name: "Criar conta" }));
await page.goto(await emailLink("verify_email"));
check("conta criada e confirmada", await page.locator("text=Email confirmado").isVisible());

// 2. Rascunho guardado no browser
await page.goto(`${BASE}/post-an-ad/`);
await page.getByRole("button", { name: /Trespasse/ }).first().click();
await page.getByRole("button", { name: "Restauração" }).click();
await page.fill('input[name="title"]', "Rascunho por acabar");
await page.waitForTimeout(900);
await page.reload();
check("rascunho encontrado ao voltar", await page.locator("text=Tem um anúncio por terminar").isVisible());
await page.getByRole("button", { name: "Continuar rascunho" }).click();
check("rascunho recuperado", (await page.inputValue('input[name="title"]')) === "Rascunho por acabar");

// 3. Enviar vazio mostra erros, incluindo campos obrigatórios herdados do WordPress
await page.fill('input[name="title"]', "");
await submit(page.getByRole("button", { name: "Publicar anúncio" }));
const errs = await page.locator(".err").allTextContents();
check("formulário vazio mostra erros", errs.length >= 6, `${errs.length} erros`);
check("campos novos não são obrigatórios", !(await page.locator('[data-error] >> text=Área (m²)').count()));

// 4. Preencher
await page.fill('input[name="title"]', "Café com esplanada em Almada");
await page.selectOption('select[name="priceType"]', "negotiable");
await page.fill('input[name="price"]', "45.000");
await page.fill('textarea[name="description"]', "Café de bairro com clientela fixa há 12 anos.\n\n- Esplanada com 20 lugares\n- Cozinha equipada\n\nVenda por reforma do proprietário.");
await page.check('input[name="f:negocio-sazonal"][value="nao"]');
await page.check('input[name="f:tipo-de-negocio"][value="b2c"]');
await page.check('input[name="f:depende-fornecedores"][value="sim"]');
await page.check('input[name="f:presenca"][value="espaco-fisico"]');
check("anos de contrato escondido antes de escolher arrendado", (await page.locator('input[name="f:contrato-anos"]').count()) === 0);
await page.check('input[name="f:situacao-imovel"][value="arrendado"]');
check("anos de contrato aparece com imóvel arrendado", (await page.locator('input[name="f:contrato-anos"]').count()) === 1);
await page.fill('input[name="f:contrato-anos"]', "5");
await page.fill('input[name="f:area-m2"]', "120");
await page.selectOption('select[name="f:motivo-venda"]', "reforma");
await page.fill('input[name="f:renda-mensal"]', "800");
await page.fill('textarea[name="features"]', "Clientela fixa\nLicenças em dia");

// Fotografias: duas válidas e uma falsa
const fileInput = page.locator('input[type="file"]');
await fileInput.setInputFiles([fotoA, fotoB]);
await page.waitForFunction(() => document.querySelectorAll('input[name="images"]').length === 2, null, { timeout: 30000 });
await fileInput.setInputFiles([fake]);
await page.waitForSelector("text=Formato não suportado");
check("ficheiro falso recusado", true);
check("duas fotografias carregadas", (await page.locator('input[name="images"]').count()) === 2);
const firstBefore = await page.locator('input[name="images"]').first().inputValue();
await page.getByRole("button", { name: "Capa" }).first().click();
const firstAfter = await page.locator('input[name="images"]').first().inputValue();
check("mudar a foto de capa", firstBefore !== firstAfter);

await page.locator("select").filter({ hasText: "Selecione o distrito" }).selectOption({ label: "Setúbal" });
await page.selectOption('select[name="locationId"]', { label: "Almada" });
await page.fill('input[name="phone"]', "912 345 678");
await submit(page.getByRole("button", { name: "Publicar anúncio" }));
check("anúncio enviado para aprovação", page.url().includes("/my-account/listings/?enviado=") && (await page.locator("text=À espera de aprovação").count()) >= 1, page.url());

// 5. Não é público enquanto está pendente
const listingHref = await page.locator('a[href^="/post-an-ad/editar/"]').first().getAttribute("href");
const editId = listingHref.match(/\d+/)[0];
const anon = await browser.newPage();
const slugRes = await anon.goto(`${BASE}/listing/cafe-com-esplanada-em-almada/`);
check("pendente não é visível ao público", slugRes.status() === 404);
await anon.close();
const owner = await page.goto(`${BASE}/listing/cafe-com-esplanada-em-almada/`);
check("dono vê o anúncio pendente com aviso", owner.status() === 200 && (await page.locator("text=aguarda aprovação").isVisible()));
check("visão geral agrupada com campos novos", (await page.locator("text=Espaço e imóvel").count()) === 1 && (await page.locator("text=Anos restantes do contrato").count()) === 1);
check("descrição com lista", (await page.locator(".prose-listing li").count()) === 2);

// 6. Emails
await page.goto(`${BASE}/dev/emails/`);
check("email 'anúncio recebido' ao anunciante", (await page.locator('details[data-template="listing_submitted"]').count()) >= 1);
check("aviso aos administradores", (await page.locator('details[data-template="admin_listing_pending"]').count()) >= 1);

// 7. Editar mantém fotos e campos
await page.goto(`${BASE}/post-an-ad/editar/${editId}/`);
check("edição traz os valores", (await page.inputValue('input[name="f:contrato-anos"]')) === "5" && (await page.locator('input[name="images"]').count()) === 2);
await page.fill('input[name="title"]', "Café com esplanada em Almada, 12 anos");
await submit(page.getByRole("button", { name: "Guardar alterações" }));
check("alterações guardadas", page.url().includes("editado=") && (await page.locator("text=Café com esplanada em Almada, 12 anos").count()) === 1);

// 8. Favoritos
await page.goto(`${BASE}/listing/trespasse-clinica-desde-2012-loja-online/`);
await submit(page.getByRole("button", { name: /Guardar nos favoritos/ }));
await page.goto(`${BASE}/my-account/favourites/`);
check("favorito aparece na conta", (await page.locator("text=Trespasse Clínica desde 2012").count()) >= 1);
await submit(page.getByRole("button", { name: "Remover dos favoritos" }));
check("remover favorito", (await page.locator("text=Ainda não guardou anúncios").count()) === 1);

// 9. Perfil e password
await page.goto(`${BASE}/my-account/edit-account/`);
await page.fill("#perfil-displayName", "a@b.pt");
await submit(page.getByRole("button", { name: "Guardar perfil" }));
check("nome público não pode ser email", await page.locator("text=não pode ser um email").isVisible());
await page.fill("#perfil-displayName", "Café do Zé");
await submit(page.getByRole("button", { name: "Guardar perfil" }));
check("perfil guardado", await page.locator("text=Perfil guardado").isVisible());
await page.fill("#pw-currentPassword", "errada-123");
await page.fill("#pw-newPassword", "nova-segura-789");
await page.fill("#pw-newPassword2", "nova-segura-789");
await submit(page.getByRole("button", { name: "Alterar password" }));
check("password atual errada é recusada", await page.locator("text=A password atual não está correta").isVisible());
await page.fill("#pw-currentPassword", "segura-123");
await page.fill("#pw-newPassword", "nova-segura-789");
await page.fill("#pw-newPassword2", "nova-segura-789");
await submit(page.getByRole("button", { name: "Alterar password" }));
check("password alterada", await page.locator("text=Password alterada").isVisible());

// 10. Apagar o anúncio e a conta
await page.goto(`${BASE}/my-account/listings/`);
await page.locator("summary", { hasText: "Apagar" }).first().click();
await page.locator('input[name="confirm"]').first().check();
await submit(page.getByRole("button", { name: "Apagar anúncio" }));
check("anúncio apagado", (await page.locator("text=Ainda não tem anúncios").count()) === 1);
await page.goto(`${BASE}/my-account/edit-account/`);
await page.locator("summary", { hasText: "Apagar conta" }).click();
await page.fill("#apagar-confirmText", "APAGAR");
await page.fill("#apagar-password", "nova-segura-789");
await submit(page.getByRole("button", { name: "Apagar a minha conta" }));
check("conta apagada e sessão terminada", new URL(page.url()).pathname === "/" && (await page.getByRole("link", { name: "Entrar" }).count()) >= 1, page.url());
await page.goto(`${BASE}/my-account/`);
await page.fill("#login-identifier", u);
await page.fill("#login-password", "nova-segura-789");
await submit(page.getByRole("button", { name: "Entrar", exact: true }));
check("conta apagada já não entra", await page.locator("text=incorretos").isVisible());

check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
