import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { Alert } from "@/components/auth/form-bits";
import { CATEGORY_HUE, Chip, initials, Price } from "@/components/listings/bits";
import { ContactSeller, Gallery, PhoneReveal, ReportListing, ShareLinks } from "@/components/listings/detail-client";
import { ListingCard } from "@/components/listings/listing-card";
import { getCurrentUser } from "@/lib/auth/session";
import { formatDate, formatNumber, relativeTime } from "@/lib/format";
import { sanitizeListingHtml } from "@/lib/html";
import { toggleFavoriteAction } from "@/lib/listings/actions";
import { countView, getListingBySlug, PUBLIC_STATUSES, relatedListings, type ListingDetail } from "@/lib/listings/queries";
import { absoluteUrl } from "@/lib/site";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { redirectOrNotFound } from "@/lib/redirects";
import { excerpt } from "@/lib/text";
import { FIELD_SECTIONS } from "@/lib/listings/sections";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const isPublic = (d: ListingDetail) => (PUBLIC_STATUSES as readonly string[]).includes(d.listing.status);
const DAYS = [["mon", "Segunda-feira"], ["tue", "Terça-feira"], ["wed", "Quarta-feira"], ["thu", "Quinta-feira"], ["fri", "Sexta-feira"], ["sat", "Sábado"], ["sun", "Domingo"]] as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const d = await getListingBySlug((await params).slug);
  if (!d || !isPublic(d)) return { robots: { index: false } };
  const place = d.concelho ? `${d.concelho.name}, ${d.distrito.name}` : d.distrito.name;
  const description = excerpt(d.listing.description, 155);
  const image = d.images[0] ? absoluteUrl(mediaUrl(d.images[0].storageKey, 1600)) : undefined;
  return {
    title: `${d.listing.title} | ${d.type.name} em ${place}`,
    description,
    alternates: { canonical: `/listing/${d.listing.slug}/` },
    openGraph: { type: "article", title: d.listing.title, description, url: `/listing/${d.listing.slug}/`, images: image ? [{ url: image }] : undefined, locale: "pt_PT" },
  };
}

export default async function ListingPage({ params }: Props) {
  const { slug } = await params;
  const [d, user] = await Promise.all([getListingBySlug(slug), getCurrentUser()]);
  if (!d) return redirectOrNotFound(`/listing/${slug}/`);
  const l = d.listing;
  const isOwner = user?.id === l.userId;
  const isStaff = user?.role === "admin" || user?.role === "editor";
  if (!isPublic(d) && !isOwner && !isStaff) return redirectOrNotFound(`/listing/${slug}/`);

  // Conta a visita depois de responder (não atrasa a página); ignora robôs, o dono e a equipa.
  const ua = (await headers()).get("user-agent") ?? "";
  if (isPublic(d) && !isOwner && !isStaff && !/bot|crawl|spider|slurp|preview/i.test(ua)) after(() => countView(l.id));

  const [related, favorite] = await Promise.all([
    relatedListings(l.id, l.categoryId),
    user ? getDb().query.favorites.findFirst({ where: and(eq(schema.favorites.userId, user.id), eq(schema.favorites.listingId, l.id)) }) : null,
  ]);
  const place = d.concelho ? `${d.concelho.name}, ${d.distrito.name}` : d.distrito.name;
  const loginHref = `/my-account/?next=${encodeURIComponent(`/listing/${l.slug}/`)}`;
  const url = absoluteUrl(`/listing/${l.slug}/`);
  const renda = d.fields.find((f) => f.key === "renda-mensal");
  const urgent = d.fields.some((f) => f.key === "venda-urgente");
  const hours = l.businessHours;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: l.title,
    description: excerpt(l.description, 300),
    category: d.category.name,
    image: d.images.map((i) => absoluteUrl(mediaUrl(i.storageKey, 1600))),
    url,
    ...(l.price != null && l.priceType !== "on_call" && {
      offers: {
        "@type": "Offer",
        price: l.price,
        priceCurrency: "EUR",
        availability: l.status === "sold" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        areaServed: place,
        seller: { "@type": "Person", name: d.author.displayName },
      },
    }),
  };

  return (
    <div className="wrap py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      {!isPublic(d) && (
        <div className="mb-4">
          <Alert>
            {l.status === "pending" ? "Este anúncio aguarda aprovação: só tu e a equipa o vêem." : l.status === "expired" ? "Este anúncio expirou e já não está visível ao público." : `Estado: ${l.status}. Não está visível ao público.`}
          </Alert>
        </div>
      )}
      <nav className="mb-3 flex flex-wrap gap-1.5 text-sm text-muted" aria-label="Caminho">
        <Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span>
        <Link href="/all-ads/" className="text-muted">Anúncios</Link><span aria-hidden="true">›</span>
        <Link href={`/listing-category/${d.category.slug}/`} className="text-muted">{d.category.name}</Link>
      </nav>

      <div className="grid items-start gap-7 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-7">
          <header className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-1.5">
              <Chip tone="accent">{d.type.name}</Chip>
              {l.status === "sold" && <Chip>Vendido</Chip>}
              {urgent && <Chip tone="warn">Venda urgente</Chip>}
            </div>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{l.title}</h1>
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <Link href={`/listing-location/${d.distrito.slug}/${d.concelho ? `${d.concelho.slug}/` : ""}`} className="text-muted">{place}</Link>
              <span>Publicado {relativeTime(l.publishedAt)}</span>
              <span className="tabular-nums">{formatNumber(l.views)} visualizações</span>
              <span>Ref. {l.wpId ?? l.id}</span>
            </p>
          </header>

          <Gallery
            title={l.title}
            images={d.images.map((i) => ({ src: mediaUrl(i.storageKey, 1600), srcSet: mediaSrcSet(i.storageKey), thumb: mediaUrl(i.storageKey, 400), width: i.width, height: i.height }))}
            fallback={<div className="grid size-full place-items-center font-display text-6xl font-extrabold text-navy/30" style={{ background: CATEGORY_HUE[d.category.slug] }}>{initials(d.category.name)}</div>}
          />

          {/* No telemóvel a coluna lateral fica no fim: mostra já o preço e um atalho para o contacto. */}
          <div className="panel flex items-center justify-between gap-3 lg:hidden">
            <div className="flex flex-col">
              <Price price={l.price} priceType={l.priceType} priceUnit={l.priceUnit} />
              {renda && <span className="text-xs text-muted">renda {renda.display}/mês</span>}
            </div>
            <a href="#anunciante" className="btn-primary">Contactar</a>
          </div>

          {d.fields.length > 0 && (
            <section className="flex flex-col gap-4">
              <h2 className="text-2xl font-bold">Visão geral</h2>
              {FIELD_SECTIONS.map((s) => {
                const list = d.fields.filter((f) => (f.section ?? "funcionamento") === s.key);
                if (!list.length) return null;
                return (
                  <div key={s.key}>
                    <h3 className="mb-2 font-sans text-sm font-bold uppercase tracking-wider text-muted">{s.title}</h3>
                    <dl className="grid overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2" style={{ gap: 1 }}>
                      {list.map((f) => (
                        <div key={f.id} className="flex flex-col gap-0.5 bg-surface px-4 py-3">
                          <dt className="text-xs text-muted">{f.label}</dt>
                          <dd className="font-semibold">{f.display}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-2xl font-bold">Descrição</h2>
            <div className="prose-listing flex max-w-[70ch] flex-col gap-3" dangerouslySetInnerHTML={{ __html: sanitizeListingHtml(l.description) }} />
          </section>

          {l.features.length > 0 && (
            <section>
              <h2 className="mb-3 text-2xl font-bold">Características</h2>
              <ul className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
                {l.features.map((f, i) => (
                  <li key={i} className="flex gap-2.5 text-[15px]"><span className="mt-1.5 size-2 flex-none rotate-45 border-b-2 border-r-2 border-accent" aria-hidden="true" />{f}</li>
                ))}
              </ul>
            </section>
          )}

          {hours && (
            <section className="panel">
              <h2 className="mb-3 text-xl font-bold">Horário comercial</h2>
              <table className="w-full text-sm">
                <tbody>
                  {DAYS.map(([k, label]) => {
                    const h = hours[k];
                    return (
                      <tr key={k} className="border-b border-line last:border-0">
                        <th scope="row" className="py-2 text-left font-medium">{label}</th>
                        <td className="py-2 text-right tabular-nums">{h.mode === "closed" ? "Fechado" : h.mode === "24h" ? "Aberto 24 horas" : `${h.open} – ${h.close}`}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </section>
          )}
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <div className="panel flex flex-col gap-1">
            <span className="eyebrow">Valor {d.type.key === "aluguer_de_ativos" ? "do aluguer" : "do negócio"}</span>
            <Price price={l.price} priceType={l.priceType} priceUnit={l.priceUnit} size="lg" />
            <span className="text-sm text-muted">
              {l.priceType === "negotiable" ? "Negociável" : l.priceType === "fixed" ? "Preço fixo" : "Contacte o anunciante"}
              {renda && ` · renda ${renda.display}/mês`}
            </span>
          </div>

          <div id="anunciante" className="panel flex scroll-mt-20 flex-col gap-3">
            <h2 className="font-sans text-base font-bold">Anunciante</h2>
            <div className="flex items-center gap-3">
              <span className="grid size-11 flex-none place-items-center rounded-full bg-wash font-display font-extrabold text-accent">{initials(d.author.displayName)}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{d.author.displayName}</p>
                <p className="text-xs text-muted">No portal desde {formatDate(d.author.createdAt).replace(/^\d+ de /, "")}</p>
              </div>
            </div>
            {isPublic(d) && (
              <>
                <PhoneReveal listingId={l.id} loggedIn={Boolean(user)} loginHref={loginHref} />
                <ContactSeller listingId={l.id} loggedIn={Boolean(user)} loginHref={loginHref} defaults={{ name: user?.displayName ?? "", email: user?.email ?? "", phone: user?.phone ?? "" }} />
              </>
            )}
            {d.author.publicListings > 1 && (
              <Link href={`/all-ads/?anunciante=${d.author.id}`} className="text-sm text-accent">Ver os {d.author.publicListings} anúncios deste anunciante</Link>
            )}
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="listingId" value={l.id} />
              <input type="hidden" name="slug" value={l.slug} />
              <button className="btn-ghost w-full" aria-pressed={Boolean(favorite)}>{favorite ? "♥ Guardado nos favoritos" : "♡ Guardar nos favoritos"}</button>
            </form>
          </div>

          <div className="panel flex flex-col gap-3">
            <h2 className="font-sans text-base font-bold">Partilhar</h2>
            <ShareLinks url={url} title={l.title} />
            <ReportListing listingId={l.id} />
          </div>

          <div className="panel text-sm">
            <h2 className="mb-2 font-sans text-base font-bold">Dicas de segurança</h2>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Fale com o anunciante ao telefone antes de avançar.</li>
              <li>Visite o espaço e confirme a documentação (contrato de arrendamento, licenças).</li>
              <li>Recomendamos o apoio de um advogado no contrato de trespasse.</li>
            </ul>
            <Link href="/como-manter-me-seguro/" className="mt-2 inline-block text-accent">Como manter-me seguro</Link>
          </div>
        </aside>
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-bold">Anúncios semelhantes</h2>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">{related.map((r) => <ListingCard key={r.id} item={r} />)}</div>
        </section>
      )}
    </div>
  );
}
