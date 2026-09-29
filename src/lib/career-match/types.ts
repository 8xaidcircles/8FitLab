export const DEGREES = ["None", "Secondary school", "Bachelor", "Master", "PhD"] as const;
export type DegreeId = (typeof DEGREES)[number];

export type MappingStatus = "exact" | "proxy";
export type EvidenceMode = "full" | "proxy" | "skill_only";
export type Confidence = "moderate" | "moderate_low" | "low";

export interface LearningStep {
  learning_order: number;
  step_id: string;
  name: string;
  any_of: string[];
}

export interface LearningPathMaster {
  goal_id: string;
  region: string;
  version: string;
  steps: LearningStep[];
}

export interface StatisticsRow {
  unit_id: string;
  p_unit_given_goal: number;
  p_unit_given_other: number;
  quantity: number;
  quality: number;
  contribution: number;
}

export interface ExperienceStatisticsRow extends StatisticsRow {
  role_id: string;
  years: number;
}

export interface EducationStatisticsRow extends StatisticsRow {
  degree_id: string;
}

/** Goal = Group の AND。Group 内の職業は OR（どれか 1 つで Group を満たす） */
export interface RequirementGroup {
  group_id: string;
  occupations: string[];
}

/** Requirement Group を単独の Goal とみなした Experience 統計 */
export interface RequirementGroupStatistics extends RequirementGroup {
  /** Group の職業に就いた時期が分かる人数 */
  goal_sample_size: number;
  /** Group Population のうち、Group の職業に就く前の職歴がある人数 */
  pre_goal_experience_persons: number;
  /** Group 達成率 = 100 とする Σ Contribution（前職歴の Σ Contribution のパーセンタイル） */
  experience_reference: number;
  /** Unit = Role × 「years 年以上」（Group の職業に就く前の職歴のみ） */
  experience: ExperienceStatisticsRow[];
}

export interface CareerStatistics {
  goal_id: string;
  mapping_status: MappingStatus;
  goal_occupations: string[];
  /** 全 Group を満たした人数（Education・Confidence の母数） */
  goal_sample_size: number;
  other_sample_size: number;
  /** 全 Group を満たすが開始日が無く Goal 前後を区別できないため、Goal / Other のどちらにも入れなかった人数 */
  undated_goal_persons: number;
  small_sample: boolean;
  source: string;
  source_version: string;
  taxonomy: string;
  taxonomy_version: string;
  calculation_version: string;
  calculation_date: string;
  experience_reference_percentile: number;
  /** パーセンタイルの推定方法（母数が少ない Group でも安定する Harrell-Davis 推定量） */
  experience_reference_estimator: "harrell-davis";
  requirement_groups: RequirementGroupStatistics[];
  education?: EducationStatisticsRow[];
}

export interface SkillUnitMember {
  skill_id: string;
  name: string;
  so_item: string;
  p_skill_given_goal: number;
  region_p_skill_given_goal: number;
}

/**
 * Skill Statistics の評価単位。group はメンバーのどれか 1 つを持っていれば満たす（代わりのきく技術）。
 * skill はメンバーが 1 つだけ
 */
export interface SkillStatisticsUnit {
  unit_id: string;
  type: "group" | "skill";
  name: string;
  category?: string;
  /** group は日本補正後の P(技術 | Goal) の大きい順 */
  members: SkillUnitMember[];
  source_years: number[];
  goal_respondents: number;
  other_respondents: number;
  p_skill_given_goal: number;
  p_skill_given_other: number;
  region_source_years: number[];
  region_goal_respondents: number;
  region_other_respondents: number;
  region_p_skill_given_goal: number;
  region_p_skill_given_other: number;
  /** 以下 3 つは日本補正後の値 */
  quantity: number;
  quality: number;
  contribution: number;
  /** 世界の P(unit | Goal) > P(unit | Other) の片側検定 */
  p_value: number;
  significant: boolean;
  /** Goal Skill として採用（Skill Match の対象） */
  selected: boolean;
}

/** scripts/build_skill_statistics.py が Stack Overflow Developer Survey から事前計算する技術スキル統計 */
export interface SkillStatistics {
  goal_id: string;
  mapping_status: MappingStatus;
  devtypes: Record<string, string[]>;
  source: string;
  source_years: number[];
  /** Stack Overflow Developer Survey（ODbL）の派生データベースとしてのライセンス表示 */
  license: {
    name: string;
    url: string;
    contents_license: string;
    contents_url: string;
    attribution: string;
    modifications: string;
  };
  calculation_version: string;
  calculation_date: string;
  min_reliable_sample: number;
  region: { country: string; method: string; prior_strength: number };
  selection: {
    alpha: number;
    correction: string;
    significance_scope: string;
    cumulative_share: number;
    contribution_scope: string;
  };
  units: SkillStatisticsUnit[];
}

export type HumanSkillDomain = "methodology_process" | "knowledge_concepts" | "management_business_tools";

/** 人間定義層のスキル。tools（調査に無いツール）のどれかを使っていればこのスキルを持つとみなす */
export interface HumanSkill {
  skill_id: string;
  name: string;
  domain: HumanSkillDomain;
  description: string;
  tools?: { tool_id: string; name: string }[];
}

/** 資格。proves のスキル（人間定義層・技術スキル層のどちらでもよい）を持っていることの証明 */
export interface Certification {
  cert_id: string;
  name: string;
  issuer: string;
  proves: string[];
}

/** 人間定義層の要件。any_of のどれか 1 つを持っていれば満たす */
export interface HumanRequirement {
  requirement_id: string;
  name?: string;
  any_of: string[];
}

/** 文字列は人間定義層のスキル 1 つだけの要件 */
export type HumanRequirementDefinition = string | HumanRequirement;

/** Skill Progress における技術スキル層・人間定義層の配分 */
export interface SkillLayerWeights {
  tech: number;
  human: number;
}

export interface GoalSkillLayers {
  goal_id: string;
  /** 省略時は default_layer_weights */
  layer_weights?: SkillLayerWeights;
  layer_weight_reason?: string;
  human_requirements: HumanRequirementDefinition[];
}

export interface SkillLayersMaster {
  default_layer_weights: SkillLayerWeights;
  default_layer_weight_reason?: string;
  goals: GoalSkillLayers[];
}

/** Goal ごとの全ユーザーの Skill 達成率（0〜100）。蓄積データから集計する（1 ユーザー 1 値。§11） */
export interface SkillProgressDistribution {
  goal_id: string;
  scores: readonly number[];
}

/**
 * linear：達成率をそのまま Skill Match とする（コールドスタート期）
 * ecdf：全ユーザーの達成率の経験分布上のパーセンタイル（同率は中央順位）を Skill Match とする。分布の形を仮定しない
 */
export type SkillScoringModel =
  | { method: "linear" }
  | { method: "ecdf"; sorted_scores: readonly number[]; sample_size: number };

export type SkillScoringMethod = SkillScoringModel["method"];

export interface UserExperience {
  role_id: string;
  years: number;
}

export interface UserInput {
  /** 技術スキル層・人間定義層の skill_id と、人間定義層のツールの tool_id */
  skill_ids: string[];
  certification_ids: string[];
  experiences: UserExperience[];
  degree_id: string | null;
}

export type SkillLayerWeightSource = "default" | "goal" | "fallback";

export interface ResolvedSkillLayerWeights extends SkillLayerWeights {
  /** default：既定の配分 / goal：Goal ごとの配分 / fallback：片方の層が計算できないため、もう片方を 100% にした */
  source: SkillLayerWeightSource;
}

/** Assessment 保存時の Skill の内訳（保存済みの結果で旧方式のものは null） */
export interface StoredSkillBreakdown {
  skill_calculation_version: string;
  skill_statistics_version: string | null;
  skill_progress: number;
  tech_skill_progress: number | null;
  human_skill_progress: number | null;
  skill_layer_weights: ResolvedSkillLayerWeights;
}

export interface CareerMatchResult {
  goal_id: string;
  goal_match: number;
  skill_match: number;
  /** 2 層を配分で合算した達成率（0〜100）。skill_match はこれを skill_scoring_method で変換した値 */
  skill_progress: number;
  skill_scoring_method: SkillScoringMethod;
  skill_calculation_version: string;
  /** 技術スキル層に使った Skill Statistics の由来（出典:年:計算バージョン:k）。技術スキル層を計算できない Goal は null */
  skill_statistics_version: string | null;
  /** 技術スキル層（Stack Overflow の Contribution 加重）の達成率。計算できない Goal は null */
  tech_skill_progress: number | null;
  /** 人間定義層（要件の充足率）の達成率。要件が無い Goal は null */
  human_skill_progress: number | null;
  skill_layer_weights: ResolvedSkillLayerWeights;
  experience_match: number | null;
  /** 経験で満たした Requirement Group の割合（0〜1）。1 なら Goal 到達済みとして Experience = 100 */
  experience_goal_coverage: number;
  education_match: number | null;
  evidence_mode: EvidenceMode;
  confidence: Confidence;
  goal_sample_size: number;
  small_sample: boolean;
  calculation_version: string;
  data_source_version: string;
  taxonomy_version: string;
  ignored: {
    skill_ids: string[];
    /** 移行先を 1 つに決められない旧 skill_id（split） */
    legacy_skill_ids: string[];
    certification_ids: string[];
    role_ids: string[];
    degree_id: string | null;
  };
}

export interface SkillGapStep extends LearningStep {
  satisfied: boolean;
}

/**
 * Skill Gap を Skill Match との関係で分けたもの（どちらも learning_order 順）。
 * data_driven：Skill Match の達成率に効く Step（技術スキル層の採用 unit、または配分のある人間定義層の要件を含む）
 * checklist：Skill Match には効かない前提・基本要件（Git など。学習順には必要だがスコアの分母に含まない）
 */
export interface SkillGap {
  data_driven: (SkillGapStep & { scored_options: string[] })[];
  checklist: SkillGapStep[];
}
