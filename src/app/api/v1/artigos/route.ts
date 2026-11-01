import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { createFields, saveArticle, serialize, zodErrors } from "@/lib/blog/api";
import { guard } from "@/lib/blog/api-route";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** Cria um artigo (rascunho por omissão; "status": "published" publica logo). Ver docs/API_ARTIGOS.md. */
export async function POST(req: Request) {
  const g = await guard(req, { body: true });
  if ("error" in g) return g.error;
  const parsed = createFields.safeParse(g.json);
  if (!parsed.success) return Response.json({ error: "Pedido inválido.", details: zodErrors(parsed.error) }, { status: 400 });

  // Reenviar com a mesma Idempotency-Key devolve o artigo já criado, sem duplicar.
  const key = req.headers.get("idempotency-key")?.trim().slice(0, 100) || null;
  if (key) {
    const done = await getDb().query.posts.findFirst({ where: eq(schema.posts.apiIdempotencyKey, key) });
    if (done) return Response.json({ ...serialize(done), idempotentReplay: true }, { status: 200 });
  }
  const r = await saveArticle(parsed.data, { idempotencyKey: key });
  return Response.json(r.body, { status: r.status });
}

/** Os últimos 50 artigos criados pela API. */
export async function GET(req: Request) {
  const g = await guard(req);
  if ("error" in g) return g.error;
  const rows = await getDb().select().from(schema.posts).where(eq(schema.posts.createdVia, "api")).orderBy(desc(schema.posts.id)).limit(50);
  return Response.json({ articles: rows.map((p) => { const { contentHtml: _c, ...rest } = serialize(p); void _c; return rest; }) });
}
