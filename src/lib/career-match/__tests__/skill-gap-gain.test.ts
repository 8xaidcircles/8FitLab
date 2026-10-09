import { describe, expect, it } from "vitest";
import { calculateCareerMatch, resolveUserSkills } from "../calculate";
import { loadCareerStatistics, loadGoals, loadKnownIds, loadLearningPath, loadSkillContext } from "../data";
import { raisingSteps, skillGap } from "../skill-gap";
import { skillMatchScope } from "../skill-layers";
import { skillUnitGaps } from "../skill-score";
import type { SkillGapStepScored } from "../types";

const goals = await loadGoals();
const known = await loadKnownIds();

async function goalContext(goalId: string) {
  const [stats, skill, path] = await Promise.all([loadCareerStatistics(goalId), loadSkillContext(goalId), loadLearningPath(goalId)]);
  const scoring = { techStats: skill.techStats, goalLayers: skill.goalLayers, defaultWeights: skill.defaultWeights };
  const input = (skill_ids: string[]) => ({ skill_ids, certification_ids: [], experiences: [], degree_id: null });
  const held = (skillIds: string[]) => resolveUserSkills(input(skillIds), skill, known).held;
  const gap = (skillIds: string[]) => skillGap(path, held(skillIds), scoring);
  const progress = (skillIds: string[]) => calculateCareerMatch(input(skillIds), stats, skill, known).skill_progress;
  return { skill, path, gap, progress };
}

const step = (steps: SkillGapStepScored[], stepId: string) => {
  const found = steps.find((s) => s.step_id === stepId);
  if (!found) throw new Error(`step ${stepId} is not in the learning path`);
  return found;
};

describe("skillGap の分類（実データ）", () => {
  it("データアナリスト・Python のみ：データ分析言語は習得済み、データフレーム操作は別の項目として上がり、pandas と tidyverse の得点増は同じ", async () => {
    const { gap } = await goalContext("data-analyst");
    const { steps } = gap(["python"]);
    expect(step(steps, "data-language").effect).toBe("satisfied");
    const dataframe = step(steps, "dataframe");
    expect(dataframe.effect).toBe("raises");
    const gainOf = (id: string) => dataframe.option_gains.find((o) => o.skill_id === id)!.gain;
    expect(gainOf("pandas")).toBeGreaterThan(0);
    expect(gainOf("tidyverse")).toBeCloseTo(gainOf("pandas"), 10);
  });

  it("データアナリスト・スキルなし：データ分析言語とデータフレーム操作は別の項目のシェアで上がり、重ならない", async () => {
    const { gap, skill } = await goalContext("data-analyst");
    const { steps } = gap([]);
    const shares = skillUnitGaps(skill.techStats!, []);
    const shareOf = (unitId: string) => shares.find((g) => g.unit.unit_id === unitId)!.share;
    const tech = skillMatchScope(skill).weights.tech;
    expect(step(steps, "data-language").gain).toBeCloseTo(shareOf("analysis-language") * tech, 6);
    expect(step(steps, "dataframe").gain).toBeCloseTo(Math.max(shareOf("dataframe-library"), shareOf("numpy")) * tech, 6);
    expect(step(steps, "data-language").overlaps_with).not.toContain("dataframe");
    expect(step(steps, "dataframe").overlaps_with).not.toContain("data-language");
  });

  it("フロントエンド：JavaScript のみなら TypeScript は評価済み、TypeScript のみなら JavaScript は評価済み", async () => {
    const { gap } = await goalContext("frontend-developer");
    expect(step(gap(["javascript"]).steps, "typescript")).toMatchObject({ effect: "credited", gain: 0 });
    expect(step(gap(["typescript"]).steps, "javascript")).toMatchObject({ effect: "credited", gain: 0 });
  });

  it("データアナリストの Git は基礎項目（スコアの対象外）", async () => {
    const { gap } = await goalContext("data-analyst");
    expect(step(gap([]).steps, "git-github")).toMatchObject({ effect: "not_scored", gain: 0, option_gains: [] });
  });
});

// skillGap の gain が、実際に選択肢を入力に足して計算した Skill Progress の差と一致する（2 か所の計算が食い違っていない）
describe("ステップの得点増 = 選択肢を足して再計算した Skill Progress の差（全 Goal・実データ）", () => {
  it.each(goals.map((g) => [g.goal_id] as const))("%s", async (goalId) => {
    const { path, gap, progress } = await goalContext(goalId);
    const sorted = [...path.steps].sort((a, b) => a.learning_order - b.learning_order);
    // スキルなしと、最初の Step だけ習得した場合の 2 通りで確かめる
    for (const base of [[], [sorted[0].any_of[0]]]) {
      const baseProgress = progress(base);
      for (const s of gap(base).steps) {
        if (s.satisfied) continue;
        for (const option of s.any_of) {
          const expected = s.option_gains.find((o) => o.skill_id === option)?.gain ?? 0;
          expect(progress([...base, option]) - baseProgress, `${s.step_id}: ${option}`).toBeCloseTo(expected, 6);
        }
        expect(s.gain, s.step_id).toBe(Math.max(0, ...s.option_gains.map((o) => o.gain)));
      }
    }
  });

  it.each(goals.map((g) => [g.goal_id] as const))("%s：raisingSteps の得点増はどれも 0 より大きい", async (goalId) => {
    const { gap } = await goalContext(goalId);
    const raising = raisingSteps(gap([]));
    for (const s of raising) expect(s.gain, s.step_id).toBeGreaterThan(0);
  });
});
