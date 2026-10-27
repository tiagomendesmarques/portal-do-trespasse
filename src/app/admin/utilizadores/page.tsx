import Link from "next/link";
import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { AdminHeader, Pager, Table } from "@/components/admin/ui";
import { formatDate, relativeTime } from "@/lib/format";

export const metadata = { title: "Utilizadores" };
const U = schema.users;
const PAGE = 30;
const ROLE: Record<string, string> = { user: "Anunciante", editor: "Editor", admin: "Administrador" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; perfil?: string; estado?: string; pagina?: string; apagado?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const where: SQL[] = [];
  if (sp.q?.trim()) {
    const q = `%${sp.q.trim().toLowerCase()}%`;
    where.push(sql`(lower(${U.displayName}) like ${q} or lower(${U.email}) like ${q} or lower(${U.username}) like ${q} or ${U.phone} like ${q})`);
  }
  if (sp.perfil) where.push(sql`${U.role} = ${sp.perfil}`);
  if (sp.estado === "bloqueado") where.push(eq(U.status, "blocked"));
  if (sp.estado === "por-confirmar") where.push(sql`${U.emailVerifiedAt} is null`);
  const cond = where.length ? and(...where) : undefined;
  const db = getDb();
  const [[{ n }], rows] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(U).where(cond),
    db.select({
      id: U.id, displayName: U.displayName, username: U.username, email: U.email, role: U.role, status: U.status, wpId: U.wpId,
      createdAt: U.createdAt, lastLoginAt: U.lastLoginAt, verified: sql<boolean>`${U.emailVerifiedAt} is not null`,
      listings: sql<number>`(select count(*)::int from listings l where l.user_id = ${U.id})`,
    }).from(U).where(cond).orderBy(desc(U.createdAt)).limit(PAGE).offset((page - 1) * PAGE),
  ]);
  const href = (p: number) => `/admin/utilizadores/?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), ...(sp.perfil ? { perfil: sp.perfil } : {}), ...(sp.estado ? { estado: sp.estado } : {}), pagina: String(p) })}`;
  return (
    <>
      <AdminHeader title="Utilizadores" intro={`${n} contas. As contas vindas do WordPress mantêm a password; é convertida no primeiro login.`} />
      {sp.apagado && <div className="mb-4"><Alert tone="ok">Conta apagada.</Alert></div>}
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/utilizadores/">
        <input name="q" defaultValue={sp.q} placeholder="Nome, email, utilizador ou telefone" className="input max-w-sm" aria-label="Pesquisar" />
        <select name="perfil" defaultValue={sp.perfil ?? ""} className="input w-auto" aria-label="Perfil">
          <option value="">Todos os perfis</option><option value="user">Anunciantes</option><option value="editor">Editores</option><option value="admin">Administradores</option>
        </select>
        <select name="estado" defaultValue={sp.estado ?? ""} className="input w-auto" aria-label="Estado">
          <option value="">Todos</option><option value="por-confirmar">Email por confirmar</option><option value="bloqueado">Bloqueados</option>
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      <Table head={["Nome", "Email", "Perfil", "Anúncios", "Registo", "Último login"]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td>
              <Link href={`/admin/utilizadores/${u.id}/`} className="font-semibold text-accent">{u.displayName}</Link>
              <div className="text-xs text-muted">{u.username}{u.wpId && " · WordPress"}{u.status === "blocked" && <b className="text-danger"> · bloqueado</b>}{!u.verified && <span className="text-warn"> · por confirmar</span>}</div>
            </td>
            <td className="text-muted">{u.email}</td>
            <td>{ROLE[u.role]}</td>
            <td className="tabular-nums">{u.listings}</td>
            <td className="whitespace-nowrap text-muted">{formatDate(u.createdAt)}</td>
            <td className="whitespace-nowrap text-muted">{u.lastLoginAt ? relativeTime(u.lastLoginAt) : "—"}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(n / PAGE))} href={href} />
    </>
  );
}
