import { NextResponse, type NextRequest } from "next/server";
import { clientIp } from "@/lib/auth/session";
import { GOOGLE_COOKIE, GOOGLE_COOKIE_PATH, encodePending, googleEnabled, startGoogleLogin } from "@/lib/auth/google";
import { safeNext } from "@/lib/auth/validation";
import { rateLimit } from "@/lib/rate-limit";
import { absoluteUrl, isProduction, ROUTES } from "@/lib/site";

export const dynamic = "force-dynamic";

/** "Continuar com o Google": guarda state/nonce/PKCE num cookie de 10 minutos e envia o visitante para o Google. */
export async function GET(req: NextRequest) {
  if (!googleEnabled()) return NextResponse.redirect(absoluteUrl(ROUTES.account));
  if (!(await rateLimit(`google:${clientIp(req.headers) ?? "?"}`, 30, 600))) return NextResponse.redirect(absoluteUrl(`${ROUTES.account}?google=muitas`));
  const { url, pending } = startGoogleLogin(safeNext(req.nextUrl.searchParams.get("next")));
  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_COOKIE, encodePending(pending), { httpOnly: true, sameSite: "lax", secure: isProduction || req.nextUrl.protocol === "https:", path: GOOGLE_COOKIE_PATH, maxAge: 600 });
  return res;
}
