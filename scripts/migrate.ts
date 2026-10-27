import { migrate as migratePg } from "drizzle-orm/node-postgres/migrator";
import { migrate as migratePglite } from "drizzle-orm/pglite/migrator";
import { closeDb, getDb } from "../src/db";

const db = getDb();
const url = process.env.DATABASE_URL;
const migrationsFolder = "./drizzle";
if (url && !url.startsWith("pglite:")) await migratePg(db as never, { migrationsFolder });
else await migratePglite(db as never, { migrationsFolder });
console.log("Migrações aplicadas.");
await closeDb();
