import { describe, expect, it } from "vitest";
import {
  COMPOSITE_UNMET_GROUP_CAP,
  calculateCareerMatch,
  confidence,
  contribution,
  educationMatch,
  evidenceMode,
  experienceMatch,
  goalMatch,
  quality,
  resolveUserSkills,
  roundYears,
  skillStatisticsVersion,
  userExperienceKeys,
  usesEducationRequirement,
  ECDF_SKILL_MATCH_ENABLED,
  SKILL_CALCULATION_VERSION,
  type KnownIds,
  type SkillContext,
} from "../calculate";
import { learningPath } from "../skill-gap";
import type {
  CareerStatistics,
  LearningPathMaster,
  RequirementGroupStatistics,
  SkillProgressDistribution,
  UserInput,
} from "../types";
import { skillStatistics, unit } from "./skill-fixtures";

function row(pGoal: number, pOther: number) {
  const q = quality(pGoal, pOther);
  return { p_unit_given_goal: pGoal, p_unit_given_other: pOther, quantity: pGoal, quality: q, contribution: contribution(pGoal, q) };
}

// 技術スキル層は 4 unit が同じ重さ（1 unit = 25）。既定では技術スキル層 100%
const skill: SkillContext = {
  techStats: skillStatistics("test-goal", [
    unit("html", ["html"], 1),
    unit("language", ["python", "java", "go"], 1),
    unit("sql", ["sql"], 1),
    unit("docker", ["docker"], 1),
  ]),
  goalLayers: { goal_id: "test-goal", layer_weights: { tech: 1, human: 0 }, human_requirements: ["testing"] },
  defaultWeights: { tech: 0.8, human: 0.2 },
  humanSkills: [
    {
      skill_id: "testing",
      name: "テスト",
      domain: "methodology_process",
      description: "",
      tools: [{ tool_id: "jest", name: "Jest" }],
    },
  ],
  certifications: [{ cert_id: "jstqb-fl", name: "JSTQB FL", issuer: "JSTQB", category: "design-quality", proves: ["testing"] }],
  skillMigration: [
    { old_skill_id: "shell-script", action: "renamed", new_skill_ids: ["docker"] },
    { old_skill_id: "cloud", action: "split", new_skill_ids: ["aws", "azure"] },
  ],
};

// Experience（Role × 年以上、Other に無い Unit なので c = Pg）:
//   A≥0.5 (c=0.2), A≥1.0 (c=0.15), A≥1.5 (c=0.1), A≥2.0 (c=0.05), B≥0.5 (c=0.1)、reference = 0.4
//   Group の職業は occupations（Group 前職歴の Unit には含まれない）
function group(groupId: string, occupations: string[]): RequirementGroupStatistics {
  return {
    group_id: groupId,
    occupations,
    goal_sample_size: 500,
    pre_goal_experience_persons: 400,
    experience_reference: 0.4,
    experience: [
      { unit_id: "A__0.5", role_id: "A", years: 0.5, ...row(0.2, 0) },
      { unit_id: "A__1.0", role_id: "A", years: 1.0, ...row(0.15, 0) },
      { unit_id: "A__1.5", role_id: "A", years: 1.5, ...row(0.1, 0) },
      { unit_id: "A__2.0", role_id: "A", years: 2.0, ...row(0.05, 0) },
      { unit_id: "B__0.5", role_id: "B", years: 0.5, ...row(0.1, 0) },
    ],
    // パーセンタイル：0.5 年 = 12.5、1 年 = 50、2 年 = 75、3 年 = 87.5
    occupation_tenure: { sample_size: 4, distribution: [{ years: 0.5, persons: 1 }, { years: 1, persons: 2 }, { years: 3, persons: 1 }] },
  };
}

// Goal 職業は G（1 Group）
// Education: Master (c=0.6), Bachelor (c=0.2) → 最大 0.6
function stats(overrides: Partial<CareerStatistics> = {}): CareerStatistics {
  return {
    goal_id: "test-goal",
    mapping_status: "exact",
    goal_occupations: ["G"],
    goal_sample_size: 500,
    other_sample_size: 10000,
    undated_goal_persons: 0,
    small_sample: false,
    source: "jobhop_v2",
    source_version: "v2",
    taxonomy: "esco",
    taxonomy_version: "1.1.2",
    calculation_version: "2.2.0",
    calculation_date: "2026-09-28",
    experience_reference_percentile: 90,
    experience_reference_estimator: "harrell-davis",
    requirement_groups: [group("g", ["G"])],
    education: [
      { unit_id: "Master", degree_id: "Master", ...row(0.8, 0.26666666666666666) },
      { unit_id: "Bachelor", degree_id: "Bachelor", ...row(0.4, 0.4) },
    ],
    minimum_education: "Bachelor",
    education_at_or_above: { None: 1, "Secondary school": 0.9, Bachelor: 0.7, Master: 0.3, PhD: 0.05 },
    ...overrides,
  };
}

const known: KnownIds = {
  skillIds: new Set(["html", "python", "java", "go", "sql", "docker", "testing", "jest"]),
  certificationIds: new Set(["jstqb-fl"]),
  roleIds: new Set(["A", "B", "C", "G"]),
};

function input(overrides: Partial<UserInput> = {}): UserInput {
  return { skill_ids: [], certification_ids: [], experiences: [], degree_id: null, ...overrides };
}

describe("roundYears", () => {
  it.each([
    [0.1, 0.5],
    [0.4, 0.5],
    [0.7, 0.5],
    [0.75, 1.0],
    [1.3, 1.5],
    [1.7, 1.5],
    [2.2, 2.0],
    [2.25, 2.5],
    [10, 10],
    [80, 50],
  ])("%s年 → %s年", (years, expected) => {
    expect(roundYears(years)).toBe(expected);
  });
});

describe("Quantity / Quality / Contribution", () => {
  it("Quality = Pg / (Pg + Po) × 100", () => {
    expect(quality(0.3, 0.1)).toBeCloseTo(75);
    expect(quality(0.2, 0)).toBe(100);
    expect(quality(0, 0.2)).toBe(0);
    expect(quality(0, 0)).toBe(0);
  });

  it("Contribution = Quantity × Quality / 100", () => {
    expect(contribution(0.4, 75)).toBeCloseTo(0.3);
    expect(contribution(0, 100)).toBe(0);
  });
});

describe("calculateCareerMatch の Skill（技術スキル層 × 人間定義層）", () => {
  const skillMatch = (overrides: Partial<UserInput>, context: SkillContext = skill) =>
    calculateCareerMatch(input(overrides), stats(), context, known);
  const layered = (weights: { tech: number; human: number }): SkillContext => ({
    ...skill,
    goalLayers: { ...skill.goalLayers, layer_weights: weights },
  });

  it("代わりのきく技術はどれか 1 つで満たし、複数持っても 1 回だけ数える", () => {
    expect(skillMatch({ skill_ids: ["html", "go"] }).skill_match).toBeCloseTo(50, 10);
    expect(skillMatch({ skill_ids: ["python", "java", "go"] }).skill_match).toBeCloseTo(25, 10);
    expect(skillMatch({ skill_ids: [] }).skill_match).toBe(0);
    expect(skillMatch({ skill_ids: ["html", "java", "sql", "docker"] }).skill_match).toBeCloseTo(100, 10);
  });

  it("2 層を配分で合算し、各層の達成率と配分を返す", () => {
    const result = skillMatch({ skill_ids: ["html", "python", "testing"] }, layered({ tech: 0.8, human: 0.2 }));
    expect(result.tech_skill_progress).toBeCloseTo(50, 10);
    expect(result.human_skill_progress).toBe(100);
    expect(result.skill_progress).toBeCloseTo(50 * 0.8 + 100 * 0.2, 10);
    expect(result.skill_layer_weights).toEqual({ tech: 0.8, human: 0.2, source: "goal" });
    expect(result.skill_calculation_version).toBe(SKILL_CALCULATION_VERSION);
  });

  it("資格が証明するスキル・使っているツールも保有しているとみなす", () => {
    const context = layered({ tech: 0, human: 1 });
    expect(skillMatch({ certification_ids: ["jstqb-fl"] }, context).skill_match).toBe(100);
    expect(skillMatch({ skill_ids: ["jest"] }, context).skill_match).toBe(100);
    expect(skillMatch({}, context).skill_match).toBe(0);
  });

  it("技術スキル統計が無い Goal は人間定義層 100%（fallback）", () => {
    const result = skillMatch({ skill_ids: ["testing"] }, { ...layered({ tech: 0.8, human: 0.2 }), techStats: null });
    expect(result.tech_skill_progress).toBeNull();
    expect(result.skill_layer_weights).toEqual({ tech: 0, human: 1, source: "fallback" });
    expect(result.skill_match).toBe(100);
  });

  it("技術スキル層に使った Skill Statistics の由来を結果に残す", () => {
    expect(skillMatch({}).skill_statistics_version).toBe(skillStatisticsVersion(skill.techStats!));
    expect(skillStatisticsVersion(skill.techStats!)).toMatch(/^.+:\d{4}(-\d{4})*:.+:k=[\d.]+$/);
  });

  it("技術層の配分が 0 の Goal は、技術層を計算しても Skill Statistics の由来を残さない", () => {
    const result = skillMatch({ skill_ids: ["jest"] }, layered({ tech: 0, human: 1 }));
    expect(result.tech_skill_progress).not.toBeNull();
    expect(result.skill_layer_weights.tech).toBe(0);
    expect(result.skill_statistics_version).toBeNull();
  });

  it("技術層 100% の Goal で技術スキル統計が無ければ、配分 0 の人間定義層に 100% を寄せる（fallback）", () => {
    const result = skillMatch({ skill_ids: ["jest"] }, { ...layered({ tech: 1, human: 0 }), techStats: null });
    expect(result.tech_skill_progress).toBeNull();
    expect(result.skill_statistics_version).toBeNull();
    expect(result.human_skill_progress).toBe(100);
    expect(result.skill_layer_weights).toEqual({ tech: 0, human: 1, source: "fallback" });
    expect(result.skill_match).toBe(100);
  });

  it("技術スキル統計の採用 unit が 0 件でも、人間定義層 100% に寄せる（fallback）", () => {
    const empty = { ...layered({ tech: 1, human: 0 }), techStats: skillStatistics("test-goal", []) };
    expect(skillMatch({ skill_ids: ["testing"] }, empty).skill_layer_weights).toEqual({
      tech: 0,
      human: 1,
      source: "fallback",
    });
  });

  it("人間定義層 100% の Goal で要件が空なら、技術スキル層に 100% を寄せる（fallback）", () => {
    const context = layered({ tech: 0, human: 1 });
    const result = skillMatch(
      { skill_ids: ["html", "python"] },
      { ...context, goalLayers: { ...context.goalLayers, human_requirements: [] } },
    );
    expect(result.human_skill_progress).toBeNull();
    expect(result.skill_layer_weights).toEqual({ tech: 1, human: 0, source: "fallback" });
    expect(result.skill_match).toBeCloseTo(50, 10);
  });

  it("どちらの層も計算できなければエラー", () => {
    const context = layered({ tech: 1, human: 0 });
    expect(() =>
      skillMatch({}, { ...context, techStats: null, goalLayers: { ...context.goalLayers, human_requirements: [] } }),
    ).toThrow("No skill layer is available");
  });

  it("旧 skill_id は移行してから計算し、split は ignored ではなく legacy_skill_ids に返す", () => {
    const result = skillMatch({ skill_ids: ["shell-script", "cloud"] });
    expect(result.skill_match).toBeCloseTo(25, 10); // shell-script → docker
    expect(result.ignored.skill_ids).toEqual([]);
    expect(result.ignored.legacy_skill_ids).toEqual(["cloud"]);
  });

  it("Unknown な資格は無視して ignored に返す", () => {
    const result = skillMatch({ certification_ids: ["jstqb-fl", "unknown-cert"] }, layered({ tech: 0, human: 1 }));
    expect(result.skill_match).toBe(100);
    expect(result.ignored.certification_ids).toEqual(["unknown-cert"]);
  });

  it("技術スキル層の Goal と Skill Layers の Goal が一致しなければエラー", () => {
    expect(() =>
      skillMatch({}, { ...skill, techStats: skillStatistics("other", skill.techStats!.units) }),
    ).toThrow();
  });
});

describe("calculateCareerMatch の Skill Scoring", () => {
  const skillIds = ["html", "python"]; // 達成率 50

  it("コールドスタート（分布なし）は達成率をそのまま Skill Match とする", () => {
    const result = calculateCareerMatch(input({ skill_ids: skillIds }), stats(), skill, known);
    expect(result.skill_progress).toBeCloseTo(50, 10);
    expect(result.skill_match).toBeCloseTo(50, 10);
    expect(result.skill_scoring_method).toBe("linear");
    expect(result.skill_distribution_sample_size).toBeNull();
    expect(result.skill_distribution_version).toBeNull();
  });

  it("ECDF は無効（ECDF_SKILL_MATCH_ENABLED = false）で、100 人以上・偏った分布を渡しても linear で計算する", () => {
    expect(ECDF_SKILL_MATCH_ENABLED).toBe(false);
    // 半数が 100 点の分布。ECDF なら全部持っている人でも 75 点になる
    const scores = [...Array(100).fill(0), ...Array(100).fill(100)];
    const distribution: SkillProgressDistribution = {
      goal_id: "test-goal",
      scores,
      skill_calculation_version: SKILL_CALCULATION_VERSION,
      skill_statistics_version: skillStatisticsVersion(skill.techStats!),
    };
    for (const skill_ids of [skillIds, ["html", "python", "sql", "docker"]]) {
      const result = calculateCareerMatch(input({ skill_ids }), stats(), skill, known, distribution);
      expect(result.skill_match).toBe(result.skill_progress);
      expect(result.skill_scoring_method).toBe("linear");
      expect(result.skill_distribution_sample_size).toBeNull();
      expect(result.skill_distribution_version).toBeNull();
    }
  });

  it("別 Goal の分布はエラー", () => {
    const distribution: SkillProgressDistribution = {
      goal_id: "other",
      scores: [0, 100],
      skill_calculation_version: SKILL_CALCULATION_VERSION,
      skill_statistics_version: null,
    };
    expect(() => calculateCareerMatch(input(), stats(), skill, known, distribution)).toThrow();
  });
});

describe("userExperienceKeys", () => {
  it("Y 年の経験は 0.5〜Y 年のすべての Unit（年以上）に該当する", () => {
    expect([...userExperienceKeys([{ role_id: "A", years: 1.5 }])]).toEqual(["A__0.5", "A__1.0", "A__1.5"]);
  });

  it("同一 Role の入力は年数を合算してから丸める", () => {
    expect([...userExperienceKeys([{ role_id: "A", years: 0.6 }, { role_id: "A", years: 0.5 }])]).toEqual(["A__0.5", "A__1.0"]);
  });

  it("0 年以下・不正値は除外する", () => {
    expect(userExperienceKeys([{ role_id: "A", years: 0 }, { role_id: "B", years: -1 }, { role_id: "C", years: NaN }]).size).toBe(0);
  });
});

describe("experienceMatch", () => {
  const match = (experiences: { role_id: string; years: number }[]) => experienceMatch(stats(), experiences).value;

  it("Σ Contribution(該当 Unit) / reference × 100", () => {
    expect(match([{ role_id: "A", years: 0.5 }])).toBeCloseTo(50); // 0.2 / 0.4
    expect(match([{ role_id: "A", years: 1.2 }])).toBeCloseTo(87.5); // (0.2 + 0.15) / 0.4
  });

  it("同じ Role なら経験年数が長いほど下がらない", () => {
    const values = [0.5, 1, 1.5, 2, 5, 10].map((years) => match([{ role_id: "A", years }])!);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
  });

  it("reference を超えたら 100 で頭打ち", () => {
    expect(match([{ role_id: "A", years: 2 }, { role_id: "B", years: 1 }])).toBe(100); // 0.6 / 0.4
  });

  it("Goal 職業そのものの経験は即 100 ではなく、在職年数のパーセンタイル", () => {
    expect(experienceMatch(stats(), [{ role_id: "G", years: 0.5 }])).toEqual({ value: 12.5, coverage: 1 });
    expect(match([{ role_id: "G", years: 1 }])).toBe(50);
    expect(match([{ role_id: "G", years: 3 }])).toBe(87.5);
  });

  it("Goal 職業の経験と前職歴があれば、高いほう", () => {
    // 在職 1 年 = 50 < 前職歴 A 2 年 + B 1 年 = min(100, 0.6 / 0.4 × 100)
    expect(match([{ role_id: "G", years: 1 }, { role_id: "A", years: 2 }, { role_id: "B", years: 1 }])).toBe(100);
    // 在職 3 年 = 87.5 > 前職歴 A 0.5 年 = 50
    expect(match([{ role_id: "G", years: 3 }, { role_id: "A", years: 0.5 }])).toBe(87.5);
  });

  describe("複合 Goal（Group の AND、Group 内は OR）= Group 達成率の平均", () => {
    // F = {F1 または F2}、K = {K1}。K の前職統計では A は寄与せず B≥0.5 のみ（c=0.2、reference=0.4）
    const k = { ...group("k", ["K1"]), experience: [{ unit_id: "B__0.5", role_id: "B", years: 0.5, ...row(0.2, 0) }] };
    const composite = stats({ goal_occupations: ["F1", "F2", "K1"], requirement_groups: [group("f", ["F1", "F2"]), k] });

    it("Group 内はどれか 1 つで満たし、全 Group を満たせば coverage = 1（達成率は在職年数）", () => {
      expect(experienceMatch(composite, [{ role_id: "F2", years: 1 }, { role_id: "K1", years: 1 }])).toEqual({ value: 50, coverage: 1 });
      expect(experienceMatch(composite, [{ role_id: "F2", years: 3 }, { role_id: "K1", years: 3 }]).value).toBe(87.5);
    });

    it("同じ Group の職業を複数経験しても 1 Group として数え、年数は合算する", () => {
      // F = 在職 2 年 = 75、K = 0 → 37.5
      expect(experienceMatch(composite, [{ role_id: "F1", years: 1 }, { role_id: "F2", years: 1 }])).toEqual({ value: 37.5, coverage: 0.5 });
    });

    it("満たしていない Group は、その Group の前職統計で達成率を出す", () => {
      // F = 在職 3 年 = 87.5、K = 0.2 / 0.4 = 50 → (87.5 + 50) / 2
      expect(experienceMatch(composite, [{ role_id: "F1", years: 3 }, { role_id: "B", years: 0.5 }]).value).toBeCloseTo(68.75);
      // A は F の前職統計には寄与するが K には寄与しない → (max(在職 87.5, 前職歴 100) + 0) / 2
      expect(experienceMatch(composite, [{ role_id: "F1", years: 3 }, { role_id: "A", years: 2 }]).value).toBe(50);
    });

    it("Group を満たさなければ各 Group の前職統計の平均", () => {
      // F = 0.2 / 0.4 × 100 = 50、K = 0 → 25
      expect(experienceMatch(composite, [{ role_id: "A", years: 0.5 }])).toEqual({ value: 25, coverage: 0 });
    });

    it("経験していない Group の達成率は、統計上どれだけ近くても 50 まで", () => {
      // F = min(50, 0.5 / 0.4 × 100) = 50、K = min(50, 0.2 / 0.4 × 100) = 50
      const both = [{ role_id: "A", years: 2 }, { role_id: "B", years: 1 }];
      expect(experienceMatch(composite, both).value).toBe(COMPOSITE_UNMET_GROUP_CAP);
      // F の職業の経験があれば F は cap を受けない：(max(在職 50, 前職歴 min(100, 125)) + min(50, 50)) / 2
      expect(experienceMatch(composite, [...both, { role_id: "F1", years: 1 }]).value).toBe(75);
    });

    it("単一 Group の Goal には上限をかけない", () => {
      expect(experienceMatch(stats(), [{ role_id: "A", years: 2 }, { role_id: "B", years: 1 }]).value).toBe(100);
    });

    it("どれかの Group の統計が無ければ算出不可（null）", () => {
      const missing = stats({ requirement_groups: [group("f", ["F1"]), { ...k, experience: [] }] });
      expect(experienceMatch(missing, [{ role_id: "F1", years: 1 }]).value).toBeNull();
    });
  });

  it("該当 Unit がなければ 0、統計や reference が無ければ算出不可（null）", () => {
    expect(match([])).toBe(0);
    expect(match([{ role_id: "C", years: 3 }])).toBe(0);
    const withGroup = (overrides: Partial<RequirementGroupStatistics>) =>
      stats({ requirement_groups: [{ ...group("g", ["G"]), ...overrides }] });
    expect(experienceMatch(withGroup({ experience: [] }), [{ role_id: "A", years: 1 }]).value).toBeNull();
    expect(experienceMatch(withGroup({ experience_reference: 0 }), [{ role_id: "A", years: 1 }]).value).toBeNull();
    expect(experienceMatch(stats({ requirement_groups: [] }), [{ role_id: "A", years: 1 }]).value).toBeNull();
  });
});

describe("educationMatch", () => {
  const requirement = stats();

  it("最低教育要件以上は同じ 100", () => {
    for (const degree of ["Bachelor", "Master", "PhD"]) expect(educationMatch(requirement, degree), degree).toBe(100);
  });

  it("要件未満は「その学歴以下」の人の割合 × 100（50 未満で、学歴が低いほど下がる）", () => {
    const secondary = educationMatch(requirement, "Secondary school")!;
    const none = educationMatch(requirement, "None")!;
    expect(secondary).toBeCloseTo(30); // 1 - P(学士以上) = 0.3
    expect(none).toBeCloseTo(10); // 1 - P(高卒等以上) = 0.1
    expect(none).toBeLessThan(secondary);
    expect(secondary).toBeLessThan(50);
  });

  it("要件が修士なら学士も要件未満", () => {
    const master = { ...requirement, minimum_education: "Master" as const };
    expect(educationMatch(master, "Master")).toBe(100);
    expect(educationMatch(master, "Bachelor")).toBeCloseTo(70); // 1 - P(修士以上) = 0.7
  });

  it("未入力・未知の学歴は 0、要件が無ければ算出不可（null）", () => {
    expect(educationMatch(requirement, null)).toBe(0);
    expect(educationMatch(requirement, "Diploma")).toBe(0);
    expect(educationMatch({ ...requirement, minimum_education: undefined }, "Master")).toBeNull();
    expect(educationMatch({ ...requirement, education_at_or_above: undefined }, "Master")).toBeNull();
  });
});

describe("usesEducationRequirement", () => {
  it.each([
    ["2.4.0", true],
    ["2.4.1", true],
    ["2.10.0", true],
    ["3.0.0", true],
    ["2.3.0", false],
    ["2.2.0", false],
    ["1.9.9", false],
  ])("calculation_version %s → %s", (version, expected) => {
    expect(usesEducationRequirement(version)).toBe(expected);
  });
});

describe("goalMatch", () => {
  it("算出可能なカテゴリの平均", () => {
    expect(goalMatch([60, 30, 90])).toBeCloseTo(60);
  });

  it("算出不可カテゴリは 0 点として平均に入れない", () => {
    expect(goalMatch([60, null, null])).toBe(60);
    expect(goalMatch([60, 20, null])).toBe(40);
  });

  it("算出可能なカテゴリがなければエラー", () => {
    expect(() => goalMatch([null, null])).toThrow();
  });
});

describe("evidenceMode / confidence", () => {
  it.each([
    ["exact", 500, "full", "moderate"],
    ["proxy", 500, "proxy", "moderate_low"],
    ["exact", 100, "full", "moderate"],
    ["exact", 99, "full", "low"],
    ["proxy", 99, "proxy", "low"],
    ["exact", 0, "skill_only", "low"],
    ["proxy", 0, "skill_only", "low"],
  ] as const)("%s / N=%d → %s / %s", (mapping, n, mode, conf) => {
    const s = stats({ mapping_status: mapping, goal_sample_size: n });
    const both = { experience: 50, education: 50 };
    expect(evidenceMode(s, both)).toBe(mode);
    expect(confidence(evidenceMode(s, both), n)).toBe(conf);
  });

  it.each([
    [50, null, "full"],
    [null, 50, "full"],
    [0, null, "full"], // 0 点は算出できている
    [null, null, "skill_only"],
  ] as const)("N > 0 で Experience=%s / Education=%s → %s", (experience, education, mode) => {
    expect(evidenceMode(stats({ goal_sample_size: 500 }), { experience, education })).toBe(mode);
  });

  it("Experience・Education とも算出できなければ、N ≥ 100 でも confidence = low", () => {
    const mode = evidenceMode(stats({ goal_sample_size: 500 }), { experience: null, education: null });
    expect(confidence(mode, 500)).toBe("low");
  });
});

describe("calculateCareerMatch", () => {
  it("3 カテゴリを算出し平均する", () => {
    const result = calculateCareerMatch(
      input({ skill_ids: ["html", "python"], experiences: [{ role_id: "A", years: 1.2 }], degree_id: "Master" }),
      stats(),
      skill,
      known,
    );
    expect(result.skill_match).toBe(50);
    expect(result.experience_match).toBeCloseTo(87.5); // (0.2 + 0.15) / 0.4
    expect(result.experience_goal_coverage).toBe(0);
    expect(result.education_match).toBeCloseTo(100); // 0.6 / 0.6
    expect(result.goal_match).toBeCloseTo((50 + 87.5 + 100) / 3);
    expect(result.evidence_mode).toBe("full");
    expect(result.confidence).toBe("moderate");
    expect(result.small_sample).toBe(false);
    expect(result.data_source_version).toBe("jobhop_v2:v2");
    expect(result.taxonomy_version).toBe("esco:1.1.2");
  });

  it("複数 Role の経験を合算する", () => {
    const result = calculateCareerMatch(
      input({ experiences: [{ role_id: "A", years: 0.5 }, { role_id: "B", years: 0.5 }] }),
      stats(),
      skill,
      known,
    );
    expect(result.experience_match).toBeCloseTo(75); // (0.2 + 0.1) / 0.4
  });

  it("Goal Sample Size = 0 なら skill_only（Experience / Education は null）", () => {
    const result = calculateCareerMatch(
      input({ skill_ids: ["html"], experiences: [{ role_id: "A", years: 1 }], degree_id: "Master" }),
      stats({ goal_sample_size: 0, requirement_groups: [], education: undefined, minimum_education: undefined, education_at_or_above: undefined }),
      skill,
      known,
    );
    expect(result.evidence_mode).toBe("skill_only");
    expect(result.confidence).toBe("low");
    expect(result.experience_match).toBeNull();
    expect(result.education_match).toBeNull();
    expect(result.goal_match).toBe(25);
  });

  it("Goal Sample Size > 0 でも Experience・Education とも算出できなければ skill_only", () => {
    const result = calculateCareerMatch(
      input({ skill_ids: ["html"], experiences: [{ role_id: "A", years: 1 }], degree_id: "Master" }),
      stats({ requirement_groups: [{ ...group("g", ["G"]), experience_reference: 0 }], education: undefined, minimum_education: undefined, education_at_or_above: undefined }),
      skill,
      known,
    );
    expect(result.goal_sample_size).toBe(500);
    expect(result.experience_match).toBeNull();
    expect(result.education_match).toBeNull();
    expect(result.evidence_mode).toBe("skill_only");
    expect(result.confidence).toBe("low");
    expect(result.goal_match).toBe(25);
  });

  it("Experience だけ算出できれば full（Education が算出不可でも）", () => {
    const result = calculateCareerMatch(
      input({ experiences: [{ role_id: "A", years: 0.5 }] }),
      stats({ education: undefined, minimum_education: undefined, education_at_or_above: undefined }),
      skill,
      known,
    );
    expect(result.education_match).toBeNull();
    expect(result.evidence_mode).toBe("full");
    expect(result.confidence).toBe("moderate");
  });

  it("Goal Sample Size < 100 なら confidence = low、small_sample = true", () => {
    const result = calculateCareerMatch(input(), stats({ goal_sample_size: 50 }), skill, known);
    expect(result.confidence).toBe("low");
    expect(result.small_sample).toBe(true);
  });

  it("Proxy Goal は evidence_mode = proxy", () => {
    const result = calculateCareerMatch(input(), stats({ mapping_status: "proxy" }), skill, known);
    expect(result.evidence_mode).toBe("proxy");
    expect(result.confidence).toBe("moderate_low");
  });

  it("入力が空なら各カテゴリ 0（算出不可ではない）", () => {
    const result = calculateCareerMatch(input(), stats(), skill, known);
    expect(result.skill_match).toBe(0);
    expect(result.experience_match).toBe(0);
    expect(result.education_match).toBe(0);
    expect(result.goal_match).toBe(0);
  });

  it("Unknown Skill / Role / Education は無視して ignored に返す", () => {
    const result = calculateCareerMatch(
      input({ skill_ids: ["html", "cobol"], experiences: [{ role_id: "Z", years: 1 }], degree_id: "Diploma" }),
      stats(),
      skill,
      known,
    );
    expect(result.skill_match).toBe(25);
    expect(result.experience_match).toBe(0);
    expect(result.education_match).toBe(0);
    expect(result.ignored).toEqual({
      skill_ids: ["cobol"],
      legacy_skill_ids: [],
      certification_ids: [],
      role_ids: ["Z"],
      degree_id: "Diploma",
    });
  });

  it("既知だが Goal 統計に存在しない Role は 0 寄与（ignored にしない）", () => {
    const result = calculateCareerMatch(input({ experiences: [{ role_id: "C", years: 3 }] }), stats(), skill, known);
    expect(result.experience_match).toBe(0);
    expect(result.ignored.role_ids).toEqual([]);
  });

  it("重複 Skill 入力は 1 回として数える", () => {
    const result = calculateCareerMatch(input({ skill_ids: ["html", "html"] }), stats(), skill, known);
    expect(result.skill_match).toBe(25);
  });

  it("Goal が一致しないデータの組み合わせはエラー", () => {
    expect(() => calculateCareerMatch(input(), stats({ goal_id: "other" }), skill, known)).toThrow();
  });
});

describe("resolveUserSkills", () => {
  it("直接入力・ツール・資格で同じスキルに届いても 1 つにまとめる", () => {
    const { held } = resolveUserSkills(
      { skill_ids: ["testing", "jest", "testing"], certification_ids: ["jstqb-fl", "jstqb-fl"] },
      skill,
      known,
    );
    expect([...held].sort()).toEqual(["jest", "testing"]);
  });

  it("旧 skill_id を移行してから、マスタに無い ID を除外する", () => {
    const resolved = resolveUserSkills(
      { skill_ids: ["shell-script", "cloud", "cobol"], certification_ids: ["unknown-cert"] },
      skill,
      known,
    );
    expect([...resolved.held]).toEqual(["docker"]);
    expect(resolved.ignoredSkillIds).toEqual(["cobol"]);
    expect(resolved.ignoredCertificationIds).toEqual(["unknown-cert"]);
    expect(resolved.legacySkillIds).toEqual(["cloud"]);
  });

  it("Skill Gap / Learning Path も同じ集合で判定する（資格経由のスキルが未習得に出ない）", () => {
    const path: LearningPathMaster = {
      goal_id: "test-goal",
      region: "JP",
      version: "1.0.0",
      steps: [{ learning_order: 1, step_id: "testing", name: "テスト", any_of: ["testing"] }],
    };
    const { held } = resolveUserSkills({ skill_ids: [], certification_ids: ["jstqb-fl"] }, skill, known);
    expect(learningPath(path, held)).toEqual([]);
  });
});
