"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db";
import type { FormState } from "@/lib/auth/actions";
import { clientIp, getCurrentUser } from "@/lib/auth/session";
import { fieldErrors } from "@/lib/auth/validation";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl } from "@/lib/site";

const loginUrl = (slug: string) => `/my-account/?next=${encodeURIComponent(`/listing/${slug}/`)}`;

async function publicListing(id: number) {
  return getDb().query.listings.findFirst({
    where: and(eq(schema.listings.id, id), sql`${schema.listings.status} in ('published','sold')`),
  });
}

export async function toggleFavoriteAction(fd: FormData) {
  const id = Number(fd.get("listingId"));
  const slug = String(fd.get("slug") ?? "");
  const user = await getCurrentUser();
  if (!user) redirect(loginUrl(slug));
  const db = getDb();
  const where = and(eq(schema.favorites.userId, user.id), eq(schema.favorites.listingId, id));
  const existing = await db.query.favorites.findFirst({ where });
  if (existing) await db.delete(schema.favorites).where(where);
  else if (await publicListing(id)) await db.insert(schema.favorites).values({ userId: user.id, listingId: id }).onConflictDoNothing();
  revalidatePath(`/listing/${slug}/`);
}

export async function revealPhoneAction(listingId: number): Promise<{ phone?: string; login?: boolean }> {
  const user = await getCurrentUser();
  if (!user) return { login: true };
  const listing = await publicListing(listingId);
  if (!listing) return {};
  await getDb().update(schema.listings).set({ phoneClicks: sql`${schema.listings.phoneClicks} + 1` }).where(eq(schema.listings.id, listingId));
  const owner = await getDb().query.users.findFirst({ where: eq(schema.users.id, listing.userId), columns: { phone: true } });
  return { phone: listing.phone ?? owner?.phone ?? undefined };
}

const contactSchema = z.object({
  name: z.string().trim().min(1, "Este campo é obrigatório.").max(100),
  email: z.string().trim().email("Por favor insira um endereço de e-mail válido.").max(200),
  phone: z.string().trim().max(30).optional(),
  message: z.string().trim().min(10, "Escreva pelo menos 10 caracteres.").max(2000, "Insira no máximo 2000 caracteres."),
});

export async function contactSellerAction(_: FormState, fd: FormData): Promise<FormState> {
  const id = Number(fd.get("listingId"));
  const user = await getCurrentUser();
  if (!user) return { message: "Inicie sessão para contactar o anunciante." };
  const parsed = contactSchema.safeParse(Object.fromEntries(fd));
  const kept = Object.fromEntries(["name", "email", "phone", "message"].map((k) => [k, String(fd.get(k) ?? "")]));
  if (!parsed.success) return { errors: fieldErrors(parsed.error), values: kept };
  if (!(await rateLimit(`contact:${user.id}`, 10, 3600))) return { message: "Enviou muitas mensagens na última hora. Tente mais tarde.", values: kept };

  const listing = await publicListing(id);
  if (!listing) return { message: "Este anúncio já não está disponível." };
  const owner = await getDb().query.users.findFirst({ where: eq(schema.users.id, listing.userId) });
  if (!owner) return { message: "Este anúncio já não está disponível." };
  const d = parsed.data;
  await getDb().insert(schema.messages).values({
    kind: "listing_contact", listingId: id, toUserId: owner.id, fromUserId: user.id,
    name: d.name, email: d.email, phone: d.phone || null, body: d.message, ip: clientIp(await headers()),
  });
  await sendTemplate("listing_contact", listing.email ?? owner.email, {
    name: owner.displayName, listing_title: listing.title, listing_url: absoluteUrl(`/listing/${listing.slug}/`),
    sender_name: d.name, sender_email: d.email, sender_phone: d.phone || "não indicado", message: d.message,
  }, { replyTo: d.email });
  return { ok: true, message: "Mensagem enviada. O anunciante responde-lhe diretamente para o seu email." };
}

export async function reportListingAction(_: FormState, fd: FormData): Promise<FormState> {
  const id = Number(fd.get("listingId"));
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 10) return { errors: { reason: "Explique em pelo menos 10 caracteres o que está errado." } };
  const user = await getCurrentUser();
  if (!(await rateLimit(`report:${user?.id ?? clientIp(await headers())}`, 5, 3600))) return { message: "Já enviou várias denúncias. Tente mais tarde." };
  const listing = await publicListing(id);
  if (!listing) return { message: "Este anúncio já não está disponível." };
  await getDb().insert(schema.reports).values({ listingId: id, userId: user?.id ?? null, reason: reason.slice(0, 1000) });
  await notifyAdmins("admin_report", { listing_title: listing.title, reason, admin_reports_url: absoluteUrl("/admin/denuncias/") });
  return { ok: true, message: "Obrigado. A equipa vai rever o anúncio." };
}
