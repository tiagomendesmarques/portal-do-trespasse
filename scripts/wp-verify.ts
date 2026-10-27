// Confirma a migração: compara o dump do WordPress com a base de dados nova, item a item.
// Uso: npx tsx scripts/wp-verify.ts --sql <dump.sql>   (correr logo a seguir ao wp-import.ts)
// Só mostra contagens e IDs (nunca emails, nomes ou passwords). Termina com erro se algo falhar.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { closeDb, getDb, schema } from "../src/db";
import { IMAGE_WIDTHS } from "../src/lib/media";
import { maybeUnserialize } from "../src/lib/wp/php-unserialize";
import { parseDump } from "../src/lib/wp/sql-dump";

const i = process.argv.indexOf("--sql");
const SQL = i > 0 ? process.argv[i + 1] : undefined;
if (!SQL) {
  console.error("Uso: npx tsx scripts/wp-verify.ts --sql <dump.sql>");
  process.exit(1);
}
const MEDIA_DIR = process.env.MEDIA_DIR ?? "./.data/media";

const results: [string, string, string][] = [];
const check = (name: string, ok: boolean, detail = "") => results.push([ok ? "OK   " : "FALHA", name, detail]);
const note = (name: string, detail: string) => results.push(["AVISO", name, detail]);
const ids = (xs: (number | string)[]) => (xs.length > 12 ? `${xs.slice(0, 12).join(", ")}… (${xs.length})` : xs.join(", "));

/* ---------- WordPress ---------- */
const T = parseDump(readFileSync(SQL, "utf8"), [
  "wp_users", "wp_usermeta", "wp_posts", "wp_postmeta", "wp_terms", "wp_term_taxonomy", "wp_term_relationships", "wp_e_submissions", "wp_e_submissions_values",
]);
const rows = (t: string) => T.get(t) ?? [];
const meta = (table: string, col: string) => {
  const m = new Map<number, Map<string, string[]>>();
  for (const r of rows(table)) {
    const id = Number(r[col]);
    const mm = m.get(id) ?? new Map<string, string[]>();
    mm.set(String(r.meta_key), [...(mm.get(String(r.meta_key)) ?? []), String(r.meta_value ?? "")]);
    m.set(id, mm);
  }
  return m;
};
const PM = meta("wp_postmeta", "post_id");
const UM = meta("wp_usermeta", "user_id");
const pm = (id: number, k: string) => PM.get(id)?.get(k)?.[0];
const pmAll = (id: number, k: string) => (PM.get(id)?.get(k) ?? []).filter((v) => v !== "");

const wpListings = rows("wp_posts").filter((p) => p.post_type === "rtcl_listing" && ["publish", "rtcl-expired"].includes(String(p.post_status)));
const authors = new Set(wpListings.map((p) => Number(p.post_author)));
const wpUsers = rows("wp_users").filter((u) => !UM.get(Number(u.ID))?.get("rtcl_verification_key")?.[0] || authors.has(Number(u.ID)));
// Contas duplicadas (mesmo login ou email) são juntadas na primeira pelo importador.
const canonical = new Map<number, number>();
const seen = new Map<string, number>();
for (const u of wpUsers) {
  const keys = [String(u.user_login).toLowerCase(), String(u.user_email).toLowerCase()];
  const first = keys.map((k) => seen.get(k)).find((x) => x !== undefined);
  canonical.set(Number(u.ID), first ?? Number(u.ID));
  if (first === undefined) keys.forEach((k) => seen.set(k, Number(u.ID)));
}
const expectedUsers = new Set(canonical.values());
const wpPass = new Map(wpUsers.map((u) => [Number(u.ID), String(u.user_pass)]));

const termTax = new Map(rows("wp_term_taxonomy").map((t) => [Number(t.term_taxonomy_id), t]));
const terms = new Map(rows("wp_terms").map((t) => [Number(t.term_id), t]));
const termsOf = (id: number) =>
  rows("wp_term_relationships").filter((r) => Number(r.object_id) === id).map((r) => termTax.get(Number(r.term_taxonomy_id))).filter(Boolean)
    .map((tt) => ({ ...tt!, ...terms.get(Number(tt!.term_id)) }));

/* ---------- Base de dados nova ---------- */
const db = getDb();
const [users, listings, images, values, fields, cats, locs, posts, pages, messages] = await Promise.all([
  db.select().from(schema.users),
  db.select().from(schema.listings),
  db.select().from(schema.listingImages),
  db.select().from(schema.listingFieldValues),
  db.select().from(schema.customFields),
  db.select().from(schema.categories),
  db.select().from(schema.locations),
  db.select().from(schema.posts),
  db.select().from(schema.pages),
  db.select().from(schema.messages),
]);
const userByWp = new Map(users.filter((u) => u.wpId).map((u) => [u.wpId!, u]));
const wpIdOfUser = new Map(users.map((u) => [u.id, u.wpId]));
const mediaOk = (key: string) => IMAGE_WIDTHS.every((w) => existsSync(join(MEDIA_DIR, `${key}-${w}.webp`)));

/* ---------- Utilizadores ---------- */
const missingUsers = [...expectedUsers].filter((id) => !userByWp.has(id));
check(`utilizadores migrados (${expectedUsers.size} esperados)`, missingUsers.length === 0, missingUsers.length ? `em falta WP ${ids(missingUsers)}` : `${expectedUsers.size} contas`);
const extra = users.filter((u) => u.wpId && !expectedUsers.has(u.wpId)).map((u) => u.wpId!);
check("nenhuma conta não verificada importada", extra.length === 0, extra.length ? `WP ${ids(extra)}` : "");
// A password tem de ser a do WordPress, ou já convertida para bcrypt num login no site novo.
const badHash = [...expectedUsers].filter((id) => {
  const u = userByWp.get(id);
  if (!u) return false;
  return u.passwordHash !== wpPass.get(id) && !/^\$2[aby]\$/.test(u.passwordHash);
});
check("passwords do WordPress preservadas", badHash.length === 0, badHash.length ? `WP ${ids(badHash)}` : "");
const unknownFormat = [...expectedUsers].filter((id) => {
  const h = userByWp.get(id)?.passwordHash ?? "";
  return h && !/^(\$wp\$2y\$|\$P\$|\$H\$|\$2[aby]\$)/.test(h) && !/^[a-f0-9]{32}$/.test(h);
});
check("formato de password reconhecido em todas as contas", unknownFormat.length === 0, unknownFormat.length ? `WP ${ids(unknownFormat)}` : "");
const roles = [...expectedUsers].map((id) => userByWp.get(id)?.role).filter((r) => r && r !== "user").length;
note("contas da equipa (administrador/editor)", String(roles));

/* ---------- Anúncios ---------- */
const listingByWp = new Map(listings.filter((l) => l.wpId).map((l) => [l.wpId!, l]));
const problems: Record<string, number[]> = { falta: [], slug: [], estado: [], dono: [], categoria: [], localizacao: [], preco: [], fotos: [], ficheiros: [], campos: [] };
for (const p of wpListings) {
  const wpId = Number(p.ID);
  const l = listingByWp.get(wpId);
  if (!l) { problems.falta.push(wpId); continue; }
  if (l.slug !== String(p.post_name)) problems.slug.push(wpId);
  if (l.status !== (p.post_status === "publish" ? "published" : "expired")) problems.estado.push(wpId);
  if (wpIdOfUser.get(l.userId) !== canonical.get(Number(p.post_author))) problems.dono.push(wpId);
  const tx = termsOf(wpId);
  const cat = tx.find((t) => t.taxonomy === "rtcl_category");
  if (cats.find((c) => c.id === l.categoryId)?.wpId !== Number(cat?.term_id)) problems.categoria.push(wpId);
  const loc = locs.find((x) => x.id === l.locationId);
  if (!loc || !tx.some((t) => t.taxonomy === "rtcl_location" && String(t.slug) === loc.slug)) problems.localizacao.push(wpId);
  const price = pm(wpId, "price");
  if ((price ? Math.round(parseFloat(price)) : null) !== l.price) problems.preco.push(wpId);
  const order = maybeUnserialize(pm(wpId, "_rtcl_attachments_order"));
  const expectedPhotos = Array.isArray(order) && order.length ? order.length : rows("wp_posts").filter((a) => a.post_type === "attachment" && Number(a.post_parent) === wpId).length;
  const mine = images.filter((im) => im.listingId === l.id);
  if (mine.length !== expectedPhotos) problems.fotos.push(wpId);
  if (mine.some((im) => !mediaOk(im.storageKey) || !im.width)) problems.ficheiros.push(wpId);
  const expectedValues = fields.filter((f) => f.wpId && pmAll(wpId, `_field_${f.wpId}`).length).length;
  if (values.filter((v) => v.listingId === l.id).length !== expectedValues) problems.campos.push(wpId);
}
const LABEL: Record<string, string> = {
  falta: "todos os anúncios migrados", slug: "endereços (slug) iguais", estado: "estado igual (publicado/expirado)", dono: "cada anúncio ligado ao mesmo dono",
  categoria: "categoria igual", localizacao: "localização igual", preco: "preço igual", fotos: "número de fotografias igual", ficheiros: "ficheiros das fotografias nos 3 tamanhos", campos: "campos do formulário migrados",
};
for (const [k, list] of Object.entries(problems)) check(`${LABEL[k]} (${wpListings.length})`, list.length === 0, list.length ? `WP ${ids(list)}` : "");
note("fotografias de anúncios", String(images.filter((im) => listings.some((l) => l.wpId && l.id === im.listingId)).length));

/* ---------- Blog, páginas e mensagens ---------- */
const wpPosts = rows("wp_posts").filter((p) => p.post_type === "post" && ["publish", "draft"].includes(String(p.post_status)));
const postByWp = new Map(posts.filter((p) => p.wpId).map((p) => [p.wpId!, p]));
const missingPosts = wpPosts.filter((p) => !postByWp.has(Number(p.ID))).map((p) => Number(p.ID));
const pub = wpPosts.filter((p) => p.post_status === "publish").length;
check(`artigos migrados (${pub} publicados + ${wpPosts.length - pub} rascunhos)`, missingPosts.length === 0, missingPosts.length ? `WP ${ids(missingPosts)}` : "");
const wrongPostStatus = wpPosts.filter((p) => postByWp.get(Number(p.ID))?.status !== (p.post_status === "publish" ? "published" : "draft")).map((p) => Number(p.ID));
check("estado dos artigos igual", wrongPostStatus.length === 0, wrongPostStatus.length ? `WP ${ids(wrongPostStatus)}` : "");
const noThumb = wpPosts.filter((p) => {
  const thumb = pm(Number(p.ID), "_thumbnail_id");
  const mine = postByWp.get(Number(p.ID));
  return thumb && pm(Number(thumb), "_wp_attached_file") && (!mine?.featuredImageKey || !mediaOk(mine.featuredImageKey));
}).map((p) => Number(p.ID));
check("imagens de destaque dos artigos", noThumb.length === 0, noThumb.length ? `WP ${ids(noThumb)}` : "");
const oldUrls = [...posts, ...pages].filter((x) => /wp-content\/uploads/.test(x.contentHtml)).map((x) => x.slug);
check("nenhum texto aponta para wp-content/uploads", oldUrls.length === 0, oldUrls.length ? ids(oldUrls) : "");
const inlineMissing = [...posts, ...pages].flatMap((x) => [...x.contentHtml.matchAll(/\/media\/(.+?)-(?:400|800|1600)\.webp/g)].map((m) => m[1])).filter((k) => !mediaOk(k));
check("imagens dentro dos textos existem", inlineMissing.length === 0, inlineMissing.length ? ids(inlineMissing) : "");
const subs = new Set(rows("wp_e_submissions_values").filter((v) => v.key === "message" && String(v.value ?? "").trim()).map((v) => Number(v.submission_id)));
const contactMsgs = messages.filter((m) => m.kind === "site_contact").length;
check(`mensagens do formulário de contacto (${subs.size})`, contactMsgs >= subs.size, `${contactMsgs} no site novo`);

/* ---------- Avisos para rever à mão ---------- */
const now = Date.now();
const cheap = listings.filter((l) => l.wpId && l.price !== null && l.price < 100).map((l) => l.wpId!);
if (cheap.length) note("preço abaixo de 100 € (confirmar com o anunciante)", `WP ${ids(cheap)}`);
const soon = listings.filter((l) => l.wpId && l.status === "published" && l.expiresAt && l.expiresAt.getTime() - now < 14 * 86_400_000);
if (soon.length) note("anúncios que expiram nos próximos 14 dias", `${soon.length} (o anunciante recebe o aviso para renovar)`);
const past = listings.filter((l) => l.wpId && l.status === "published" && l.expiresAt && l.expiresAt.getTime() < now);
if (past.length) note("publicados com a validade já passada", `${past.length} (as tarefas diárias expiram-nos e avisam o dono)`);
const generic = [...expectedUsers].filter((id) => userByWp.get(id)?.displayName === "Anunciante").length;
if (generic) note("contas sem nome público (ficam como “Anunciante”)", String(generic));

for (const r of results) console.log(r.join("  "));
const failed = results.filter((r) => r[0] === "FALHA").length;
const okCount = results.filter((r) => r[0] === "OK   ").length;
console.log(`\n${okCount}/${okCount + failed} verificações passaram${failed ? "" : " — migração confirmada"}`);
await closeDb();
process.exit(failed ? 1 : 0);
