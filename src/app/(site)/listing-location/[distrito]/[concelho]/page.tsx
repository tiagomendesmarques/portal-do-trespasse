import { LocationArchive, locationMetadata } from "@/lib/listings/location-page";
import type { SearchParams } from "@/lib/listings/filters";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ distrito: string; concelho: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props) {
  const p = await params;
  return locationMetadata(p.distrito, p.concelho);
}

export default async function ConcelhoPage({ params, searchParams }: Props) {
  const [{ distrito, concelho }, sp] = await Promise.all([params, searchParams]);
  return <LocationArchive distrito={distrito} concelho={concelho} sp={sp} />;
}
