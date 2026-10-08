import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { LearningPathMaster } from "@/lib/career-match/types";
import { determineUserStage, hasGoalExperience, isLanguageStep } from "../determine-stage";
import { stageServices } from "../services";

const frontend = {
  requirement_groups: [
    { group_id: "frontend-developer", name: "フロントエンドエンジニア", occupations: [{ code: "2513.5", label: "web developer" }, { code: "2512.5", label: "user interface developer" }] },
  ],
};
const fullStack = {
  requirement_groups: [
    { group_id: "frontend", name: "フロントエンド", occupations: [{ code: "2513.5", label: "web developer" }] },
    { group_id: "backend", name: "バックエンド", occupations: [{ code: "2512.4", label: "software developer" }] },
  ],
};
const done = [{ satisfied: true }, { satisfied: true }];
const missing = [{ satisfied: true }, { satisfied: false }];

describe("determineUserStage", () => {
  it("is experienced with at least 0.5 years in a Goal occupation, regardless of skills", () => {
    expect(determineUserStage(frontend, [{ role_id: "2512.5", years: 0.5 }], missing)).toBe("experienced");
  });

  it("ignores experience shorter than 0.5 years or in other occupations", () => {
    expect(determineUserStage(frontend, [{ role_id: "2513.5", years: 0 }], missing)).toBe("learning");
    expect(determineUserStage(frontend, [{ role_id: "2512.4", years: 5 }], done)).toBe("ready");
  });

  it("requires experience in every requirement group", () => {
    expect(hasGoalExperience(fullStack, [{ role_id: "2513.5", years: 3 }])).toBe(false);
    expect(
      hasGoalExperience(fullStack, [
        { role_id: "2513.5", years: 3 },
        { role_id: "2512.4", years: 1 },
      ]),
    ).toBe(true);
  });

  it("is ready when every step is satisfied and learning otherwise", () => {
    expect(determineUserStage(frontend, [], done)).toBe("ready");
    expect(determineUserStage(frontend, [], missing)).toBe("learning");
  });
});

describe("isLanguageStep", () => {
  it("treats steps whose options are all languages as language steps", async () => {
    const read = async (goalId: string) =>
      JSON.parse(await readFile(path.join(process.cwd(), "data", "learning-paths", `${goalId}.json`), "utf-8")) as LearningPathMaster;
    const ids = (p: LearningPathMaster) => p.steps.filter(isLanguageStep).map((s) => s.step_id);

    expect(ids(await read("frontend-developer"))).toEqual(["javascript", "typescript"]);
    expect(ids(await read("backend-developer"))).toEqual(["backend-language", "sql"]);
    expect(ids(await read("devops-sre"))).toEqual(["automation-scripting"]);
    expect(ids(await read("mobile-app-developer"))).toEqual([]);
  });
});

describe("stageServices", () => {
  it("reads the mapping by Goal name and returns [] for unknown goals or groups", () => {
    expect(stageServices("フロントエンドエンジニア", "learning", "schools").length).toBeGreaterThan(0);
    expect(stageServices("フロントエンドエンジニア", "learning", "freelance")).toEqual([]);
    expect(stageServices("unknown", "ready", "services")).toEqual([]);
  });
});
