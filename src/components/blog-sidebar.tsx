import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthorProfile } from "@/components/author-box";
import type { BlogAuthor, BlogPostSummary } from "@/lib/blog/types";
import { formatDate } from "@/lib/blog/utils";

const LATEST_COUNT = 5;

function Widget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="border-b border-line pb-2 text-sm font-extrabold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function BlogSidebar({
  author,
  posts,
  categories,
  currentPostId,
  currentCategoryId,
  navigationOnly = false,
}: {
  author: BlogAuthor | null;
  posts: BlogPostSummary[];
  categories: { id: string; name: string; count: number }[];
  currentPostId?: string;
  currentCategoryId?: string;
  /** 一覧・比較ページ用：Goal Fit のボックスリンク・新着記事・カテゴリだけを出す */
  navigationOnly?: boolean;
}) {
  const latest = posts.filter((p) => p.id !== currentPostId).slice(0, LATEST_COUNT);

  return (
    <aside className="space-y-6" aria-label="サイドバー">
      {navigationOnly && (
        <Widget title="Goal Fit">
          <Link
            href="/goal-fit"
            className="group relative mx-auto flex aspect-square w-full max-w-80 flex-col items-center justify-center overflow-hidden rounded-xl bg-ink px-4 py-6 text-center break-keep text-white transition hover:brightness-110"
          >
            <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1.5" />
            <p className="text-xs font-bold tracking-wider text-sky">{"\\ 無料でロードマップ診断 /"}</p>
            <p className="mt-3 text-lg leading-snug font-extrabold">
              目標職種への
              <br />
              最短ルートがわかる
            </p>
            <p className="mt-3 text-xs leading-relaxed text-white/80">
              不足スキルの学習順序と、
              <wbr />
              あなたに最適な
              <wbr />
              スクール・転職サービスを提案
            </p>
            <span className="mt-5 rounded-full bg-flame px-7 py-2.5 text-sm font-bold shadow-lg shadow-flame/30 transition group-hover:brightness-95">
              今すぐ無料診断
            </span>
          </Link>
          <p className="mt-2 text-center text-xs text-muted">【無料】Goal Fit 診断</p>
        </Widget>
      )}

      {!navigationOnly && author && <AuthorProfile author={author} compact />}

      {!navigationOnly && (
      <section className="relative overflow-hidden rounded-2xl bg-ink p-5 text-white">
        <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
        <p className="text-xs font-bold tracking-widest text-sky">GOAL FIT</p>
        <p className="mt-2 font-extrabold leading-snug">目指す職種との一致度を、無料で診断</p>
        <p className="mt-2 text-xs leading-relaxed text-white/80">スキル・経験・学歴から、Goalとの距離と学ぶ順番がわかります。</p>
        <Link
          href="/goal-fit"
          className="mt-4 block rounded-full bg-white px-4 py-2.5 text-center text-sm font-bold text-indigo transition hover:bg-sky-soft"
        >
          無料でGoal Fitを試す
        </Link>
      </section>
      )}

      {latest.length > 0 && (
        <Widget title="新着記事">
          <ul className="space-y-4">
            {latest.map((post) => (
              <li key={post.id}>
                <Link href={`/blog/${post.id}`} className="group flex gap-3">
                  {post.eyecatch ? (
                    <Image
                      src={post.eyecatch.url}
                      alt=""
                      width={96}
                      height={50}
                      sizes="96px"
                      className="aspect-[1.91/1] w-24 shrink-0 rounded-lg border border-line object-cover"
                    />
                  ) : (
                    <div className="bg-brand-gradient aspect-[1.91/1] w-24 shrink-0 rounded-lg opacity-30" />
                  )}
                  <div className="min-w-0">
                    <p className="line-clamp-3 text-sm leading-snug font-bold group-hover:text-indigo">{post.title}</p>
                    {post.publishedAt && <p className="mt-1 text-xs text-muted">{formatDate(post.publishedAt)}</p>}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Widget>
      )}

      {categories.length > 0 && (
        <Widget title="カテゴリ">
          <ul className="space-y-1 text-sm">
            {categories.map((category) => (
              <li key={category.id}>
                <Link
                  href={`/blog/category/${category.id}`}
                  aria-current={category.id === currentCategoryId ? "page" : undefined}
                  className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-sky-soft hover:text-indigo aria-[current=page]:bg-indigo-soft aria-[current=page]:font-bold aria-[current=page]:text-indigo"
                >
                  {category.name}
                  <span className="text-xs text-muted">{category.count}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Widget>
      )}
    </aside>
  );
}
