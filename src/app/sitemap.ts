import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog/microcms";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [goals, posts] = await Promise.all([loadGoals(), listPosts()]);
  return [
    { url: absoluteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/career-match"), changeFrequency: "monthly", priority: 0.9 },
    { url: absoluteUrl("/learning-path"), changeFrequency: "monthly", priority: 0.8 },
    ...goals.map((goal) => ({
      url: absoluteUrl(`/learning-path/${goal.goal_id}`),
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
    { url: absoluteUrl("/blog"), changeFrequency: "daily", priority: 0.7 },
    { url: absoluteUrl("/editorial-policy"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/disclaimer"), changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/contact"), changeFrequency: "yearly", priority: 0.2 },
    ...posts.map((post) => ({
      url: absoluteUrl(`/blog/${post.id}`),
      lastModified: post.revisedAt ?? post.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];
}
