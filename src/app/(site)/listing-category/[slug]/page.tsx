import type { Metadata } from "next";
import { ListingArchive } from "@/components/listings/archive";
import { parseFilters, type SearchParams } from "@/lib/listings/filters";
import { getTaxonomies } from "@/lib/listings/queries";
import { redirectOrNotFound } from "@/lib/redirects";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const cat = (await getTaxonomies()).categories.find((c) => c.slug === slug);
  if (!cat) return {};
  return {
    title: `${cat.name}: negócios para trespasse`,
    description: `Trespasses e negócios à venda na área de ${cat.name.toLowerCase()} em Portugal.`,
    alternates: { canonical: `/listing-category/${cat.slug}/` },
  };
}

export default async function CategoryPage({ params, searchParams }: Props) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tax = await getTaxonomies();
  const cat = tax.categories.find((c) => c.slug === slug);
  if (!cat) return redirectOrNotFound(`/listing-category/${slug}/`);
  const filters = { ...parseFilters(sp, tax.fields.filter((f) => f.searchable)), category: cat.slug };
  return (
    <ListingArchive
      title={cat.name}
      intro={`Negócios de ${cat.name.toLowerCase()} para trespasse e venda em Portugal.`}
      crumbs={[{ href: "/", label: "Início" }, { href: "/all-ads/", label: "Anúncios" }, { href: `/listing-category/${cat.slug}/`, label: cat.name }]}
      filters={filters}
      basePath={`/listing-category/${cat.slug}/`}
      fromPath={["category"]}
      view={String(sp.vista ?? "")}
    />
  );
}
