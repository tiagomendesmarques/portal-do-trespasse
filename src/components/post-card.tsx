import Link from "next/link";
import { formatDate } from "@/lib/format";
import { mediaUrl } from "@/lib/media";

type Post = { slug: string; title: string; excerpt: string | null; featuredImageKey: string | null; publishedAt: Date | null };

export function PostCard({ post }: { post: Post }) {
  return (
    <Link href={`/${post.slug}/`} className="group flex flex-col overflow-hidden rounded-xl border border-line bg-surface text-ink no-underline hover:shadow-lg">
      {post.featuredImageKey && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={mediaUrl(post.featuredImageKey, 800)} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover" />
      )}
      <div className="flex flex-col gap-1.5 p-4">
        <span className="eyebrow tabular-nums">{formatDate(post.publishedAt)}</span>
        <h3 className="font-display text-lg font-bold leading-snug group-hover:text-accent">{post.title}</h3>
        {post.excerpt && <p className="line-clamp-3 text-sm text-muted">{post.excerpt}</p>}
      </div>
    </Link>
  );
}
