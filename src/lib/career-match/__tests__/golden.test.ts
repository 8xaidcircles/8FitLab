import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPOSITE_UNMET_GROUP_CAP,
  calculateCareerMatch,
  educationMatch,
  experienceMatch,
  experienceUnitKey,
  groupAchievement,
  groupUnavailableReason,
  roundYears,
  userYearsByRole,
} from "../calculate";
import { loadCareerStatistics, loadGoals, loadKnownIds, loadSkillContext } from "../data";
import type { CareerStatistics, RequirementGroupStatistics, UserExperience } from "../types";

const FIXTURE_DIR = path.join(process.cwd(), "data", "fixtures", "career-match");

async function fixture<T>(name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(FIXTURE_DIR, name), "utf-8")) as T;
}

interface CrossLanguageFixture {
  round_years: { input: number; expected: number }[];
  experience_unit_keys: { role_id: string; years: number; expected: string }[];
}

interface SpecExamplesFixture {
  statistics: Pick<CareerStatistics, "source" | "source_version" | "calculation_version" | "taxonomy_version">;
  cases: {
    goal_id: string;
    label: string;
    experiences: UserExperience[];
    group_achievements_uncapped: number[];
    experience_match: number;
  }[];
}

const crossLanguage = await fixture<CrossLanguageFixture>("cross-language.json");
const specExamples = await fixture<SpecExamplesFixture>("spec-examples.json");
const goals = await loadGoals();
const statsByGoal = new Map(
  await Promise.all(goals.map(async (g) => [g.goal_id, await loadCareerStatistics(g.goal_id)] as const)),
);
const known = await loadKnownIds();

// scripts/build_career_statistics.py も生成開始時に同じ fixture で検証する
describe("言語間の一致（TS ↔ Python）", () => {
  it.each(crossLanguage.round_years.map((c) => [c.input, c.expected]))("roundYears(%s) = %s", (input, expected) => {
    expect(roundYears(input)).toBe(expected);
  });

  it.each(crossLanguage.experience_unit_keys.map((c) => [c.role_id, c.years, c.expected]))(
    "experienceUnitKey(%s, %s) = %s",
    (roleId, years, expected) => {
      expect(experienceUnitKey(roleId, years)).toBe(expected);
    },
  );

  it("実データの Unit ID は experienceUnitKey の書式", () => {
    for (const stats of statsByGoal.values()) {
      for (const group of stats.requirement_groups) {
        for (const row of group.experience) expect(row.unit_id).toBe(experienceUnitKey(row.role_id, row.years));
      }
    }
  });
});

describe("仕様書の計算例（§19）", () => {
  it.each(specExamples.cases.map((c) => [c.goal_id, c.label, c] as const))("%s: %s", (goalId, _label, c) => {
    const stats = statsByGoal.get(goalId)!;
    const version = {
      source: stats.source,
      source_version: stats.source_version,
      calculation_version: stats.calculation_version,
      taxonomy_version: stats.taxonomy_version,
    };
    expect(
      version,
      "Career Statistics が再生成されて版が変わった。期待値を確認して data/fixtures/career-match/spec-examples.json（statistics と cases）と要件定義書 §19 を更新する",
    ).toEqual(specExamples.statistics);

    const uncapped = stats.requirement_groups.map((group) => groupAchievement(group, c.experiences));
    expect(uncapped).toHaveLength(c.group_achievements_uncapped.length);
    uncapped.forEach((value, i) => expect(value).toBeCloseTo(c.group_achievements_uncapped[i], 1));
    expect(experienceMatch(stats, c.experiences).value).toBeCloseTo(c.experience_match, 1);
  });
});

// 統計の値に依存しない性質。再生成しても成り立つ
describe.each(goals.map((g) => [g.goal_id] as const))("計算の性質: %s", (goalId) => {
  const stats = statsByGoal.get(goalId)!;
  const groups = stats.requirement_groups;
  const cap = groups.length > 1 ? COMPOSITE_UNMET_GROUP_CAP : 100;
  // Goal Population = 0 などで Experience を算出できない Goal は、性質のテストの対象外（算出不可は別に固定する）
  const computable = experienceMatch(stats, []).value !== null;

  it("Group の職業の経験があれば、その Group の達成率は 100", () => {
    for (const group of groups) {
      for (const code of group.occupations) expect(groupAchievement(group, [{ role_id: code, years: 0.5 }], cap)).toBe(100);
    }
  });

  it.skipIf(!computable)("Group の職業の経験が無ければ、達成率は cap（単一 Group は 100、複合は 50）を超えない", () => {
    for (const group of groups) {
      const roles = [...new Set(group.experience.map((row) => row.role_id))];
      const everything = roles.map((role_id) => ({ role_id, years: 50 }));
      expect(groupAchievement(group, everything, cap)).toBeLessThanOrEqual(cap);
    }
  });

  it.skipIf(!computable)("同じ Role の年数を増やしても、Group 達成率は下がらない", () => {
    for (const group of groups) {
      const topRoles = [...new Set(group.experience.map((row) => row.role_id))].slice(0, 5);
      for (const role_id of topRoles) {
        const values = [0.5, 1, 2, 3, 5, 10, 20, 50].map((years) => groupAchievement(group, [{ role_id, years }], cap)!);
        for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
      }
    }
  });

  it.skipIf(!computable)("全 Group の職業を経験していれば Experience は 100、経験が無ければ 0", () => {
    const all = groups.map((group) => ({ role_id: group.occupations[0], years: 1 }));
    expect(experienceMatch(stats, all)).toEqual({ value: 100, coverage: 1 });
    expect(experienceMatch(stats, [])).toEqual({ value: 0, coverage: 0 });
  });

  // 0.3 + 0.3 は合算後に丸めると 0.5 年、先に丸めると 0.5 + 0.5 = 1.0 年。
  // Cap で差が消えないよう cap = Infinity で、1 年以上の Unit を持つ Role について比べる
  const oneYearRow = groups.flatMap((g) => g.experience.map((row) => ({ group: g, row }))).find(
    ({ row }) => row.years === 1 && row.contribution > 0,
  );
  it.skipIf(!oneYearRow)("同じ Role の複数入力は合算してから丸める", () => {
    const { group, row } = oneYearRow!;
    const role_id = row.role_id;
    const summed = groupAchievement(group, [{ role_id, years: 0.3 }, { role_id, years: 0.3 }], Infinity);
    expect(summed).toBe(groupAchievement(group, [{ role_id, years: 0.5 }], Infinity));
    expect(summed).toBeLessThan(groupAchievement(group, [{ role_id, years: 1 }], Infinity)!);
  });

  const firstUnitRole = groups.find((g) => g.experience.length > 0)?.experience[0].role_id;
  it.skipIf(!firstUnitRole)("未知の Role は無視される", async () => {
    const skill = await loadSkillContext(goalId);
    const base = { skill_ids: [], certification_ids: [], degree_id: null };
    const role_id = firstUnitRole!;
    const withUnknown = calculateCareerMatch(
      { ...base, experiences: [{ role_id, years: 2 }, { role_id: "9999.9", years: 5 }] },
      stats,
      skill,
      known,
    );
    const without = calculateCareerMatch({ ...base, experiences: [{ role_id, years: 2 }] }, stats, skill, known);
    expect(withUnknown.ignored.role_ids).toEqual(["9999.9"]);
    expect(withUnknown.experience_match).toBe(without.experience_match);
  });

  it("Education は Contribution 最大の学歴が 100、ほかは 100 以下", async () => {
    const skill = await loadSkillContext(goalId);
    const rows = stats.education ?? [];
    const max = Math.max(...rows.map((row) => row.contribution));
    for (const row of rows) {
      const result = calculateCareerMatch(
        { skill_ids: [], certification_ids: [], experiences: [], degree_id: row.degree_id },
        stats,
        skill,
        known,
      );
      if (row.contribution === max) expect(result.education_match).toBeCloseTo(100);
      else expect(result.education_match!).toBeLessThanOrEqual(100);
    }
  });
});

// 実データでは踏めない分岐。統計生成が NaN を 0 に置き換えた値（§56 Statistics Build）を、計算側で null として扱う
describe("算出不可（null）", () => {
  const group = (overrides: Partial<RequirementGroupStatistics> = {}): RequirementGroupStatistics => ({
    group_id: "g",
    occupations: ["2513.5"],
    goal_sample_size: 1,
    pre_goal_experience_persons: 1,
    experience_reference: 0.1,
    experience: [
      { unit_id: "2512.4__1.0", role_id: "2512.4", years: 1, p_unit_given_goal: 0.2, p_unit_given_other: 0.1, quantity: 0.2, quality: 66.6667, contribution: 0.133333 },
    ],
    ...overrides,
  });

  it("Group が 0 個・Unit が空・Experience Reference = 0 なら Experience は null", () => {
    expect(experienceMatch({ requirement_groups: [] }, []).value).toBeNull();
    expect(experienceMatch({ requirement_groups: [group({ experience: [] })] }, []).value).toBeNull();
    expect(experienceMatch({ requirement_groups: [group({ experience_reference: 0 })] }, []).value).toBeNull();
    // 複合 Goal では、どれか 1 つの Group が算出不可なら Experience 全体を算出不可にする
    expect(experienceMatch({ requirement_groups: [group(), group({ group_id: "h", experience_reference: 0 })] }, []).value).toBeNull();
    expect(experienceMatch({ requirement_groups: [group()] }, []).value).toBe(0);
  });

  it("算出不可の理由を返す", () => {
    const reason = (groups: RequirementGroupStatistics[]) => experienceMatch({ requirement_groups: groups }, []).unavailable_reason;
    expect(reason([])).toBe("NO_REQUIREMENT_GROUPS");
    expect(reason([group({ experience: [] })])).toBe("NO_EXPERIENCE_UNITS");
    expect(reason([group({ experience_reference: 0 })])).toBe("INSUFFICIENT_REFERENCE_DATA");
    expect(reason([group()])).toBeUndefined();
  });

  it("Experience Reference が負・非有限・欠落（null / undefined）でも割り算に進まない", () => {
    const experiences = [{ role_id: "2512.4", years: 1 }];
    for (const bad of [-0.1, NaN, Infinity, null, undefined]) {
      const g = group({ experience_reference: bad as unknown as number });
      expect(groupUnavailableReason(g)).toBe("INSUFFICIENT_REFERENCE_DATA");
      expect(groupAchievement(g, experiences)).toBeNull();
      expect(experienceMatch({ requirement_groups: [g] }, experiences)).toEqual({
        value: null,
        coverage: 0,
        unavailable_reason: "INSUFFICIENT_REFERENCE_DATA",
      });
    }
  });

  it("算出不可の Group でも、Group の職業の経験があれば Group 達成率は 100（Experience 全体は算出不可のまま）", () => {
    const g = group({ experience_reference: 0 });
    const experiences = [{ role_id: "2513.5", years: 1 }];
    expect(groupAchievement(g, experiences)).toBe(100);
    expect(experienceMatch({ requirement_groups: [g] }, experiences).value).toBeNull();
  });

  it("Experience が算出不可なら、Goal Match の分母から外す", async () => {
    const stats = statsByGoal.get("frontend-developer")!;
    const broken: CareerStatistics = {
      ...stats,
      requirement_groups: stats.requirement_groups.map((g) => ({ ...g, experience_reference: 0 })),
    };
    const skill = await loadSkillContext("frontend-developer");
    const result = calculateCareerMatch(
      { skill_ids: [], certification_ids: [], experiences: [{ role_id: "2512.4", years: 3 }], degree_id: "Bachelor" },
      broken,
      skill,
      known,
    );
    expect(result.experience_match).toBeNull();
    expect(result.education_match).not.toBeNull();
    expect(result.goal_match).toBeCloseTo((result.skill_match + result.education_match!) / 2, 10);
  });

  it("学歴の行が無い・Contribution がすべて 0 なら Education は null", () => {
    expect(educationMatch(undefined, "Bachelor")).toBeNull();
    expect(educationMatch([], "Bachelor")).toBeNull();
    expect(educationMatch([{ degree_id: "Bachelor", contribution: 0 }], "Bachelor")).toBeNull();
    expect(educationMatch([{ degree_id: "Bachelor", contribution: 0.3 }], null)).toBe(0);
  });
});

describe("userYearsByRole", () => {
  it("同じ Role の年数を合算してから 0.5 年単位に丸め、0 以下は無視する", () => {
    const years = userYearsByRole([
      { role_id: "2513.5", years: 0.3 },
      { role_id: "2513.5", years: 0.3 },
      { role_id: "2512.4", years: 1.2 },
      { role_id: "2512.4", years: 1.3 },
      { role_id: "3512.1", years: 0 },
    ]);
    expect(Object.fromEntries(years)).toEqual({ "2513.5": 0.5, "2512.4": 2.5 });
  });
});
