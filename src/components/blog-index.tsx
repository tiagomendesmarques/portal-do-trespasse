import Link from "next/link";
import { notFound } from "next/navigation";
import { PostCard } from "@/components/post-card";
import { listPosts } from "@/lib/content/queries";

const pageHref = (n: number) => (n === 1 ? "/blog/" : `/blog/page/${n}/`);

export async function BlogIndex({ page }: { page: number }) {
  const r = await listPosts(page);
  if (page > r.pages) notFound();
  const window = Array.from({ length: r.pages }, (_, i) => i + 1).filter((n) => n === 1 || n === r.pages || Math.abs(n - r.page) <= 2);
  return (
    <div className="wrap py-8">
      <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><span>Blog</span></nav>
      <h1 className="text-3xl font-extrabold sm:text-4xl">Blog</h1>
      <p className="mt-2 max-w-[65ch] text-muted">Guias sobre trespasses, venda de empresas e empreendedorismo em Portugal.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{r.posts.map((p) => <PostCard key={p.id} post={p} />)}</div>
      {r.pages > 1 && (
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-1.5" aria-label="Páginas">
          {r.page > 1 && <Link href={pageHref(r.page - 1)} className="btn-ghost px-3 py-2 text-sm">Anterior</Link>}
          {window.map((n, i) => (
            <span key={n} className="flex items-center gap-1.5">
              {i > 0 && n - window[i - 1] > 1 && <span className="text-muted">…</span>}
              <Link href={pageHref(n)} aria-current={n === r.page ? "page" : undefined}
                className={`grid min-w-10 place-items-center rounded-md border px-3 py-2 text-sm no-underline tabular-nums ${n === r.page ? "border-accent bg-accent text-white" : "border-line text-ink"}`}>{n}</Link>
            </span>
          ))}
          {r.page < r.pages && <Link href={pageHref(r.page + 1)} className="btn-ghost px-3 py-2 text-sm">Seguinte</Link>}
        </nav>
      )}
    </div>
  );
}
