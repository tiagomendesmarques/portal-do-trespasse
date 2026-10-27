import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionButton, AdminHeader, StatusChip, Table } from "@/components/admin/ui";
import { isAdmin, requireStaff } from "@/lib/admin/guard";
import { reportAction } from "@/lib/admin/user-actions";
import { relativeTime } from "@/lib/format";

export const metadata = { title: "Denúncias" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ estado?: string }> }) {
  const me = await requireStaff();
  const status = (await searchParams).estado === "resolvidas" ? "resolved" : "open";
  const R = schema.reports;
  const rows = await getDb()
    .select({ id: R.id, reason: R.reason, createdAt: R.createdAt, resolvedAt: R.resolvedAt, listingId: R.listingId, title: schema.listings.title, slug: schema.listings.slug, listingStatus: schema.listings.status, reporter: schema.users.displayName })
    .from(R)
    .innerJoin(schema.listings, eq(schema.listings.id, R.listingId))
    .leftJoin(schema.users, eq(schema.users.id, R.userId))
    .where(eq(R.status, status))
    .orderBy(desc(R.createdAt))
    .limit(200);
  return (
    <>
      <AdminHeader title="Denúncias" intro="Resolver uma denúncia fecha também as outras abertas sobre o mesmo anúncio." />
      <div className="mb-4 flex gap-1.5">
        <Link href="/admin/denuncias/" className={`rounded-full border px-3 py-1.5 text-sm no-underline ${status === "open" ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}>Por resolver</Link>
        <Link href="/admin/denuncias/?estado=resolvidas" className={`rounded-full border px-3 py-1.5 text-sm no-underline ${status === "resolved" ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}>Resolvidas</Link>
      </div>
      <Table head={["Anúncio", "Motivo", "Quem denunciou", "Quando", ...(status === "open" ? ["Ações"] : [])]} empty="Sem denúncias.">
        {rows.map((r) => (
          <tr key={r.id}>
            <td><Link href={`/admin/anuncios/${r.listingId}/`} className="font-semibold text-accent">{r.title}</Link><div className="mt-1"><StatusChip status={r.listingStatus} /></div></td>
            <td className="max-w-md">{r.reason}</td>
            <td className="text-muted">{r.reporter ?? "visitante"}</td>
            <td className="whitespace-nowrap text-muted">{relativeTime(r.createdAt)}</td>
            {status === "open" && (
              <td>
                <div className="flex flex-wrap gap-1.5">
                  <ActionButton action={reportAction} fields={{ id: r.id, op: "resolve" }} label="Sem problema" />
                  <ActionButton action={reportAction} fields={{ id: r.id, op: "unpublish" }} label="Tirar do ar" tone="primary" />
                  {isAdmin(me) && <ActionButton action={reportAction} fields={{ id: r.id, op: "block_owner" }} label="Bloquear anunciante" tone="danger" confirm="Bloqueia o anunciante e tira todos os anúncios dele do ar." />}
                </div>
              </td>
            )}
          </tr>
        ))}
      </Table>
    </>
  );
}
