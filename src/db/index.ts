import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type Holder = { db?: Db; close?: () => Promise<void> };
const holder = globalThis as unknown as { __pdtDb?: Holder };

function connect(): Holder {
  const url = process.env.DATABASE_URL;
  if (url && !url.startsWith("pglite:")) {
    const pool = new Pool({ connectionString: url, max: Number(process.env.DB_POOL_MAX ?? 5) });
    return { db: drizzlePg(pool, { schema }) as unknown as Db, close: () => pool.end() };
  }
  // Postgres embutido para desenvolvimento e testes. "pglite:memory" = só em memória.
  const dir = url === "pglite:memory" ? undefined : (url?.slice("pglite:".length) || "./.data/pglite");
  if (dir) mkdirSync(dirname(dir), { recursive: true });
  const db = drizzlePglite({ connection: { dataDir: dir }, schema });
  return { db: db as unknown as Db, close: () => db.$client.close() };
}

export function getDb(): Db {
  holder.__pdtDb ??= connect();
  return holder.__pdtDb.db!;
}

export async function closeDb() {
  await holder.__pdtDb?.close?.();
  holder.__pdtDb = undefined;
}

export { schema };
