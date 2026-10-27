import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSettings } from "@/lib/settings";
import { slugify } from "@/lib/slug";
import { buildSearchText } from "@/lib/text";
import { htmlToText, textToHtml } from "./description";
import { getTaxonomies } from "./queries";
import type { FieldDef, ValidListing } from "./validation";

/** Tudo o que o formulário de publicação precisa (enviado ao componente cliente). */
export async function loadFormContext() {
  const [tax, limits] = await Promise.all([
    getTaxonomies(),
    getSettings(["listings.titleMax", "listings.descriptionMax", "listings.maxImages", "listings.maxImageMb"]),
  ]);
  return {
    types: tax.types.map((t) => ({ key: t.key, name: t.name, description: t.description ?? "" })),
    categories: tax.categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug })),
    distritos: tax.distritos.map((d) => ({ id: d.id, name: d.name, concelhos: d.concelhos.map((c) => ({ id: c.id, name: c.name })) })),
    fields: tax.fields.map((f) => ({
      id: f.id, key: f.key, label: f.label, type: f.type, options: f.options, required: f.required, help: f.help, placeholder: f.placeholder,
      min: f.min, max: f.max, condition: f.condition ?? null, section: f.section, money: f.icon === "money",
      listingTypes: f.listingTypes, categoryIds: f.categoryIds,
    })),
    limits: {
      titleMax: limits["listings.titleMax"], descriptionMax: limits["listings.descriptionMax"],
      maxImages: limits["listings.maxImages"], maxImageMb: limits["listings.maxImageMb"],
    },
  };
}
export type FormContext = Awaited<ReturnType<typeof loadFormContext>>;

export { applicableFields } from "./validation";

export function asFieldDefs(fields: FormContext["fields"]): FieldDef[] {
  return fields.map((f) => ({ ...f, type: f.type as FieldDef["type"] }));
}

/** Valores iniciais para editar um anúncio existente. */
export async function listingForEdit(id: number) {
  const db = getDb();
  const l = await db.query.listings.findFirst({ where: eq(schema.listings.id, id) });
  if (!l) return null;
  const [images, values, fields] = await Promise.all([
    db.select().from(schema.listingImages).where(eq(schema.listingImages.listingId, id)).orderBy(asc(schema.listingImages.sort)),
    db.select().from(schema.listingFieldValues).where(eq(schema.listingFieldValues.listingId, id)),
    db.select({ id: schema.customFields.id, key: schema.customFields.key }).from(schema.customFields),
  ]);
  const keyById = new Map(fields.map((f) => [f.id, f.key]));
  const loc = await db.query.locations.findFirst({ where: eq(schema.locations.id, l.locationId) });
  return {
    listing: l,
    initial: {
      typeKey: l.typeKey,
      categoryId: l.categoryId,
      distritoId: loc?.parentId ?? loc?.id ?? 0,
      locationId: l.locationId,
      title: l.title,
      description: htmlToText(l.description),
      priceType: l.priceType,
      price: l.price != null ? String(l.price) : "",
      priceUnit: l.priceUnit ?? "",
      phone: l.phone ?? "",
      features: l.features.join("\n"),
      images: images.map((i) => i.storageKey),
      fields: Object.fromEntries(values.map((v) => [keyById.get(v.fieldId)!, Array.isArray(v.value) ? v.value : String(v.value)])),
    },
  };
}
export type ListingInitial = NonNullable<Awaited<ReturnType<typeof listingForEdit>>>["initial"];

async function uniqueSlug(title: string, ignoreId?: number): Promise<string> {
  const base = slugify(title).slice(0, 80).replace(/-+$/, "") || "anuncio";
  const taken = await getDb()
    .select({ slug: schema.listings.slug, id: schema.listings.id })
    .from(schema.listings)
    .where(sql`${schema.listings.slug} = ${base} or ${schema.listings.slug} like ${base + "-%"}`);
  const used = new Set(taken.filter((t) => t.id !== ignoreId).map((t) => t.slug));
  if (!used.has(base)) return base;
  for (let n = 2; ; n++) if (!used.has(`${base}-${n}`)) return `${base}-${n}`;
}

/** Grava (cria ou atualiza) um anúncio validado. Devolve o anúncio gravado. */
export async function saveListing(userId: number, data: ValidListing, opts: { editId?: number; status: "pending" | "published"; durationDays: number }) {
  const db = getDb();
  const description = textToHtml(data.description);
  const now = new Date();
  const base = {
    typeKey: data.typeKey, categoryId: data.categoryId, locationId: data.locationId, title: data.title, description,
    priceType: data.priceType, price: data.price, priceUnit: data.priceUnit, phone: data.phone, features: data.features,
    searchText: buildSearchText([data.title, description, data.features.join(" ")]), status: opts.status, updatedAt: now,
    ...(opts.status === "published" ? { publishedAt: now, expiresAt: new Date(now.getTime() + opts.durationDays * 86_400_000) } : {}),
  };

  const listing = opts.editId
    ? (await db.update(schema.listings).set(base).where(and(eq(schema.listings.id, opts.editId), eq(schema.listings.userId, userId))).returning())[0]
    : (await db.insert(schema.listings).values({ ...base, userId, slug: await uniqueSlug(data.title) }).returning())[0];
  if (!listing) throw new Error("Anúncio não encontrado.");

  await db.delete(schema.listingFieldValues).where(eq(schema.listingFieldValues.listingId, listing.id));
  if (data.values.length) await db.insert(schema.listingFieldValues).values(data.values.map((v) => ({ listingId: listing.id, ...v })));

  // Mantém dimensões e ID do WordPress das fotos que já existiam.
  const old = await db.select().from(schema.listingImages).where(eq(schema.listingImages.listingId, listing.id));
  const byKey = new Map(old.map((o) => [o.storageKey, o]));
  await db.delete(schema.listingImages).where(eq(schema.listingImages.listingId, listing.id));
  if (data.images.length) {
    await db.insert(schema.listingImages).values(
      data.images.map((storageKey, sort) => ({ listingId: listing.id, storageKey, sort, width: byKey.get(storageKey)?.width ?? null, height: byKey.get(storageKey)?.height ?? null, wpAttachmentId: byKey.get(storageKey)?.wpAttachmentId ?? null })),
    );
  }
  return listing;
}

/** Anúncios que contam para o limite do plano grátis. */
export async function activeListingCount(userId: number) {
  const [r] = await getDb()
    .select({ n: sql<number>`count(*)::int` })
    .from(schema.listings)
    .where(and(eq(schema.listings.userId, userId), inArray(schema.listings.status, ["pending", "published"])));
  return r.n;
}
