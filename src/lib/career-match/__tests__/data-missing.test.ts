import { describe, expect, it, vi } from "vitest";
import { calculateCareerMatch } from "../calculate";
import { loadCareerStatistics, loadKnownIds, loadSkillContext, loadSkillStatistics } from "../data";

// 技術スキル統計のファイルが無い（ENOENT）・読めない（EACCES）状態を再現する
vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs/promises")>();
  const fail = (code: string) => Promise.reject(Object.assign(new Error(code), { code }));
  return {
    ...actual,
    readFile: vi.fn((file: string, options: BufferEncoding) => {
      if (/skill-match[\\/](it-project-manager|data-analyst)\.json$/.test(String(file))) return fail("ENOENT");
      if (/skill-match[\\/]network-engineer\.json$/.test(String(file))) return fail("EACCES");
      return actual.readFile(file, options);
    }),
  };
});

describe("技術スキル統計のファイルが無い Goal", () => {
  it("loadSkillStatistics は null を返す", async () => {
    expect(await loadSkillStatistics("it-project-manager")).toBeNull();
  });

  it("ファイルが無い以外の読み込みエラーはそのまま投げる", async () => {
    await expect(loadSkillStatistics("network-engineer")).rejects.toThrow("EACCES");
  });

  it("技術層 100% の Goal でも計算は止まらず、人間定義層 100% に寄せる（fallback）", async () => {
    const [stats, skill, known] = await Promise.all([
      loadCareerStatistics("data-analyst"),
      loadSkillContext("data-analyst"),
      loadKnownIds(),
    ]);
    expect(skill.techStats).toBeNull();
    const result = calculateCareerMatch(
      { skill_ids: ["sql"], certification_ids: [], experiences: [], degree_id: null },
      stats,
      skill,
      known,
    );
    expect(result.tech_skill_progress).toBeNull();
    expect(result.skill_layer_weights).toEqual({ tech: 0, human: 1, source: "fallback" });
    expect(result.skill_progress).toBe(result.human_skill_progress);
  });

  it("人間定義層 100% の Goal は配分どおり（fallback にしない）", async () => {
    const [stats, skill, known] = await Promise.all([
      loadCareerStatistics("it-project-manager"),
      loadSkillContext("it-project-manager"),
      loadKnownIds(),
    ]);
    const result = calculateCareerMatch(
      { skill_ids: [], certification_ids: ["pmp"], experiences: [], degree_id: null },
      stats,
      skill,
      known,
    );
    expect(result.skill_layer_weights).toEqual({ tech: 0, human: 1, source: "goal" });
    expect(result.skill_match).toBeGreaterThan(0);
  });
});
