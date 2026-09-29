import type { Metadata } from "next";
import { BlogCta } from "@/components/blog-cta";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { TrackView } from "@/components/track-view";
import { listPosts } from "@/lib/blog/microcms";
import { absoluteUrl, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Blog",
  description: "エンジニアのキャリアチェンジ、必要なスキル、学習順について、Goalから逆算する視点で解説します。",
  alternates: { canonical: "/blog" },
};

export default async function BlogIndex() {
  const posts = await listPosts();

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/blog" }} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
          ],
        }}
      />

      <p className="text-sm font-bold text-sky">Blog</p>
      <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">Goalから逆算するキャリアの話</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        エンジニアのキャリアチェンジ、必要なスキル、学ぶ順番について解説します。
      </p>

      {posts.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 rounded-2xl border border-dashed border-line bg-white p-8 text-center text-sm text-muted">
          記事は準備中です。
        </p>
      )}

      <div className="mt-12">
        <BlogCta />
      </div>
    </div>
  );
}
