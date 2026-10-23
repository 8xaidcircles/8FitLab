import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { listPosts } from "@/lib/blog/content";
import { categoryRobots, collectCategories, collectGoalCategories, isInGoalCategory } from "@/lib/blog/utils";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl } from "@/lib/site";
import { BlogListing } from "../../blog-listing";

async function loadCategories() {
  const [posts, goals] = await Promise.all([listPosts(), loadGoals()]);
  return { posts, goals, categories: collectCategories(posts), goalCategories: collectGoalCategories(posts, goals) };
}

export const dynamicParams = false;

export async function generateStaticParams() {
  const { categories, goalCategories } = await loadCategories();
  const ids = new Set([...goalCategories, ...categories].map((category) => category.id));
  return [...ids].map((categoryId) => ({ categoryId }));
}

// 職種カテゴリ（goal_id）を categories.yml のカテゴリより優先する
async function findCategory(categoryId: string) {
  const { posts, goals, categories, goalCategories } = await loadCategories();
  const goal = goals.find((g) => g.goal_id === categoryId);
  if (goal) {
    return {
      posts,
      categories,
      goalCategories,
      category: { id: goal.goal_id, name: goal.name },
      description: `${goal.name}を目指す人向けの記事の一覧です。必要なスキルや学び方、スクール・転職サービスの選び方をまとめています。`,
      categoryPosts: posts.filter((post) => isInGoalCategory(post, goal)),
    };
  }
  const category = categories.find((c) => c.id === categoryId);
  if (!category) return null;
  return {
    posts,
    categories,
    goalCategories,
    category,
    description: `「${category.name}」に関する記事の一覧です。`,
    categoryPosts: posts.filter((post) => post.category?.id === category.id),
  };
}

export async function generateMetadata({ params }: PageProps<"/blog/category/[categoryId]">): Promise<Metadata> {
  const { categoryId } = await params;
  const found = await findCategory(categoryId);
  if (!found) return {};
  const { category, description, categoryPosts } = found;
  const path = `/blog/category/${category.id}`;
  return {
    title: `${category.name}の記事一覧`,
    description,
    alternates: { canonical: path },
    openGraph: { url: absoluteUrl(path) },
    robots: categoryRobots(categoryPosts.length),
  };
}

export default async function BlogCategoryPage({ params }: PageProps<"/blog/category/[categoryId]">) {
  const { categoryId } = await params;
  const found = await findCategory(categoryId);
  if (!found) notFound();
  const { posts, categories, goalCategories, category, description, categoryPosts } = found;

  return (
    <BlogListing
      path={`/blog/category/${category.id}`}
      kicker="CATEGORY"
      title={`${category.name}の記事一覧`}
      description={description}
      posts={categoryPosts}
      allPosts={posts}
      categories={categories}
      goalCategories={goalCategories}
      category={category}
    />
  );
}
