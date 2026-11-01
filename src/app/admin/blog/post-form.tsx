import { AdminForm, Check } from "@/components/admin/admin-form";
import { FaqEditor } from "@/components/admin/faq-editor";
import { HtmlEditor } from "@/components/admin/html-editor";
import { ImagePicker } from "@/components/admin/image-picker";
import { SeoPanel } from "@/components/admin/seo-panel";
import type { schema } from "@/db";
import { savePostAction } from "@/lib/admin/content-actions";
import { unsplashSized } from "@/lib/blog/images";
import type { SeoReport } from "@/lib/blog/seo";

export function PostForm({ p, seo }: { p?: typeof schema.posts.$inferSelect; seo?: SeoReport }) {
  return (
    <AdminForm action={savePostAction} submit="Guardar" labels={{ title: "Título", slug: "Endereço", contentHtml: "Texto", featuredImageAlt: "Texto alternativo da imagem", faq: "Perguntas frequentes", sources: "Fontes" }}>
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="panel flex flex-col gap-4">
            <label className="field">Título<input name="title" defaultValue={p?.title} className="input text-lg" /></label>
            <label className="field">Resumo<span className="hint">Aparece na lista do blog. Vazio = início do texto.</span><textarea name="excerpt" rows={2} defaultValue={p?.excerpt ?? ""} className="input" /></label>
          </div>
          <div className="panel"><HtmlEditor name="contentHtml" defaultValue={p?.contentHtml ?? "<p></p>"} rows={24} /></div>
          <div className="panel flex flex-col gap-3">
            <h2 className="font-sans text-base font-bold">Perguntas frequentes</h2>
            <FaqEditor name="faq" defaultValue={p?.faq ?? []} />
          </div>
          <div className="panel flex flex-col gap-3">
            <label className="field">Fontes<span className="hint">Uma por linha: Título | https://endereço. Aparecem no fim do artigo.</span>
              <textarea name="sources" rows={3} defaultValue={(p?.sources ?? []).map((f) => `${f.title} | ${f.url}`).join("\n")} className="input font-mono text-sm" />
            </label>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          {seo && <SeoPanel report={seo} />}
          <div className="panel flex flex-col gap-3">
            <label className="field">Estado<select name="status" defaultValue={p?.status ?? "draft"} className="input"><option value="draft">Rascunho</option><option value="published">Publicado</option></select></label>
            <label className="field">Endereço<span className="hint">Mudar o endereço de um artigo publicado cria um redirect.</span><input name="slug" defaultValue={p?.slug} placeholder="gerado do título" className="input font-mono text-sm" /></label>
            <label className="field">Etiquetas<span className="hint">Separadas por vírgulas.</span><input name="tags" defaultValue={p?.tags.join(", ")} className="input" /></label>
          </div>
          <div className="panel flex flex-col gap-3">
            <label className="field">Palavra-chave principal<span className="hint">O que as pessoas escrevem no Google. Ex.: trespasse de café em Lisboa.</span><input name="focusKeyword" defaultValue={p?.focusKeyword ?? ""} className="input" /></label>
            <label className="field">Palavras-chave secundárias<span className="hint">Separadas por vírgulas.</span><input name="secondaryKeywords" defaultValue={p?.secondaryKeywords.join(", ")} className="input" /></label>
            <label className="field">Título para o Google<span className="hint">Até 60 caracteres. Vazio = título do artigo.</span><input name="seoTitle" defaultValue={p?.seoTitle ?? ""} maxLength={70} className="input" /></label>
            <label className="field">Descrição para o Google<span className="hint">70 a 155 caracteres.</span><textarea name="seoDescription" rows={3} maxLength={170} defaultValue={p?.seoDescription ?? ""} className="input" /></label>
          </div>
          <div className="panel flex flex-col gap-3">
            <span className="text-sm font-semibold">Imagem de destaque</span>
            {p?.featuredImageUrl ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={unsplashSized(p.featuredImageUrl, 400)} alt="" className="aspect-[16/9] w-full rounded-md object-cover" />
                <p className="text-xs text-muted">Imagem do Unsplash (fica nos servidores deles).</p>
                <Check name="removeExternalImage" label="Tirar esta imagem" />
                <input type="hidden" name="featuredImageKey" value="" />
              </>
            ) : (
              <ImagePicker name="featuredImageKey" defaultKey={p?.featuredImageKey ?? null} />
            )}
            <label className="field">Texto alternativo (alt)<span className="hint">Descreve a imagem para quem não a vê e para o Google. Obrigatório com imagem.</span><input name="featuredImageAlt" defaultValue={p?.featuredImageAlt ?? ""} maxLength={200} className="input" /></label>
            <label className="field">Legenda<input name="featuredImageCaption" defaultValue={p?.featuredImageCaption ?? ""} maxLength={300} className="input" /></label>
            <label className="field">Crédito<span className="hint">Ex.: Foto: Ana Silva / Pexels</span><input name="featuredImageCredit" defaultValue={p?.featuredImageCredit ?? ""} maxLength={150} className="input" /></label>
            <label className="field">Link do crédito<input name="featuredImageCreditUrl" type="url" defaultValue={p?.featuredImageCreditUrl ?? ""} className="input" /></label>
          </div>
        </div>
      </div>
    </AdminForm>
  );
}
