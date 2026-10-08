import { describe, expect, it } from "vitest";
import { evaluateSteps, learningPath, noEffectSteps, raisingSteps, skillGap } from "../skill-gap";
import { skillMatchScope } from "../skill-layers";
import type { GoalSkillLayers, LearningPathMaster, SkillScoringContext } from "../types";
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

describe("skillGap（習得すると Skill Progress が上がるかでの分類）", () => {
  const techStats = skillStatistics("frontend-developer", [
    unit("html", ["html"], 0.3),
    unit("framework", ["react", "vue"], 0.5),
    unit("perl", ["perl"], 0.9, false),
  ]);
  const scoring = (layer_weights?: { tech: number; human: number }): SkillScoringContext => ({
    techStats,
    goalLayers: { goal_id: "frontend-developer", layer_weights, human_requirements: ["testing"] } satisfies GoalSkillLayers,
    defaultWeights: { tech: 1, human: 0 },
  });
  // 配分・シェアの割り算による浮動小数点の誤差を丸めて比べる
  const round = (gain: number) => Math.round(gain * 1e9) / 1e9;
  const effects = (gap: ReturnType<typeof skillGap>) => gap.steps.map((s) => [s.step_id, s.effect, round(s.gain)]);

  it("技術層 100% の Goal：未習得で採用 unit を満たす Step だけが raises（gain = unit のシェア）、ほかは not_scored", () => {
    // Git やテストのような人間定義層の要件は、配分が 0 なら Skill Progress に効かないため not_scored
    expect(effects(skillGap(path, ["html", "testing"], scoring()))).toEqual([
      ["html", "satisfied", 0],
      ["javascript", "not_scored", 0],
      ["framework", "raises", 62.5],
      ["testing", "satisfied", 0],
    ]);
  });

  it("option_gains は評価対象の選択肢だけを持ち、効かない選択肢（angular）は含めない", () => {
    const framework = skillGap(path, [], scoring()).steps.find((s) => s.step_id === "framework")!;
    expect(framework.option_gains.map((o) => [o.skill_id, round(o.gain)])).toEqual([
      ["react", 62.5],
      ["vue", 62.5],
    ]);
    // 効かない選択肢（angular）でも Step は満たす
    expect(skillGap(path, ["angular"], scoring()).steps.find((s) => s.step_id === "framework")!.effect).toBe("satisfied");
  });

  it("同じ unit の別の技術で評価済みの Step は credited（gain 0、credited_by に unit の名前）", () => {
    const split: LearningPathMaster = {
      ...path,
      steps: [
        { learning_order: 1, step_id: "react", name: "React", any_of: ["react"] },
        { learning_order: 2, step_id: "vue", name: "Vue", any_of: ["vue"] },
      ],
    };
    const vue = skillGap(split, ["react"], scoring()).steps.find((s) => s.step_id === "vue")!;
    expect(vue).toMatchObject({ effect: "credited", gain: 0, credited_by: ["framework"], overlaps_with: [] });
    expect(vue.option_gains).toEqual([{ skill_id: "vue", gain: 0 }]);
  });

  it("同じ unit を共有する raises の Step は overlaps_with に互いを持つ（gain を合計できない）", () => {
    const split: LearningPathMaster = {
      ...path,
      steps: [
        { learning_order: 1, step_id: "react", name: "React", any_of: ["react"] },
        { learning_order: 2, step_id: "vue", name: "Vue", any_of: ["vue"] },
        { learning_order: 3, step_id: "html", name: "HTML", any_of: ["html"] },
      ],
    };
    const gap = skillGap(split, [], scoring());
    expect(gap.steps.map((s) => [s.step_id, s.effect, round(s.gain), s.overlaps_with])).toEqual([
      ["react", "raises", 62.5, ["vue"]],
      ["vue", "raises", 62.5, ["react"]],
      ["html", "raises", 37.5, []],
    ]);
  });

  it("最良でない選択肢が別の Step と unit を共有していても overlaps_with に入る", () => {
    // either の最良は react（62.5）で html の Step と重ならないが、もう 1 つの選択肢 html は重なる
    const split: LearningPathMaster = {
      ...path,
      steps: [
        { learning_order: 1, step_id: "either", name: "React か HTML", any_of: ["react", "html"] },
        { learning_order: 2, step_id: "html", name: "HTML", any_of: ["html"] },
      ],
    };
    const gap = skillGap(split, [], scoring());
    expect(gap.steps.map((s) => [s.step_id, round(s.gain), s.overlaps_with])).toEqual([
      ["either", 62.5, ["html"]],
      ["html", 37.5, ["either"]],
    ]);
  });

  it("基本リスト・特有リストを持つ統計：gain = 技術スキル層の配分 × unit の割合（特有リストだけの unit は β × d / D × 100）", () => {
    // β = 0.2。html：基本 0.6、framework：基本 0.4・特有 0.3、javascript：特有 0.1（B = 1.0、D = 0.4）
    const mixed: SkillScoringContext = {
      techStats: skillStatistics(
        "frontend-developer",
        [unit("html", ["html"], 0.6), unit("framework", ["react", "vue"], 0.4, true, 0.3), unit("javascript", ["javascript"], 0, true, 0.1)],
        0.2,
      ),
      goalLayers: { goal_id: "frontend-developer", layer_weights: { tech: 0.5, human: 0.5 }, human_requirements: ["testing"] },
      defaultWeights: { tech: 1, human: 0 },
    };
    expect(effects(skillGap(path, [], mixed))).toEqual([
      ["html", "raises", round(0.5 * 0.8 * 0.6 * 100)], // 24
      ["javascript", "raises", round(0.5 * 0.2 * (0.1 / 0.4) * 100)], // 2.5
      ["framework", "raises", round(0.5 * (0.8 * 0.4 + 0.2 * (0.3 / 0.4)) * 100)], // 23.5
      ["testing", "raises", 50],
    ]);
  });

  it("人間定義層に配分がある Goal では、人間定義層の要件の Step も raises になる", () => {
    expect(effects(skillGap(path, [], scoring({ tech: 0, human: 1 })))).toEqual([
      ["html", "not_scored", 0],
      ["javascript", "not_scored", 0],
      ["framework", "not_scored", 0],
      ["testing", "raises", 100],
    ]);
  });

  it("同じ要件の別の技術で評価済みの Step は credited で、credited_by は要件の名前（name が無ければ requirement_id）", () => {
    const vcsPath: LearningPathMaster = {
      ...path,
      steps: [
        { learning_order: 1, step_id: "git", name: "Git", any_of: ["git-github"] },
        { learning_order: 2, step_id: "svn", name: "SVN", any_of: ["svn"] },
      ],
    };
    const context = (name?: string): SkillScoringContext => ({
      techStats: null,
      goalLayers: { goal_id: "frontend-developer", human_requirements: [{ requirement_id: "vcs", name, any_of: ["git-github", "svn"] }] },
      defaultWeights: { tech: 1, human: 0 },
    });
    const svn = (name?: string) => skillGap(vcsPath, ["git-github"], context(name)).steps.find((s) => s.step_id === "svn")!;
    expect(svn("バージョン管理")).toMatchObject({ effect: "credited", gain: 0, credited_by: ["バージョン管理"] });
    expect(svn().credited_by).toEqual(["vcs"]);
  });

  it("全 Step を learning_order 順に 1 回ずつ含む", () => {
    expect(skillGap(path, [], scoring()).steps.map((s) => s.step_id)).toEqual(evaluateSteps(path, []).map((s) => s.step_id));
  });

  it("辞書に無い skill_id だけの Step は not_scored", () => {
    const withUnknown: LearningPathMaster = {
      ...path,
      steps: [...path.steps, { learning_order: 5, step_id: "unknown", name: "未知", any_of: ["unknown-skill-123"] }],
    };
    const unknown = skillGap(withUnknown, [], scoring()).steps.find((s) => s.step_id === "unknown")!;
    expect(unknown).toMatchObject({ effect: "not_scored", gain: 0, option_gains: [] });
  });

  it("raisingSteps は raises だけ、noEffectSteps は credited と not_scored だけを learning_order 順に返す", () => {
    const gap = skillGap(path, ["testing"], scoring());
    expect(raisingSteps(gap).map((s) => s.step_id)).toEqual(["html", "framework"]);
    expect(noEffectSteps(gap).map((s) => s.step_id)).toEqual(["javascript"]);
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
