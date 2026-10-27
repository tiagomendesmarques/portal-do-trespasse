import Link from "next/link";
import { logoutAction } from "@/lib/auth/actions";
import type { SessionUser } from "@/lib/auth/session";

const NAV = [
  ["painel", "/my-account/", "Painel"],
  ["anuncios", "/my-account/listings/", "Os meus anúncios"],
  ["favoritos", "/my-account/favourites/", "Favoritos"],
  ["mensagens", "/my-account/messages/", "Mensagens"],
  ["conta", "/my-account/edit-account/", "Editar conta"],
] as const;

export function AccountShell({ user, active, title, children, counts = {} }: { user: SessionUser; active: (typeof NAV)[number][0]; title: string; children: React.ReactNode; counts?: Partial<Record<string, number>> }) {
  return (
    <div className="wrap py-8">
      <p className="eyebrow">Minha conta · {user.displayName}</p>
      <h1 className="mb-6 text-3xl font-extrabold">{title}</h1>
      <div className="grid items-start gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="panel flex gap-1 overflow-x-auto p-2 md:flex-col" aria-label="Conta">
          {NAV.map(([key, href, label]) => (
            <Link key={key} href={href} aria-current={active === key ? "page" : undefined}
              className={`flex flex-none items-center justify-between gap-3 rounded-md px-3 py-2 text-sm font-medium no-underline ${active === key ? "bg-wash text-accent" : "text-ink hover:bg-surface-2"}`}>
              {label}
              {counts[key] ? <span className="rounded-full bg-surface-2 px-2 text-xs text-muted tabular-nums">{counts[key]}</span> : null}
            </Link>
          ))}
          {(user.role === "admin" || user.role === "editor") && (
            <Link href="/admin/" className="flex-none rounded-md px-3 py-2 text-sm font-medium text-ink no-underline hover:bg-surface-2">Back-office</Link>
          )}
          <form action={logoutAction} className="flex-none">
            <button className="w-full rounded-md px-3 py-2 text-left text-sm font-medium text-muted hover:bg-surface-2">Terminar sessão</button>
          </form>
        </nav>
        <section className="flex min-w-0 flex-col gap-4">{children}</section>
      </div>
    </div>
  );
}
