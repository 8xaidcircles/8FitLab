export type MicroCMSImage = { url: string; width: number; height: number };

export type BlogCategory = { id: string; name: string };

/** microCMS の authors API（編集者プロフィール）。記事の author フィールドから参照する */
export type BlogAuthor = {
  id: string;
  name: string;
  /** 肩書き（例：8FitLab 運営者） */
  role?: string | null;
  avatar?: MicroCMSImage | null;
  /** 記事冒頭の「この記事を書いた人」に出す要点。改行区切り */
  highlights?: string | null;
  /** 記事末尾のプロフィール本文 */
  bio?: string | null;
  x_url?: string | null;
  github_url?: string | null;
  note_url?: string | null;
  website_url?: string | null;
};

/** microCMS の blogs API。id（コンテンツID）を URL のスラッグとして使う */
export type BlogPost = {
  id: string;
  title: string;
  description: string;
  content?: string | null;
  /** 繰り返しフィールド（rich_text / cta_button）。未検証の生データ。normalizeBodyBlocks で整える */
  body?: unknown;
  eyecatch?: MicroCMSImage | null;
  category?: BlogCategory | null;
  author?: BlogAuthor | null;
  /** セレクトフィールド。Goal の日本語名または goal_id */
  goal?: string[] | null;
  createdAt: string;
  updatedAt: string;
  /** 一度も公開されていない下書きには存在しない */
  publishedAt?: string;
  revisedAt?: string;
} & RecommendationFields;

/**
 * おすすめ記事のフィールド（すべて任意。docs/microcms-recommendations.md）。
 * 入力の揺れ（セレクトの配列・カンマ／改行区切り・大文字）は normalizeRecommendationArticles で整える
 */
export type RecommendationFields = {
  /** セレクト（material / career_service）。API は配列で返す */
  recommend_type?: string[] | string | null;
  /** skill_id のカンマ・改行区切り（material 用） */
  recommend_skill_ids?: string | null;
  /** goal_id のカンマ・改行区切り（career_service 用） */
  recommend_goal_ids?: string | null;
  /** 小さいほど上位。未入力は 100 */
  recommend_order?: number | null;
  /** セレクト（learning / experienced）。career_service 用。未入力は experienced。API は配列で返す */
  recommend_audience?: string[] | string | null;
};

export type BlogPostSummary = Omit<BlogPost, "content" | "body" | "author">;

export type ListResponse<T> = { contents: T[]; totalCount: number; offset: number; limit: number };
