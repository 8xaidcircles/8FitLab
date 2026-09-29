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
  experiences: [{ role_id: "2513.5", years: 1.5 }],
  education_level_id: "bachelor",
  field_id: "information",
};

function parse(overrides: Record<string, unknown>) {
  return parseAssessmentSubmission({ ...valid, ...overrides }, known);
}

describe("parseAssessmentSubmission", () => {
  it("正しい入力を受け付け、学歴から統計上の学歴を導く", () => {
    expect(parseAssessmentSubmission(valid, known)).toEqual({ ok: true, value: { ...valid, degree_id: "Bachelor" } });
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

  it("User Skill = 0 を受け付ける", () => {
    expect(parse({ skill_ids: [] }).ok).toBe(true);
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

  it("User Experience = 0 を受け付ける", () => {
    expect(parse({ experiences: [] }).ok).toBe(true);
  });

  it.each(["Bachelor", "diploma", 1])("未知の学歴は拒否（%j）", (education_level_id) => {
    expect(parse({ education_level_id, field_id: null })).toEqual({ ok: false, error: "unknown_education_level" });
  });

  it("学歴未入力（null / 省略）を受け付ける", () => {
    const result = parse({ education_level_id: null, field_id: null });
    expect(result.ok && result.value).toMatchObject({ education_level_id: null, degree_id: null, field_id: null });
    expect(parse({ education_level_id: undefined, field_id: undefined }).ok).toBe(true);
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
    const result = parse({ education_level_id, field_id: null });
    expect(result.ok && result.value).toMatchObject({ education_level_id, degree_id });
  });

  it.each([
    ["high-school", "hs-general"],
    ["vocational-school", "information"],
    ["technical-college", "science-engineering"],
    ["junior-college", "economics-business"],
    ["bachelor", "information"],
    ["master", "math-statistics"],
    ["phd", "information"],
  ])("高校以上の学歴では専攻分野を選べる（%s / %s）", (education_level_id, field_id) => {
    const result = parse({ education_level_id, field_id });
    expect(result.ok && result.value).toMatchObject({ education_level_id, field_id });
  });

  it.each([
    [null, "information"],
    ["junior-high", "hs-general"],
    ["junior-high", "information"],
    ["high-school", "information"],
    ["technical-college", "hs-industrial"],
    ["bachelor", "hs-general"],
  ])("学歴に合わない専攻分野は拒否（%s / %s）", (education_level_id, field_id) => {
    expect(parse({ education_level_id, field_id })).toEqual({ ok: false, error: "field_not_applicable" });
  });

  it("中学校は専攻分野なしで受け付ける", () => {
    const result = parse({ education_level_id: "junior-high", field_id: null });
    expect(result.ok && result.value).toMatchObject({ degree_id: "None", field_id: null });
  });

  it("Field 未選択（null / 省略）を受け付ける", () => {
    const result = parse({ field_id: null });
    expect(result.ok && result.value.field_id).toBeNull();
    expect(parse({ field_id: undefined }).ok).toBe(true);
  });

  it.each(["情報工学", "山田太郎 東京大学", "", "x".repeat(LIMITS.idLength + 1), 1])(
    "選択肢にない Field は拒否（自由入力を受け付けない）: %j",
    (field_id) => {
      expect(parse({ field_id })).toEqual({ ok: false, error: "unknown_field" });
    },
  );
});
