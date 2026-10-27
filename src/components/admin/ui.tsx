import Link from "next/link";

export function AdminHeader({ title, intro, actions, crumbs }: { title: string; intro?: string; actions?: React.ReactNode; crumbs?: { href: string; label: string }[] }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {crumbs && (
          <nav className="mb-1 flex gap-1.5 text-sm text-muted" aria-label="Caminho">
            {crumbs.map((c) => <span key={c.href} className="flex gap-1.5"><Link href={c.href} className="text-muted">{c.label}</Link><span aria-hidden="true">›</span></span>)}
          </nav>
        )}
        <h1 className="text-2xl font-extrabold">{title}</h1>
        {intro && <p className="mt-1 max-w-[70ch] text-sm text-muted">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: React.ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-line text-left text-xs uppercase tracking-wider text-muted">{head.map((h) => <th key={h} className="px-3 py-2.5 font-semibold">{h}</th>)}</tr></thead>
        <tbody className="[&>tr]:border-b [&>tr]:border-line [&>tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-2.5 [&_td]:align-top">{children}</tbody>
      </table>
      {!hasRows && <p className="p-6 text-center text-muted">{empty ?? "Sem resultados."}</p>}
    </div>
  );
}

export const STATUS_LABEL: Record<string, [string, string]> = {
  published: ["Publicado", "bg-ok-wash text-ok"], pending: ["Por aprovar", "bg-warn-wash text-warn"], rejected: ["Rejeitado", "bg-danger-wash text-danger"],
  expired: ["Expirado", "bg-surface-2 text-muted"], sold: ["Vendido", "bg-wash text-accent"], draft: ["Rascunho", "bg-surface-2 text-muted"],
};

export function StatusChip({ status }: { status: string }) {
  const [label, cls] = STATUS_LABEL[status] ?? [status, "bg-surface-2 text-muted"];
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${cls}`}>{label}</span>;
}

export function Pager({ page, pages, href }: { page: number; pages: number; href: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav className="mt-4 flex items-center justify-center gap-2 text-sm" aria-label="Páginas">
      {page > 1 && <Link href={href(page - 1)} className="btn-ghost px-3 py-1.5">Anterior</Link>}
      <span className="text-muted tabular-nums">Página {page} de {pages}</span>
      {page < pages && <Link href={href(page + 1)} className="btn-ghost px-3 py-1.5">Seguinte</Link>}
    </nav>
  );
}

/** Botão de ação simples (formulário com server action), funciona sem JavaScript. */
export function ActionButton({ action, fields, label, tone = "ghost", confirm }: { action: (fd: FormData) => Promise<void>; fields: Record<string, string | number>; label: string; tone?: "ghost" | "primary" | "danger"; confirm?: string }) {
  const cls = tone === "primary" ? "btn-primary" : tone === "danger" ? "btn bg-danger text-white" : "btn-ghost";
  const hidden = Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  if (confirm) {
    return (
      <details className="relative">
        <summary className={`${cls} cursor-pointer list-none px-3 py-1.5 text-sm`}>{label}</summary>
        <form action={action} className="absolute right-0 z-10 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-3 text-sm shadow-lg">
          {hidden}
          <label className="flex items-start gap-2"><input type="checkbox" name="confirm" required className="mt-1 accent-accent" /> {confirm}</label>
          <button className={`${cls} px-3 py-1.5 text-sm`}>Confirmar</button>
        </form>
      </details>
    );
  }
  return <form action={action}>{hidden}<button className={`${cls} px-3 py-1.5 text-sm`}>{label}</button></form>;
}
