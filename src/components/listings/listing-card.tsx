import Link from "next/link";
import { relativeTime } from "@/lib/format";
import type { ListingCard as Card } from "@/lib/listings/queries";
import { mediaSrcSet, mediaUrl } from "@/lib/media";
import { CATEGORY_HUE, Chip, initials, Price } from "./bits";

const TYPE_NAME: Record<string, string> = { trespasse: "Trespasse", venda_de_ativos: "Venda de Ativos", aluguer_de_ativos: "Aluguer de Ativos", investimentos: "Investimentos" };

function Photo({ item, sizes, className = "" }: { item: Card; sizes: string; className?: string }) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: CATEGORY_HUE[item.categorySlug] ?? "#89d3cd" }}>
      {item.imageKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(item.imageKey, 800)} srcSet={mediaSrcSet(item.imageKey)} sizes={sizes} alt="" loading="lazy" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span className="absolute inset-0 grid place-items-center font-display text-4xl font-extrabold text-navy/30">{initials(item.categoryName)}</span>
      )}
      <span className="absolute bottom-2 right-2 rounded-full bg-navy/75 px-2 py-0.5 text-[11px] text-white">
        {item.imageCount ? `${item.imageCount} ${item.imageCount === 1 ? "foto" : "fotos"}` : "sem fotos"}
      </span>
    </div>
  );
}

function Badges({ item }: { item: Card }) {
  return (
    <>
      {item.status === "sold" && <Chip>Vendido</Chip>}
      {item.urgent && <Chip tone="warn">Venda urgente</Chip>}
      {item.isNew && <Chip tone="ok">Novo</Chip>}
      {item.isFeatured && <Chip tone="accent">Destaque</Chip>}
    </>
  );
}

export function ListingCard({ item }: { item: Card }) {
  return (
    <Link href={`/listing/${item.slug}/`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink no-underline transition hover:shadow-lg">
      <Photo item={item} sizes="(max-width: 640px) 100vw, 300px" className="aspect-[4/3]" />
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="eyebrow">{item.categoryName}</span>
        <h3 className="font-sans text-base font-bold leading-snug group-hover:text-accent">{item.title}</h3>
        <span className="text-xs text-muted">{item.place} · {relativeTime(item.publishedAt)}</span>
        <div className="flex flex-wrap gap-1"><Badges item={item} /></div>
        <div className="mt-auto flex items-end justify-between gap-2 border-t border-line pt-2.5">
          <Price price={item.price} priceType={item.priceType} priceUnit={item.priceUnit} />
          <Chip tone="accent">{TYPE_NAME[item.typeKey] ?? item.typeKey}</Chip>
        </div>
      </div>
    </Link>
  );
}

export function ListingRow({ item }: { item: Card }) {
  return (
    <article className="grid overflow-hidden rounded-xl border border-line bg-surface md:grid-cols-[220px_minmax(0,1fr)_190px]">
      <Link href={`/listing/${item.slug}/`} tabIndex={-1} aria-hidden="true">
        <Photo item={item} sizes="(max-width: 768px) 100vw, 220px" className="aspect-video h-full md:aspect-auto md:min-h-[160px]" />
      </Link>
      <div className="flex min-w-0 flex-col gap-1.5 p-4">
        <span className="eyebrow">{item.categoryName}</span>
        <h3 className="font-sans text-lg font-bold leading-snug">
          <Link href={`/listing/${item.slug}/`} className="text-ink no-underline hover:text-accent">{item.title}</Link>
        </h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
          <span>{relativeTime(item.publishedAt)}</span>
          <span>{item.place}</span>
          <span className="tabular-nums">{item.views} visualizações</span>
          <span>{item.authorName}</span>
        </div>
        <p className="line-clamp-2 text-sm text-muted">{item.excerpt}</p>
        <div className="flex flex-wrap gap-1"><Badges item={item} /></div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line p-4 md:flex-col md:items-start md:border-t-0 md:border-l">
        <Chip tone="accent">{TYPE_NAME[item.typeKey] ?? item.typeKey}</Chip>
        <div className="flex flex-col">
          <Price price={item.price} priceType={item.priceType} priceUnit={item.priceUnit} />
          {item.priceType === "negotiable" && <span className="text-xs text-muted">Negociável</span>}
        </div>
        <Link href={`/listing/${item.slug}/`} className="btn-ghost px-3 py-1.5 text-sm">Ver detalhes</Link>
      </div>
    </article>
  );
}
