import "server-only";
import { loadSkillMigration } from "@/lib/career-match/data";
import { migrateLegacySkillIds } from "@/lib/career-match/skill-migration";
import { createClient } from "@/lib/supabase/server";
import {
  LEGACY_SKIPPED_VALUE,
  SKIPPED_EDUCATION_LEVEL_ID,
  type CareerMatchResult,
  type CertificationStatus,
  type Confidence,
  type EvidenceMode,
  type ExperienceStatus,
  type LearningStep,
  type SkillStatus,
  type StoredSkillBreakdown,
} from "@/lib/career-match/types";
import type { AssessmentSubmission } from "./validate";

export interface SaveAssessmentArgs {
  anonymousUserId: string;
  submission: AssessmentSubmission;
  result: CareerMatchResult;
  // 未習得の Learning Step（learning_order 順）。Skill Gap と Learning Path の両方に保存する
  missingSteps: LearningStep[];
  /** missingSteps の判定に使った Learning Path Master の version */
  learningPathVersion: string;
}

export interface StoredAssessment {
  id: string;
  goal_id: string;
  created_at: string;
  /** 旧 skill_id は新しい skill_id に変換済み */
  skill_ids: string[];
  /** 移行先を 1 つに決められない旧 skill_id（例：backend-framework）。計算・表示の対象外 */
  legacy_skill_ids: string[];
  /** スキルを選ばなかった理由。スキルを選んだ結果と、この項目を保存する前の結果は null */
  skill_status: SkillStatus | null;
  certification_ids: string[];
  /** 資格を選ばなかった理由。資格を選んだ結果と、この項目を保存する前の結果は null */
  certification_status: CertificationStatus | null;
  /** 職歴の入力を必須にする前に保存した結果は null */
  experience_status: ExperienceStatus | null;
  experiences: { role_id: string; years: number }[];
  education_level_id: string | null;
  degree_id: string | null;
  career_match: {
    goal_match: number;
    skill_match: number;
    experience_match: number | null;
    education_match: number | null;
    evidence_mode: EvidenceMode;
    confidence: Confidence;
    goal_sample_size: number;
    calculation_version: string;
    data_source_version: string;
    taxonomy_version: string;
    /** 旧方式（Learning Step の達成率）で計算した結果は null */
    skill: StoredSkillBreakdown | null;
  };
  learning_path: { step_id: string; learning_order: number }[];
}

function fail(action: string, error: { message: string }): never {
  throw new Error(`Failed to ${action}: ${error.message}`);
}

const toNumber = (value: unknown) => (value === null ? null : Number(value));

// マイグレーション SQL の実行前に保存された「回答をスキップする」（旧値 unknown）を読み出し時に変換する
const fromLegacySkipped = <T extends string>(value: string | null, skipped: T): T | null =>
  value === LEGACY_SKIPPED_VALUE ? skipped : (value as T | null);

export async function saveAssessment({
  anonymousUserId,
  submission,
  result,
  missingSteps,
  learningPathVersion,
}: SaveAssessmentArgs): Promise<string> {
  const supabase = createClient();

  const { data: session, error: sessionError } = await supabase
    .from("assessment_sessions")
    .insert({
      anonymous_user_id: anonymousUserId,
      goal_id: submission.goal_id,
      experience_status: submission.experience_status,
      skill_status: submission.skill_status,
      certification_status: submission.certification_status,
      calculation_version: result.calculation_version,
      data_source_version: result.data_source_version,
      taxonomy_version: result.taxonomy_version,
    })
    .select("id")
    .single();
  if (sessionError) fail("create assessment session", sessionError);

  const assessmentId: string = session.id;
  const steps = missingSteps.map((step) => ({
    assessment_id: assessmentId,
    step_id: step.step_id,
    learning_order: step.learning_order,
  }));

  const inserts = [
    supabase.from("career_match_results").insert({
      assessment_id: assessmentId,
      goal_match: result.goal_match,
      skill_match: result.skill_match,
      experience_match: result.experience_match,
      education_match: result.education_match,
      evidence_mode: result.evidence_mode,
      confidence: result.confidence,
      goal_sample_size: result.goal_sample_size,
      calculation_version: result.calculation_version,
      data_source_version: result.data_source_version,
      taxonomy_version: result.taxonomy_version,
      skill_calculation_version: result.skill_calculation_version,
      skill_statistics_version: result.skill_statistics_version,
      skill_progress: result.skill_progress,
      tech_skill_progress: result.tech_skill_progress,
      human_skill_progress: result.human_skill_progress,
      skill_weight_tech: result.skill_layer_weights.tech,
      skill_weight_human: result.skill_layer_weights.human,
      skill_weight_source: result.skill_layer_weights.source,
      skill_scoring_method: result.skill_scoring_method,
      skill_distribution_sample_size: result.skill_distribution_sample_size,
      skill_distribution_version: result.skill_distribution_version,
    }),
  ];
  if (submission.skill_ids.length > 0) {
    inserts.push(
      supabase
        .from("assessment_skills")
        .insert(submission.skill_ids.map((skill_id) => ({ assessment_id: assessmentId, skill_id }))),
    );
  }
  if (submission.certification_ids.length > 0) {
    inserts.push(
      supabase
        .from("assessment_certifications")
        .insert(submission.certification_ids.map((cert_id) => ({ assessment_id: assessmentId, cert_id }))),
    );
  }
  if (submission.experiences.length > 0) {
    inserts.push(
      supabase
        .from("assessment_experiences")
        .insert(submission.experiences.map((e) => ({ assessment_id: assessmentId, role_id: e.role_id, years: e.years }))),
    );
  }
  inserts.push(
    supabase.from("assessment_education").insert({
      assessment_id: assessmentId,
      education_level_id: submission.education_level_id,
      degree_id: submission.degree_id,
    }),
  );
  if (steps.length > 0) {
    inserts.push(supabase.from("skill_gap_results").insert(steps));
    inserts.push(
      supabase
        .from("learning_path_results")
        .insert(steps.map((step) => ({ ...step, learning_path_version: learningPathVersion }))),
    );
  }

  const results = await Promise.all(inserts);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    // 子テーブルは ON DELETE CASCADE のため、セッションを消せば途中まで書いた行も消える
    await supabase.from("assessment_sessions").delete().eq("id", assessmentId);
    fail("save assessment", failed.error);
  }

  return assessmentId;
}

// 他人の Assessment を読めないよう、必ず anonymous_user_id と組で取得する
export async function getAssessment(assessmentId: string, anonymousUserId: string): Promise<StoredAssessment | null> {
  const supabase = createClient();

  const { data: session, error } = await supabase
    .from("assessment_sessions")
    .select("id, goal_id, created_at, experience_status, skill_status, certification_status")
    .eq("id", assessmentId)
    .eq("anonymous_user_id", anonymousUserId)
    .maybeSingle();
  if (error) fail("load assessment session", error);
  if (!session) return null;

  const [skills, certifications, experiences, education, match, path, migration] = await Promise.all([
    supabase.from("assessment_skills").select("skill_id").eq("assessment_id", assessmentId),
    supabase.from("assessment_certifications").select("cert_id").eq("assessment_id", assessmentId),
    supabase.from("assessment_experiences").select("role_id, years").eq("assessment_id", assessmentId),
    supabase
      .from("assessment_education")
      .select("education_level_id, degree_id")
      .eq("assessment_id", assessmentId)
      .maybeSingle(),
    supabase
      .from("career_match_results")
      .select(
        "goal_match, skill_match, experience_match, education_match, evidence_mode, confidence, goal_sample_size, calculation_version, data_source_version, taxonomy_version, skill_calculation_version, skill_statistics_version, skill_progress, tech_skill_progress, human_skill_progress, skill_weight_tech, skill_weight_human, skill_weight_source, skill_scoring_method, skill_distribution_sample_size, skill_distribution_version",
      )
      .eq("assessment_id", assessmentId)
      .single(),
    supabase
      .from("learning_path_results")
      .select("step_id, learning_order")
      .eq("assessment_id", assessmentId)
      .order("learning_order"),
    loadSkillMigration(),
  ]);
  for (const [name, r] of Object.entries({ skills, certifications, experiences, education, match, path })) {
    if (r.error) fail(`load assessment ${name}`, r.error);
  }

  const m = match.data!;
  // マイグレーション SQL の実行前に保存された行や、split の旧 skill_id を読み出し時に変換する
  const migrated = migrateLegacySkillIds(
    skills.data!.map((r) => r.skill_id),
    migration,
  );
  return {
    id: session.id,
    goal_id: session.goal_id,
    created_at: session.created_at,
    skill_ids: migrated.skillIds,
    legacy_skill_ids: migrated.unresolved,
    skill_status: session.skill_status,
    certification_ids: certifications.data!.map((r) => r.cert_id),
    certification_status: session.certification_status,
    experience_status: fromLegacySkipped<ExperienceStatus>(session.experience_status, "skipped"),
    experiences: experiences.data!.map((r) => ({ role_id: r.role_id, years: Number(r.years) })),
    education_level_id: fromLegacySkipped<string>(education.data?.education_level_id ?? null, SKIPPED_EDUCATION_LEVEL_ID),
    degree_id: education.data?.degree_id ?? null,
    career_match: {
      goal_match: Number(m.goal_match),
      skill_match: Number(m.skill_match),
      experience_match: toNumber(m.experience_match),
      education_match: toNumber(m.education_match),
      evidence_mode: m.evidence_mode,
      confidence: m.confidence,
      goal_sample_size: m.goal_sample_size,
      calculation_version: m.calculation_version,
      data_source_version: m.data_source_version,
      taxonomy_version: m.taxonomy_version,
      skill:
        m.skill_calculation_version === null
          ? null
          : {
              skill_calculation_version: m.skill_calculation_version,
              skill_statistics_version: m.skill_statistics_version,
              skill_progress: Number(m.skill_progress),
              tech_skill_progress: toNumber(m.tech_skill_progress),
              human_skill_progress: toNumber(m.human_skill_progress),
              skill_layer_weights: {
                tech: Number(m.skill_weight_tech),
                human: Number(m.skill_weight_human),
                source: m.skill_weight_source,
              },
              // 列を追加する前の行は DEFAULT の linear（分布の 2 列は NULL）になっている
              skill_scoring_method: m.skill_scoring_method,
              skill_distribution_sample_size: m.skill_distribution_sample_size,
              skill_distribution_version: m.skill_distribution_version,
            },
    },
    learning_path: path.data!,
  };
}

export async function deleteAssessment(assessmentId: string, anonymousUserId: string): Promise<void> {
  const { error } = await createClient()
    .from("assessment_sessions")
    .delete()
    .eq("id", assessmentId)
    .eq("anonymous_user_id", anonymousUserId);
  if (error) fail("delete assessment", error);
}
