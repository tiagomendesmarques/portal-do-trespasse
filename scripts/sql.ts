// Utilitário de desenvolvimento: npx tsx scripts/sql.ts "select ..."
import { sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db";

const db = getDb();
for (const q of process.argv.slice(2)) {
  const res = (await db.execute(sql.raw(q))) as unknown as { rows: unknown[] };
  console.log(q.slice(0, 70), "→");
  console.table(res.rows);
}
await closeDb();
