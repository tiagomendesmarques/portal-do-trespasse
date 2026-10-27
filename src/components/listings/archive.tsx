import Link from "next/link";
import { filtersToQuery, SORTS, type ListingFilters, type Sort } from "@/lib/listings/filters";
import { getCounts, getTaxonomies, searchListings } from "@/lib/listings/queries";
import { FiltersForm } from "./filters-form";
import { ListingCard, ListingRow } from "./listing-card";
import { SortSelect } from "./sort-select";

type Props = {
  title: string;
  intro?: string;
  crumbs: { href: string; label: string }[];
  filters: ListingFilters;
  basePath: string;
  /** Filtros que já vêm do caminho (categoria/localização) e não vão no query string. */
  fromPath?: (keyof ListingFilters)[];
  view: string;
};

export async function ListingArchive({ title, intro, crumbs, filters, basePath, fromPath = [], view }: Props) {
  const [tax, counts, result] = await Promise.all([getTaxonomies(), getCounts(), searchListings(filters)]);
  const qs = (o: Partial<ListingFilters>, v = view) => {
    const q = filtersToQuery(filters, o, { omit: fromPath });
    const vista = v === "grelha" ? `${q ? "&" : "?"}vista=grelha` : "";
    return `${basePath}${q}${vista}`;
  };
  const from = result.total ? (result.page - 1) * result.perPage + 1 : 0;
  const to = Math.min(result.page * result.perPage, result.total);
  const hrefForSort = Object.fromEntries((Object.keys(SORTS) as Sort[]).map((s) => [s, qs({ sort: s, page: 1 })])) as Record<Sort, string>;

  return (
    <div className="wrap py-8">
      <nav className="mb-2 flex flex-wrap gap-1.5 text-sm text-muted" aria-label="Caminho">
        {crumbs.map((c, i) => (
          <span key={c.href} className="flex gap-1.5">
            {i > 0 && <span aria-hidden="true">›</span>}
            <Link href={c.href} className="text-muted">{c.label}</Link>
          </span>
        ))}
      </nav>
      <h1 className="text-3xl font-extrabold sm:text-4xl">{title}</h1>
      {intro && <p className="mt-2 max-w-[70ch] text-muted">{intro}</p>}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="lg:sticky lg:top-20">
          <FiltersForm
            filters={filters}
            view={view}
            types={tax.types}
            categories={tax.categories.map((c) => ({ slug: c.slug, name: c.name, count: counts.category.get(c.id) }))}
            distritos={tax.distritos.map((d) => ({ slug: d.slug, name: d.name, count: counts.distrito.get(d.id), concelhos: d.concelhos.map((c) => ({ slug: c.slug, name: c.name })) }))}
            numberFields={tax.fields.filter((x) => x.searchable && x.type === "number").map((x) => ({ key: x.key, label: x.label, money: x.icon === "money" }))}
            choiceFields={tax.fields.filter((x) => x.searchable && x.type !== "number").map((x) => ({ key: x.key, label: x.label, options: x.options }))}
          />
        </aside>
        <section className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted tabular-nums" aria-live="polite">
              {result.total ? `A mostrar ${from}–${to} de ${result.total} ${result.total === 1 ? "anúncio" : "anúncios"}` : "Sem resultados"}
            </p>
            <div className="flex items-center gap-2">
              <SortSelect value={filters.sort} hrefFor={hrefForSort} />
              <div className="flex overflow-hidden rounded-md border border-line" role="group" aria-label="Vista">
                <Link href={qs({}, "lista")} aria-current={view !== "grelha" ? "true" : undefined} className={`px-3 py-2 text-sm no-underline ${view !== "grelha" ? "bg-wash text-accent" : "text-ink"}`}>Lista</Link>
                <Link href={qs({}, "grelha")} aria-current={view === "grelha" ? "true" : undefined} className={`border-l border-line px-3 py-2 text-sm no-underline ${view === "grelha" ? "bg-wash text-accent" : "text-ink"}`}>Grelha</Link>
              </div>
            </div>
          </div>

          {result.items.length === 0 ? (
            <div className="panel py-12 text-center">
              <h2 className="text-xl font-bold">Nenhum anúncio com estes filtros</h2>
              <p className="mt-2 text-muted">Experimente alargar a localização ou retirar o limite de preço.</p>
              <Link href="/all-ads/" className="btn-primary mt-5">Ver todos os anúncios</Link>
            </div>
          ) : view === "grelha" ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">{result.items.map((i) => <ListingCard key={i.id} item={i} />)}</div>
          ) : (
            <div className="flex flex-col gap-3">{result.items.map((i) => <ListingRow key={i.id} item={i} />)}</div>
          )}

          {result.pages > 1 && (
            <nav className="mt-6 flex flex-wrap justify-center gap-1.5" aria-label="Páginas">
              {Array.from({ length: result.pages }, (_, i) => i + 1).map((p) => (
                <Link key={p} href={qs({ page: p })} aria-current={p === result.page ? "page" : undefined}
                  className={`grid min-w-10 place-items-center rounded-md border px-3 py-2 text-sm no-underline tabular-nums ${p === result.page ? "border-accent bg-accent text-white" : "border-line text-ink"}`}>
                  {p}
                </Link>
              ))}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
