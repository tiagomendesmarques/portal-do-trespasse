import { LocationArchive, locationMetadata } from "@/lib/listings/location-page";
import type { SearchParams } from "@/lib/listings/filters";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ distrito: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props) {
  return locationMetadata((await params).distrito);
}

export default async function DistritoPage({ params, searchParams }: Props) {
  const [{ distrito }, sp] = await Promise.all([params, searchParams]);
  return <LocationArchive distrito={distrito} sp={sp} />;
}
