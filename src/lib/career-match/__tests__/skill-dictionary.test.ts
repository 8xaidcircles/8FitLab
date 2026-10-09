import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CERTIFICATION_CATEGORIES } from "@/lib/labels";
import { loadSkillContext } from "../data";
import { layeredSkillProgress, normalizeHumanRequirements } from "../skill-layers";
import type { Certification, HumanSkill, SkillLayersMaster } from "../types";

const DATA_DIR = path.join(process.cwd(), "data");
const readJson = async (relativePath: string) =>
  JSON.parse(await readFile(path.join(DATA_DIR, relativePath), "utf-8"));

type TechSkill = { skill_id: string; name: string; category: string; so_items: string[] };
type Migration = {
  old_skill_id: string;
  action: string;
  new_skill_ids?: string[];
  human_domain?: string;
};

type TechSkillGroup = { group_id: string; name: string; goals?: string[]; members: string[] };
type StatisticsUnit = {
  unit_id: string;
  type: "group" | "skill";
  selected: boolean;
  significant: boolean;
  roles: ("base" | "distinctive")[];
  base_weight: number;
  distinctive_weight: number;
  region_p_skill_given_goal: number;
  region_p_skill_given_other: number;
  members: { skill_id: string; so_item: string }[];
};

const humanMaster = await readJson("skills/human-skills.json");
const humanSkills: HumanSkill[] = humanMaster.skills;
const humanSkillIds = new Set(humanSkills.map((s) => s.skill_id));
const certifications: Certification[] = (await readJson("skills/certifications.json")).certifications;
const skillLayers: SkillLayersMaster = await readJson("skills/goal-skill-layers.json");

const dictionary = await readJson("skills/tech-skills.json");
const groups: TechSkillGroup[] = (await readJson("skills/tech-skill-groups.json")).groups;
const techSkills: TechSkill[] = dictionary.skills;
const techIds = new Set(techSkills.map((s) => s.skill_id));
const anySkillIds = new Set([...techIds, ...humanSkillIds]);
const migration = await readJson("skills/skill-migration.json");
const mappings: Migration[] = migration.mappings;
const oldSkills: { skill_id: string }[] = (await readJson("skills/skills.json")).skills;
const statisticsDir = path.join(DATA_DIR, "statistics", "skill-match");
const statistics = await Promise.all(
  (await readdir(statisticsDir)).filter((file) => file.endsWith(".json")).map((file) => readJson(path.join("statistics", "skill-match", file))),
);

describe("技術スキル辞書", () => {
  it("skill_id と調査の選択肢名が重複しない", () => {
    expect(techIds.size).toBe(techSkills.length);
    const soItems = techSkills.flatMap((s) => s.so_items);
    expect(new Set(soItems).size).toBe(soItems.length);
  });

  it("カテゴリは定義済みのもの", () => {
    const categories = new Set(Object.keys(dictionary.categories));
    for (const skill of techSkills) expect(categories, skill.skill_id).toContain(skill.category);
  });

  it("Goal に採用された技術はすべて辞書にある", () => {
    expect(statistics).toHaveLength(14);
    for (const goal of statistics) {
      for (const unit of goal.units.filter((u: StatisticsUnit) => u.selected)) {
        for (const member of unit.members) {
          expect(techIds, `${goal.goal_id}: ${member.so_item}`).toContain(member.skill_id);
        }
      }
    }
  });
});

const groupsVersion: string = (await readJson("skills/tech-skill-groups.json")).version;

describe("Skill Statistics の基本リスト・特有リスト", () => {
  const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
  // JSON の確率は小数 6 桁に丸めてあり、丸める前の値で判定した向きを復元できない幅
  const EPS = 1e-6;
  const nearBoundary = (a: number, b: number) => Math.abs(a - b) <= EPS;

  it("全ファイルが同じグループ定義の版・β・対象 Goal を持つ", () => {
    for (const goal of statistics) {
      expect(goal.groups_version, goal.goal_id).toBe(groupsVersion);
      expect(goal.selection.distinctive_share, goal.goal_id).toBe(statistics[0].selection.distinctive_share);
      expect(goal.selection.distinctive_share_goals, goal.goal_id).toEqual(statistics[0].selection.distinctive_share_goals);
      expect(goal.selection.cumulative_share, goal.goal_id).toBeUndefined();
      expect(goal.selection.base_discount_d_ref, goal.goal_id).toBe(statistics[0].selection.base_discount_d_ref);
      expect(goal.selection.base_discount_d_ref_method, goal.goal_id).toBe("logistic-p50");
    }
  });

  it("d* は正の値で、推定に使った件数は全 Goal の基本リストの候補（辞書にあり pg ≥ base_min_share）の数と有意な数に一致する", () => {
    const { base_discount_d_ref: dRef, base_discount_d_ref_n_units: n, base_discount_d_ref_n_significant: nSignificant } =
      statistics[0].selection;
    expect(dRef).toBeGreaterThan(0);
    const inDictionary = statistics.flatMap((goal) =>
      (goal.units as StatisticsUnit[])
        .filter((u) => u.members.every((m) => techIds.has(m.skill_id)))
        .map((u) => ({ u, min: goal.selection.base_min_share })),
    );
    const clear = inDictionary.filter(({ u, min }) => !nearBoundary(u.region_p_skill_given_goal, min) && u.region_p_skill_given_goal > min);
    const boundary = inDictionary.filter(({ u, min }) => nearBoundary(u.region_p_skill_given_goal, min));
    expect(n).toBeGreaterThanOrEqual(clear.length);
    expect(n).toBeLessThanOrEqual(clear.length + boundary.length);
    const clearSignificant = clear.filter(({ u }) => u.significant).length;
    expect(nSignificant).toBeGreaterThanOrEqual(clearSignificant);
    expect(nSignificant).toBeLessThanOrEqual(clearSignificant + boundary.filter(({ u }) => u.significant).length);
  });

  it("β の対象は技術スキル層の配分が 0 より大きい Goal で、β はその Goal の重みの合計から求めた値", () => {
    const techGoals = skillLayers.goals
      .filter((g) => (g.layer_weights?.tech ?? skillLayers.default_layer_weights.tech) > 0)
      .map((g) => g.goal_id);
    const { distinctive_share: beta, distinctive_share_goals: goalIds } = statistics[0].selection;
    expect([...goalIds].sort()).toEqual([...techGoals].sort());
    const splits = statistics.filter((s) => goalIds.includes(s.goal_id)).map((s) => s.skill_split);
    const distinctive = sum(splits.map((s) => s.distinctive_total));
    const total = sum(splits.map((s) => s.base_total + s.distinctive_total));
    expect(beta).toBeCloseTo(distinctive / total, 4);
  });

  it.each(statistics.map((s) => [s.goal_id, s] as const))("%s：役割・重み・合計が定義どおり", (_id, goal) => {
    const min = goal.selection.base_min_share;
    const dRef = goal.selection.base_discount_d_ref;
    const units = goal.units as StatisticsUnit[];
    for (const u of units) {
      const pg = u.region_p_skill_given_goal;
      const po = u.region_p_skill_given_other;
      const inDictionary = u.members.every((m) => techIds.has(m.skill_id));
      const d = pg + po > 0 ? Math.max(0, (pg - po) / (pg + po)) : 0;
      // 生成時は丸める前の pg・po で判定するため、丸めた値が境界に近い unit は判定の向きを検証しない
      const candidate = !inDictionary ? false : nearBoundary(pg, min) ? null : pg > min;
      const goalSide = !nearBoundary(pg, po) ? pg > po : null;
      expect(u.roles.includes("base"), u.unit_id).toBe(u.base_weight > 0);
      expect(u.roles.includes("distinctive"), u.unit_id).toBe(u.distinctive_weight > 0);
      expect(u.selected, u.unit_id).toBe(u.roles.length > 0);
      // 基本リスト：候補（辞書にあり pg ≥ base_min_share）のうち、重み pg × min(1, d / d*) が 0 より大きいもの
      if (candidate === false) expect(u.base_weight, u.unit_id).toBe(0);
      if (candidate === true && goalSide === false) expect(u.roles.includes("base"), u.unit_id).toBe(false);
      // pg・po は小数 6 桁に丸めた値のため、d / d* で誤差が広がる分だけ許容幅を広げる
      if (candidate === true) expect(u.base_weight, u.unit_id).toBeCloseTo(pg * Math.min(1, d / dRef), 4);
      if (goalSide !== null) {
        expect(u.roles.includes("distinctive"), u.unit_id).toBe(inDictionary && u.significant && goalSide);
      }
      expect(u.distinctive_weight, u.unit_id).toBeCloseTo(u.roles.includes("distinctive") ? pg * d : 0, 5);
    }
    expect(goal.skill_split.base_total).toBeCloseTo(sum(units.map((u) => u.base_weight)), 5);
    expect(goal.skill_split.distinctive_total).toBeCloseTo(sum(units.map((u) => u.distinctive_weight)), 5);
  });
});

describe("代わりのきく技術のグループ", () => {
  it("グループ ID が一意で、メンバーは辞書にあり、1 つの Goal の中では 1 つの技術は 1 グループだけに入る", () => {
    expect(new Set(groups.map((g) => g.group_id)).size).toBe(groups.length);
    for (const id of groups.flatMap((g) => g.members)) expect(techIds).toContain(id);
    for (const goal of statistics) {
      const members = groups.filter((g) => !g.goals || g.goals.includes(goal.goal_id)).flatMap((g) => g.members);
      expect(new Set(members).size, goal.goal_id).toBe(members.length);
    }
  });

  it("メンバーは調査の同じ設問（辞書の同じ category）の選択肢に限る（例外は Node.js・Deno・Spring Framework）", () => {
    const CATEGORY_EXCEPTIONS: Record<string, string[]> = {
      "server-language": ["nodejs", "deno"],
      "server-framework": ["spring-framework"],
    };
    const categoryOf = new Map(techSkills.map((s) => [s.skill_id, s.category]));
    for (const group of groups) {
      const exceptions = CATEGORY_EXCEPTIONS[group.group_id] ?? [];
      const categories = new Set(group.members.filter((id) => !exceptions.includes(id)).map((id) => categoryOf.get(id)));
      expect(categories.size, group.group_id).toBe(1);
    }
  });

  it("言語とその言語のライブラリ・開発環境は同じグループに入らない", () => {
    const groupOf = (id: string, goalId: string) =>
      groups.find((g) => (!g.goals || g.goals.includes(goalId)) && g.members.includes(id))?.group_id;
    for (const goalId of ["data-analyst", "data-scientist", "data-engineer"]) {
      for (const [language, companion] of [
        ["python", "pandas"],
        ["python", "jupyter"],
        ["r", "tidyverse"],
        ["r", "rstudio"],
      ]) {
        const g = groupOf(language, goalId);
        if (g) expect(groupOf(companion, goalId), `${goalId}: ${language} / ${companion}`).not.toBe(g);
      }
    }
  });

  it.each([
    { groupId: "analysis-language", goalIds: ["data-analyst", "data-scientist"], members: ["python", "r"] },
    { groupId: "dataframe-library", goalIds: ["data-analyst", "data-scientist"], members: ["pandas", "tidyverse"] },
    { groupId: "data-science-ide", goalIds: ["data-analyst", "data-scientist"], members: ["jupyter", "rstudio"] },
    { groupId: "infrastructure-language", goalIds: ["cloud-architect", "devops-sre"], members: ["python", "go"] },
    {
      groupId: "javascript-language",
      goalIds: ["frontend-developer", "full-stack-developer", "software-architect"],
      members: ["javascript", "typescript"],
    },
    {
      groupId: "python-web-framework",
      goalIds: ["data-scientist", "data-engineer", "devops-sre", "cloud-architect", "network-engineer"],
      members: ["fastapi", "flask", "django"],
    },
  ])("$groupId は $goalIds で 1 項目になり、メンバーが個別の項目として残らない", ({ groupId, goalIds, members }) => {
    for (const goalId of goalIds) {
      const goal = statistics.find((s) => s.goal_id === goalId)!;
      const units = (goal.units as StatisticsUnit[]).filter((u) => u.selected);
      const group = units.find((u) => u.unit_id === groupId);
      expect(group, goalId).toBeDefined();
      expect(group!.members.map((m) => m.skill_id), goalId).toEqual(expect.arrayContaining(members));
      for (const id of members) {
        expect(units.some((u) => u.type === "skill" && u.unit_id === id), `${goalId}: ${id}`).toBe(false);
      }
    }
  });

  it("Kotlin はサーバーサイドの言語のグループに入り、そのグループはバックエンド・フルスタック・アーキテクトに適用される", () => {
    const server = groups.find((g) => g.group_id === "server-language")!;
    expect(server.members).toContain("kotlin");
    expect([...server.goals!].sort()).toEqual(["backend-developer", "full-stack-developer", "software-architect"]);
    expect(groups.some((g) => g.group_id === "server-language-architect")).toBe(false);
  });

  it.each(["backend-developer", "full-stack-developer", "software-architect"])(
    "%s：Kotlin を含むサーバーサイドの言語のグループが統計で採用されている",
    (goalId) => {
      const stats = statistics.find((s) => s.goal_id === goalId)!;
      const server = (stats.units as StatisticsUnit[]).find((u) => u.unit_id === "server-language");
      expect(server?.selected).toBe(true);
      expect(server!.members.map((m) => m.skill_id)).toContain("kotlin");
    },
  );

  it("ソフトウェアアーキテクトのサーバーサイドの言語は、過半数が使う技術として基本リストに入る", () => {
    const stats = statistics.find((s) => s.goal_id === "software-architect")!;
    const server = (stats.units as StatisticsUnit[]).find((u) => u.unit_id === "server-language")!;
    expect(server.roles).toContain("base");
  });

  it("モバイルネイティブ言語のグループはモバイルだけに適用され、モバイルの統計で採用されている", () => {
    const mobile = groups.find((g) => g.group_id === "mobile-native-language")!;
    expect(mobile.goals).toEqual(["mobile-app-developer"]);
    const stats = statistics.find((s) => s.goal_id === "mobile-app-developer")!;
    expect((stats.units as StatisticsUnit[]).find((u) => u.unit_id === "mobile-native-language")?.selected).toBe(true);
  });

  it.each(["backend-developer", "full-stack-developer", "software-architect"])(
    "%s：Kotlin のみと Java のみの Skill Progress が等しい（どちらもサーバーサイドの言語を満たす）",
    async (goalId) => {
      const skill = await loadSkillContext(goalId);
      const progress = (skillId: string) =>
        layeredSkillProgress({ ...skill, held: new Set([skillId]) }).progress;
      expect(progress("java")).toBeGreaterThan(0);
      expect(progress("kotlin")).toBeCloseTo(progress("java"), 10);
    },
  );

  it.each([
    { goalId: "data-scientist", members: ["fastapi", "flask", "django"] },
    { goalId: "data-engineer", members: ["fastapi", "flask", "django"] },
    { goalId: "devops-sre", members: ["fastapi", "flask", "django"] },
    { goalId: "data-analyst", members: ["python", "r"] },
    { goalId: "data-analyst", members: ["pandas", "tidyverse"] },
    { goalId: "data-scientist", members: ["jupyter", "rstudio"] },
    { goalId: "software-architect", members: ["javascript", "typescript"] },
  ])("$goalId：$members はどれか 1 つでも全部でも Skill Progress が同じ（重ねて加点しない）", async ({ goalId, members }) => {
    const skill = await loadSkillContext(goalId);
    const progress = (skillIds: string[]) => layeredSkillProgress({ ...skill, held: new Set(skillIds) }).progress;
    const all = progress(members);
    expect(all).toBeGreaterThan(0);
    for (const id of members) expect(progress([id]), id).toBeCloseTo(all, 10);
  });

  it("言語をまたぐサーバーサイドのグループはサーバーサイドの言語と同じ Goal に限り、それ以外の Goal には言語ごとのグループを適用する", () => {
    const allGoals = statistics.map((s) => s.goal_id as string).sort();
    const goalsOf = (id: string) => [...groups.find((g) => g.group_id === id)!.goals!].sort();
    expect(goalsOf("server-framework")).toEqual(goalsOf("server-language"));
    const complement = (a: string[]) => allGoals.filter((g) => !a.includes(g));
    expect(goalsOf("python-web-framework")).toEqual(complement(goalsOf("server-framework")));
  });

  it.each(["data-analyst", "data-scientist"])(
    "%s：R・tidyverse・RStudio と Python・pandas・Jupyter の Skill Progress が等しく、言語だけよりライブラリを足したほうが高い",
    async (goalId) => {
      const skill = await loadSkillContext(goalId);
      const progress = (skillIds: string[]) => layeredSkillProgress({ ...skill, held: new Set(skillIds) }).progress;
      expect(progress(["r", "tidyverse", "rstudio", "sql"])).toBeCloseTo(progress(["python", "pandas", "jupyter", "sql"]), 10);
      expect(progress(["python", "pandas"])).toBeGreaterThan(progress(["python"]));
    },
  );

  it.each(["data-scientist", "data-engineer"])("%s：Express・Spring Boot だけでは Skill に効かない", async (goalId) => {
    const skill = await loadSkillContext(goalId);
    for (const id of ["express", "spring-boot"]) {
      expect(layeredSkillProgress({ ...skill, held: new Set([id]) }).progress, id).toBe(0);
    }
  });

  it("グループは 2 つ以上のメンバーを持ち、対象 Goal は実在する", () => {
    const goalIds = new Set(statistics.map((s) => s.goal_id));
    for (const group of groups) {
      expect(group.members.length, group.group_id).toBeGreaterThanOrEqual(2);
      for (const goalId of group.goals ?? []) expect(goalIds).toContain(goalId);
    }
  });

  it("統計の unit は、グループなら対象 Goal のもの、技術ならその Goal で有効なグループに属さないもの", () => {
    for (const goal of statistics) {
      const active = groups.filter((g) => !g.goals || g.goals.includes(goal.goal_id));
      const grouped = new Set(active.flatMap((g) => g.members));
      for (const unit of goal.units as StatisticsUnit[]) {
        if (unit.type === "group") {
          expect(active.map((g) => g.group_id), goal.goal_id).toContain(unit.unit_id);
        } else {
          expect(grouped.has(unit.unit_id), `${goal.goal_id}: ${unit.unit_id}`).toBe(false);
          expect(unit.members).toHaveLength(1);
        }
      }
    }
  });
});

describe("人間定義層・資格", () => {
  it("skill_id・ツール・資格の ID は、技術スキル層を含めて重複しない", () => {
    const ids = [
      ...techSkills.map((s) => s.skill_id),
      ...humanSkills.map((s) => s.skill_id),
      ...humanSkills.flatMap((s) => (s.tools ?? []).map((t) => t.tool_id)),
      ...certifications.map((c) => c.cert_id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("人間定義層のスキルは 3 つのドメインのどれかに属する", () => {
    const domains = Object.keys(humanMaster.domains);
    expect(domains).toHaveLength(3);
    for (const skill of humanSkills) expect(domains, skill.skill_id).toContain(skill.domain);
  });

  it("資格は入力画面のカテゴリー（CERTIFICATION_CATEGORIES）のどれかに属する", () => {
    const categories = CERTIFICATION_CATEGORIES.map((c) => c.id);
    for (const cert of certifications) expect(categories, cert.cert_id).toContain(cert.category);
  });

  it("資格が証明するスキルは、人間定義層か技術スキル層に存在する", () => {
    for (const cert of certifications) {
      expect(cert.proves.length, cert.cert_id).toBeGreaterThan(0);
      for (const id of cert.proves) expect(anySkillIds, `${cert.cert_id}: ${id}`).toContain(id);
    }
  });
});

describe("Goal ごとの人間定義層の要件と層の配分", () => {
  it("14 Goal すべてに 1 回ずつ定義がある", () => {
    expect(skillLayers.goals.map((g) => g.goal_id).sort()).toEqual(statistics.map((s) => s.goal_id).sort());
  });

  it.each(skillLayers.goals.map((g) => [g.goal_id, g] as const))("%s の要件と配分が有効", (_id, goal) => {
    const weights = goal.layer_weights ?? skillLayers.default_layer_weights;
    expect(weights.tech).toBeGreaterThanOrEqual(0);
    expect(weights.human).toBeGreaterThanOrEqual(0);
    expect(weights.tech + weights.human).toBeCloseTo(1, 10);
    if (goal.layer_weights) expect(goal.layer_weight_reason).toBeTruthy();

    const requirements = normalizeHumanRequirements(goal.human_requirements);
    expect(requirements.length).toBeGreaterThan(0);
    expect(new Set(requirements.map((r) => r.requirement_id)).size).toBe(requirements.length);
    for (const requirement of requirements) {
      expect(requirement.any_of.length).toBeGreaterThan(0);
      for (const id of requirement.any_of) {
        // 技術スキル層の配分がある Goal で技術スキルを要件にすると、2 層で二重に数える
        const allowed = weights.tech > 0 ? humanSkillIds : anySkillIds;
        expect(allowed, `${goal.goal_id}: ${id}`).toContain(id);
      }
    }
  });

  it("データのある Goal は技術スキル層 100%（既定の配分）", () => {
    expect(skillLayers.default_layer_weights).toEqual({ tech: 1, human: 0 });
  });

  it("IT 基礎知識は資格の受け皿のみで、どの Goal の要件にも入れない", () => {
    for (const goal of skillLayers.goals) {
      const ids = normalizeHumanRequirements(goal.human_requirements).flatMap((r) => r.any_of);
      expect(ids, goal.goal_id).not.toContain("it-fundamentals");
    }
  });

  it("人間定義層で新設したスキルは、人間定義層 100% の Goal だけが要件にする", () => {
    const humanOnly = ["vendor-management", "quality-management", "market-analysis"];
    for (const goal of skillLayers.goals) {
      const tech = (goal.layer_weights ?? skillLayers.default_layer_weights).tech;
      if (tech === 0) continue;
      const ids = normalizeHumanRequirements(goal.human_requirements).flatMap((r) => r.any_of);
      for (const id of humanOnly) expect(ids, goal.goal_id).not.toContain(id);
    }
  });

  it("技術スキル層がほぼ無い Goal（PM・PdM・Test・Network）は人間定義層 100%", () => {
    for (const goalId of ["it-project-manager", "product-manager", "test-analyst", "network-engineer"]) {
      expect(skillLayers.goals.find((g) => g.goal_id === goalId)?.layer_weights).toEqual({ tech: 0, human: 1 });
    }
  });
});

describe("旧スキル → 新スキルの移行表", () => {
  it("旧 76 スキルがちょうど 1 回ずつ載っている", () => {
    expect(oldSkills).toHaveLength(76);
    expect(mappings.map((m) => m.old_skill_id).sort()).toEqual(oldSkills.map((s) => s.skill_id).sort());
  });

  it.each(mappings.map((m) => [m.old_skill_id, m] as const))("%s の移行先が有効", (_id, mapping) => {
    expect(Object.keys(migration.actions)).toContain(mapping.action);
    const toTech = mapping.action !== "human";
    const toHuman = mapping.action === "human" || mapping.action === "split_and_human";
    expect((mapping.new_skill_ids ?? []).length > 0).toBe(toTech);
    for (const id of mapping.new_skill_ids ?? []) expect(techIds).toContain(id);
    if (toHuman) {
      expect(Object.keys(migration.human_domains)).toContain(mapping.human_domain);
      // 人間定義層へは同じ skill_id で移る
      expect(humanSkills.find((s) => s.skill_id === mapping.old_skill_id)?.domain).toBe(mapping.human_domain);
    } else {
      expect(mapping.human_domain).toBeUndefined();
    }
  });
});
