import Link from "next/link";
import { asc, isNull } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { ROUTES } from "@/lib/site";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const db = getDb();
  const [cats, distritos] = await Promise.all([
    db.select().from(schema.categories).orderBy(asc(schema.categories.sort)),
    db.select().from(schema.locations).where(isNull(schema.locations.parentId)).orderBy(asc(schema.locations.sort)),
  ]);
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
              {distritos.map((d) => <option key={d.id} value={d.slug}>{d.name}</option>)}
            </select>
            <select name="categoria" className="input border-transparent bg-surface-2" aria-label="Categoria" defaultValue="">
              <option value="">Todas as categorias</option>
              {cats.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
            <button className="btn-primary px-6">Procurar</button>
          </form>
        </div>
      </section>
      <section className="wrap py-10">
        <p className="eyebrow">Categorias</p>
        <h2 className="mb-4 text-2xl font-bold">Pesquise por setor</h2>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2.5">
          {cats.map((c) => (
            <Link key={c.id} href={`/listing-category/${c.slug}/`} className="panel flex items-center gap-3 p-3 font-semibold text-ink no-underline hover:border-accent">
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
