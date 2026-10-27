import Link from "next/link";
import { Alert } from "@/components/auth/form-bits";
import { Price } from "@/components/listings/bits";
import { AdminHeader, Pager, StatusChip, Table } from "@/components/admin/ui";
import { adminListings, statusCounts } from "@/lib/admin/queries";
import { getTaxonomies } from "@/lib/listings/queries";
import { formatDate, relativeTime } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Anúncios" };
type SP = Promise<{ estado?: string; q?: string; categoria?: string; pagina?: string; expira?: string; utilizador?: string; aprovado?: string; apagado?: string }>;

const TABS: [string, string][] = [["pending", "Por aprovar"], ["published", "Publicados"], ["rejected", "Rejeitados"], ["expired", "Expirados"], ["sold", "Vendidos"], ["", "Todos"]];

export default async function AdminListings({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const status = sp.estado ?? "pending";
  const page = Math.max(1, Number(sp.pagina) || 1);
  const [counts, tax, r] = await Promise.all([
    statusCounts(), getTaxonomies(),
    adminListings({ status: status || undefined, q: sp.q?.trim() || undefined, category: Number(sp.categoria) || undefined, userId: Number(sp.utilizador) || undefined, expiringDays: Number(sp.expira) || undefined, page }),
  ]);
  const qs = (o: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const v = { estado: status, q: sp.q, categoria: sp.categoria, utilizador: sp.utilizador, expira: sp.expira, ...o };
    // "estado" vai sempre no URL: vazio significa "Todos" (sem ele, o omissão é "Por aprovar").
    p.set("estado", String(v.estado ?? ""));
    for (const [k, val] of Object.entries(v)) if (k !== "estado" && val !== undefined && val !== "") p.set(k, String(val));
    return `/admin/anuncios/?${p.toString()}`;
  };
  return (
    <>
      <AdminHeader title="Anúncios" />
      {sp.aprovado && <div className="mb-4"><Alert tone="ok">Anúncio aprovado e publicado. O anunciante foi avisado por email.</Alert></div>}
      {sp.apagado && <div className="mb-4"><Alert tone="ok">Anúncio apagado.</Alert></div>}
      <div className="mb-4 flex flex-wrap gap-1.5" role="tablist">
        {TABS.map(([key, label]) => (
          <Link key={key || "all"} href={qs({ estado: key, pagina: undefined })} role="tab" aria-selected={status === key}
            className={`rounded-full border px-3 py-1.5 text-sm no-underline ${status === key ? "border-accent bg-accent text-white" : "border-line bg-surface text-ink"}`}>
            {label} <span className="tabular-nums opacity-75">{key ? counts[key] ?? 0 : Object.values(counts).reduce((a, b) => a + b, 0)}</span>
          </Link>
        ))}
      </div>
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/anuncios/">
        <input type="hidden" name="estado" value={status} />
        <input name="q" defaultValue={sp.q} placeholder="Título, ref., anunciante ou email" className="input max-w-sm" aria-label="Pesquisar" />
        <select name="categoria" defaultValue={sp.categoria ?? ""} className="input w-auto" aria-label="Categoria">
          <option value="">Todas as categorias</option>
          {tax.categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-ghost">Filtrar</button>
      </form>
      <Table head={["", "Anúncio", "Anunciante", "Estado", "Preço", "Visitas", status === "pending" ? "Enviado" : "Expira"]} empty="Nenhum anúncio neste estado.">
        {r.rows.map((l) => (
          <tr key={l.id}>
            <td className="w-16">
              <div className="h-12 w-16 overflow-hidden rounded bg-surface-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {l.imageKey && <img src={mediaUrl(l.imageKey, 400)} alt="" className="size-full object-cover" />}
              </div>
            </td>
            <td>
              <Link href={`/admin/anuncios/${l.id}/`} className="font-semibold text-accent">{l.title}</Link>
              <div className="text-xs text-muted">{l.category} · ref. {l.id}{l.reports > 0 && <span className="ml-1 font-semibold text-danger">· {l.reports} denúncia(s)</span>}{l.publishedAt && l.status === "pending" && " · edição de anúncio publicado"}</div>
            </td>
            <td><Link href={`/admin/utilizadores/${l.userId}/`} className="text-ink">{l.user}</Link></td>
            <td><StatusChip status={l.status} /></td>
            <td className="whitespace-nowrap"><Price price={l.price} priceType={l.priceType} priceUnit={l.priceUnit} /></td>
            <td className="tabular-nums">{l.views}</td>
            <td className="whitespace-nowrap text-muted">{status === "pending" ? relativeTime(l.updatedAt) : formatDate(l.expiresAt)}</td>
          </tr>
        ))}
      </Table>
      <Pager page={page} pages={r.pages} href={(p) => qs({ pagina: p })} />
    </>
  );
}
