"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function MobileMenu({ items, loggedIn }: { items: { href: string; label: string }[]; loggedIn: boolean }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <div className="md:hidden">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="menu-movel" className="grid size-10 place-items-center rounded-md border border-line" aria-label={open ? "Fechar menu" : "Abrir menu"}>
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          {open ? <path d="M4 4l10 10M14 4L4 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /> : <path d="M2 4h14M2 9h14M2 14h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />}
        </svg>
      </button>
      {open && (
        <nav id="menu-movel" className="absolute inset-x-0 top-16 z-30 flex flex-col gap-1 border-b border-line bg-surface px-4 pb-4 pt-2 shadow-lg" aria-label="Menu">
          {items.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-md px-3 py-2.5 font-medium text-ink no-underline hover:bg-surface-2">{n.label}</Link>
          ))}
          <Link href="/post-an-ad/" className="btn-primary mt-2">Publicar anúncio</Link>
          {!loggedIn && <Link href="/my-account/" className="btn-ghost">Entrar ou criar conta</Link>}
        </nav>
      )}
    </div>
  );
}
