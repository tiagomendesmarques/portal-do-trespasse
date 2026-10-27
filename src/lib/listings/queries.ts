import { cache } from "react";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, ne, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { formatNumber } from "@/lib/format";
import { excerpt } from "@/lib/text";
import { searchTerms, type ListingFilters } from "./filters";

const { listings: L, listingImages: I, categories: C, locations: Loc, users: U, listingTypes: LT } = schema;

/** Estados visíveis ao público: os vendidos continuam visíveis com a etiqueta "Vendido". */
export const PUBLIC_STATUSES = ["published", "sold"] as const;

/* ---------- Taxonomias (memorizadas por pedido) ---------- */

export const getTaxonomies = cache(async () => {
  const db = getDb();
  const [types, categories, locations, fields] = await Promise.all([
    db.select().from(LT).where(eq(LT.active, true)).orderBy(asc(LT.sort)),
    db.select().from(C).where(eq(C.active, true)).orderBy(asc(C.sort)),
    db.select().from(Loc).orderBy(asc(Loc.sort)),
    db.select().from(schema.customFields).where(eq(schema.customFields.active, true)).orderBy(asc(schema.customFields.sort)),
  ]);
  const distritos = locations
    .filter((l) => !l.parentId)
    .map((d) => ({ ...d, concelhos: locations.filter((c) => c.parentId === d.id).sort((a, b) => a.name.localeCompare(b.name, "pt")) }));
  return { types, categories, distritos, locations, fields };
});

/** Contagem de anúncios públicos por categoria e por distrito. */
export const getCounts = cache(async () => {
  const db = getDb();
  const pub = inArray(L.status, [...PUBLIC_STATUSES]);
  const [byCat, byLoc] = await Promise.all([
    db.select({ id: L.categoryId, n: sql<number>`count(*)::int` }).from(L).where(pub).groupBy(L.categoryId),
    db
      .select({ id: sql<number>`coalesce(${Loc.parentId}, ${Loc.id})`, n: sql<number>`count(*)::int` })
      .from(L)
      .innerJoin(Loc, eq(Loc.id, L.locationId))
      .where(pub)
      .groupBy(sql`coalesce(${Loc.parentId}, ${Loc.id})`),
  ]);
  return {
    category: new Map(byCat.map((r) => [r.id, r.n])),
    distrito: new Map(byLoc.map((r) => [r.id, r.n])),
    total: byCat.reduce((a, r) => a + r.n, 0),
  };
});

/* ---------- Cartões de anúncio ---------- */

export type ListingCard = Awaited<ReturnType<typeof toCards>>[number];

export async function toCards(ids: number[]) {
  if (!ids.length) return [];
  const db = getDb();
  const D = schema.locations;
  const rows = await db
    .select({
      id: L.id,
      slug: L.slug,
      title: L.title,
      description: L.description,
      price: L.price,
      priceType: L.priceType,
      priceUnit: L.priceUnit,
      typeKey: L.typeKey,
      status: L.status,
      views: L.views,
      publishedAt: L.publishedAt,
      featuredUntil: L.featuredUntil,
      categoryName: C.name,
      categorySlug: C.slug,
      locationName: Loc.name,
      locationLevel: Loc.level,
      // Alias explícito: ${D.name} seria resolvido para a tabela de fora (o próprio concelho).
      distritoName: sql<string | null>`(select d.name from ${D} d where d.id = ${Loc.parentId})`,
      authorName: U.displayName,
      imageKey: sql<string | null>`(select ${I.storageKey} from ${I} where ${I.listingId} = ${L.id} order by ${I.sort} limit 1)`,
      imageCount: sql<number>`(select count(*)::int from ${I} where ${I.listingId} = ${L.id})`,
      urgent: sql<boolean>`exists (select 1 from ${schema.listingFieldValues} v join ${schema.customFields} f on f.id = v.field_id where v.listing_id = ${L.id} and f.key = 'venda-urgente')`,
    })
    .from(L)
    .innerJoin(C, eq(C.id, L.categoryId))
    .innerJoin(Loc, eq(Loc.id, L.locationId))
    .innerJoin(U, eq(U.id, L.userId))
    .where(inArray(L.id, ids));
  const { "listings.newLabelDays": newDays, "listings.popularViews": popular } = await getSettings(["listings.newLabelDays", "listings.popularViews"]);
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id)!)
    .filter(Boolean)
    .map(({ description, ...r }) => ({
      ...r,
      excerpt: excerpt(description, 170),
      place: r.locationLevel === "distrito" ? r.locationName : `${r.locationName}, ${r.distritoName}`,
      isNew: Boolean(r.publishedAt && Date.now() - r.publishedAt.getTime() < newDays * 86_400_000),
      isPopular: r.views >= popular,
      isFeatured: Boolean(r.featuredUntil && r.featuredUntil > new Date()),
    }));
}

/* ---------- Pesquisa ---------- */

export async function searchListings(f: ListingFilters, perPageOverride?: number) {
  const db = getDb();
  const tax = await getTaxonomies();
  const perPage = perPageOverride ?? (await getSettings(["listings.perPage"]))["listings.perPage"];
  const where: SQL[] = [inArray(L.status, [...PUBLIC_STATUSES])];

  if (f.type) where.push(eq(L.typeKey, f.type));
  if (f.author) where.push(eq(L.userId, f.author));
  if (f.category) {
    const cat = tax.categories.find((c) => c.slug === f.category);
    where.push(eq(L.categoryId, cat?.id ?? -1));
  }
  if (f.distrito) {
    const d = tax.distritos.find((x) => x.slug === f.distrito);
    const conc = f.concelho ? d?.concelhos.find((c) => c.slug === f.concelho) : null;
    if (conc) where.push(eq(L.locationId, conc.id));
    else where.push(inArray(L.locationId, d ? [d.id, ...d.concelhos.map((c) => c.id)] : [-1]));
  }
  if (f.priceMin != null) where.push(gte(L.price, f.priceMin));
  if (f.priceMax != null) where.push(lte(L.price, f.priceMax));
  for (const term of searchTerms(f.q)) where.push(ilike(L.searchText, `%${term}%`));
  for (const ff of f.fields) {
    const def = tax.fields.find((x) => x.key === ff.key && x.searchable);
    if (!def) continue;
    const conds: SQL[] = [sql`v.field_id = ${def.id}`];
    if (ff.equals) conds.push(sql`(v.value = to_jsonb(${ff.equals}::text) or v.value @> to_jsonb(array[${ff.equals}::text]))`);
    if (ff.min != null) conds.push(sql`jsonb_typeof(v.value) = 'number' and (v.value)::numeric >= ${ff.min}`);
    if (ff.max != null) conds.push(sql`jsonb_typeof(v.value) = 'number' and (v.value)::numeric <= ${ff.max}`);
    where.push(sql`exists (select 1 from ${schema.listingFieldValues} v where v.listing_id = ${L.id} and ${and(...conds)})`);
  }

  const order = {
    "date-desc": [desc(L.publishedAt)],
    "date-asc": [asc(L.publishedAt)],
    "price-asc": [sql`${L.price} asc nulls last`],
    "price-desc": [sql`${L.price} desc nulls last`],
    "views-desc": [desc(L.views)],
    "views-asc": [asc(L.views)],
    "title-asc": [sql`lower(${L.title}) asc`],
    "title-desc": [sql`lower(${L.title}) desc`],
  }[f.sort];

  const cond = and(...where);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(L).where(cond);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(f.page, pages);
  const ids = await db
    .select({ id: L.id })
    .from(L)
    .where(cond)
    // Destacados primeiro (quando houver planos), depois a ordenação escolhida.
    .orderBy(sql`(${L.featuredUntil} > now()) desc nulls last`, ...order, desc(L.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  return { items: await toCards(ids.map((r) => r.id)), total, page, pages, perPage };
}

export async function latestListings(limit: number) {
  const ids = await getDb()
    .select({ id: L.id })
    .from(L)
    .where(eq(L.status, "published"))
    .orderBy(desc(L.publishedAt))
    .limit(limit);
  return toCards(ids.map((r) => r.id));
}

/* ---------- Página do anúncio ---------- */

export async function getListingBySlug(slug: string) {
  const db = getDb();
  const [row] = await db
    .select({ listing: L, category: C, location: Loc, type: LT, author: U })
    .from(L)
    .innerJoin(C, eq(C.id, L.categoryId))
    .innerJoin(Loc, eq(Loc.id, L.locationId))
    .innerJoin(LT, eq(LT.key, L.typeKey))
    .innerJoin(U, eq(U.id, L.userId))
    .where(eq(L.slug, slug))
    .limit(1);
  if (!row) return null;
  const [images, values, distrito, authorCount] = await Promise.all([
    db.select().from(I).where(eq(I.listingId, row.listing.id)).orderBy(asc(I.sort)),
    db
      .select({ value: schema.listingFieldValues.value, field: schema.customFields })
      .from(schema.listingFieldValues)
      .innerJoin(schema.customFields, eq(schema.customFields.id, schema.listingFieldValues.fieldId))
      .where(and(eq(schema.listingFieldValues.listingId, row.listing.id), eq(schema.customFields.listable, true)))
      .orderBy(asc(schema.customFields.sort)),
    row.location.parentId ? db.query.locations.findFirst({ where: eq(Loc.id, row.location.parentId) }) : Promise.resolve(row.location),
    db.select({ n: sql<number>`count(*)::int` }).from(L).where(and(eq(L.userId, row.author.id), inArray(L.status, [...PUBLIC_STATUSES]))),
  ]);
  const { passwordHash: _ignored, ...author } = row.author;
  void _ignored;
  return {
    ...row,
    author: { ...author, publicListings: authorCount[0].n },
    images,
    distrito: distrito ?? row.location,
    concelho: row.location.parentId ? row.location : null,
    // Como no WordPress, números a zero não aparecem (ex.: "0 trabalhadores sem termo").
    fields: values
      .filter((v) => v.value !== 0 && !(Array.isArray(v.value) && v.value.length === 0))
      .map((v) => ({ ...v.field, value: v.value, display: displayValue(v.field, v.value) })),
  };
}
export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListingBySlug>>>;

/** Valor legível de um campo: rótulos das opções, números com separador de milhares, € quando é dinheiro. */
export function displayValue(field: { type: string; options: { value: string; label: string }[]; icon: string | null }, value: unknown): string {
  const label = (v: string) => field.options.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) return value.map((v) => label(String(v))).join(", ");
  if (typeof value === "number") return field.icon === "money" ? `${formatNumber(value)} €` : formatNumber(value);
  return label(String(value));
}


export async function relatedListings(listingId: number, categoryId: number, limit = 4) {
  const ids = await getDb()
    .select({ id: L.id })
    .from(L)
    .where(and(eq(L.categoryId, categoryId), ne(L.id, listingId), eq(L.status, "published")))
    .orderBy(desc(L.publishedAt))
    .limit(limit);
  return toCards(ids.map((r) => r.id));
}

export async function countView(listingId: number) {
  await getDb().update(L).set({ views: sql`${L.views} + 1` }).where(eq(L.id, listingId));
}

export async function findLocationBySlugs(distritoSlug: string, concelhoSlug?: string) {
  const db = getDb();
  const d = await db.query.locations.findFirst({ where: and(isNull(Loc.parentId), eq(Loc.slug, distritoSlug)) });
  if (!d || !concelhoSlug) return d ? { distrito: d, concelho: null } : null;
  const c = await db.query.locations.findFirst({ where: and(eq(Loc.parentId, d.id), eq(Loc.slug, concelhoSlug)) });
  return c ? { distrito: d, concelho: c } : null;
}


