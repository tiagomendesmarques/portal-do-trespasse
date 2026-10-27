import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { ROUTES } from "@/lib/site";
import { Logo } from "./logo";

const NAV = [
  { href: ROUTES.listings, label: "Anúncios" },
  { href: "/o-nosso-programa-de-ajuda/", label: "Programa de ajuda" },
  { href: "/blog/", label: "Blog" },
  { href: "/faq/", label: "FAQ" },
];

export async function SiteHeader() {
  const user = await getCurrentUser();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface">
      <div className="wrap flex h-16 items-center gap-5">
        <Logo />
        <nav className="hidden gap-1 md:flex" aria-label="Principal">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-2.5 py-2 font-medium text-ink no-underline hover:bg-surface-2">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <Link href={ROUTES.account} className="btn-ghost">
              <span className="grid size-6 place-items-center rounded-full bg-wash text-xs font-extrabold text-accent">{user.displayName.charAt(0).toUpperCase()}</span>
              <span className="hidden sm:inline">Minha conta</span>
            </Link>
          ) : (
            <Link href={ROUTES.account} className="btn-ghost">Entrar</Link>
          )}
          <Link href={ROUTES.post} className="btn-primary hidden sm:inline-flex">Publicar anúncio</Link>
        </div>
      </div>
    </header>
  );
}
