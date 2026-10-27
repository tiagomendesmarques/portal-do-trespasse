import { and, desc, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

export const POSTS_PER_PAGE = 12;

export async function listPosts(page: number) {
  const db = getDb();
  const pub = eq(schema.posts.status, "published");
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(schema.posts).where(pub);
  const pages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
  const posts = await db
    .select({ id: schema.posts.id, slug: schema.posts.slug, title: schema.posts.title, excerpt: schema.posts.excerpt, featuredImageKey: schema.posts.featuredImageKey, publishedAt: schema.posts.publishedAt })
    .from(schema.posts)
    .where(pub)
    .orderBy(desc(schema.posts.publishedAt), desc(schema.posts.id))
    .limit(POSTS_PER_PAGE)
    .offset((Math.min(page, pages) - 1) * POSTS_PER_PAGE);
  return { posts, total, pages, page: Math.min(page, pages) };
}

export async function getPost(slug: string) {
  return getDb().query.posts.findFirst({ where: and(eq(schema.posts.slug, slug), eq(schema.posts.status, "published")) });
}

export async function getPage(slug: string) {
  return getDb().query.pages.findFirst({ where: and(eq(schema.pages.slug, slug), eq(schema.pages.status, "published")) });
}
