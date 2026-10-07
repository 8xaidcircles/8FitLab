import {
  MAX_LEARN_RECOMMENDATIONS,
  RECOMMENDATION_TYPE_LABELS,
  compareRecommendations,
  resolveStepRecommendations,
  type RecommendationArticle,
  type RecommendationCard,
  type RecommendationPlacement,
} from "@/lib/career-match/recommendations";
import { isStepSatisfied } from "@/lib/career-match/skill-gap";
import type { LearningStep } from "@/lib/career-match/types";
import { isLanguageStep } from "./determine-stage";

function toCard(
  article: RecommendationArticle,
  placement: RecommendationPlacement,
  goalId: string,
  stepId: string,
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

/**
 * Step ごとの教材カード（step_id → カード）。
 * 言語の Step は習得状況・ステージに関係なく、すべての選択肢の言語に一致する教材を出す（言語は全 Goal の基礎のため）。
 * それ以外の Step は resolveStepRecommendations と同じ割り当て（未習得は選択肢全体、習得済みは保有している選択肢で一致）。
 * 複数の言語に一致する記事は、それぞれの言語の Step に出す。言語の Step に出した記事は、それ以外の Step には出さない
 */
export function stepMaterialCards(
  goalId: string,
  steps: readonly LearningStep[],
  held: ReadonlySet<string>,
  articles: readonly RecommendationArticle[],
): Map<string, RecommendationCard[]> {
  const materials = articles.filter((a) => a.type === "material").sort(compareRecommendations);
  const used = new Set<string>();
  const cards = new Map<string, RecommendationCard[]>();

  for (const step of steps.filter(isLanguageStep)) {
    const matched = materials
      .filter((a) => a.skill_ids.some((id) => step.any_of.includes(id)))
      .slice(0, MAX_LEARN_RECOMMENDATIONS);
    for (const a of matched) used.add(a.id);
    const placement = isStepSatisfied(step, held) ? "step_review" : "step_learn";
    cards.set(step.step_id, matched.map((a, i) => toCard(a, placement, goalId, step.step_id, i)));
  }

  const others = steps.filter((step) => !isLanguageStep(step));
  const remaining = materials.filter((a) => !used.has(a.id));
  for (const { step_id, mode, articles: matched } of resolveStepRecommendations(others, held, remaining)) {
    const placement = mode === "learn" ? "step_learn" : "step_review";
    cards.set(step_id, matched.map((a, i) => toCard(a, placement, goalId, step_id, i)));
  }
  return cards;
}
