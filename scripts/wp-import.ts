// Importa do WordPress: utilizadores verificados, anúncios (com campos, fotos e estatísticas),
// artigos do blog (publicados e rascunhos) e mensagens do formulário de contacto.
// Uso: npx tsx scripts/wp-import.ts --sql <dump.sql> --uploads <pasta que contém uploads/>
// Idempotente (atualiza por wp_id): pode ser corrida de novo com um dump mais recente.
// - Contas e anúncios novos entram; os existentes são atualizados com os dados do WordPress.
// - Passwords: atualizadas, exceto as de quem já entrou no site novo (já convertidas).
// - Fotografias já importadas mantêm-se: basta enviar os uploads novos (ex.: só a pasta do mês).
// - O que foi apagado no WordPress não é apagado aqui (no dia da mudança importa-se para uma base vazia).
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { closeDb, getDb, schema } from "../src/db";
import type { BusinessHours } from "../src/db/schema";
import { mediaUrl, readMedia, storeImage } from "../src/lib/media";
import { buildSearchText, excerpt } from "../src/lib/text";
import { maybeUnserialize, type PhpValue } from "../src/lib/wp/php-unserialize";
import { parseDump, type Row } from "../src/lib/wp/sql-dump";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const SQL = arg("sql");
const UPLOADS = arg("uploads");
if (!SQL || !UPLOADS) {
  console.error("Uso: npx tsx scripts/wp-import.ts --sql <dump.sql> --uploads <pasta com uploads/>");
  process.exit(1);
}
const uploadsDir = existsSync(join(UPLOADS, "uploads")) ? join(UPLOADS, "uploads") : UPLOADS;

const db = getDb();
const stats: Record<string, number> = {};
const bump = (k: string, n = 1) => (stats[k] = (stats[k] ?? 0) + n);
const warn = (msg: string) => { bump("avisos"); console.warn("  ⚠", msg); };

/* ---------- Leitura do dump ---------- */
console.log("A ler o dump…");
const T = parseDump(readFileSync(SQL, "utf8"), [
  "wp_users", "wp_usermeta", "wp_posts", "wp_postmeta", "wp_terms", "wp_term_taxonomy", "wp_term_relationships",
  "wp_rtcl_listing_stats", "wp_e_submissions", "wp_e_submissions_values",
]);
// As tabelas de plugins podem não existir num dump parcial.
const rows = (t: string) => T.get(t) ?? [];

function metaIndex(table: string, idCol: string) {
  const idx = new Map<number, Map<string, string[]>>();
  for (const r of rows(table)) {
    const id = Number(r[idCol]);
    let m = idx.get(id);
    if (!m) idx.set(id, (m = new Map()));
    const k = String(r.meta_key);
    m.set(k, [...(m.get(k) ?? []), String(r.meta_value ?? "")]);
  }
  return idx;
}
const postMeta = metaIndex("wp_postmeta", "post_id");
const userMeta = metaIndex("wp_usermeta", "user_id");
const pm = (id: number, k: string) => postMeta.get(id)?.get(k)?.[0];
const pmAll = (id: number, k: string) => (postMeta.get(id)?.get(k) ?? []).filter((v) => v !== "");
const um = (id: number, k: string) => userMeta.get(id)?.get(k)?.[0];

const posts = new Map(rows("wp_posts").map((p) => [Number(p.ID), p]));
const termTax = new Map(rows("wp_term_taxonomy").map((t) => [Number(t.term_taxonomy_id), t]));
const terms = new Map(rows("wp_terms").map((t) => [Number(t.term_id), t]));
const termsOf = new Map<number, Row[]>();
for (const r of rows("wp_term_relationships")) {
  const tt = termTax.get(Number(r.term_taxonomy_id));
  if (!tt) continue;
  const list = termsOf.get(Number(r.object_id)) ?? [];
  list.push({ ...tt, ...terms.get(Number(tt.term_id)) });
  termsOf.set(Number(r.object_id), list);
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', "#039": "'", "#8211": "–", "#8212": "—", "#8216": "‘", "#8217": "’", "#8220": "“", "#8221": "”", "#8230": "…", nbsp: " " };
const decode = (s: string) => s.replace(/&(#?\w+);/g, (m, e: string) => ENTITIES[e] ?? m);
const wpDate = (s: unknown) => (s && s !== "0000-00-00 00:00:00" ? new Date(String(s).replace(" ", "T") + "Z") : null);

/** wpautop simplificado: o WordPress guarda texto com linhas em branco em vez de <p>. */
function autop(html: string): string {
  const s = html.replace(/\r\n/g, "\n").trim();
  if (/<p[\s>]/i.test(s)) return s;
  return s
    .split(/\n\s*\n/)
    .map((block) => (/^<(ul|ol|h\d|blockquote|table|figure|div)/i.test(block.trim()) ? block.trim() : `<p>${block.trim().replace(/\n/g, "<br>")}</p>`))
    .join("\n");
}

/* ---------- Imagens ---------- */
const attachedFile = (attId: number) => pm(attId, "_wp_attached_file");
// Dimensões das fotografias já importadas (para não precisar de novo do ficheiro original).
const knownDims = new Map((await db.select().from(schema.listingImages)).map((i) => [i.storageKey, { width: i.width ?? 0, height: i.height ?? 0 }]));
async function importImage(key: string, file: string): Promise<{ width: number; height: number } | null> {
  const full = join(uploadsDir, file);
  // Já guardada no site novo: mantém-se, mesmo que desta vez só tenham sido enviados os uploads novos.
  if (await readMedia(`${key}-400.webp`)) {
    bump("imagens já existentes");
    const known = knownDims.get(key);
    if (known?.width) return known;
    if (!existsSync(full)) return { width: 0, height: 0 };
    const meta = await sharp(readFileSync(full), { failOn: "none" }).metadata().catch(() => null);
    return { width: meta?.autoOrient?.width ?? meta?.width ?? 0, height: meta?.autoOrient?.height ?? meta?.height ?? 0 };
  }
  if (!existsSync(full)) { warn(`imagem em falta: ${file}`); return null; }
  try {
    const dims = await storeImage(key, readFileSync(full));
    bump("imagens processadas");
    return dims;
  } catch (e) {
    warn(`imagem inválida ${file}: ${(e as Error).message}`);
    return null;
  }
}

/* ---------- Utilizadores ---------- */
console.log("Utilizadores…");
// "pending" = à espera de aprovação no WordPress: entra na fila de aprovação do back-office.
const LISTING_STATUS: Record<string, "published" | "expired" | "pending"> = { publish: "published", "rtcl-expired": "expired", pending: "pending" };
const listingPosts = rows("wp_posts").filter((p) => p.post_type === "rtcl_listing" && String(p.post_status) in LISTING_STATUS);
const authors = new Set(listingPosts.map((p) => Number(p.post_author)));
const userIdByWp = new Map<number, number>();
const seenAccounts = new Map<string, number>(); // login e email já importados

for (const u of rows("wp_users")) {
  const wpId = Number(u.ID);
  const verified = !um(wpId, "rtcl_verification_key");
  if (!verified && !authors.has(wpId)) { bump("utilizadores ignorados (não verificados)"); continue; }

  const caps = maybeUnserialize(um(wpId, "wp_capabilities")) as Record<string, boolean> | null;
  const role = caps?.administrator ? "admin" : caps?.editor ? "editor" : "user";
  const first = um(wpId, "first_name")?.trim() || null;
  const last = um(wpId, "last_name")?.trim() || null;
  let displayName = String(u.display_name ?? "").trim();
  if (!displayName || displayName.includes("@")) displayName = [first, last].filter(Boolean).join(" ") || "Anunciante";
  if (/^portal do trespasse$/i.test(displayName)) displayName = "Portal do Trespasse";
  const registered = wpDate(u.user_registered) ?? new Date();

  const profile = {
    username: String(u.user_login),
    email: String(u.user_email).toLowerCase(),
    displayName,
    firstName: first,
    lastName: last,
    phone: um(wpId, "_rtcl_phone") || null,
    whatsapp: um(wpId, "_rtcl_whatsapp_number") || null,
    website: um(wpId, "_rtcl_website") || String(u.user_url ?? "") || null,
    address: um(wpId, "_rtcl_address") || null,
    zipcode: um(wpId, "_rtcl_zipcode") || null,
    role: role as "admin" | "editor" | "user",
    emailVerifiedAt: registered,
  };
  // O WordPress chegou a criar contas duplicadas (mesmo login e email): junta-as na primeira.
  const firstId = seenAccounts.get(profile.username.toLowerCase()) ?? seenAccounts.get(profile.email);
  if (firstId !== undefined) {
    userIdByWp.set(wpId, firstId);
    warn(`utilizador WP ${wpId} duplica outra conta; junto com a primeira`);
    bump("utilizadores duplicados juntados");
    continue;
  }
  const [row] = await db
    .insert(schema.users)
    .values({ wpId, ...profile, passwordHash: String(u.user_pass), createdAt: registered })
    // A password do WordPress é atualizada (pode ter mudado lá), exceto se a pessoa já entrou no site novo
    // (aí o hash já foi convertido para bcrypt "$2…" e é esse que vale).
    .onConflictDoUpdate({
      target: schema.users.wpId,
      set: {
        ...profile,
        passwordHash: sql`case when ${schema.users.passwordHash} like '$2%' then ${schema.users.passwordHash} else excluded.password_hash end`,
        updatedAt: new Date(),
      },
    })
    .returning({ id: schema.users.id });
  userIdByWp.set(wpId, row.id);
  seenAccounts.set(profile.username.toLowerCase(), row.id);
  seenAccounts.set(profile.email, row.id);
  bump("utilizadores importados");
}

/* ---------- Referências ---------- */
const cats = new Map((await db.select().from(schema.categories)).map((c) => [c.wpId, c.id]));
const fields = await db.select().from(schema.customFields);
const locs = await db.select().from(schema.locations);
const distritoBySlug = new Map(locs.filter((l) => !l.parentId).map((l) => [l.slug, l]));
const concelho = (dSlug: string, cSlug: string) => {
  const d = distritoBySlug.get(dSlug);
  return d && locs.find((l) => l.parentId === d.id && l.slug === cSlug);
};

/* ---------- Anúncios ---------- */
console.log("Anúncios…");
// Cliques em "ver telefone": a tabela de estatísticas do plugin é mais completa do que o postmeta.
const phoneStats = new Map<number, number>();
for (const r of rows("wp_rtcl_listing_stats")) {
  if (r.stat_key !== "reveal" && r.stat_key !== "phone_click") continue;
  const id = Number(r.listing_id);
  phoneStats.set(id, (phoneStats.get(id) ?? 0) + (Number(r.stat_count) || 0));
}
const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
function businessHours(raw: PhpValue): BusinessHours | null {
  if (!raw || typeof raw !== "object") return null;
  const out = {} as BusinessHours;
  for (const [i, key] of DAY_KEYS.entries()) {
    const d = (raw as Record<string, { open?: boolean; times?: { start: string; end: string }[] }>)[String(i)];
    const t = d?.times?.[0];
    out[key] = !d?.open ? { mode: "closed" } : t?.start && t?.end ? { mode: "hours", open: t.start, close: t.end } : { mode: "24h" };
  }
  return out;
}

for (const p of listingPosts) {
  const wpId = Number(p.ID);
  const tx = termsOf.get(wpId) ?? [];
  const catTerm = tx.find((t) => t.taxonomy === "rtcl_category");
  const locTerms = tx.filter((t) => t.taxonomy === "rtcl_location");
  const child = locTerms.find((t) => Number(t.parent) !== 0);
  // Em wp_term_taxonomy, "parent" é o term_id do distrito.
  const parent = child && terms.get(Number(child.parent));
  // Alguns anúncios antigos só têm distrito; nesse caso fica ligado ao distrito.
  const onlyDistrito = !child && locTerms[0] ? distritoBySlug.get(String(locTerms[0].slug)) : undefined;
  const location = (child && parent && concelho(String(parent.slug), String(child.slug))) || onlyDistrito;
  const userId = userIdByWp.get(Number(p.post_author));
  const categoryId = catTerm && cats.get(Number(catTerm.term_id));
  if (!location || !userId || !categoryId) { warn(`anúncio ${wpId} sem ${!location ? "localização" : !userId ? "autor" : "categoria"}; ignorado`); continue; }

  const priceRaw = pm(wpId, "price");
  const specs = maybeUnserialize(pm(wpId, "classima_spec_info")) as { specs?: string } | null;
  const features = (specs?.specs ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
  const title = decode(String(p.post_title)).trim();
  const description = autop(String(p.post_content ?? ""));
  const status = LISTING_STATUS[String(p.post_status)];
  // Um anúncio pendente sem validade nunca foi publicado: a data e a validade nascem quando for aprovado.
  const neverPublished = status === "pending" && !pm(wpId, "expiry_date");
  const publishedAt = neverPublished ? null : (wpDate(p.post_date_gmt) ?? wpDate(p.post_date));
  const expiresAt = wpDate(pm(wpId, "expiry_date")) ?? (publishedAt && new Date(publishedAt.getTime() + 120 * 86_400_000));
  const video = maybeUnserialize(pm(wpId, "_rtcl_video_urls"));

  const values = {
    userId,
    typeKey: pm(wpId, "ad_type") || "trespasse",
    categoryId,
    locationId: location.id,
    title,
    slug: String(p.post_name),
    description,
    priceType: (["fixed", "negotiable", "on_call"].includes(pm(wpId, "price_type") ?? "") ? pm(wpId, "price_type") : "fixed") as "fixed" | "negotiable" | "on_call",
    price: priceRaw ? Math.round(parseFloat(priceRaw)) : null,
    priceUnit: (["total", "month"].includes(pm(wpId, "_rtcl_price_unit") ?? "") ? pm(wpId, "_rtcl_price_unit") : null) as "total" | "month" | null,
    features,
    phone: pm(wpId, "phone") || null,
    whatsapp: pm(wpId, "_rtcl_whatsapp_number") || null,
    email: pm(wpId, "email") || null,
    website: pm(wpId, "website") || null,
    address: pm(wpId, "address") || null,
    zipcode: pm(wpId, "zipcode") || null,
    videoUrls: Array.isArray(video) ? (video as string[]).filter(Boolean) : [],
    businessHours: businessHours(maybeUnserialize(pm(wpId, "_rtcl_bhs"))),
    status,
    views: Number(pm(wpId, "_views") ?? 0) || 0,
    phoneClicks: Math.max(Number(pm(wpId, "_rtcl_phone_click") ?? 0) || 0, phoneStats.get(wpId) ?? 0),
    publishedAt,
    expiresAt,
    searchText: buildSearchText([title, description, features.join(" ")]),
    createdAt: wpDate(p.post_date_gmt) ?? new Date(),
    updatedAt: wpDate(p.post_modified_gmt) ?? new Date(),
  };
  const [listing] = await db
    .insert(schema.listings)
    .values({ wpId, ...values })
    .onConflictDoUpdate({ target: schema.listings.wpId, set: values })
    .returning({ id: schema.listings.id });
  bump({ published: "anúncios publicados", expired: "anúncios expirados", pending: "anúncios por aprovar" }[status]);

  // Campos personalizados: _field_{wpId}, uma linha por valor nas checkboxes.
  await db.delete(schema.listingFieldValues).where(eq(schema.listingFieldValues.listingId, listing.id));
  for (const f of fields) {
    const raw = pmAll(wpId, `_field_${f.wpId}`);
    if (!raw.length) continue;
    const value = f.type === "checkbox" ? raw : f.type === "number" ? Number(raw[0]) : raw[0];
    if (typeof value === "number" && Number.isNaN(value)) continue;
    await db.insert(schema.listingFieldValues).values({ listingId: listing.id, fieldId: f.id, value });
    bump("valores de campos");
  }

  // Fotos pela ordem do anúncio.
  const order = maybeUnserialize(pm(wpId, "_rtcl_attachments_order"));
  const attIds = Array.isArray(order) && order.length
    ? (order as number[]).map(Number)
    : rows("wp_posts").filter((a) => a.post_type === "attachment" && Number(a.post_parent) === wpId).map((a) => Number(a.ID));
  await db.delete(schema.listingImages).where(eq(schema.listingImages.listingId, listing.id));
  for (const [sort, attId] of attIds.entries()) {
    const file = attachedFile(attId);
    if (!file) { warn(`anexo ${attId} do anúncio ${wpId} sem ficheiro`); continue; }
    const key = `listings/${listing.id}/${attId}`;
    const dims = await importImage(key, file);
    if (dims) await db.insert(schema.listingImages).values({ listingId: listing.id, storageKey: key, width: dims.width || null, height: dims.height || null, sort, wpAttachmentId: attId });
  }
}

/* ---------- Blog ---------- */
console.log("Artigos do blog…");
const UPLOAD_URL = /https?:\/\/(?:www\.)?portaldotrespasse\.pt\/wp-content\/uploads\/([^"'\s)]+?)(?:-\d+x\d+)?(\.(?:jpe?g|png|webp|gif))/gi;
async function rewriteContentImages(html: string, postId: number): Promise<string> {
  const found = [...html.matchAll(UPLOAD_URL)];
  for (const m of found) {
    const file = m[1] + m[2];
    const key = `blog/${postId}/${file.replace(/[^\w.-]+/g, "_").replace(/\.\w+$/, "")}`;
    if (await importImage(key, file)) html = html.split(m[0]).join(mediaUrl(key, 1600));
  }
  // srcset do WordPress aponta para tamanhos que deixam de existir.
  return html.replace(/\s(srcset|sizes)="[^"]*"/g, "");
}
const yoast = (v: string | undefined) => (v && !v.includes("%%") ? v : null);

for (const p of rows("wp_posts").filter((x) => x.post_type === "post" && ["publish", "draft"].includes(String(x.post_status)))) {
  const draft = p.post_status === "draft";
  const wpId = Number(p.ID);
  const thumb = Number(pm(wpId, "_thumbnail_id") ?? 0);
  let featuredImageKey: string | null = null;
  if (thumb && attachedFile(thumb)) {
    const key = `blog/${wpId}/destaque-${thumb}`;
    if (await importImage(key, attachedFile(thumb)!)) featuredImageKey = key;
  }
  const contentHtml = await rewriteContentImages(autop(String(p.post_content ?? "")), wpId);
  const tags = (termsOf.get(wpId) ?? []).filter((t) => t.taxonomy === "post_tag").map((t) => decode(String(t.name)));
  const values = {
    slug: String(p.post_name),
    title: decode(String(p.post_title)).trim(),
    excerpt: String(p.post_excerpt ?? "").trim() || excerpt(contentHtml, 220),
    contentHtml,
    featuredImageKey,
    tags,
    status: (draft ? "draft" : "published") as "draft" | "published",
    seoTitle: yoast(pm(wpId, "_yoast_wpseo_title")),
    seoDescription: yoast(pm(wpId, "_yoast_wpseo_metadesc")),
    authorId: userIdByWp.get(Number(p.post_author)) ?? null,
    publishedAt: draft ? null : wpDate(p.post_date_gmt),
    createdAt: wpDate(p.post_date_gmt) ?? wpDate(p.post_modified_gmt) ?? new Date(),
    updatedAt: wpDate(p.post_modified_gmt) ?? new Date(),
  };
  await db.insert(schema.posts).values({ wpId, ...values }).onConflictDoUpdate({ target: schema.posts.wpId, set: values });
  bump(draft ? "artigos em rascunho" : "artigos");
}

/* ---------- Mensagens do formulário de contacto (Elementor) ---------- */
console.log("Mensagens de contacto…");
const subValues = new Map<number, Record<string, string>>();
for (const v of rows("wp_e_submissions_values")) {
  const id = Number(v.submission_id);
  subValues.set(id, { ...subValues.get(id), [String(v.key)]: String(v.value ?? "") });
}
for (const sub of rows("wp_e_submissions")) {
  const v = subValues.get(Number(sub.id)) ?? {};
  const createdAt = wpDate(sub.created_at_gmt);
  if (!v.email || !v.message || !createdAt) continue;
  const M = schema.messages;
  // Sem wp_id nesta tabela: a mesma mensagem é reconhecida pelo email e pela data.
  const exists = await db.query.messages.findFirst({ where: and(eq(M.kind, "site_contact"), eq(M.email, v.email.trim().toLowerCase()), eq(M.createdAt, createdAt)) });
  if (exists) { bump("mensagens já importadas"); continue; }
  // O IP não é migrado (não faz falta e é um dado pessoal).
  await db.insert(M).values({ kind: "site_contact", name: v.name?.trim() || "Sem nome", email: v.email.trim().toLowerCase(), body: v.message.trim(), createdAt });
  bump("mensagens de contacto");
}


console.log("\nImportação concluída:");
for (const [k, v] of Object.entries(stats)) console.log(`  ${k}: ${v}`);
await closeDb();
