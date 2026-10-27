"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type NavItem = { href: string; label: string; badge?: number; adminOnly?: boolean };

/** Menu lateral; no telemóvel fica fechado atrás de um botão "Menu" (com o total de pendentes). */
export function AdminNav({ groups, brand, footer }: { groups: { title: string; items: NavItem[] }[]; brand: React.ReactNode; footer: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(path);
  // Fecha ao mudar de página.
  if (open && openedAt !== path) setOpen(false);
  const pending = groups.flatMap((g) => g.items).reduce((n, i) => n + (i.badge ?? 0), 0);
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        {brand}
        <button type="button" className="flex items-center gap-2 rounded-md border border-white/25 px-3 py-1.5 text-sm font-semibold md:hidden" aria-expanded={open} aria-controls="admin-menu"
          onClick={() => { setOpen(!open); setOpenedAt(path); }}>
          {open ? "Fechar" : "Menu"}
          {!open && pending > 0 && <span className="rounded-full bg-brand px-2 text-xs font-bold text-navy tabular-nums">{pending}</span>}
        </button>
      </div>
      <div id="admin-menu" className={`${open ? "flex" : "hidden"} flex-1 flex-col gap-6 md:flex`}>
        <nav className="flex flex-col gap-4" aria-label="Back-office">
          {groups.map((g) => (
            <div key={g.title} className="flex flex-col gap-0.5">
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-white/50">{g.title}</p>
              {g.items.map((i) => {
                const active = i.href === "/admin/" ? path === "/admin/" : path.startsWith(i.href);
                return (
                  <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
                    className={`flex items-center justify-between rounded-md px-3 py-1.5 text-sm no-underline ${active ? "bg-white/15 font-semibold text-white" : "text-white/80 hover:bg-white/10"}`}>
                    {i.label}
                    {i.badge ? <span className="rounded-full bg-brand px-2 text-xs font-bold text-navy tabular-nums">{i.badge}</span> : null}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
        {footer}
      </div>
    </>
  );
}
