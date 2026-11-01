import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { newToken } from "@/lib/auth/crypto";
import { notifyAdmins, sendTemplate } from "@/lib/email/send";
import { absoluteUrl, ROUTES, SITE_ENV } from "@/lib/site";

/**
 * "Continuar com o Google" (OpenID Connect, fluxo "authorization code" com PKCE).
 * O id_token vem diretamente do servidor de tokens do Google (HTTPS), por isso não é preciso verificar a
 * assinatura (OpenID Connect Core 3.1.3.7); verificam-se emissor, destinatário, validade, nonce e email confirmado.
 */
export const GOOGLE_COOKIE = "pdt_google";
export const GOOGLE_COOKIE_PATH = "/api/auth/google/";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const googleEnabled = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
export const googleRedirectUri = () => absoluteUrl("/api/auth/google/callback/");

/** Os testes usam um Google falso; em produção são sempre os endereços reais. */
function endpoints() {
  const testing = SITE_ENV !== "production";
  const fake = testing ? process.env.GOOGLE_OAUTH_FAKE_URL : undefined;
  return fake
    ? { auth: `${fake}/auth`, token: `${fake}/token`, issuers: [...ISSUERS, fake] }
    : { auth: AUTH_URL, token: TOKEN_URL, issuers: ISSUERS };
}

type Pending = { state: string; nonce: string; verifier: string; next: string | null };

export function encodePending(p: Pending) {
  return Buffer.from(JSON.stringify(p)).toString("base64url");
}
export function decodePending(value: string | undefined): Pending | null {
  if (!value) return null;
  try {
    const p = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    return typeof p?.state === "string" && typeof p?.nonce === "string" && typeof p?.verifier === "string" ? p : null;
  } catch {
    return null;
  }
}

/** Endereço do Google para onde o visitante vai, e o que fica guardado no cookie até ele voltar. */
export function startGoogleLogin(next: string | null): { url: string; pending: Pending } {
  const pending: Pending = { state: newToken(), nonce: newToken(), verifier: newToken() + newToken(), next };
  const challenge = createHash("sha256").update(pending.verifier).digest("base64url");
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: googleRedirectUri(),
    response_type: "code",
    scope: "openid email profile",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  });
  return { url: `${endpoints().auth}?${params}`, pending };
}

export type GoogleClaims = {
  iss: string; aud: string | string[]; exp: number; nonce?: string;
  sub: string; email?: string; email_verified?: boolean | string; name?: string; given_name?: string;
};

/** Valida o conteúdo do id_token. Devolve o motivo da recusa, ou null se estiver tudo certo. */
export function checkClaims(c: GoogleClaims, expected: { clientId: string; nonce: string; issuers: string[]; now?: number }): string | null {
  const now = Math.floor((expected.now ?? Date.now()) / 1000);
  if (!expected.issuers.includes(c.iss)) return "emissor";
  if (!(Array.isArray(c.aud) ? c.aud.includes(expected.clientId) : c.aud === expected.clientId)) return "destinatário";
  if (!c.exp || c.exp < now - 60) return "expirado";
  if (!c.nonce || c.nonce !== expected.nonce) return "nonce";
  if (!c.sub) return "sub";
  if (!c.email || !(c.email_verified === true || c.email_verified === "true")) return "email não confirmado";
  return null;
}

export function decodeIdToken(jwt: string): GoogleClaims {
  const payload = jwt.split(".")[1];
  if (!payload) throw new Error("id_token inválido");
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
}

/** Troca o código pelo id_token (servidor a servidor) e valida-o. */
export async function finishGoogleLogin(code: string, pending: Pending): Promise<GoogleClaims> {
  const ep = endpoints();
  const res = await fetch(ep.token, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, code_verifier: pending.verifier, grant_type: "authorization_code", redirect_uri: googleRedirectUri(),
      client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !body.id_token) throw new Error(`token: ${res.status} ${body.error ?? ""}`.trim());
  const claims = decodeIdToken(body.id_token);
  const problem = checkClaims(claims, { clientId: process.env.GOOGLE_CLIENT_ID!, nonce: pending.nonce, issuers: ep.issuers });
  if (problem) throw new Error(`id_token: ${problem}`);
  return claims;
}

/** Nome de utilizador livre a partir do email (ex.: joao.silva, joao.silva2…). */
async function freeUsername(email: string) {
  const base = (email.split("@")[0].toLowerCase().replace(/[^a-z0-9._-]+/g, "").slice(0, 24) || "anunciante").replace(/^[._-]+/, "") || "anunciante";
  for (let i = 0; i < 50; i++) {
    const candidate = i ? `${base}${i + 1}` : base;
    const taken = await getDb().query.users.findFirst({ where: sql`lower(${schema.users.username}) = ${candidate}`, columns: { id: true } });
    if (!taken) return candidate;
  }
  return `${base}${Date.now() % 100000}`;
}

export type GoogleLoginResult =
  | { user: typeof schema.users.$inferSelect; created: boolean }
  | { error: "bloqueado" | "outra-conta" };

/**
 * Entra, liga ou cria a conta:
 * 1. conta já ligada a este Google → entra;
 * 2. conta com o mesmo email (confirmado pelo Google) → liga e entra (fica com a password que tinha);
 * 3. senão cria uma conta nova, sem password (pode definir uma depois em "Editar conta").
 */
export async function loginWithGoogle(c: GoogleClaims): Promise<GoogleLoginResult> {
  const db = getDb();
  const U = schema.users;
  const email = c.email!.trim().toLowerCase();
  const now = new Date();

  let user = await db.query.users.findFirst({ where: eq(U.googleSub, c.sub) });
  if (!user) {
    const byEmail = await db.query.users.findFirst({ where: sql`lower(${U.email}) = ${email}` });
    if (byEmail) {
      if (byEmail.googleSub && byEmail.googleSub !== c.sub) return { error: "outra-conta" };
      [user] = await db.update(U).set({ googleSub: c.sub, emailVerifiedAt: byEmail.emailVerifiedAt ?? now, updatedAt: now }).where(eq(U.id, byEmail.id)).returning();
    }
  }
  if (user) {
    if (user.status === "blocked") return { error: "bloqueado" };
    await db.update(U).set({ lastLoginAt: now }).where(eq(U.id, user.id));
    return { user, created: false };
  }

  const name = (c.name ?? c.given_name ?? "").trim();
  const [created] = await db.insert(U).values({
    username: await freeUsername(email), email, passwordHash: "", googleSub: c.sub,
    displayName: name && !name.includes("@") ? name.slice(0, 60) : "Anunciante",
    firstName: c.given_name?.slice(0, 60) ?? null, emailVerifiedAt: now, lastLoginAt: now,
  }).returning();
  await sendTemplate("welcome", created.email, { name: created.displayName, post_url: absoluteUrl(ROUTES.post) });
  await notifyAdmins("admin_new_user", { user_name: created.username, user_email: created.email, admin_user_url: absoluteUrl(`/admin/utilizadores/${created.id}/`) });
  return { user: created, created: true };
}
