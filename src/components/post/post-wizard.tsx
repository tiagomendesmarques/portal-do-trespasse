"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "@/components/auth/form-bits";
import type { FormContext, ListingInitial } from "@/lib/listings/manage";
import { saveListingAction, type PostState } from "@/lib/listings/post-actions";
import { FIELD_SECTIONS } from "@/lib/listings/sections";
import { applicableFields, isFieldVisible } from "@/lib/listings/validation";

type Img = { key: string; url: string };
type Values = Record<string, string | string[]>;
type Props = { ctx: FormContext; initial?: ListingInitial; editId?: number; userPhone: string };

const DRAFT_KEY = "pdt-rascunho-anuncio";
const thumb = (key: string) => `/media/${key}-400.webp`;

export function PostWizard({ ctx, initial, editId, userPhone }: Props) {
  const [state, action, pending] = useActionState<PostState, FormData>(saveListingAction, {});
  const [step, setStep] = useState(initial ? 3 : 1);
  const [typeKey, setTypeKey] = useState(initial?.typeKey ?? "");
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 0);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [priceType, setPriceType] = useState<string>(initial?.priceType ?? "fixed");
  const [price, setPrice] = useState(initial?.price ?? "");
  const [priceUnit, setPriceUnit] = useState(initial?.priceUnit ?? "total");
  const [phone, setPhone] = useState(initial?.phone ?? userPhone);
  const [features, setFeatures] = useState(initial?.features ?? "");
  const [distritoId, setDistritoId] = useState(initial?.distritoId ?? 0);
  const [locationId, setLocationId] = useState(initial?.locationId ?? 0);
  const [values, setValues] = useState<Values>(initial?.fields ?? {});
  const [images, setImages] = useState<Img[]>((initial?.images ?? []).map((key) => ({ key, url: thumb(key) })));
  const [uploading, setUploading] = useState(0);
  const [uploadError, setUploadError] = useState("");
  const [draftFound, setDraftFound] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const e = state.errors ?? {};

  /* Rascunho automático (só para anúncios novos), guardado neste browser. */
  const snapshot = { step, typeKey, categoryId, title, description, priceType, price, priceUnit, phone, features, distritoId, locationId, values, images };
  useEffect(() => {
    if (editId) return;
    try { if (localStorage.getItem(DRAFT_KEY)) setDraftFound(true); } catch {}
  }, [editId]);
  useEffect(() => {
    if (editId || (!typeKey && !title)) return;
    const t = setTimeout(() => { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot)); } catch {} }, 600);
    return () => clearTimeout(t);
  });
  function restoreDraft() {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "{}");
      setStep(d.step ?? 1); setTypeKey(d.typeKey ?? ""); setCategoryId(d.categoryId ?? 0); setTitle(d.title ?? ""); setDescription(d.description ?? "");
      setPriceType(d.priceType ?? "fixed"); setPrice(d.price ?? ""); setPriceUnit(d.priceUnit ?? "total"); setPhone(d.phone ?? userPhone); setFeatures(d.features ?? "");
      setDistritoId(d.distritoId ?? 0); setLocationId(d.locationId ?? 0); setValues(d.values ?? {}); setImages(d.images ?? []);
    } catch {}
    setDraftFound(false);
  }
  function discardDraft() { try { localStorage.removeItem(DRAFT_KEY); } catch {} setDraftFound(false); }

  // Depois de um envio com erros, leva o utilizador ao primeiro campo com problema.
  useEffect(() => {
    if (!state.errors) return;
    formRef.current?.querySelector<HTMLElement>("[aria-invalid=true], [data-error]")?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [state]);

  const fields = useMemo(() => (typeKey && categoryId ? applicableFields(ctx.fields, typeKey, categoryId) : []), [ctx.fields, typeKey, categoryId]);
  const defs = fields.map((f) => ({ ...f, type: f.type as "number" }));
  const visible = (f: (typeof fields)[number]) => isFieldVisible({ ...f, type: f.type as "number" }, defs, values);
  const distrito = ctx.distritos.find((d) => d.id === distritoId);
  const typeName = ctx.types.find((t) => t.key === typeKey)?.name;
  const catName = ctx.categories.find((c) => c.id === categoryId)?.name;

  async function upload(files: FileList | null) {
    if (!files) return;
    setUploadError("");
    const room = ctx.limits.maxImages - images.length;
    const list = Array.from(files).slice(0, Math.max(0, room));
    if (files.length > room) setUploadError(`Pode ter no máximo ${ctx.limits.maxImages} fotografias.`);
    for (const file of list) {
      if (file.size > ctx.limits.maxImageMb * 1024 * 1024) { setUploadError(`"${file.name}" tem mais de ${ctx.limits.maxImageMb} MB.`); continue; }
      setUploading((n) => n + 1);
      try {
        const body = new FormData();
        body.append("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const json = await res.json();
        if (!res.ok) setUploadError(`"${file.name}": ${json.error ?? "não foi possível carregar."}`);
        else setImages((imgs) => (imgs.length < ctx.limits.maxImages ? [...imgs, { key: json.key, url: json.url }] : imgs));
      } catch {
        setUploadError(`"${file.name}": falhou a ligação. Tente de novo.`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }
  const move = (i: number, to: number) => setImages((imgs) => { const c = [...imgs]; const [x] = c.splice(i, 1); c.splice(to, 0, x); return c; });

  return (
    <div className="flex flex-col gap-6">
      <ol className="grid grid-cols-3 overflow-hidden rounded-xl border border-line bg-surface text-sm font-semibold" aria-label="Passos">
        {["Tipo de anúncio", "Categoria", "Detalhes"].map((label, i) => (
          <li key={label} aria-current={step === i + 1 ? "step" : undefined}
            className={`flex items-center gap-2.5 border-r border-line px-3 py-3 last:border-r-0 ${step === i + 1 ? "bg-wash text-ink" : "text-muted"}`}>
            <span className={`grid size-6 flex-none place-items-center rounded-full text-xs ${step > i ? "bg-accent text-white" : "bg-surface-2"}`}>{i + 1}</span>
            <span className="hidden sm:inline">{label}</span>
          </li>
        ))}
      </ol>

      {draftFound && step === 1 && (
        <Alert>
          Tem um anúncio por terminar neste browser.{" "}
          <button type="button" onClick={restoreDraft} className="font-semibold underline">Continuar rascunho</button>{" "}
          · <button type="button" onClick={discardDraft} className="underline">Começar do zero</button>
        </Alert>
      )}

      {step === 1 && (
        <section>
          <h2 className="mb-3 text-xl font-bold">Que tipo de anúncio quer publicar?</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {ctx.types.map((t) => (
              <button key={t.key} type="button" onClick={() => { setTypeKey(t.key); setStep(2); }}
                className={`panel flex flex-col gap-1 text-left hover:border-accent ${typeKey === t.key ? "border-accent bg-wash" : ""}`}>
                <span className="font-display text-lg font-bold">{t.name}</span>
                <span className="text-sm text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {step === 2 && (
        <section>
          <p className="mb-3 text-sm">Tipo: <b>{typeName}</b> · <button type="button" className="text-accent underline" onClick={() => setStep(1)}>alterar</button></p>
          <h2 className="mb-3 text-xl font-bold">Em que setor está o negócio?</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
            {ctx.categories.map((c) => (
              <button key={c.id} type="button" onClick={() => { setCategoryId(c.id); setStep(3); }}
                className={`panel p-3 text-left font-semibold hover:border-accent ${categoryId === c.id ? "border-accent bg-wash" : ""}`}>{c.name}</button>
            ))}
          </div>
        </section>
      )}

      {step === 3 && (
        <form ref={formRef} action={action} onSubmit={() => { try { localStorage.removeItem(DRAFT_KEY); } catch {} }} className="flex flex-col gap-5" noValidate>
          <p className="text-sm">
            Tipo: <b>{typeName}</b> · Categoria: <b>{catName}</b> ·{" "}
            <button type="button" className="text-accent underline" onClick={() => setStep(1)}>alterar</button>
          </p>
          {state.message && <Alert tone="error">{state.message}</Alert>}
          <input type="hidden" name="typeKey" value={typeKey} />
          <input type="hidden" name="categoryId" value={categoryId} />
          {editId && <input type="hidden" name="editId" value={editId} />}
          {images.map((img) => <input key={img.key} type="hidden" name="images" value={img.key} />)}

          <Section title="O anúncio">
            <Field label="Título" required error={e.title} counter={`${title.length}/${ctx.limits.titleMax}`} hint="Diga o que é e onde fica. Ex.: Trespasse de café com esplanada em Almada.">
              <input name="title" value={title} maxLength={ctx.limits.titleMax} onChange={(ev) => setTitle(ev.target.value)} className="input" aria-invalid={!!e.title || undefined} />
            </Field>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Tipo de preço" required error={e.priceType}>
                <select name="priceType" value={priceType} onChange={(ev) => setPriceType(ev.target.value)} className="input">
                  <option value="fixed">Preço fixo</option>
                  <option value="negotiable">Negociável</option>
                  <option value="on_call">Sob consulta</option>
                </select>
              </Field>
              {priceType !== "on_call" && (
                <>
                  <Field label="Valor (€)" required error={e.price}>
                    <input name="price" value={price} onChange={(ev) => setPrice(ev.target.value)} inputMode="numeric" placeholder="Ex: 45000" className="input tabular-nums" aria-invalid={!!e.price || undefined} />
                  </Field>
                  <Field label="O valor é">
                    <select name="priceUnit" value={priceUnit} onChange={(ev) => setPriceUnit(ev.target.value)} className="input">
                      <option value="total">Preço total</option>
                      <option value="month">Por mês</option>
                      <option value="">Sem indicação</option>
                    </select>
                  </Field>
                </>
              )}
            </div>
            <Field label="Descrição" required error={e.description} counter={`${description.trim().length}/${ctx.limits.descriptionMax}`}
              hint="O que é o negócio, há quanto tempo existe, o que está incluído, porque vende e as condições. Linhas começadas por “-” aparecem como lista.">
              <textarea name="description" value={description} onChange={(ev) => setDescription(ev.target.value)} rows={10} maxLength={ctx.limits.descriptionMax + 200} className="input" aria-invalid={!!e.description || undefined} />
            </Field>
          </Section>

          {FIELD_SECTIONS.map((s) => {
            const list = fields.filter((f) => (f.section ?? "funcionamento") === s.key && visible(f));
            if (!list.length) return null;
            return (
              <Section key={s.key} title={s.title} note={list.every((f) => !f.required) ? "facultativo" : undefined}>
                <div className="grid gap-4 md:grid-cols-2">
                  {list.map((f) => (
                    <CustomField key={f.id} f={f} value={values[f.key]} error={e[`field.${f.key}`]} onChange={(v) => setValues((old) => ({ ...old, [f.key]: v }))} />
                  ))}
                </div>
              </Section>
            );
          })}

          <Section title="Características" note="facultativo">
            <Field label="Pontos fortes e o que está incluído" error={e.features} hint="Uma por linha. Aparecem como lista no anúncio.">
              <textarea name="features" value={features} onChange={(ev) => setFeatures(ev.target.value)} rows={5} placeholder={"Cozinha totalmente equipada\nEsplanada com 20 lugares\nClientela fixa"} className="input" />
            </Field>
          </Section>

          <Section title="Fotografias" note={`até ${ctx.limits.maxImages}, facultativo`}>
            <p className="text-sm text-muted">JPG, PNG ou WEBP até {ctx.limits.maxImageMb} MB. A primeira é a foto de capa. Anúncios com fotografias recebem muito mais contactos.</p>
            <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3" data-error={e.images ? true : undefined}>
              {images.map((img, i) => (
                <figure key={img.key} className="relative overflow-hidden rounded-lg border border-line bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={`Fotografia ${i + 1}`} className="aspect-[4/3] w-full object-cover" />
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 text-[11px] font-bold text-white">Capa</span>}
                  <figcaption className="flex justify-between gap-1 p-1">
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={i === 0} onClick={() => move(i, i - 1)} aria-label={`Mover fotografia ${i + 1} para trás`}>◀</button>
                    {i > 0 && <button type="button" className="btn-ghost px-2 py-1 text-xs" onClick={() => move(i, 0)}>Capa</button>}
                    <button type="button" className="btn-ghost px-2 py-1 text-xs" disabled={i === images.length - 1} onClick={() => move(i, i + 1)} aria-label={`Mover fotografia ${i + 1} para a frente`}>▶</button>
                    <button type="button" className="btn-ghost px-2 py-1 text-xs text-danger" onClick={() => setImages((imgs) => imgs.filter((x) => x.key !== img.key))} aria-label={`Remover fotografia ${i + 1}`}>✕</button>
                  </figcaption>
                </figure>
              ))}
              {Array.from({ length: uploading }, (_, i) => <div key={`up${i}`} className="grid aspect-[4/3] place-items-center rounded-lg border border-dashed border-line text-xs text-muted">A carregar…</div>)}
              {images.length + uploading < ctx.limits.maxImages && (
                <label className="grid aspect-[4/3] cursor-pointer place-items-center rounded-lg border-2 border-dashed border-line p-2 text-center text-sm text-muted hover:border-accent">
                  <span><b className="text-accent">Adicionar fotografias</b><br />{images.length}/{ctx.limits.maxImages}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(ev) => { upload(ev.target.files); ev.target.value = ""; }} />
                </label>
              )}
            </div>
            {(uploadError || e.images) && <p className="err">{uploadError || e.images}</p>}
          </Section>

          <Section title="Localização e contacto">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Distrito" required error={e.locationId}>
                <select value={distritoId || ""} onChange={(ev) => { setDistritoId(Number(ev.target.value)); setLocationId(0); }} className="input" aria-invalid={!!e.locationId || undefined}>
                  <option value="">Selecione o distrito</option>
                  {ctx.distritos.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Concelho" required>
                <select name="locationId" value={locationId || ""} onChange={(ev) => setLocationId(Number(ev.target.value))} disabled={!distrito} className="input">
                  <option value="">{distrito ? "Selecione o concelho" : "Escolha primeiro o distrito"}</option>
                  {/* Anúncios antigos só com distrito mantêm-no como opção. */}
                  {distrito && initial?.locationId === distrito.id && <option value={distrito.id}>{distrito.name} (sem concelho)</option>}
                  {distrito?.concelhos.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <Field label="Telefone" required error={e.phone} hint="Só é mostrado a quem tem sessão iniciada.">
                <input name="phone" type="tel" value={phone} onChange={(ev) => setPhone(ev.target.value)} autoComplete="tel" className="input" aria-invalid={!!e.phone || undefined} />
              </Field>
            </div>
          </Section>

          <div className="panel flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{editId ? "As alterações são revistas pela equipa antes de ficarem visíveis." : "O anúncio é revisto pela equipa antes de ser publicado, normalmente em menos de 48 horas."}</p>
            <button type="submit" className="btn-primary px-6 py-3 text-base" disabled={pending || uploading > 0}>
              {pending ? "A enviar…" : uploading ? "A carregar fotografias…" : editId ? "Guardar alterações" : "Publicar anúncio"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <fieldset className="panel flex flex-col gap-4">
      <legend className="float-left flex w-full items-baseline gap-2 font-display text-lg font-bold">
        {title} {note && <span className="font-sans text-xs font-normal text-muted">{note}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

function Field({ label, required, hint, error, counter, children }: { label: string; required?: boolean; hint?: string | null; error?: string; counter?: string; children: React.ReactNode }) {
  return (
    <div className="field" data-error={error ? true : undefined}>
      <span className="flex items-baseline gap-1.5">
        <label className="contents">{label}</label>
        {required && <span className="text-danger" aria-hidden="true">*</span>}
        {counter && <span className="ml-auto text-xs font-normal text-muted tabular-nums">{counter}</span>}
      </span>
      {hint && <span className="hint">{hint}</span>}
      {children}
      {error && <span className="err" role="alert">{error}</span>}
    </div>
  );
}

type FieldDefUI = FormContext["fields"][number];

function CustomField({ f, value, error, onChange }: { f: FieldDefUI; value: string | string[] | undefined; error?: string; onChange: (v: string | string[]) => void }) {
  const name = `f:${f.key}`;
  if (f.type === "number" || f.type === "text") {
    return (
      <Field label={f.money ? `${f.label} (€)` : f.label} required={f.required} hint={f.help} error={error}>
        <input name={name} value={(value as string) ?? ""} onChange={(ev) => onChange(ev.target.value)} inputMode={f.type === "number" ? "numeric" : undefined}
          placeholder={f.placeholder ?? undefined} className="input tabular-nums" aria-invalid={!!error || undefined} />
      </Field>
    );
  }
  if (f.type === "select") {
    return (
      <Field label={f.label} required={f.required} hint={f.help} error={error}>
        <select name={name} value={(value as string) ?? ""} onChange={(ev) => onChange(ev.target.value)} className="input" aria-invalid={!!error || undefined}>
          <option value="">{f.required ? "Selecione" : "Prefiro não indicar"}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </Field>
    );
  }
  const multi = f.type === "checkbox";
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return (
    <Field label={f.label} required={f.required} hint={f.help} error={error}>
      {multi && <input type="hidden" name={`multi:${f.key}`} value="1" />}
      <div className="flex flex-wrap gap-2" role={multi ? "group" : "radiogroup"} aria-label={f.label}>
        {f.options.map((o) => {
          const checked = list.includes(o.value);
          return (
            <label key={o.value} className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm font-medium ${checked ? "border-accent bg-wash" : "border-line bg-surface"}`}>
              <input type={multi ? "checkbox" : "radio"} name={name} value={o.value} checked={checked} className="accent-accent"
                onChange={() => onChange(multi ? (checked ? list.filter((x) => x !== o.value) : [...list, o.value]) : o.value)} />
              {o.label}
            </label>
          );
        })}
        {!multi && !f.required && list.length > 0 && <button type="button" className="text-xs text-muted underline" onClick={() => onChange("")}>limpar</button>}
      </div>
    </Field>
  );
}
