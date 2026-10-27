import { notFound, permanentRedirect, redirect } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";

/** Procura o caminho na tabela de redirects (gerida no back-office); se não houver, 404. */
export async function redirectOrNotFound(path: string): Promise<never> {
  const normalized = path.endsWith("/") ? path : `${path}/`;
  const [row] = await getDb()
    .update(schema.redirects)
    .set({ hits: sql`${schema.redirects.hits} + 1` })
    .where(eq(schema.redirects.fromPath, normalized))
    .returning();
  if (row) {
    if (row.statusCode === 302) redirect(row.toPath);
    permanentRedirect(row.toPath);
  }
  notFound();
}
