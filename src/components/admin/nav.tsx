"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type NavItem = { href: string; label: string; badge?: number; adminOnly?: boolean };

export function AdminNav({ groups }: { groups: { title: string; items: NavItem[] }[] }) {
  const path = usePathname();
  return (
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
  );
}
