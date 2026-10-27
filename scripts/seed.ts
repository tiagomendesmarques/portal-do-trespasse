// Dados de referência. Idempotente: pode correr várias vezes.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/db";
import { PAGES } from "../src/content/pages";
import { EMAIL_TEMPLATES } from "../src/lib/email/defaults";
import { SETTINGS_DEFAULTS } from "../src/lib/settings-defaults";
import { slugify } from "../src/lib/slug";

const db = getDb();
const read = <T>(f: string): T => JSON.parse(readFileSync(resolve(process.cwd(), "data", f), "utf8"));

/* Tipos de anúncio */
const TYPES = [
  { key: "trespasse", name: "Trespasse", description: "Passar o negócio em funcionamento, com ou sem arrendamento.", sort: 0 },
  { key: "venda_de_ativos", name: "Venda de Ativos", description: "Venda de empresa, quota, carteira de clientes ou equipamento.", sort: 1 },
  { key: "aluguer_de_ativos", name: "Aluguer de Ativos", description: "Arrendar espaço, equipamento ou outro ativo do negócio.", sort: 2 },
  { key: "investimentos", name: "Investimentos", description: "Procura de sócio ou investidor para um negócio.", sort: 3 },
];
for (const t of TYPES) {
  await db.insert(schema.listingTypes).values(t).onConflictDoUpdate({ target: schema.listingTypes.key, set: { name: t.name, sort: t.sort } });
}

/* Categorias */
type Cat = { nome: string; slug_novo: string; slug_wordpress: string; id_wordpress: number; icone_wp: string };
const cats = read<Cat[]>("categorias.json");
for (const [i, c] of cats.entries()) {
  const name = c.nome === "Industria Alimentar" ? "Indústria Alimentar" : c.nome;
  await db
    .insert(schema.categories)
    .values({ wpId: c.id_wordpress, name, slug: c.slug_novo, wpSlug: c.slug_wordpress, icon: c.icone_wp, sort: i })
    .onConflictDoUpdate({ target: schema.categories.slug, set: { name, wpId: c.id_wordpress, wpSlug: c.slug_wordpress, icon: c.icone_wp } });
}

/* Localizações: 18 distritos do WordPress + Ourém + Açores + Madeira */
type Loc = { name: string; slug: string; sub: { name: string; slug: string }[] };
const locs = read<Loc[]>("localizacoes.json");
const santarem = locs.find((d) => d.name === "Santarém");
if (santarem && !santarem.sub.some((s) => s.name === "Ourém")) santarem.sub.push({ name: "Ourém", slug: "ourem" });
const ACORES = ["Angra do Heroísmo", "Calheta (São Jorge)", "Corvo", "Horta", "Lagoa (Açores)", "Lajes das Flores", "Lajes do Pico", "Madalena", "Nordeste", "Ponta Delgada", "Povoação", "Praia da Vitória", "Ribeira Grande", "Santa Cruz da Graciosa", "Santa Cruz das Flores", "São Roque do Pico", "Velas", "Vila do Porto", "Vila Franca do Campo"];
const MADEIRA = ["Calheta (Madeira)", "Câmara de Lobos", "Funchal", "Machico", "Ponta do Sol", "Porto Moniz", "Porto Santo", "Ribeira Brava", "Santa Cruz", "Santana", "São Vicente"];
locs.push({ name: "Açores", slug: "acores", sub: ACORES.map((n) => ({ name: n, slug: slugify(n) })) });
locs.push({ name: "Madeira", slug: "madeira", sub: MADEIRA.map((n) => ({ name: n, slug: slugify(n) })) });

let concelhos = 0;
for (const [i, d] of locs.entries()) {
  const [row] = await db
    .insert(schema.locations)
    .values({ level: "distrito", name: d.name, slug: d.slug, sort: i })
    .onConflictDoNothing()
    .returning();
  const distrito = row ?? (await db.query.locations.findFirst({ where: (l, { and, eq, isNull }) => and(isNull(l.parentId), eq(l.slug, d.slug)) }))!;
  for (const [j, c] of [...d.sub].sort((a, b) => a.name.localeCompare(b.name, "pt")).entries()) {
    await db
      .insert(schema.locations)
      .values({ level: "concelho", parentId: distrito.id, name: c.name, slug: c.slug, sort: j })
      .onConflictDoNothing();
    concelhos++;
  }
}

/* Campos personalizados (definições exatas do WordPress, com rótulos corrigidos) */
type Field = {
  wp_id: number; ordem: number; rotulo: string; slug: string | null; tipo: string; opcoes: Record<string, string> | null;
  obrigatorio: boolean; pesquisavel: boolean; listavel: boolean; ajuda: string | null; placeholder: string | null; icone: string | null;
  minimo: string | null; condicao: { campo_wp_id: number; valor: string } | null;
};
const LABEL_FIX: Record<string, string> = { "Tipo de negócio.": "Tipo de negócio", "Faturação média Anual": "Faturação média anual", "Negócio Sazonal": "Negócio sazonal", "Venda Urgente?": "Venda urgente?" };
const KEY_FALLBACK: Record<number, string> = { 2989: "depende-fornecedores", 2701: "presenca" };
const fields = read<Field[]>("campos_personalizados.json");
const idByWp = new Map<number, number>();
for (const f of fields) {
  const values = {
    wpId: f.wp_id,
    key: f.slug ?? KEY_FALLBACK[f.wp_id] ?? `campo-${f.wp_id}`,
    label: LABEL_FIX[f.rotulo] ?? f.rotulo,
    type: f.tipo as "number" | "radio" | "checkbox",
    options: Object.entries(f.opcoes ?? {}).map(([value, label]) => ({ value, label })),
    required: f.obrigatorio,
    searchable: f.pesquisavel,
    listable: f.listavel,
    help: f.ajuda?.replace(/\r\n/g, " ").replace("A valor do trespasse", "O valor do trespasse") ?? null,
    placeholder: f.placeholder,
    icon: f.icone,
    min: f.minimo ? Number(f.minimo) : null,
    sort: f.ordem,
  };
  const [row] = await db
    .insert(schema.customFields)
    .values(values)
    .onConflictDoUpdate({ target: schema.customFields.wpId, set: values })
    .returning();
  idByWp.set(f.wp_id, row.id);
}
for (const f of fields.filter((x) => x.condicao)) {
  await db
    .update(schema.customFields)
    .set({ condition: { fieldId: idByWp.get(f.condicao!.campo_wp_id)!, operator: "==", value: f.condicao!.valor } })
    .where(sql`${schema.customFields.wpId} = ${f.wp_id}`);
}

/* Definições */
for (const [key, value] of Object.entries(SETTINGS_DEFAULTS)) {
  await db.insert(schema.settings).values({ key, value }).onConflictDoNothing();
}

/* Modelos de email (não substitui textos já editados no back-office) */
for (const t of EMAIL_TEMPLATES) {
  await db.insert(schema.emailTemplates).values(t).onConflictDoNothing();
}

/* Páginas institucionais (não substitui textos já editados no back-office) */
for (const p of PAGES) {
  await db.insert(schema.pages).values(p).onConflictDoNothing();
}

/* Redirects do site antigo */
const REDIRECTS: [string, string, string][] = [
  ["/listing-category/tecnologia/", "/listing-category/imobiliario/", "Categoria Imobiliário tinha o slug tecnologia"],
  ["/faq-2/", "/faq/", "FAQ real passa para /faq/"],
  ["/about-us/", "/", "Página demo do tema"],
  ["/stores/", "/", "Lojas demo do tema"],
  ["/shop/", "/", "WooCommerce não usado"],
  ["/cart/", "/", "WooCommerce não usado"],
  ["/checkout/", "/", "Checkout do plugin não usado"],
  ["/checkout-2/", "/", "WooCommerce não usado"],
  ["/compare/", "/all-ads/", "Comparador desligado"],
  ["/my-account-2/", "/my-account/", "Página duplicada"],
];
for (const [fromPath, toPath, note] of REDIRECTS) {
  await db.insert(schema.redirects).values({ fromPath, toPath, note }).onConflictDoNothing();
}

console.log(`Seed concluído: ${TYPES.length} tipos, ${cats.length} categorias, ${locs.length} distritos, ${concelhos} concelhos, ${fields.length} campos, ${EMAIL_TEMPLATES.length} modelos de email, ${REDIRECTS.length} redirects, ${PAGES.length} páginas.`);
await closeDb();
