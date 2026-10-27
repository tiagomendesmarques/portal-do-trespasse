import Link from "next/link";
import { listingAction } from "@/lib/account/actions";

/** Botões de cada anúncio em "Os meus anúncios" (formulários simples, funcionam sem JavaScript). */
export function ListingActions({ id, slug, status, expiresSoon }: { id: number; slug: string; status: string; expiresSoon: boolean }) {
  const op = (name: string, label: string, cls = "btn-ghost") => (
    <form action={listingAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="op" value={name} />
      <button className={`${cls} px-3 py-1.5 text-sm`}>{label}</button>
    </form>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {["published", "sold"].includes(status) && <Link href={`/listing/${slug}/`} className="btn-ghost px-3 py-1.5 text-sm">Ver</Link>}
      <Link href={`/post-an-ad/editar/${id}/`} className="btn-ghost px-3 py-1.5 text-sm">Editar</Link>
      {status === "published" && op("sold", "Marcar como vendido")}
      {status === "sold" && op("available", "Voltar a disponível")}
      {(status === "expired" || (status === "published" && expiresSoon)) && op("renew", "Renovar", "btn-primary")}
      <details className="relative">
        <summary className="btn-ghost cursor-pointer list-none px-3 py-1.5 text-sm text-danger">Apagar</summary>
        <form action={listingAction} className="absolute right-0 z-10 mt-1 flex w-64 flex-col gap-2 rounded-lg border border-line bg-surface p-3 shadow-lg">
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="op" value="delete" />
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" name="confirm" required className="mt-1 accent-accent" /> Apagar de vez este anúncio e as fotografias.</label>
          <button className="btn bg-danger px-3 py-1.5 text-sm text-white">Apagar anúncio</button>
        </form>
      </details>
    </div>
  );
}
