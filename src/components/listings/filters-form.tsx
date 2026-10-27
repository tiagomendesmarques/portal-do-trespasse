"use client";

import { useRef, useState } from "react";
import type { ListingFilters } from "@/lib/listings/filters";

type Opt = { slug: string; name: string; count?: number };
type Props = {
  filters: ListingFilters;
  types: { key: string; name: string }[];
  categories: Opt[];
  distritos: (Opt & { concelhos: Opt[] })[];
  numberFields: { key: string; label: string; money: boolean }[];
  choiceFields: { key: string; label: string; options: { value: string; label: string }[] }[];
  view: string;
};

export function FiltersForm({ filters: f, types, categories, distritos, numberFields, choiceFields, view }: Props) {
  const form = useRef<HTMLFormElement>(null);
  const [distrito, setDistrito] = useState(f.distrito ?? "");
  const concelhos = distritos.find((d) => d.slug === distrito)?.concelhos ?? [];
  const submit = () => form.current?.requestSubmit();
  const fieldVal = (key: string, k: "min" | "max" | "equals") => f.fields.find((x) => x.key === key)?.[k] ?? "";
  const active = [f.q, f.type, f.category, f.distrito, f.priceMin, f.priceMax].filter((v) => v != null && v !== "").length + f.fields.length;

  return (
    <details className="panel group md:open:block" open>
      <summary className="flex cursor-pointer list-none items-center justify-between font-bold md:hidden">
        Filtros {active > 0 && <span className="rounded-full bg-accent px-2 text-xs text-white">{active}</span>}
        <span className="text-sm font-normal text-muted group-open:hidden">mostrar</span>
      </summary>
      <form ref={form} action="/all-ads/" method="get" className="mt-4 flex flex-col divide-y divide-line md:mt-0">
        {view === "grelha" && <input type="hidden" name="vista" value="grelha" />}
        {f.sort !== "date-desc" && <input type="hidden" name="orderby" value={f.sort} />}
        {f.author && <input type="hidden" name="anunciante" value={f.author} />}
        <Group title="Pesquisa">
          <input name="q" defaultValue={f.q} className="input" placeholder="O que procura?" aria-label="Pesquisa" />
        </Group>
        <Group title="Tipo">
          <div className="flex flex-col gap-1.5 text-sm">
            {[{ key: "", name: "Todos" }, ...types].map((t) => (
              <label key={t.key} className="flex cursor-pointer items-center gap-2">
                <input type="radio" name="tipo" value={t.key} defaultChecked={(f.type ?? "") === t.key} onChange={submit} className="accent-accent" />
                {t.name}
              </label>
            ))}
          </div>
        </Group>
        <Group title="Categoria">
          <select name="categoria" defaultValue={f.category ?? ""} onChange={submit} className="input" aria-label="Categoria">
            <option value="">Todas</option>
            {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name} ({c.count ?? 0})</option>)}
          </select>
        </Group>
        <Group title="Localização">
          <select name="distrito" value={distrito} onChange={(e) => { setDistrito(e.target.value); setTimeout(submit); }} className="input" aria-label="Distrito">
            <option value="">Todos os distritos</option>
            {distritos.map((d) => <option key={d.slug} value={d.slug}>{d.name}{d.count ? ` (${d.count})` : ""}</option>)}
          </select>
          <select key={distrito} name="concelho" defaultValue={f.distrito === distrito ? f.concelho ?? "" : ""} onChange={submit} disabled={!distrito} className="input" aria-label="Concelho">
            <option value="">{distrito ? "Todos os concelhos" : "Escolha primeiro o distrito"}</option>
            {concelhos.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
          </select>
        </Group>
        <Group title="Preço (€)">
          <Range name="preco" min={f.priceMin} max={f.priceMax} />
        </Group>
        {numberFields.map((nf) => (
          <Group key={nf.key} title={nf.money ? `${nf.label} (€)` : nf.label}>
            <Range name={nf.key} sep="_" min={fieldVal(nf.key, "min") as number | ""} max={fieldVal(nf.key, "max") as number | ""} />
          </Group>
        ))}
        {choiceFields.map((cf) => (
          <Group key={cf.key} title={cf.label}>
            <select name={cf.key} defaultValue={String(fieldVal(cf.key, "equals"))} onChange={submit} className="input" aria-label={cf.label}>
              <option value="">Indiferente</option>
              {cf.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Group>
        ))}
        <div className="flex flex-col gap-2 pt-4">
          <button className="btn-primary">Aplicar filtros</button>
          {active > 0 && <a href="/all-ads/" className="btn-ghost">Limpar filtros</a>}
        </div>
      </form>
    </details>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2 py-3.5 first:pt-0">
      <legend className="float-left mb-2 w-full text-sm font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Range({ name, sep = "_", min, max }: { name: string; sep?: string; min: number | "" | null; max: number | "" | null }) {
  return (
    <div className="flex gap-2">
      <input name={`${name}${sep}min`} type="number" min={0} inputMode="numeric" defaultValue={min ?? ""} placeholder="mín." className="input tabular-nums" aria-label="Mínimo" />
      <input name={`${name}${sep}max`} type="number" min={0} inputMode="numeric" defaultValue={max ?? ""} placeholder="máx." className="input tabular-nums" aria-label="Máximo" />
    </div>
  );
}
