// Teste end-to-end do fluxo de conta. Uso: node e2e/auth-flow.mjs http://localhost:3100 [pasta-capturas]
import { createRequire } from "node:module";

// Usa o Playwright instalado no sistema (require respeita NODE_PATH; import não).
const { chromium } = createRequire(import.meta.url)("playwright");

const BASE = process.argv[2] ?? "http://localhost:3100";
const SHOTS = process.argv[3];
const results = [];
const check = (name, cond, extra = "") => { results.push([cond ? "OK  " : "FAIL", name, extra]); };

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

async function lastEmailLink(template) {
  await page.goto(`${BASE}/dev/emails/`);
  const text = await page.locator(`details[data-template="${template}"] [data-email-text]`).first().textContent();
  return text.match(/https?:\/\/\S+/)?.[0];
}
async function logout() {
  await page.goto(`${BASE}/my-account/`);
  await page.getByRole("button", { name: "Terminar sessão" }).click();
  await page.waitForURL(`${BASE}/`);
}
async function login(id, pw) {
  await page.goto(`${BASE}/my-account/`);
  await page.fill("#login-identifier", id);
  await page.fill("#login-password", pw);
  await submit(page.getByRole("button", { name: "Entrar", exact: true }));
}
/** Clica e espera pela resposta do POST da server action e pela navegação que possa seguir. */
async function submit(button) {
  await Promise.all([page.waitForResponse((r) => r.request().method() === "POST"), button.click()]);
  await page.waitForLoadState("load");
  await page.waitForTimeout(300);
}

const u = `teste${Date.now() % 100000}`;

// 1. Registo com erros de validação
await page.goto(`${BASE}/my-account/`);
const ids = await page.$$eval("[id]", (els) => els.map((e) => e.id));
check("sem ids duplicados na página de conta", new Set(ids).size === ids.length);
if (SHOTS) await page.screenshot({ path: `${SHOTS}/conta.png`, fullPage: true });
await page.fill("#reg-username", "a@b");
await page.fill("#reg-email", "invalido");
await page.fill("#reg-password", "curta");
await page.fill("#reg-password2", "outra");
await page.getByRole("button", { name: "Criar conta" }).click();
await page.waitForSelector(".err");
const errs = await page.locator(".err").allTextContents();
check("registo mostra erros de validação", errs.length >= 4, errs.join(" | "));

// 2. Registo válido
await page.fill("#reg-username", u);
await page.fill("#reg-email", `${u}@exemplo.pt`);
await page.fill("#reg-password", "segura-123");
await page.fill("#reg-password2", "segura-123");
await page.check('input[name="privacy"]');
await page.getByRole("button", { name: "Criar conta" }).click();
await page.waitForSelector("text=Confirme o seu email");
check("registo cria conta e pede confirmação", true);

// 3. Login antes de confirmar
await login(u, "segura-123");
check("login bloqueado até confirmar email", await page.locator("text=Ainda não confirmou o email").isVisible());

// 4. Confirmar email pela ligação do email registado
const verify = await lastEmailLink("verify_email");
check("email de confirmação registado com ligação", Boolean(verify), verify);
await page.goto(verify);
check("ligação confirma e inicia sessão", await page.locator("text=Email confirmado").isVisible(), page.url());
check("ligação de confirmação só funciona uma vez", (await (await page.request.get(verify, { maxRedirects: 0 })).headers().location)?.includes("verify=invalid"));
check("email de boas-vindas registado", Boolean(await lastEmailLink("welcome")));

// 5. Logout e login com email
await logout();
await login(`${u}@exemplo.pt`, "segura-123");
check("login com email", await page.locator(`text=Olá, ${u}`).isVisible());
await logout();

// 6. Password errada
await login(u, "errada");
check("password errada mostra erro genérico", await page.locator("text=incorretos").isVisible());

// 7. Utilizadores migrados do WordPress
await login("utilizador.wp", "palavra-passe");
check("login com hash $wp$ do WordPress", await page.locator("text=Olá, Utilizador WP").isVisible());
await logout();
await login("phpass@exemplo.pt", "palavra-passe");
check("login com hash phpass antigo", await page.locator("text=Olá, Antigo").isVisible());
await logout();
// Depois do rehash, a mesma password continua a funcionar.
await login("utilizador.wp", "palavra-passe");
check("login depois do rehash", await page.locator("text=Olá, Utilizador WP").isVisible());
await logout();

// 8. Recuperar password
await page.goto(`${BASE}/my-account/lost-password/`);
await page.fill("#lost-identifier", u);
await page.getByRole("button", { name: "Enviar ligação" }).click();
await page.waitForSelector("text=Se existir uma conta");
const reset = await lastEmailLink("reset_password");
check("email de recuperação registado", Boolean(reset));
await page.goto(reset);
await page.fill("#reset-password", "nova-segura-456");
await page.fill("#reset-password2", "nova-segura-456");
await page.getByRole("button", { name: "Guardar nova password" }).click();
await page.waitForSelector("text=Password alterada");
check("nova password guardada e sessão iniciada", true);
check("aviso de segurança registado", Boolean(await lastEmailLink("security_notice")));
await logout();
await login(u, "segura-123");
check("password antiga deixa de funcionar", await page.locator("text=incorretos").isVisible());
await login(u, "nova-segura-456");
check("nova password funciona", await page.locator(`text=Olá, ${u}`).isVisible());
await page.goto(reset);
check("ligação de recuperação não pode ser reutilizada", await page.locator("text=expirou ou já foi usada").isVisible());

// 9. Redirect seguro depois do login
await logout();
await page.goto(`${BASE}/my-account/?next=https://mau.example/`);
await page.fill("#login-identifier", u);
await page.fill("#login-password", "nova-segura-456");
await submit(page.getByRole("button", { name: "Entrar", exact: true }));
check("next externo é ignorado", page.url().startsWith(BASE), page.url());

if (SHOTS) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}/`);
  await page.screenshot({ path: `${SHOTS}/home-mobile.png`, fullPage: true });
}
check("sem erros de JavaScript", errors.length === 0, errors.join(" | "));
await browser.close();

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - failed}/${results.length} verificações passaram`);
process.exit(failed ? 1 : 0);
