import Image from "next/image";
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog/types";
import { formatDate } from "@/lib/blog/utils";

export function PostCard({
  post,
  label,
  href = `/blog/${post.id}`,
}: {
  post: Pick<BlogPostSummary, "id" | "title" | "description" | "eyecatch" | "category" | "publishedAt">;
  /** カテゴリ名の代わりに出すラベル（おすすめの種別など） */
  label?: string;
  href?: string;
}) {
  const date = formatDate(post.publishedAt);
  const kicker = label ?? post.category?.name;
  return (
    <Link
      href={href}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md"
    >
      {post.eyecatch ? (
        <Image
          src={post.eyecatch.url}
          alt=""
          width={post.eyecatch.width}
          height={post.eyecatch.height}
          sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
          className="aspect-[1.91/1] w-full object-cover"
        />
      ) : (
        <div className="bg-brand-gradient aspect-[1.91/1] w-full opacity-30" />
      )}
      <div className="flex flex-1 flex-col p-5">
        {kicker && <p className="text-xs font-bold text-sky">{kicker}</p>}
        <p className="mt-1 font-bold leading-snug group-hover:text-indigo">{post.title}</p>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{post.description}</p>
        {date && <p className="mt-auto pt-3 text-xs text-muted">{date}</p>}
      </div>
    </Link>
  );
}
