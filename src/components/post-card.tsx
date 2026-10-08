import Image from "next/image";
import Link from "next/link";
import type { BlogPostSummary } from "@/lib/blog/types";
import { formatDate } from "@/lib/blog/utils";

export function PostCard({
  post,
  label,
  href = `/blog/${post.id}`,
  compact = false,
  headingLevel = "h2",
}: {
  post: Pick<BlogPostSummary, "id" | "title" | "description" | "eyecatch" | "category" | "publishedAt">;
  /** カテゴリ名の代わりに出すラベル（おすすめの種別など）。カテゴリページへのリンクにはしない */
  label?: string;
  href?: string;
  /** スマホでも 2 列に並べる一覧用（余白・文字を小さくし、狭い画面では説明文を省く） */
  compact?: boolean;
  /** 一覧の見出し（h2）の下に並べるときは h3 にする */
  headingLevel?: "h2" | "h3";
}) {
  const date = formatDate(post.publishedAt);
  const Heading = headingLevel;
  const kickerClass = `font-bold text-sky ${compact ? "text-[10px] sm:text-xs" : "text-xs"}`;
  // カード全体をクリックできるよう、タイトルのリンクをカード全面に広げる。カテゴリのリンクはその上に重ねる（リンクの入れ子を避ける）
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-white transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md">
      {post.eyecatch ? (
        <Image
          src={post.eyecatch.url}
          alt={post.title}
          width={post.eyecatch.width}
          height={post.eyecatch.height}
          sizes={compact ? "(min-width: 1024px) 320px, 50vw" : "(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"}
          className="aspect-[1.91/1] w-full object-cover"
        />
      ) : (
        <div className="bg-brand-gradient aspect-[1.91/1] w-full opacity-30" />
      )}
      <div className={`flex flex-1 flex-col ${compact ? "p-3 sm:p-5" : "p-5"}`}>
        {label ? (
          <p className={kickerClass}>{label}</p>
        ) : (
          post.category && (
            <Link href={`/blog/category/${post.category.id}`} className={`relative z-10 self-start hover:underline ${kickerClass}`}>
              {post.category.name}
            </Link>
          )
        )}
        <Heading className={`mt-1 font-bold leading-snug group-hover:text-indigo ${compact ? "line-clamp-3 text-sm sm:text-base" : ""}`}>
          <Link href={href} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </Heading>
        <p className={`mt-2 line-clamp-2 text-xs leading-relaxed text-muted ${compact ? "hidden sm:block" : ""}`}>{post.description}</p>
        {date && <p className={`mt-auto pt-3 text-muted ${compact ? "text-[10px] sm:text-xs" : "text-xs"}`}>{date}</p>}
      </div>
    </article>
  );
}
