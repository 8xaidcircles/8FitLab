import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CERTIFICATION_CATEGORIES } from "@/lib/labels";
import { normalizeHumanRequirements } from "../skill-layers";
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

describe("代わりのきく技術のグループ", () => {
  it("グループ ID が一意で、メンバーは辞書にあり、1 つの Goal の中では 1 つの技術は 1 グループだけに入る", () => {
    expect(new Set(groups.map((g) => g.group_id)).size).toBe(groups.length);
    for (const id of groups.flatMap((g) => g.members)) expect(techIds).toContain(id);
    for (const goal of statistics) {
      const members = groups.filter((g) => !g.goals || g.goals.includes(goal.goal_id)).flatMap((g) => g.members);
      expect(new Set(members).size, goal.goal_id).toBe(members.length);
    }
  });

  it("データ分析の言語は、Python と R のどちらか（各言語のライブラリ・開発環境を含む）で満たす 1 項目になる", () => {
    for (const goalId of ["data-analyst", "data-scientist"]) {
      const goal = statistics.find((s) => s.goal_id === goalId)!;
      const units = (goal.units as StatisticsUnit[]).filter((u) => u.selected);
      const language = units.find((u) => u.unit_id === "analysis-language");
      expect(language, goalId).toBeDefined();
      expect(language!.members.map((m) => m.skill_id), goalId).toEqual(expect.arrayContaining(["python", "r"]));
      for (const id of ["python", "r", "pandas", "numpy", "scikit-learn", "jupyter", "tidyverse", "rstudio"]) {
        expect(units.some((u) => u.type === "skill" && u.unit_id === id), `${goalId}: ${id}`).toBe(false);
      }
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
