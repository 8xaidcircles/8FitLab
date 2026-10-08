import type {
  SkillProgressDistribution,
  SkillScoringModel,
  SkillScoringVersions,
  SkillStatistics,
  SkillStatisticsUnit,
  TechSkillStatistics,
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
  /** 技術スキル層の達成率に占める割合（0〜100）。満たせばこの分だけ技術スキル層の達成率が上がる */
  share: number;
}

export interface SkillListWeights {
  base_total: number;
  distinctive_total: number;
  /** 適用した β。片方のリストの重みが 0 の Goal では、もう片方のリストを 100% にする（0 か 1） */
  beta: number;
}

// 採用 unit の重みの合計と、適用する β（統計の distinctive_share）
export function skillListWeights(stats: TechSkillStatistics): SkillListWeights {
  const units = goalSkillUnits(stats);
  // 重みが NaN だと合計が NaN になり「リストが無い」とみなされて β が 0 か 1 に倒れるため、unit ごとに検証する
  for (const unit of units) {
    for (const weight of [unit.base_weight, unit.distinctive_weight]) {
      if (!(Number.isFinite(weight) && weight >= 0)) {
        throw new Error(`Invalid weight for ${stats.goal_id}/${unit.unit_id}: ${weight}`);
      }
    }
    if (unit.roles.length === 0) throw new Error(`Selected unit ${stats.goal_id}/${unit.unit_id} has no roles`);
  }
  const base_total = units.reduce((sum, unit) => sum + unit.base_weight, 0);
  const distinctive_total = units.reduce((sum, unit) => sum + unit.distinctive_weight, 0);
  const share = stats.selection.distinctive_share;
  // β は全 Goal 共通の値。片方のリストしか無く β を使わない Goal でも検証し、統計ファイルの破損を早く見つける
  if (!(Number.isFinite(share) && share >= 0 && share <= 1)) {
    throw new Error(`Invalid distinctive_share for ${stats.goal_id}: ${share}`);
  }
  if (!(base_total > 0) && !(distinctive_total > 0)) {
    throw new Error(`Skill statistics for ${stats.goal_id} have no selected units`);
  }
  const beta = !(distinctive_total > 0) ? 0 : !(base_total > 0) ? 1 : share;
  return { base_total, distinctive_total, beta };
}

// Goal Skill（採用された unit）ごとの充足状況。割合の大きい順。
// 割合 = (1 − β) × base_weight / base_total + β × distinctive_weight / distinctive_total（× 100）
export function skillUnitGaps(stats: TechSkillStatistics, userSkillIds: Iterable<string>): SkillUnitGap[] {
  const { base_total, distinctive_total, beta } = skillListWeights(stats);
  const ids = new Set(userSkillIds);
  const share = (unit: SkillStatisticsUnit) =>
    ((base_total > 0 ? (1 - beta) * (unit.base_weight / base_total) : 0) +
      (distinctive_total > 0 ? beta * (unit.distinctive_weight / distinctive_total) : 0)) *
    100;
  return goalSkillUnits(stats)
    .map((unit) => ({ unit, satisfied: skillUnitSatisfied(unit, ids), share: share(unit) }))
    .sort((a, b) => b.share - a.share);
}

// 技術スキル層の達成率（0〜100）=（1 − β）× 基本達成率 + β × 特有達成率
// 基本達成率 = Σ base_weight(満たした unit) / base_total × 100、特有達成率 = Σ distinctive_weight(満たした unit) / distinctive_total × 100
export function weightedSkillProgress(stats: TechSkillStatistics, userSkillIds: Iterable<string>): number {
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
