import "server-only";
import { and, desc, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { getDb, schema } from "@/db";

const L = schema.listings;
const days = (n: number) => new Date(Date.now() - n * 86_400_000);
const count = async (table: PgTable, where?: SQL) => {
  const [r] = await getDb().select({ n: sql<number>`count(*)::int` }).from(table).where(where);
  return r.n;
};

/** Números do menu lateral (o que precisa de atenção). */
export async function adminBadges() {
  const [pending, reports] = await Promise.all([
    count(L, eq(L.status, "pending")),
    count(schema.reports, eq(schema.reports.status, "open")),
  ]);
  return { pending, reports };
}

export async function dashboardStats() {
  const soon = new Date(Date.now() + 7 * 86_400_000);
  const [pending, published, expiring, reports, newUsers, contacts, siteMessages, failedEmails, totalViews] = await Promise.all([
    count(L, eq(L.status, "pending")),
    count(L, eq(L.status, "published")),
    count(L, and(eq(L.status, "published"), lte(L.expiresAt, soon))),
    count(schema.reports, eq(schema.reports.status, "open")),
    count(schema.users, gte(schema.users.createdAt, days(30))),
    count(schema.messages, and(eq(schema.messages.kind, "listing_contact"), gte(schema.messages.createdAt, days(30)))),
    count(schema.messages, and(eq(schema.messages.kind, "site_contact"), gte(schema.messages.createdAt, days(30)))),
    count(schema.emailLog, and(eq(schema.emailLog.status, "failed"), gte(schema.emailLog.createdAt, days(7)))),
    getDb().select({ n: sql<number>`coalesce(sum(${L.views}),0)::int` }).from(L).where(eq(L.status, "published")).then((r) => r[0].n),
  ]);
  return { pending, published, expiring, reports, newUsers, contacts, siteMessages, failedEmails, totalViews };
}

export async function recentPending(limit = 6) {
  return getDb()
    .select({ id: L.id, title: L.title, createdAt: L.createdAt, updatedAt: L.updatedAt, publishedAt: L.publishedAt, user: schema.users.displayName })
    .from(L)
    .innerJoin(schema.users, eq(schema.users.id, L.userId))
    .where(eq(L.status, "pending"))
    .orderBy(L.updatedAt)
    .limit(limit);
}

export async function recentUsers(limit = 6) {
  return getDb()
    .select({ id: schema.users.id, displayName: schema.users.displayName, email: schema.users.email, createdAt: schema.users.createdAt, verified: sql<boolean>`${schema.users.emailVerifiedAt} is not null` })
    .from(schema.users)
    .orderBy(desc(schema.users.createdAt))
    .limit(limit);
}

/* ---------- Anúncios ---------- */

export const ADMIN_PAGE_SIZE = 25;

export async function adminListings(f: { status?: string; q?: string; category?: number; userId?: number; expiringDays?: number; page: number }) {
  const db = getDb();
  const where: SQL[] = [];
  if (f.status) where.push(sql`${L.status} = ${f.status}`);
  if (f.category) where.push(eq(L.categoryId, f.category));
  if (f.userId) where.push(eq(L.userId, f.userId));
  if (f.expiringDays) where.push(lte(L.expiresAt, new Date(Date.now() + f.expiringDays * 86_400_000)));
  if (f.q) {
    const q = `%${f.q.toLowerCase()}%`;
    where.push(sql`(lower(${L.title}) like ${q} or ${L.id}::text = ${f.q} or ${L.wpId}::text = ${f.q} or lower(${schema.users.displayName}) like ${q} or lower(${schema.users.email}) like ${q})`);
  }
  const cond = where.length ? and(...where) : undefined;
  const base = db.select({ n: sql<number>`count(*)::int` }).from(L).innerJoin(schema.users, eq(schema.users.id, L.userId)).where(cond);
  const [[{ n: total }], rows] = await Promise.all([
    base,
    db
      .select({
        id: L.id, slug: L.slug, title: L.title, status: L.status, views: L.views, price: L.price, priceType: L.priceType, priceUnit: L.priceUnit,
        createdAt: L.createdAt, updatedAt: L.updatedAt, publishedAt: L.publishedAt, expiresAt: L.expiresAt, featuredUntil: L.featuredUntil,
        userId: L.userId, user: schema.users.displayName, category: schema.categories.name,
        imageKey: sql<string | null>`(select storage_key from listing_images i where i.listing_id = ${L.id} order by sort limit 1)`,
        reports: sql<number>`(select count(*)::int from reports r where r.listing_id = ${L.id} and r.status = 'open')`,
      })
      .from(L)
      .innerJoin(schema.users, eq(schema.users.id, L.userId))
      .innerJoin(schema.categories, eq(schema.categories.id, L.categoryId))
      .where(cond)
      // Pendentes: os mais antigos primeiro (fila); restantes: mais recentes primeiro.
      .orderBy(f.status === "pending" ? L.updatedAt : desc(L.updatedAt))
      .limit(ADMIN_PAGE_SIZE)
      .offset((f.page - 1) * ADMIN_PAGE_SIZE),
  ]);
  return { rows, total, pages: Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE)) };
}

export async function statusCounts() {
  const rows = await getDb().select({ status: L.status, n: sql<number>`count(*)::int` }).from(L).groupBy(L.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Record<string, number>;
}

export async function auditFor(entity: string, entityId: string) {
  return getDb()
    .select({ id: schema.auditLog.id, action: schema.auditLog.action, data: schema.auditLog.data, createdAt: schema.auditLog.createdAt, actor: schema.users.displayName })
    .from(schema.auditLog)
    .leftJoin(schema.users, eq(schema.users.id, schema.auditLog.actorId))
    .where(and(eq(schema.auditLog.entity, entity), eq(schema.auditLog.entityId, entityId)))
    .orderBy(desc(schema.auditLog.createdAt))
    .limit(50);
}

export const AUDIT_LABEL: Record<string, string> = {
  "listing.create": "Criou o anúncio", "listing.edit": "Editou o anúncio", "listing.staff_edit": "Equipa editou o anúncio",
  "listing.approve": "Aprovou", "listing.reject": "Rejeitou", "listing.unpublish": "Despublicou", "listing.sold": "Marcou como vendido",
  "listing.available": "Voltou a disponível", "listing.republish": "Voltou a publicar", "listing.renew": "Renovou", "listing.extend": "Prolongou a validade",
  "listing.feature": "Destacou", "listing.unfeature": "Retirou o destaque", "listing.delete": "Apagou", "listing.expire": "Expirou (automático)",
  "user.role": "Mudou o perfil", "user.block": "Bloqueou", "user.unblock": "Desbloqueou", "user.delete": "Apagou a conta", "user.verify": "Confirmou o email",
  "report.resolve": "Resolveu a denúncia", "settings.update": "Alterou definições", "email.update": "Alterou o modelo de email",
  "page.update": "Editou a página", "post.update": "Editou o artigo", "post.create": "Criou o artigo", "redirect.create": "Criou redirect", "redirect.delete": "Apagou redirect",
  "category.update": "Editou a categoria", "field.update": "Editou o campo",
};
