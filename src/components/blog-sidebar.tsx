import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AuthorProfile } from "@/components/author-box";
import type { BlogAuthor, BlogPostSummary } from "@/lib/blog/types";
const LATEST_COUNT = 6;

type CategoryLink = { id: string; name: string; count: number };

function Widget({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <h2 className="border-b border-line pb-2 text-sm font-extrabold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function CategoryList({ categories, currentCategoryId }: { categories: CategoryLink[]; currentCategoryId?: string }) {
  return (
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
  );
}

export function BlogSidebar({
  author,
  posts,
  categories,
  goalCategories,
  currentPostId,
  currentCategoryId,
  navigationOnly = false,
}: {
  author: BlogAuthor | null;
  posts: BlogPostSummary[];
  categories: CategoryLink[];
  /** 職種カテゴリ（goal_id）。microCMS のカテゴリに同じ ID があれば、こちらにだけ出す */
  goalCategories: CategoryLink[];
  currentPostId?: string;
  currentCategoryId?: string;
  /** 一覧・比較ページ用：Goal Fit のボックスリンク・最新の記事・カテゴリだけを出す */
  navigationOnly?: boolean;
}) {
  const latest = posts.filter((p) => p.id !== currentPostId).slice(0, LATEST_COUNT);
  const goalCategoryIds = new Set(goalCategories.map((c) => c.id));
  const otherCategories = categories.filter((c) => !goalCategoryIds.has(c.id));

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
        <Widget title="最新の記事">
          <ol className="space-y-4">
            {latest.map((post, i) => (
              <li key={post.id}>
                <Link href={`/blog/${post.id}`} className="group flex items-start gap-3">
                  {post.eyecatch ? (
                    <Image
                      src={post.eyecatch.url}
                      alt=""
                      width={80}
                      height={42}
                      sizes="80px"
                      className="aspect-[1.91/1] w-20 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <div className="bg-brand-gradient aspect-[1.91/1] w-20 shrink-0 rounded-md opacity-30" />
                  )}
                  <span aria-hidden className="w-4 shrink-0 text-center text-base leading-snug font-bold text-sky">
                    {i + 1}
                  </span>
                  <span className="line-clamp-3 min-w-0 text-[13px] leading-snug group-hover:text-indigo group-hover:underline">
                    {post.title}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </Widget>
      )}

      {goalCategories.length > 0 && (
        <Widget title="職種別カテゴリ">
          <CategoryList categories={goalCategories} currentCategoryId={currentCategoryId} />
        </Widget>
      )}

      {otherCategories.length > 0 && (
        <Widget title="カテゴリ">
          <CategoryList categories={otherCategories} currentCategoryId={currentCategoryId} />
        </Widget>
      )}
    </aside>
  );
}
