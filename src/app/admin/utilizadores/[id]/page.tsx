import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ActionButton, AdminHeader, StatusChip, Table } from "@/components/admin/ui";
import { isAdmin, requireStaff } from "@/lib/admin/guard";
import { AUDIT_LABEL, auditFor } from "@/lib/admin/queries";
import { userAction } from "@/lib/admin/user-actions";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Utilizador" };

export default async function AdminUser({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const id = Number((await params).id);
  const db = getDb();
  const u = await db.query.users.findFirst({ where: eq(schema.users.id, id) });
  if (!u) notFound();
  const [listings, history] = await Promise.all([
    db.select().from(schema.listings).where(eq(schema.listings.userId, id)).orderBy(desc(schema.listings.createdAt)),
    auditFor("user", String(id)),
  ]);
  const admin = isAdmin(me);
  const self = me.id === u.id;
  const act = (op: string, label: string, tone?: "primary" | "danger", confirm?: string, extra: Record<string, string> = {}) => (
    <ActionButton action={userAction} fields={{ id: u.id, op, ...extra }} label={label} tone={tone} confirm={confirm} />
  );
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/utilizadores/", label: "Utilizadores" }]} title={u.displayName}
        intro={`${u.username} · ${u.email}${u.wpId ? ` · conta do WordPress (${u.wpId})` : ""}`} />
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel">
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Estado</dt><dd className="font-semibold">{u.status === "blocked" ? "Bloqueado" : "Ativo"}{!u.emailVerifiedAt && " · email por confirmar"}</dd></div>
              <div><dt className="text-muted">Perfil</dt><dd className="font-semibold">{u.role === "admin" ? "Administrador" : u.role === "editor" ? "Editor" : "Anunciante"}</dd></div>
              <div><dt className="text-muted">Telefone</dt><dd>{u.phone ?? "—"}</dd></div>
              <div><dt className="text-muted">WhatsApp</dt><dd>{u.whatsapp ?? "—"}</dd></div>
              <div><dt className="text-muted">Registo</dt><dd>{formatDate(u.createdAt)}</dd></div>
              <div><dt className="text-muted">Último login</dt><dd>{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "nunca no site novo"}</dd></div>
              <div><dt className="text-muted">Password</dt><dd>{u.passwordHash.startsWith("$wp") || u.passwordHash.startsWith("$P$") ? "Do WordPress (converte no 1.º login)" : "Do site novo"}</dd></div>
            </dl>
          </section>
          <section>
            <h2 className="mb-2 text-lg font-bold">Anúncios ({listings.length})</h2>
            <Table head={["Anúncio", "Estado", "Visitas", "Criado"]} empty="Sem anúncios.">
              {listings.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/admin/anuncios/${l.id}/`} className="text-accent">{l.title}</Link></td>
                  <td><StatusChip status={l.status} /></td>
                  <td className="tabular-nums">{l.views}</td>
                  <td className="text-muted">{formatDate(l.createdAt)}</td>
                </tr>
              ))}
            </Table>
          </section>
        </div>
        <aside className="flex flex-col gap-4">
          <section className="panel flex flex-col gap-2">
            <h2 className="text-lg font-bold">Ações</h2>
            <div className="flex flex-wrap gap-1.5">
              {!u.emailVerifiedAt && act("resend_verification", "Reenviar confirmação")}
              {act("send_reset", "Enviar ligação de nova password")}
              {admin && !u.emailVerifiedAt && act("verify", "Marcar email como confirmado")}
              {admin && !self && u.role !== "admin" && (u.status === "blocked" ? act("unblock", "Desbloquear") : act("block", "Bloquear", "danger", "Bloquear: termina as sessões e tira os anúncios do ar."))}
              {admin && !self && u.role !== "admin" && act("delete", "Apagar conta", "danger", "Apagar de vez a conta e todos os anúncios.")}
            </div>
            {admin && !self && (
              <form action={userAction} className="mt-2 flex items-end gap-2">
                <input type="hidden" name="id" value={u.id} />
                <input type="hidden" name="op" value="role" />
                <label className="field flex-1" htmlFor="role">Perfil
                  <select id="role" name="role" defaultValue={u.role} className="input">
                    <option value="user">Anunciante</option><option value="editor">Editor (moderação e conteúdos)</option><option value="admin">Administrador</option>
                  </select>
                </label>
                <button className="btn-ghost">Guardar</button>
              </form>
            )}
          </section>
          <section className="panel text-sm">
            <h2 className="mb-2 text-lg font-bold">Histórico</h2>
            {history.length === 0 && <p className="text-muted">Sem registos.</p>}
            <ol className="flex flex-col gap-1.5">{history.map((h) => <li key={h.id}><b>{AUDIT_LABEL[h.action] ?? h.action}</b> · {h.actor ?? "sistema"} · <span className="text-muted">{relativeTime(h.createdAt)}</span></li>)}</ol>
          </section>
        </aside>
      </div>
    </>
  );
}
