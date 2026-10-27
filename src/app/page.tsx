import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { initials, CATEGORY_HUE } from "@/components/listings/bits";
import { ListingCard } from "@/components/listings/listing-card";
import { PostCard } from "@/components/post-card";
import { getCounts, getTaxonomies, latestListings } from "@/lib/listings/queries";
import { ROUTES } from "@/lib/site";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const [tax, counts, latest, posts] = await Promise.all([
    getTaxonomies(),
    getCounts(),
    latestListings(8),
    getDb().select().from(schema.posts).where(eq(schema.posts.status, "published")).orderBy(desc(schema.posts.publishedAt)).limit(3),
  ]);
  const concelhos = tax.distritos.reduce((a, d) => a + d.concelhos.length, 0);
  return (
    <>
      <section className="bg-navy text-[#eaf4f3]">
        <div className="wrap py-14">
          <p className="eyebrow text-brand">Trespasses, venda de empresas e investimento</p>
          <h1 className="mt-2 max-w-[20ch] text-4xl font-extrabold text-white sm:text-5xl">Encontre o próximo negócio para tomar conta</h1>
          <p className="mt-3 max-w-[56ch] text-lg opacity-85">Cafés, restaurantes, lojas, clínicas e empresas à venda em Portugal. Publicar o seu anúncio é gratuito.</p>
          <form action={ROUTES.listings} className="mt-7 grid max-w-[900px] gap-2 rounded-xl bg-surface p-2 text-ink shadow-lg md:grid-cols-[2fr_1fr_1fr_auto]">
            <input name="q" className="input border-transparent bg-surface-2" placeholder="O que procura? Ex.: café, cabeleireiro" aria-label="Pesquisa" />
            <select name="distrito" className="input border-transparent bg-surface-2" aria-label="Distrito" defaultValue="">
              <option value="">Todo o país</option>
              {tax.distritos.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}
            </select>
            <select name="categoria" className="input border-transparent bg-surface-2" aria-label="Categoria" defaultValue="">
              <option value="">Todas as categorias</option>
              {tax.categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <button className="btn-primary px-6">Procurar</button>
          </form>
          <dl className="mt-6 flex flex-wrap gap-8 text-sm">
            <div><dt className="sr-only">Anúncios</dt><dd><b className="block font-display text-2xl text-brand tabular-nums">{counts.total}</b>anúncios ativos</dd></div>
            <div><dt className="sr-only">Setores</dt><dd><b className="block font-display text-2xl text-brand">{tax.categories.length}</b>setores</dd></div>
            <div><dt className="sr-only">Localizações</dt><dd><b className="block font-display text-2xl text-brand tabular-nums">{concelhos}</b>concelhos, do continente às ilhas</dd></div>
          </dl>
        </div>
      </section>

      <section className="wrap py-10">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div><p className="eyebrow">Categorias</p><h2 className="text-2xl font-bold">Pesquise por setor</h2></div>
          <Link href="/all-ads/" className="text-accent">Ver todos os anúncios →</Link>
        </div>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2.5">
          {tax.categories.map((c) => {
            const n = counts.category.get(c.id) ?? 0;
            return (
              <Link key={c.id} href={`/listing-category/${c.slug}/`} className={`panel flex items-center gap-3 p-3 text-ink no-underline hover:border-accent ${n ? "" : "opacity-60"}`}>
                <span className="grid size-11 flex-none place-items-center rounded-lg font-display font-extrabold text-navy" style={{ background: CATEGORY_HUE[c.slug] }}>{initials(c.name)}</span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">{c.name}</span>
                  <span className="text-xs text-muted tabular-nums">{n === 1 ? "1 anúncio" : `${n} anúncios`}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {latest.length > 0 && (
        <section className="wrap pb-10">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><p className="eyebrow">Novidades</p><h2 className="text-2xl font-bold">Anúncios recentes</h2></div>
            <Link href="/all-ads/" className="text-accent">Ver todos →</Link>
          </div>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">{latest.map((i) => <ListingCard key={i.id} item={i} />)}</div>
        </section>
      )}

      <section className="wrap pb-10">
        <div className="grid items-center gap-4 rounded-2xl bg-wash p-6 sm:p-8 md:grid-cols-[minmax(0,1fr)_auto]">
          <div>
            <h2 className="text-2xl font-bold">Quer passar o seu negócio?</h2>
            <p className="mt-1 text-muted">Crie uma conta gratuita, descreva o negócio e publique em poucos minutos. Sem comissões.</p>
          </div>
          <Link href={ROUTES.post} className="btn-primary px-6 py-3 text-base">Publicar anúncio grátis</Link>
        </div>
      </section>

      {posts.length > 0 && (
        <section className="wrap pb-14">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <div><p className="eyebrow">Blog</p><h2 className="text-2xl font-bold">Artigos recentes</h2></div>
            <Link href="/blog/" className="text-accent">Ver o blog →</Link>
          </div>
          <div className="grid gap-4 md:grid-cols-3">{posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
        </section>
      )}
    </>
  );
}
