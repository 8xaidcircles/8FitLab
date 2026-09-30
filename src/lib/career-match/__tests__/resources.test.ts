import { describe, expect, it } from "vitest";
import { loadGoals, loadKnownIds, loadLearningPath, loadResources } from "../data";
import {
  MAX_RESOURCES_PER_STEP,
  compareByEditorial,
  isAffiliateLink,
  resolveCareerNextResources,
  resolveStepResources,
  selectResources,
} from "../resources";
import type { CareerService, LearningResource, LearningStep, Resource } from "../types";

const base = {
  provider: "provider",
  selection_reason: "reason",
  is_active: true,
  verified_at: "2026-09-30",
  affiliate: null,
};

function learning(resource_id: string, editorial_rank: number, covers: string[], overrides: Partial<LearningResource> = {}): LearningResource {
  return {
    ...base,
    resource_id,
    name: resource_id,
    official_url: `https://example.com/${resource_id}`,
    editorial_rank,
    type: "book",
    covers,
    level: "beginner",
    cost: "paid",
    ...overrides,
  };
}

function service(resource_id: string, editorial_rank: number, overrides: Partial<CareerService> = {}): CareerService {
  return {
    ...base,
    resource_id,
    name: resource_id,
    official_url: `https://example.com/${resource_id}`,
    editorial_rank,
    type: "job_service",
    goal_ids: ["frontend-developer"],
    audience: "career_change",
    requires_goal_experience: false,
    ...overrides,
  };
}

function step(step_id: string, any_of: string[]): LearningStep {
  return { learning_order: 1, step_id, name: step_id, any_of };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

const ids = (resources: readonly Resource[]) => resources.map((r) => r.resource_id);

const [resources, goals, known] = await Promise.all([loadResources(), loadGoals(), loadKnownIds()]);
const paths = new Map(await Promise.all(goals.map(async (g) => [g.goal_id, await loadLearningPath(g.goal_id)] as const)));

describe("Resources Master Data", () => {
  const learningResources = resources.filter((r): r is LearningResource => r.type !== "job_service");
  const careerServices = resources.filter((r): r is CareerService => r.type === "job_service");
  const goalIds = new Set(goals.map((g) => g.goal_id));

  it("resource_id は一意", () => {
    expect(new Set(ids(resources)).size).toBe(resources.length);
  });

  it("covers はすべて既知の skill_id", () => {
    for (const r of learningResources) {
      expect(r.covers.length, r.resource_id).toBeGreaterThan(0);
      for (const skillId of r.covers) expect(known.skillIds.has(skillId), `${r.resource_id}: ${skillId}`).toBe(true);
    }
  });

  it("job_service の goal_ids はすべて goals.json に存在する", () => {
    for (const r of careerServices) {
      expect(r.goal_ids.length, r.resource_id).toBeGreaterThan(0);
      for (const goalId of r.goal_ids) expect(goalIds.has(goalId), `${r.resource_id}: ${goalId}`).toBe(true);
    }
  });

  it("free_doc は cost = free", () => {
    for (const r of learningResources.filter((r) => r.type === "free_doc")) expect(r.cost, r.resource_id).toBe("free");
  });

  it("official_url は https の URL", () => {
    for (const r of resources) expect(new URL(r.official_url).protocol, r.resource_id).toBe("https:");
  });

  it("affiliate が active なら url は空でない https", () => {
    for (const r of resources.filter((r) => r.affiliate?.status === "active")) {
      expect(new URL(r.affiliate!.url).protocol, r.resource_id).toBe("https:");
      expect(isAffiliateLink(r), r.resource_id).toBe(true);
    }
  });

  it("全 Goal に learning_resources_ready（boolean）がある", () => {
    for (const goal of goals) expect(typeof goal.learning_resources_ready, goal.goal_id).toBe("boolean");
  });

  const readyGoals = goals.filter((g) => g.learning_resources_ready);

  it.skipIf(readyGoals.length === 0)("learning_resources_ready の Goal は、全 Step に教材が 1 件以上ある", () => {
    for (const goal of readyGoals) {
      for (const { step_id, resources: found } of resolveStepResources(paths.get(goal.goal_id)!.steps, resources)) {
        expect(found.length, `${goal.goal_id} / ${step_id}`).toBeGreaterThan(0);
      }
    }
  });

  it.skipIf(readyGoals.length === 0)("learning_resources_ready の Goal は、全 Step の any_of が 4 以下", () => {
    for (const goal of readyGoals) {
      for (const s of paths.get(goal.goal_id)!.steps) {
        expect(s.any_of.length, `${goal.goal_id} / ${s.step_id}`).toBeLessThanOrEqual(MAX_RESOURCES_PER_STEP);
      }
    }
  });
});

describe("isAffiliateLink", () => {
  const affiliate = { status: "active" as const, program: "program", url: "https://aff.example.com/x" };

  it("active かつ https の url があるときだけ true", () => {
    expect(isAffiliateLink(learning("a", 1, ["python"], { affiliate }))).toBe(true);
    expect(isAffiliateLink(learning("a", 1, ["python"]))).toBe(false);
    expect(isAffiliateLink(learning("a", 1, ["python"], { affiliate: { ...affiliate, status: "inactive" } }))).toBe(false);
    expect(isAffiliateLink(learning("a", 1, ["python"], { affiliate: { ...affiliate, url: "" } }))).toBe(false);
    expect(isAffiliateLink(learning("a", 1, ["python"], { affiliate: { ...affiliate, url: "http://aff.example.com/x" } }))).toBe(false);
  });
});

describe("compareByEditorial", () => {
  it("editorial_rank の昇順、同順位は resource_id の昇順", () => {
    const sorted = [learning("c", 2, []), learning("b", 1, []), learning("a", 2, [])].sort(compareByEditorial);
    expect(ids(sorted)).toEqual(["b", "a", "c"]);
  });
});

describe("selectResources", () => {
  it("無料教材があれば、編集順位が低くても先頭に 1 件だけ置く", () => {
    const matched = [
      learning("paid-1", 1, []),
      learning("paid-2", 2, []),
      learning("free-5", 5, [], { cost: "free" }),
      learning("free-9", 9, [], { cost: "free" }),
    ];
    expect(ids(selectResources(matched, 3))).toEqual(["free-5", "paid-1", "paid-2"]);
    expect(ids(selectResources(matched, 1))).toEqual(["free-5"]);
    expect(ids(selectResources(matched, 10))).toEqual(["free-5", "paid-1", "paid-2", "free-9"]);
  });

  it("無料教材が無ければ編集順位の順", () => {
    expect(ids(selectResources([learning("b", 2, []), learning("a", 1, [])], 2))).toEqual(["a", "b"]);
  });

  it("下位の教材にアフィリエイトが付いても、上位の順位は変わらない", () => {
    const affiliate = { status: "active" as const, program: "program", url: "https://aff.example.com/x" };
    const plain = [learning("top", 1, []), learning("low", 2, [])];
    const withAffiliate = [learning("top", 1, []), learning("low", 2, [], { affiliate })];
    expect(ids(selectResources(withAffiliate, 2))).toEqual(ids(selectResources(plain, 2)));
    expect(ids(selectResources(withAffiliate, 1))).toEqual(["top"]);
  });
});

describe("決定論（入力の順序に依存しない）", () => {
  const items = [
    learning("b", 1, ["python"]),
    learning("a", 1, ["python", "sql"], { cost: "free" }),
    learning("c", 2, ["sql"]),
  ];
  const services = [
    service("s-b", 1),
    service("s-a", 1, { audience: "all" }),
    service("s-c", 2, { audience: "freelance", requires_goal_experience: true }),
  ];

  it("6 通りの並べ替えで、selectResources・resolveStepResources・resolveCareerNextResources の出力が一致する", () => {
    const steps = [step("s1", ["python", "sql"])];
    const outputs = permutations(items).map((p) => ({
      selected: ids(selectResources(p, 3)),
      steps: resolveStepResources(steps, p).map((s) => ({ step_id: s.step_id, ids: ids(s.resources) })),
    }));
    expect(outputs).toHaveLength(6);
    for (const output of outputs) expect(output).toEqual(outputs[0]);

    const careers = permutations(services).map((p) => {
      const result = resolveCareerNextResources("frontend-developer", true, p);
      return { job: ids(result.job_change_services), freelance: ids(result.freelance_services) };
    });
    expect(careers).toHaveLength(6);
    for (const output of careers) expect(output).toEqual(careers[0]);
  });
});

describe("resolveStepResources", () => {
  it("Skill ごとに perSkill 件まで、Step 全体で 4 件まで", () => {
    // any_of 2 個 → perSkill = min(2, floor(4 / 2)) = 2
    const all = [
      learning("py-1", 1, ["python"]),
      learning("py-2", 2, ["python"]),
      learning("py-3", 3, ["python"]),
      learning("sql-1", 1, ["sql"]),
      learning("sql-2", 2, ["sql"]),
      learning("sql-3", 3, ["sql"]),
    ];
    const [result] = resolveStepResources([step("s", ["python", "sql"])], all);
    expect(ids(result.resources)).toEqual(["py-1", "py-2", "sql-1", "sql-2"]);
  });

  it("any_of が 1 個でも perSkill は 2 まで", () => {
    const all = [learning("py-1", 1, ["python"]), learning("py-2", 2, ["python"]), learning("py-3", 3, ["python"])];
    expect(ids(resolveStepResources([step("s", ["python"])], all)[0].resources)).toEqual(["py-1", "py-2"]);
  });

  it("複数 Skill にまたがる教材は 1 回だけ数え、次の Skill では別の教材を選ぶ", () => {
    const all = [learning("both", 1, ["python", "sql"]), learning("py-2", 2, ["python"]), learning("sql-2", 2, ["sql"])];
    const [result] = resolveStepResources([step("s", ["python", "sql"])], all);
    expect(ids(result.resources)).toEqual(["both", "py-2", "sql-2"]);
    expect(new Set(ids(result.resources)).size).toBe(result.resources.length);
  });

  it("any_of が 9 個なら perSkill = 1 で、Step 全体は 4 件まで・重複なし", () => {
    const languages = ["python", "java", "go", "php", "ruby", "csharp", "nodejs", "kotlin", "scala"];
    const all = [
      learning("multi", 1, ["python", "java", "go"]),
      ...languages.flatMap((skill) => [learning(`${skill}-1`, 2, [skill]), learning(`${skill}-2`, 3, [skill])]),
    ];
    const [result] = resolveStepResources([step("backend-language", languages)], all);
    expect(result.resources).toHaveLength(MAX_RESOURCES_PER_STEP);
    expect(new Set(ids(result.resources)).size).toBe(MAX_RESOURCES_PER_STEP);
    // python は multi の 1 件だけ（perSkill = 1）。java・go は multi 使用済みなので各自の 1 位
    expect(ids(result.resources)).toEqual(["multi", "java-1", "go-1", "php-1"]);
  });

  it("停止中の教材とキャリアサービスは使わない。教材が無い Step は空", () => {
    const all: Resource[] = [
      learning("inactive", 1, ["python"], { is_active: false }),
      learning("active", 2, ["python"]),
      service("svc", 1),
    ];
    const result = resolveStepResources([step("s1", ["python"]), step("s2", ["sql"])], all);
    expect(result.map((s) => ({ step_id: s.step_id, ids: ids(s.resources) }))).toEqual([
      { step_id: "s1", ids: ["active"] },
      { step_id: "s2", ids: [] },
    ]);
  });
});

describe("resolveCareerNextResources", () => {
  const all: Resource[] = [
    service("change-1", 1),
    service("change-2", 2),
    service("change-3", 3),
    service("all-1", 1, { audience: "all" }),
    service("change-exp", 1, { requires_goal_experience: true }),
    service("free-1", 1, { audience: "freelance", requires_goal_experience: true }),
    service("free-2", 2, { audience: "freelance" }),
    service("other-goal", 0, { goal_ids: ["backend-developer"] }),
    service("inactive", 0, { is_active: false }),
    learning("book", 0, ["python"]),
  ];

  it("Goal の職業の経験が無い：経験不要・freelance 以外の転職サービスを 2 件まで、フリーランスは空", () => {
    const result = resolveCareerNextResources("frontend-developer", false, all);
    expect(ids(result.job_change_services)).toEqual(["all-1", "change-1"]);
    expect(result.freelance_services).toEqual([]);
  });

  it("Goal の職業の経験がある：audience = all は転職側だけ。どちらも 4 件まで", () => {
    const result = resolveCareerNextResources("frontend-developer", true, all);
    expect(ids(result.job_change_services)).toEqual(["all-1", "change-1", "change-exp", "change-2"]);
    expect(ids(result.freelance_services)).toEqual(["free-1", "free-2"]);
    const overlap = ids(result.job_change_services).filter((id) => ids(result.freelance_services).includes(id));
    expect(overlap).toEqual([]);
  });

  it("別の Goal のサービスと停止中のサービスは出さない", () => {
    const result = resolveCareerNextResources("frontend-developer", true, all);
    const shown = [...ids(result.job_change_services), ...ids(result.freelance_services)];
    expect(shown).not.toContain("other-goal");
    expect(shown).not.toContain("inactive");
  });
});
