import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { BlogIndex } from "@/components/blog-index";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ n: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { n } = await params;
  return { title: `Blog: página ${n}`, alternates: { canonical: `/blog/page/${n}/` } };
}

// Mesmo formato de paginação do WordPress (/blog/page/2/).
export default async function BlogPageN({ params }: Props) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1) notFound();
  if (n === 1) permanentRedirect("/blog/");
  return <BlogIndex page={n} />;
}
