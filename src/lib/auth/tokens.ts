import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newToken, sha256 } from "./crypto";

type TokenType = "verify_email" | "reset_password";
const TTL_MINUTES: Record<TokenType, number> = { verify_email: 48 * 60, reset_password: 60 };

/** Cria um token de uso único e devolve-o em claro (só vai no email). */
export async function createUserToken(userId: number, type: TokenType): Promise<string> {
  const db = getDb();
  const token = newToken();
  // Invalida pedidos anteriores do mesmo tipo.
  await db
    .update(schema.userTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(schema.userTokens.userId, userId), eq(schema.userTokens.type, type), isNull(schema.userTokens.usedAt)));
  await db.insert(schema.userTokens).values({
    userId,
    type,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + TTL_MINUTES[type] * 60_000),
  });
  return token;
}

/** Consome um token válido e devolve o userId, ou null. */
export async function consumeUserToken(token: string, type: TokenType): Promise<number | null> {
  if (!token) return null;
  const [row] = await getDb()
    .update(schema.userTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(schema.userTokens.tokenHash, sha256(token)),
        eq(schema.userTokens.type, type),
        isNull(schema.userTokens.usedAt),
        gt(schema.userTokens.expiresAt, new Date()),
      ),
    )
    .returning({ userId: schema.userTokens.userId });
  return row?.userId ?? null;
}

/** Verifica sem consumir (para mostrar o formulário de nova password). */
export async function peekUserToken(token: string, type: TokenType): Promise<boolean> {
  if (!token) return false;
  const row = await getDb().query.userTokens.findFirst({
    where: (t, { and, eq, isNull, gt }) =>
      and(eq(t.tokenHash, sha256(token)), eq(t.type, type), isNull(t.usedAt), gt(t.expiresAt, new Date())),
  });
  return Boolean(row);
}
