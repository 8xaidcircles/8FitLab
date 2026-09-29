import { describe, expect, it } from "vitest";
import { evaluateSteps, learningPath, skillGap } from "../skill-gap";
import { skillMatchScope } from "../skill-layers";
import type { GoalSkillLayers, LearningPathMaster } from "../types";
import { skillStatistics, unit } from "./skill-fixtures";

const path: LearningPathMaster = {
  goal_id: "frontend-developer",
  region: "JP",
  version: "1.0.0",
  steps: [
    { learning_order: 3, step_id: "framework", name: "フロントエンドフレームワーク", any_of: ["react", "vue", "angular"] },
    { learning_order: 1, step_id: "html", name: "HTML", any_of: ["html"] },
    { learning_order: 2, step_id: "javascript", name: "JavaScript", any_of: ["javascript"] },
    { learning_order: 4, step_id: "testing", name: "テスト", any_of: ["testing"] },
  ],
};

describe("learningPath", () => {
  it("未習得 Step を learning_order 順に返す", () => {
    expect(learningPath(path, ["html"]).map((s) => s.step_id)).toEqual(["javascript", "framework", "testing"]);
  });

  it("選択肢のどれか 1 つを保有していれば、その Step は除外される", () => {
    expect(learningPath(path, ["html", "javascript", "vue"]).map((s) => s.step_id)).toEqual(["testing"]);
  });

  it("未習得 Step には選択肢（any_of）がそのまま残る", () => {
    expect(learningPath(path, [])[2].any_of).toEqual(["react", "vue", "angular"]);
  });

  it("全 Step 習得済みなら空", () => {
    expect(learningPath(path, ["html", "javascript", "angular", "testing"])).toEqual([]);
  });

  it("返り値に satisfied フラグを含めない", () => {
    expect(learningPath(path, [])[0]).not.toHaveProperty("satisfied");
  });
});

describe("evaluateSteps", () => {
  it("全 Step に satisfied を付けて順序どおり返す", () => {
    expect(evaluateSteps(path, ["react"]).map((s) => [s.step_id, s.satisfied])).toEqual([
      ["html", false],
      ["javascript", false],
      ["framework", true],
      ["testing", false],
    ]);
  });

  it("マスタの並びを変更しない", () => {
    evaluateSteps(path, []);
    expect(path.steps[0].step_id).toBe("framework");
  });
});

describe("skillGap（Skill Match に効く Step と前提・基本要件の分離）", () => {
  const techStats = skillStatistics("frontend-developer", [
    unit("html", ["html"], 0.3),
    unit("framework", ["react", "vue"], 0.5),
    unit("perl", ["perl"], 0.9, false),
  ]);
  const layers = (layer_weights?: { tech: number; human: number }): GoalSkillLayers => ({
    goal_id: "frontend-developer",
    layer_weights,
    human_requirements: ["testing"],
  });
  const scope = (layer_weights?: { tech: number; human: number }) =>
    skillMatchScope({ techStats, goalLayers: layers(layer_weights), defaultWeights: { tech: 1, human: 0 } }).skillIds;

  it("技術層 100% の Goal：採用 unit を含む Step だけが data_driven、ほかは checklist", () => {
    const gap = skillGap(path, ["html", "testing"], scope());
    expect(gap.data_driven.map((s) => [s.step_id, s.satisfied])).toEqual([
      ["html", true],
      ["framework", false],
    ]);
    // Git やテストのような人間定義層の要件は、配分が 0 なら Skill Match に効かないため checklist
    expect(gap.checklist.map((s) => [s.step_id, s.satisfied])).toEqual([
      ["javascript", false],
      ["testing", true],
    ]);
  });

  it("選択肢の一部だけが効く Step は data_driven とし、効く選択肢を scored_options に持つ", () => {
    const framework = skillGap(path, ["angular"], scope()).data_driven.find((s) => s.step_id === "framework")!;
    expect(framework.scored_options).toEqual(["react", "vue"]);
    // 効かない選択肢（angular）でも Step は満たす。Skill Match には効かないことを scored_options で区別する
    expect(framework.satisfied).toBe(true);
  });

  it("人間定義層に配分がある Goal では、人間定義層の要件も data_driven", () => {
    const gap = skillGap(path, [], scope({ tech: 0, human: 1 }));
    expect(gap.data_driven.map((s) => s.step_id)).toEqual(["testing"]);
    expect(gap.checklist.map((s) => s.step_id)).toEqual(["html", "javascript", "framework"]);
  });

  it("両方を合わせると全 Step を learning_order 順に 1 回ずつ含む", () => {
    const gap = skillGap(path, [], scope());
    const all = [...gap.data_driven, ...gap.checklist].sort((a, b) => a.learning_order - b.learning_order);
    expect(all.map((s) => s.step_id)).toEqual(evaluateSteps(path, []).map((s) => s.step_id));
  });

  it("Skill Match に効く skill_id が無ければ、すべて checklist", () => {
    const gap = skillGap(path, [], new Set());
    expect(gap.data_driven).toEqual([]);
    expect(gap.checklist).toHaveLength(4);
  });
});

describe("skillMatchScope", () => {
  const techStats = skillStatistics("g", [unit("sql", ["sql"], 0.5), unit("perl", ["perl"], 0.9, false)]);
  const goalLayers = (layer_weights?: { tech: number; human: number }): GoalSkillLayers => ({
    goal_id: "g",
    layer_weights,
    human_requirements: [{ requirement_id: "vcs", any_of: ["git-github", "svn"] }],
  });

  it("配分のある層の skill_id だけを返す（採用されていない unit は含めない）", () => {
    const def = { tech: 1, human: 0 };
    expect([...skillMatchScope({ techStats, goalLayers: goalLayers(), defaultWeights: def }).skillIds]).toEqual(["sql"]);
    expect([...skillMatchScope({ techStats, goalLayers: goalLayers({ tech: 0, human: 1 }), defaultWeights: def }).skillIds]).toEqual([
      "git-github",
      "svn",
    ]);
    expect(
      [...skillMatchScope({ techStats, goalLayers: goalLayers({ tech: 0.5, human: 0.5 }), defaultWeights: def }).skillIds].sort(),
    ).toEqual(["git-github", "sql", "svn"]);
  });

  it("技術スキル統計が無ければ fallback で人間定義層の skill_id を返す", () => {
    const result = skillMatchScope({ techStats: null, goalLayers: goalLayers(), defaultWeights: { tech: 1, human: 0 } });
    expect(result.weights).toEqual({ tech: 0, human: 1, source: "fallback" });
    expect([...result.skillIds]).toEqual(["git-github", "svn"]);
  });
});
