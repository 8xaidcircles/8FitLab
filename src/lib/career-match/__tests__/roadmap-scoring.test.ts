import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGoals, loadLearningPath, loadSkillContext } from "../data";
import { skillMatchScope } from "../skill-layers";

// 学習ロードマップの Step の選択肢に、Skill Match で評価されるものと評価されないものが混ざっていないか。
// 混在すると、評価されない選択肢を選んだ人は Step を習得済みなのに Skill が上がらない（例：Kotlin のみのバックエンド）。
// 既にある混在は data/skills/roadmap-scoring-exceptions.json に理由つきで載せ、新しい混在が増えたら失敗させる

type RoadmapScoringException = { goal_id: string; step_id: string; unscored_options: string[]; reason: string };

const exceptions: RoadmapScoringException[] = JSON.parse(
  await readFile(path.join(process.cwd(), "data", "skills", "roadmap-scoring-exceptions.json"), "utf-8"),
).exceptions;

const goals = await loadGoals();
const mixed: Omit<RoadmapScoringException, "reason">[] = [];
for (const goal of goals) {
  const [skill, roadmap] = await Promise.all([loadSkillContext(goal.goal_id), loadLearningPath(goal.goal_id)]);
  const scored = skillMatchScope(skill).skillIds;
  for (const step of roadmap.steps) {
    if (step.any_of.length < 2) continue;
    const unscored = step.any_of.filter((id) => !scored.has(id));
    if (unscored.length > 0 && unscored.length < step.any_of.length) {
      mixed.push({ goal_id: goal.goal_id, step_id: step.step_id, unscored_options: unscored });
    }
  }
}
const key = (e: { goal_id: string; step_id: string }) => `${e.goal_id}/${e.step_id}`;

describe("ロードマップの選択肢の評価が揃っている（全 Goal・実データ）", () => {
  it("評価される選択肢とされない選択肢が混ざる Step は、例外リストに載っているものだけ", () => {
    const listed = new Map(exceptions.map((e) => [key(e), e]));
    for (const m of mixed) {
      expect(listed.has(key(m)), `${key(m)}：評価されない選択肢 ${m.unscored_options.join(", ")}`).toBe(true);
      expect([...m.unscored_options].sort(), key(m)).toEqual([...listed.get(key(m))!.unscored_options].sort());
    }
  });

  it("例外リストに、もう混在していない Step が残っていない", () => {
    const found = new Set(mixed.map(key));
    for (const e of exceptions) expect(found.has(key(e)), `${key(e)} は混在していない。例外リストから消す`).toBe(true);
  });

  it("例外には理由がある", () => {
    for (const e of exceptions) expect(e.reason.trim().length, key(e)).toBeGreaterThan(0);
  });

  it.each(["backend-developer", "full-stack-developer"])(
    "%s のバックエンド言語は混在しない（Kotlin がサーバーサイドの言語に入っている）",
    (goalId) => {
      expect(mixed.map(key)).not.toContain(`${goalId}/backend-language`);
    },
  );
});
