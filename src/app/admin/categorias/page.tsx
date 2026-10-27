import { asc } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminForm, Check } from "@/components/admin/admin-form";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { saveCategoryAction } from "@/lib/admin/content-actions";
import { getCounts } from "@/lib/listings/queries";

export const metadata = { title: "Categorias" };

export default async function AdminCategories() {
  await requireAdmin();
  const [cats, counts] = await Promise.all([getDb().select().from(schema.categories).orderBy(asc(schema.categories.sort)), getCounts()]);
  const fields = (c?: (typeof cats)[number]) => (
    <div className="grid gap-3 md:grid-cols-[2fr_2fr_1fr_80px]">
      <label className="field">Nome<input name="name" defaultValue={c?.name} className="input" /></label>
      <label className="field">Endereço<input name="slug" defaultValue={c?.slug} className="input font-mono text-sm" placeholder="gerado a partir do nome" /></label>
      <label className="field">Ícone<input name="icon" defaultValue={c?.icon ?? ""} className="input" /></label>
      <label className="field">Ordem<input name="sort" type="number" defaultValue={c?.sort ?? cats.length} className="input" /></label>
      <div className="md:col-span-4"><Check name="active" label="Visível no site" defaultChecked={c?.active ?? true} /></div>
    </div>
  );
  return (
    <>
      <AdminHeader title="Categorias" intro="Mudar o endereço de uma categoria cria automaticamente um redirect 301 do endereço antigo." />
      <div className="flex flex-col gap-3">
        {cats.map((c) => (
          <details key={c.id} className="panel">
            <summary className="flex cursor-pointer items-center justify-between gap-2">
              <span><b>{c.name}</b> <span className="font-mono text-xs text-muted">/listing-category/{c.slug}/</span>{!c.active && <span className="ml-2 text-xs text-warn">escondida</span>}</span>
              <span className="text-sm text-muted tabular-nums">{counts.category.get(c.id) ?? 0} anúncios</span>
            </summary>
            <AdminForm action={saveCategoryAction} className="mt-4"><input type="hidden" name="id" value={c.id} />{fields(c)}</AdminForm>
          </details>
        ))}
        <details className="panel border-dashed">
          <summary className="cursor-pointer font-semibold text-accent">+ Nova categoria</summary>
          <AdminForm action={saveCategoryAction} submit="Criar categoria" className="mt-4">{fields()}</AdminForm>
        </details>
      </div>
    </>
  );
}
