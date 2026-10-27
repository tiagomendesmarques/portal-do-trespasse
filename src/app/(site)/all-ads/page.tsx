import type { Metadata } from "next";
import { ListingArchive } from "@/components/listings/archive";
import { parseFilters, type SearchParams } from "@/lib/listings/filters";
import { getTaxonomies } from "@/lib/listings/queries";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<SearchParams> };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const sp = await searchParams;
  // Páginas filtradas não são indexadas (conteúdo duplicado); a listagem base sim.
  const filtered = Object.keys(sp).some((k) => !["pagina"].includes(k));
  return {
    title: "Todos os anúncios de trespasse",
    description: "Trespasses, venda de empresas, aluguer de ativos e investimentos em Portugal. Pesquise por setor, distrito e preço.",
    alternates: { canonical: "/all-ads/" },
    robots: filtered ? { index: false, follow: true } : undefined,
  };
}

export default async function AllAdsPage({ searchParams }: Props) {
  const sp = await searchParams;
  const tax = await getTaxonomies();
  const filters = parseFilters(sp, tax.fields.filter((f) => f.searchable));
  const author = filters.author ? "Anúncios do anunciante" : null;
  return (
    <ListingArchive
      title={author ?? (filters.q ? `Resultados para "${filters.q}"` : "Todos os anúncios")}
      crumbs={[{ href: "/", label: "Início" }, { href: "/all-ads/", label: "Anúncios" }]}
      filters={filters}
      basePath="/all-ads/"
      view={String(sp.vista ?? "")}
    />
  );
}
