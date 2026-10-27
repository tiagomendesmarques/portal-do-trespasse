"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormState } from "@/lib/auth/actions";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { createSession, destroyAllSessions, destroySession, getCurrentUser } from "@/lib/auth/session";
import { emailSchema, fieldErrors, passwordSchema } from "@/lib/auth/validation";
import { sendTemplate } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { getSettings } from "@/lib/settings";
import { absoluteUrl, ROUTES } from "@/lib/site";

const L = schema.listings;

async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect(ROUTES.account);
  return user;
}

async function audit(actorId: number, action: string, entityId: number, data?: unknown) {
  await getDb().insert(schema.auditLog).values({ actorId, action, entity: "listing", entityId: String(entityId), data: data ?? null });
}

/* ---------- Anúncios ---------- */

/** Ações rápidas na lista "Os meus anúncios". */
export async function listingAction(fd: FormData) {
  const user = await requireUser();
  const id = Number(fd.get("id"));
  const op = String(fd.get("op"));
  const db = getDb();
  const mine = and(eq(L.id, id), eq(L.userId, user.id));
  const listing = await db.query.listings.findFirst({ where: mine });
  if (!listing) return;
  const { "listings.durationDays": days } = await getSettings(["listings.durationDays"]);

  if (op === "sold" && listing.status === "published") {
    await db.update(L).set({ status: "sold", updatedAt: new Date() }).where(mine);
  } else if (op === "available" && listing.status === "sold") {
    await db.update(L).set({ status: "published", updatedAt: new Date() }).where(mine);
  } else if (op === "renew" && ["published", "expired"].includes(listing.status)) {
    // Renovar mantém o conteúdo (já aprovado): volta a publicado por mais N dias.
    const now = new Date();
    await db.update(L).set({ status: "published", publishedAt: listing.status === "expired" ? now : listing.publishedAt, expiresAt: new Date(now.getTime() + days * 86_400_000), expiryWarnedAt: null, reminderSentAt: null, updatedAt: now }).where(mine);
  } else if (op === "delete" && fd.get("confirm") === "on") {
    await db.delete(L).where(mine);
  } else {
    return;
  }
  await audit(user.id, `listing.${op}`, id);
  revalidatePath("/my-account/listings/");
  revalidatePath(`/listing/${listing.slug}/`);
}

export async function removeFavoriteAction(fd: FormData) {
  const user = await requireUser();
  await getDb().delete(schema.favorites).where(and(eq(schema.favorites.userId, user.id), eq(schema.favorites.listingId, Number(fd.get("id")))));
  revalidatePath("/my-account/favourites/");
}

/* ---------- Perfil ---------- */

const profileSchema = z.object({
  displayName: z.string().trim().min(2, "Insira pelo menos 2 caracteres.").max(60).refine((v) => !v.includes("@"), "O nome público não pode ser um email (fica visível nos anúncios)."),
  firstName: z.string().trim().max(60).optional(),
  lastName: z.string().trim().max(60).optional(),
  phone: z.string().trim().max(30).refine((v) => v === "" || /^\+?[0-9 ()-]{9,20}$/.test(v), "Indique um número de telefone válido.").optional(),
  whatsapp: z.string().trim().max(30).refine((v) => v === "" || /^\+?[0-9 ()-]{9,20}$/.test(v), "Indique um número válido.").optional(),
  website: z.string().trim().max(200).refine((v) => v === "" || /^https?:\/\/\S+\.\S+/.test(v), "Por favor, insira um URL válido (começa por https://).").optional(),
  locationId: z.string().optional(),
});

export async function updateProfileAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = profileSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { errors: fieldErrors(parsed.error) };
  const d = parsed.data;
  await getDb().update(schema.users).set({
    displayName: d.displayName, firstName: d.firstName || null, lastName: d.lastName || null, phone: d.phone || null,
    whatsapp: d.whatsapp || null, website: d.website || null, locationId: d.locationId ? Number(d.locationId) : null, updatedAt: new Date(),
  }).where(eq(schema.users.id, user.id));
  revalidatePath("/", "layout");
  return { ok: true, message: "Perfil guardado." };
}

async function checkCurrentPassword(userId: number, hash: string, password: string) {
  if (!(await rateLimit(`pwcheck:${userId}`, 10, 900))) return "Demasiadas tentativas. Espere alguns minutos.";
  return (await verifyPassword(password, hash)).ok ? null : "A password atual não está correta.";
}

export async function changeEmailAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const email = emailSchema.safeParse(fd.get("email"));
  if (!email.success) return { errors: { email: email.error.issues[0].message } };
  const wrong = await checkCurrentPassword(user.id, user.passwordHash, String(fd.get("password") ?? ""));
  if (wrong) return { errors: { password: wrong } };
  if (email.data === user.email.toLowerCase()) return { errors: { email: "É o email que já tem." } };
  const clash = await getDb().query.users.findFirst({ where: and(sql`lower(${schema.users.email}) = ${email.data}`, ne(schema.users.id, user.id)) });
  if (clash) return { errors: { email: "Já existe uma conta com este email." } };

  await getDb().update(schema.users).set({ email: email.data, updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  // Avisa o endereço antigo: se não foi o dono, ainda pode reagir.
  await sendTemplate("security_notice", user.email, {
    name: user.displayName, change: `O email da conta foi alterado para ${email.data}`,
    date: new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }), reset_request_url: absoluteUrl(ROUTES.lostPassword),
  });
  return { ok: true, message: `Email alterado para ${email.data}.` };
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const next = passwordSchema.safeParse(fd.get("newPassword"));
  if (!next.success) return { errors: { newPassword: next.error.issues[0].message } };
  if (next.data !== fd.get("newPassword2")) return { errors: { newPassword2: "As passwords não coincidem." } };
  const wrong = await checkCurrentPassword(user.id, user.passwordHash, String(fd.get("currentPassword") ?? ""));
  if (wrong) return { errors: { currentPassword: wrong } };

  await getDb().update(schema.users).set({ passwordHash: await hashPassword(next.data), updatedAt: new Date() }).where(eq(schema.users.id, user.id));
  // Termina as sessões noutros dispositivos e mantém esta.
  await destroyAllSessions(user.id);
  await createSession(user.id, false);
  await sendTemplate("security_notice", user.email, {
    name: user.displayName, change: "A password foi alterada", date: new Date().toLocaleString("pt-PT", { timeZone: "Europe/Lisbon" }),
    reset_request_url: absoluteUrl(ROUTES.lostPassword),
  });
  return { ok: true, message: "Password alterada. As sessões noutros dispositivos foram terminadas." };
}

export async function deleteAccountAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  if (String(fd.get("confirmText") ?? "").trim().toUpperCase() !== "APAGAR") return { errors: { confirmText: "Escreva APAGAR para confirmar." } };
  const wrong = await checkCurrentPassword(user.id, user.passwordHash, String(fd.get("password") ?? ""));
  if (wrong) return { errors: { password: wrong } };
  if (user.role === "admin") return { message: "Contas de administrador não podem ser apagadas aqui." };

  await getDb().insert(schema.auditLog).values({ actorId: null, action: "user.delete", entity: "user", entityId: String(user.id), data: { wpId: user.wpId } });
  await sendTemplate("account_deleted", user.email, { name: user.displayName });
  await destroySession();
  // Apaga a conta; anúncios, fotos (registos), favoritos e sessões vão em cascata.
  await getDb().delete(schema.users).where(eq(schema.users.id, user.id));
  redirect("/?conta=apagada");
}
