import Image from "next/image";
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog/types";

/** 本文中の「あわせて読みたい記事」カード（```related） */
export function BlogRelatedCard({ post }: { post: BlogPostSummary }) {
  return (
    <aside className="blog-related-card overflow-hidden rounded-2xl border border-line bg-white" aria-label="あわせて読みたい記事">
      <p className="border-b border-line bg-sky-soft px-4 py-2 text-xs font-bold tracking-wide text-indigo">あわせて読みたい記事</p>
      <Link href={`/blog/${post.id}`} className="group flex flex-col gap-3 p-4 transition hover:bg-mist sm:flex-row sm:items-start">
        {post.eyecatch ? (
          <Image
            src={post.eyecatch.url}
            alt=""
            width={240}
            height={126}
            sizes="(min-width: 640px) 240px, 100vw"
            className="aspect-[1.91/1] w-full shrink-0 rounded-lg object-cover sm:w-40"
          />
        ) : (
          <div className="bg-brand-gradient aspect-[1.91/1] w-full shrink-0 rounded-lg opacity-30 sm:w-40" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-extrabold leading-snug text-ink group-hover:text-indigo group-hover:underline sm:text-base">
            {post.title}
          </span>
          {post.description && (
            <span className="mt-2 line-clamp-3 block text-xs leading-relaxed text-muted sm:text-sm">{post.description}</span>
          )}
        </span>
      </Link>
    </aside>
  );
}
