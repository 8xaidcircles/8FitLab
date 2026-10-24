export type UserStage = "learning" | "ready" | "experienced";

export type ServiceGroupType = "schools" | "services" | "freelance";

/** src/lib/learning-path-services-mapping.json の 1 エントリ。null は公式サイトで確認できなかった属性 */
export interface LearningPathService {
  id: string;
  name: string;
  course?: string;
  url: string;
  /** リンクボタンの文言（省略時は「公式サイトを見る →」） */
  cta_label?: string;
  /** ASP の広告リンクなら true（rel="sponsored nofollow" になる） */
  sponsored?: boolean;
  /** ASP の広告コードに含まれる計測用の 1×1 画像の URL */
  tracking_pixel_url?: string;
  beginner_friendly?: boolean | null;
  novice_support?: boolean | null;
  freelance_available?: boolean | null;
  job_category_matched: boolean;
}

export interface CategoryServices {
  learning: { schools: LearningPathService[]; services: LearningPathService[] };
  ready: { services: LearningPathService[]; schools: LearningPathService[] };
  experienced: { services: LearningPathService[]; schools: LearningPathService[]; freelance: LearningPathService[] };
}
