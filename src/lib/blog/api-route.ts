import { rateLimit } from "@/lib/rate-limit";
import { apiAuth } from "./api";

const MAX_BODY = 1_000_000;

/** Comum a todos os pedidos da API de artigos: chave, limite de pedidos e leitura do JSON. */
export async function guard(req: Request, opts: { body?: boolean } = {}): Promise<{ error: Response } | { json: unknown }> {
  const denied = apiAuth(req);
  if (denied) return { error: denied };
  if (!(await rateLimit("blog-api", 300, 3600))) return { error: Response.json({ error: "Demasiados pedidos. Tente daqui a uma hora." }, { status: 429 }) };
  if (!opts.body) return { json: null };
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return { error: Response.json({ error: "Pedido demasiado grande (máximo 1 MB)." }, { status: 413 }) };
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return { error: Response.json({ error: "Pedido demasiado grande (máximo 1 MB)." }, { status: 413 }) };
    return { json: JSON.parse(text) };
  } catch {
    return { error: Response.json({ error: "O corpo do pedido tem de ser JSON válido." }, { status: 400 }) };
  }
}
