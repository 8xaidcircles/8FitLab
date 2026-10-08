import Link from "next/link";
import type { ReactNode } from "react";
import { BlogSidebar } from "@/components/blog-sidebar";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { TrackView } from "@/components/track-view";
import type { BlogPostSummary } from "@/lib/blog/types";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

// Blog（比較ページ）とカテゴリ別一覧の共通レイアウト（本文 + 新着記事・カテゴリのサイドバー）
export function BlogListing({
  path,
  kicker,
  title,
  description,
  posts,
  allPosts,
  categories,
  goalCategories,
  category,
  postsHeading,
  children,
}: {
  path: string;
  kicker: string;
  title: string;
  description: string;
  posts: BlogPostSummary[];
  allPosts: BlogPostSummary[];
  categories: { id: string; name: string; count: number }[];
  goalCategories: { id: string; name: string; count: number }[];
  category?: { id: string; name: string };
  /** 記事一覧の見出し（無ければ見出しなしで一覧だけ出す） */
  postsHeading?: string;
  /** 記事一覧の前に出すページ固有の本文 */
  children?: ReactNode;
}) {
  const breadcrumb = [
    { name: SITE_NAME, path: "/" },
    { name: "Blog", path: "/blog" },
    ...(category ? [{ name: category.name, path }] : []),
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path }} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumb.map((item, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: item.name,
            item: absoluteUrl(item.path),
          })),
        }}
      />

      <nav aria-label="パンくずリスト" className="text-xs text-muted">
        {breadcrumb.slice(0, -1).map((item) => (
          <span key={item.path}>
            <Link href={item.path} className="hover:text-indigo">
              {item.name}
            </Link>
            <span className="mx-2">/</span>
          </span>
        ))}
        <span>{breadcrumb.at(-1)?.name}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <header>
            <p className="text-sm font-bold tracking-widest text-sky">{kicker}</p>
            <h1 className="mt-1 text-2xl leading-snug font-extrabold md:text-3xl">{title}</h1>
            <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
          </header>

          {children}

          <section id="articles" className="mt-10 scroll-mt-6">
            {postsHeading && <h2 className="mb-5 border-l-4 border-indigo pl-3 text-xl font-extrabold">{postsHeading}</h2>}
            {posts.length > 0 ? (
              <ul className="grid grid-cols-2 gap-3 sm:gap-5">
                {posts.map((post) => (
                  <li key={post.id}>
                    <PostCard post={post} compact />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">記事は準備中です。</p>
            )}
          </section>
        </div>
        <BlogSidebar
          author={null}
          posts={allPosts}
          categories={categories}
          goalCategories={goalCategories}
          currentCategoryId={category?.id}
          navigationOnly
        />
      </div>
    </div>
  );
}
