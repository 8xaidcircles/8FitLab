import { describe, expect, it } from "vitest";
import {
  LINEAR_SKILL_SCORING,
  SKILL_DISTRIBUTION_MIN_SAMPLE,
  ecdfPercentile,
  goalSkillUnits,
  scoreSkill,
  selectSkillScoringModel,
  skillUnitGaps,
  weightedSkillProgress,
} from "../skill-score";
import type { SkillProgressDistribution, SkillScoringVersions, SkillStatistics } from "../types";
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

// 0〜99 を等間隔に並べた n 件（n = 100 なら 0, 1, ..., 99）
function spread(n: number): number[] {
  return Array.from({ length: n }, (_, i) => (i * 99) / Math.max(1, n - 1));
}

// 現在の計算のバージョン。分布はこれと同じバージョンの結果から集計したものだけ使う
const current: SkillScoringVersions = {
  skill_calculation_version: "layered-1.0.0",
  skill_statistics_version: "stack_overflow_developer_survey:2023-2024-2025:0.3.1:k=80.9",
};

function distribution(overrides: Partial<SkillProgressDistribution> = {}): SkillProgressDistribution {
  return { goal_id: "test-goal", scores: spread(SKILL_DISTRIBUTION_MIN_SAMPLE), ...current, ...overrides };
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

describe("ecdfPercentile（同率は中央順位）", () => {
  const sorted = [0, 10, 20, 20, 30];

  it("（x 未満の数 + 0.5 × 同じ値の数）/ N × 100", () => {
    expect(ecdfPercentile(sorted, 10)).toBeCloseTo(30, 10); // (1 + 0.5) / 5
    expect(ecdfPercentile(sorted, 20)).toBeCloseTo(60, 10); // (2 + 0.5 × 2) / 5
    expect(ecdfPercentile(sorted, 15)).toBeCloseTo(40, 10); // 分布に無い値：(2 + 0) / 5
  });

  it("全員より低ければ 0、全員より高ければ 100", () => {
    expect(ecdfPercentile(sorted, -1)).toBe(0);
    expect(ecdfPercentile(sorted, 31)).toBe(100);
  });

  it("全員が同点なら、同じ値は 50", () => {
    expect(ecdfPercentile([40, 40, 40], 40)).toBe(50);
    expect(ecdfPercentile([40, 40, 40], 39)).toBe(0);
    expect(ecdfPercentile([40, 40, 40], 41)).toBe(100);
  });

  it("1 件だけでも計算でき、0 件はエラー", () => {
    expect(ecdfPercentile([50], 50)).toBe(50);
    expect(() => ecdfPercentile([], 50)).toThrow();
  });

  it("0 点・100 点に偏った分布でも、順位どおりのパーセンタイルになる", () => {
    const skewed = [...Array(80).fill(0), ...Array(20).fill(100)];
    expect(ecdfPercentile(skewed, 0)).toBeCloseTo(40, 10); // 80 人の同率の中央
    expect(ecdfPercentile(skewed, 50)).toBeCloseTo(80, 10);
    expect(ecdfPercentile(skewed, 100)).toBeCloseTo(90, 10);
  });
});

describe("selectSkillScoringModel", () => {
  it("蓄積データが無い（コールドスタート）なら linear", () => {
    expect(selectSkillScoringModel(null, current)).toEqual(LINEAR_SKILL_SCORING);
    expect(selectSkillScoringModel(undefined, current)).toEqual(LINEAR_SKILL_SCORING);
  });

  it("ユーザー数が基準未満なら linear", () => {
    expect(selectSkillScoringModel(distribution({ scores: spread(SKILL_DISTRIBUTION_MIN_SAMPLE - 1) }), current)).toEqual(
      LINEAR_SKILL_SCORING,
    );
  });

  it("全員が同点なら linear（順位の情報が無い）", () => {
    expect(selectSkillScoringModel(distribution({ scores: Array(SKILL_DISTRIBUTION_MIN_SAMPLE).fill(40) }), current)).toEqual(
      LINEAR_SKILL_SCORING,
    );
  });

  it("0〜100 の範囲外・不正値を含むなら linear", () => {
    for (const bad of [NaN, -1, 101, Infinity]) {
      expect(
        selectSkillScoringModel(distribution({ scores: [...spread(SKILL_DISTRIBUTION_MIN_SAMPLE), bad] }), current),
      ).toEqual(LINEAR_SKILL_SCORING);
    }
  });

  it("分布のバージョンが現在の計算と一致しなければ linear", () => {
    for (const mismatch of [
      { skill_calculation_version: "layered-0.9.0" },
      { skill_statistics_version: "stack_overflow_developer_survey:2023-2024-2025:0.2.0:k=50" },
      { skill_statistics_version: null },
    ]) {
      expect(selectSkillScoringModel(distribution(mismatch), current), JSON.stringify(mismatch)).toEqual(
        LINEAR_SKILL_SCORING,
      );
    }
  });

  it("技術スキル層を計算しない Goal（統計のバージョンが null）同士は一致として扱う", () => {
    const humanOnly = { ...current, skill_statistics_version: null };
    expect(selectSkillScoringModel(distribution(humanOnly), humanOnly).method).toBe("ecdf");
  });

  it("バージョンが一致し、ユーザー数が基準以上なら ecdf に切り替わり、達成率を昇順に並べて持つ", () => {
    const scores = spread(SKILL_DISTRIBUTION_MIN_SAMPLE).reverse();
    const model = selectSkillScoringModel(distribution({ scores }), current);
    expect(model.method).toBe("ecdf");
    if (model.method !== "ecdf") return;
    expect(model.sample_size).toBe(SKILL_DISTRIBUTION_MIN_SAMPLE);
    expect(model.sorted_scores).toEqual([...scores].sort((a, b) => a - b));
    expect(scores[0]).toBeGreaterThan(scores[1]); // 入力の配列は並べ替えない
  });
});

describe("scoreSkill", () => {
  it("linear：達成率をそのまま Skill Match とする", () => {
    for (const progress of [0, 25, 50, 100]) expect(scoreSkill(progress, LINEAR_SKILL_SCORING)).toBe(progress);
  });

  describe("ecdf：全ユーザーの達成率の経験分布上のパーセンタイル", () => {
    const model = selectSkillScoringModel(distribution(), current);

    it("中央の達成率は 50 付近", () => {
      expect(scoreSkill(49.5, model)).toBeCloseTo(50, 10);
    });

    it("達成率が高いほど Skill Match は下がらず、0〜100 に収まる", () => {
      const values = [0, 10, 25, 40, 50, 75, 100].map((p) => scoreSkill(p, model));
      for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      for (const value of values) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(100);
      }
    });
  });
});
