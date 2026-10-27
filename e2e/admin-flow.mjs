// Teste end-to-end do back-office. Uso: node e2e/admin-flow.mjs http://localhost:3100
// Precisa de SITE_ENV=development (caixa /dev/emails/) e de `npx tsx scripts/e2e-fixtures.ts` antes
// (cria o administrador admin.teste e limpa os limites de tentativas).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] ?? "http://localhost:3100";
const results = [];
const check = (name, cond, extra = "") => results.push([cond ? "OK  " : "FAIL", name, extra]);

const browser = await chromium.launch();
const errors = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
const adv = await newPage(); // anunciante
const adm = await newPage(); // administrador
const anon = await newPage(); // visitante

async function submit(page, button) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(400);
}
async function login(page, user, pass) {
  await page.goto(`${BASE}/my-account/`);
  await page.fill("#login-identifier", user);
  await page.fill("#login-password", pass);
  await submit(page, page.getByRole("button", { name: "Entrar", exact: true }));
}
const mailbox = async (template, text) => {
  await anon.goto(`${BASE}/dev/emails/`);
  return anon.locator(`details[data-template="${template}"]`, { hasText: text });
};
const status = async (path) => (await anon.request.get(`${BASE}${path}`, { maxRedirects: 0 })).status();
// Botão com confirmação (<details> + caixa "confirm").
async function confirmAction(page, label) {
  await page.locator("summary", { hasText: label }).first().click();
  const form = page.locator("details[open] form").first();
  await form.locator('input[name="confirm"]').check();
  await submit(page, form.getByRole("button", { name: "Confirmar" }));
}

// 1. Acesso ao back-office
await anon.goto(`${BASE}/admin/`);
check("visitante é mandado entrar", anon.url().includes("/my-account/?next=%2Fadmin%2F") || anon.url().includes("next=/admin/"), anon.url());

const n = Date.now() % 100000;
const u = `vendedor${n}`;
const title = `Pastelaria e2e ${n}`;
const slug = `pastelaria-e2e-${n}`;
await adv.goto(`${BASE}/my-account/`);
await adv.fill("#reg-username", u);
await adv.fill("#reg-email", `${u}@exemplo.pt`);
await adv.fill("#reg-password", "segura-123");
await adv.fill("#reg-password2", "segura-123");
await adv.check('input[name="privacy"]');
await submit(adv, adv.getByRole("button", { name: "Criar conta" }));
const verify = await (await mailbox("verify_email", "")).first().locator("[data-email-text]").textContent();
await adv.goto(verify.match(/https?:\/\/\S+/)[0]);
const r404 = await adv.goto(`${BASE}/admin/`);
check("anunciante não vê o back-office (404)", r404.status() === 404);

// 2. Anúncio novo fica pendente
await adv.goto(`${BASE}/post-an-ad/`);
await adv.getByRole("button", { name: /Trespasse/ }).first().click();
await adv.getByRole("button", { name: "Restauração" }).click();
await adv.fill('input[name="title"]', title);
await adv.fill('input[name="price"]', "30.000");
await adv.fill('textarea[name="description"]', "Pastelaria com fabrico próprio, clientela fixa e boa localização no centro.");
await adv.check('input[name="f:negocio-sazonal"][value="nao"]');
await adv.check('input[name="f:tipo-de-negocio"][value="b2c"]');
await adv.check('input[name="f:depende-fornecedores"][value="sim"]');
await adv.check('input[name="f:presenca"][value="espaco-fisico"]');
await adv.locator("select").filter({ hasText: "Selecione o distrito" }).selectOption({ label: "Porto" });
await adv.selectOption('select[name="locationId"]', { label: "Matosinhos" });
await adv.fill('input[name="phone"]', "913 222 111");
await submit(adv, adv.getByRole("button", { name: "Publicar anúncio" }));
check("anúncio enviado para aprovação", adv.url().includes("enviado="), adv.url());
const editHref = await adv.locator('a[href^="/post-an-ad/editar/"]').first().getAttribute("href");
const id = editHref.match(/\d+/)[0];

// 3. Administrador: painel e fila
await login(adm, "admin.teste", "admin-teste-123");
await adm.goto(`${BASE}/admin/`);
check("painel mostra o anúncio pendente", (await adm.locator(`text=${title}`).count()) >= 1);
await adm.goto(`${BASE}/admin/anuncios/?estado=pending`);
await adm.getByRole("link", { name: title }).first().click();
await adm.waitForURL(/\/admin\/anuncios\/\d+\/$/);
check("abre a ficha do anúncio", adm.url().includes(`/admin/anuncios/${id}/`), adm.url());

// 4. Rejeitar com motivo
await adm.locator("summary", { hasText: "Rejeitar" }).click();
await submit(adm, adm.getByRole("button", { name: "Rejeitar e avisar o anunciante" }));
check("rejeitar sem motivo pede o motivo", await adm.locator("text=Escolha um motivo").isVisible());
await adm.selectOption("#rej-preset", { index: 1 });
await adm.fill("#rej-reason", "Indique também a área da loja.");
await submit(adm, adm.getByRole("button", { name: "Rejeitar e avisar o anunciante" }));
check("anúncio rejeitado (motivo na ficha)", await adm.locator("text=Rejeitado:").isVisible());
check("email de rejeição com o motivo", (await (await mailbox("listing_rejected", title)).filter({ hasText: "área da loja" }).count()) >= 1);
await adv.goto(`${BASE}/my-account/listings/`);
check("anunciante vê o motivo", await adv.locator("text=Indique também a área da loja").isVisible());

// 5. Anunciante corrige; administrador aprova
await adv.goto(`${BASE}/post-an-ad/editar/${id}/`);
await adv.fill('input[name="f:area-m2"]', "85");
await submit(adv, adv.getByRole("button", { name: "Guardar alterações" }));
check("corrigido volta à fila", (await adv.locator("text=À espera de aprovação").count()) >= 1);
await adm.goto(`${BASE}/admin/anuncios/${id}/`);
await submit(adm, adm.getByRole("button", { name: "Aprovar e publicar" }));
check("aprovar volta à fila", adm.url().includes("aprovado=1"), adm.url());
check("email de publicação", (await (await mailbox("listing_published", title)).count()) >= 1);
check("anúncio público", (await status(`/listing/${slug}/`)) === 200);

// 6. Dono: vendido e disponível
await adv.goto(`${BASE}/my-account/listings/`);
await submit(adv, adv.getByRole("button", { name: "Marcar como vendido" }));
await anon.goto(`${BASE}/listing/${slug}/`);
check("vendido aparece no anúncio público", (await anon.locator("text=Vendido").count()) >= 1);
await submit(adv, adv.getByRole("button", { name: "Voltar a disponível" }));
check("voltou a disponível", (await adv.getByRole("button", { name: "Marcar como vendido" }).count()) === 1);

// 7. Ações da equipa
await adm.goto(`${BASE}/admin/anuncios/${id}/`);
const expBefore = await adm.locator("dt:has-text('Expira') + dd").textContent();
await submit(adm, adm.getByRole("button", { name: "Prolongar validade" }));
const expAfter = await adm.locator("dt:has-text('Expira') + dd").textContent();
check("prolongar validade muda a data", expBefore !== expAfter, `${expBefore} → ${expAfter}`);
await submit(adm, adm.getByRole("button", { name: "Destacar 30 dias" }));
check("destacar", await adm.locator("text=Destaque até").isVisible());
check("histórico regista as ações", (await adm.locator("text=Aprovou").count()) >= 1 && (await adm.locator("text=Destacou").count()) >= 1);

// 8. Denúncia
await anon.goto(`${BASE}/listing/${slug}/`);
await anon.locator("summary", { hasText: "Denunciar abuso" }).click();
await anon.fill("#report-reason", "O telefone não atende e parece falso.");
await submit(anon, anon.getByRole("button", { name: "Enviar denúncia" }));
check("denúncia enviada", await anon.locator("text=A equipa vai rever").isVisible());
check("aviso de denúncia à administração", (await (await mailbox("admin_report", title)).count()) >= 1);
await adm.goto(`${BASE}/admin/denuncias/`);
const reportRow = adm.locator("tr", { hasText: "parece falso" });
check("denúncia na lista", (await reportRow.count()) === 1);
await submit(adm, reportRow.getByRole("button", { name: "Sem problema" }));
check("denúncia resolvida", (await adm.locator("tr", { hasText: "parece falso" }).getByRole("button", { name: "Sem problema" }).count()) === 0);

// 9. Utilizadores: perfil de editor, bloquear, desbloquear
await adm.goto(`${BASE}/admin/utilizadores/?q=${u}`);
await adm.locator("tr", { hasText: `${u}@exemplo.pt` }).locator("a").first().click();
await adm.waitForURL(/\/admin\/utilizadores\/\d+\/$/);
const userUrl = adm.url();
await adm.selectOption("#role", "editor");
await submit(adm, adm.locator('form:has(#role)').getByRole("button", { name: "Guardar" }));
check("editor entra no back-office", (await adv.goto(`${BASE}/admin/`)).status() === 200);
check("editor não vê as definições", (await adv.goto(`${BASE}/admin/definicoes/`)).status() === 404);
await adm.goto(userUrl);
await adm.selectOption("#role", "user");
await submit(adm, adm.locator('form:has(#role)').getByRole("button", { name: "Guardar" }));
await confirmAction(adm, "Bloquear");
await adv.goto(`${BASE}/my-account/`);
check("bloquear termina a sessão", (await adv.locator("#login-identifier").count()) === 1);
check("bloquear tira os anúncios do ar", (await status(`/listing/${slug}/`)) === 404);
await login(adv, u, "segura-123");
check("bloqueado não consegue entrar", await adv.locator("text=Esta conta está bloqueada").isVisible());
await adm.goto(userUrl);
await submit(adm, adm.getByRole("button", { name: "Desbloquear" }));
await login(adv, u, "segura-123");
check("desbloqueado volta a entrar", (await adv.locator("#login-identifier").count()) === 0);

// 10. Modelos de email
await adm.goto(`${BASE}/admin/emails/listing_published/`);
const subject = adm.locator('input[name="subject"]');
await subject.fill(`${await subject.inputValue()} [e2e ${n}]`);
await submit(adm, adm.getByRole("button", { name: "Guardar e enviar teste para mim" }));
check("email de teste enviado", await adm.locator("text=Email de teste enviado").isVisible());
check("teste chega com o assunto novo", (await (await mailbox("listing_published", `[e2e ${n}]`)).count()) === 1);
await submit(adm, adm.getByRole("button", { name: "Repor texto original" }));
check("texto original reposto", !(await adm.locator('input[name="subject"]').inputValue()).includes("e2e"));

// 11. Definições
await adm.goto(`${BASE}/admin/definicoes/`);
await adm.fill("#listings\\.perPage", "12");
await submit(adm, adm.getByRole("button", { name: "Guardar definições" }));
check("definições guardadas", await adm.locator("text=Definições guardadas").isVisible());
await anon.goto(`${BASE}/all-ads/`);
const cards = await anon.locator("article").count();
check("anúncios por página passa a 12", cards === 12, `${cards} cartões`);
await adm.fill("#listings\\.perPage", "9");
await submit(adm, adm.getByRole("button", { name: "Guardar definições" }));

// 12. Tarefas diárias à mão
await submit(adm, adm.getByRole("button", { name: "Correr agora" }));
check("tarefas diárias correm e mostram o resultado", await adm.locator('[data-testid="cron-last-run"]').isVisible());

// 13. Redirects
await adm.goto(`${BASE}/admin/redirects/`);
await adm.fill('input[name="fromPath"]', `/e2e-antigo-${n}/`);
await adm.fill('input[name="toPath"]', "/all-ads/");
await submit(adm, adm.getByRole("button", { name: "Adicionar redirect" }));
await anon.goto(`${BASE}/e2e-antigo-${n}/`);
check("redirect novo funciona", new URL(anon.url()).pathname === "/all-ads/", anon.url());
await adm.goto(`${BASE}/admin/redirects/`);
const row = adm.locator("tr", { hasText: `/e2e-antigo-${n}/` });
await row.locator("summary", { hasText: "Apagar" }).click();
await row.locator('input[name="confirm"]').check();
await submit(adm, row.getByRole("button", { name: "Confirmar" }));
check("redirect apagado", (await status(`/e2e-antigo-${n}/`)) === 404);

// 14. Blog
await adm.goto(`${BASE}/admin/blog/novo/`);
await adm.fill('input[name="title"]', `Guia e2e ${n}`);
await adm.fill('textarea[name="contentHtml"]', "<p>Como avaliar um negócio antes de o comprar.</p><h2>Contas</h2><p>Peça os balanços.</p>");
await adm.selectOption('select[name="status"]', "published");
await submit(adm, adm.getByRole("button", { name: "Guardar", exact: true }));
check("artigo criado", adm.url().includes("criado=1"), adm.url());
await anon.goto(`${BASE}/guia-e2e-${n}/`);
check("artigo público", (await anon.locator("h1", { hasText: `Guia e2e ${n}` }).count()) === 1);
await adm.selectOption('select[name="status"]', "draft");
await submit(adm, adm.getByRole("button", { name: "Guardar", exact: true }));
check("rascunho deixa de ser público", (await status(`/guia-e2e-${n}/`)) === 404);

// 15. Auditoria e limpeza (apagar o utilizador apaga os anúncios)
await adm.goto(`${BASE}/admin/auditoria/`);
check("auditoria regista as ações", (await adm.locator("text=Bloqueou").count()) >= 1 && (await adm.locator("text=Alterou definições").count()) >= 1);
await adm.goto(userUrl);
await confirmAction(adm, "Apagar conta");
check("utilizador apagado", adm.url().includes("apagado=1"), adm.url());
check("anúncios do utilizador apagado saem", (await status(`/listing/${slug}/`)) === 404);

check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
