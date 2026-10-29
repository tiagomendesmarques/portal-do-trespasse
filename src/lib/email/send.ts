import { eq } from "drizzle-orm";
import nodemailer, { type Transporter } from "nodemailer";
import { getDb, schema } from "@/db";
import { getSetting } from "@/lib/settings";
import { EMAIL_TEMPLATES } from "./defaults";
import { renderEmail, type Vars } from "./render";

type Message = { to: string; subject: string; html: string; text: string; replyTo?: string; templateKey?: string };

/** "smtp" envia (produção); "log" só regista no back-office (desenvolvimento e staging). */
export const EMAIL_DRIVER = process.env.EMAIL_DRIVER === "smtp" ? "smtp" : "log";
const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS ?? process.env.SMTP_USER ?? "geral@portaldotrespasse.pt";
/**
 * Staging: só envia de verdade para estes endereços (separados por vírgulas); os restantes ficam
 * só registados. Assim testa-se o SMTP sem escrever aos utilizadores reais importados.
 */
const ONLY_TO = (process.env.EMAIL_ONLY_TO ?? "").split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
export const canSendTo = (to: string) => EMAIL_DRIVER === "smtp" && (!ONLY_TO.length || ONLY_TO.includes(to.trim().toLowerCase()));

let transport: Transporter | undefined;
function smtp(): Transporter {
  const port = Number(process.env.SMTP_PORT ?? 465);
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = TLS desde o início; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
    pool: true,
    maxConnections: 2,
    connectionTimeout: 15_000,
    socketTimeout: 30_000,
  });
  return transport;
}

/**
 * Envia (ou só regista, com EMAIL_DRIVER=log) e guarda sempre em email_log.
 * Nunca lança erro: um email falhado não deve partir o pedido do utilizador.
 */
export async function sendEmail(msg: Message): Promise<{ ok: boolean }> {
  let status: "logged" | "sent" | "failed" = "logged";
  let providerId: string | null = null;
  let error: string | null = null;

  if (canSendTo(msg.to)) {
    try {
      const fromName = await getSetting("email.fromName");
      const info = await smtp().sendMail({
        from: { name: fromName, address: FROM_ADDRESS },
        to: msg.to,
        replyTo: msg.replyTo,
        subject: msg.subject,
        html: msg.html,
        text: msg.text,
      });
      status = "sent";
      providerId = info.messageId ?? null;
    } catch (e) {
      status = "failed";
      error = e instanceof Error ? e.message : String(e);
    }
  }

  try {
    await getDb().insert(schema.emailLog).values({
      templateKey: msg.templateKey ?? null,
      to: msg.to,
      replyTo: msg.replyTo ?? null,
      subject: msg.subject,
      html: msg.html,
      text: msg.text,
      status,
      providerId,
      error,
    });
  } catch (e) {
    console.error("email_log insert failed", e);
  }
  if (status === "failed") console.error(`Email "${msg.subject}" para ${msg.to} falhou: ${error}`);
  return { ok: status !== "failed" };
}

async function loadTemplate(key: string) {
  const row = await getDb().query.emailTemplates.findFirst({ where: eq(schema.emailTemplates.key, key) });
  if (row) return row.enabled ? row : null;
  return EMAIL_TEMPLATES.find((t) => t.key === key) ?? null;
}

export async function sendTemplate(key: string, to: string, vars: Vars, opts: { replyTo?: string } = {}) {
  const t = await loadTemplate(key);
  if (!t) return { ok: false };
  return sendEmail({ ...renderEmail(t, vars), to, replyTo: opts.replyTo, templateKey: key });
}

/** Avisos para a equipa: lista das definições ou, se vazia, todos os administradores. */
export async function notifyAdmins(key: string, vars: Vars) {
  let to = await getSetting("email.adminRecipients");
  if (!to.length) {
    const admins = await getDb().query.users.findMany({ where: (u, { eq }) => eq(u.role, "admin"), columns: { email: true } });
    to = admins.map((a) => a.email);
  }
  await Promise.all(to.map((addr) => sendTemplate(key, addr, vars)));
}
