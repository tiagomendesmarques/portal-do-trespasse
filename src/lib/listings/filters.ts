/** Filtros da listagem a partir dos parâmetros do URL. Puro (sem base de dados) para poder ser testado. */

export const SORTS = {
  "date-desc": "Mais recentes",
  "date-asc": "Mais antigos",
  "price-asc": "Preço (baixo a alto)",
  "price-desc": "Preço (alto a baixo)",
  "views-desc": "Mais vistos",
  "views-asc": "Menos vistos",
  "title-asc": "A a Z (título)",
  "title-desc": "Z a A (título)",
} as const;
export type Sort = keyof typeof SORTS;

/** Campos personalizados que podem ser filtrados, por chave. Números por intervalo, escolhas por valor. */
export type FieldFilter = { key: string; min?: number; max?: number; equals?: string };

export type ListingFilters = {
  q: string;
  type: string | null;
  category: string | null;
  distrito: string | null;
  concelho: string | null;
  priceMin: number | null;
  priceMax: number | null;
  author: number | null;
  fields: FieldFilter[];
  sort: Sort;
  page: number;
};

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || null;
const num = (v: string | string[] | undefined) => {
  const s = one(v)?.replace(/[^\d]/g, "");
  return s ? Number(s) : null;
};
const slug = (v: string | string[] | undefined) => {
  const s = one(v);
  return s && /^[a-z0-9-_]+$/.test(s) ? s : null;
};

export function parseFilters(sp: SearchParams, fieldDefs: { key: string; type: string }[] = []): ListingFilters {
  const sort = one(sp.orderby) as Sort | null;
  const fields: FieldFilter[] = [];
  for (const f of fieldDefs) {
    if (f.type === "number") {
      const min = num(sp[`${f.key}_min`]);
      const max = num(sp[`${f.key}_max`]);
      if (min != null || max != null) fields.push({ key: f.key, ...(min != null && { min }), ...(max != null && { max }) });
    } else {
      const eq = slug(sp[f.key]);
      if (eq) fields.push({ key: f.key, equals: eq });
    }
  }
  return {
    q: (one(sp.q) ?? "").slice(0, 100),
    type: slug(sp.tipo),
    category: slug(sp.categoria),
    distrito: slug(sp.distrito),
    concelho: slug(sp.concelho),
    priceMin: num(sp.preco_min),
    priceMax: num(sp.preco_max),
    author: num(sp.anunciante),
    fields,
    sort: sort && sort in SORTS ? sort : "date-desc",
    page: Math.max(1, Math.min(1000, num(sp.pagina) ?? 1)),
  };
}

/** Constrói o query string para links (paginação, ordenação), sem os valores por omissão. */
export function filtersToQuery(f: ListingFilters, override: Partial<ListingFilters> = {}, opts: { omit?: (keyof ListingFilters)[] } = {}): string {
  const v = { ...f, ...override };
  const p = new URLSearchParams();
  const omit = new Set(opts.omit ?? []);
  const set = (k: keyof ListingFilters, name: string, val: string | number | null) => {
    if (!omit.has(k) && val != null && val !== "") p.set(name, String(val));
  };
  set("q", "q", v.q);
  set("type", "tipo", v.type);
  set("category", "categoria", v.category);
  set("distrito", "distrito", v.distrito);
  set("concelho", "concelho", v.concelho);
  set("priceMin", "preco_min", v.priceMin);
  set("priceMax", "preco_max", v.priceMax);
  set("author", "anunciante", v.author);
  if (!omit.has("fields"))
    for (const ff of v.fields) {
      if (ff.equals) p.set(ff.key, ff.equals);
      if (ff.min != null) p.set(`${ff.key}_min`, String(ff.min));
      if (ff.max != null) p.set(`${ff.key}_max`, String(ff.max));
    }
  if (v.sort !== "date-desc") set("sort", "orderby", v.sort);
  if (v.page > 1) set("page", "pagina", v.page);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Divide a pesquisa em termos normalizados (sem acentos, minúsculas). */
export function searchTerms(q: string): string[] {
  return q
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2)
    .slice(0, 8);
}
