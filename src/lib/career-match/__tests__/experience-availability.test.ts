import { describe, expect, it } from "vitest";
import { calculateCareerMatch, experienceMatch } from "../calculate";
import { loadCareerStatistics, loadGoals, loadKnownIds, loadSkillContext } from "../data";
import { skillMatchScope } from "../skill-layers";
import type { CareerStatistics, UserExperience } from "../types";

const goals = await loadGoals();
const known = await loadKnownIds();
const cases = await Promise.all(
  goals.map(async (goal) => {
    const [stats, skill] = await Promise.all([loadCareerStatistics(goal.goal_id), loadSkillContext(goal.goal_id)]);
    return [goal.goal_id, stats, skill] as const;
  }),
);

// 各 Group の最初の職業を years 年。groupIndex を指定するとその Group だけ
function groupExperiences(stats: CareerStatistics, years: number, groupIndex?: number): UserExperience[] {
  return stats.requirement_groups
    .filter((_, i) => groupIndex === undefined || i === groupIndex)
    .map((g) => ({ role_id: g.occupations[0], years }));
}

// 前職歴の評価（preGoal）が算出できない Group は、その職業の経験の有無で算出可否が変わる（§19）。
// 実データにそういう Group があると、経験を足すと Experience が null → 数値になり、Goal Fit の分母が増えて下がりうる
describe("Experience の算出可否は入力に依存しない（実データ）", () => {
  it.each(cases)("%s：職歴なし・各 Group の職業 1 年・全 Group の職業 1 年で null / 数値が一致する", (_goalId, stats) => {
    const inputs = [
      [],
      ...stats.requirement_groups.map((_, i) => groupExperiences(stats, 1, i)),
      groupExperiences(stats, 1),
    ];
    const available = inputs.map((experiences) => experienceMatch(stats, experiences).value !== null);
    expect(available).toEqual(available.map(() => available[0]));
  });
});

describe("経験を足しても Goal Fit は下がらない（実データ）", () => {
  it.each(cases)("%s：スコープ内スキルの半分・学士で、職歴なしと各 Group の職業 1・3・5 年を比べる", (_goalId, stats, skill) => {
    const scope = [
      ...skillMatchScope({ techStats: skill.techStats, goalLayers: skill.goalLayers, defaultWeights: skill.defaultWeights })
        .skillIds,
    ].sort();
    const skill_ids = scope.slice(0, Math.ceil(scope.length / 2));
    const goalMatch = (experiences: UserExperience[]) =>
      calculateCareerMatch({ skill_ids, certification_ids: [], experiences, degree_id: "Bachelor" }, stats, skill, known)
        .goal_match;

    const without = goalMatch([]);
    for (const years of [1, 3, 5]) {
      const inputs = [...stats.requirement_groups.map((_, i) => groupExperiences(stats, years, i)), groupExperiences(stats, years)];
      for (const experiences of inputs) {
        expect(goalMatch(experiences), JSON.stringify(experiences)).toBeGreaterThanOrEqual(without - 1e-9);
      }
    }
  });
});
