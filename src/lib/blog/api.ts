import { timingSafeEqual } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import { notifyAdmins } from "@/lib/email/send";
import { sanitizeContentHtml } from "@/lib/html";
import { slugify } from "@/lib/slug";
import { absoluteUrl } from "@/lib/site";
import { excerpt as makeExcerpt } from "@/lib/text";
import { ImageError, importImage, processInlineImages } from "./images";
import { siteLinks } from "./links";
import { checkSeo, type SeoReport } from "./seo";

/** API de artigos (/api/v1/artigos/): autenticação por chave (Authorization: Bearer …). */
export function apiAuth(req: Request): Response | null {
  const token = process.env.BLOG_API_TOKEN ?? "";
  if (token.length < 24) return Response.json({ error: "A API de artigos está desligada (falta BLOG_API_TOKEN)." }, { status: 503 });
  const given = Buffer.from((req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, ""));
  const expected = Buffer.from(token);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return Response.json({ error: "Chave inválida." }, { status: 401 });
  return null;
}

const image = z.object({
  url: z.string().url(),
  alt: z.string().trim().min(5, "O texto alternativo (alt) da imagem tem de ter pelo menos 5 caracteres.").max(200),
  caption: z.string().trim().max(300).optional(),
  credit: z.string().trim().max(150).optional(),
  creditUrl: z.string().url().optional(),
});

/** Campos aceites. No PATCH todos são opcionais (só muda o que vier). */
export const articleFields = z.object({
  title: z.string().trim().min(10).max(100),
  slug: z.string().trim().max(120),
  status: z.enum(["draft", "published"]),
  focusKeyword: z.string().trim().min(2).max(100),
  secondaryKeywords: z.array(z.string().trim().min(2).max(100)).max(10),
  seoTitle: z.string().trim().max(70),
  seoDescription: z.string().trim().max(170),
  excerpt: z.string().trim().max(300),
  contentHtml: z.string().min(50).max(200_000),
  featuredImage: image.nullable(),
  faq: z.array(z.object({ question: z.string().trim().min(5).max(300), answer: z.string().trim().min(5).max(2000) })).max(15),
  sources: z.array(z.object({ title: z.string().trim().min(2).max(200), url: z.string().url() })).max(15),
  tags: z.array(z.string().trim().min(2).max(40)).max(10),
}).strict();
export const createFields = articleFields.partial().required({ title: true, focusKeyword: true, contentHtml: true });
type Fields = z.infer<typeof articleFields>;
type Post = typeof schema.posts.$inferSelect;

export type ApiResult = { status: number; body: Record<string, unknown> };

export function zodErrors(e: z.ZodError) {
  return e.issues.map((i) => `${i.path.join(".") || "pedido"}: ${i.message}`);
}

/** O que a API devolve sobre um artigo. */
export function serialize(p: Post, seo?: SeoReport) {
  return {
    id: p.id, status: p.status, title: p.title, slug: p.slug,
    url: absoluteUrl(`/${p.slug}/`), editUrl: absoluteUrl(`/admin/blog/${p.id}/`),
    focusKeyword: p.focusKeyword, secondaryKeywords: p.secondaryKeywords, seoTitle: p.seoTitle, seoDescription: p.seoDescription,
    excerpt: p.excerpt, contentHtml: p.contentHtml, tags: p.tags, faq: p.faq, sources: p.sources,
    featuredImage: p.featuredImageKey || p.featuredImageUrl
      ? { stored: p.featuredImageKey ? "site" : "unsplash", alt: p.featuredImageAlt, caption: p.featuredImageCaption, credit: p.featuredImageCredit, creditUrl: p.featuredImageCreditUrl }
      : null,
    publishedAt: p.publishedAt, updatedAt: p.updatedAt, createdVia: p.createdVia,
    ...(seo ? { seo } : {}),
  };
}

/** SEO de um artigo já gravado (para o GET e para o painel do back-office). */
export async function seoForPost(p: Post) {
  const links = await siteLinks();
  return checkSeo({
    title: p.title, slug: p.slug, seoTitle: p.seoTitle, seoDescription: p.seoDescription, excerpt: p.excerpt, contentHtml: p.contentHtml,
    focusKeyword: p.focusKeyword, hasFeaturedImage: Boolean(p.featuredImageKey || p.featuredImageUrl), featuredImageAlt: p.featuredImageAlt,
    faq: p.faq, sources: p.sources, internalLinkExists: (path) => links.exists(path) || path === `/${p.slug}/`,
  });
}

/**
 * Cria (sem `existing`) ou corrige um artigo. Ordem: validar → SEO (recusa com erros, antes de descarregar
 * imagens) → imagens → limpar HTML → gravar → avisar a equipa.
 */
export async function saveArticle(input: Partial<Fields>, opts: { existing?: Post; idempotencyKey?: string | null }): Promise<ApiResult> {
  const db = getDb();
  const prev = opts.existing;
  const merged = {
    title: input.title ?? prev?.title ?? "",
    slug: slugify(input.slug || (prev ? prev.slug : "") || input.title || "").slice(0, 120),
    status: input.status ?? prev?.status ?? "draft",
    focusKeyword: input.focusKeyword ?? prev?.focusKeyword ?? "",
    secondaryKeywords: input.secondaryKeywords ?? prev?.secondaryKeywords ?? [],
    seoTitle: input.seoTitle ?? prev?.seoTitle ?? null,
    seoDescription: input.seoDescription ?? prev?.seoDescription ?? null,
    contentHtml: input.contentHtml ?? prev?.contentHtml ?? "",
    faq: input.faq ?? prev?.faq ?? [],
    sources: input.sources ?? prev?.sources ?? [],
    tags: input.tags ?? prev?.tags ?? [],
  };
  const excerpt = input.excerpt ?? prev?.excerpt ?? null;
  const image = input.featuredImage === undefined ? undefined : input.featuredImage; // null = tirar a imagem
  const hasImage = image !== undefined ? Boolean(image) : Boolean(prev?.featuredImageKey || prev?.featuredImageUrl);
  const imageAlt = image !== undefined ? image?.alt : prev?.featuredImageAlt;

  if (!merged.slug) return { status: 400, body: { error: "Pedido inválido.", details: ["slug: indique o título ou o endereço."] } };
  const [pageClash, postClash] = await Promise.all([
    db.query.pages.findFirst({ where: eq(schema.pages.slug, merged.slug) }),
    db.query.posts.findFirst({ where: and(eq(schema.posts.slug, merged.slug), prev ? sql`${schema.posts.id} <> ${prev.id}` : undefined) }),
  ]);
  if (pageClash || postClash) return { status: 409, body: { error: `O endereço "${merged.slug}" já está em uso.`, ...(postClash ? { existingId: postClash.id } : {}) } };

  const links = await siteLinks();
  const seo = checkSeo({
    ...merged, excerpt, hasFeaturedImage: hasImage, featuredImageAlt: imageAlt,
    internalLinkExists: (path) => links.exists(path) || path === `/${merged.slug}/`,
  });
  if (seo.errors.length) return { status: 422, body: { error: "O artigo tem erros; corrija e envie outra vez.", seo } };

  // Imagens (só as que vieram neste pedido).
  let imageFields: Partial<Post> = {};
  let contentHtml = merged.contentHtml;
  try {
    if (image) {
      const img = await importImage(image.url);
      imageFields = {
        featuredImageKey: "key" in img ? img.key : null, featuredImageUrl: "url" in img ? img.url : null,
        featuredImageAlt: image.alt, featuredImageCaption: image.caption ?? null, featuredImageCredit: image.credit ?? null, featuredImageCreditUrl: image.creditUrl ?? null,
      };
    } else if (image === null) {
      imageFields = { featuredImageKey: null, featuredImageUrl: null, featuredImageAlt: null, featuredImageCaption: null, featuredImageCredit: null, featuredImageCreditUrl: null };
    }
    if (input.contentHtml !== undefined) contentHtml = await processInlineImages(contentHtml);
  } catch (e) {
    if (e instanceof ImageError) return { status: 422, body: { error: e.message } };
    throw e;
  }
  contentHtml = sanitizeContentHtml(contentHtml);

  const now = new Date();
  const values = {
    ...merged, contentHtml, ...imageFields,
    excerpt: excerpt || makeExcerpt(contentHtml, 220),
    status: merged.status as "draft" | "published",
    publishedAt: merged.status === "published" ? (prev?.publishedAt ?? now) : (prev?.publishedAt ?? null),
    updatedAt: now,
  };

  let post: Post;
  if (prev) {
    [post] = await db.update(schema.posts).set(values).where(eq(schema.posts.id, prev.id)).returning();
    if (prev.slug !== post.slug && prev.status === "published") {
      await db.insert(schema.redirects).values({ fromPath: `/${prev.slug}/`, toPath: `/${post.slug}/`, note: "Mudança de endereço do artigo (API)" }).onConflictDoNothing();
    }
  } else {
    [post] = await db.insert(schema.posts).values({ ...values, createdVia: "api", apiIdempotencyKey: opts.idempotencyKey || null }).returning();
  }
  await db.insert(schema.auditLog).values({ actorId: null, action: prev ? "post.api_update" : "post.api_create", entity: "post", entityId: String(post.id), data: { status: post.status, score: seo.score } });

  const becamePublic = post.status === "published" && prev?.status !== "published";
  if (!prev || becamePublic) {
    await notifyAdmins("admin_post_api", {
      post_title: post.title, action: post.status === "published" ? "publicado" : "guardado como rascunho", seo_score: seo.score,
      article_url: absoluteUrl(`/${post.slug}/`), admin_post_url: absoluteUrl(`/admin/blog/${post.id}/`),
    });
  }
  return { status: prev ? 200 : 201, body: serialize(post, seo) };
}
