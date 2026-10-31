import { sql } from "drizzle-orm";
import { getDb } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await getDb().execute(sql`select 1`);
    // version = commit do build (o Next.js fixa-o no build; vazio em desenvolvimento): confirma que um deploy chegou.
    return Response.json({ ok: true, version: String(process.env.NEXT_DEPLOYMENT_ID || "") });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
