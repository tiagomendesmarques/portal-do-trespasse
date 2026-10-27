import type { Metadata } from "next";
import { ListingArchive } from "@/components/listings/archive";
import { parseFilters, type SearchParams } from "@/lib/listings/filters";
import { findLocationBySlugs, getTaxonomies } from "@/lib/listings/queries";
import { redirectOrNotFound } from "@/lib/redirects";

export async function locationMetadata(distrito: string, concelho?: string): Promise<Metadata> {
  const loc = await findLocationBySlugs(distrito, concelho);
  if (!loc) return {};
  const name = loc.concelho ? `${loc.concelho.name} (${loc.distrito.name})` : loc.distrito.name;
  const path = `/listing-location/${loc.distrito.slug}/${loc.concelho ? `${loc.concelho.slug}/` : ""}`;
  return {
    title: `Trespasses em ${name}`,
    description: `Negócios para trespasse e empresas à venda em ${name}.`,
    alternates: { canonical: path },
  };
}

export async function LocationArchive({ distrito, concelho, sp }: { distrito: string; concelho?: string; sp: SearchParams }) {
  const path = `/listing-location/${distrito}/${concelho ? `${concelho}/` : ""}`;
  const loc = await findLocationBySlugs(distrito, concelho);
  if (!loc) return redirectOrNotFound(path);
  const tax = await getTaxonomies();
  const filters = { ...parseFilters(sp, tax.fields.filter((f) => f.searchable)), distrito: loc.distrito.slug, concelho: loc.concelho?.slug ?? null };
  const crumbs = [
    { href: "/", label: "Início" },
    { href: "/all-ads/", label: "Anúncios" },
    { href: `/listing-location/${loc.distrito.slug}/`, label: loc.distrito.name },
    ...(loc.concelho ? [{ href: path, label: loc.concelho.name }] : []),
  ];
  return (
    <ListingArchive
      title={`Trespasses em ${loc.concelho?.name ?? loc.distrito.name}`}
      crumbs={crumbs}
      filters={filters}
      basePath={path}
      fromPath={["distrito", "concelho"]}
      view={String(sp.vista ?? "")}
    />
  );
}
