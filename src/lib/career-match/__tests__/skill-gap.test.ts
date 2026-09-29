import { describe, expect, it } from "vitest";
import { evaluateSteps, learningPath } from "../skill-gap";
import type { LearningPathMaster } from "../types";

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
