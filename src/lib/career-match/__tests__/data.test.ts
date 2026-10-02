import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { calculateCareerMatch, contribution, quality } from "../calculate";
import {
  goalOccupations,
  loadCareerStatistics,
  loadEducation,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadRoleGroups,
  loadCertifications,
  loadGoalSkillLayers,
  loadHumanSkills,
  loadRoles,
  loadSkillLayersMaster,
  loadSkillContext,
  loadSkillMigration,
  loadSkillNames,
  loadSkillStatistics,
  loadTechSkills,
} from "../data";
import { heldSkillIds, layeredSkillProgress, normalizeHumanRequirements } from "../skill-layers";
import { goalSkillUnits, weightedSkillProgress } from "../skill-score";
import { DEGREES, UNKNOWN_EDUCATION_LEVEL_ID } from "../types";

const goals = await loadGoals();
const roles = await loadRoles();
const roleById = new Map(roles.map((role) => [role.role_id, role]));
const skillIds = new Set((await loadSkillNames()).keys());

describe("Goal Mapping", () => {
  it("14 Goal が一意に定義されている", () => {
    expect(goals).toHaveLength(14);
    expect(new Set(goals.map((g) => g.goal_id)).size).toBe(14);
  });

  it.each(goals.map((g) => [g.goal_id, g] as const))("%s の職業コードは ESCO に存在する", (_id, goal) => {
    expect(goal.requirement_groups.length).toBeGreaterThan(0);
    expect(new Set(goal.requirement_groups.map((g) => g.group_id)).size).toBe(goal.requirement_groups.length);
    for (const group of goal.requirement_groups) {
      expect(group.name).toBeTruthy();
      expect(group.occupations.length).toBeGreaterThan(0);
    }
    const codes = goalOccupations(goal).map((o) => o.code);
    expect(new Set(codes).size, "同じ職業を複数の Group に入れない").toBe(codes.length);
    for (const occupation of goalOccupations(goal)) {
      expect(roleById.get(occupation.code)?.label).toBe(occupation.label);
    }
  });

  it("Full-Stack = フロントエンド AND バックエンド（それぞれ単独 Goal と同じ職業）", () => {
    const codesOf = (goalId: string) =>
      goals.find((g) => g.goal_id === goalId)!.requirement_groups.map((g) => g.occupations.map((o) => o.code));
    expect(codesOf("full-stack-developer")).toEqual([...codesOf("frontend-developer"), ...codesOf("backend-developer")]);
  });

  it("未知の Goal は読み込めない", async () => {
    await expect(loadCareerStatistics("../../package")).rejects.toThrow("Unknown goal");
    await expect(loadLearningPath("unknown-goal")).rejects.toThrow("Unknown goal");
  });
});

describe("Goal Skill Master（Learning Path）", () => {
  it("移行が必要な旧 skill_id（renamed / merged / split）を使っていない", async () => {
    const migration = await loadSkillMigration();
    const legacy = new Set(
      migration.filter((m) => ["renamed", "merged", "split"].includes(m.action)).map((m) => m.old_skill_id),
    );
    for (const goal of goals) {
      const ids = (await loadLearningPath(goal.goal_id)).steps.flatMap((s) => s.any_of);
      expect(ids.filter((id) => legacy.has(id)), goal.goal_id).toEqual([]);
    }
  });

  it.each(goals.map((g) => [g.goal_id] as const))("%s", async (goalId) => {
    const path = await loadLearningPath(goalId);
    expect(path.goal_id).toBe(goalId);
    expect(path.steps.length).toBeGreaterThan(0);

    const orders = path.steps.map((s) => s.learning_order);
    expect(orders).toEqual(orders.map((_, i) => i + 1));
    expect(new Set(path.steps.map((s) => s.step_id)).size).toBe(path.steps.length);

    const inGoal = path.steps.flatMap((s) => s.any_of);
    expect(new Set(inGoal).size).toBe(inGoal.length);
    expect(inGoal.filter((id) => !skillIds.has(id))).toEqual([]);
    for (const step of path.steps) expect(step.any_of.length).toBeGreaterThan(0);
  });
});

describe("職種・Goal の日本語表示名", () => {
  it("日本語職種リストの role_id はすべて ESCO に存在し、重複しない", async () => {
    const ids = (await loadRoleGroups()).flatMap((g) => g.roles.map((r) => r.role_id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.filter((id) => !roleById.has(id))).toEqual([]);
  });

  it("先頭は主要な IT 職種（8 種）で、IT 職種のグループの後に IT 以外のグループが並ぶ", async () => {
    const groups = await loadRoleGroups();
    expect(groups[0]).toMatchObject({ group_id: "featured", category: "it" });
    expect(groups[0].roles).toHaveLength(8);
    const categories = groups.map((g) => g.category);
    expect(categories).toEqual([...categories].sort((a, b) => (a === b ? 0 : a === "it" ? -1 : 1)));
    for (const group of groups) {
      expect(["it", "other"], group.group_id).toContain(group.category);
      expect(group.roles.length, group.group_id).toBeGreaterThan(0);
      for (const role of group.roles) expect(role.name, role.role_id).toMatch(/[ぁ-んァ-ヶ一-龠]/);
    }
  });

  it("IT 以外の主要な職種（営業・事務・経理・人事・マーケティング・コンサルタント）を日本語で選べる", async () => {
    const byName = new Map((await loadRoleGroups()).flatMap((g) => g.roles.map((r) => [r.name, r.role_id] as const)));
    for (const [name, label] of [
      ["営業担当者", "commercial sales representative"],
      ["一般事務・事務アシスタント", "administrative assistant"],
      ["会計士・経理", "accountant"],
      ["人事担当", "human resources officer"],
      ["マーケティングマネージャー", "marketing manager"],
      ["ビジネスコンサルタント（経営コンサルタント）", "business consultant"],
    ]) {
      expect(roleById.get(byName.get(name)!)?.label, name).toBe(label);
    }
  });

  it("全 Goal の職業が日本語職種リストに含まれる", async () => {
    const ids = new Set((await loadRoleGroups()).flatMap((g) => g.roles.map((r) => r.role_id)));
    const missing = goals.flatMap((g) => goalOccupations(g).map((o) => o.code)).filter((code) => !ids.has(code));
    expect(missing).toEqual([]);
  });

  it("全 Goal に日本語名と説明がある", () => {
    for (const goal of goals) {
      expect(goal.name, goal.goal_id).toBeTruthy();
      expect(goal.summary, goal.goal_id).toBeTruthy();
    }
  });
});

describe("Education Master", () => {
  it("学歴 ID は一意で、統計上の学歴はすべて JobHop の 5 段階に含まれ、5 段階すべてに対応がある", async () => {
    const { levels } = await loadEducation();
    const known = levels.filter((l) => l.level_id !== UNKNOWN_EDUCATION_LEVEL_ID);
    expect(new Set(levels.map((l) => l.level_id)).size).toBe(levels.length);
    for (const level of known) expect(DEGREES).toContain(level.degree_id);
    expect(new Set(known.map((l) => l.degree_id))).toEqual(new Set(DEGREES));
  });

  it("「わかりません / 答えない」は最後の選択肢で、統計上の学歴を持たない", async () => {
    const { levels } = await loadEducation();
    expect(levels.at(-1)).toMatchObject({
      level_id: UNKNOWN_EDUCATION_LEVEL_ID,
      name: "わかりません / 答えない",
      degree_id: null,
      isced: null,
    });
  });

  it("学歴（「わかりません」を除く）は ISCED レベル順に並ぶ", async () => {
    const isced = (await loadEducation()).levels.slice(0, -1).map((l) => l.isced!);
    expect(isced).toEqual([...isced].sort((a, b) => a - b));
  });

  it("専攻分野（fields / field_selectable）は持たない", async () => {
    const raw = JSON.parse(await readFile(path.join(process.cwd(), "data", "education", "education.json"), "utf-8"));
    expect(raw).not.toHaveProperty("fields");
    for (const level of raw.levels) expect(level).not.toHaveProperty("field_selectable");
  });

  it("専門学校・高専・短大（ISCED 5）は高校相当として計算し、補足説明を持つ", async () => {
    const { levels } = await loadEducation();
    const short = levels.filter((l) => l.isced === 5);
    expect(short.map((l) => l.level_id).sort()).toEqual(["junior-college", "technical-college", "vocational-school"]);
    for (const level of short) {
      expect(level.degree_id).toBe("Secondary school");
      expect(level.mapping_note).toBeTruthy();
    }
  });

});

describe("Career Statistics Master", () => {
  it.each(goals.map((g) => [g.goal_id, g] as const))("%s", async (goalId, goal) => {
    const stats = await loadCareerStatistics(goalId);
    expect(stats.goal_id).toBe(goalId);
    expect(stats.mapping_status).toBe(goal.mapping_status);
    expect(stats.goal_occupations).toEqual(goalOccupations(goal).map((o) => o.code));
    expect(stats.requirement_groups.map((g) => ({ group_id: g.group_id, occupations: g.occupations }))).toEqual(
      goal.requirement_groups.map((g) => ({ group_id: g.group_id, occupations: g.occupations.map((o) => o.code) })),
    );
    expect(stats.taxonomy_version).toBe("1.1.2");
    expect(stats.small_sample).toBe(stats.goal_sample_size < 100);
    expect(stats.goal_sample_size).toBeGreaterThan(0);
    expect(stats.experience_reference_percentile).toBe(90);
    expect(stats.experience_reference_estimator).toBe("harrell-davis");

    // Duplicate Person: Group 内（OR）は重複を除いた人数、Group 間（AND）は全 Group を満たした人数
    // （開始日が無く到達時点が分からない人は Goal / Other から除外）
    const personsPerGroup = goal.requirement_groups.map((g) => g.occupations.map((o) => roleById.get(o.code)!.jobhop_persons));
    const everInGoal = stats.goal_sample_size + stats.undated_goal_persons;
    expect(everInGoal).toBeLessThanOrEqual(Math.min(...personsPerGroup.map((p) => p.reduce((a, b) => a + b, 0))));
    if (personsPerGroup.length === 1) expect(everInGoal).toBeGreaterThanOrEqual(Math.max(...personsPerGroup[0]));

    const experience = stats.requirement_groups.flatMap((g) => g.experience);
    const education = stats.education ?? [];
    for (const group of stats.requirement_groups) {
      expect(group.experience.length).toBeGreaterThan(0);
      expect(group.goal_sample_size).toBeGreaterThanOrEqual(stats.goal_sample_size);
      expect(group.pre_goal_experience_persons).toBeGreaterThan(0);
      expect(group.pre_goal_experience_persons).toBeLessThanOrEqual(group.goal_sample_size);
      expect(group.experience_reference).toBeGreaterThan(0);

      // Duplicate Unit: Unit は Group 内で一意
      expect(new Set(group.experience.map((r) => r.unit_id)).size).toBe(group.experience.length);

      const groupCodes = new Set(group.occupations);
      for (const r of group.experience) {
        expect(roleById.has(r.role_id)).toBe(true);
        expect(groupCodes.has(r.role_id), `${r.unit_id} は Group の職業そのもの`).toBe(false);
        expect(r.years).toBeGreaterThanOrEqual(0.5);
        expect(r.years).toBeLessThanOrEqual(50);
        expect(r.years * 2).toBe(Math.round(r.years * 2));
      }

      // 在職年数の分布：Group Population の一部で、0.5 年単位・昇順・人数の合計が sample_size
      const tenure = group.occupation_tenure;
      expect(tenure.sample_size).toBeGreaterThan(0);
      expect(tenure.sample_size).toBeLessThanOrEqual(group.goal_sample_size);
      expect(tenure.distribution.reduce((sum, row) => sum + row.persons, 0)).toBe(tenure.sample_size);
      tenure.distribution.forEach((row, i) => {
        expect(row.years * 2).toBe(Math.round(row.years * 2));
        expect(row.years).toBeGreaterThanOrEqual(0.5);
        expect(row.years).toBeLessThanOrEqual(50);
        expect(row.persons).toBeGreaterThan(0);
        if (i > 0) expect(row.years).toBeGreaterThan(tenure.distribution[i - 1].years);
      });

      // 累積 Unit（年以上）なので、同じ Role では年数が長いほど P(Unit|Goal) は増えない
      const byRole = new Map<string, typeof group.experience>();
      for (const r of group.experience) byRole.set(r.role_id, [...(byRole.get(r.role_id) ?? []), r]);
      for (const rows of byRole.values()) {
        const sorted = [...rows].sort((a, b) => a.years - b.years);
        for (let i = 1; i < sorted.length; i++) {
          expect(sorted[i].p_unit_given_goal).toBeLessThanOrEqual(sorted[i - 1].p_unit_given_goal);
        }
      }
    }

    expect(new Set(education.map((r) => r.unit_id)).size).toBe(education.length);
    for (const r of education) expect(DEGREES).toContain(r.degree_id);

    // Education は 1 人 1 値のため、Goal 内の分布は合計 1
    const pEducation = education.reduce((sum, r) => sum + r.p_unit_given_goal, 0);
    expect(pEducation).toBeCloseTo(1, 3);

    for (const r of [...experience, ...education]) {
      expect(r.quantity).toBe(r.p_unit_given_goal);
      expect(r.quantity).toBeGreaterThanOrEqual(0);
      expect(r.quantity).toBeLessThanOrEqual(1);
      // 確率は小数 6 桁、Quality は小数 4 桁に丸めて保存され、Quality は丸め前の確率から算出されている
      const pg = r.p_unit_given_goal;
      const po = r.p_unit_given_other;
      const roundingBound = (100 * 5e-7 * (pg + po)) / (pg + po) ** 2 + 5e-5;
      expect(Math.abs(r.quality - quality(pg, po))).toBeLessThanOrEqual(roundingBound * 1.01);
      expect(r.contribution).toBeCloseTo(contribution(r.quantity, r.quality), 4);
    }
  });
});

describe("実データでの算出", () => {
  it("Data Scientist: 全カテゴリが 0〜100 に収まる", async () => {
    const known = await loadKnownIds();
    const [stats, skill] = await Promise.all([loadCareerStatistics("data-scientist"), loadSkillContext("data-scientist")]);
    const short = calculateCareerMatch(
      { skill_ids: ["python", "sql", "statistics"], certification_ids: [], experiences: [{ role_id: "2511.4", years: 0.5 }], degree_id: "Master" },
      stats,
      skill,
      known,
    );
    expect(short.evidence_mode).toBe("full");
    expect(short.confidence).toBe("moderate");
    expect(short.skill_match).toBeGreaterThan(0);
    expect(short.tech_skill_progress).toBeGreaterThan(0);
    expect(short.skill_progress).toBe(short.tech_skill_progress);
    expect(short.skill_layer_weights).toEqual({ tech: 1, human: 0, source: "default" });
    expect(short.education_match).toBeGreaterThan(0);
    for (const value of [short.goal_match, short.skill_match, short.experience_match!, short.education_match!]) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
    expect(short.ignored).toEqual({
      skill_ids: [],
      legacy_skill_ids: [],
      certification_ids: [],
      role_ids: [],
      degree_id: null,
    });
  });

  it("Proxy Goal（Full-Stack Developer）は proxy / moderate_low", async () => {
    const known = await loadKnownIds();
    const [stats, skill] = await Promise.all([
      loadCareerStatistics("full-stack-developer"),
      loadSkillContext("full-stack-developer"),
    ]);
    const result = calculateCareerMatch(
      { skill_ids: [], certification_ids: [], experiences: [{ role_id: "2512.4", years: 3 }], degree_id: "Bachelor" },
      stats,
      skill,
      known,
    );
    expect(result.evidence_mode).toBe("proxy");
    expect(result.confidence).toBe("moderate_low");
    expect(result.experience_match).toBeGreaterThan(0);
  });

  it("Frontend: Goal 職業（Web開発者）の経験は即 100 ではなく、在職年数に応じた値（1 年で 40〜50）", async () => {
    const known = await loadKnownIds();
    const [stats, skill] = await Promise.all([loadCareerStatistics("frontend-developer"), loadSkillContext("frontend-developer")]);
    const run = (years: number) =>
      calculateCareerMatch({ skill_ids: [], certification_ids: [], experiences: [{ role_id: "2513.5", years }], degree_id: null }, stats, skill, known);
    const oneYear = run(1);
    expect(oneYear.experience_match).toBeGreaterThanOrEqual(40);
    expect(oneYear.experience_match).toBeLessThanOrEqual(50);
    expect(oneYear.experience_goal_coverage).toBe(1);

    const values = [0.5, 1, 2, 3, 5, 10, 20].map((years) => run(years).experience_match!);
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
    expect(values.at(-1)).toBeLessThan(100);
  });

  it("Full-Stack の各 Group の統計は、単独 Goal（Frontend / Backend）の統計と同じ", async () => {
    const [fullStack, frontend, backend] = await Promise.all(
      ["full-stack-developer", "frontend-developer", "backend-developer"].map(loadCareerStatistics),
    );
    expect(fullStack.requirement_groups).toEqual([
      { ...frontend.requirement_groups[0], group_id: "frontend" },
      { ...backend.requirement_groups[0], group_id: "backend" },
    ]);
  });

  it("Full-Stack: 片方の Group の職業だけなら 50〜75、どちらも無ければ 50 以下、両方なら年数に応じて上がる", async () => {
    const known = await loadKnownIds();
    const [stats, skill] = await Promise.all([
      loadCareerStatistics("full-stack-developer"),
      loadSkillContext("full-stack-developer"),
    ]);
    const run = (experiences: { role_id: string; years: number }[]) =>
      calculateCareerMatch({ skill_ids: [], certification_ids: [], experiences, degree_id: null }, stats, skill, known);

    for (const experiences of [[{ role_id: "2513.5", years: 2 }], [{ role_id: "2512.4", years: 10 }]]) {
      const oneGroup = run(experiences);
      expect(oneGroup.experience_goal_coverage).toBe(0.5);
      expect(oneGroup.experience_match).toBeGreaterThanOrEqual(50);
      expect(oneGroup.experience_match).toBeLessThanOrEqual(75);
    }

    // どちらの Group も経験していなければ 50 以下
    for (const role_id of ["2514.2", "3512.1"]) {
      expect(run([{ role_id, years: 10 }]).experience_match).toBeLessThanOrEqual(50);
    }

    const both = run([{ role_id: "2512.5", years: 1 }, { role_id: "2512.4", years: 1 }]);
    expect(both.experience_match).toBeLessThan(100);
    expect(both.experience_goal_coverage).toBe(1);
    const bothLonger = run([{ role_id: "2512.5", years: 10 }, { role_id: "2512.4", years: 10 }]);
    expect(bothLonger.experience_match).toBeGreaterThan(both.experience_match!);
  });

  it("Frontend: 前職（ソフトウェア開発者）の経験年数が長いほど Experience は下がらない", async () => {
    const known = await loadKnownIds();
    const [stats, skill] = await Promise.all([loadCareerStatistics("frontend-developer"), loadSkillContext("frontend-developer")]);
    const values = [0.5, 1, 2, 3, 5, 10].map(
      (years) =>
        calculateCareerMatch({ skill_ids: [], certification_ids: [], experiences: [{ role_id: "2512.4", years }], degree_id: null }, stats, skill, known)
          .experience_match!,
    );
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    expect(values[0]).toBeGreaterThan(0);
  });

  it("Education: 最低教育要件（Frontend は学士）以上は 100", async () => {
    const stats = await loadCareerStatistics("frontend-developer");
    const known = await loadKnownIds();
    const skill = await loadSkillContext("frontend-developer");
    for (const degree_id of ["Bachelor", "Master", "PhD"]) {
      const result = calculateCareerMatch({ skill_ids: [], certification_ids: [], experiences: [], degree_id }, stats, skill, known);
      expect(result.education_match, degree_id).toBe(100);
    }
  });
});

const techIds = new Set((await loadTechSkills()).map((s) => s.skill_id));

async function requireSkillStatistics(goalId: string) {
  const stats = await loadSkillStatistics(goalId);
  if (!stats) throw new Error(`Skill statistics are missing: ${goalId}`);
  return stats;
}

describe("Skill Statistics（技術スキル層、Stack Overflow）", () => {
  // 読み込みはファイルが無いと null（人間定義層に fallback）になるため、デプロイ時の欠落はここで検知する
  it.each(goals.map((g) => [g.goal_id] as const))("%s: Skill Statistics のファイルがある", async (goalId) => {
    expect(await loadSkillStatistics(goalId)).not.toBeNull();
  });

  // ファイルがあっても採用 unit が 0 件なら、人間定義層 100% に静かに切り替わる。実データでは起きないことを固定する
  it.each(goals.map((g) => [g.goal_id] as const))("%s: 配分が fallback にならない", async (goalId) => {
    const [stats, skill, known] = await Promise.all([
      loadCareerStatistics(goalId),
      loadSkillContext(goalId),
      loadKnownIds(),
    ]);
    const result = calculateCareerMatch(
      { skill_ids: [], certification_ids: [], experiences: [], degree_id: null },
      stats,
      skill,
      known,
    );
    expect(result.skill_layer_weights.source).not.toBe("fallback");
    if (result.skill_layer_weights.tech > 0) {
      expect(result.skill_statistics_version).toMatch(/^stack_overflow_developer_survey:2023-2024-2025:\d+\.\d+\.\d+:k=[\d.]+$/);
    } else {
      expect(result.skill_statistics_version).toBeNull();
    }
  });

  it.each(goals.map((g) => [g.goal_id] as const))("%s: 採用 unit があり、メンバーは辞書の技術", async (goalId) => {
    const stats = await requireSkillStatistics(goalId);
    expect(stats.goal_id).toBe(goalId);
    const units = goalSkillUnits(stats);
    expect(units.length).toBeGreaterThan(0);
    for (const unit of units) {
      expect(unit.contribution).toBeGreaterThan(0);
      for (const member of unit.members) expect(techIds).toContain(member.skill_id);
    }
    const all = units.flatMap((u) => u.members.map((m) => m.skill_id));
    expect(weightedSkillProgress(stats, [])).toBe(0);
    expect(weightedSkillProgress(stats, all)).toBeCloseTo(100, 10);
  });

  it("Backend: PHP・Laravel・Ruby on Rails はサーバーサイドのグループを満たし、どれでも同じ点", async () => {
    const stats = await requireSkillStatistics("backend-developer");
    const php = weightedSkillProgress(stats, ["php"]);
    expect(php).toBeGreaterThan(0);
    expect(weightedSkillProgress(stats, ["python"])).toBe(php);
    const laravel = weightedSkillProgress(stats, ["laravel"]);
    expect(laravel).toBeGreaterThan(0);
    expect(weightedSkillProgress(stats, ["ruby-on-rails"])).toBe(laravel);
    expect(weightedSkillProgress(stats, ["spring-boot"])).toBe(laravel);
  });

  it.each(goals.map((g) => [g.goal_id] as const))("%s: 2 層の Skill Progress が 0〜100 で計算できる", async (goalId) => {
    const [techStats, goalLayers, master, humanSkills, certifications] = await Promise.all([
      requireSkillStatistics(goalId),
      loadGoalSkillLayers(goalId),
      loadSkillLayersMaster(),
      loadHumanSkills(),
      loadCertifications(),
    ]);
    const run = (skillIds: string[], certificationIds: string[] = []) =>
      layeredSkillProgress({
        held: heldSkillIds({ skillIds, certificationIds }, { humanSkills, certifications }),
        techStats,
        goalLayers,
        defaultWeights: master.default_layer_weights,
      });
    expect(run([]).progress).toBe(0);
    const everything = [
      ...goalSkillUnits(techStats).flatMap((u) => u.members.map((m) => m.skill_id)),
      ...normalizeHumanRequirements(goalLayers.human_requirements).flatMap((r) => r.any_of),
    ];
    expect(run(everything).progress).toBeCloseTo(100, 10);
  });

  it("IT PM: 人間定義層 100%。PMP でプロジェクト管理・リスク管理・ステークホルダー調整を満たす", async () => {
    const [techStats, goalLayers, master, humanSkills, certifications] = await Promise.all([
      requireSkillStatistics("it-project-manager"),
      loadGoalSkillLayers("it-project-manager"),
      loadSkillLayersMaster(),
      loadHumanSkills(),
      loadCertifications(),
    ]);
    const result = layeredSkillProgress({
      held: heldSkillIds({ skillIds: [], certificationIds: ["pmp"] }, { humanSkills, certifications }),
      techStats,
      goalLayers,
      defaultWeights: master.default_layer_weights,
    });
    expect(result.weights).toEqual({ tech: 0, human: 1, source: "goal" });
    expect(result.progress).toBeCloseTo((3 / goalLayers.human_requirements.length) * 100, 10);
  });

  it("Data Scientist: サーバーサイドの言語グループは使われず、PHP では Python の代わりにならない", async () => {
    const stats = await requireSkillStatistics("data-scientist");
    expect(stats.units.some((u) => u.unit_id === "server-language")).toBe(false);
    expect(weightedSkillProgress(stats, ["python"])).toBeGreaterThan(0);
    expect(weightedSkillProgress(stats, ["php"])).toBe(0);
  });
});
