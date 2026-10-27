// Dados fictícios para os testes end-to-end (só desenvolvimento): dois utilizadores com
// hashes no formato do WordPress, com password "palavra-passe". Idempotente.
import { sql } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/db";
import { hashPassword } from "../src/lib/auth/password";

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
// Administrador de teste (password "admin-teste-123").
const admin = { username: "admin.teste", email: "admin.teste@exemplo.pt", displayName: "Admin de Teste", role: "admin" as const, passwordHash: await hashPassword("admin-teste-123"), emailVerifiedAt: new Date() };
const existingAdmin = await db.query.users.findFirst({ where: sql`lower(${schema.users.username}) = 'admin.teste'` });
if (existingAdmin) await db.update(schema.users).set({ passwordHash: admin.passwordHash, role: "admin", status: "active" }).where(sql`${schema.users.id} = ${existingAdmin.id}`);
else await db.insert(schema.users).values(admin);

// Os testes criam várias contas seguidas a partir do mesmo IP: limpa os limites de tentativas.
await db.delete(schema.rateLimits);
console.log("Fixtures de teste prontas.");
await closeDb();
