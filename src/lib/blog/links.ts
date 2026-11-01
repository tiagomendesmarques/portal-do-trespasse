import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Páginas fixas do site para onde um artigo pode ligar. */
export const USEFUL_LINKS = [
  { title: "Todos os anúncios", url: "/all-ads/" },
  { title: "Publicar anúncio (grátis)", url: "/post-an-ad/" },
  { title: "Blog", url: "/blog/" },
  { title: "Contactos", url: "/contact/" },
  { title: "Página inicial", url: "/" },
];

/**
 * Tudo o que existe no site e pode receber ligações: páginas, artigos publicados, categorias,
 * distritos/concelhos, anúncios públicos e endereços antigos com redirect.
 */
export async function siteLinks() {
  const db = getDb();
  const [pages, posts, cats, locs, listings, redirects] = await Promise.all([
    db.select({ slug: schema.pages.slug, title: schema.pages.title }).from(schema.pages).where(eq(schema.pages.status, "published")),
    db.select({ slug: schema.posts.slug, title: schema.posts.title, focusKeyword: schema.posts.focusKeyword, publishedAt: schema.posts.publishedAt, status: schema.posts.status })
      .from(schema.posts).orderBy(desc(schema.posts.publishedAt)),
    db.select({ slug: schema.categories.slug, name: schema.categories.name }).from(schema.categories).where(eq(schema.categories.active, true)),
    db.select({ id: schema.locations.id, slug: schema.locations.slug, name: schema.locations.name, parentId: schema.locations.parentId }).from(schema.locations),
    db.select({ slug: schema.listings.slug }).from(schema.listings).where(inArray(schema.listings.status, ["published", "sold"])),
    db.select({ fromPath: schema.redirects.fromPath }).from(schema.redirects),
  ]);
  const distritos = locs.filter((l) => !l.parentId);
  const bySlug = new Map(distritos.map((d) => [d.id, d.slug]));

  const paths = new Set<string>([
    ...USEFUL_LINKS.map((l) => l.url),
    ...pages.map((p) => `/${p.slug}/`),
    ...posts.filter((p) => p.status === "published").map((p) => `/${p.slug}/`),
    ...cats.map((c) => `/listing-category/${c.slug}/`),
    ...distritos.map((d) => `/listing-location/${d.slug}/`),
    ...locs.filter((l) => l.parentId).map((l) => `/listing-location/${bySlug.get(l.parentId!)}/${l.slug}/`),
    ...listings.map((l) => `/listing/${l.slug}/`),
    ...redirects.map((r) => r.fromPath),
  ]);

  return {
    exists: (path: string) => paths.has(path),
    pages: pages.map((p) => ({ title: p.title, url: `/${p.slug}/` })),
    posts,
    categories: cats.map((c) => ({ name: c.name, url: `/listing-category/${c.slug}/` })),
    distritos: distritos.map((d) => ({ name: d.name, url: `/listing-location/${d.slug}/` })),
  };
}

/** Palavras-chave já usadas em artigos (para não repetir temas). */
export async function usedKeywords() {
  const rows = await getDb().select({ k: schema.posts.focusKeyword }).from(schema.posts).where(and(isNotNull(schema.posts.focusKeyword)));
  return [...new Set(rows.map((r) => r.k!.trim()).filter(Boolean))];
}
