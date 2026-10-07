import { describe, expect, it } from "vitest";
import type { RecommendationArticle } from "@/lib/career-match/recommendations";
import type { LearningStep } from "@/lib/career-match/types";
import { stepMaterialCards } from "../materials";

const steps: LearningStep[] = [
  { learning_order: 1, step_id: "backend-language", name: "言語", any_of: ["python", "java"] },
  { learning_order: 2, step_id: "docker", name: "Docker", any_of: ["docker"] },
];

const article = (id: string, skillIds: string[]): RecommendationArticle => ({
  id,
  title: id,
  description: "",
  eyecatch: undefined,
  type: "material",
  skill_ids: skillIds,
  goal_ids: [],
  audience: null,
  order: 0,
});

describe("stepMaterialCards", () => {
  it("shows materials for every language option even when the language step is satisfied", () => {
    const cards = stepMaterialCards("backend-developer", steps, new Set(["python", "docker"]), [
      article("py", ["python"]),
      article("java", ["java"]),
    ]);
    expect(cards.get("backend-language")!.map((c) => c.article_id).sort()).toEqual(["java", "py"]);
    expect(cards.get("backend-language")!.every((c) => c.placement === "step_review")).toBe(true);
  });

  it("repeats an article matching several languages in each language step", () => {
    const languages: LearningStep[] = [
      { learning_order: 1, step_id: "javascript", name: "JavaScript", any_of: ["javascript"] },
      { learning_order: 2, step_id: "typescript", name: "TypeScript", any_of: ["typescript"] },
    ];
    const cards = stepMaterialCards("frontend-developer", languages, new Set(), [article("js-ts", ["javascript", "typescript"])]);
    expect(cards.get("javascript")!.map((c) => c.article_id)).toEqual(["js-ts"]);
    expect(cards.get("typescript")!.map((c) => c.article_id)).toEqual(["js-ts"]);
  });

  it("uses learn placement for an unsatisfied language step and does not repeat its articles in other steps", () => {
    const cards = stepMaterialCards("backend-developer", steps, new Set(), [
      article("py-docker", ["python", "docker"]),
      article("docker", ["docker"]),
    ]);
    expect(cards.get("backend-language")!.map((c) => [c.article_id, c.placement])).toEqual([["py-docker", "step_learn"]]);
    expect(cards.get("docker")!.map((c) => c.article_id)).toEqual(["docker"]);
  });
});
