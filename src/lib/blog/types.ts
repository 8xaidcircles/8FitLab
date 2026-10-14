import type { BodyBlock } from "./body-blocks";

/** public/ 配下の画像。url はサイト内のパス（例: /blog/images/xxx.png） */
export type BlogImage = { url: string; width: number; height: number };

/** content/blog/categories.yml */
export type BlogCategory = { id: string; name: string };

/** content/blog/authors.yml（編集者プロフィール）。記事の author から id で参照する */
export type BlogAuthor = {
  id: string;
  name: string;
  /** 肩書き（例：8FitLab 運営者） */
  role?: string | null;
  avatar?: BlogImage | null;
  /** 記事冒頭の「この記事を書いた人」に出す要点。改行区切り */
  highlights?: string | null;
  /** 記事末尾のプロフィール本文 */
  bio?: string | null;
  x_url?: string | null;
  github_url?: string | null;
  note_url?: string | null;
  website_url?: string | null;
};

/** content/blog/posts/{id}.md。ファイル名（拡張子なし）を URL のスラッグとして使う */
export type BlogPost = {
  id: string;
  title: string;
  description: string;
  /** Markdown 本文を HTML と CTA ボタンに分けたもの（出現順） */
  blocks: BodyBlock[];
  eyecatch?: BlogImage | null;
  category?: BlogCategory | null;
  author?: BlogAuthor | null;
  /** Goal の日本語名または goal_id */
  goal?: string[] | null;
  /** true の記事は本番に出さない（開発環境と Vercel のプレビューだけで表示する） */
  draft: boolean;
  publishedAt: string;
  /** 内容を更新した日（frontmatter の updatedAt）。未入力なら publishedAt */
  updatedAt: string;
} & RecommendationFields;

/**
 * おすすめ記事のフィールド（すべて任意。docs/blog-writing.md）。
 * 入力の揺れ（カンマ／改行区切り・大文字）は normalizeRecommendationArticles で整える
 */
export type RecommendationFields = {
  /** material / career_service */
  recommend_type?: string[] | string | null;
  /** skill_id のカンマ・改行区切り（material 用） */
  recommend_skill_ids?: string | null;
  /** goal_id のカンマ・改行区切り（career_service 用） */
  recommend_goal_ids?: string | null;
  /** 小さいほど上位。未入力は 100 */
  recommend_order?: number | null;
  /** learning / experienced。career_service 用。未入力は experienced */
  recommend_audience?: string[] | string | null;
};

export type BlogPostSummary = Omit<BlogPost, "blocks" | "author">;
