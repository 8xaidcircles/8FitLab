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
};

export type BlogPostSummary = Omit<BlogPost, "content">;

export type ListResponse<T> = { contents: T[]; totalCount: number; offset: number; limit: number };
