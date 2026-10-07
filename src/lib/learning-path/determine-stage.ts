import type { Goal } from "@/lib/career-match/data";
import type { UserExperience } from "@/lib/career-match/types";
import { EXPERIENCED_MIN_YEARS, LANGUAGE_SKILL_IDS } from "./constants";
import type { UserStage } from "./types";

/** Goal の全 Requirement Group について、Group の職業（どれか）に EXPERIENCED_MIN_YEARS 年以上就いているか */
export function hasGoalExperience(goal: Pick<Goal, "requirement_groups">, experiences: readonly UserExperience[]): boolean {
  if (goal.requirement_groups.length === 0) return false;
  return goal.requirement_groups.every((group) => {
    const codes = new Set(group.occupations.map((o) => o.code));
    return experiences.some((e) => codes.has(e.role_id) && e.years >= EXPERIENCED_MIN_YEARS);
  });
}

/**
 * experienced: Goal の職業の実務経験が EXPERIENCED_MIN_YEARS 年以上
 * ready: 実務経験なし ＆ Learning Path の全 Step を習得済み
 * learning: 実務経験なし ＆ 未習得の Step あり
 *
 * steps の satisfied は evaluateSteps(path, resolveUserSkills().held) の値を渡す（資格・ツール経由のスキルを含める）
 */
export function determineUserStage(
  goal: Pick<Goal, "requirement_groups">,
  experiences: readonly UserExperience[],
  steps: readonly { satisfied: boolean }[],
): UserStage {
  if (hasGoalExperience(goal, experiences)) return "experienced";
  return steps.every((step) => step.satisfied) ? "ready" : "learning";
}

export function isLanguageStep(step: { any_of: readonly string[] }): boolean {
  return step.any_of.length > 0 && step.any_of.every((id) => LANGUAGE_SKILL_IDS.has(id));
}
