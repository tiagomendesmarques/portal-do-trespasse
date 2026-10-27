import { and, eq, gt, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { formatDate } from "@/lib/format";
import { deleteMedia, listMediaKeys } from "@/lib/media";
import { getSettings } from "@/lib/settings";
import { absoluteUrl } from "@/lib/site";

const DAY = 86_400_000;
const L = schema.listings;

/** Os lembretes só vão para anúncios que expiraram há pouco (não para anúncios antigos migrados). */
export const REMINDER_WINDOW_DAYS = 7;
/** Imagens carregadas há menos tempo podem pertencer a um anúncio ainda a ser preenchido. */
export const ORPHAN_GRACE_DAYS = 1;
export const TOKEN_KEEP_DAYS = 7;
export const EMAIL_LOG_KEEP_DAYS = 180;
/**
 * Travão: se mais de metade das fotografias parecer órfã, algo está mal configurado
 * (base de dados errada ou vazia) e não se apaga nada.
 */
export const ORPHAN_MAX_SHARE = 0.5;

export type JobSettings = { warnDays: number; reminderDays: number; deleteDays: number; durationDays: number };

/** Datas-limite de cada tarefa. Função pura, para poder ser testada. */
export function jobCutoffs(now: Date, s: JobSettings) {
  const t = now.getTime();
  return {
    /** Publicados/vendidos com expiresAt <= expireUpTo passam a expirados. */
    expireUpTo: now,
    /** Publicados com expiresAt em ]now, warnUpTo] recebem o aviso (uma vez). */
    warnUpTo: new Date(t + s.warnDays * DAY),
    /** Expirados com expiresAt em ]remindFrom, remindUpTo] recebem o lembrete (uma vez). */
    remindUpTo: new Date(t - s.reminderDays * DAY),
    remindFrom: new Date(t - (s.reminderDays + REMINDER_WINDOW_DAYS) * DAY),
    /** Expirados com expiresAt < deleteBefore são apagados (0 = nunca). */
    deleteBefore: s.deleteDays > 0 ? new Date(t - s.deleteDays * DAY) : null,
    orphanBefore: new Date(t - ORPHAN_GRACE_DAYS * DAY),
    tokensBefore: new Date(t - TOKEN_KEEP_DAYS * DAY),
    emailLogBefore: new Date(t - EMAIL_LOG_KEEP_DAYS * DAY),
  };
}

export type DailyReport = {
  expired: number;
  warned: number;
  reminded: number;
  deleted: number;
  orphanImages: number;
  sessions: number;
  tokens: number;
  rateLimits: number;
  emailLog: number;
  errors: string[];
};

async function audit(action: string, entity: string, id: number | string, data?: unknown) {
  await getDb().insert(schema.auditLog).values({ actorId: null, action, entity, entityId: String(id), data: data ?? null });
}

/** Anúncios + dono + categoria, para os emails. */
function listingsWithOwner(where: ReturnType<typeof and>) {
  return getDb()
    .select({
      id: L.id, slug: L.slug, title: L.title, status: L.status, expiresAt: L.expiresAt,
      ownerName: schema.users.displayName, ownerEmail: schema.users.email, ownerStatus: schema.users.status,
      remindersOptOut: schema.users.remindersOptOut, category: schema.categories.name,
    })
    .from(L)
    .innerJoin(schema.users, eq(schema.users.id, L.userId))
    .innerJoin(schema.categories, eq(schema.categories.id, L.categoryId))
    .where(where);
}

/**
 * Tarefas diárias (Cloud Scheduler → /api/cron/daily). Idempotente: correr duas vezes no
 * mesmo dia não repete emails, porque cada aviso fica marcado no anúncio.
 */
export async function runDailyJobs(now = new Date()): Promise<DailyReport> {
  const db = getDb();
  const st = await getSettings(["listings.expiryWarningDays", "listings.reminderAfterDays", "listings.deleteExpiredAfterDays", "listings.durationDays"]);
  const c = jobCutoffs(now, {
    warnDays: st["listings.expiryWarningDays"],
    reminderDays: st["listings.reminderAfterDays"],
    deleteDays: st["listings.deleteExpiredAfterDays"],
    durationDays: st["listings.durationDays"],
  });
  const r: DailyReport = { expired: 0, warned: 0, reminded: 0, deleted: 0, orphanImages: 0, sessions: 0, tokens: 0, rateLimits: 0, emailLog: 0, errors: [] };
  const step = async (name: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      r.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const renewUrl = absoluteUrl("/my-account/listings/");

  // 1. Expirar (antes do aviso, para nunca avisar um anúncio que já passou o prazo).
  await step("expirar", async () => {
    const due = await listingsWithOwner(and(inArray(L.status, ["published", "sold"]), lte(L.expiresAt, c.expireUpTo)));
    for (const l of due) {
      await db.update(L).set({ status: "expired", updatedAt: now }).where(and(eq(L.id, l.id), inArray(L.status, ["published", "sold"])));
      await audit("listing.expire", "listing", l.id);
      r.expired++;
      // Um anúncio marcado como vendido sai do ar sem convite para renovar.
      if (l.status === "sold" || l.ownerStatus !== "active") continue;
      const vars = { name: l.ownerName, user_name: l.ownerName, listing_title: l.title, category_name: l.category, expires_at: formatDate(l.expiresAt), renew_url: renewUrl, admin_listing_url: absoluteUrl(`/admin/anuncios/${l.id}/`) };
      await sendTemplate("listing_expired", l.ownerEmail, vars);
      await notifyAdmins("admin_listing_expired", vars);
    }
  });

  // 2. Aviso de expiração próxima.
  await step("avisar", async () => {
    const due = await listingsWithOwner(and(eq(L.status, "published"), gt(L.expiresAt, c.expireUpTo), lte(L.expiresAt, c.warnUpTo), isNull(L.expiryWarnedAt)));
    for (const l of due) {
      await db.update(L).set({ expiryWarnedAt: now }).where(eq(L.id, l.id));
      if (l.ownerStatus !== "active") continue;
      await sendTemplate("listing_expiring", l.ownerEmail, {
        name: l.ownerName, listing_title: l.title, expires_at: formatDate(l.expiresAt), duration_days: st["listings.durationDays"], renew_url: renewUrl,
      });
      r.warned++;
    }
  });

  // 3. Lembrete depois de expirar.
  await step("lembrar", async () => {
    const due = await listingsWithOwner(and(eq(L.status, "expired"), gt(L.expiresAt, c.remindFrom), lte(L.expiresAt, c.remindUpTo), isNull(L.reminderSentAt)));
    for (const l of due) {
      await db.update(L).set({ reminderSentAt: now }).where(eq(L.id, l.id));
      if (l.ownerStatus !== "active" || l.remindersOptOut) continue;
      await sendTemplate("listing_renewal_reminder", l.ownerEmail, { name: l.ownerName, listing_title: l.title, expires_at: formatDate(l.expiresAt), renew_url: renewUrl });
      r.reminded++;
    }
  });

  // 4. Apagar anúncios expirados há muito tempo (as fotografias saem no passo seguinte).
  if (c.deleteBefore) {
    const before = c.deleteBefore;
    await step("apagar", async () => {
      const gone = await db.delete(L).where(and(eq(L.status, "expired"), lt(L.expiresAt, before))).returning({ id: L.id, title: L.title, userId: L.userId });
      for (const g of gone) await audit("listing.delete", "listing", g.id, { title: g.title, userId: g.userId, auto: true });
      r.deleted = gone.length;
    });
  }

  // 5. Fotografias sem anúncio/artigo (anúncios apagados, carregamentos abandonados).
  await step("imagens", async () => {
    const files = await listMediaKeys();
    if (!files.size) return;
    const [imgs, posts, pages] = await Promise.all([
      db.select({ k: schema.listingImages.storageKey }).from(schema.listingImages),
      db.select({ k: schema.posts.featuredImageKey, html: schema.posts.contentHtml }).from(schema.posts),
      db.select({ html: schema.pages.contentHtml }).from(schema.pages),
    ]);
    const used = new Set<string>([...imgs.map((i) => i.k), ...posts.map((p) => p.k).filter((k): k is string => !!k)]);
    const html = [...posts, ...pages].map((p) => p.html).join("\n");
    const orphans = [...files].filter(([key, mtime]) => !used.has(key) && mtime <= c.orphanBefore && !html.includes(`/media/${key}-`)).map(([key]) => key);
    if (orphans.length > 20 && orphans.length > files.size * ORPHAN_MAX_SHARE) {
      throw new Error(`${orphans.length} de ${files.size} fotografias sem referência; nada foi apagado (verifique a configuração).`);
    }
    for (const key of orphans) await deleteMedia(key);
    r.orphanImages = orphans.length;
  });

  // 6. Limpezas.
  await step("limpeza", async () => {
    r.sessions = (await db.delete(schema.sessions).where(lt(schema.sessions.expiresAt, now)).returning({ id: schema.sessions.id })).length;
    r.tokens = (await db.delete(schema.userTokens).where(or(lt(schema.userTokens.expiresAt, c.tokensBefore), and(sql`${schema.userTokens.usedAt} is not null`, lt(schema.userTokens.usedAt, c.tokensBefore)))).returning({ id: schema.userTokens.id })).length;
    r.rateLimits = (await db.delete(schema.rateLimits).where(lt(schema.rateLimits.resetAt, now)).returning({ k: schema.rateLimits.key })).length;
    r.emailLog = (await db.delete(schema.emailLog).where(lt(schema.emailLog.createdAt, c.emailLogBefore)).returning({ id: schema.emailLog.id })).length;
  });

  await audit("cron.daily", "system", "daily", r);
  return r;
}
