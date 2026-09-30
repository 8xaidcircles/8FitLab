export type MicroCMSImage = { url: string; width: number; height: number };

export type BlogCategory = { id: string; name: string };

/** microCMS の blogs API。id（コンテンツID）を URL のスラッグとして使う */
export type BlogPost = {
  id: string;
  title: string;
  description: string;
  content: string;
  eyecatch?: MicroCMSImage | null;
  category?: BlogCategory | null;
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

export type BlogPostSummary = Omit<BlogPost, "content">;

export type ListResponse<T> = { contents: T[]; totalCount: number; offset: number; limit: number };
