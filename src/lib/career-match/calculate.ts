import { heldSkillIds, layeredSkillProgress } from "./skill-layers";
import { migrateLegacySkillIds, type SkillMigrationMapping } from "./skill-migration";
import { scoreSkill, selectSkillScoringModel } from "./skill-score";
import {
  DEGREES,
  type CareerMatchResult,
  type CareerStatistics,
  type Certification,
  type Confidence,
  type EducationStatisticsRow,
  type EvidenceMode,
  type GoalSkillLayers,
  type HumanSkill,
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

// 例：stack_overflow_developer_survey:2023-2025:0.3.0:k=80.9（k は再生成のたびにデータから推定し直すため含める）
export function skillStatisticsVersion(
  stats: Pick<SkillStatistics, "source" | "source_years" | "calculation_version" | "region">,
): string {
  return `${stats.source}:${stats.source_years.join("-")}:${stats.calculation_version}:k=${stats.region.prior_strength}`;
}

// scripts/build_career_statistics.py の round_years と一致させること
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

// 複合 Goal では、経験していない Group は統計上どれだけ近くてもこの値まで（両方の経験があって初めて 100）
export const COMPOSITE_UNMET_GROUP_CAP = 50;

// Group の職業の経験があれば 100。無ければ min(cap, Σ Contribution(該当 Unit) / reference × 100)
export function groupAchievement(
  group: RequirementGroupStatistics,
  experiences: readonly UserExperience[],
  cap = 100,
): number {
  const years = userYearsByRole(experiences);
  if (group.occupations.some((code) => years.has(code))) return 100;
  const keys = userExperienceKeys(experiences);
  const matched = group.experience.reduce(
    (sum, row) => (keys.has(experienceUnitKey(row.role_id, row.years)) ? sum + row.contribution : sum),
    0,
  );
  return Math.min(cap, (matched / group.experience_reference) * 100);
}

// Experience = Requirement Group 達成率の平均（Goal は Group の AND）
export function experienceMatch(
  stats: Pick<CareerStatistics, "requirement_groups">,
  experiences: readonly UserExperience[],
): { value: number | null; coverage: number } {
  const groups = stats.requirement_groups;
  const computable = groups.length > 0 && groups.every((g) => g.experience.length > 0 && g.experience_reference > 0);
  if (!computable) return { value: null, coverage: 0 };

  const cap = groups.length > 1 ? COMPOSITE_UNMET_GROUP_CAP : 100;
  const achievements = groups.map((group) => groupAchievement(group, experiences, cap));
  return {
    value: achievements.reduce((sum, value) => sum + value, 0) / groups.length,
    coverage: satisfiedGroupIds(groups, experiences).size / groups.length,
  };
}

// Contribution が最大の学歴を 100 とする
export function educationMatch(
  rows: readonly Pick<EducationStatisticsRow, "degree_id" | "contribution">[] | undefined,
  degreeId: string | null,
): number | null {
  if (!rows || rows.length === 0) return null;
  const max = Math.max(...rows.map((row) => row.contribution));
  if (!(max > 0)) return null;
  const user = rows.find((row) => row.degree_id === degreeId)?.contribution ?? 0;
  return Math.min(100, (user / max) * 100);
}

export function goalMatch(categories: readonly (number | null)[]): number {
  const available = categories.filter((value): value is number => value !== null);
  if (available.length === 0) throw new Error("No category is available for Goal Match");
  return available.reduce((sum, value) => sum + value, 0) / available.length;
}

export function evidenceMode(stats: CareerStatistics): EvidenceMode {
  if (stats.goal_sample_size === 0) return "skill_only";
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

  const mode = evidenceMode(stats);
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
  if (mode !== "skill_only") {
    ({ value: experience, coverage } = experienceMatch(stats, validExperiences));
    education = educationMatch(stats.education, degreeIsKnown ? input.degree_id : null);
  }

  return {
    goal_id: stats.goal_id,
    goal_match: goalMatch([skillScore, experience, education]),
    skill_match: skillScore,
    skill_progress: layered.progress,
    skill_scoring_method: skillModel.method,
    skill_calculation_version: SKILL_CALCULATION_VERSION,
    skill_statistics_version:
      skill.techStats && layered.tech_progress !== null ? skillStatisticsVersion(skill.techStats) : null,
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
