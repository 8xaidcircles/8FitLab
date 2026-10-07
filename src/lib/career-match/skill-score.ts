import type {
  SkillProgressDistribution,
  SkillScoringModel,
  SkillScoringVersions,
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

// sorted（昇順）のうち x より小さい値の数（lower）と x 以下の値の数（upper）
function rankBounds(sorted: readonly number[], x: number): { lower: number; upper: number } {
  const search = (inclusive: boolean) => {
    let lo = 0;
    let hi = sorted.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (sorted[mid] < x || (inclusive && sorted[mid] === x)) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  return { lower: search(false), upper: search(true) };
}

// 経験分布上のパーセンタイル（0〜100）=（x 未満の数 + 0.5 × x と同じ値の数）/ N × 100（同率は中央順位）
export function ecdfPercentile(sortedScores: readonly number[], x: number): number {
  if (sortedScores.length === 0) throw new Error("ECDF requires at least one score");
  const { lower, upper } = rankBounds(sortedScores, x);
  return ((lower + 0.5 * (upper - lower)) / sortedScores.length) * 100;
}

// 蓄積データが十分なら全ユーザーの達成率の経験分布（ECDF）で変換、無ければ（コールドスタート）線形。
// 全員が同じ達成率なら順位の情報が無い（全員 50 になる）ため線形のまま。
// 分布が現在の計算と別のバージョンの結果から集計されていれば、達成率の意味が違うため線形にする
export function selectSkillScoringModel(
  distribution: SkillProgressDistribution | null | undefined,
  current: SkillScoringVersions,
): SkillScoringModel {
  if (!distribution || distribution.scores.length < SKILL_DISTRIBUTION_MIN_SAMPLE) return LINEAR_SKILL_SCORING;
  if (
    distribution.skill_calculation_version !== current.skill_calculation_version ||
    distribution.skill_statistics_version !== current.skill_statistics_version
  ) {
    return LINEAR_SKILL_SCORING;
  }
  if (!distribution.scores.every((s) => Number.isFinite(s) && s >= 0 && s <= 100)) return LINEAR_SKILL_SCORING;
  const sorted = [...distribution.scores].sort((a, b) => a - b);
  if (sorted[0] === sorted[sorted.length - 1]) return LINEAR_SKILL_SCORING;
  return { method: "ecdf", sorted_scores: sorted, sample_size: sorted.length };
}

// 達成率（0〜100）→ Skill Match（0〜100）
export function scoreSkill(progress: number, model: SkillScoringModel): number {
  if (model.method === "linear") return progress;
  return ecdfPercentile(model.sorted_scores, progress);
}
