import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminForm } from "@/components/admin/admin-form";
import { HtmlEditor } from "@/components/admin/html-editor";
import { AdminHeader } from "@/components/admin/ui";
import { savePageAction } from "@/lib/admin/content-actions";

export const metadata = { title: "Editar página" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const p = await getDb().query.pages.findFirst({ where: eq(schema.pages.id, Number((await params).id)) });
  if (!p) notFound();
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/paginas/", label: "Páginas" }]} title={p.title} actions={<a href={`/${p.slug}/`} target="_blank" rel="noreferrer" className="btn-ghost">Ver página</a>} />
      <AdminForm action={savePageAction} submit="Guardar página" labels={{ title: "Título" }}>
        <input type="hidden" name="id" value={p.id} />
        <div className="panel grid gap-4 md:grid-cols-2">
          <label className="field">Título<input name="title" defaultValue={p.title} className="input" /></label>
          <label className="field">Estado<select name="status" defaultValue={p.status} className="input"><option value="published">Publicada</option><option value="draft">Rascunho (não aparece)</option></select></label>
          <label className="field">Título para o Google<input name="seoTitle" defaultValue={p.seoTitle ?? ""} className="input" placeholder={p.title} /></label>
          <label className="field">Descrição para o Google<input name="seoDescription" defaultValue={p.seoDescription ?? ""} maxLength={160} className="input" /></label>
        </div>
        <div className="panel"><HtmlEditor name="contentHtml" defaultValue={p.contentHtml} /></div>
      </AdminForm>
    </>
  );
}
