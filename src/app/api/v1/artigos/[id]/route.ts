import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { articleFields, saveArticle, seoForPost, serialize, zodErrors } from "@/lib/blog/api";
import { guard } from "@/lib/blog/api-route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;
type Ctx = { params: Promise<{ id: string }> };

async function load(ctx: Ctx) {
  const id = Number((await ctx.params).id);
  return Number.isInteger(id) ? getDb().query.posts.findFirst({ where: eq(schema.posts.id, id) }) : undefined;
}

/** Um artigo, com a pontuação SEO atual. */
export async function GET(req: Request, ctx: Ctx) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const post = await load(ctx);
  if (!post) return Response.json({ error: "Artigo não encontrado." }, { status: 404 });
  return Response.json(serialize(post, await seoForPost(post)));
}

/** Corrige um artigo criado pela API (só muda os campos enviados). Os artigos feitos no back-office não se mexem aqui. */
export async function PATCH(req: Request, ctx: Ctx) {
  const g = await guard(req, { body: true });
  if ("error" in g) return g.error;
  const post = await load(ctx);
  if (!post) return Response.json({ error: "Artigo não encontrado." }, { status: 404 });
  if (post.createdVia !== "api") return Response.json({ error: "Este artigo foi feito no back-office; só pode ser alterado lá." }, { status: 403 });
  const parsed = articleFields.partial().safeParse(g.json);
  if (!parsed.success) return Response.json({ error: "Pedido inválido.", details: zodErrors(parsed.error) }, { status: 400 });
  const r = await saveArticle(parsed.data, { existing: post });
  return Response.json(r.body, { status: r.status });
}
