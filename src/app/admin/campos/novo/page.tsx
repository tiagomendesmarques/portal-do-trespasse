import { getDb, schema } from "@/db";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { getTaxonomies } from "@/lib/listings/queries";
import { FieldForm } from "../field-form";

export const metadata = { title: "Novo campo" };

export default async function NewField() {
  await requireAdmin();
  const tax = await getTaxonomies();
  const ctx = { categories: tax.categories, types: tax.types, choiceFields: (await getDb().select().from(schema.customFields)).filter((x) => ["radio", "select", "checkbox"].includes(x.type)) };
  return (<><AdminHeader crumbs={[{ href: "/admin/campos/", label: "Campos do anúncio" }]} title="Novo campo" /><FieldForm ctx={ctx} /></>);
}
