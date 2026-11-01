// Teste end-to-end do "Continuar com o Google", com um Google falso (não precisa de rede nem de credenciais).
// Uso: node e2e/google-flow.mjs http://localhost:3100
// O site tem de arrancar com: GOOGLE_CLIENT_ID=teste GOOGLE_CLIENT_SECRET=teste GOOGLE_OAUTH_FAKE_URL=http://127.0.0.1:3199
// e SITE_ENV=development (caixa /dev/emails/). Antes: npx tsx scripts/e2e-fixtures.ts (cria utilizador.wp e admin.teste).
import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const BASE = process.argv[2] ?? "http://localhost:3100";
const FAKE = "http://127.0.0.1:3199";
const results = [];
const check = (name, cond, extra = "") => results.push([cond ? "OK  " : "FAIL", name, extra]);

/* ---------- Google falso ---------- */
let identity = null; // quem "entra" no próximo pedido
const codes = new Map();
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const fake = createServer(async (req, res) => {
  const url = new URL(req.url, FAKE);
  if (url.pathname === "/auth") {
    const p = url.searchParams;
    const back = new URL(p.get("redirect_uri"));
    back.searchParams.set("state", p.get("state"));
    if (identity === "cancel") back.searchParams.set("error", "access_denied");
    else {
      const code = randomBytes(12).toString("hex");
      codes.set(code, { identity, nonce: p.get("nonce"), challenge: p.get("code_challenge"), redirect: p.get("redirect_uri"), client: p.get("client_id") });
      back.searchParams.set("code", code);
    }
    res.writeHead(302, { Location: back.toString() });
    return res.end();
  }
  if (url.pathname === "/token" && req.method === "POST") {
    let raw = "";
    for await (const c of req) raw += c;
    const f = new URLSearchParams(raw);
    const entry = codes.get(f.get("code"));
    codes.delete(f.get("code")); // cada código só serve uma vez
    const pkceOk = entry && createHash("sha256").update(f.get("code_verifier") ?? "").digest("base64url") === entry.challenge;
    if (!entry || !pkceOk || f.get("client_secret") !== "teste" || f.get("redirect_uri") !== entry.redirect) {
      res.writeHead(400, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "invalid_grant" }));
    }
    const claims = { iss: FAKE, aud: entry.client, exp: Math.floor(Date.now() / 1000) + 3600, nonce: entry.nonce, email_verified: true, ...entry.identity };
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ access_token: "x", id_token: `${b64({ alg: "RS256" })}.${b64(claims)}.assinatura` }));
  }
  res.writeHead(404);
  res.end();
});
await new Promise((r) => fake.listen(3199, "127.0.0.1", r));

/* ---------- Browser ---------- */
const browser = await chromium.launch();
const errors = [];
async function newPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(e.message));
  return p;
}
async function submit(page, button) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(400);
}
async function google(page, who) {
  identity = who;
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/api/auth/google")), page.getByRole("link", { name: "Continuar com o Google" }).click()]);
  await page.waitForLoadState("load");
}
const n = Date.now() % 100000;
const mailbox = async (page, template, text) => {
  await page.goto(`${BASE}/dev/emails/`);
  return page.locator(`details[data-template="${template}"]`, { hasText: text }).count();
};

// 1. Conta nova
const a = await newPage();
await a.goto(`${BASE}/my-account/`);
check("botão do Google na página de entrada", await a.getByRole("link", { name: "Continuar com o Google" }).isVisible());
await google(a, { sub: `g-${n}`, email: `joana.google${n}@exemplo.pt`, name: `Joana Google ${n}`, given_name: "Joana" });
check("conta nova criada e com sessão", a.url().includes("bemvindo=1") && (await a.getByRole("heading", { name: `Olá, Joana Google ${n}` }).isVisible()), a.url());
check("email de boas-vindas", (await mailbox(a, "welcome", `joana.google${n}@exemplo.pt`)) === 1);
check("aviso à administração", (await mailbox(a, "admin_new_user", `joana.google${n}`)) >= 1);

// 2. Sem password: pode definir uma (sem "password atual") e depois entrar com email
await a.goto(`${BASE}/my-account/edit-account/`);
check("conta Google: sem campo 'password atual'", (await a.locator("#pw-currentPassword").count()) === 0 && (await a.getByRole("button", { name: "Definir password" }).isVisible()));
check("mudar email pede password primeiro", await a.locator("text=defina primeiro uma password").isVisible());
await a.fill("#pw-newPassword", "google-depois-123");
await a.fill("#pw-newPassword2", "google-depois-123");
await submit(a, a.getByRole("button", { name: "Definir password" }));
check("password definida", await a.locator("text=Password definida").isVisible());
await a.context().clearCookies();
await a.goto(`${BASE}/my-account/`);
await a.fill("#login-identifier", `joana.google${n}@exemplo.pt`);
await a.fill("#login-password", "google-depois-123");
await submit(a, a.getByRole("button", { name: "Entrar", exact: true }));
check("entra também com email e password", await a.getByRole("heading", { name: `Olá, Joana Google ${n}` }).isVisible());

// 3. Voltar a entrar com o Google: mesma conta (não cria outra)
await a.context().clearCookies();
await a.goto(`${BASE}/my-account/`);
await google(a, { sub: `g-${n}`, email: `joana.google${n}@exemplo.pt`, name: "Outro Nome" });
check("mesma conta no 2.º login", !a.url().includes("bemvindo") && (await a.getByRole("heading", { name: `Olá, Joana Google ${n}` }).isVisible()), a.url());

// 4. Conta existente com o mesmo email: liga-se e mantém a password
const b = await newPage();
await b.goto(`${BASE}/my-account/`);
await google(b, { sub: "g-utilizador-wp", email: "WP@exemplo.pt", name: "Nome no Google" });
check("liga à conta existente pelo email", await b.getByRole("heading", { name: "Olá, Utilizador WP" }).isVisible(), b.url());
await b.goto(`${BASE}/my-account/edit-account/`);
check("conta ligada continua com password", (await b.locator("#pw-currentPassword").count()) === 1 && (await b.locator("text=Pode entrar com o Google ou com esta password").isVisible()));

// 5. Volta para onde ia (ex.: publicar anúncio)
const c = await newPage();
await c.goto(`${BASE}/post-an-ad/`);
await c.waitForURL(/my-account\/\?next=/);
await google(c, { sub: `g-${n}`, email: `joana.google${n}@exemplo.pt`, name: "x" });
check("depois do Google volta a 'Publicar anúncio'", new URL(c.url()).pathname === "/post-an-ad/", c.url());

// 6. Erros
const d = await newPage();
await d.goto(`${BASE}/my-account/`);
await google(d, "cancel");
check("cancelar no Google mostra aviso", await d.locator("text=O login com o Google foi cancelado").isVisible());
await d.goto(`${BASE}/my-account/`);
await google(d, { sub: `g-x-${n}`, email: `nao.confirmado${n}@exemplo.pt`, email_verified: false });
check("email não confirmado pelo Google é recusado", await d.locator("text=Não foi possível entrar com o Google").isVisible() && (await d.locator("#login-identifier").count()) === 1);
await d.goto(`${BASE}/api/auth/google/callback/?code=abc&state=inventado`);
check("resposta sem pedido nosso (state) é recusada", await d.locator("text=O pedido ao Google expirou").isVisible());

// 7. Conta bloqueada não entra pelo Google
const adm = await newPage();
await adm.goto(`${BASE}/my-account/`);
await adm.fill("#login-identifier", "admin.teste");
await adm.fill("#login-password", "admin-teste-123");
await submit(adm, adm.getByRole("button", { name: "Entrar", exact: true }));
await adm.goto(`${BASE}/admin/utilizadores/?q=joana.google${n}`);
await adm.locator("tr", { hasText: `joana.google${n}@exemplo.pt` }).locator("a").first().click();
await adm.waitForURL(/utilizadores\/\d+\/$/);
check("ficha mostra que entra com o Google", await adm.locator("text=também entra com o Google").isVisible());
const userUrl = adm.url();
await adm.locator("summary", { hasText: "Bloquear" }).click();
await adm.locator("details[open] form input[name=confirm]").check();
await submit(adm, adm.locator("details[open] form").getByRole("button", { name: "Confirmar" }));
const e = await newPage();
await e.goto(`${BASE}/my-account/`);
await google(e, { sub: `g-${n}`, email: `joana.google${n}@exemplo.pt`, name: "x" });
check("conta bloqueada não entra", await e.locator("text=Esta conta está bloqueada").isVisible());

// Limpeza: apagar a conta de teste
await adm.goto(userUrl);
await adm.locator("summary", { hasText: "Apagar conta" }).click();
await adm.locator("details[open] form input[name=confirm]").check();
await submit(adm, adm.locator("details[open] form").getByRole("button", { name: "Confirmar" }));

check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();
fake.close();
for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
