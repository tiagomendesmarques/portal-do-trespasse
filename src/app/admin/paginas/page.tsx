import Link from "next/link";
import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader, Table } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Páginas" };

export default async function AdminPages() {
  const pages = await getDb().select().from(schema.pages).orderBy(asc(schema.pages.title));
  return (
    <>
      <AdminHeader title="Páginas" intro="Páginas institucionais (FAQ, termos, privacidade…). A página de Contactos tem formulário próprio." />
      <Table head={["Página", "Endereço", "Estado", "Atualizada"]}>
        {pages.map((p) => (
          <tr key={p.id}>
            <td><Link href={`/admin/paginas/${p.id}/`} className="font-semibold text-accent">{p.title}</Link></td>
            <td className="font-mono text-xs"><a href={`/${p.slug}/`} target="_blank" rel="noreferrer">/{p.slug}/</a></td>
            <td>{p.status === "published" ? "Publicada" : "Rascunho"}</td>
            <td className="text-muted">{formatDate(p.updatedAt)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
