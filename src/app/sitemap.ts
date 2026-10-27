import type { MetadataRoute } from "next";
import { desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getCounts, getTaxonomies, PUBLIC_STATUSES } from "@/lib/listings/queries";
import { absoluteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = getDb();
  const [tax, counts, listings, posts, pages] = await Promise.all([
    getTaxonomies(),
    getCounts(),
    db.select({ slug: schema.listings.slug, updatedAt: schema.listings.updatedAt, locationId: schema.listings.locationId })
      .from(schema.listings).where(inArray(schema.listings.status, [...PUBLIC_STATUSES])).orderBy(desc(schema.listings.publishedAt)),
    db.select({ slug: schema.posts.slug, updatedAt: schema.posts.updatedAt }).from(schema.posts).where(eq(schema.posts.status, "published")),
    db.select({ slug: schema.pages.slug, updatedAt: schema.pages.updatedAt }).from(schema.pages).where(eq(schema.pages.status, "published")),
  ]);
  const url = (path: string, lastModified?: Date, priority?: number): MetadataRoute.Sitemap[number] => ({ url: absoluteUrl(path), lastModified, priority });

  // Localizações: só as que têm anúncios (as vazias são páginas sem conteúdo para o Google).
  const usedLocations = new Set(listings.map((l) => l.locationId));
  const locationUrls = tax.distritos.flatMap((d) => [
    ...(counts.distrito.get(d.id) ? [url(`/listing-location/${d.slug}/`, undefined, 0.5)] : []),
    ...d.concelhos.filter((c) => usedLocations.has(c.id)).map((c) => url(`/listing-location/${d.slug}/${c.slug}/`, undefined, 0.4)),
  ]);

  return [
    url("/", undefined, 1),
    url("/all-ads/", listings[0]?.updatedAt, 0.9),
    url("/blog/", undefined, 0.6),
    url("/contact/", undefined, 0.3),
    ...tax.categories.map((c) => url(`/listing-category/${c.slug}/`, undefined, counts.category.get(c.id) ? 0.7 : 0.3)),
    ...locationUrls,
    ...listings.map((l) => url(`/listing/${l.slug}/`, l.updatedAt, 0.8)),
    ...pages.map((p) => url(`/${p.slug}/`, p.updatedAt, 0.4)),
    ...posts.map((p) => url(`/${p.slug}/`, p.updatedAt, 0.5)),
  ];
}
