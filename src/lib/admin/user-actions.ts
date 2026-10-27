"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { requireAdmin, requireStaff } from "@/lib/admin/guard";
import { destroyAllSessions } from "@/lib/auth/session";
import { createUserToken } from "@/lib/auth/tokens";
import { sendTemplate } from "@/lib/email/send";
import { absoluteUrl, ROUTES } from "@/lib/site";

const U = schema.users;

async function audit(actorId: number, action: string, entity: string, entityId: number, data?: unknown) {
  await getDb().insert(schema.auditLog).values({ actorId, action, entity, entityId: String(entityId), data: data ?? null });
}

async function target(fd: FormData) {
  const u = await getDb().query.users.findFirst({ where: eq(U.id, Number(fd.get("id"))) });
  if (!u) throw new Error("Utilizador não encontrado.");
  return u;
}

export async function userAction(fd: FormData) {
  const op = String(fd.get("op"));
  // Enviar emails de apoio pode ser feito por editores; o resto é só para administradores.
  const staff = ["resend_verification", "send_reset"].includes(op) ? await requireStaff() : await requireAdmin();
  const u = await target(fd);
  const db = getDb();
  const self = u.id === staff.id;

  switch (op) {
    case "role": {
      const role = String(fd.get("role")) as "user" | "editor" | "admin";
      if (self || !["user", "editor", "admin"].includes(role)) return;
      await db.update(U).set({ role }).where(eq(U.id, u.id));
      await audit(staff.id, "user.role", "user", u.id, { from: u.role, to: role });
      break;
    }
    case "block": {
      if (self || u.role === "admin") return;
      await db.update(U).set({ status: "blocked" }).where(eq(U.id, u.id));
      await destroyAllSessions(u.id);
      // Os anúncios públicos saem do ar e voltam à fila de aprovação.
      await db.update(schema.listings).set({ status: "pending" }).where(and(eq(schema.listings.userId, u.id), inArray(schema.listings.status, ["published", "sold"])));
      await audit(staff.id, "user.block", "user", u.id);
      break;
    }
    case "unblock":
      await db.update(U).set({ status: "active" }).where(eq(U.id, u.id));
      await audit(staff.id, "user.unblock", "user", u.id);
      break;
    case "verify":
      await db.update(U).set({ emailVerifiedAt: sql`coalesce(${U.emailVerifiedAt}, now())` }).where(eq(U.id, u.id));
      await audit(staff.id, "user.verify", "user", u.id);
      break;
    case "resend_verification": {
      if (u.emailVerifiedAt) return;
      const token = await createUserToken(u.id, "verify_email");
      await sendTemplate("verify_email", u.email, { name: u.displayName, verify_url: absoluteUrl(`${ROUTES.verify}?token=${token}`) });
      await audit(staff.id, "user.resend_verification", "user", u.id);
      break;
    }
    case "send_reset": {
      const token = await createUserToken(u.id, "reset_password");
      await sendTemplate("reset_password", u.email, { name: u.displayName, reset_url: absoluteUrl(`${ROUTES.resetPassword}?token=${token}`) });
      await audit(staff.id, "user.send_reset", "user", u.id);
      break;
    }
    case "delete": {
      if (self || u.role === "admin" || fd.get("confirm") !== "on") return;
      await audit(staff.id, "user.delete", "user", u.id, { email: u.email, wpId: u.wpId });
      await db.delete(U).where(eq(U.id, u.id));
      revalidatePath("/admin/utilizadores/");
      redirect("/admin/utilizadores/?apagado=1");
    }
    default:
      return;
  }
  revalidatePath(`/admin/utilizadores/${u.id}/`);
}

/** Denúncias: resolver, ou resolver tirando o anúncio do ar / bloqueando o anunciante. */
export async function reportAction(fd: FormData) {
  const op = String(fd.get("op"));
  const staff = op === "block_owner" ? await requireAdmin() : await requireStaff();
  const db = getDb();
  const report = await db.query.reports.findFirst({ where: eq(schema.reports.id, Number(fd.get("id"))) });
  if (!report) return;
  const listing = await db.query.listings.findFirst({ where: eq(schema.listings.id, report.listingId) });

  if (op === "unpublish" && listing) {
    await db.update(schema.listings).set({ status: "pending" }).where(eq(schema.listings.id, listing.id));
    await audit(staff.id, "listing.unpublish", "listing", listing.id, { report: report.id });
  }
  if (op === "block_owner" && listing) {
    const owner = await db.query.users.findFirst({ where: eq(U.id, listing.userId) });
    if (owner && owner.role !== "admin") {
      await db.update(U).set({ status: "blocked" }).where(eq(U.id, owner.id));
      await destroyAllSessions(owner.id);
      await db.update(schema.listings).set({ status: "pending" }).where(and(eq(schema.listings.userId, owner.id), inArray(schema.listings.status, ["published", "sold"])));
      await audit(staff.id, "user.block", "user", owner.id, { report: report.id });
    }
  }
  // Resolve esta denúncia e as outras abertas do mesmo anúncio.
  await db.update(schema.reports).set({ status: "resolved", resolvedBy: staff.id, resolvedAt: new Date() })
    .where(and(eq(schema.reports.listingId, report.listingId), eq(schema.reports.status, "open")));
  await audit(staff.id, "report.resolve", "report", report.id, { op });
  revalidatePath("/admin/", "layout");
}
