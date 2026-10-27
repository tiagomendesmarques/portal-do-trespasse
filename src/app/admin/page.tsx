import Link from "next/link";
import { AdminHeader, Table } from "@/components/admin/ui";
import { dashboardStats, recentPending, recentUsers } from "@/lib/admin/queries";
import { formatNumber, relativeTime } from "@/lib/format";

export default async function AdminDashboard() {
  const [s, pending, users] = await Promise.all([dashboardStats(), recentPending(), recentUsers()]);
  const tiles: [string, number, string, boolean][] = [
    ["Por aprovar", s.pending, "/admin/anuncios/?estado=pending", s.pending > 0],
    ["Denúncias abertas", s.reports, "/admin/denuncias/", s.reports > 0],
    ["Publicados", s.published, "/admin/anuncios/?estado=published", false],
    ["Expiram em 7 dias", s.expiring, "/admin/anuncios/?estado=published&expira=7", false],
    ["Registos (30 dias)", s.newUsers, "/admin/utilizadores/", false],
    ["Contactos a anunciantes (30 dias)", s.contacts, "/admin/mensagens/?tipo=listing_contact", false],
    ["Mensagens do site (30 dias)", s.siteMessages, "/admin/mensagens/?tipo=site_contact", false],
    ["Emails falhados (7 dias)", s.failedEmails, "/admin/emails/?estado=failed", s.failedEmails > 0],
  ];
  return (
    <>
      <AdminHeader title="Painel" intro={`${formatNumber(s.totalViews)} visualizações nos anúncios publicados.`} />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([label, n, href, alert]) => (
          <Link key={label} href={href} className={`panel flex flex-col gap-1 p-4 text-ink no-underline hover:border-accent ${alert ? "border-warn bg-warn-wash" : ""}`}>
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</dt>
            <dd className="font-display text-3xl font-extrabold tabular-nums">{formatNumber(n)}</dd>
          </Link>
        ))}
      </dl>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <section>
          <h2 className="mb-2 text-lg font-bold">Por aprovar (mais antigos primeiro)</h2>
          <Table head={["Anúncio", "Anunciante", "Enviado"]} empty="Nada para aprovar.">
            {pending.map((p) => (
              <tr key={p.id}>
                <td><Link href={`/admin/anuncios/${p.id}/`} className="font-semibold text-accent">{p.title}</Link>{p.publishedAt && <span className="ml-1.5 text-xs text-muted">(edição)</span>}</td>
                <td>{p.user}</td>
                <td className="whitespace-nowrap text-muted">{relativeTime(p.updatedAt)}</td>
              </tr>
            ))}
          </Table>
        </section>
        <section>
          <h2 className="mb-2 text-lg font-bold">Registos recentes</h2>
          <Table head={["Utilizador", "Email", "Registo"]}>
            {users.map((u) => (
              <tr key={u.id}>
                <td><Link href={`/admin/utilizadores/${u.id}/`} className="text-accent">{u.displayName}</Link>{!u.verified && <span className="ml-1.5 text-xs text-warn">por confirmar</span>}</td>
                <td className="text-muted">{u.email}</td>
                <td className="whitespace-nowrap text-muted">{relativeTime(u.createdAt)}</td>
              </tr>
            ))}
          </Table>
        </section>
      </div>
    </>
  );
}
