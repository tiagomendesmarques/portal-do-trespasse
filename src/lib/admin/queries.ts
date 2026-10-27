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
