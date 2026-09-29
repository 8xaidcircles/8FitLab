import { describe, expect, it } from "vitest";
import {
  LINEAR_SKILL_SCORING,
  SKILL_DISTRIBUTION_MIN_SAMPLE,
  goalSkillUnits,
  scoreSkill,
  selectSkillScoringModel,
  skillUnitGaps,
  standardNormalCdf,
  weightedSkillProgress,
} from "../skill-score";
import type { SkillProgressDistribution, SkillStatistics } from "../types";
import { unit } from "./skill-fixtures";

const skillStats: Pick<SkillStatistics, "goal_id" | "units"> = {
  goal_id: "test-goal",
  units: [
    unit("server-framework", ["laravel", "ruby-on-rails", "spring-boot"], 0.4),
    unit("sql", ["sql"], 0.3),
    unit("docker", ["docker"], 0.2),
    unit("typescript", ["typescript"], 0.1),
    unit("perl", ["perl"], 0.9, false),
  ],
};

function distribution(overrides: Partial<SkillProgressDistribution> = {}): SkillProgressDistribution {
  return { goal_id: "test-goal", sample_size: SKILL_DISTRIBUTION_MIN_SAMPLE, mean: 40, sd: 20, ...overrides };
}

describe("weightedSkillProgress（技術スキル層）", () => {
  it("Σ Contribution(満たした unit) / Σ Contribution(Goal Skill) × 100", () => {
    expect(weightedSkillProgress(skillStats, [])).toBe(0);
    expect(weightedSkillProgress(skillStats, ["sql"])).toBeCloseTo(30, 10);
    expect(weightedSkillProgress(skillStats, ["sql", "docker"])).toBeCloseTo(50, 10);
    expect(weightedSkillProgress(skillStats, ["laravel", "sql", "docker", "typescript"])).toBeCloseTo(100, 10);
  });

  it("グループはどのメンバーでも同じだけ満たし、複数持っても重複して数えない", () => {
    const laravel = weightedSkillProgress(skillStats, ["laravel"]);
    expect(laravel).toBeCloseTo(40, 10);
    expect(weightedSkillProgress(skillStats, ["ruby-on-rails"])).toBe(laravel);
    expect(weightedSkillProgress(skillStats, ["laravel", "ruby-on-rails", "spring-boot"])).toBe(laravel);
  });

  it("採用されていない unit と未知の skill_id は Skill Progress に影響しない", () => {
    expect(weightedSkillProgress(skillStats, ["perl"])).toBe(0);
    expect(weightedSkillProgress(skillStats, ["sql", "unknown-skill"])).toBeCloseTo(30, 10);
  });

  it("採用された unit が無い統計はエラー", () => {
    expect(() => weightedSkillProgress({ ...skillStats, units: [unit("perl", ["perl"], 0.9, false)] }, [])).toThrow();
  });
});

describe("skillUnitGaps", () => {
  it("採用された unit を Contribution の大きい順に、充足状況と割合つきで返す", () => {
    const gaps = skillUnitGaps(skillStats, ["docker"]);
    expect(gaps.map((g) => g.unit.unit_id)).toEqual(["server-framework", "sql", "docker", "typescript"]);
    expect(gaps.map((g) => g.satisfied)).toEqual([false, false, true, false]);
    expect(gaps.reduce((sum, g) => sum + g.share, 0)).toBeCloseTo(100, 10);
    expect(goalSkillUnits(skillStats)).toHaveLength(4);
  });
});

describe("standardNormalCdf", () => {
  it.each([
    [0, 0.5],
    [1, 0.841345],
    [-1, 0.158655],
    [1.959964, 0.975],
    [-3, 0.00135],
  ])("Φ(%s) ≈ %s", (z, expected) => {
    expect(standardNormalCdf(z)).toBeCloseTo(expected, 5);
  });

  it("単調増加で 0〜1 に収まる", () => {
    const values = [-8, -3, -1, 0, 1, 3, 8].map(standardNormalCdf);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values[0]).toBeGreaterThanOrEqual(0);
    expect(values.at(-1)).toBeLessThanOrEqual(1);
  });
});

describe("selectSkillScoringModel", () => {
  it("蓄積データが無い（コールドスタート）なら linear", () => {
    expect(selectSkillScoringModel(null)).toEqual(LINEAR_SKILL_SCORING);
    expect(selectSkillScoringModel(undefined)).toEqual(LINEAR_SKILL_SCORING);
  });

  it("ユーザー数が基準未満なら linear", () => {
    expect(selectSkillScoringModel(distribution({ sample_size: SKILL_DISTRIBUTION_MIN_SAMPLE - 1 }))).toEqual(LINEAR_SKILL_SCORING);
  });

  it("分散が 0・不正値なら linear（CDF 変換できない）", () => {
    expect(selectSkillScoringModel(distribution({ sd: 0 }))).toEqual(LINEAR_SKILL_SCORING);
    expect(selectSkillScoringModel(distribution({ sd: NaN }))).toEqual(LINEAR_SKILL_SCORING);
    expect(selectSkillScoringModel(distribution({ mean: NaN }))).toEqual(LINEAR_SKILL_SCORING);
  });

  it("ユーザー数が基準以上なら normal_cdf に切り替わる", () => {
    expect(selectSkillScoringModel(distribution())).toEqual({
      method: "normal_cdf",
      mean: 40,
      sd: 20,
      sample_size: SKILL_DISTRIBUTION_MIN_SAMPLE,
    });
  });
});

describe("scoreSkill", () => {
  it("linear：達成率をそのまま Skill Match とする", () => {
    for (const progress of [0, 25, 50, 100]) expect(scoreSkill(progress, LINEAR_SKILL_SCORING)).toBe(progress);
  });

  describe("normal_cdf：全ユーザーの達成率分布上のパーセンタイル", () => {
    const model = selectSkillScoringModel(distribution());

    it("平均と同じ達成率は 50、+1σ は約 84", () => {
      expect(scoreSkill(40, model)).toBeCloseTo(50, 4);
      expect(scoreSkill(60, model)).toBeCloseTo(84.13, 1);
      expect(scoreSkill(20, model)).toBeCloseTo(15.87, 1);
    });

    it("達成率が高いほど Skill Match は下がらず、0〜100 に収まる", () => {
      const values = [0, 10, 25, 40, 50, 75, 100].map((p) => scoreSkill(p, model));
      for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });
});
