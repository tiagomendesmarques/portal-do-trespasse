import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { AUDIT_LABEL } from "@/lib/admin/queries";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Auditoria" };
const LINK: Record<string, (id: string) => string> = { listing: (id) => `/admin/anuncios/${id}/`, user: (id) => `/admin/utilizadores/${id}/`, post: (id) => `/admin/blog/${id}/`, page: (id) => `/admin/paginas/${id}/`, field: (id) => `/admin/campos/${id}/`, email_template: (id) => `/admin/emails/${id}/` };

export default async function AdminAudit({ searchParams }: { searchParams: Promise<{ tipo?: string }> }) {
  await requireAdmin();
  const tipo = (await searchParams).tipo;
  const A = schema.auditLog;
  const rows = await getDb()
    .select({ id: A.id, action: A.action, entity: A.entity, entityId: A.entityId, createdAt: A.createdAt, actor: schema.users.displayName })
    .from(A).leftJoin(schema.users, eq(schema.users.id, A.actorId))
    .where(tipo ? eq(A.entity, tipo) : undefined).orderBy(desc(A.id)).limit(300);
  const tabs: [string, string][] = [["", "Tudo"], ["listing", "Anúncios"], ["user", "Utilizadores"], ["report", "Denúncias"], ["settings", "Definições"], ["system", "Sistema"]];
  return (
    <>
      <AdminHeader title="Auditoria" intro="Quem fez o quê e quando (últimas 300 ações)." />
      <div className="mb-4 flex flex-wrap gap-1.5">
        {tabs.map(([k, l]) => <Link key={k || "all"} href={k ? `/admin/auditoria/?tipo=${k}` : "/admin/auditoria/"} className={`rounded-full border px-3 py-1.5 text-sm no-underline ${(tipo ?? "") === k ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}>{l}</Link>)}
      </div>
      <Table head={["Quando", "Quem", "Ação", "Sobre"]} empty="Sem registos.">
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="whitespace-nowrap text-muted">{relativeTime(r.createdAt)}</td>
            <td>{r.actor ?? "sistema"}</td>
            <td>{AUDIT_LABEL[r.action] ?? r.action}</td>
            <td>{r.entityId && LINK[r.entity] ? <Link href={LINK[r.entity](r.entityId)} className="text-accent">{r.entity} {r.entityId}</Link> : `${r.entity} ${r.entityId ?? ""}`}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
