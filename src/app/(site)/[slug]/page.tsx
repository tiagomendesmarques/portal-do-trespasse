import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/content/pages";
import { getPage, getPost } from "@/lib/content/queries";
import { formatDate } from "@/lib/format";
import { sanitizeContentHtml } from "@/lib/html";
import { mediaUrl } from "@/lib/media";
import { redirectOrNotFound } from "@/lib/redirects";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

/** Artigos do blog e páginas institucionais partilham /{slug}/, como no WordPress. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (post) {
    const image = post.featuredImageKey ? absoluteUrl(mediaUrl(post.featuredImageKey, 1600)) : undefined;
    return {
      title: post.seoTitle ?? post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined,
      alternates: { canonical: `/${post.slug}/` },
      openGraph: { type: "article", title: post.title, publishedTime: post.publishedAt?.toISOString(), images: image ? [{ url: image }] : undefined, locale: "pt_PT" },
    };
  }
  const page = await getPage(slug);
  if (page) return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined, alternates: { canonical: `/${page.slug}/` } };
  return {};
}

export default async function ContentPage({ params }: Props) {
  const { slug } = await params;
  const [post, page] = await Promise.all([getPost(slug), getPage(slug)]);

  if (post) {
    const jsonLd = {
      "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
      datePublished: post.publishedAt?.toISOString(), dateModified: post.updatedAt.toISOString(),
      image: post.featuredImageKey ? absoluteUrl(mediaUrl(post.featuredImageKey, 1600)) : undefined,
      author: { "@type": "Organization", name: SITE_NAME }, publisher: { "@type": "Organization", name: SITE_NAME },
      mainEntityOfPage: absoluteUrl(`/${post.slug}/`),
    };
    return (
      <div className="wrap grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
          <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><Link href="/blog/" className="text-muted">Blog</Link></nav>
          <p className="eyebrow tabular-nums">{formatDate(post.publishedAt)}</p>
          <h1 className="mt-1 max-w-[30ch] text-3xl font-extrabold sm:text-4xl">{post.title}</h1>
          {post.featuredImageKey && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl(post.featuredImageKey, 1600)} alt="" className="mt-6 aspect-[16/9] w-full rounded-xl object-cover" />
          )}
          <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(post.contentHtml) }} />
          {post.tags.length > 0 && <p className="mt-8 text-sm text-muted">Etiquetas: {post.tags.join(", ")}</p>}
        </article>
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <div className="panel flex flex-col gap-2">
            <h2 className="font-sans text-base font-bold">Quer passar o seu negócio?</h2>
            <p className="text-sm text-muted">Anunciar no Portal do Trespasse é gratuito.</p>
            <Link href="/post-an-ad/" className="btn-primary">Publicar anúncio</Link>
          </div>
          <div className="panel flex flex-col gap-2">
            <h2 className="font-sans text-base font-bold">À procura de um negócio?</h2>
            <Link href="/all-ads/" className="btn-ghost">Ver anúncios</Link>
          </div>
        </aside>
      </div>
    );
  }

  if (page) {
    const isFaq = page.slug === "faq";
    const faqLd = isFaq && {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
    };
    return (
      <div className="wrap grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />}
          <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><span>{page.title}</span></nav>
          <h1 className="text-3xl font-extrabold sm:text-4xl">{page.title}</h1>
          <div className={`prose-content mt-6 ${isFaq ? "prose-faq" : ""}`} dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(page.contentHtml) }} />
        </article>
        <aside className="panel flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
          <h2 className="font-sans text-base font-bold">Precisa de ajuda?</h2>
          <p className="text-sm text-muted">Escreva-nos ou veja as perguntas frequentes.</p>
          <Link href="/contact/" className="btn-ghost">Contactos</Link>
          {!isFaq && <Link href="/faq/" className="btn-ghost">Perguntas frequentes</Link>}
        </aside>
      </div>
    );
  }

  return redirectOrNotFound(`/${slug}/`);
}
