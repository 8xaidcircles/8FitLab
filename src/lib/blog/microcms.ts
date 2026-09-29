import "server-only";
import { cookies, draftMode } from "next/headers";
import type { BlogPost, BlogPostSummary, ListResponse } from "./types";
import { isValidSlug } from "./utils";

export const BLOG_CACHE_TAG = "microcms";
export const DRAFT_KEY_COOKIE = "microcms_draft_key";

const REVALIDATE_SECONDS = 3600;
const SUMMARY_FIELDS = "id,title,description,eyecatch,category,goal,createdAt,updatedAt,publishedAt,revisedAt";

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

export async function getPost(slug: string, draftKey?: string): Promise<BlogPost | null> {
  if (!isValidSlug(slug)) return null;
  return request<BlogPost>(`blogs/${slug}`, draftKey ? { draftKey } : {}, Boolean(draftKey));
}

/** Draft Mode 中だけ、プレビュー用の draftKey を Cookie から読む */
export async function getDraftKey(): Promise<string | undefined> {
  if (!(await draftMode()).isEnabled) return undefined;
  return (await cookies()).get(DRAFT_KEY_COOKIE)?.value;
}
