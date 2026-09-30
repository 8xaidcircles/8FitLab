import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { cookies, draftMode } from "next/headers";
import type { RawRecommendationArticle } from "@/lib/career-match/recommendations";
import type { BlogPost, BlogPostSummary, ListResponse } from "./types";
import { isValidSlug } from "./utils";

export const BLOG_CACHE_TAG = "microcms";
export const DRAFT_KEY_COOKIE = "microcms_draft_key";

const REVALIDATE_SECONDS = 3600;
const SUMMARY_FIELDS = "id,title,description,eyecatch,category,goal,createdAt,updatedAt,publishedAt,revisedAt";
const RECOMMENDATION_FIELDS =
  "id,title,description,eyecatch,category,recommend_type,recommend_skill_ids,recommend_goal_ids,recommend_order,recommend_audience";
const RECOMMENDATION_PAGE_SIZE = 100;
const RECOMMENDATION_FIXTURE_PATH = path.join(process.cwd(), "data", "fixtures", "recommendations", "dummy-articles.json");

function config() {
  const serviceDomain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;
  return serviceDomain && apiKey ? { serviceDomain, apiKey } : null;
}

export function isBlogConfigured(): boolean {
  return config() !== null;
}

async function request<T>(path: string, params: Record<string, string>, draft = false): Promise<T | null> {
  const cfg = config();
  if (!cfg) return null;
  const url = new URL(`https://${cfg.serviceDomain}.microcms.io/api/v1/${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);

  // 開発環境には Webhook が届かず、ディスクに残ったキャッシュが更新されないため毎回取得する
  const cacheable = !draft && process.env.NODE_ENV === "production";
  const res = await fetch(url, {
    headers: { "X-MICROCMS-API-KEY": cfg.apiKey },
    ...(cacheable ? { next: { tags: [BLOG_CACHE_TAG], revalidate: REVALIDATE_SECONDS } } : { cache: "no-store" as const }),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`microCMS request failed: ${res.status} ${path}`);
  return (await res.json()) as T;
}

export async function listPosts(limit = 100): Promise<BlogPostSummary[]> {
  const data = await request<ListResponse<BlogPostSummary>>("blogs", {
    limit: String(limit),
    fields: SUMMARY_FIELDS,
    orders: "-publishedAt",
  });
  return data?.contents ?? [];
}

/**
 * recommend_type を入力した記事（未検証の生データ。normalizeRecommendationArticles で整える）。
 * 取得に失敗しても空配列を返す（おすすめが無くても学習ロードマップは表示する）
 */
export async function listRecommendationArticles(): Promise<RawRecommendationArticle[]> {
  try {
    // 表示確認用。production では無効（実在しない記事を本番のおすすめに出さない）
    if (process.env.NODE_ENV !== "production" && process.env.RECOMMENDATION_FIXTURE === "1") {
      const text = await readFile(RECOMMENDATION_FIXTURE_PATH, "utf-8");
      return (JSON.parse(text) as { contents: RawRecommendationArticle[] }).contents;
    }
    const articles: RawRecommendationArticle[] = [];
    for (let offset = 0; ; offset += RECOMMENDATION_PAGE_SIZE) {
      const data = await request<ListResponse<RawRecommendationArticle>>("blogs", {
        limit: String(RECOMMENDATION_PAGE_SIZE),
        offset: String(offset),
        fields: RECOMMENDATION_FIELDS,
        filters: "recommend_type[exists]",
      });
      if (!data) break;
      articles.push(...data.contents);
      if (data.contents.length === 0 || offset + data.contents.length >= data.totalCount) break;
    }
    return articles;
  } catch (error) {
    console.error("おすすめ記事の取得に失敗しました", error);
    return [];
  }
}

export async function getPost(slug: string, draftKey?: string): Promise<BlogPost | null> {
  if (!isValidSlug(slug)) return null;
  return request<BlogPost>(`blogs/${slug}`, draftKey ? { draftKey } : {}, Boolean(draftKey));
}

/** Draft Mode 中だけ、プレビュー用の draftKey を Cookie から読む */
export async function getDraftKey(): Promise<string | undefined> {
  if (!(await draftMode()).isEnabled) return undefined;
  return (await cookies()).get(DRAFT_KEY_COOKIE)?.value;
}
