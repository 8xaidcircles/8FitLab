import { afterAll, describe, expect, it } from "vitest";
import {
  calculateCareerMatch,
  learningPath,
  loadCareerStatistics,
  loadKnownIds,
  loadLearningPath,
  loadSkillContext,
  resolveUserSkills,
  SKILL_CALCULATION_VERSION,
  type CareerMatchResult,
} from "@/lib/career-match";
import { recordEvent } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { deleteAssessment, getAssessment, saveAssessment } from "../repository";
import type { AssessmentSubmission } from "../validate";

// npm run test:db で .env.local を読み込んだときだけ実 DB に対して実行する
const hasDb = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);

describe.skipIf(!hasDb)("Supabase repository（実 DB）", () => {
  const anonymousUserId = crypto.randomUUID();
  const createdIds: string[] = [];

  afterAll(async () => {
    const supabase = createClient();
    await supabase.from("assessment_sessions").delete().eq("anonymous_user_id", anonymousUserId);
    await supabase.from("events").delete().eq("anonymous_user_id", anonymousUserId);
  });

  async function save(submission: AssessmentSubmission, override: Partial<CareerMatchResult> = {}) {
    const [stats, skill, path, known] = await Promise.all([
      loadCareerStatistics(submission.goal_id),
      loadSkillContext(submission.goal_id),
      loadLearningPath(submission.goal_id),
      loadKnownIds(),
    ]);
    const result = { ...calculateCareerMatch(submission, stats, skill, known), ...override };
    const missingSteps = learningPath(path, resolveUserSkills(submission, skill, known).held);
    const id = await saveAssessment({ anonymousUserId, submission, result, missingSteps, learningPathVersion: path.version });
    createdIds.push(id);
    return { id, result, missingSteps, learningPathVersion: path.version };
  }

  it("Assessment を保存し、同じ内容を読み出せる", async () => {
    const submission: AssessmentSubmission = {
      goal_id: "frontend-developer",
      skill_ids: ["html-css", "vue", "jest"],
      skill_status: null,
      certification_ids: ["ipa-fe"],
      certification_status: null,
      experience_status: "entered",
      experiences: [{ role_id: "2513.5", years: 1.5 }],
      education_level_id: "technical-college",
      degree_id: "Secondary school",
    };
    const { id, result, missingSteps } = await save(submission);
    const stored = await getAssessment(id, anonymousUserId);

    expect(stored).not.toBeNull();
    expect(stored!.goal_id).toBe("frontend-developer");
    expect(stored!.skill_ids.sort()).toEqual(["html-css", "jest", "vue"]);
    expect(stored!.legacy_skill_ids).toEqual([]);
    expect(stored!.certification_ids).toEqual(["ipa-fe"]);
    expect(stored!.skill_status).toBeNull();
    expect(stored!.certification_status).toBeNull();
    expect(result.skill_statistics_version).toMatch(/^stack_overflow_developer_survey:2023-2024-2025:/);
    expect(stored!.career_match.skill).toEqual({
      skill_calculation_version: result.skill_calculation_version,
      skill_statistics_version: result.skill_statistics_version,
      skill_progress: expect.closeTo(result.skill_progress, 6),
      tech_skill_progress: expect.closeTo(result.tech_skill_progress!, 6),
      human_skill_progress: expect.closeTo(result.human_skill_progress!, 6),
      skill_layer_weights: result.skill_layer_weights,
      skill_scoring_method: "linear",
      skill_distribution_sample_size: null,
      skill_distribution_version: null,
    });
    expect(stored!.experience_status).toBe("entered");
    expect(stored!.experiences).toEqual([{ role_id: "2513.5", years: 1.5 }]);
    expect(stored!.education_level_id).toBe("technical-college");
    expect(stored!.degree_id).toBe("Secondary school");
    expect(stored!.career_match.goal_match).toBeCloseTo(result.goal_match, 6);
    expect(stored!.career_match.experience_match).toBeCloseTo(result.experience_match!, 6);
    expect(stored!.career_match.evidence_mode).toBe("proxy");
    expect(stored!.career_match.goal_sample_size).toBe(result.goal_sample_size);
    expect(stored!.learning_path).toEqual(
      missingSteps.map((s) => ({ step_id: s.step_id, learning_order: s.learning_order })),
    );
    expect(stored!.learning_path.map((s) => s.step_id)).not.toContain("frontend-framework");
  });

  it("スキル・資格を選ばなかった理由と、職歴・学歴の「回答をスキップする」を保存でき、そのまま読み出せる", async () => {
    const { id } = await save({
      goal_id: "data-analyst",
      skill_ids: [],
      skill_status: "none_intent_to_learn",
      certification_ids: [],
      certification_status: "planning_to_certify",
      experience_status: "skipped",
      experiences: [],
      education_level_id: "skipped",
      degree_id: null,
    });
    const stored = await getAssessment(id, anonymousUserId);

    expect(stored!.skill_ids).toEqual([]);
    expect(stored!.skill_status).toBe("none_intent_to_learn");
    expect(stored!.certification_status).toBe("planning_to_certify");
    expect(stored!.experience_status).toBe("skipped");
    expect(stored!.experiences).toEqual([]);
    expect(stored!.education_level_id).toBe("skipped");
    expect(stored!.degree_id).toBeNull();
    expect(stored!.career_match.experience_match).toBe(0);
    expect(stored!.career_match.skill_match).toBe(0);
    expect(stored!.career_match.education_match).toBe(0);
    expect(stored!.learning_path.length).toBeGreaterThan(0);
  });

  it("「回答をスキップする」の旧値 unknown で保存された行は skipped として読み出し、未定義の理由は保存できない", async () => {
    const { id } = await save({
      goal_id: "data-analyst",
      skill_ids: [],
      skill_status: "skipped",
      certification_ids: [],
      certification_status: "skipped",
      experience_status: "none",
      experiences: [],
      education_level_id: "skipped",
      degree_id: null,
    });
    const supabase = createClient();
    expect((await supabase.from("assessment_sessions").update({ experience_status: "unknown" }).eq("id", id)).error).toBeNull();
    expect(
      (await supabase.from("assessment_education").update({ education_level_id: "unknown" }).eq("assessment_id", id)).error,
    ).toBeNull();

    const stored = await getAssessment(id, anonymousUserId);
    expect(stored!.experience_status).toBe("skipped");
    expect(stored!.education_level_id).toBe("skipped");

    for (const invalid of [{ skill_status: "none" }, { certification_status: "unknown" }, { experience_status: "skip" }]) {
      const { error } = await supabase.from("assessment_sessions").update(invalid).eq("id", id);
      expect(error?.message, JSON.stringify(invalid)).toMatch(/check constraint/);
    }
  });

  it("Learning Path の各行に、判定に使った Learning Path Master の version を保存する", async () => {
    const { id, missingSteps, learningPathVersion } = await save({
      goal_id: "data-analyst",
      skill_ids: [],
      skill_status: "none_intent_to_learn",
      certification_ids: [],
      certification_status: "none",
      experience_status: "none",
      experiences: [],
      education_level_id: "skipped",
      degree_id: null,
    });
    expect(learningPathVersion).toMatch(/\S/);
    const { data, error } = await createClient()
      .from("learning_path_results")
      .select("learning_path_version")
      .eq("assessment_id", id);
    expect(error).toBeNull();
    expect(data).toHaveLength(missingSteps.length);
    for (const row of data!) expect(row.learning_path_version).toBe(learningPathVersion);
  });

  it("保存済みの旧 skill_id は読み出し時に新しい skill_id に変換し、split は計算対象外として分ける", async () => {
    const { id } = await save({
      goal_id: "backend-developer",
      skill_ids: [],
      skill_status: "none_intent_to_learn",
      certification_ids: [],
      certification_status: "none",
      experience_status: "none",
      experiences: [],
      education_level_id: "skipped",
      degree_id: null,
    });
    const legacyRows = ["html", "css", "shell-script", "backend-framework", "web-api"].map((skill_id) => ({
      assessment_id: id,
      skill_id,
    }));
    const { error } = await createClient().from("assessment_skills").insert(legacyRows);
    expect(error).toBeNull();

    const stored = await getAssessment(id, anonymousUserId);
    expect(stored!.skill_ids.sort()).toEqual(["bash-shell", "html-css", "web-api"]);
    expect(stored!.legacy_skill_ids).toEqual(["backend-framework"]);
  });

  it("保存済みの結果は再計算せず、保存時のスコアと配分を返す（設定が変わっても変わらない）", async () => {
    // 現在の設定（Frontend は技術層 100%）とは違う配分・値で保存された結果を想定する
    const { id } = await save(
      {
        goal_id: "frontend-developer",
        skill_ids: ["html-css"],
        skill_status: null,
        certification_ids: [],
        certification_status: "none",
        experience_status: "none",
        experiences: [],
        education_level_id: "skipped",
        degree_id: null,
      },
      {
        skill_match: 12.5,
        skill_progress: 12.5,
        tech_skill_progress: 10,
        human_skill_progress: 22.5,
        skill_layer_weights: { tech: 0.8, human: 0.2, source: "default" },
        skill_statistics_version: "stack_overflow_developer_survey:2023-2024-2025:0.2.0:k=50",
      },
    );
    const stored = await getAssessment(id, anonymousUserId);
    expect(stored!.career_match.skill_match).toBe(12.5);
    expect(stored!.career_match.skill).toEqual({
      skill_calculation_version: SKILL_CALCULATION_VERSION,
      skill_statistics_version: "stack_overflow_developer_survey:2023-2024-2025:0.2.0:k=50",
      skill_progress: 12.5,
      tech_skill_progress: 10,
      human_skill_progress: 22.5,
      skill_layer_weights: { tech: 0.8, human: 0.2, source: "default" },
      skill_scoring_method: "linear",
      skill_distribution_sample_size: null,
      skill_distribution_version: null,
    });
  });

  it("スコアリング方式と分布の標本数・バージョンを保存し、そのまま読み出せる（ecdf で保存された結果を想定）", async () => {
    const version = `${SKILL_CALCULATION_VERSION}|stack_overflow_developer_survey:2023-2024-2025:0.3.1:k=80.9`;
    const { id } = await save(
      {
        goal_id: "frontend-developer",
        skill_ids: ["html-css"],
        skill_status: null,
        certification_ids: [],
        certification_status: "none",
        experience_status: "none",
        experiences: [],
        education_level_id: "skipped",
        degree_id: null,
      },
      {
        skill_match: 37.5,
        skill_scoring_method: "ecdf",
        skill_distribution_sample_size: 120,
        skill_distribution_version: version,
      },
    );

    const stored = await getAssessment(id, anonymousUserId);
    expect(stored!.career_match.skill_match).toBe(37.5);
    expect(stored!.career_match.skill).toMatchObject({
      skill_scoring_method: "ecdf",
      skill_distribution_sample_size: 120,
      skill_distribution_version: version,
    });
  });

  it("スコアリング方式の制約：未定義の方式・linear で分布あり・ecdf で標本数 100 未満やバージョン無しは保存できない", async () => {
    const id = createdIds[0];
    const supabase = createClient();
    for (const invalid of [
      { skill_scoring_method: "normal_cdf" },
      { skill_scoring_method: "linear", skill_distribution_sample_size: 120, skill_distribution_version: "v" },
      { skill_scoring_method: "ecdf", skill_distribution_sample_size: 99, skill_distribution_version: "v" },
      { skill_scoring_method: "ecdf", skill_distribution_sample_size: 120, skill_distribution_version: null },
    ]) {
      const { error } = await supabase.from("career_match_results").update(invalid).eq("assessment_id", id);
      expect(error?.message, JSON.stringify(invalid)).toMatch(/check constraint/);
    }
  });

  it("旧方式の結果（skill_calculation_version が NULL）は skill を null とし、保存時の Skill Match を返す", async () => {
    const { id } = await save({
      goal_id: "backend-developer",
      skill_ids: [],
      skill_status: "none_intent_to_learn",
      certification_ids: [],
      certification_status: "none",
      experience_status: "none",
      experiences: [],
      education_level_id: "skipped",
      degree_id: null,
    });
    const supabase = createClient();
    const { error } = await supabase
      .from("career_match_results")
      .update({
        skill_match: 40,
        skill_calculation_version: null,
        skill_statistics_version: null,
        skill_progress: null,
        tech_skill_progress: null,
        human_skill_progress: null,
        skill_weight_tech: null,
        skill_weight_human: null,
        skill_weight_source: null,
      })
      .eq("assessment_id", id);
    expect(error).toBeNull();
    await supabase.from("assessment_skills").insert([{ assessment_id: id, skill_id: "shell-script" }]);

    const stored = await getAssessment(id, anonymousUserId);
    expect(stored!.career_match.skill_match).toBe(40);
    expect(stored!.career_match.skill).toBeNull();
    expect(stored!.skill_ids).toEqual(["bash-shell"]);
  });

  it("配分の制約：合計が 1 でない・source が不正・一部だけ NULL・計算方式と不一致の値は保存できない", async () => {
    const id = createdIds[0];
    const supabase = createClient();
    for (const invalid of [
      { skill_weight_tech: 0.5, skill_weight_human: 0.2 },
      { skill_weight_source: "manual" },
      { skill_weight_human: null },
      { skill_weight_tech: null, skill_weight_human: null, skill_weight_source: null },
    ]) {
      const { error } = await supabase.from("career_match_results").update(invalid).eq("assessment_id", id);
      expect(error?.message, JSON.stringify(invalid)).toMatch(/check constraint/);
    }
  });

  it("別の anonymous_user_id からは読めず、削除もできない", async () => {
    const id = createdIds[0];
    const stranger = crypto.randomUUID();
    expect(await getAssessment(id, stranger)).toBeNull();
    await deleteAssessment(id, stranger);
    expect(await getAssessment(id, anonymousUserId)).not.toBeNull();
  });

  it("削除すると関連テーブルの行も消える", async () => {
    const id = createdIds[0];
    await deleteAssessment(id, anonymousUserId);
    expect(await getAssessment(id, anonymousUserId)).toBeNull();

    const supabase = createClient();
    for (const table of [
      "assessment_skills",
      "assessment_certifications",
      "assessment_experiences",
      "assessment_education",
      "career_match_results",
      "skill_gap_results",
      "learning_path_results",
    ]) {
      const { count } = await supabase.from(table).select("id", { count: "exact", head: true }).eq("assessment_id", id);
      expect(count, table).toBe(0);
    }
  });

  it("Event を保存できる", async () => {
    await recordEvent(anonymousUserId, "goal_selected", { goal_id: "frontend-developer" });
    const { data } = await createClient()
      .from("events")
      .select("event_name, event_data")
      .eq("anonymous_user_id", anonymousUserId);
    expect(data).toEqual([{ event_name: "goal_selected", event_data: { goal_id: "frontend-developer" } }]);
  });
});
