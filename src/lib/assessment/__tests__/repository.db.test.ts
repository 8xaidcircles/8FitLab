import { afterAll, describe, expect, it } from "vitest";
import {
  calculateCareerMatch,
  heldSkillIds,
  learningPath,
  loadCareerStatistics,
  loadKnownIds,
  loadLearningPath,
  loadSkillContext,
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

  async function save(submission: AssessmentSubmission) {
    const [stats, skill, path, known] = await Promise.all([
      loadCareerStatistics(submission.goal_id),
      loadSkillContext(submission.goal_id),
      loadLearningPath(submission.goal_id),
      loadKnownIds(),
    ]);
    const result = calculateCareerMatch(submission, stats, skill, known);
    const held = heldSkillIds({ skillIds: submission.skill_ids, certificationIds: submission.certification_ids }, skill);
    const missingSteps = learningPath(path, held);
    const id = await saveAssessment({ anonymousUserId, submission, result, missingSteps });
    createdIds.push(id);
    return { id, result, missingSteps };
  }

  it("Assessment を保存し、同じ内容を読み出せる", async () => {
    const submission: AssessmentSubmission = {
      goal_id: "frontend-developer",
      skill_ids: ["html-css", "vue", "jest"],
      certification_ids: ["ipa-fe"],
      experiences: [{ role_id: "2513.5", years: 1.5 }],
      education_level_id: "technical-college",
      degree_id: "Secondary school",
      field_id: "information",
    };
    const { id, result, missingSteps } = await save(submission);
    const stored = await getAssessment(id, anonymousUserId);

    expect(stored).not.toBeNull();
    expect(stored!.goal_id).toBe("frontend-developer");
    expect(stored!.skill_ids.sort()).toEqual(["html-css", "jest", "vue"]);
    expect(stored!.legacy_skill_ids).toEqual([]);
    expect(stored!.certification_ids).toEqual(["ipa-fe"]);
    expect(stored!.career_match.skill).toEqual({
      skill_calculation_version: result.skill_calculation_version,
      skill_progress: expect.closeTo(result.skill_progress, 6),
      tech_skill_progress: expect.closeTo(result.tech_skill_progress!, 6),
      human_skill_progress: expect.closeTo(result.human_skill_progress!, 6),
    });
    expect(stored!.experiences).toEqual([{ role_id: "2513.5", years: 1.5 }]);
    expect(stored!.education_level_id).toBe("technical-college");
    expect(stored!.degree_id).toBe("Secondary school");
    expect(stored!.field_id).toBe("information");
    expect(stored!.career_match.goal_match).toBeCloseTo(result.goal_match, 6);
    expect(stored!.career_match.experience_match).toBeCloseTo(result.experience_match!, 6);
    expect(stored!.career_match.evidence_mode).toBe("proxy");
    expect(stored!.career_match.goal_sample_size).toBe(result.goal_sample_size);
    expect(stored!.learning_path).toEqual(
      missingSteps.map((s) => ({ step_id: s.step_id, learning_order: s.learning_order })),
    );
    expect(stored!.learning_path.map((s) => s.step_id)).not.toContain("frontend-framework");
  });

  it("入力が空でも保存でき、Education は保存しない", async () => {
    const { id } = await save({
      goal_id: "data-analyst",
      skill_ids: [],
      certification_ids: [],
      experiences: [],
      education_level_id: null,
      degree_id: null,
      field_id: null,
    });
    const stored = await getAssessment(id, anonymousUserId);

    expect(stored!.skill_ids).toEqual([]);
    expect(stored!.experiences).toEqual([]);
    expect(stored!.education_level_id).toBeNull();
    expect(stored!.degree_id).toBeNull();
    expect(stored!.career_match.skill_match).toBe(0);
    expect(stored!.career_match.education_match).toBe(0);
    expect(stored!.learning_path.length).toBeGreaterThan(0);
  });

  it("保存済みの旧 skill_id は読み出し時に新しい skill_id に変換し、split は計算対象外として分ける", async () => {
    const { id } = await save({
      goal_id: "backend-developer",
      skill_ids: [],
      certification_ids: [],
      experiences: [],
      education_level_id: null,
      degree_id: null,
      field_id: null,
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
