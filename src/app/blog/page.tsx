import type { Metadata } from "next";
import { BlogIndex } from "@/components/blog-index";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog: trespasses e venda de empresas",
  description: "Guias sobre trespasses, venda de empresas e empreendedorismo em Portugal.",
  alternates: { canonical: "/blog/" },
};

export default function BlogPage() {
  return <BlogIndex page={1} />;
}
