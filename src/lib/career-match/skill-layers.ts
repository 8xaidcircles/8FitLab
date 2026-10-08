import { goalSkillUnits, weightedSkillProgress } from "./skill-score";
import type {
  Certification,
  GoalSkillLayers,
  HumanRequirement,
  HumanRequirementDefinition,
  HumanSkill,
  ResolvedSkillLayerWeights,
  SkillLayerWeights,
  TechSkillStatistics,
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

export function humanRequirementStatus(
  requirements: readonly HumanRequirement[],
  held: ReadonlySet<string>,
): (HumanRequirement & { satisfied: boolean })[] {
  return requirements.map((r) => ({ ...r, satisfied: r.any_of.some((id) => held.has(id)) }));
}

// 人間定義層の達成率（0〜100）= 満たした要件の数 / 要件の数 × 100（要件は均等）。要件が無ければ null
export function humanSkillProgress(
  requirements: readonly HumanRequirement[],
  held: ReadonlySet<string>,
): number | null {
  if (requirements.length === 0) return null;
  const satisfied = humanRequirementStatus(requirements, held).filter((r) => r.satisfied).length;
  return (satisfied / requirements.length) * 100;
}

// Goal の配分（無ければ既定値）を合計 1 に正規化する。計算できない層は 0 にして、もう片方の層に寄せる。
// 配分のある層がすべて計算できないときは、配分が 0 でも計算できる層を 100% にする（両方とも計算できなければエラー）
export function resolveSkillLayerWeights(
  goalWeights: SkillLayerWeights | undefined,
  defaultWeights: SkillLayerWeights,
  available: { tech: boolean; human: boolean },
): ResolvedSkillLayerWeights {
  const base = goalWeights ?? defaultWeights;
  if (![base.tech, base.human].every((w) => Number.isFinite(w) && w >= 0) || base.tech + base.human <= 0) {
    throw new Error(`Invalid skill layer weights: tech=${base.tech}, human=${base.human}`);
  }
  let tech = available.tech ? base.tech : 0;
  let human = available.human ? base.human : 0;
  const fallback = (base.tech > 0 && !available.tech) || (base.human > 0 && !available.human);
  if (tech + human <= 0) {
    if (available.tech) tech = 1;
    else if (available.human) human = 1;
    else throw new Error("No skill layer is available for Skill Progress");
  }
  return {
    tech: tech / (tech + human),
    human: human / (tech + human),
    source: fallback ? "fallback" : goalWeights ? "goal" : "default",
  };
}

// Skill Match の計算に使う層（配分が 0 の層は除く）と、その層で達成率に効く skill_id
// （技術スキル層は採用 unit のメンバー、人間定義層は要件の any_of）
export function skillMatchScope(params: {
  techStats: TechSkillStatistics | null;
  goalLayers: GoalSkillLayers;
  defaultWeights: SkillLayerWeights;
}): { weights: ResolvedSkillLayerWeights; skillIds: Set<string> } {
  const units = params.techStats ? goalSkillUnits(params.techStats) : [];
  const requirements = normalizeHumanRequirements(params.goalLayers.human_requirements);
  const weights = resolveSkillLayerWeights(params.goalLayers.layer_weights, params.defaultWeights, {
    tech: units.length > 0,
    human: requirements.length > 0,
  });
  const skillIds = new Set<string>();
  if (weights.tech > 0) for (const unit of units) for (const member of unit.members) skillIds.add(member.skill_id);
  if (weights.human > 0) for (const requirement of requirements) for (const id of requirement.any_of) skillIds.add(id);
  return { weights, skillIds };
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
  techStats: TechSkillStatistics | null;
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
    // 配分の正規化による浮動小数点の誤差で 100 を超えないようにする
    progress: Math.min(100, (techProgress ?? 0) * weights.tech + (humanProgress ?? 0) * weights.human),
    tech_progress: techProgress,
    human_progress: humanProgress,
    weights,
  };
}
