import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getSetting } from "@/lib/settings";
import { EMAIL_TEMPLATES } from "./defaults";
import { renderEmail, type Vars } from "./render";

type Message = { to: string; subject: string; html: string; text: string; replyTo?: string; templateKey?: string };

const DRIVER = process.env.EMAIL_DRIVER === "resend" ? "resend" : "log";
const FROM = process.env.EMAIL_FROM ?? "Portal do Trespasse <naoresponder@portaldotrespasse.pt>";

/**
 * Envia (ou só regista, com EMAIL_DRIVER=log) e guarda sempre em email_log.
 * Nunca lança erro: um email falhado não deve partir o pedido do utilizador.
 */
export async function sendEmail(msg: Message): Promise<{ ok: boolean }> {
  let status: "logged" | "sent" | "failed" = "logged";
  let providerId: string | null = null;
  let error: string | null = null;

  if (DRIVER === "resend") {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [msg.to], subject: msg.subject, html: msg.html, text: msg.text, reply_to: msg.replyTo }),
      });
      const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (res.ok) {
        status = "sent";
        providerId = body.id ?? null;
      } else {
        status = "failed";
        error = `${res.status} ${body.message ?? ""}`.trim();
      }
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
