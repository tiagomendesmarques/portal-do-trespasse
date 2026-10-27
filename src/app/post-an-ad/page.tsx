import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/auth/form-bits";
import { PostWizard } from "@/components/post/post-wizard";
import { getCurrentUser } from "@/lib/auth/session";
import { activeListingCount, loadFormContext } from "@/lib/listings/manage";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = { title: "Publicar anúncio", robots: { index: false } };

export default async function PostAdPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/post-an-ad/");
  const [ctx, count, settings] = await Promise.all([loadFormContext(), activeListingCount(user.id), getSettings(["listings.freeAdsPerUser"])]);
  const limit = settings["listings.freeAdsPerUser"];
  return (
    <div className="wrap max-w-4xl py-8">
      <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><span>Publicar anúncio</span></nav>
      <h1 className="text-3xl font-extrabold">Publicar anúncio</h1>
      <p className="mb-6 mt-1 text-muted">Gratuito. Demora cerca de 5 minutos.</p>
      {count >= limit ? (
        <Alert tone="error">
          Já tem {count} anúncios ativos, o máximo do plano grátis. <Link href="/my-account/listings/" className="underline">Gerir os meus anúncios</Link>
        </Alert>
      ) : (
        <PostWizard ctx={ctx} userPhone={user.phone ?? ""} />
      )}
    </div>
  );
}
