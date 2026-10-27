import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminHeader, Table } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { FIELD_SECTIONS } from "@/lib/listings/sections";

export const metadata = { title: "Campos do anúncio" };
const TYPE: Record<string, string> = { number: "Número", text: "Texto", textarea: "Texto longo", radio: "Escolha única", checkbox: "Escolha múltipla", select: "Lista" };

export default async function AdminFields() {
  await requireAdmin();
  const F = schema.customFields;
  const fields = await getDb().select({ f: F, used: sql<number>`(select count(*)::int from listing_field_values v where v.field_id = ${F.id})` }).from(F).orderBy(asc(F.sort));
  return (
    <>
      <AdminHeader title="Campos do anúncio" intro="Campos da secção “Visão geral”. Aparecem no formulário de publicação pela ordem e secção definidas aqui." actions={<Link href="/admin/campos/novo/" className="btn-primary">Novo campo</Link>} />
      {FIELD_SECTIONS.map((s) => {
        const list = fields.filter(({ f }) => (f.section ?? "funcionamento") === s.key);
        return (
          <section key={s.key} className="mb-5">
            <h2 className="mb-2 text-lg font-bold">{s.title}</h2>
            <Table head={["Campo", "Tipo", "Regras", "Anúncios com valor"]}>
              {list.map(({ f, used }) => (
                <tr key={f.id}>
                  <td><Link href={`/admin/campos/${f.id}/`} className="font-semibold text-accent">{f.label}</Link><div className="font-mono text-xs text-muted">{f.key}{f.wpId ? " · WordPress" : " · novo"}</div></td>
                  <td>{TYPE[f.type]}</td>
                  <td className="text-xs">{[f.required && "obrigatório", f.searchable && "filtro na pesquisa", f.condition && "condicional", !f.active && "desativado", f.categoryIds?.length && "só algumas categorias"].filter(Boolean).join(" · ") || "facultativo"}</td>
                  <td className="tabular-nums">{used}</td>
                </tr>
              ))}
            </Table>
          </section>
        );
      })}
    </>
  );
}
