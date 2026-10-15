import "server-only";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { imageSizeFromFile } from "image-size/fromFile";
import { parse as parseYaml } from "yaml";
import { loadGoals } from "@/lib/career-match";
import type { RawRecommendationArticle } from "@/lib/career-match/recommendations";
import { parseHttpsUrl } from "./body-blocks";
import { renderMarkdown } from "./markdown";
import type { RawService } from "./services";
import type { BlogAuthor, BlogCategory, BlogImage, BlogPost, BlogPostSummary } from "./types";
import { isValidSlug } from "./utils";

/**
 * Blog のコンテンツ（content/blog/）。記事は posts/{id}.md（frontmatter + Markdown 本文）、
 * 編集者・カテゴリ・比較サービスは YAML。書き方は docs/blog-writing.md。
 * 形式の誤りは例外にして、ビルドとテスト（content.test.ts）で止める
 */
const CONTENT_DIR = path.join(process.cwd(), "content", "blog");
const POSTS_DIR = path.join(CONTENT_DIR, "posts");
const PUBLIC_DIR = path.join(process.cwd(), "public");
const RECOMMENDATION_FIXTURE_PATH = path.join(process.cwd(), "data", "fixtures", "recommendations", "dummy-articles.json");

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;
const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 300;

export const POST_KEYS = new Set([
  "title",
  "description",
  "publishedAt",
  "updatedAt",
  "category",
  "goal",
  "author",
  "eyecatch",
  "draft",
  "recommend_type",
  "recommend_skill_ids",
  "recommend_goal_ids",
  "recommend_order",
  "recommend_audience",
]);
const AUTHOR_KEYS = new Set(["id", "name", "role", "avatar", "bio", "x_url", "github_url", "note_url", "website_url"]);
const RECOMMEND_TYPES = new Set(["material", "career_service"]);
const RECOMMEND_AUDIENCES = new Set(["learning", "experienced"]);

type BlogContent = {
  posts: BlogPost[];
  authors: BlogAuthor[];
  categories: BlogCategory[];
  services: RawService[];
};

/** 下書き（draft: true）を表示する環境。本番（VERCEL_ENV=production）には出さない */
export function showDrafts(): boolean {
  return process.env.NODE_ENV === "development" || process.env.VERCEL_ENV === "preview";
}

function fail(file: string, message: string): never {
  throw new Error(`content/blog/${file}: ${message}`);
}

/** 未入力。管理画面（Pages CMS）は空欄を '' や null で保存するため、書かなかったのと同じに扱う */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function record(value: unknown, file: string, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(file, `${label}の形式が正しくありません`);
  return value as Record<string, unknown>;
}

function checkKeys(item: Record<string, unknown>, allowed: Set<string>, file: string): void {
  const unknownKeys = Object.keys(item).filter((key) => !allowed.has(key));
  if (unknownKeys.length > 0) fail(file, `使えない項目があります: ${unknownKeys.join(", ")}`);
}

function requiredText(value: unknown, file: string, key: string, maxLength = Infinity): string {
  if (typeof value !== "string" || !value.trim()) fail(file, `${key} がありません`);
  if (value.trim().length > maxLength) fail(file, `${key} は ${maxLength} 文字以内にしてください`);
  return value.trim();
}

function optionalText(value: unknown, file: string, key: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") fail(file, `${key} は文字列にしてください`);
  return value.trim() || null;
}

/** 文字列 1 つ、またはリスト（YAML の [a, b]） */
function textList(value: unknown, file: string, key: string): string[] {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  if (!values.every((v) => typeof v === "string")) fail(file, `${key} は文字列かそのリストにしてください`);
  return values.map((v) => v.trim()).filter(Boolean);
}

/** 2026-10-15（日本時間の 0 時とみなす）または 2026-10-15T09:00:00+09:00 */
function parseDate(value: unknown, file: string, key: string): string {
  if (typeof value !== "string" || (!DATE_ONLY.test(value) && !DATE_TIME.test(value))) {
    fail(file, `${key} は 2026-10-15 か 2026-10-15T09:00:00+09:00 の形式にしてください`);
  }
  const iso = DATE_ONLY.test(value) ? `${value}T00:00:00+09:00` : value;
  if (Number.isNaN(new Date(iso).getTime())) fail(file, `${key} が日付として正しくありません: ${value}`);
  return iso;
}

async function exists(filePath: string): Promise<boolean> {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}

/** public/blog/ 配下の画像（/blog/images/xxx.png のようなサイト内パス）。サーバー関数のトレース対象もここだけ */
function publicPath(url: string, file: string): string {
  if (!url.startsWith("/blog/") || url.split("/").includes("..")) {
    fail(file, `画像は public/blog/ 配下に置き、/blog/images/xxx.png の形で書いてください: ${url}`);
  }
  return path.join(PUBLIC_DIR, decodeURIComponent(url));
}

async function loadImage(value: unknown, file: string, key: string): Promise<BlogImage | null> {
  if (isBlank(value)) return null;
  if (typeof value !== "string") fail(file, `${key} は画像のパスにしてください`);
  const filePath = publicPath(value, file);
  if (!(await exists(filePath))) fail(file, `${key} の画像がありません: public${value}`);
  const { width, height } = await imageSizeFromFile(filePath);
  return { url: value, width, height };
}

async function readYamlList(name: string): Promise<unknown[]> {
  const filePath = path.join(CONTENT_DIR, name);
  if (!(await exists(filePath))) return [];
  const data: unknown = parseYaml(await readFile(filePath, "utf-8"));
  if (data === null || data === undefined) return [];
  if (!Array.isArray(data)) fail(name, "リスト（- で始まる項目）で書いてください");
  return data;
}

function uniqueIds<T extends { id: string }>(items: T[], file: string): T[] {
  const seen = new Set<string>();
  for (const { id } of items) {
    if (seen.has(id)) fail(file, `id が重複しています: ${id}`);
    seen.add(id);
  }
  return items;
}

async function loadCategories(): Promise<BlogCategory[]> {
  const file = "categories.yml";
  const items = (await readYamlList(file)).map((raw) => {
    const item = record(raw, file, "カテゴリ");
    checkKeys(item, new Set(["id", "name"]), file);
    if (!isValidSlug(item.id)) fail(file, `id は英数字・ハイフン・アンダースコアにしてください: ${String(item.id)}`);
    return { id: item.id, name: requiredText(item.name, file, "name") };
  });
  return uniqueIds(items, file);
}

async function loadAuthors(): Promise<BlogAuthor[]> {
  const file = "authors.yml";
  const items = await Promise.all(
    (await readYamlList(file)).map(async (raw) => {
      const item = record(raw, file, "編集者");
      checkKeys(item, AUTHOR_KEYS, file);
      if (!isValidSlug(item.id)) fail(file, `id は英数字・ハイフン・アンダースコアにしてください: ${String(item.id)}`);
      const links = Object.fromEntries(
        (["x_url", "github_url", "note_url", "website_url"] as const).map((key) => {
          const url = optionalText(item[key], file, key);
          if (url && !parseHttpsUrl(url)) fail(file, `${key} は https:// で始まる URL にしてください`);
          return [key, url];
        }),
      );
      return {
        id: item.id,
        name: requiredText(item.name, file, "name"),
        role: optionalText(item.role, file, "role"),
        avatar: await loadImage(item.avatar, file, "avatar"),
        bio: optionalText(item.bio, file, "bio"),
        ...links,
      } satisfies BlogAuthor;
    }),
  );
  return uniqueIds(items, file);
}

async function loadServices(): Promise<RawService[]> {
  const file = "services.yml";
  const items = await Promise.all(
    (await readYamlList(file)).map(async (raw) => {
      const item = record(raw, file, "サービス");
      return { ...item, logo: await loadImage(item.logo, file, "logo") } as RawService;
    }),
  );
  const ids = items.map((item) => item.id);
  const duplicate = ids.find((id, i) => ids.indexOf(id) !== i);
  if (duplicate !== undefined) fail(file, `id が重複しています: ${String(duplicate)}`);
  return items;
}

async function loadPost(
  fileName: string,
  { authors, categories, goals }: { authors: BlogAuthor[]; categories: BlogCategory[]; goals: { goal_id: string; name: string }[] },
): Promise<BlogPost> {
  const file = `posts/${fileName}`;
  const id = fileName.replace(/\.md$/, "");
  if (!isValidSlug(id)) fail(file, "ファイル名は英数字・ハイフン・アンダースコアにしてください（URL になります）");

  const source = (await readFile(path.join(POSTS_DIR, fileName), "utf-8")).replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  const match = FRONTMATTER.exec(source);
  if (!match) fail(file, "先頭に --- で囲んだ frontmatter（title など）を書いてください");

  let parsed: unknown;
  try {
    parsed = parseYaml(match[1]);
  } catch (error) {
    fail(file, `frontmatter の YAML を読めません: ${error instanceof Error ? error.message : String(error)}`);
  }
  const fm = record(parsed, file, "frontmatter");
  checkKeys(fm, POST_KEYS, file);

  const categoryId = optionalText(fm.category, file, "category");
  const category = categoryId ? categories.find((c) => c.id === categoryId) : null;
  if (categoryId && !category) fail(file, `category が content/blog/categories.yml にありません: ${categoryId}`);

  const authorId = optionalText(fm.author, file, "author");
  const author = authorId ? authors.find((a) => a.id === authorId) : null;
  if (authorId && !author) fail(file, `author が content/blog/authors.yml にありません: ${authorId}`);

  const goal = textList(fm.goal, file, "goal");
  const unknownGoals = goal.filter((v) => !goals.some((g) => g.goal_id === v || g.name === v));
  if (unknownGoals.length > 0) fail(file, `goal が data/goals/goals.json にありません: ${unknownGoals.join(", ")}`);

  if (!isBlank(fm.draft) && typeof fm.draft !== "boolean") fail(file, "draft は true か false にしてください");

  const recommendType = textList(fm.recommend_type, file, "recommend_type");
  if (recommendType.some((t) => !RECOMMEND_TYPES.has(t))) fail(file, "recommend_type は material か career_service にしてください");
  const recommendAudience = textList(fm.recommend_audience, file, "recommend_audience");
  if (recommendAudience.some((a) => !RECOMMEND_AUDIENCES.has(a))) {
    fail(file, "recommend_audience は learning か experienced にしてください");
  }
  if (!isBlank(fm.recommend_order) && (typeof fm.recommend_order !== "number" || !Number.isFinite(fm.recommend_order))) {
    fail(file, "recommend_order は数値にしてください");
  }

  let rendered: ReturnType<typeof renderMarkdown>;
  try {
    rendered = renderMarkdown(match[2]);
  } catch (error) {
    fail(file, error instanceof Error ? error.message : String(error));
  }
  if (rendered.blocks.length === 0) fail(file, "本文がありません");
  for (const asset of rendered.localAssets) {
    if (!(await exists(publicPath(asset, file)))) fail(file, `本文の画像がありません: public${asset}`);
  }

  const publishedAt = parseDate(fm.publishedAt, file, "publishedAt");
  return {
    id,
    title: requiredText(fm.title, file, "title", MAX_TITLE_LENGTH),
    description: requiredText(fm.description, file, "description", MAX_DESCRIPTION_LENGTH),
    blocks: rendered.blocks,
    eyecatch: await loadImage(fm.eyecatch, file, "eyecatch"),
    category: category ?? null,
    author: author ?? null,
    goal,
    draft: fm.draft === true,
    publishedAt,
    updatedAt: isBlank(fm.updatedAt) ? publishedAt : parseDate(fm.updatedAt, file, "updatedAt"),
    recommend_type: recommendType,
    recommend_skill_ids: textList(fm.recommend_skill_ids, file, "recommend_skill_ids").join(","),
    recommend_goal_ids: textList(fm.recommend_goal_ids, file, "recommend_goal_ids").join(","),
    recommend_order: typeof fm.recommend_order === "number" ? fm.recommend_order : null,
    recommend_audience: recommendAudience,
  };
}

async function readContent(): Promise<BlogContent> {
  const [authors, categories, services, goals] = await Promise.all([loadAuthors(), loadCategories(), loadServices(), loadGoals()]);
  // _ で始まるファイル（_template.md）は記事にしない
  const fileNames = (await readdir(POSTS_DIR).catch(() => [] as string[])).filter((name) => name.endsWith(".md") && !name.startsWith("_"));
  const posts = await Promise.all(fileNames.map((name) => loadPost(name, { authors, categories, goals })));
  posts.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime() || a.id.localeCompare(b.id));
  return { posts, authors, categories, services };
}

let cached: Promise<BlogContent> | null = null;

/** すべてのコンテンツ（下書きを含む）。開発中は保存した内容をすぐ反映するため毎回読み直す */
export function loadBlogContent(): Promise<BlogContent> {
  if (process.env.NODE_ENV === "development") return readContent();
  cached ??= readContent().catch((error: unknown) => {
    cached = null;
    throw error;
  });
  return cached;
}

async function visiblePosts(): Promise<BlogPost[]> {
  const { posts } = await loadBlogContent();
  return showDrafts() ? posts : posts.filter((post) => !post.draft);
}

/** 一覧には本文と編集者を含めない（クライアントへ渡すデータを小さくする） */
function toSummary(post: BlogPost): BlogPostSummary {
  const summary: Partial<BlogPost> = { ...post };
  delete summary.blocks;
  delete summary.author;
  return summary as BlogPostSummary;
}

/** 公開日の新しい順 */
export async function listPosts(limit?: number): Promise<BlogPostSummary[]> {
  return (await visiblePosts()).slice(0, limit).map(toSummary);
}

export async function getPost(slug: string): Promise<BlogPost | null> {
  if (!isValidSlug(slug)) return null;
  return (await visiblePosts()).find((post) => post.id === slug) ?? null;
}

/** 比較ページに掲載するスクール・転職サービス（未検証の生データ。normalizeServices で整える） */
export async function listServices(): Promise<RawService[]> {
  return (await loadBlogContent()).services;
}

/** recommend_type を入力した記事（normalizeRecommendationArticles で整える） */
export async function listRecommendationArticles(): Promise<RawRecommendationArticle[]> {
  // 表示確認用。production では無効（実在しない記事を本番のおすすめに出さない）
  if (process.env.NODE_ENV !== "production" && process.env.RECOMMENDATION_FIXTURE === "1") {
    const text = await readFile(RECOMMENDATION_FIXTURE_PATH, "utf-8");
    return (JSON.parse(text) as { contents: RawRecommendationArticle[] }).contents;
  }
  return (await visiblePosts()).filter((post) => (post.recommend_type?.length ?? 0) > 0).map(toSummary);
}
