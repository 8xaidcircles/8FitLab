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
  groupOccupationYears,
  groupUnavailableReason,
  isTenureCalculable,
  roundYears,
  tenurePercentile,
  userYearsByRole,
} from "../calculate";
import { loadCareerStatistics, loadGoals, loadKnownIds, loadSkillContext } from "../data";
import { DEGREES, type CareerStatistics, type DegreeId, type RequirementGroupStatistics, type UserExperience } from "../types";

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

  it("Group の職業の経験は即 100 ではなく在職年数のパーセンタイル以上。年数を増やしても下がらず、cap を受けない", () => {
    const yearsList = [0.5, 1, 2, 3, 5, 10, 20, 50];
    for (const group of groups) {
      for (const code of group.occupations) {
        const values = yearsList.map((years) => groupAchievement(group, [{ role_id: code, years }], cap)!);
        expect(values[0]).toBeLessThan(100);
        values.forEach((value, i) => {
          expect(value).toBeGreaterThanOrEqual(tenurePercentile(group.occupation_tenure, yearsList[i]));
          expect(value).toBeLessThanOrEqual(100);
          if (i > 0) expect(value).toBeGreaterThanOrEqual(values[i - 1]);
        });
        if (cap < 100) expect(values.at(-1)).toBeGreaterThan(cap);
      }
    }
  });

  it.skipIf(!computable)("Group の職業の経験が無ければ、達成率は cap（単一 Group は 100、複合は 50）を超えない", () => {
    for (const group of groups) {
      const roles = [...new Set(group.experience.map((row) => row.role_id))];
      const everything = roles.map((role_id) => ({ role_id, years: 50 }));
      expect(groupAchievement(group, everything, cap)).toBeLessThanOrEqual(cap);
    }
  });

  it.skipIf(!computable)("統計にあるどの Role でも、年数を増やして（1 → 3 → 5 → 8 年…）Experience Match が逆転しない", () => {
    const yearsList = [0.5, 1, 3, 5, 8, 10, 20, 50];
    const roles = new Set(groups.flatMap((group) => group.experience.map((row) => row.role_id)));
    // 他の Role の Unit は一致しないため、その Role の Unit だけに絞っても結果は同じ（全 Unit を毎回走査すると遅い）。
    // 絞って空になる Group は「Unit が無い」扱いにならないよう、一致しない寄与 0 の Unit を残す
    const rowsByRole = groups.map((group) => Map.groupBy(group.experience, (row) => row.role_id));
    const decreases: string[] = [];
    for (const role_id of roles) {
      const narrowed = {
        requirement_groups: groups.map((group, i) => ({
          ...group,
          experience: rowsByRole[i].get(role_id) ?? [{ ...group.experience[0], role_id: "__none__", contribution: 0 }],
        })),
      };
      const values = yearsList.map((years) => experienceMatch(narrowed, [{ role_id, years }]).value!);
      for (let i = 1; i < values.length; i++) {
        if (values[i] < values[i - 1]) decreases.push(`${role_id} ${yearsList[i - 1]}→${yearsList[i]}年`);
      }
    }
    expect(decreases).toEqual([]);
  });

  it.skipIf(!computable)("全 Group の職業を経験していれば coverage = 1 で年数に応じて上がり、経験が無ければ 0", () => {
    const all = (years: number) => groups.map((group) => ({ role_id: group.occupations[0], years }));
    const short = experienceMatch(stats, all(0.5));
    const long = experienceMatch(stats, all(20));
    expect(short.coverage).toBe(1);
    expect(short.value!).toBeLessThan(100);
    expect(long.value!).toBeGreaterThan(short.value!);
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

  it("Education は最低教育要件以上が同じ 100、要件未満は 50 未満で学歴が低いほど下がる", async () => {
    const skill = await loadSkillContext(goalId);
    const minimum = DEGREES.indexOf(stats.minimum_education!);
    expect(minimum).toBeGreaterThanOrEqual(0);
    const scores = DEGREES.map(
      (degree_id) =>
        calculateCareerMatch({ skill_ids: [], certification_ids: [], experiences: [], degree_id }, stats, skill, known)
          .education_match!,
    );
    scores.forEach((score, rank) => {
      if (rank >= minimum) expect(score, DEGREES[rank]).toBe(100);
      else {
        expect(score, DEGREES[rank]).toBeLessThan(50);
        expect(score, DEGREES[rank]).toBeGreaterThanOrEqual(0);
        if (rank > 0) expect(score, DEGREES[rank]).toBeGreaterThanOrEqual(scores[rank - 1]);
      }
    });
  });

  it("学歴・職歴の「回答をスキップする」（統計上の学歴 null・職歴の行なし）と「実務経験なし」は 0", async () => {
    const skill = await loadSkillContext(goalId);
    const result = calculateCareerMatch(
      { skill_ids: [], certification_ids: [], experiences: [], degree_id: null },
      stats,
      skill,
      known,
    );
    expect(result.education_match).toBe(0);
    expect(result.experience_match).toBe(0);
  });
});

describe("Experience は経験年数の単純累積（年数以下の Unit を全て合算）", () => {
  it.each([
    ["5223.4", "sales assistant"],
    ["3343.1", "administrative assistant"],
    ["2411.1", "accountant"],
  ])("IT 以外の前職 %s（%s）でも、1 → 3 → 5 → 8 年で Frontend Developer の Experience が上がる", (role_id) => {
    const stats = statsByGoal.get("frontend-developer")!;
    const values = [1, 3, 5, 8].map((years) => experienceMatch(stats, [{ role_id, years }]).value!);
    expect(values[0]).toBeGreaterThan(0);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });
});

describe("最低教育要件（2.4.0 で確定）", () => {
  const expected: Record<string, DegreeId> = {
    "frontend-developer": "Bachelor",
    "backend-developer": "Bachelor",
    "full-stack-developer": "Bachelor",
    "data-analyst": "Bachelor",
    "data-scientist": "Master",
    "data-engineer": "Bachelor",
    "it-project-manager": "Bachelor",
    "product-manager": "Bachelor",
    "software-architect": "Bachelor",
    "mobile-app-developer": "Bachelor",
    "network-engineer": "Bachelor",
    "test-analyst": "Bachelor",
    "devops-sre": "Bachelor",
    "cloud-architect": "Bachelor",
  };

  it("14 Goal すべてに最低教育要件があり、承認した表と一致する", () => {
    expect(Object.keys(expected).sort()).toEqual(goals.map((g) => g.goal_id).sort());
    for (const [goalId, minimum] of Object.entries(expected)) {
      expect(statsByGoal.get(goalId)!.minimum_education, goalId).toBe(minimum);
    }
  });

  it.each(goals.map((g) => [g.goal_id] as const))("%s: 要件以上の割合は 50% 超、1 つ上の学歴以上は 50% 以下", (goalId) => {
    const stats = statsByGoal.get(goalId)!;
    const atOrAbove = stats.education_at_or_above!;
    const minimum = DEGREES.indexOf(stats.minimum_education!);
    expect(atOrAbove.None).toBeCloseTo(1, 5);
    expect(atOrAbove[DEGREES[minimum]]).toBeGreaterThan(0.5);
    if (minimum + 1 < DEGREES.length) expect(atOrAbove[DEGREES[minimum + 1]]).toBeLessThanOrEqual(0.5);
    // 学歴の行（P(学歴 | Goal)）と同じ分布から作られている
    const share = (degree: DegreeId) => stats.education?.find((r) => r.degree_id === degree)?.p_unit_given_goal ?? 0;
    DEGREES.forEach((degree, i) => {
      expect(atOrAbove[degree], degree).toBeCloseTo(DEGREES.slice(i).reduce((sum, d) => sum + share(d), 0), 4);
    });
  });

  it("frontend-developer：学士・修士・博士は 100、高卒等 22.8、中学校 9.2", () => {
    const stats = statsByGoal.get("frontend-developer")!;
    expect(educationMatch(stats, "Bachelor")).toBe(100);
    expect(educationMatch(stats, "Master")).toBe(100);
    expect(educationMatch(stats, "PhD")).toBe(100);
    expect(educationMatch(stats, "Secondary school")).toBeCloseTo(22.8, 1);
    expect(educationMatch(stats, "None")).toBeCloseTo(9.2, 1);
  });

  it("data-scientist：修士・博士は 100、学士 30.5、高卒等 9.3、中学校 2.0", () => {
    const stats = statsByGoal.get("data-scientist")!;
    expect(educationMatch(stats, "Master")).toBe(100);
    expect(educationMatch(stats, "PhD")).toBe(100);
    expect(educationMatch(stats, "Bachelor")).toBeCloseTo(30.5, 1);
    expect(educationMatch(stats, "Secondary school")).toBeCloseTo(9.3, 1);
    expect(educationMatch(stats, "None")).toBeCloseTo(2.0, 1);
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
    occupation_tenure: { sample_size: 4, distribution: [{ years: 0.5, persons: 1 }, { years: 1, persons: 2 }, { years: 3, persons: 1 }] },
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

  it("前職歴で算出不可の Group でも、Group の職業の経験があれば在職年数のパーセンタイルで算出する", () => {
    const g = group({ experience_reference: 0 });
    const experiences = [{ role_id: "2513.5", years: 1 }];
    // 1 年未満 1 人 + 1 年ちょうど 2 人の半分 = 2 人 / 4 人
    expect(groupAchievement(g, experiences)).toBe(50);
    expect(experienceMatch({ requirement_groups: [g] }, experiences)).toEqual({ value: 50, coverage: 1 });
    expect(experienceMatch({ requirement_groups: [g] }, []).unavailable_reason).toBe("INSUFFICIENT_REFERENCE_DATA");
  });

  it("在職年数の分布が空・欠落・人数 0 なら、Group の職業の経験は前職歴だけで評価し、どちらも無理なら null", () => {
    const experiences = [{ role_id: "2513.5", years: 1 }, { role_id: "2512.4", years: 1 }];
    for (const bad of [
      { sample_size: 0, distribution: [] },
      { sample_size: 0, distribution: [{ years: 1, persons: 1 }] },
      { sample_size: NaN, distribution: [{ years: 1, persons: 1 }] },
      null,
      undefined,
    ]) {
      const tenure = bad as unknown as RequirementGroupStatistics["occupation_tenure"];
      expect(isTenureCalculable(tenure)).toBe(false);
      expect(groupAchievement(group({ occupation_tenure: tenure }), experiences)).toBe(100);
      expect(groupAchievement(group({ occupation_tenure: tenure, experience_reference: 0 }), experiences)).toBeNull();
    }
  });

  it("Group の職業の経験は、在職年数のパーセンタイルと前職歴（100 まで）の高いほう", () => {
    // 前職歴 0.133333 / 0.2 = 66.67 > 在職 0.5 年のパーセンタイル 12.5
    expect(groupAchievement(group({ experience_reference: 0.2 }), [{ role_id: "2513.5", years: 0.5 }, { role_id: "2512.4", years: 1 }])).toBeCloseTo(66.6667, 3);
    // 在職 3 年のパーセンタイル 87.5 > 前職歴 66.67
    expect(groupAchievement(group({ experience_reference: 0.2 }), [{ role_id: "2513.5", years: 3 }, { role_id: "2512.4", years: 1 }])).toBe(87.5);
    // Group の職業の経験がある Group は cap を受けない
    expect(groupAchievement(group(), [{ role_id: "2513.5", years: 3 }], 50)).toBe(87.5);
    expect(groupAchievement(group(), [{ role_id: "2512.4", years: 1 }], 50)).toBe(50);
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

  it("最低教育要件・「その学歴以上」の割合が無ければ Education は null", () => {
    const atOrAbove = statsByGoal.get("frontend-developer")!.education_at_or_above;
    expect(educationMatch({}, "Bachelor")).toBeNull();
    expect(educationMatch({ minimum_education: "Bachelor" }, "Bachelor")).toBeNull();
    expect(educationMatch({ education_at_or_above: atOrAbove }, "Bachelor")).toBeNull();
    expect(educationMatch({ minimum_education: "Bachelor", education_at_or_above: atOrAbove }, null)).toBe(0);
  });
});

describe("在職年数のパーセンタイル", () => {
  const tenure = { sample_size: 4, distribution: [{ years: 0.5, persons: 1 }, { years: 1, persons: 2 }, { years: 3, persons: 1 }] };

  it("（下回る人数 + 同じ人数 × 0.5）/ 全人数 × 100", () => {
    expect(tenurePercentile(tenure, 0.5)).toBe(12.5);
    expect(tenurePercentile(tenure, 1)).toBe(50);
    expect(tenurePercentile(tenure, 2)).toBe(75);
    expect(tenurePercentile(tenure, 3)).toBe(87.5);
    expect(tenurePercentile(tenure, 50)).toBe(100);
  });

  it("Group 内の職業（OR）の年数は合算してから丸め、Group 外の職業・0 以下は数えない", () => {
    const group = { group_id: "g", occupations: ["2512.5", "2513.5"] };
    expect(
      groupOccupationYears(group, [
        { role_id: "2512.5", years: 0.3 },
        { role_id: "2513.5", years: 0.3 },
        { role_id: "2512.4", years: 5 },
        { role_id: "2513.5", years: -1 },
      ]),
    ).toBe(0.5);
    expect(groupOccupationYears(group, [{ role_id: "2512.4", years: 5 }])).toBe(0);
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
