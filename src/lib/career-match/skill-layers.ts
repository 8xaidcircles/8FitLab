import { goalSkillUnits, weightedSkillProgress } from "./skill-score";
import type {
  Certification,
  GoalSkillLayers,
  HumanRequirement,
  HumanRequirementDefinition,
  HumanSkill,
  ResolvedSkillLayerWeights,
  SkillLayerWeights,
  SkillStatistics,
} from "./types";

export function normalizeHumanRequirements(definitions: readonly HumanRequirementDefinition[]): HumanRequirement[] {
  return definitions.map((d) => (typeof d === "string" ? { requirement_id: d, any_of: [d] } : d));
}

// ユーザーが持つとみなす skill_id = 入力した skill_id ∪ 資格が証明するスキル ∪ 使っているツールの人間定義層スキル
export function heldSkillIds(
  input: { skillIds: Iterable<string>; certificationIds: Iterable<string> },
  masters: { humanSkills: readonly HumanSkill[]; certifications: readonly Certification[] },
): Set<string> {
  const held = new Set(input.skillIds);
  const certIds = new Set(input.certificationIds);
  for (const cert of masters.certifications) {
    if (certIds.has(cert.cert_id)) for (const id of cert.proves) held.add(id);
  }
  for (const skill of masters.humanSkills) {
    if (skill.tools?.some((tool) => held.has(tool.tool_id))) held.add(skill.skill_id);
  }
  return held;
}

// 人間定義層の達成率（0〜100）= 満たした要件の数 / 要件の数 × 100（要件は均等）。要件が無ければ null
export function humanSkillProgress(
  requirements: readonly HumanRequirement[],
  held: ReadonlySet<string>,
): number | null {
  if (requirements.length === 0) return null;
  const satisfied = requirements.filter((r) => r.any_of.some((id) => held.has(id))).length;
  return (satisfied / requirements.length) * 100;
}

// Goal の配分（無ければ既定値）を合計 1 に正規化する。計算できない層は 0 にして、残りの層に寄せる
export function resolveSkillLayerWeights(
  goalWeights: SkillLayerWeights | undefined,
  defaultWeights: SkillLayerWeights,
  available: { tech: boolean; human: boolean },
): ResolvedSkillLayerWeights {
  const base = goalWeights ?? defaultWeights;
  if (![base.tech, base.human].every((w) => Number.isFinite(w) && w >= 0) || base.tech + base.human <= 0) {
    throw new Error(`Invalid skill layer weights: tech=${base.tech}, human=${base.human}`);
  }
  const tech = available.tech ? base.tech : 0;
  const human = available.human ? base.human : 0;
  if (tech + human <= 0) throw new Error("No skill layer is available for Skill Progress");
  const fallback = (base.tech > 0 && !available.tech) || (base.human > 0 && !available.human);
  return {
    tech: tech / (tech + human),
    human: human / (tech + human),
    source: fallback ? "fallback" : goalWeights ? "goal" : "default",
  };
}

export interface LayeredSkillProgress {
  /** 2 層を配分で合算した Skill Progress（0〜100） */
  progress: number;
  tech_progress: number | null;
  human_progress: number | null;
  weights: ResolvedSkillLayerWeights;
}

// Skill Progress = 技術スキル層の達成率 × 配分(tech) + 人間定義層の達成率 × 配分(human)
export function layeredSkillProgress(params: {
  held: ReadonlySet<string>;
  techStats: Pick<SkillStatistics, "goal_id" | "units"> | null;
  goalLayers: GoalSkillLayers;
  defaultWeights: SkillLayerWeights;
}): LayeredSkillProgress {
  const { held, techStats, goalLayers, defaultWeights } = params;
  if (techStats && techStats.goal_id !== goalLayers.goal_id) {
    throw new Error(`Goal mismatch: skill statistics=${techStats.goal_id}, skill layers=${goalLayers.goal_id}`);
  }
  const techProgress =
    techStats && goalSkillUnits(techStats).length > 0 ? weightedSkillProgress(techStats, held) : null;
  const humanProgress = humanSkillProgress(normalizeHumanRequirements(goalLayers.human_requirements), held);
  const weights = resolveSkillLayerWeights(goalLayers.layer_weights, defaultWeights, {
    tech: techProgress !== null,
    human: humanProgress !== null,
  });
  return {
    progress: (techProgress ?? 0) * weights.tech + (humanProgress ?? 0) * weights.human,
    tech_progress: techProgress,
    human_progress: humanProgress,
    weights,
  };
}
