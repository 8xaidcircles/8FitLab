import type { BlogPostSummary } from "@/lib/blog/types";
import { isStepSatisfied } from "./skill-gap";
import type { LearningStep } from "./types";

// おすすめは運営が書いた Blog 記事（microCMS の recommend_* フィールド）。リンク先は常に /blog/{id}

export const RECOMMENDATION_TYPES = ["material", "career_service"] as const;
export type RecommendationType = (typeof RECOMMENDATION_TYPES)[number];

export const CAREER_AUDIENCES = ["learning", "experienced"] as const;
export type CareerAudience = (typeof CAREER_AUDIENCES)[number];
const DEFAULT_CAREER_AUDIENCE: CareerAudience = "experienced";

/** recommend_goal_ids に書くと、すべての Goal に共通の記事になる */
export const ALL_GOALS = "all";

/** クリック計測の placement（/api/events でも検証する） */
export const RECOMMENDATION_PLACEMENTS = ["step_learn", "step_review", "career_learning", "career_experienced"] as const;
export type RecommendationPlacement = (typeof RECOMMENDATION_PLACEMENTS)[number];

export function isRecommendationPlacement(value: unknown): value is RecommendationPlacement {
  return (RECOMMENDATION_PLACEMENTS as readonly unknown[]).includes(value);
}

export const DEFAULT_RECOMMEND_ORDER = 100;
export const MAX_LEARN_RECOMMENDATIONS = 3;
export const MAX_REVIEW_RECOMMENDATIONS = 2;
export const MAX_CAREER_RECOMMENDATIONS = 3;

export type RawRecommendationArticle = Pick<BlogPostSummary, "id" | "title" | "description" | "eyecatch" | "category"> &
  Pick<
    BlogPostSummary,
    "recommend_type" | "recommend_skill_ids" | "recommend_goal_ids" | "recommend_order" | "recommend_audience"
  >;

export interface RecommendationArticle {
  id: string;
  title: string;
  description: string;
  eyecatch: BlogPostSummary["eyecatch"];
  type: RecommendationType;
  /** material：既知の skill_id だけ */
  skill_ids: string[];
  /** career_service：既知の goal_id と all だけ */
  goal_ids: string[];
  /** career_service だけ。material は null */
  audience: CareerAudience | null;
  order: number;
}

export interface KnownRecommendationIds {
  skillIds: ReadonlySet<string>;
  goalIds: ReadonlySet<string>;
}

function splitIds(value: string | null | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,、\s]+/).map((id) => id.trim().toLowerCase()).filter(Boolean))];
}

// セレクトフィールドは配列で返るが、文字列でも受け取る
function parseSelect<T extends string>(value: string[] | string | null | undefined, allowed: readonly T[]): T | null {
  const first = Array.isArray(value) ? value[0] : value;
  const normalized = typeof first === "string" ? first.trim().toLowerCase() : "";
  return (allowed as readonly string[]).includes(normalized) ? (normalized as T) : null;
}

function parseOrder(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : DEFAULT_RECOMMEND_ORDER;
}

function warn(article: RawRecommendationArticle, message: string) {
  if (process.env.NODE_ENV === "development") console.warn(`おすすめ記事 ${article.id}：${message}`);
}

// 種別が不正な記事と、既知の ID を 1 つも持たない記事は除外する（未知の ID だけを捨てて残りは使う）
export function normalizeRecommendationArticles(
  raw: readonly RawRecommendationArticle[],
  known: KnownRecommendationIds,
): RecommendationArticle[] {
  const articles: RecommendationArticle[] = [];
  for (const article of raw) {
    const type = parseSelect(article.recommend_type, RECOMMENDATION_TYPES);
    if (!type) {
      warn(article, `recommend_type が不正なため除外しました（${JSON.stringify(article.recommend_type ?? null)}）`);
      continue;
    }
    const material = type === "material";
    const ids = splitIds(material ? article.recommend_skill_ids : article.recommend_goal_ids);
    const valid = ids.filter((id) => (material ? known.skillIds.has(id) : id === ALL_GOALS || known.goalIds.has(id)));
    if (valid.length === 0) {
      warn(article, `既知の${material ? " skill_id" : " goal_id"} がないため除外しました（${ids.join(", ") || "未入力"}）`);
      continue;
    }
    let audience: CareerAudience | null = null;
    if (!material) {
      audience = parseSelect(article.recommend_audience, CAREER_AUDIENCES);
      const rawAudience = Array.isArray(article.recommend_audience) ? article.recommend_audience[0] : article.recommend_audience;
      if (!audience && rawAudience) warn(article, `recommend_audience が不正なため ${DEFAULT_CAREER_AUDIENCE} として扱います（${rawAudience}）`);
      audience ??= DEFAULT_CAREER_AUDIENCE;
    }
    articles.push({
      id: article.id,
      title: article.title,
      description: article.description,
      eyecatch: article.eyecatch ?? null,
      type,
      skill_ids: material ? valid : [],
      goal_ids: material ? [] : valid,
      audience,
      order: parseOrder(article.recommend_order),
    });
  }
  return articles;
}

export function compareRecommendations(a: RecommendationArticle, b: RecommendationArticle): number {
  if (a.order !== b.order) return a.order - b.order;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** learn：未習得の Step（any_of 全体で一致）/ review：習得済みの Step（保有している選択肢だけで一致） */
export type StepRecommendationMode = "learn" | "review";

export interface StepRecommendations {
  step_id: string;
  mode: StepRecommendationMode;
  articles: RecommendationArticle[];
}

const byLearningOrder = (a: LearningStep, b: LearningStep) => a.learning_order - b.learning_order;

// 未習得の Step（learning_order 順）→ 習得済みの Step（learning_order 順）の順に記事を割り当てる。
// 同じ記事は最初に一致した Step にだけ割り当て、その Step の上限からあふれても後ろの Step には回さない
export function resolveStepRecommendations(
  steps: readonly LearningStep[],
  held: ReadonlySet<string>,
  articles: readonly RecommendationArticle[],
): StepRecommendations[] {
  const materials = articles.filter((a) => a.type === "material").sort(compareRecommendations);
  const learn = steps.filter((s) => !isStepSatisfied(s, held)).sort(byLearningOrder);
  const review = steps.filter((s) => isStepSatisfied(s, held)).sort(byLearningOrder);
  const assigned = new Set<string>();
  const result = new Map<string, StepRecommendations>();
  for (const [mode, group] of [["learn", learn], ["review", review]] as const) {
    for (const step of group) {
      const targets = mode === "learn" ? step.any_of : step.any_of.filter((id) => held.has(id));
      const matched = materials.filter((a) => !assigned.has(a.id) && a.skill_ids.some((id) => targets.includes(id)));
      for (const a of matched) assigned.add(a.id);
      const limit = mode === "learn" ? MAX_LEARN_RECOMMENDATIONS : MAX_REVIEW_RECOMMENDATIONS;
      result.set(step.step_id, { step_id: step.step_id, mode, articles: matched.slice(0, limit) });
    }
  }
  return steps.map((step) => result.get(step.step_id)!);
}

export type CareerRecommendations = Record<CareerAudience, RecommendationArticle[]>;

// career_service のうち、goalId か all を対象にする記事を audience ごとに最大 3 件
export function resolveCareerRecommendations(
  goalId: string,
  articles: readonly RecommendationArticle[],
): CareerRecommendations {
  const services = articles
    .filter((a) => a.type === "career_service" && (a.goal_ids.includes(goalId) || a.goal_ids.includes(ALL_GOALS)))
    .sort(compareRecommendations);
  const pick = (audience: CareerAudience) =>
    services.filter((a) => a.audience === audience).slice(0, MAX_CAREER_RECOMMENDATIONS);
  return { learning: pick("learning"), experienced: pick("experienced") };
}

export const RECOMMENDATION_TYPE_LABELS: Record<RecommendationType, string> = {
  material: "教材",
  career_service: "転職サービス",
};

export const CAREER_AUDIENCE_HEADINGS: Record<CareerAudience, string> = {
  learning: "学習中・未経験から使えるサービス",
  experienced: "経験者向けの転職・フリーランスサービス",
};

/** おすすめカード 1 枚分。href は常に内部の /blog/{id}（外部サイトへは記事から案内する） */
export interface RecommendationCard {
  article_id: string;
  href: string;
  title: string;
  description: string;
  eyecatch: BlogPostSummary["eyecatch"];
  type: RecommendationType;
  type_label: string;
  placement: RecommendationPlacement;
  goal_id: string;
  /** career 系は null */
  step_id: string | null;
  position_index: number;
}

export interface RoadmapStep {
  step: LearningStep;
  /** 未習得の中での番号（1 始まり） */
  number: number;
  option_names: string[];
  cards: RecommendationCard[];
}

export interface ReviewStep {
  step: LearningStep;
  /** 保有している選択肢の名前 */
  held_names: string[];
  cards: RecommendationCard[];
}

export interface CareerGroup {
  audience: CareerAudience;
  heading: string;
  cards: RecommendationCard[];
}

export interface LearningPathView {
  /** 未習得の Step（learning_order 順） */
  missing: RoadmapStep[];
  /** 習得済みの Step（learning_order 順） */
  satisfied: ReviewStep[];
  /** 教材の記事が 1 件でもあるか（0 件ならページに「準備中」を 1 か所だけ出す） */
  has_materials: boolean;
  /** 記事のあるグループだけ。未習得がある → 学習中が先、全 Step 習得済み → 経験者が先 */
  career: CareerGroup[];
}

function toCard(
  article: RecommendationArticle,
  placement: RecommendationPlacement,
  goalId: string,
  stepId: string | null,
  positionIndex: number,
): RecommendationCard {
  return {
    article_id: article.id,
    href: `/blog/${encodeURIComponent(article.id)}`,
    title: article.title,
    description: article.description,
    eyecatch: article.eyecatch,
    type: article.type,
    type_label: RECOMMENDATION_TYPE_LABELS[article.type],
    placement,
    goal_id: goalId,
    step_id: stepId,
    position_index: positionIndex,
  };
}

export function buildLearningPathView(
  goalId: string,
  steps: readonly LearningStep[],
  held: ReadonlySet<string>,
  articles: readonly RecommendationArticle[],
  skillName: (skillId: string) => string,
): LearningPathView {
  const recommendations = new Map(resolveStepRecommendations(steps, held, articles).map((s) => [s.step_id, s]));
  const ordered = [...steps].sort(byLearningOrder);
  const cardsFor = (step: LearningStep) => {
    const { mode, articles: matched } = recommendations.get(step.step_id)!;
    const placement = mode === "learn" ? "step_learn" : "step_review";
    return matched.map((a, i) => toCard(a, placement, goalId, step.step_id, i));
  };

  const missing = ordered
    .filter((s) => !isStepSatisfied(s, held))
    .map((step, index) => ({ step, number: index + 1, option_names: step.any_of.map(skillName), cards: cardsFor(step) }));
  const satisfied = ordered
    .filter((s) => isStepSatisfied(s, held))
    .map((step) => ({ step, held_names: step.any_of.filter((id) => held.has(id)).map(skillName), cards: cardsFor(step) }));

  const career = resolveCareerRecommendations(goalId, articles);
  const audiences: CareerAudience[] = missing.length > 0 ? ["learning", "experienced"] : ["experienced", "learning"];
  return {
    missing,
    satisfied,
    has_materials: [...missing, ...satisfied].some((s) => s.cards.length > 0),
    career: audiences
      .map((audience) => ({
        audience,
        heading: CAREER_AUDIENCE_HEADINGS[audience],
        cards: career[audience].map((a, i) => toCard(a, `career_${audience}`, goalId, null, i)),
      }))
      .filter((group) => group.cards.length > 0),
  };
}
