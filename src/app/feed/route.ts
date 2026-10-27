import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
const esc = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** RSS do blog, no mesmo endereço do WordPress (/feed/). */
export async function GET() {
  const posts = await getDb().select().from(schema.posts).where(eq(schema.posts.status, "published")).orderBy(desc(schema.posts.publishedAt)).limit(20);
  const items = posts
    .map((p) => `<item><title>${esc(p.title)}</title><link>${absoluteUrl(`/${p.slug}/`)}</link><guid>${absoluteUrl(`/${p.slug}/`)}</guid>${p.publishedAt ? `<pubDate>${p.publishedAt.toUTCString()}</pubDate>` : ""}<description>${esc(p.excerpt ?? "")}</description></item>`)
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${SITE_NAME}</title><link>${absoluteUrl("/")}</link><description>Trespasses e negócios à venda em Portugal</description><language>pt-PT</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
