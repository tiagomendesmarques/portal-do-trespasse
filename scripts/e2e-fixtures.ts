// Dados fictícios para os testes end-to-end (só desenvolvimento): dois utilizadores com
// hashes no formato do WordPress, com password "palavra-passe". Idempotente.
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/db";

if (process.env.SITE_ENV === "production" || process.env.SITE_ENV === "staging") {
  console.error("Recusado: as fixtures de teste só correm em desenvolvimento.");
  process.exit(1);
}
const db = getDb();
const users = [
  { wpId: 999_999, username: "utilizador.wp", email: "wp@exemplo.pt", displayName: "Utilizador WP", passwordHash: "$wp$2y$10$OBqs1miGrY7fg6qe4GWwvOpkr0G423jI88XNALYpCVbLLHyUkN9Ve" },
  { wpId: 999_998, username: "antigo.phpass", email: "phpass@exemplo.pt", displayName: "Antigo", passwordHash: "$P$Babcdefghp/UvPGGzqgM2u80PtvhbF1" },
];
for (const u of users) {
  // Repõe o hash do WordPress mesmo que um teste anterior o tenha convertido.
  await db.insert(schema.users).values({ ...u, emailVerifiedAt: new Date() })
    .onConflictDoUpdate({ target: schema.users.wpId, set: { passwordHash: u.passwordHash, emailVerifiedAt: sql`now()` } });
}
// Os testes criam várias contas seguidas a partir do mesmo IP: limpa os limites de tentativas.
await db.delete(schema.rateLimits);
console.log("Fixtures de teste prontas.");
await closeDb();
