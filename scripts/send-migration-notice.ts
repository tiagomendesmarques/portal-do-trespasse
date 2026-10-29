// Email opcional "O Portal do Trespasse tem um site novo" para as contas vindas do WordPress.
// Uso: npx tsx scripts/send-migration-notice.ts            (só conta, não envia nada)
//      npx tsx scripts/send-migration-notice.ts --enviar   (envia; quem já recebeu não volta a receber)
// O texto edita-se no back-office (Emails → "Mudança de site").
import { and, eq, isNotNull } from "drizzle-orm";
import { closeDb, getDb, schema } from "../src/db";
import { sendTemplate } from "../src/lib/email/send";
import { absoluteUrl, ROUTES } from "../src/lib/site";

const SEND = process.argv.includes("--enviar");
const db = getDb();

const users = await db.select({ id: schema.users.id, email: schema.users.email, name: schema.users.displayName })
  .from(schema.users)
  .where(and(isNotNull(schema.users.wpId), eq(schema.users.status, "active")));
const sent = new Set(
  // Só conta como avisado quem recebeu de facto (os registados em modo "log" ou falhados repetem).
  (await db.select({ to: schema.emailLog.to }).from(schema.emailLog).where(and(eq(schema.emailLog.templateKey, "migration_notice"), eq(schema.emailLog.status, "sent")))).map((r) => r.to.toLowerCase()),
);
const todo = users.filter((u) => !sent.has(u.email.toLowerCase()));

console.log(`Contas vindas do WordPress: ${users.length}. Já avisadas: ${users.length - todo.length}. Por avisar: ${todo.length}.`);
if (!SEND) {
  console.log("Nada foi enviado. Para enviar: --enviar");
} else {
  if (process.env.EMAIL_DRIVER !== "smtp") console.log("Aviso: EMAIL_DRIVER não é \"smtp\"; os emails ficam só registados.");
  if (process.env.EMAIL_ONLY_TO) console.log(`Aviso: EMAIL_ONLY_TO está definido; só recebem ${process.env.EMAIL_ONLY_TO}.`);
  let ok = 0;
  for (const u of todo) {
    const r = await sendTemplate("migration_notice", u.email, { name: u.name, login_url: absoluteUrl(ROUTES.account), reset_request_url: absoluteUrl(ROUTES.lostPassword) });
    if (r.ok) ok++;
    await new Promise((res) => setTimeout(res, 1000)); // devagar, para não exceder o limite do servidor SMTP
  }
  console.log(`Enviados: ${ok}. Falhados: ${todo.length - ok} (ver Back-office → Emails → registo).`);
}
await closeDb();
