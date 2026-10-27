import { mkdtempSync, rmSync, utimesSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
// Só importações dinâmicas do código da aplicação: DATABASE_URL e MEDIA_DIR têm de ser
// definidos antes, para o teste nunca tocar na base de dados ou nas fotografias locais.
process.env.DATABASE_URL = "pglite:memory";
const media = mkdtempSync(join(tmpdir(), "pdt-media-"));
process.env.MEDIA_DIR = media;
const { jobCutoffs } = await import("./daily");

const DAY = 86_400_000;
const now = new Date("2026-11-04T06:00:00Z");
const S = { warnDays: 3, reminderDays: 3, deleteDays: 365, durationDays: 120 };

describe("jobCutoffs", () => {
  const c = jobCutoffs(now, S);

  it("avisa nos 3 dias antes de expirar", () => {
    expect(c.warnUpTo.getTime() - now.getTime()).toBe(3 * DAY);
    expect(c.expireUpTo).toEqual(now);
  });

  it("lembra 3 dias depois de expirar, só numa janela curta", () => {
    expect(now.getTime() - c.remindUpTo.getTime()).toBe(3 * DAY);
    expect(now.getTime() - c.remindFrom.getTime()).toBe(10 * DAY);
  });

  it("apaga expirados há mais de 365 dias; 0 desliga", () => {
    expect(now.getTime() - c.deleteBefore!.getTime()).toBe(365 * DAY);
    expect(jobCutoffs(now, { ...S, deleteDays: 0 }).deleteBefore).toBeNull();
  });
});

// Teste de integração com um Postgres embutido (PGlite em memória).
describe("runDailyJobs", () => {
  let db: typeof import("@/db");
  let run: typeof import("./daily").runDailyJobs;
  let ids: Record<string, number> = {};

  const at = (days: number) => new Date(now.getTime() + days * DAY);
  const status = async (id: number) => (await db.getDb().query.listings.findFirst({ where: (l, { eq }) => eq(l.id, id) }))?.status;
  const emails = async () => (await db.getDb().select().from(db.schema.emailLog)).map((e) => e.templateKey).sort();

  beforeAll(async () => {
    db = await import("@/db");
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db.getDb() as never, { migrationsFolder: "./drizzle" });
    run = (await import("./daily")).runDailyJobs;

    const d = db.getDb();
    const s = db.schema;
    await d.insert(s.listingTypes).values({ key: "sell", name: "Trespasse" });
    const [cat] = await d.insert(s.categories).values({ name: "Restauração", slug: "restauracao" }).returning();
    const [loc] = await d.insert(s.locations).values({ level: "distrito", name: "Lisboa", slug: "lisboa" }).returning();
    const [owner] = await d.insert(s.users).values({ username: "dono", email: "dono@exemplo.pt", passwordHash: "x", displayName: "Dono", emailVerifiedAt: now }).returning();
    await d.insert(s.users).values({ username: "admin", email: "admin@exemplo.pt", passwordHash: "x", displayName: "Admin", role: "admin" });

    const mk = async (slug: string, status: "published" | "sold" | "expired", expiresInDays: number, extra: Record<string, unknown> = {}) => {
      const [l] = await d.insert(s.listings).values({ userId: owner.id, typeKey: "sell", categoryId: cat.id, locationId: loc.id, title: slug, slug, description: "x", status, expiresAt: at(expiresInDays), ...extra }).returning();
      ids[slug] = l.id;
      return l;
    };
    await mk("ativo", "published", 30);
    await mk("quase", "published", 2);
    await mk("ja-avisado", "published", 1, { expiryWarnedAt: at(-1) });
    await mk("hoje", "published", -0.1);
    await mk("vendido", "sold", -1);
    await mk("ha-4-dias", "expired", -4);
    await mk("ha-60-dias", "expired", -60);
    const velho = await mk("ha-400-dias", "expired", -400);

    // Fotografias: uma do anúncio antigo (vai ser apagado), uma órfã antiga, uma órfã recente.
    for (const key of ["listings/velho/a", "listings/u1/orfa", "listings/u1/nova"]) {
      mkdirSync(join(media, key, ".."), { recursive: true });
      for (const w of [400, 800, 1600]) {
        const f = join(media, `${key}-${w}.webp`);
        writeFileSync(f, "x");
        const age = key === "listings/u1/nova" ? at(-0.2) : at(-5);
        utimesSync(f, age, age);
      }
    }
    await d.insert(s.listingImages).values({ listingId: velho.id, storageKey: "listings/velho/a", width: 800, height: 600, sort: 0 });
    // Sessão expirada e limite de pedidos antigo.
    await d.insert(s.sessions).values({ id: "old", userId: owner.id, expiresAt: at(-1) });
    await d.insert(s.rateLimits).values({ key: "login:1", count: 3, resetAt: at(-1) });
  });

  afterAll(async () => {
    await db?.closeDb();
    rmSync(media, { recursive: true, force: true });
  });

  it("expira, avisa, lembra, apaga e limpa", async () => {
    expect(process.env.MEDIA_DIR).toBe(media);
    const r = await run(now);
    expect(r.errors).toEqual([]);
    expect(r).toMatchObject({ expired: 2, warned: 1, reminded: 1, deleted: 1, orphanImages: 2, sessions: 1, rateLimits: 1 });

    expect(await status(ids.ativo)).toBe("published");
    expect(await status(ids.quase)).toBe("published");
    expect(await status(ids.hoje)).toBe("expired");
    expect(await status(ids.vendido)).toBe("expired");
    expect(await status(ids["ha-400-dias"])).toBeUndefined();

    // Vendido expira sem emails; o anúncio expirado avisa o dono e a administração.
    expect(await emails()).toEqual(["admin_listing_expired", "listing_expired", "listing_expiring", "listing_renewal_reminder"]);

    expect(existsSync(join(media, "listings/velho/a-800.webp"))).toBe(false);
    expect(existsSync(join(media, "listings/u1/orfa-800.webp"))).toBe(false);
    expect(existsSync(join(media, "listings/u1/nova-800.webp"))).toBe(true);
  });

  it("não repete emails se correr outra vez", async () => {
    const r = await run(new Date(now.getTime() + 3_600_000));
    expect(r).toMatchObject({ expired: 0, warned: 0, reminded: 0, deleted: 0 });
    expect((await emails()).length).toBe(4);
  });

  it("não apaga nada se a maioria das fotografias parecer órfã", async () => {
    for (let i = 0; i < 25; i++) {
      for (const w of [400, 800, 1600]) {
        const f = join(media, `listings/u1/lote${i}-${w}.webp`);
        writeFileSync(f, "x");
        utimesSync(f, at(-5), at(-5));
      }
    }
    const r = await run(now);
    expect(r.orphanImages).toBe(0);
    expect(r.errors.join()).toContain("nada foi apagado");
    expect(existsSync(join(media, "listings/u1/lote0-800.webp"))).toBe(true);
  });
});
