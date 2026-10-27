"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireStaff } from "@/lib/admin/guard";
import type { FormState } from "@/lib/auth/actions";
import { sendTemplate } from "@/lib/email/send";
import { formatDate } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";

const L = schema.listings;


async function load(id: number) {
  const l = await getDb().query.listings.findFirst({ where: eq(L.id, id) });
  if (!l) throw new Error("Anúncio não encontrado.");
  const owner = await getDb().query.users.findFirst({ where: eq(schema.users.id, l.userId) });
  return { l, owner: owner! };
}

async function audit(actorId: number, action: string, id: number, data?: unknown) {
  await getDb().insert(schema.auditLog).values({ actorId, action, entity: "listing", entityId: String(id), data: data ?? null });
}

function refresh(id: number, slug: string) {
  revalidatePath("/admin/", "layout");
  revalidatePath(`/listing/${slug}/`);
  revalidatePath("/all-ads/");
  void id;
}

export async function approveListingAction(fd: FormData) {
  const staff = await requireStaff();
  const { l, owner } = await load(Number(fd.get("id")));
  if (l.status !== "pending" && l.status !== "rejected") return;
  const { "listings.durationDays": days } = await getSettings(["listings.durationDays"]);
  const now = new Date();
  // Edições de anúncios já publicados mantêm a data de publicação e a validade (se ainda não passou).
  const expiresAt = l.expiresAt && l.expiresAt > now ? l.expiresAt : new Date(now.getTime() + days * 86_400_000);
  await getDb().update(L).set({ status: "published", publishedAt: l.publishedAt ?? now, expiresAt, rejectionReason: null, updatedAt: now }).where(eq(L.id, l.id));
  await audit(staff.id, "listing.approve", l.id);
  await sendTemplate("listing_published", owner.email, {
    name: owner.displayName, listing_title: l.title, listing_url: absoluteUrl(`/listing/${l.slug}/`), expires_at: formatDate(expiresAt),
  });
  refresh(l.id, l.slug);
  if (fd.get("next") === "queue") redirect("/admin/anuncios/?estado=pending&aprovado=1");
}

export async function rejectListingAction(_: FormState, fd: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const { l, owner } = await load(Number(fd.get("id")));
  const preset = String(fd.get("preset") ?? "");
  const extra = String(fd.get("reason") ?? "").trim();
  const reason = [preset, extra].filter(Boolean).join(" ");
  if (reason.length < 10) return { errors: { reason: "Escolha um motivo ou escreva-o (o anunciante recebe-o por email)." } };
  await getDb().update(L).set({ status: "rejected", rejectionReason: reason.slice(0, 1000), updatedAt: new Date() }).where(eq(L.id, l.id));
  await audit(staff.id, "listing.reject", l.id, { reason });
  await sendTemplate("listing_rejected", owner.email, {
    name: owner.displayName, listing_title: l.title, reason, edit_url: absoluteUrl(`/post-an-ad/editar/${l.id}/`),
  });
  refresh(l.id, l.slug);
  return { ok: true, message: "Anúncio rejeitado. O anunciante foi avisado por email com o motivo." };
}

/** Outras ações da equipa sobre um anúncio. */
export async function staffListingAction(fd: FormData) {
  const staff = await requireStaff();
  const { l } = await load(Number(fd.get("id")));
  const op = String(fd.get("op"));
  const db = getDb();
  const now = new Date();
  const { "listings.durationDays": days } = await getSettings(["listings.durationDays"]);
  const set: Partial<typeof L.$inferInsert> = { updatedAt: now };

  if (op === "unpublish" && ["published", "sold"].includes(l.status)) set.status = "pending";
  else if (op === "sold" && l.status === "published") set.status = "sold";
  else if (op === "republish" && ["sold", "expired"].includes(l.status)) Object.assign(set, { status: "published", expiresAt: new Date(now.getTime() + days * 86_400_000), expiryWarnedAt: null, reminderSentAt: null });
  else if (op === "extend" && ["published", "expired"].includes(l.status)) {
    const from = l.expiresAt && l.expiresAt > now ? l.expiresAt : now;
    Object.assign(set, { status: "published", expiresAt: new Date(from.getTime() + days * 86_400_000), expiryWarnedAt: null, reminderSentAt: null });
  } else if (op === "feature") set.featuredUntil = new Date(now.getTime() + 30 * 86_400_000);
  else if (op === "unfeature") set.featuredUntil = null;
  else if (op === "delete" && fd.get("confirm") === "on") {
    await db.delete(L).where(eq(L.id, l.id));
    await audit(staff.id, "listing.delete", l.id, { title: l.title, userId: l.userId });
    refresh(l.id, l.slug);
    redirect("/admin/anuncios/?apagado=1");
  } else return;

  await db.update(L).set(set).where(eq(L.id, l.id));
  await audit(staff.id, `listing.${op}`, l.id);
  refresh(l.id, l.slug);
}
