import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { AdminForm, Check } from "@/components/admin/admin-form";
import { AdminHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/guard";
import { saveEmailTemplateAction } from "@/lib/admin/content-actions";
import { sampleVars } from "@/lib/admin/email-samples";
import { renderEmail } from "@/lib/email/render";

export const metadata = { title: "Modelo de email" };

export default async function EditEmail({ params }: { params: Promise<{ key: string }> }) {
  await requireAdmin();
  const { key } = await params;
  const t = await getDb().query.emailTemplates.findFirst({ where: eq(schema.emailTemplates.key, key) });
  if (!t) notFound();
  const preview = renderEmail(t, sampleVars());
  const vars = [...new Set([...`${t.subject}${t.heading}${t.body}`.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))];
  return (
    <>
      <AdminHeader crumbs={[{ href: "/admin/emails/", label: "Emails" }]} title={t.description} />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <AdminForm action={saveEmailTemplateAction} submit="Guardar" extraButtons={[{ op: "test", label: "Guardar e enviar teste para mim" }, { op: "restore", label: "Repor texto original" }]}>
          <input type="hidden" name="key" value={t.key} />
          <div className="panel flex flex-col gap-4">
            <label className="field">Assunto<input name="subject" defaultValue={t.subject} className="input" /></label>
            <label className="field">Título<input name="heading" defaultValue={t.heading} className="input" /></label>
            <label className="field">Texto
              <span className="hint">Linhas em branco separam parágrafos. Uma linha <code>[Texto do botão](&#123;variavel&#125;)</code> vira botão. Variáveis neste modelo: {vars.map((v) => <code key={v} className="mr-1">{`{${v}}`}</code>)}</span>
              <textarea name="body" rows={14} defaultValue={t.body} className="input font-mono text-sm" />
            </label>
            <Check name="enabled" label="Ativo (desligado = este email não é enviado)" defaultChecked={t.enabled} />
          </div>
        </AdminForm>
        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-bold">Pré-visualização <span className="text-sm font-normal text-muted">(com dados de exemplo; guarde para atualizar)</span></h2>
          <p className="text-sm"><b>Assunto:</b> {preview.subject}</p>
          <iframe title="Pré-visualização do email" sandbox="" srcDoc={preview.html} className="h-[640px] w-full rounded-xl border border-line bg-white" />
        </section>
      </div>
    </>
  );
}
