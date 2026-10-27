import { AdminForm } from "@/components/admin/admin-form";
import { HtmlEditor } from "@/components/admin/html-editor";
import { ImagePicker } from "@/components/admin/image-picker";
import type { schema } from "@/db";
import { savePostAction } from "@/lib/admin/content-actions";

export function PostForm({ p }: { p?: typeof schema.posts.$inferSelect }) {
  return (
    <AdminForm action={savePostAction} submit="Guardar" labels={{ title: "Título", slug: "Endereço", contentHtml: "Texto" }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel flex flex-col gap-4">
            <label className="field">Título<input name="title" defaultValue={p?.title} className="input text-lg" /></label>
            <label className="field">Resumo<span className="hint">Aparece na lista do blog. Vazio = início do texto.</span><textarea name="excerpt" rows={2} defaultValue={p?.excerpt ?? ""} className="input" /></label>
          </div>
          <div className="panel"><HtmlEditor name="contentHtml" defaultValue={p?.contentHtml ?? "<p></p>"} rows={24} /></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="panel flex flex-col gap-3">
            <label className="field">Estado<select name="status" defaultValue={p?.status ?? "draft"} className="input"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label>
            <label className="field">Endereço<span className="hint">Mudar o endereço de um artigo publicado cria um redirect.</span><input name="slug" defaultValue={p?.slug} placeholder="gerado do título" className="input font-mono text-sm" /></label>
            <label className="field">Etiquetas<span className="hint">Separadas por vírgulas.</span><input name="tags" defaultValue={p?.tags.join(", ")} className="input" /></label>
          </div>
          <div className="panel flex flex-col gap-2"><span className="text-sm font-semibold">Imagem de destaque</span><ImagePicker name="featuredImageKey" defaultKey={p?.featuredImageKey ?? null} /></div>
          <div className="panel flex flex-col gap-3">
            <label className="field">Título para o Google<input name="seoTitle" defaultValue={p?.seoTitle ?? ""} className="input" /></label>
            <label className="field">Descrição para o Google<textarea name="seoDescription" rows={3} maxLength={160} defaultValue={p?.seoDescription ?? ""} className="input" /></label>
          </div>
        </div>
      </div>
    </AdminForm>
  );
}
