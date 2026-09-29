import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BlogCta } from "@/components/blog-cta";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { TrackView } from "@/components/track-view";
import { getDraftKey, getPost, listPosts } from "@/lib/blog/microcms";
import { formatDate, resolveGoalId } from "@/lib/blog/utils";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl, ORGANIZATION_NAME, SITE_NAME } from "@/lib/site";
import { PreviewBanner } from "./preview-banner";

export async function generateStaticParams() {
  return (await listPosts()).map((post) => ({ slug: post.id }));
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const post = await getPost((await params).slug);
  if (!post) return {};
  const path = `/blog/${post.id}`;
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: path },
    openGraph: {
      type: "article",
      url: path,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.revisedAt ?? post.updatedAt,
      images: post.eyecatch ? [{ url: post.eyecatch.url, width: post.eyecatch.width, height: post.eyecatch.height }] : undefined,
    },
  };
}

export default async function BlogPostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const draftKey = await getDraftKey();
  const post = await getPost(slug, draftKey);
  if (!post) notFound();

  const [goals, others] = await Promise.all([loadGoals(), listPosts(10)]);
  const goalId = resolveGoalId(post.goal, goals);
  const goal = goals.find((g) => g.goal_id === goalId) ?? null;
  const related = others.filter((p) => p.id !== post.id).slice(0, 3);
  const published = formatDate(post.publishedAt);
  const revised = formatDate(post.revisedAt);
  const url = absoluteUrl(`/blog/${post.id}`);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: `/blog/${post.id}` }} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: post.title,
          description: post.description,
          image: post.eyecatch ? [post.eyecatch.url] : undefined,
          datePublished: post.publishedAt,
          dateModified: post.revisedAt ?? post.updatedAt,
          mainEntityOfPage: url,
          author: { "@type": "Organization", name: ORGANIZATION_NAME },
          publisher: { "@type": "Organization", name: ORGANIZATION_NAME },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: SITE_NAME, item: absoluteUrl("/") },
            { "@type": "ListItem", position: 2, name: "Blog", item: absoluteUrl("/blog") },
            { "@type": "ListItem", position: 3, name: post.title, item: url },
          ],
        }}
      />

      {draftKey && (
        <div className="mb-6">
          <PreviewBanner slug={post.id} />
        </div>
      )}

      <nav aria-label="パンくずリスト" className="text-xs text-muted">
        <Link href="/" className="hover:text-indigo">
          {SITE_NAME}
        </Link>
        <span className="mx-2">/</span>
        <Link href="/blog" className="hover:text-indigo">
          Blog
        </Link>
      </nav>

      <article className="mt-4">
        {post.category && <p className="text-sm font-bold text-sky">{post.category.name}</p>}
        <h1 className="mt-1 text-2xl leading-snug font-extrabold md:text-3xl">{post.title}</h1>
        <p className="mt-3 text-xs text-muted">
          {published && <time dateTime={post.publishedAt}>公開 {published}</time>}
          {revised && revised !== published && (
            <time dateTime={post.revisedAt} className="ml-3">
              更新 {revised}
            </time>
          )}
        </p>
        {post.eyecatch && (
          <Image
            src={post.eyecatch.url}
            alt=""
            width={post.eyecatch.width}
            height={post.eyecatch.height}
            sizes="(min-width: 768px) 720px, 100vw"
            preload
            className="mt-6 w-full rounded-2xl border border-line"
          />
        )}
        <div className="blog-content mt-8" dangerouslySetInnerHTML={{ __html: post.content }} />
      </article>

      <div className="mt-12">
        <BlogCta goal={goal} />
      </div>

      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-extrabold">ほかの記事</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-3">
            {related.map((p) => (
              <li key={p.id}>
                <PostCard post={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
