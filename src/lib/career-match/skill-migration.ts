export type SkillMigrationAction = "same" | "renamed" | "merged" | "split" | "split_and_human" | "human";

export interface SkillMigrationMapping {
  old_skill_id: string;
  action: SkillMigrationAction;
  new_skill_ids?: string[];
  human_domain?: string;
}

export interface MigratedSkillIds {
  skillIds: string[];
  /** 移行先を 1 つに決められない旧 skill_id（split）。どの技術かが分からないため、計算には使わない */
  unresolved: string[];
}

// 保存済みの旧 skill_id を新しい skill_id に変換する。
// renamed / merged は新しい ID へ、same / human / split_and_human は同じ ID のまま（split_and_human は人間定義層の概念のみ）。
// split は「どれを持っていたか」が分からないため変換しない（過大評価しない）
export function migrateLegacySkillIds(
  skillIds: Iterable<string>,
  mappings: readonly SkillMigrationMapping[],
): MigratedSkillIds {
  const byOldId = new Map(mappings.map((m) => [m.old_skill_id, m]));
  const migrated = new Set<string>();
  const unresolved: string[] = [];
  for (const id of skillIds) {
    const mapping = byOldId.get(id);
    if (mapping?.action === "split") {
      unresolved.push(id);
    } else if (mapping?.action === "renamed" || mapping?.action === "merged") {
      for (const newId of mapping.new_skill_ids ?? []) migrated.add(newId);
    } else {
      migrated.add(id);
    }
  }
  return { skillIds: [...migrated], unresolved };
}
