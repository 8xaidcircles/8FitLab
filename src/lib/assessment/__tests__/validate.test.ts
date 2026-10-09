import { describe, expect, it } from "vitest";
import { loadEducation } from "@/lib/career-match/data";
import { educationIds, LIMITS, parseAssessmentSubmission, type KnownAssessmentIds } from "../validate";

const known: KnownAssessmentIds = {
  goalIds: new Set(["frontend-developer"]),
  skillIds: new Set(["html-css", "javascript", "react"]),
  certificationIds: new Set(["ipa-fe", "ipa-ap"]),
  roleIds: new Set(["2513.5", "2512.4"]),
  ...educationIds(await loadEducation()),
};

const valid = {
  goal_id: "frontend-developer",
  skill_ids: ["html-css", "react"],
  certification_ids: ["ipa-fe"],
  experience_status: "entered",
  experiences: [{ role_id: "2513.5", years: 1.5 }],
  education_level_id: "bachelor",
};

function parse(overrides: Record<string, unknown>) {
  return parseAssessmentSubmission({ ...valid, ...overrides }, known);
}

describe("parseAssessmentSubmission", () => {
  it("正しい入力を受け付け、学歴から統計上の学歴を導く", () => {
    expect(parseAssessmentSubmission(valid, known)).toEqual({
      ok: true,
      value: { ...valid, skill_status: null, certification_status: null, degree_id: "Bachelor" },
    });
  });

  it.each([null, "text", 1, []])("オブジェクト以外は拒否（%j）", (raw) => {
    expect(parseAssessmentSubmission(raw, known)).toEqual({ ok: false, error: "invalid_payload" });
  });

  it("未知の Goal は拒否", () => {
    expect(parse({ goal_id: "ml-engineer" })).toEqual({ ok: false, error: "unknown_goal" });
    expect(parse({ goal_id: undefined })).toEqual({ ok: false, error: "unknown_goal" });
  });

  it("未知の Skill（旧 skill_id を含む）は拒否", () => {
    expect(parse({ skill_ids: ["html-css", "cobol"] })).toEqual({ ok: false, error: "unknown_skill" });
    expect(parse({ skill_ids: ["html"] })).toEqual({ ok: false, error: "unknown_skill" });
    expect(parse({ skill_ids: [1] })).toEqual({ ok: false, error: "unknown_skill" });
  });

  it("Skill が配列でない・多すぎる場合は拒否", () => {
    expect(parse({ skill_ids: "html-css" })).toEqual({ ok: false, error: "invalid_skills" });
    expect(parse({ skill_ids: Array(LIMITS.skills + 1).fill("html-css") })).toEqual({ ok: false, error: "invalid_skills" });
  });

  it("重複 Skill は 1 つにまとめる", () => {
    const result = parse({ skill_ids: ["html-css", "html-css", "javascript"] });
    expect(result.ok && result.value.skill_ids).toEqual(["html-css", "javascript"]);
  });

  it("未知の資格・配列でない・多すぎる資格は拒否", () => {
    expect(parse({ certification_ids: ["ipa-fe", "toeic"] })).toEqual({ ok: false, error: "unknown_certification" });
    expect(parse({ certification_ids: "ipa-fe" })).toEqual({ ok: false, error: "invalid_certifications" });
    expect(parse({ certification_ids: Array(LIMITS.certifications + 1).fill("ipa-fe") })).toEqual({
      ok: false,
      error: "invalid_certifications",
    });
  });

  it("重複した資格は 1 つにまとめ、資格の省略は資格なしとして受け付ける", () => {
    const result = parse({ certification_ids: ["ipa-fe", "ipa-fe", "ipa-ap"] });
    expect(result.ok && result.value.certification_ids).toEqual(["ipa-fe", "ipa-ap"]);
    const omitted = parse({ certification_ids: undefined });
    expect(omitted.ok && omitted.value.certification_ids).toEqual([]);
  });

  it("User Skill = 0 を受け付ける（スキルを選ばなかった理由の項目より前の画面）", () => {
    const result = parse({ skill_ids: [] });
    expect(result.ok && result.value.skill_status).toBeNull();
  });

  it.each(["none", "none_intent_to_learn", "skipped"])("スキルを選ばなかった理由「%s」をスキルなしで受け付ける", (skill_status) => {
    const result = parse({ skill_ids: [], skill_status });
    expect(result.ok && result.value).toMatchObject({ skill_ids: [], skill_status });
  });

  it("スキルを選ばなかった理由が不正・スキルと同時に送られた場合は拒否", () => {
    expect(parse({ skill_ids: [], skill_status: "beginner" })).toEqual({ ok: false, error: "invalid_skills" });
    expect(parse({ skill_status: "none_intent_to_learn" })).toEqual({ ok: false, error: "invalid_skills" });
  });

  it("スキルも理由も選ばない入力（skill_status: null）は拒否", () => {
    expect(parse({ skill_ids: [], skill_status: null })).toEqual({ ok: false, error: "skills_required" });
    expect(parse({ skill_status: null }).ok).toBe(true);
  });

  it.each(["none", "planning_to_certify", "skipped"])("資格を選ばなかった理由「%s」を資格なしで受け付ける", (certification_status) => {
    const result = parse({ certification_ids: [], certification_status });
    expect(result.ok && result.value).toMatchObject({ certification_ids: [], certification_status });
  });

  it("資格を選ばなかった理由が不正・資格と同時に送られた場合は拒否", () => {
    expect(parse({ certification_ids: [], certification_status: "skip" })).toEqual({ ok: false, error: "invalid_certifications" });
    expect(parse({ certification_status: "none" })).toEqual({ ok: false, error: "invalid_certifications" });
  });

  it("資格も理由も選ばない入力（certification_status: null）は拒否", () => {
    expect(parse({ certification_ids: [], certification_status: null })).toEqual({ ok: false, error: "certifications_required" });
    expect(parse({ certification_status: null }).ok).toBe(true);
  });

  it("未知の Role は拒否", () => {
    expect(parse({ experiences: [{ role_id: "9999.9", years: 1 }] })).toEqual({ ok: false, error: "unknown_role" });
  });

  it.each([0, -1, LIMITS.maxYears + 1, Number.NaN, Number.POSITIVE_INFINITY, "2"])("不正な年数は拒否（%s）", (years) => {
    expect(parse({ experiences: [{ role_id: "2513.5", years }] })).toEqual({ ok: false, error: "invalid_years" });
  });

  it("Experience が多すぎる・形が不正な場合は拒否", () => {
    const many = Array(LIMITS.experiences + 1).fill({ role_id: "2513.5", years: 1 });
    expect(parse({ experiences: many })).toEqual({ ok: false, error: "invalid_experiences" });
    expect(parse({ experiences: ["2513.5"] })).toEqual({ ok: false, error: "invalid_experiences" });
  });

  it("Experience の余分なプロパティは捨てる", () => {
    const result = parse({ experiences: [{ role_id: "2513.5", years: 2, company: "X" }] });
    expect(result.ok && result.value.experiences).toEqual([{ role_id: "2513.5", years: 2 }]);
  });

  it.each([undefined, null, "", "skip", 1])("職歴の回答が無い・不正なら拒否（%j）", (experience_status) => {
    expect(parse({ experience_status })).toEqual({ ok: false, error: "experience_required" });
  });

  it.each(["none", "skipped"])("職歴「%s」は職歴の行なしで受け付ける", (experience_status) => {
    const result = parse({ experience_status, experiences: [] });
    expect(result.ok && result.value).toMatchObject({ experience_status, experiences: [] });
  });

  it("職歴の旧値 unknown（デプロイ前から開いたままの画面）は skipped として受け付ける", () => {
    const result = parse({ experience_status: "unknown", experiences: [] });
    expect(result.ok && result.value.experience_status).toBe("skipped");
  });

  it("職歴「実務経験なし」「回答をスキップする」と職歴の行の組み合わせは拒否", () => {
    expect(parse({ experience_status: "none" })).toEqual({ ok: false, error: "invalid_experiences" });
    expect(parse({ experience_status: "skipped" })).toEqual({ ok: false, error: "invalid_experiences" });
  });

  it("職歴「実務経験がある」で職歴の行が無ければ拒否", () => {
    expect(parse({ experiences: [] })).toEqual({ ok: false, error: "experience_rows_required" });
  });

  it.each(["Bachelor", "diploma", 1])("未知の学歴は拒否（%j）", (education_level_id) => {
    expect(parse({ education_level_id })).toEqual({ ok: false, error: "unknown_education_level" });
  });

  it.each([null, undefined, ""])("学歴の未入力は拒否（%j）", (education_level_id) => {
    expect(parse({ education_level_id })).toEqual({ ok: false, error: "education_required" });
  });

  it.each(["skipped", "unknown"])("学歴「回答をスキップする」（%s）は skipped・統計上の学歴なし（null）として受け付ける", (education_level_id) => {
    const result = parse({ education_level_id });
    expect(result.ok && result.value).toMatchObject({ education_level_id: "skipped", degree_id: null });
  });

  it("すべて未該当・スキップの入力を受け付ける", () => {
    const result = parse({
      skill_ids: [],
      skill_status: "none_intent_to_learn",
      certification_ids: [],
      certification_status: "planning_to_certify",
      experience_status: "skipped",
      experiences: [],
      education_level_id: "skipped",
    });
    expect(result.ok).toBe(true);
  });

  it.each([
    ["junior-high", "None"],
    ["high-school", "Secondary school"],
    ["vocational-school", "Secondary school"],
    ["technical-college", "Secondary school"],
    ["junior-college", "Secondary school"],
    ["bachelor", "Bachelor"],
    ["master", "Master"],
    ["phd", "PhD"],
  ])("学歴 %s は統計上 %s として扱う", (education_level_id, degree_id) => {
    const result = parse({ education_level_id });
    expect(result.ok && result.value).toMatchObject({ education_level_id, degree_id });
  });

  it.each(["information", "山田太郎 東京大学", null, 1])(
    "専攻分野（field_id）は入力をやめたため、古い画面から送られても無視して保存しない: %j",
    (field_id) => {
      const result = parse({ field_id });
      expect(result.ok).toBe(true);
      expect(result.ok && "field_id" in result.value).toBe(false);
    },
  );
});
