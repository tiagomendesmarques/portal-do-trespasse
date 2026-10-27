"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, ROUTES } from "@/lib/site";
import { hashPassword, verifyPassword } from "./password";
import { clientIp, createSession, destroyAllSessions, destroySession } from "./session";
import { consumeUserToken, createUserToken } from "./tokens";
import { fieldErrors, loginSchema, registerSchema, resetSchema, safeNext, type FieldErrors } from "./validation";

export type FormState = {
  ok?: boolean;
  message?: string;
  errors?: FieldErrors;
  values?: Record<string, string>;
  needsVerification?: string; // email por confirmar
};

const TOO_MANY = "Demasiadas tentativas. Espere alguns minutos e tente de novo.";
const values = (fd: FormData, keys: string[]) => Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));
const ip = async () => clientIp(await headers()) ?? "sem-ip";

async function sendVerification(user: { id: number; email: string; displayName: string }) {
  const token = await createUserToken(user.id, "verify_email");
  await sendTemplate("verify_email", user.email, {
    name: user.displayName,
    verify_url: absoluteUrl(`${ROUTES.verify}?token=${token}`),
  });
}

/* ---------- Registo ---------- */

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const kept = values(fd, ["phone", "username", "email"]);
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: kept };
  if (!(await rateLimit(`register:${await ip()}`, 5, 3600))) return { message: TOO_MANY, values: kept };

  const { username, email, password, phone } = parsed.data;
  const db = getDb();
  const clash = await db.query.users.findFirst({
    where: or(sql`lower(${schema.users.username}) = ${username.toLowerCase()}`, sql`lower(${schema.users.email}) = ${email}`),
    columns: { username: true, email: true },
  });
  if (clash) {
    const errors: FieldErrors = {};
    if (clash.email.toLowerCase() === email) errors.email = "Já existe uma conta com este email. Entre ou recupere a password.";
    if (clash.username.toLowerCase() === username.toLowerCase()) errors.username = "Este nome de utilizador já está em uso.";
    return { errors, values: kept };
  }

  const [user] = await db
    .insert(schema.users)
    .values({ username, email, phone, displayName: username, passwordHash: await hashPassword(password) })
    .returning();
  await sendVerification(user);
  await notifyAdmins("admin_new_user", {
    user_name: user.username,
    user_email: user.email,
    admin_user_url: absoluteUrl(`/admin/utilizadores/${user.id}/`),
  });
  return { ok: true, message: `Conta criada. Enviámos um email para ${email}: abra a ligação para confirmar a conta e poder publicar.` };
}

export async function resendVerificationAction(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const generic = { ok: true, message: "Se a conta existir e ainda não estiver confirmada, enviámos um novo email de confirmação." };
  if (!email || !(await rateLimit(`resend:${email}`, 3, 86_400))) return generic;
  const user = await getDb().query.users.findFirst({ where: sql`lower(${schema.users.email}) = ${email}` });
  if (user && !user.emailVerifiedAt) await sendVerification(user);
  return generic;
}

/* ---------- Login ---------- */

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const kept = values(fd, ["identifier"]);
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: kept };
  const { identifier, password, remember, next } = parsed.data;
  const id = identifier.toLowerCase();

  if (!(await rateLimit(`login-ip:${await ip()}`, 30, 900)) || !(await rateLimit(`login-id:${id}`, 10, 900))) {
    return { message: TOO_MANY, values: kept };
  }

  const db = getDb();
  const user = await db.query.users.findFirst({
    where: or(sql`lower(${schema.users.email}) = ${id}`, sql`lower(${schema.users.username}) = ${id}`),
  });
  const check = user ? await verifyPassword(password, user.passwordHash) : { ok: false, needsRehash: false };
  if (!user || !check.ok) return { message: "Email, nome de utilizador ou password incorretos.", values: kept };
  if (user.status === "blocked") return { message: "Esta conta está bloqueada. Contacte-nos se achar que é um erro.", values: kept };
  if (!user.emailVerifiedAt) return { needsVerification: user.email, values: kept };

  // Hash herdado do WordPress: guarda já no formato novo.
  await db
    .update(schema.users)
    .set({ lastLoginAt: new Date(), ...(check.needsRehash ? { passwordHash: await hashPassword(password) } : {}) })
    .where(eq(schema.users.id, user.id));
  await createSession(user.id, remember === "on");
  redirect(safeNext(next) ?? ROUTES.account);
}

export async function logoutAction() {
  await destroySession();
  redirect(ROUTES.home);
}

/* ---------- Recuperar password ---------- */

export async function requestResetAction(_: FormState, fd: FormData): Promise<FormState> {
  const id = String(fd.get("identifier") ?? "").trim().toLowerCase();
  if (!id) return { errors: { identifier: "Este campo é obrigatório." } };
  const generic = {
    ok: true,
    message: "Se existir uma conta com esses dados, enviámos um email com a ligação para definir uma nova password. Veja também a pasta de spam.",
  };
  if (!(await rateLimit(`reset-ip:${await ip()}`, 10, 3600)) || !(await rateLimit(`reset-id:${id}`, 3, 3600))) return generic;

  const user = await getDb().query.users.findFirst({
    where: or(sql`lower(${schema.users.email}) = ${id}`, sql`lower(${schema.users.username}) = ${id}`),
  });
  if (user && user.status === "active") {
    const token = await createUserToken(user.id, "reset_password");
    await sendTemplate("reset_password", user.email, {
      name: user.displayName,
      reset_url: absoluteUrl(`${ROUTES.resetPassword}?token=${token}`),
    });
  }
  return generic;
}

export async function resetPasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const userId = await consumeUserToken(parsed.data.token, "reset_password");
  if (!userId) return { message: "A ligação expirou ou já foi usada. Peça uma nova." };

  const db = getDb();
  const [user] = await db
    .update(schema.users)
    .set({
      passwordHash: await hashPassword(parsed.data.password),
      // Quem recebeu o email provou que é dono do endereço.
      emailVerifiedAt: sql`coalesce(${schema.users.emailVerifiedAt}, now())`,
      updatedAt: new Date(),
    })
    .where(eq(schema.users.id, userId))
    .returning();
  await destroyAllSessions(userId);
  await sendTemplate("security_notice", user.email, {
    name: user.displayName,
    change: "A password foi alterada",
    date: new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
    reset_request_url: absoluteUrl(ROUTES.lostPassword),
  });
  await createSession(userId, false);
  redirect(`${ROUTES.account}?password=1`);
}
