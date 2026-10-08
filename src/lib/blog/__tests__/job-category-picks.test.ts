import { describe, expect, it } from "vitest";
import { loadGoals, loadLearningPath } from "@/lib/career-match/data";
import { JOB_SERVICE_PICKS, SCHOOL_PICKS } from "../job-category-picks";

const goalIds = (await loadGoals()).map((goal) => goal.goal_id);
const stepIdsByGoal = new Map(
  await Promise.all(goalIds.map(async (id) => [id, new Set((await loadLearningPath(id)).steps.map((s) => s.step_id))] as const)),
);

it("スクールがカバーするステップは、その職種の学習ロードマップに存在する", () => {
  for (const pick of SCHOOL_PICKS) {
    const steps = stepIdsByGoal.get(pick.goalId)!;
    for (const stepId of pick.coveredStepIds ?? []) expect(steps.has(stepId), `${pick.name}: ${stepId}`).toBe(true);
    expect(new Set(pick.coveredStepIds).size).toBe(pick.coveredStepIds?.length ?? 0);
  }
});

describe.each([
  ["スクール", SCHOOL_PICKS],
  ["転職サービス", JOB_SERVICE_PICKS],
])("%s の職種別ピック", (_label, picks) => {
  it("全職種に 1 つずつ、Goal の並び順で載せる", () => {
    expect(picks.map((pick) => pick.goalId)).toEqual(goalIds);
  });

  it("同じサービス（同じスクールなら同じコース）を複数の職種に載せない", () => {
    const names = picks.map((pick) => `${pick.name}/${pick.course ?? ""}`);
    const urls = picks.map((pick) => pick.officialUrl);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("同じスクールを複数の職種に載せるときは、職種ごとにコースを分ける", () => {
    const byName = Map.groupBy(picks, (pick) => pick.name);
    for (const group of byName.values()) {
      if (group.length > 1) for (const pick of group) expect(pick.course, pick.name).toBeTruthy();
    }
  });

  it("公式サイトは https の URL", () => {
    for (const pick of picks) expect(new URL(pick.officialUrl).protocol).toBe("https:");
  });
});
