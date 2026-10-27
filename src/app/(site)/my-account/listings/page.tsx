import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Alert } from "@/components/auth/form-bits";
import { ListingActions } from "@/components/account/listing-actions";
import { AccountShell } from "@/components/account/shell";
import { Chip, Price } from "@/components/listings/bits";
import { accountCounts, myListings } from "@/lib/account/queries";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const metadata: Metadata = { title: "Os meus anúncios", robots: { index: false } };

const STATUS: Record<string, [string, "ok" | "warn" | "neutral" | "accent"]> = {
  published: ["Publicado", "ok"], pending: ["À espera de aprovação", "warn"], rejected: ["Precisa de alterações", "warn"],
  expired: ["Expirado", "neutral"], sold: ["Vendido", "accent"], draft: ["Rascunho", "neutral"],
};

export default async function MyListingsPage({ searchParams }: { searchParams: Promise<{ enviado?: string; editado?: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/my-account/?next=/my-account/listings/");
  const [sp, listings, counts] = await Promise.all([searchParams, myListings(user.id), accountCounts(user.id)]);
  return (
    <AccountShell user={user} active="anuncios" title="Os meus anúncios" counts={counts}>
      {sp.enviado && <Alert tone="ok">Anúncio enviado. Vamos revê-lo e avisamos por email quando estiver publicado (normalmente em menos de 48 horas).</Alert>}
      {sp.editado && <Alert tone="ok">Alterações guardadas. Ficam visíveis depois de revistas pela equipa.</Alert>}
      <div className="flex justify-end"><Link href="/post-an-ad/" className="btn-primary">Publicar anúncio</Link></div>
      {listings.length === 0 && (
        <div className="panel py-10 text-center">
          <h2 className="text-xl font-bold">Ainda não tem anúncios</h2>
          <p className="mt-1 text-muted">Os anúncios que publicar aparecem aqui, com o estado da aprovação e as visitas.</p>
        </div>
      )}
      {listings.map((l) => {
        const [label, tone] = STATUS[l.status] ?? [l.status, "neutral"];
        const expiresSoon = Boolean(l.expiresAt && l.expiresAt.getTime() - Date.now() < 15 * 86_400_000);
        return (
          <article key={l.id} className="panel grid gap-4 p-4 sm:grid-cols-[120px_minmax(0,1fr)]">
            <div className="aspect-[4/3] overflow-hidden rounded-lg bg-surface-2">
              {l.imageKey && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl(l.imageKey, 400)} alt="" className="size-full object-cover" />
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2"><Chip tone={tone}>{label}</Chip><span className="text-xs text-muted">{l.categoryName}</span></div>
              <h2 className="font-sans text-lg font-bold leading-snug">{l.title}</h2>
              {l.status === "rejected" && l.rejectionReason && <p className="text-sm text-danger">Motivo: {l.rejectionReason}</p>}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                <Price price={l.price} priceType={l.priceType} priceUnit={l.priceUnit} />
                <span className="tabular-nums">{l.views} visualizações</span>
                <span className="tabular-nums">{l.phoneClicks} viram o telefone</span>
                <span className="tabular-nums">{l.messages} mensagens</span>
                <span className="tabular-nums">{l.favorites} favoritos</span>
              </div>
              <p className="text-xs text-muted">
                {l.publishedAt ? `Publicado a ${formatDate(l.publishedAt)}` : `Enviado a ${formatDate(l.createdAt)}`}
                {l.expiresAt && l.status !== "expired" && ` · expira a ${formatDate(l.expiresAt)}`}
                {l.status === "expired" && l.expiresAt && ` · expirou a ${formatDate(l.expiresAt)}`}
              </p>
              <ListingActions id={l.id} slug={l.slug} status={l.status} expiresSoon={expiresSoon} />
            </div>
          </article>
        );
      })}
    </AccountShell>
  );
}
