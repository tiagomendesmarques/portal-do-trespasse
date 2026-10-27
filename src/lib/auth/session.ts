import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isProduction, SITE_ENV } from "@/lib/site";
import { newToken, sha256 } from "./crypto";

const COOKIE = "pdt_session";
const SHORT_DAYS = 1;
const LONG_DAYS = 30;

export type SessionUser = typeof schema.users.$inferSelect;

export async function createSession(userId: number, remember: boolean) {
  const token = newToken();
  const days = remember ? LONG_DAYS : SHORT_DAYS;
  const expiresAt = new Date(Date.now() + days * 86_400_000);
  const h = await headers();
  await getDb().insert(schema.sessions).values({
    id: sha256(token),
    userId,
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 300),
    ip: clientIp(h),
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: isProduction || SITE_ENV === "staging",
    sameSite: "lax",
    path: "/",
    // Sem "Lembrar-se de mim" o cookie termina com o browser.
    ...(remember ? { expires: expiresAt } : {}),
  });
}

/** Utilizador da sessão atual (memorizado por pedido). */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const [row] = await getDb()
    .select({ user: schema.users })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, sha256(token)), gt(schema.sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.user.status !== "active") return null;
  return row.user;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await getDb().delete(schema.sessions).where(eq(schema.sessions.id, sha256(token)));
  jar.delete(COOKIE);
}

/** Termina todas as sessões de um utilizador (ex.: depois de mudar a password). */
export async function destroyAllSessions(userId: number) {
  await getDb().delete(schema.sessions).where(eq(schema.sessions.userId, userId));
}

export function clientIp(h: Headers): string | null {
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}
