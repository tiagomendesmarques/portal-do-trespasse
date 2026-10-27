import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Alert } from "@/components/auth/form-bits";
import { PostWizard } from "@/components/post/post-wizard";
import { getCurrentUser } from "@/lib/auth/session";
import { listingForEdit, loadFormContext } from "@/lib/listings/manage";

export const metadata: Metadata = { title: "Editar anúncio", robots: { index: false } };

export default async function EditAdPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/my-account/?next=/post-an-ad/editar/${id}/`);
  const data = await listingForEdit(Number(id));
  const staff = user.role === "admin" || user.role === "editor";
  if (!data || (data.listing.userId !== user.id && !staff)) notFound();
  const ctx = await loadFormContext();
  return (
    <div className="wrap max-w-4xl py-8">
      <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho">
        <Link href="/my-account/listings/" className="text-muted">Os meus anúncios</Link><span aria-hidden="true">›</span><span>Editar</span>
      </nav>
      <h1 className="mb-4 text-3xl font-extrabold">Editar anúncio</h1>
      {data.listing.status === "rejected" && data.listing.rejectionReason && (
        <div className="mb-4"><Alert tone="error">Motivo da rejeição: {data.listing.rejectionReason}</Alert></div>
      )}
      <PostWizard ctx={ctx} initial={data.initial} editId={data.listing.id} userPhone={user.phone ?? ""} />
    </div>
  );
}
