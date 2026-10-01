import { describe, expect, it } from "vitest";
import {
  heldSkillIds,
  humanRequirementStatus,
  humanSkillProgress,
  layeredSkillProgress,
  normalizeHumanRequirements,
  resolveSkillLayerWeights,
} from "../skill-layers";
import type { Certification, GoalSkillLayers, HumanSkill, SkillStatistics, SkillStatisticsUnit } from "../types";

const humanSkills: HumanSkill[] = [
  { skill_id: "testing", name: "テスト", domain: "methodology_process", description: "", tools: [{ tool_id: "jest", name: "Jest" }] },
  { skill_id: "statistics", name: "統計学", domain: "knowledge_concepts", description: "" },
  { skill_id: "project-management", name: "プロジェクト管理", domain: "management_business_tools", description: "" },
];
const certifications: Certification[] = [
  { cert_id: "stat-kentei-2", name: "統計検定 2級", issuer: "日本統計学会", category: "data-ai", proves: ["statistics"] },
  { cert_id: "aws-saa", name: "AWS SAA", issuer: "AWS", category: "cloud", proves: ["aws"] },
];
const masters = { humanSkills, certifications };

function techUnit(unitId: string, contribution: number): SkillStatisticsUnit {
  return {
    unit_id: unitId,
    type: "skill",
    name: unitId,
    members: [{ skill_id: unitId, name: unitId, so_item: unitId, p_skill_given_goal: 0.5, region_p_skill_given_goal: 0.5 }],
    source_years: [2025],
    goal_respondents: 1000,
    other_respondents: 10000,
    p_skill_given_goal: 0.5,
    p_skill_given_other: 0.3,
    region_source_years: [2025],
    region_goal_respondents: 50,
    region_other_respondents: 500,
    region_p_skill_given_goal: 0.5,
    region_p_skill_given_other: 0.3,
    quantity: 0.5,
    quality: 62.5,
    contribution,
    p_value: 1e-10,
    significant: true,
    selected: true,
  };
}

const techStats: Pick<SkillStatistics, "goal_id" | "units"> = {
  goal_id: "test-goal",
  units: [techUnit("aws", 0.6), techUnit("python", 0.4)],
};
const defaults = { tech: 0.5, human: 0.5 };
const layers: GoalSkillLayers = {
  goal_id: "test-goal",
  human_requirements: ["testing", "statistics", "project-management", { requirement_id: "cloud", any_of: ["aws", "azure"] }],
};

describe("heldSkillIds", () => {
  it("資格は proves のスキル（人間定義層・技術スキル層）を持つとみなす", () => {
    const held = heldSkillIds({ skillIds: [], certificationIds: ["stat-kentei-2", "aws-saa"] }, masters);
    expect([...held].sort()).toEqual(["aws", "statistics"]);
  });

  it("ツールを使っていれば、その人間定義層スキルを持つとみなす", () => {
    expect(heldSkillIds({ skillIds: ["jest"], certificationIds: [] }, masters).has("testing")).toBe(true);
  });

  it("未知の資格は無視する", () => {
    expect([...heldSkillIds({ skillIds: ["python"], certificationIds: ["unknown"] }, masters)]).toEqual(["python"]);
  });
});

describe("humanSkillProgress", () => {
  const requirements = normalizeHumanRequirements(layers.human_requirements);

  it("文字列の要件はそのスキル 1 つの any_of になる", () => {
    expect(requirements[0]).toEqual({ requirement_id: "testing", any_of: ["testing"] });
  });

  it("満たした要件の数 / 要件の数 × 100（要件は均等、any_of はどれか 1 つ）", () => {
    expect(humanSkillProgress(requirements, new Set())).toBe(0);
    expect(humanSkillProgress(requirements, new Set(["testing", "azure"]))).toBe(50);
    expect(humanSkillProgress(requirements, new Set(["testing", "statistics", "project-management", "aws"]))).toBe(100);
  });

  it("要件が無ければ null", () => {
    expect(humanSkillProgress([], new Set(["testing"]))).toBeNull();
  });

  it("要件ごとの充足状況を返す（Skill Gap 用）", () => {
    expect(humanRequirementStatus(requirements, new Set(["azure"])).map((r) => [r.requirement_id, r.satisfied])).toEqual([
      ["testing", false],
      ["statistics", false],
      ["project-management", false],
      ["cloud", true],
    ]);
  });
});

describe("resolveSkillLayerWeights", () => {
  const both = { tech: true, human: true };

  it("Goal の配分が無ければ既定値", () => {
    expect(resolveSkillLayerWeights(undefined, defaults, both)).toEqual({ tech: 0.5, human: 0.5, source: "default" });
  });

  it("Goal の配分を合計 1 に正規化する", () => {
    expect(resolveSkillLayerWeights({ tech: 1, human: 3 }, defaults, both)).toEqual({ tech: 0.25, human: 0.75, source: "goal" });
    expect(resolveSkillLayerWeights({ tech: 0, human: 1 }, defaults, both)).toEqual({ tech: 0, human: 1, source: "goal" });
  });

  it("計算できない層は 0 にして、もう片方を 100% にする", () => {
    expect(resolveSkillLayerWeights(undefined, defaults, { tech: false, human: true })).toEqual({
      tech: 0,
      human: 1,
      source: "fallback",
    });
    expect(resolveSkillLayerWeights(undefined, defaults, { tech: true, human: false })).toEqual({
      tech: 1,
      human: 0,
      source: "fallback",
    });
  });

  it("配分 0 の層が計算できなくても fallback にはしない", () => {
    expect(resolveSkillLayerWeights({ tech: 0, human: 1 }, defaults, { tech: false, human: true }).source).toBe("goal");
  });

  it("配分のある層が計算できなければ、配分 0 でも計算できる層を 100% にする", () => {
    expect(resolveSkillLayerWeights({ tech: 1, human: 0 }, defaults, { tech: false, human: true })).toEqual({
      tech: 0,
      human: 1,
      source: "fallback",
    });
    expect(resolveSkillLayerWeights({ tech: 0, human: 1 }, defaults, { tech: true, human: false })).toEqual({
      tech: 1,
      human: 0,
      source: "fallback",
    });
  });

  it("不正な配分、または計算できる層が無ければエラー", () => {
    expect(() => resolveSkillLayerWeights({ tech: -1, human: 1 }, defaults, both)).toThrow();
    expect(() => resolveSkillLayerWeights({ tech: 0, human: 0 }, defaults, both)).toThrow();
    expect(() => resolveSkillLayerWeights({ tech: 1, human: 0 }, defaults, { tech: false, human: false })).toThrow();
  });
});

describe("layeredSkillProgress", () => {
  it("技術スキル層 × 配分 + 人間定義層 × 配分", () => {
    // 技術: aws(0.6) を満たして 60、人間: testing と cloud(aws) を満たして 50
    const result = layeredSkillProgress({
      held: new Set(["aws", "testing"]),
      techStats,
      goalLayers: layers,
      defaultWeights: defaults,
    });
    expect(result.tech_progress).toBeCloseTo(60, 10);
    expect(result.human_progress).toBe(50);
    expect(result.progress).toBeCloseTo(55, 10);
  });

  it("人間定義層 100% の Goal は技術スキル層の達成率を合算しない", () => {
    const result = layeredSkillProgress({
      held: new Set(["aws", "python"]),
      techStats,
      goalLayers: { ...layers, layer_weights: { tech: 0, human: 1 } },
      defaultWeights: defaults,
    });
    expect(result.tech_progress).toBeCloseTo(100, 10);
    expect(result.progress).toBe(25);
  });

  it("技術スキル統計が無ければ人間定義層だけで計算する", () => {
    const result = layeredSkillProgress({ held: new Set(["testing"]), techStats: null, goalLayers: layers, defaultWeights: defaults });
    expect(result.tech_progress).toBeNull();
    expect(result.weights.source).toBe("fallback");
    expect(result.progress).toBe(25);
  });

  it("Goal が一致しなければエラー", () => {
    expect(() =>
      layeredSkillProgress({ held: new Set(), techStats: { ...techStats, goal_id: "other" }, goalLayers: layers, defaultWeights: defaults }),
    ).toThrow();
  });
});
