import { desc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminForm } from "@/components/admin/admin-form";
import { ActionButton, AdminHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { deleteRedirectAction, saveRedirectAction } from "@/lib/admin/content-actions";

export const metadata = { title: "Redirects" };

export default async function AdminRedirects() {
  await requireAdmin();
  const rows = await getDb().select().from(schema.redirects).orderBy(desc(schema.redirects.hits), desc(schema.redirects.id));
  return (
    <>
      <AdminHeader title="Redirects" intro="Endereços antigos que passam para outro sítio. Use 301 (permanente) para o Google transferir a posição para o novo endereço." />
      <div className="panel mb-5">
        <AdminForm action={saveRedirectAction} submit="Adicionar redirect" labels={{ fromPath: "De", toPath: "Para" }}>
          <div className="grid gap-3 md:grid-cols-[2fr_2fr_120px]">
            <label className="field">De (endereço antigo)<input name="fromPath" placeholder="/endereco-antigo/" className="input font-mono text-sm" /></label>
            <label className="field">Para<input name="toPath" placeholder="/endereco-novo/" className="input font-mono text-sm" /></label>
            <label className="field">Tipo<select name="statusCode" className="input"><option value="301">301 permanente</option><option value="302">302 temporário</option></select></label>
            <label className="field md:col-span-3">Nota<input name="note" className="input" placeholder="Opcional" /></label>
          </div>
        </AdminForm>
      </div>
      <Table head={["De", "Para", "Tipo", "Acessos", "Nota", ""]}>
        {rows.map((r) => (
          <tr key={r.id}>
            <td className="font-mono text-xs">{r.fromPath}</td>
            <td className="font-mono text-xs">{r.toPath}</td>
            <td>{r.statusCode}</td>
            <td className="tabular-nums">{r.hits}</td>
            <td className="text-muted">{r.note}</td>
            <td><ActionButton action={deleteRedirectAction} fields={{ id: r.id }} label="Apagar" confirm="Apagar este redirect." /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
