import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

const L = schema.listings;

export async function myListings(userId: number) {
  const db = getDb();
  return db
    .select({
      id: L.id, slug: L.slug, title: L.title, status: L.status, price: L.price, priceType: L.priceType, priceUnit: L.priceUnit,
      views: L.views, phoneClicks: L.phoneClicks, publishedAt: L.publishedAt, expiresAt: L.expiresAt, createdAt: L.createdAt,
      rejectionReason: L.rejectionReason, categoryName: schema.categories.name,
      imageKey: sql<string | null>`(select storage_key from listing_images i where i.listing_id = ${L.id} order by sort limit 1)`,
      messages: sql<number>`(select count(*)::int from messages m where m.listing_id = ${L.id})`,
      favorites: sql<number>`(select count(*)::int from favorites f where f.listing_id = ${L.id})`,
    })
    .from(L)
    .innerJoin(schema.categories, eq(schema.categories.id, L.categoryId))
    .where(eq(L.userId, userId))
    .orderBy(desc(L.createdAt));
}

export async function accountCounts(userId: number) {
  const db = getDb();
  const [[listings], [favs], [msgs]] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(L).where(eq(L.userId, userId)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.favorites).where(eq(schema.favorites.userId, userId)),
    db.select({ n: sql<number>`count(*)::int` }).from(schema.messages).where(eq(schema.messages.toUserId, userId)),
  ]);
  return { anuncios: listings.n, favoritos: favs.n, mensagens: msgs.n };
}

export async function myFavoriteIds(userId: number) {
  const rows = await getDb()
    .select({ id: schema.favorites.listingId })
    .from(schema.favorites)
    .innerJoin(L, eq(L.id, schema.favorites.listingId))
    .where(and(eq(schema.favorites.userId, userId), inArray(L.status, ["published", "sold"])))
    .orderBy(desc(schema.favorites.createdAt));
  return rows.map((r) => r.id);
}

export async function myMessages(userId: number) {
  return getDb()
    .select({ id: schema.messages.id, name: schema.messages.name, email: schema.messages.email, phone: schema.messages.phone, body: schema.messages.body, createdAt: schema.messages.createdAt, listingTitle: L.title, listingSlug: L.slug })
    .from(schema.messages)
    .leftJoin(L, eq(L.id, schema.messages.listingId))
    .where(eq(schema.messages.toUserId, userId))
    .orderBy(desc(schema.messages.createdAt))
    .limit(200);
}
