import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { getTaxonomies } from "@/lib/listings/queries";
import { FieldForm } from "../field-form";

export const metadata = { title: "Campo" };

export default async function AdminField({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ criado?: string }> }) {
  await requireAdmin();
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const f = await getDb().query.customFields.findFirst({ where: eq(schema.customFields.id, Number(id)) });
  if (!f) notFound();
  const tax = await getTaxonomies();
  const ctx = { categories: tax.categories, types: tax.types, choiceFields: (await getDb().select().from(schema.customFields)).filter((x) => ["radio", "select", "checkbox"].includes(x.type)) };
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/campos/", label: "Campos do anúncio" }]} title={f.label} />
      {sp.criado && <div className="mb-4"><Alert tone="ok">Campo criado. Já aparece no formulário de publicação.</Alert></div>}
      <FieldForm f={f} ctx={ctx} />
    </>
  );
}
