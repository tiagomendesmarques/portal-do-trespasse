// Verifica se todos os URLs do site WordPress respondem no site novo (200, ou redirect que termina em 200).
// Uso: node e2e/url-coverage.mjs http://localhost:3100 [data/urls_atuais.txt] [utilizador:password]
import { readFileSync } from "node:fs";

const [, , base = "http://localhost:3100", file = "data/urls_atuais.txt", auth] = process.argv;
const headers = auth ? { Authorization: `Basic ${Buffer.from(auth).toString("base64")}` } : {};
const urls = readFileSync(file, "utf8").split("\n").map((l) => l.trim()).filter(Boolean);

async function follow(path) {
  const chain = [];
  for (let i = 0; i < 5; i++) {
    const res = await fetch(base + path, { redirect: "manual", headers });
    chain.push(res.status);
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) { path = loc.replace(/^https?:\/\/[^/]+/, ""); continue; }
    return { status: res.status, final: path, chain };
  }
  return { status: 0, final: path, chain };
}

const results = { ok: 0, redirected: 0, failed: [] };
for (const u of urls) {
  const path = new URL(u).pathname;
  const r = await follow(path);
  if (r.status !== 200) results.failed.push(`${r.chain.join("→")}  ${path}${r.final !== path ? ` → ${r.final}` : ""}`);
  else if (r.chain.length > 1) results.redirected++;
  else results.ok++;
}
console.log(`${urls.length} URLs: ${results.ok} respondem diretamente, ${results.redirected} redirecionam, ${results.failed.length} falham`);
for (const f of results.failed) console.log("  FALHA", f);
process.exit(results.failed.length ? 1 : 0);
