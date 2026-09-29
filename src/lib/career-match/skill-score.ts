import type {
  SkillProgressDistribution,
  SkillScoringModel,
  SkillStatistics,
  SkillStatisticsUnit,
} from "./types";

// 分布の推定に必要な最小ユーザー数（Career Statistics の SMALL_SAMPLE_THRESHOLD と同じ基準）
export const SKILL_DISTRIBUTION_MIN_SAMPLE = 100;

export const LINEAR_SKILL_SCORING: SkillScoringModel = { method: "linear" };

export function goalSkillUnits(stats: Pick<SkillStatistics, "units">): SkillStatisticsUnit[] {
  return stats.units.filter((unit) => unit.selected);
}

export function skillUnitSatisfied(unit: SkillStatisticsUnit, userSkillIds: ReadonlySet<string>): boolean {
  return unit.members.some((member) => userSkillIds.has(member.skill_id));
}

export interface SkillUnitGap {
  unit: SkillStatisticsUnit;
  satisfied: boolean;
  /** Skill Progress に占める割合（0〜100）。満たせばこの分だけ Skill Progress が上がる */
  share: number;
}

// Goal Skill（採用された unit）ごとの充足状況。Contribution の大きい順
export function skillUnitGaps(
  stats: Pick<SkillStatistics, "goal_id" | "units">,
  userSkillIds: Iterable<string>,
): SkillUnitGap[] {
  const units = goalSkillUnits(stats);
  const total = units.reduce((sum, unit) => sum + unit.contribution, 0);
  if (!(total > 0)) throw new Error(`Skill statistics for ${stats.goal_id} have no selected units`);
  const ids = new Set(userSkillIds);
  return units
    .map((unit) => ({ unit, satisfied: skillUnitSatisfied(unit, ids), share: (unit.contribution / total) * 100 }))
    .sort((a, b) => b.unit.contribution - a.unit.contribution);
}

// 技術スキル層の達成率（0〜100）= Σ Contribution(満たした unit) / Σ Contribution(Goal Skill) × 100
export function weightedSkillProgress(
  stats: Pick<SkillStatistics, "goal_id" | "units">,
  userSkillIds: Iterable<string>,
): number {
  return Math.min(
    100,
    skillUnitGaps(stats, userSkillIds).reduce((sum, gap) => (gap.satisfied ? sum + gap.share : sum), 0),
  );
}

// 標準正規分布の CDF。erf は Abramowitz & Stegun 7.1.26（最大誤差 1.5e-7）
export function standardNormalCdf(z: number): number {
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
}

// 蓄積データが十分なら全ユーザーの進捗分布による CDF 変換、無ければ（コールドスタート）線形
export function selectSkillScoringModel(distribution: SkillProgressDistribution | null | undefined): SkillScoringModel {
  if (
    !distribution ||
    distribution.sample_size < SKILL_DISTRIBUTION_MIN_SAMPLE ||
    !Number.isFinite(distribution.mean) ||
    !(distribution.sd > 0)
  ) {
    return LINEAR_SKILL_SCORING;
  }
  return { method: "normal_cdf", mean: distribution.mean, sd: distribution.sd, sample_size: distribution.sample_size };
}

// 達成率（0〜100）→ Skill Match（0〜100）
export function scoreSkill(progress: number, model: SkillScoringModel): number {
  if (model.method === "linear") return progress;
  return standardNormalCdf((progress - model.mean) / model.sd) * 100;
}
