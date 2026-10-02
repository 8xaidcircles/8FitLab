import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPosts } from "@/lib/blog/microcms";
import { collectCategories } from "@/lib/blog/utils";
import { BlogListing } from "../../blog-listing";

export async function generateStaticParams() {
  return collectCategories(await listPosts()).map((category) => ({ categoryId: category.id }));
}

async function findCategory(categoryId: string) {
  const posts = await listPosts();
  const categories = collectCategories(posts);
  return { posts, categories, category: categories.find((c) => c.id === categoryId) ?? null };
}

export async function generateMetadata({ params }: PageProps<"/blog/category/[categoryId]">): Promise<Metadata> {
  const { categoryId } = await params;
  const { category } = await findCategory(categoryId);
  if (!category) return {};
  return {
    title: `${category.name}の記事一覧`,
    description: `「${category.name}」に関する記事の一覧です。`,
    alternates: { canonical: `/blog/category/${category.id}` },
  };
}

export default async function BlogCategoryPage({ params }: PageProps<"/blog/category/[categoryId]">) {
  const { categoryId } = await params;
  const { posts, categories, category } = await findCategory(categoryId);
  if (!category) notFound();

  return (
    <BlogListing
      path={`/blog/category/${category.id}`}
      kicker="CATEGORY"
      title={`${category.name}の記事一覧`}
      description={`「${category.name}」に関する記事の一覧です。`}
      posts={posts.filter((post) => post.category?.id === category.id)}
      allPosts={posts}
      categories={categories}
      category={category}
    />
  );
}
