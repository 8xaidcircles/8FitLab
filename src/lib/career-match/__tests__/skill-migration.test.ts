import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadSkillMigration, loadSkillNames } from "../data";
import { migrateLegacySkillIds, type SkillMigrationMapping } from "../skill-migration";

const mappings: SkillMigrationMapping[] = [
  { old_skill_id: "html", action: "merged", new_skill_ids: ["html-css"] },
  { old_skill_id: "css", action: "merged", new_skill_ids: ["html-css"] },
  { old_skill_id: "shell-script", action: "renamed", new_skill_ids: ["bash-shell"] },
  { old_skill_id: "cloud", action: "split", new_skill_ids: ["aws", "azure", "google-cloud"] },
  { old_skill_id: "iac", action: "split_and_human", new_skill_ids: ["terraform", "ansible"] },
  { old_skill_id: "testing", action: "human" },
  { old_skill_id: "vue", action: "same" },
];

describe("migrateLegacySkillIds", () => {
  it("renamed / merged は新しい ID に変換し、merged の重複は 1 つにまとめる", () => {
    expect(migrateLegacySkillIds(["html", "css", "shell-script"], mappings)).toEqual({
      skillIds: ["html-css", "bash-shell"],
      unresolved: [],
    });
  });

  it("same / human / split_and_human は同じ ID のまま（split_and_human は技術を推測しない）", () => {
    expect(migrateLegacySkillIds(["vue", "testing", "iac"], mappings).skillIds).toEqual(["vue", "testing", "iac"]);
  });

  it("split はどの技術か分からないため変換せず unresolved に分ける（過大評価しない）", () => {
    expect(migrateLegacySkillIds(["cloud", "vue"], mappings)).toEqual({ skillIds: ["vue"], unresolved: ["cloud"] });
  });

  it("新しい skill_id・ツール ID はそのまま", () => {
    expect(migrateLegacySkillIds(["html-css", "jest", "aws"], mappings).skillIds).toEqual(["html-css", "jest", "aws"]);
  });
});

describe("実データの移行", () => {
  it("split 以外の旧 skill_id は、変換後すべて新しいマスタに存在する", async () => {
    const [migration, names] = await Promise.all([loadSkillMigration(), loadSkillNames()]);
    const { skillIds, unresolved } = migrateLegacySkillIds(
      migration.map((m) => m.old_skill_id),
      migration,
    );
    expect(skillIds.filter((id) => !names.has(id))).toEqual([]);
    expect(unresolved.sort()).toEqual(
      migration
        .filter((m) => m.action === "split")
        .map((m) => m.old_skill_id)
        .sort(),
    );
  });

  it("マイグレーション SQL は renamed / merged をすべて変換する", async () => {
    const sql = await readFile(
      path.join(process.cwd(), "supabase", "migrations", "20260929_skill_layers.sql"),
      "utf-8",
    );
    for (const mapping of (await loadSkillMigration()).filter((m) => m.action === "renamed" || m.action === "merged")) {
      expect(sql, mapping.old_skill_id).toContain(`'${mapping.old_skill_id}'`);
      for (const newId of mapping.new_skill_ids ?? []) expect(sql, mapping.old_skill_id).toContain(`'${newId}'`);
    }
  });
});
