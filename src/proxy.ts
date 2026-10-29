import { NextResponse, type NextRequest } from "next/server";

/**
 * Staging: pede utilizador/password (Basic Auth) e marca tudo como noindex.
 * Ligado só quando BASIC_AUTH_USER e BASIC_AUTH_PASSWORD estão definidos.
 */
// Saúde (Cloud Run) e tarefas agendadas (têm o seu próprio segredo) ficam fora da password.
const PUBLIC_PATHS = ["/api/health", "/api/cron/"];

export function proxy(req: NextRequest) {
  // www.portaldotrespasse.pt → portaldotrespasse.pt (um só endereço para o Google).
  const host = req.headers.get("host") ?? "";
  if (host.startsWith("www.")) {
    const url = new URL(req.nextUrl.pathname + req.nextUrl.search, `https://${host.slice(4)}`);
    return NextResponse.redirect(url, 301);
  }
  const user = process.env.BASIC_AUTH_USER;
  const pass = process.env.BASIC_AUTH_PASSWORD;
  if (user && pass && !PUBLIC_PATHS.some((x) => req.nextUrl.pathname.startsWith(x))) {
    const header = req.headers.get("authorization") ?? "";
    const [scheme, encoded] = header.split(" ");
    // A password pode conter ":"; só o primeiro separa o utilizador.
    const decoded = scheme === "Basic" && encoded ? atob(encoded) : "";
    const i = decoded.indexOf(":");
    const [u, p] = i >= 0 ? [decoded.slice(0, i), decoded.slice(i + 1)] : [];
    if (u !== user || p !== pass) {
      return new NextResponse("Acesso restrito", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Staging"' } });
    }
  }
  const res = NextResponse.next();
  if (process.env.SITE_ENV !== "production") res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
