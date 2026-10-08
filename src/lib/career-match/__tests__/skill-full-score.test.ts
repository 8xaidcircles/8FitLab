import { describe, expect, it } from "vitest";
import { calculateCareerMatch } from "../calculate";
import { loadCareerStatistics, loadGoals, loadKnownIds, loadSkillContext } from "../data";
import { skillMatchScope } from "../skill-layers";

const goals = await loadGoals();
const known = await loadKnownIds();

// Skill Match は linear 固定（§11）。Skill Match に効くスキルをすべて持てば、どの Goal でも満点になる
describe("全スキル習得で Skill Match が 100 になる（実データ）", () => {
  it.each(goals.map((g) => [g.goal_id] as const))("%s", async (goalId) => {
    const [stats, skill] = await Promise.all([loadCareerStatistics(goalId), loadSkillContext(goalId)]);
    const { skillIds } = skillMatchScope({
      techStats: skill.techStats,
      goalLayers: skill.goalLayers,
      defaultWeights: skill.defaultWeights,
    });
    expect(skillIds.size).toBeGreaterThan(0);

    const result = calculateCareerMatch(
      { skill_ids: [...skillIds], certification_ids: [], experiences: [], degree_id: null },
      stats,
      skill,
      known,
    );
    expect(result.ignored.skill_ids).toEqual([]);
    expect(result.skill_progress).toBeCloseTo(100, 6);
    expect(result.skill_match).toBeCloseTo(100, 6);
    expect(result.skill_progress).toBeLessThanOrEqual(100);
    expect(result.skill_scoring_method).toBe("linear");
  });
});
