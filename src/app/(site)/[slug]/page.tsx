import type { Metadata } from "next";
import Link from "next/link";
import { FAQ } from "@/content/pages";
import { getPage, getPost } from "@/lib/content/queries";
import { formatDate } from "@/lib/format";
import { sanitizeContentHtml } from "@/lib/html";
import { postImage } from "@/lib/blog/images";
import { redirectOrNotFound } from "@/lib/redirects";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };

/** Artigos do blog e páginas institucionais partilham /{slug}/, como no WordPress. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPost(slug);
  if (post) {
    const img = postImage(post, 1600);
    const image = img ? (img.src.startsWith("/") ? absoluteUrl(img.src) : img.src) : undefined;
    const description = post.seoDescription ?? post.excerpt ?? undefined;
    return {
      title: post.seoTitle ?? post.title,
      description,
      keywords: [post.focusKeyword, ...post.secondaryKeywords].filter((k): k is string => Boolean(k)),
      alternates: { canonical: `/${post.slug}/` },
      openGraph: {
        type: "article", title: post.seoTitle ?? post.title, description, url: `/${post.slug}/`, siteName: SITE_NAME, locale: "pt_PT",
        publishedTime: post.publishedAt?.toISOString(), modifiedTime: post.updatedAt.toISOString(), tags: post.tags,
        images: image ? [{ url: image, alt: post.featuredImageAlt ?? post.title }] : undefined,
      },
      twitter: { card: image ? "summary_large_image" : "summary", title: post.seoTitle ?? post.title, description, images: image ? [image] : undefined },
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
    const img = postImage(post, 1600);
    const keywords = [post.focusKeyword, ...post.secondaryKeywords].filter(Boolean);
    const org = { "@type": "Organization", name: SITE_NAME, url: absoluteUrl("/"), logo: { "@type": "ImageObject", url: absoluteUrl("/icon2.png") } };
    const jsonLd = {
      "@context": "https://schema.org", "@type": "BlogPosting", headline: post.title,
      description: post.seoDescription ?? post.excerpt ?? undefined, inLanguage: "pt-PT",
      datePublished: post.publishedAt?.toISOString(), dateModified: post.updatedAt.toISOString(),
      image: img ? (img.src.startsWith("/") ? absoluteUrl(img.src) : img.src) : undefined,
      keywords: keywords.length ? keywords.join(", ") : undefined,
      author: { ...org, name: `Equipa ${SITE_NAME}` }, publisher: org,
      mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(`/${post.slug}/`) },
    };
    const faqLd = post.faq.length > 0 && {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: post.faq.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })),
    };
    return (
      <div className="wrap grid gap-10 py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="min-w-0">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
          {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd).replace(/</g, "\\u003c") }} />}
          <nav className="mb-2 flex gap-1.5 text-sm text-muted" aria-label="Caminho"><Link href="/" className="text-muted">Início</Link><span aria-hidden="true">›</span><Link href="/blog/" className="text-muted">Blog</Link></nav>
          <p className="eyebrow tabular-nums">{formatDate(post.publishedAt)}</p>
          <h1 className="mt-1 max-w-[30ch] text-3xl font-extrabold sm:text-4xl">{post.title}</h1>
          {img && (
            <figure className="mt-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} srcSet={img.srcSet} sizes="(min-width: 1024px) 760px, 100vw" alt={post.featuredImageAlt ?? ""} fetchPriority="high" className="aspect-[16/9] w-full rounded-xl object-cover" />
              {(post.featuredImageCaption || post.featuredImageCredit) && (
                <figcaption className="mt-2 text-sm text-muted">
                  {post.featuredImageCaption}
                  {post.featuredImageCaption && post.featuredImageCredit && " · "}
                  {post.featuredImageCredit && (post.featuredImageCreditUrl
                    ? <a href={post.featuredImageCreditUrl} target="_blank" rel="noopener nofollow" className="text-muted underline">{post.featuredImageCredit}</a>
                    : post.featuredImageCredit)}
                </figcaption>
              )}
            </figure>
          )}
          <div className="prose-content mt-6" dangerouslySetInnerHTML={{ __html: sanitizeContentHtml(post.contentHtml) }} />
          {post.faq.length > 0 && (
            <section className="mt-10" aria-labelledby="faq-artigo">
              <h2 id="faq-artigo" className="text-2xl font-extrabold">Perguntas frequentes</h2>
              <div className="mt-4 flex flex-col gap-2">
                {post.faq.map((f, i) => (
                  <details key={i} className="panel" open={i === 0}>
                    <summary className="cursor-pointer font-semibold">{f.question}</summary>
                    <p className="mt-2 whitespace-pre-line text-ink/90">{f.answer}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
          {post.sources.length > 0 && (
            <section className="mt-8 text-sm" aria-labelledby="fontes-artigo">
              <h2 id="fontes-artigo" className="font-sans text-base font-bold">Fontes</h2>
              <ul className="mt-2 list-disc pl-5 text-muted">
                {post.sources.map((f, i) => <li key={i}><a href={f.url} target="_blank" rel="noopener nofollow" className="text-accent">{f.title}</a></li>)}
              </ul>
            </section>
          )}
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
