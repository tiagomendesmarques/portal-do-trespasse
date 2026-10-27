import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Janela fixa guardada na base de dados (funciona com várias instâncias no Cloud Run).
 * Devolve true se o pedido pode seguir.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const t = schema.rateLimits;
  const [row] = await getDb()
    .insert(t)
    .values({ key, count: 1, resetAt: sql`now() + make_interval(secs => ${windowSeconds})` })
    .onConflictDoUpdate({
      target: t.key,
      set: {
        count: sql`case when ${t.resetAt} < now() then 1 else ${t.count} + 1 end`,
        resetAt: sql`case when ${t.resetAt} < now() then now() + make_interval(secs => ${windowSeconds}) else ${t.resetAt} end`,
      },
    })
    .returning({ count: t.count });
  return row.count <= limit;
}
