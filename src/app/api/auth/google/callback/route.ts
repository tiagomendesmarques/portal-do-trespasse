import { NextResponse, type NextRequest } from "next/server";
import { getDb, schema } from "@/db";
import { createSession } from "@/lib/auth/session";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, decodePending, finishGoogleLogin, googleEnabled, loginWithGoogle } from "@/lib/auth/google";
import { absoluteUrl, ROUTES } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Volta do Google: confirma o state, troca o código, entra (ou liga/cria a conta) e segue para onde ia. */
export async function GET(req: NextRequest) {
  const pending = decodePending(req.cookies.get(GOOGLE_COOKIE)?.value);
  const params = req.nextUrl.searchParams;
  const fail = (motivo: string) => {
    const res = NextResponse.redirect(absoluteUrl(`${ROUTES.account}?google=${motivo}`));
    res.cookies.set(GOOGLE_COOKIE, "", { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
    return res;
  };

  if (!googleEnabled()) return fail("erro");
  if (params.get("error")) return fail("cancelado"); // o visitante desistiu no ecrã do Google
  const code = params.get("code");
  if (!pending || !code || params.get("state") !== pending.state) return fail("expirou");

  let result;
  try {
    result = await loginWithGoogle(await finishGoogleLogin(code, pending));
  } catch (e) {
    console.error("Login com o Google falhou:", e instanceof Error ? e.message : e);
    return fail("erro");
  }
  if ("error" in result) return fail(result.error);

  await createSession(result.user.id, true);
  await getDb().insert(schema.auditLog).values({ actorId: result.user.id, action: result.created ? "user.google_signup" : "user.google_login", entity: "user", entityId: String(result.user.id) });
  const res = NextResponse.redirect(absoluteUrl(pending.next ?? (result.created ? `${ROUTES.account}?bemvindo=1` : ROUTES.account)));
  res.cookies.set(GOOGLE_COOKIE, "", { path: GOOGLE_COOKIE_PATH, maxAge: 0 });
  return res;
}
