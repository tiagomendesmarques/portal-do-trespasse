import { AdminForm, Check } from "@/components/admin/admin-form";
import type { schema } from "@/db";
import { saveFieldAction } from "@/lib/admin/content-actions";
import { FIELD_SECTIONS } from "@/lib/listings/sections";

type Field = typeof schema.customFields.$inferSelect;
type Ctx = { categories: { id: number; name: string }[]; types: { key: string; name: string }[]; choiceFields: { id: number; label: string; options: { value: string; label: string }[] }[] };

export function FieldForm({ f, ctx }: { f?: Field; ctx: Ctx }) {
  return (
    <AdminForm action={saveFieldAction} submit={f ? "Guardar campo" : "Criar campo"} labels={{ label: "Rótulo", options: "Opções", key: "Chave", type: "Tipo" }}>
      {f && <input type="hidden" name="id" value={f.id} />}
      <div className="panel grid gap-4 md:grid-cols-2">
        <label className="field">Rótulo<input name="label" defaultValue={f?.label} className="input" /></label>
        {f ? (
          <><input type="hidden" name="type" value={f.type} /><p className="text-sm">Tipo: <b>{f.type}</b> · chave <code>{f.key}</code> (não podem mudar depois de criado)</p></>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="field">Tipo
              <select name="type" className="input" defaultValue="radio">
                <option value="radio">Escolha única</option><option value="checkbox">Escolha múltipla</option><option value="select">Lista</option><option value="number">Número</option><option value="text">Texto curto</option>
              </select>
            </label>
            <label className="field">Chave<input name="key" className="input font-mono text-sm" placeholder="gerada do rótulo" /></label>
          </div>
        )}
        <label className="field md:col-span-2">Texto de ajuda<input name="help" defaultValue={f?.help ?? ""} className="input" /></label>
        <label className="field">Exemplo (placeholder)<input name="placeholder" defaultValue={f?.placeholder ?? ""} className="input" /></label>
        <label className="field">Secção
          <select name="section" defaultValue={f?.section ?? "funcionamento"} className="input">{FIELD_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}</select>
        </label>
        <label className="field md:col-span-2">Opções (escolhas)
          <span className="hint">Uma por linha, no formato <code>valor|Rótulo</code> (ex.: <code>sim|Sim</code>). Para mudar o texto de uma opção já usada, mantenha o valor e mude só o rótulo.</span>
          <textarea name="options" rows={5} defaultValue={f?.options.map((o) => `${o.value}|${o.label}`).join("\n")} className="input font-mono text-sm" />
        </label>
        <div className="grid grid-cols-3 gap-3 md:col-span-2">
          <label className="field">Mínimo<input name="min" type="number" defaultValue={f?.min ?? ""} className="input" /></label>
          <label className="field">Máximo<input name="max" type="number" defaultValue={f?.max ?? ""} className="input" /></label>
          <label className="field">Ordem<input name="sort" type="number" defaultValue={f?.sort ?? 200} className="input" /></label>
        </div>
        <div className="flex flex-col gap-2 md:col-span-2">
          <Check name="required" label="Obrigatório" defaultChecked={f?.required} hint="Recomendado: deixar facultativo. Campos obrigatórios a mais afastam anunciantes." />
          <Check name="searchable" label="Filtro na pesquisa" defaultChecked={f?.searchable} />
          <Check name="listable" label="Mostrar na “Visão geral” do anúncio" defaultChecked={f?.listable ?? true} />
          <Check name="money" label="É um valor em euros (números)" defaultChecked={f?.icon === "money"} />
          <Check name="active" label="Ativo" defaultChecked={f?.active ?? true} />
        </div>
      </div>
      <details className="panel">
        <summary className="cursor-pointer font-semibold">Quando aparece (condição, categorias e tipos)</summary>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="field">Só aparece quando o campo…
            <select name="conditionField" defaultValue={f?.condition?.fieldId ?? ""} className="input">
              <option value="">Sempre</option>
              {ctx.choiceFields.filter((c) => c.id !== f?.id).map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </label>
          <label className="field">…tem o valor<input name="conditionValue" defaultValue={f?.condition?.value ?? ""} className="input font-mono text-sm" placeholder="ex.: sim" /></label>
          <fieldset className="text-sm"><legend className="mb-1 font-semibold">Só nestas categorias (nenhuma = todas)</legend>
            <div className="grid grid-cols-2 gap-1">{ctx.categories.map((c) => <label key={c.id} className="flex gap-1.5"><input type="checkbox" name="categoryIds" value={c.id} defaultChecked={f?.categoryIds?.includes(c.id)} className="accent-accent" />{c.name}</label>)}</div>
          </fieldset>
          <fieldset className="text-sm"><legend className="mb-1 font-semibold">Só nestes tipos (nenhum = todos)</legend>
            {ctx.types.map((t) => <label key={t.key} className="flex gap-1.5"><input type="checkbox" name="listingTypes" value={t.key} defaultChecked={f?.listingTypes?.includes(t.key)} className="accent-accent" />{t.name}</label>)}
          </fieldset>
        </div>
      </details>
    </AdminForm>
  );
}
