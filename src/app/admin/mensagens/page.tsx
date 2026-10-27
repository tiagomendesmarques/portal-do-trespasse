import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader } from "@/components/admin/ui";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Mensagens" };

export default async function AdminMessages({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  const kind = (await searchParams).tipo === "listing_contact" ? "listing_contact" : "site_contact";
  const M = schema.messages;
  const rows = await getDb()
    .select({ id: M.id, name: M.name, email: M.email, phone: M.phone, body: M.body, createdAt: M.createdAt, listingId: M.listingId, title: schema.listings.title, to: schema.users.displayName })
    .from(M)
    .leftJoin(schema.listings, eq(schema.listings.id, M.listingId))
    .leftJoin(schema.users, eq(schema.users.id, M.toUserId))
    .where(eq(M.kind, kind))
    .orderBy(desc(M.createdAt))
    .limit(200);
  const tab = (k: string, label: string) => (
    <Link href={`/admin/mensagens/?tipo=${k}`} className={`rounded-full border px-3 py-1.5 text-sm no-underline ${kind === k ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}>{label}</Link>
  );
  return (
    <>
      <AdminHeader title="Mensagens" intro={kind === "site_contact" ? "Mensagens do formulário de Contactos. Responda pelo email do remetente." : "Contactos de interessados a anunciantes (só para consulta, por exemplo para detetar abusos)."} />
      <div className="mb-4 flex gap-1.5">{tab("site_contact", "Formulário de contactos")}{tab("listing_contact", "Contactos a anunciantes")}</div>
      <div className="flex flex-col gap-3">
        {rows.length === 0 && <p className="panel text-center text-muted">Sem mensagens.</p>}
        {rows.map((m) => (
          <article key={m.id} className="panel flex flex-col gap-1.5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-sans text-base font-bold">{m.name} <span className="font-normal text-muted">· {m.email}{m.phone && ` · ${m.phone}`}</span></h2>
              <span className="text-xs text-muted">{relativeTime(m.createdAt)}</span>
            </div>
            {m.listingId && <p className="text-sm">Para {m.to} sobre <Link href={`/admin/anuncios/${m.listingId}/`} className="text-accent">{m.title}</Link></p>}
            <p className="whitespace-pre-line text-sm">{m.body}</p>
          </article>
        ))}
      </div>
    </>
  );
}
