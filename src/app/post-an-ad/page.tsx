import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Publicar anúncio", robots: { index: false } };

// O formulário completo (tipo → categoria → detalhes) chega na fase 3.
export default async function PostAdPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/post-an-ad/");
  return (
    <div className="wrap py-12">
      <div className="panel mx-auto flex max-w-xl flex-col gap-3">
        <h1 className="text-2xl font-extrabold">Publicar anúncio</h1>
        <p>O formulário de publicação está em construção neste site de testes.</p>
        <Link href="/all-ads/" className="btn-ghost self-start">Ver anúncios</Link>
      </div>
    </div>
  );
}
