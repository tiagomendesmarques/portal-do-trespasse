import Link from "next/link";
import { formatDate } from "@/lib/format";
import { postImage } from "@/lib/blog/images";

type Post = { slug: string; title: string; excerpt: string | null; featuredImageKey: string | null; featuredImageUrl: string | null; featuredImageAlt: string | null; publishedAt: Date | null };

export function PostCard({ post }: { post: Post }) {
  const img = postImage(post, 800);
  return (
    <Link href={`/${post.slug}/`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink no-underline hover:shadow-lg">
      {img && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={img.src} srcSet={img.srcSet} sizes="(min-width: 1024px) 380px, (min-width: 640px) 50vw, 100vw" alt={post.featuredImageAlt ?? ""} loading="lazy" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-col gap-1.5 p-4">
        <span className="eyebrow tabular-nums">{formatDate(post.publishedAt)}</span>
        <h3 className="font-display text-lg font-bold leading-snug group-hover:text-accent">{post.title}</h3>
        {post.excerpt && <p className="line-clamp-3 text-sm text-muted">{post.excerpt}</p>}
      </div>
    </Link>
  );
}
