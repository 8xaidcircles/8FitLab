import { heldSkillIds, layeredSkillProgress } from "./skill-layers";
import { migrateLegacySkillIds, type SkillMigrationMapping } from "./skill-migration";
import { scoreSkill, selectSkillScoringModel } from "./skill-score";
import {
  DEGREES,
  type CareerMatchResult,
  type CareerStatistics,
  type Certification,
  type Confidence,
  type DegreeId,
  type EvidenceMode,
  type GoalSkillLayers,
  type HumanSkill,
  type OccupationTenure,
  type RequirementGroup,
  type RequirementGroupStatistics,
  type SkillLayerWeights,
  type SkillProgressDistribution,
  type SkillStatistics,
  type UserExperience,
  type UserInput,
} from "./types";

export const SMALL_SAMPLE_THRESHOLD = 100;
export const MAX_YEARS = 50;
/** Skill の計算方式（技術スキル層 × 人間定義層）。保存済みの結果で NULL のものは旧方式（Learning Step の達成率） */
export const SKILL_CALCULATION_VERSION = "layered-1.0.0";

export interface KnownIds {
  /** 技術スキル層・人間定義層の skill_id と、人間定義層のツールの tool_id */
  skillIds: ReadonlySet<string>;
  certificationIds: ReadonlySet<string>;
  roleIds: ReadonlySet<string>;
}

/** Skill Progress の計算に使う Goal ごとの定義 */
export interface SkillContext {
  /** Stack Overflow の技術スキル統計。無い Goal は null（人間定義層 100% になる） */
  techStats: SkillStatistics | null;
  goalLayers: GoalSkillLayers;
  defaultWeights: SkillLayerWeights;
  humanSkills: readonly HumanSkill[];
  certifications: readonly Certification[];
  skillMigration: readonly SkillMigrationMapping[];
}

export interface ResolvedUserSkills {
  /** ユーザーが持つとみなす skill_id。Skill Match・Skill Gap・Learning Path はすべてこの集合で判定する */
  held: Set<string>;
  /** マスタに無い skill_id / tool_id */
  ignoredSkillIds: string[];
  ignoredCertificationIds: string[];
  /** 移行先を 1 つに決められない旧 skill_id（split）。計算には使わず、再入力を案内する */
  legacySkillIds: string[];
}

// 入力を「旧 skill_id の移行 → マスタに無い ID の除外 → 資格・ツールの展開」の順に解決する
export function resolveUserSkills(
  input: Pick<UserInput, "skill_ids" | "certification_ids">,
  skill: Pick<SkillContext, "humanSkills" | "certifications" | "skillMigration">,
  known: Pick<KnownIds, "skillIds" | "certificationIds">,
): ResolvedUserSkills {
  const migrated = migrateLegacySkillIds(new Set(input.skill_ids), skill.skillMigration);
  const certificationIds = [...new Set(input.certification_ids)];
  const validCertificationIds = certificationIds.filter((id) => known.certificationIds.has(id));
  return {
    held: heldSkillIds(
      { skillIds: migrated.skillIds.filter((id) => known.skillIds.has(id)), certificationIds: validCertificationIds },
      skill,
    ),
    ignoredSkillIds: migrated.skillIds.filter((id) => !known.skillIds.has(id)),
    ignoredCertificationIds: certificationIds.filter((id) => !known.certificationIds.has(id)),
    legacySkillIds: migrated.unresolved,
  };
}

// 例：stack_overflow_developer_survey:2023-2024-2025:0.3.1:k=80.9（k は再生成のたびにデータから推定し直すため含める）
export function skillStatisticsVersion(
  stats: Pick<SkillStatistics, "source" | "source_years" | "calculation_version" | "region">,
): string {
  return `${stats.source}:${stats.source_years.join("-")}:${stats.calculation_version}:k=${stats.region.prior_strength}`;
}

// scripts/build_career_statistics.py の round_years と一致させること（data/fixtures/career-match/cross-language.json で両方を検証）
export function roundYears(years: number): number {
  return Math.min(MAX_YEARS, Math.max(0.5, Math.floor(years * 2 + 0.5) / 2));
}

export function experienceUnitKey(roleId: string, years: number): string {
  return `${roleId}__${years.toFixed(1)}`;
}

export function quality(pGoal: number, pOther: number): number {
  const total = pGoal + pOther;
  return total === 0 ? 0 : (pGoal / total) * 100;
}

export function contribution(quantity: number, qualityValue: number): number {
  return quantity * (qualityValue / 100);
}

// 同一 Role の複数入力は年数を合算してから丸める
export function userYearsByRole(experiences: readonly UserExperience[]): Map<string, number> {
  const yearsByRole = new Map<string, number>();
  for (const { role_id, years } of experiences) {
    if (!Number.isFinite(years) || years <= 0) continue;
    yearsByRole.set(role_id, (yearsByRole.get(role_id) ?? 0) + years);
  }
  return new Map([...yearsByRole].map(([roleId, years]) => [roleId, roundYears(years)]));
}

// Unit は「Role × years 年以上」なので、Y 年の経験は 0.5〜Y 年のすべての Unit に該当する
export function userExperienceKeys(experiences: readonly UserExperience[]): Set<string> {
  const keys = new Set<string>();
  for (const [roleId, years] of userYearsByRole(experiences)) {
    for (let half = 1; half <= years * 2; half++) keys.add(experienceUnitKey(roleId, half / 2));
  }
  return keys;
}

export function satisfiedGroupIds(
  groups: readonly RequirementGroup[],
  experiences: readonly UserExperience[],
): Set<string> {
  const years = userYearsByRole(experiences);
  return new Set(groups.filter((g) => g.occupations.some((code) => years.has(code))).map((g) => g.group_id));
}

// 複合 Goal では、Group の職業を経験していない Group は、前職歴が統計上どれだけ近くてもこの値まで
export const COMPOSITE_UNMET_GROUP_CAP = 50;

// Group 内の職業は OR なので、職業ごとの年数を合算してから丸める（統計側の occupation_tenure と同じ数え方）
export function groupOccupationYears(group: RequirementGroup, experiences: readonly UserExperience[]): number {
  const total = experiences
    .filter((e) => group.occupations.includes(e.role_id) && Number.isFinite(e.years) && e.years > 0)
    .reduce((sum, e) => sum + e.years, 0);
  return total > 0 ? roundYears(total) : 0;
}

export function isTenureCalculable(tenure: OccupationTenure | null | undefined): tenure is OccupationTenure {
  return (
    !!tenure &&
    Array.isArray(tenure.distribution) &&
    tenure.distribution.length > 0 &&
    Number.isFinite(tenure.sample_size) &&
    tenure.sample_size > 0
  );
}

// Group Population の在職年数の分布上のパーセンタイル（同率は中央順位）
export function tenurePercentile(tenure: OccupationTenure, years: number): number {
  let below = 0;
  let equal = 0;
  for (const row of tenure.distribution) {
    if (row.years < years) below += row.persons;
    else if (row.years === years) equal += row.persons;
  }
  return Math.min(100, ((below + 0.5 * equal) / tenure.sample_size) * 100);
}

export type ExperienceUnavailableReason =
  | "NO_REQUIREMENT_GROUPS"
  | "NO_EXPERIENCE_UNITS"
  | "INSUFFICIENT_REFERENCE_DATA";

// 前職歴による評価の可否。統計生成は、前職歴のある人が 2 人未満・パーセンタイルが 0 以下・非有限なら
// experience_reference = 0 を出す（§56 Statistics Build）。JSON の欠落（undefined / null）も同じく算出不可として扱い、割り算に進ませない
export function groupUnavailableReason(
  group: Pick<RequirementGroupStatistics, "experience" | "experience_reference">,
): ExperienceUnavailableReason | null {
  if (!Array.isArray(group.experience) || group.experience.length === 0) return "NO_EXPERIENCE_UNITS";
  const reference = group.experience_reference as number | null | undefined;
  if (typeof reference !== "number" || !Number.isFinite(reference) || reference <= 0) return "INSUFFICIENT_REFERENCE_DATA";
  return null;
}

function preGoalAchievement(group: RequirementGroupStatistics, experiences: readonly UserExperience[]): number | null {
  if (groupUnavailableReason(group) !== null) return null;
  const keys = userExperienceKeys(experiences);
  const matched = group.experience.reduce(
    (sum, row) => (keys.has(experienceUnitKey(row.role_id, row.years)) ? sum + row.contribution : sum),
    0,
  );
  return (matched / group.experience_reference) * 100;
}

// 前職歴：Σ Contribution(該当 Unit) / reference × 100。Group の職業の経験が無い Group はこれだけで、cap まで。
// Group の職業の経験がある Group は、在職年数のパーセンタイルと前職歴（100 まで）の高いほう。
// 使える評価がどちらも統計から算出できなければ null
export function groupAchievement(
  group: RequirementGroupStatistics,
  experiences: readonly UserExperience[],
  cap = 100,
): number | null {
  const preGoal = preGoalAchievement(group, experiences);
  const years = groupOccupationYears(group, experiences);
  if (years === 0) return preGoal === null ? null : Math.min(cap, preGoal);
  const tenure = isTenureCalculable(group.occupation_tenure) ? tenurePercentile(group.occupation_tenure, years) : null;
  if (tenure === null && preGoal === null) return null;
  return Math.max(tenure ?? 0, Math.min(100, preGoal ?? 0));
}

export type ExperienceMatchResult =
  | { value: number; coverage: number; unavailable_reason?: undefined }
  | { value: null; coverage: 0; unavailable_reason: ExperienceUnavailableReason };

// Experience = Requirement Group 達成率の平均（Goal は Group の AND）。
// どれか 1 つの Group でも算出できなければ Experience 全体を算出不可（null）とし、Goal Match の分母から外す。
// 算出できる Group だけで平均すると、複合 Goal（Full-Stack など）を片方の Group だけで評価して高く出るため
export function experienceMatch(
  stats: Pick<CareerStatistics, "requirement_groups">,
  experiences: readonly UserExperience[],
): ExperienceMatchResult {
  const groups = stats.requirement_groups;
  if (groups.length === 0) return { value: null, coverage: 0, unavailable_reason: "NO_REQUIREMENT_GROUPS" };

  const cap = groups.length > 1 ? COMPOSITE_UNMET_GROUP_CAP : 100;
  const achievements: number[] = [];
  for (const group of groups) {
    const value = groupAchievement(group, experiences, cap);
    if (value === null) return { value: null, coverage: 0, unavailable_reason: groupUnavailableReason(group)! };
    achievements.push(value);
  }
  return {
    value: achievements.reduce((sum, value) => sum + value, 0) / groups.length,
    coverage: satisfiedGroupIds(groups, experiences).size / groups.length,
  };
}

/** この calculation_version 以降の Education Match は最低教育要件方式（それより前は Contribution 最大の学歴を 100 とする方式） */
export const EDUCATION_REQUIREMENT_SINCE = "2.4.0";

export function usesEducationRequirement(calculationVersion: string): boolean {
  const [actual, since] = [calculationVersion, EDUCATION_REQUIREMENT_SINCE].map((v) => v.split(".").map(Number));
  for (let i = 0; i < since.length; i++) {
    if (actual[i] !== since[i]) return (actual[i] ?? 0) > since[i];
  }
  return true;
}

// 最低教育要件以上は 100。要件未満は、Goal Population のうち「その学歴以下」だった人の割合 × 100
// （要件以上の人が 50% を超えるので 50 未満に収まり、学歴が低いほど下がる）
export function educationMatch(
  stats: Pick<CareerStatistics, "minimum_education" | "education_at_or_above">,
  degreeId: string | null,
): number | null {
  const { minimum_education: minimum, education_at_or_above: atOrAbove } = stats;
  if (!minimum || !atOrAbove) return null;
  const rank = DEGREES.indexOf(degreeId as DegreeId);
  if (rank < 0) return 0;
  if (rank >= DEGREES.indexOf(minimum)) return 100;
  const nextDegree = DEGREES[rank + 1];
  if (!nextDegree) return 0;
  return (1 - atOrAbove[nextDegree]) * 100;
}

export function goalMatch(categories: readonly (number | null)[]): number {
  const available = categories.filter((value): value is number => value !== null);
  if (available.length === 0) throw new Error("No category is available for Goal Match");
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

// full / proxy は、観測データ（Experience・Education）の少なくとも一方を算出できた場合だけ。
// Goal Population > 0 でも両方とも算出不可なら、Skill だけで算出しているため skill_only
export function evidenceMode(
  stats: Pick<CareerStatistics, "goal_sample_size" | "mapping_status">,
  observed: { experience: number | null; education: number | null },
): EvidenceMode {
  if (stats.goal_sample_size === 0) return "skill_only";
  if (observed.experience === null && observed.education === null) return "skill_only";
  return stats.mapping_status === "exact" ? "full" : "proxy";
}

export function confidence(mode: EvidenceMode, goalSampleSize: number): Confidence {
  if (mode === "skill_only" || goalSampleSize < SMALL_SAMPLE_THRESHOLD) return "low";
  return mode === "full" ? "moderate" : "moderate_low";
}

export function calculateCareerMatch(
  input: UserInput,
  stats: CareerStatistics,
  skill: SkillContext,
  known: KnownIds,
  skillDistribution: SkillProgressDistribution | null = null,
): CareerMatchResult {
  if (stats.goal_id !== skill.goalLayers.goal_id) {
    throw new Error(`Goal mismatch: statistics=${stats.goal_id}, skill layers=${skill.goalLayers.goal_id}`);
  }
  if (skillDistribution && skillDistribution.goal_id !== stats.goal_id) {
    throw new Error(`Goal mismatch: skill distribution=${skillDistribution.goal_id}, statistics=${stats.goal_id}`);
  }

  const skills = resolveUserSkills(input, skill, known);

  const ignoredRoleIds = [...new Set(input.experiences.map((e) => e.role_id))].filter(
    (id) => !known.roleIds.has(id),
  );
  const validExperiences = input.experiences.filter((e) => known.roleIds.has(e.role_id));

  const degreeIsKnown = input.degree_id !== null && (DEGREES as readonly string[]).includes(input.degree_id);
  const ignoredDegreeId = input.degree_id !== null && !degreeIsKnown ? input.degree_id : null;

  const layered = layeredSkillProgress({
    held: skills.held,
    techStats: skill.techStats,
    goalLayers: skill.goalLayers,
    defaultWeights: skill.defaultWeights,
  });
  const skillModel = selectSkillScoringModel(skillDistribution);
  const skillScore = scoreSkill(layered.progress, skillModel);

  let experience: number | null = null;
  let coverage = 0;
  let education: number | null = null;
  if (stats.goal_sample_size > 0) {
    ({ value: experience, coverage } = experienceMatch(stats, validExperiences));
    education = educationMatch(stats, degreeIsKnown ? input.degree_id : null);
  }
  const mode = evidenceMode(stats, { experience, education });

  return {
    goal_id: stats.goal_id,
    goal_match: goalMatch([skillScore, experience, education]),
    skill_match: skillScore,
    skill_progress: layered.progress,
    skill_scoring_method: skillModel.method,
    skill_calculation_version: SKILL_CALCULATION_VERSION,
    // 配分 0 の Goal でも技術層は計算するが、結果が依存しない統計の由来は残さない
    skill_statistics_version:
      skill.techStats && layered.tech_progress !== null && layered.weights.tech > 0
        ? skillStatisticsVersion(skill.techStats)
        : null,
    tech_skill_progress: layered.tech_progress,
    human_skill_progress: layered.human_progress,
    skill_layer_weights: layered.weights,
    experience_match: experience,
    experience_goal_coverage: coverage,
    education_match: education,
    evidence_mode: mode,
    confidence: confidence(mode, stats.goal_sample_size),
    goal_sample_size: stats.goal_sample_size,
    small_sample: stats.goal_sample_size < SMALL_SAMPLE_THRESHOLD,
    calculation_version: stats.calculation_version,
    data_source_version: `${stats.source}:${stats.source_version}`,
    taxonomy_version: `${stats.taxonomy}:${stats.taxonomy_version}`,
    ignored: {
      skill_ids: skills.ignoredSkillIds,
      legacy_skill_ids: skills.legacySkillIds,
      certification_ids: skills.ignoredCertificationIds,
      role_ids: ignoredRoleIds,
      degree_id: ignoredDegreeId,
    },
  };
}
