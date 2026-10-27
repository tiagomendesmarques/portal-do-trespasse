import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader, Pager, Table } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Blog" };
const PAGE = 30;

export default async function AdminBlog({ searchParams }: { searchParams: Promise<{ q?: string; pagina?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.pagina) || 1);
  const P = schema.posts;
  const where = sp.q?.trim() ? sql`lower(${P.title}) like ${`%${sp.q.trim().toLowerCase()}%`}` : undefined;
  const [[{ n }], rows] = await Promise.all([
    getDb().select({ n: sql<number>`count(*)::int` }).from(P).where(where),
    getDb().select().from(P).where(where).orderBy(desc(sql`coalesce(${P.publishedAt}, ${P.createdAt})`)).limit(PAGE).offset((page - 1) * PAGE),
  ]);
  return (
    <>
      <AdminHeader title="Blog" intro={`${n} artigos.`} actions={<Link href="/admin/blog/novo/" className="btn-primary">Novo artigo</Link>} />
      <form className="mb-4 flex gap-2" action="/admin/blog/"><input name="q" defaultValue={sp.q} placeholder="Pesquisar no título" className="input max-w-sm" aria-label="Pesquisar" /><button className="btn-ghost">Pesquisar</button></form>
      <Table head={["Artigo", "Estado", "Publicado"]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/blog/${p.id}/`} className="font-semibold text-accent">{p.title}</Link><div className="font-mono text-xs text-muted">/{p.slug}/</div></td>
            <td>{p.status === "published" ? "Publicado" : "Rascunho"}</td>
            <td className="whitespace-nowrap text-muted">{formatDate(p.publishedAt) || "—"}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={Math.max(1, Math.ceil(n / PAGE))} href={(p) => `/admin/blog/?${new URLSearchParams({ ...(sp.q ? { q: sp.q } : {}), pagina: String(p) })}`} />
    </>
  );
}
