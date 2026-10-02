import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthorProfile, AuthorSummary } from "@/components/author-box";
import { BlogCta } from "@/components/blog-cta";
import { BlogCtaButton } from "@/components/blog-cta-button";
import { BlogSidebar } from "@/components/blog-sidebar";
import { BlogToc } from "@/components/blog-toc";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { ShareLinks } from "@/components/share-links";
import { TrackView } from "@/components/track-view";
import { normalizeBodyBlocks } from "@/lib/blog/body-blocks";
import { getDraftKey, getPost, listAuthors, listPosts } from "@/lib/blog/microcms";
import { buildToc } from "@/lib/blog/toc";
import { collectCategories, formatDate, resolveGoalId } from "@/lib/blog/utils";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl, ORGANIZATION_NAME, SITE_NAME } from "@/lib/site";
import { PreviewBanner } from "./preview-banner";

const RELATED_COUNT = 4;

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
    authors: post.author ? [{ name: post.author.name }] : undefined,
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

  const [goals, allPosts, authors] = await Promise.all([loadGoals(), listPosts(), listAuthors()]);
  const goalId = resolveGoalId(post.goal, goals);
  const goal = goals.find((g) => g.goal_id === goalId) ?? null;
  const author = post.author ?? null;
  const others = allPosts.filter((p) => p.id !== post.id);
  const related = [
    ...others.filter((p) => post.category && p.category?.id === post.category.id),
    ...others.filter((p) => !post.category || p.category?.id !== post.category.id),
  ].slice(0, RELATED_COUNT);
  const published = formatDate(post.publishedAt);
  const revised = formatDate(post.revisedAt);
  const url = absoluteUrl(`/blog/${post.id}`);

  const content = post.content ? buildToc(post.content, "toc-content") : null;
  const blocks = normalizeBodyBlocks(post.body).map((block, i) =>
    block.kind === "rich_text" ? { ...block, ...buildToc(block.html, `toc-${i + 1}`) } : block,
  );
  const tocItems = [...(content?.items ?? []), ...blocks.flatMap((block) => (block.kind === "rich_text" ? block.items : []))];
  const ctaIndexes = blocks.map((_, i) => blocks.slice(0, i).filter((b) => b.kind === "cta_button").length);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
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
          author: author
            ? { "@type": "Person", name: author.name, ...(author.role && { jobTitle: author.role }) }
            : { "@type": "Organization", name: ORGANIZATION_NAME },
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
            ...(post.category
              ? [{ "@type": "ListItem", position: 3, name: post.category.name, item: absoluteUrl(`/blog/category/${post.category.id}`) }]
              : []),
            { "@type": "ListItem", position: post.category ? 4 : 3, name: post.title, item: url },
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
        {post.category && (
          <>
            <span className="mx-2">/</span>
            <Link href={`/blog/category/${post.category.id}`} className="hover:text-indigo">
              {post.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <article>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
              {post.category && (
                <Link href={`/blog/category/${post.category.id}`} className="font-bold text-sky hover:text-indigo">
                  {post.category.name}
                </Link>
              )}
              {published && <time dateTime={post.publishedAt}>公開 {published}</time>}
              {revised && revised !== published && <time dateTime={post.revisedAt}>更新 {revised}</time>}
            </p>
            <h1 className="mt-2 text-2xl leading-snug font-extrabold md:text-3xl">{post.title}</h1>
            {post.description && <p className="mt-3 text-sm leading-relaxed text-muted">{post.description}</p>}

            {author && (
              <div className="mt-6">
                <AuthorSummary author={author} />
              </div>
            )}

            {post.eyecatch && (
              <Image
                src={post.eyecatch.url}
                alt=""
                width={post.eyecatch.width}
                height={post.eyecatch.height}
                sizes="(min-width: 1024px) 760px, 100vw"
                preload
                className="mt-6 w-full rounded-2xl border border-line"
              />
            )}

            <div className="mt-8">
              <BlogToc items={tocItems} />
            </div>

            <div className="mt-8 space-y-8">
              {content && <div className="blog-content" dangerouslySetInnerHTML={{ __html: content.html }} />}
              {blocks.map((block, i) =>
                block.kind === "rich_text" ? (
                  <div key={i} className="blog-content" dangerouslySetInnerHTML={{ __html: block.html }} />
                ) : (
                  <BlogCtaButton key={i} block={block} articleId={post.id} positionIndex={ctaIndexes[i]} />
                ),
              )}
            </div>
          </article>

          <div className="mt-10 border-t border-line pt-6">
            <ShareLinks url={url} title={post.title} />
          </div>

          <div className="mt-10">
            <BlogCta goal={goal} />
          </div>

          {author && (
            <div className="mt-10">
              <AuthorProfile author={author} />
            </div>
          )}

          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="text-lg font-extrabold">関連記事</h2>
              <ul className="mt-4 grid gap-5 sm:grid-cols-2">
                {related.map((p) => (
                  <li key={p.id}>
                    <PostCard post={p} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        <BlogSidebar
          author={author ?? authors[0] ?? null}
          posts={allPosts}
          categories={collectCategories(allPosts)}
          currentPostId={post.id}
          currentCategoryId={post.category?.id}
        />
      </div>
    </div>
  );
}
