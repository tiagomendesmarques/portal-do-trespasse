import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { RejectForm } from "@/components/admin/reject-form";
import { ActionButton, AdminHeader, StatusChip } from "@/components/admin/ui";
import { Price } from "@/components/listings/bits";
import { approveListingAction, staffListingAction } from "@/lib/admin/listing-actions";
import { AUDIT_LABEL, auditFor } from "@/lib/admin/queries";
import { formatDate, formatNumber, relativeTime } from "@/lib/format";
import { sanitizeListingHtml } from "@/lib/html";
import { getListingBySlug } from "@/lib/listings/queries";
import { mediaUrl } from "@/lib/media";

export const metadata = { title: "Anúncio" };

export default async function AdminListing({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ editado?: string }> }) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const base = await getDb().query.listings.findFirst({ where: eq(schema.listings.id, Number(id)) });
  if (!base) notFound();
  const d = (await getListingBySlug(base.slug))!;
  const l = d.listing;
  const [history, reports, ownerStats] = await Promise.all([
    auditFor("listing", String(l.id)),
    getDb().select().from(schema.reports).where(and(eq(schema.reports.listingId, l.id), eq(schema.reports.status, "open"))),
    getDb().select({ n: sql<number>`count(*)::int` }).from(schema.listings).where(eq(schema.listings.userId, l.userId)),
  ]);
  const place = d.concelho ? `${d.concelho.name}, ${d.distrito.name}` : d.distrito.name;
  const act = (op: string, label: string, tone?: "primary" | "danger", confirm?: string) => (
    <ActionButton action={staffListingAction} fields={{ id: l.id, op }} label={label} tone={tone} confirm={confirm} />
  );
  const featured = l.featuredUntil && l.featuredUntil > new Date();

  return (
    <>
      <AdminHeader
        crumbs={[{ href: "/admin/anuncios/", label: "Anúncios" }]}
        title={l.title}
        intro={`Ref. ${l.id}${l.wpId ? ` (WordPress ${l.wpId})` : ""} · ${d.type.name} · ${d.category.name} · ${place}`}
        actions={<><StatusChip status={l.status} /><Link href={`/listing/${l.slug}/`} className="btn-ghost px-3 py-1.5 text-sm" target="_blank">Ver como o público</Link><Link href={`/post-an-ad/editar/${l.id}/`} className="btn-ghost px-3 py-1.5 text-sm">Editar</Link></>}
      />
      {sp.editado && <div className="mb-4"><Alert tone="ok">Alterações guardadas. O estado do anúncio não mudou e o anunciante não foi avisado.</Alert></div>}
      {reports.length > 0 && (
        <div className="mb-4"><Alert tone="error">{reports.length} denúncia(s) por resolver: {reports.map((r) => `“${r.reason}”`).join(" · ")} <Link href="/admin/denuncias/" className="underline">Tratar</Link></Alert></div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="panel flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
              <Price price={l.price} priceType={l.priceType} priceUnit={l.priceUnit} size="lg" />
              <span className="text-sm text-muted">{l.priceType === "negotiable" ? "Negociável" : l.priceType === "fixed" ? "Preço fixo" : ""}</span>
              <span className="text-sm text-muted">Telefone: {l.phone ?? "—"}</span>
            </div>
            {d.images.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
                {d.images.map((i, k) => (
                  <a key={i.id} href={mediaUrl(i.storageKey, 1600)} target="_blank" rel="noreferrer" className="relative block overflow-hidden rounded-lg">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaUrl(i.storageKey, 400)} alt={`Fotografia ${k + 1}`} className="aspect-[4/3] w-full object-cover" />
                    {k === 0 && <span className="absolute left-1 top-1 rounded bg-accent px-1.5 text-[11px] font-bold text-white">Capa</span>}
                  </a>
                ))}
              </div>
            ) : <p className="text-sm text-muted">Sem fotografias.</p>}
          </section>

          <section className="panel">
            <h2 className="mb-2 text-lg font-bold">Descrição</h2>
            <div className="prose-listing flex max-w-[70ch] flex-col gap-3" dangerouslySetInnerHTML={{ __html: sanitizeListingHtml(l.description) }} />
            {l.features.length > 0 && (
              <>
                <h3 className="mb-1 mt-4 font-sans font-bold">Características</h3>
                <ul className="list-disc pl-5 text-sm">{l.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
              </>
            )}
          </section>

          {d.fields.length > 0 && (
            <section className="panel">
              <h2 className="mb-2 text-lg font-bold">Campos</h2>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                {d.fields.map((f) => <div key={f.id}><dt className="text-muted">{f.label}</dt><dd className="font-semibold">{f.display}</dd></div>)}
              </dl>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 xl:sticky xl:top-6">
          {(l.status === "pending" || l.status === "rejected") && (
            <section className="panel flex flex-col gap-3 border-accent">
              <h2 className="text-lg font-bold">Moderação</h2>
              {l.publishedAt && <p className="text-sm text-muted">Edição de um anúncio que já esteve publicado.</p>}
              {l.status === "rejected" && l.rejectionReason && <p className="text-sm text-danger">Rejeitado: {l.rejectionReason}</p>}
              <form action={approveListingAction}>
                <input type="hidden" name="id" value={l.id} />
                <input type="hidden" name="next" value="queue" />
                <button className="btn-primary w-full">Aprovar e publicar</button>
              </form>
              {l.status === "pending" && (
                <details>
                  <summary className="btn-ghost w-full cursor-pointer list-none">Rejeitar…</summary>
                  <div className="mt-3"><RejectForm id={l.id} /></div>
                </details>
              )}
            </section>
          )}

          <section className="panel flex flex-col gap-2">
            <h2 className="text-lg font-bold">Ações</h2>
            <div className="flex flex-wrap gap-1.5">
              {["published", "sold"].includes(l.status) && act("unpublish", "Despublicar")}
              {l.status === "published" && act("sold", "Marcar vendido")}
              {["sold", "expired"].includes(l.status) && act("republish", "Voltar a publicar")}
              {["published", "expired"].includes(l.status) && act("extend", "Prolongar validade")}
              {l.status === "published" && (featured ? act("unfeature", "Retirar destaque") : act("feature", "Destacar 30 dias"))}
              {act("delete", "Apagar", "danger", "Apagar de vez o anúncio e as fotografias.")}
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-muted">Criado</dt><dd>{formatDate(l.createdAt)}</dd>
              <dt className="text-muted">Publicado</dt><dd>{formatDate(l.publishedAt) || "—"}</dd>
              <dt className="text-muted">Expira</dt><dd>{formatDate(l.expiresAt) || "—"}</dd>
              {featured && <><dt className="text-muted">Destaque até</dt><dd>{formatDate(l.featuredUntil)}</dd></>}
              <dt className="text-muted">Visitas</dt><dd className="tabular-nums">{formatNumber(l.views)}</dd>
              <dt className="text-muted">Viram o telefone</dt><dd className="tabular-nums">{l.phoneClicks}</dd>
            </dl>
          </section>

          <section className="panel flex flex-col gap-1 text-sm">
            <h2 className="mb-1 text-lg font-bold">Anunciante</h2>
            <Link href={`/admin/utilizadores/${d.author.id}/`} className="font-semibold text-accent">{d.author.displayName}</Link>
            <span className="text-muted">{d.author.email}</span>
            {d.author.phone && <span className="text-muted">{d.author.phone}</span>}
            <span className="text-muted">{ownerStats[0].n} anúncio(s) · no portal desde {formatDate(d.author.createdAt)}</span>
          </section>

          <section className="panel text-sm">
            <h2 className="mb-2 text-lg font-bold">Histórico</h2>
            {history.length === 0 && <p className="text-muted">Sem registos.</p>}
            <ol className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id}>
                  <b>{AUDIT_LABEL[h.action] ?? h.action}</b> · {h.actor ?? "sistema"} · <span className="text-muted">{relativeTime(h.createdAt)}</span>
                  {(h.data as { reason?: string } | null)?.reason && <p className="text-muted">“{(h.data as { reason: string }).reason}”</p>}
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </>
  );
}
