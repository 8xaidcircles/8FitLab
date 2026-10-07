import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog/microcms";
import { collectCategories, collectGoalCategories } from "@/lib/blog/utils";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, goals] = await Promise.all([listPosts(), loadGoals()]);
  // 記事の無いカテゴリは noindex のため載せない
  const categoryIds = new Set(
    [...collectGoalCategories(posts, goals), ...collectCategories(posts)].filter((c) => c.count > 0).map((c) => c.id),
  );
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/goal-fit"), changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/blog"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/disclaimer"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy-policy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/cookie-policy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.2 },
    ...[...categoryIds].map((id) => ({
      url: absoluteUrl(`/blog/category/${id}`),
      changeFrequency: "weekly" as const,
      priority: 0.5,
    })),
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.id}`),
      lastModified: post.revisedAt ?? post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
