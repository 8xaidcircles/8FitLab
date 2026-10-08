// 基本リストの重みの割り引き（d*）の検証：統計フォルダごとに、代表的な入力での技術スキル層の達成率と内訳を比べる。
// 統計は scripts/compare_base_discount.py で一時フォルダに作る（data/statistics は上書きしない）。採点は skill-score.ts を使う。
//
//   node scripts/compare-base-discount.mjs <label>=<dir> [<label>=<dir> ...] > base-discount.md
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";

// Goal ごとの「中核」と「共通のみ」（共通 = 多くの開発者が使い、その職種を特徴づけない技術）
const PROFILES = {
  "software-architect": {
    中核: ["python", "postgresql", "docker", "aws", "kubernetes", "sql", "bash-shell"],
    共通のみ: ["javascript", "html-css", "react", "npm"],
  },
  "frontend-developer": { 中核: ["javascript", "html-css", "react", "npm"], 共通のみ: ["python", "sql", "docker"] },
  "backend-developer": {
    中核: ["java", "spring-boot", "postgresql", "docker", "aws"],
    共通のみ: ["javascript", "html-css", "react", "npm"],
  },
  "data-scientist": {
    中核: ["python", "pandas", "numpy", "scikit-learn", "jupyter"],
    共通のみ: ["sql", "postgresql", "docker", "aws"],
  },
  "full-stack-developer": {
    中核: ["javascript", "html-css", "react", "nodejs", "postgresql", "npm"],
    共通のみ: ["python", "docker", "aws"],
  },
  "data-analyst": { 中核: ["python", "pandas", "sql", "jupyter"], 共通のみ: ["javascript", "html-css", "docker"] },
  "data-engineer": {
    中核: ["python", "sql", "apache-spark", "aws", "docker", "postgresql"],
    共通のみ: ["javascript", "html-css", "npm"],
  },
  "mobile-app-developer": {
    中核: ["kotlin", "swift", "android-studio", "xcode"],
    共通のみ: ["javascript", "html-css", "sql"],
  },
  "devops-sre": {
    中核: ["docker", "kubernetes", "terraform", "aws", "bash-shell", "python"],
    共通のみ: ["javascript", "html-css", "sql"],
  },
  "cloud-architect": {
    中核: ["aws", "azure", "terraform", "docker", "kubernetes", "python"],
    共通のみ: ["javascript", "html-css", "sql"],
  },
  "it-project-manager": { 中核: ["sql", "python"], 共通のみ: ["javascript", "html-css", "npm"] },
  "product-manager": { 中核: ["sql", "python"], 共通のみ: ["javascript", "html-css"] },
  "network-engineer": { 中核: ["bash-shell", "python", "powershell"], 共通のみ: ["javascript", "html-css"] },
  "test-analyst": { 中核: ["python", "javascript", "java"], 共通のみ: ["sql", "html-css"] },
};
// 内訳の割合が極端に小さくないか確かめる、本来必要な技術
const ESSENTIAL = { "data-scientist": ["sql"], "frontend-developer": ["javascript"], "data-analyst": ["sql"], "backend-developer": ["sql"] };

const root = process.cwd();
const jiti = createJiti(pathToFileURL(path.join(root, "scripts", "compare-base-discount.mjs")).href);
const score = await jiti.import(path.join(root, "src/lib/career-match/skill-score.ts"));

const sets = process.argv.slice(2).map((arg) => {
  const [label, dir] = arg.split("=");
  return { label, dir };
});
if (sets.length === 0) {
  console.error("usage: node scripts/compare-base-discount.mjs <label>=<dir> [...]");
  process.exit(1);
}

async function loadDir(dir) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const entries = await Promise.all(files.map(async (f) => JSON.parse(await readFile(path.join(dir, f), "utf-8"))));
  return new Map(entries.map((s) => [s.goal_id, s]));
}
const loaded = await Promise.all(sets.map(async (s) => ({ ...s, stats: await loadDir(s.dir) })));
const goals = [...loaded[0].stats.keys()].sort();
const f1 = (v) => v.toFixed(1);
const out = [];

out.push("## 統計ごとの β・d*", "", `| 統計 | β | d* |`, "| --- | --- | --- |");
for (const s of loaded) {
  const any = s.stats.get(goals[0]);
  out.push(`| ${s.label} | ${any.selection.distinctive_share} | ${any.selection.base_discount_d_ref ?? "-"} |`);
}

out.push("", "## 不変条件 1・2：内訳の合計と採用 unit", "");
out.push(`| Goal | ${loaded.map((s) => `${s.label} 基本/特有/base_total/内訳の合計`).join(" | ")} |`);
out.push(`| --- | ${loaded.map(() => "---").join(" | ")} |`);
for (const goal of goals) {
  const cells = loaded.map((s) => {
    const stats = s.stats.get(goal);
    const units = score.goalSkillUnits(stats);
    const base = units.filter((u) => u.roles.includes("base")).length;
    const distinctive = units.filter((u) => u.roles.includes("distinctive")).length;
    const total = score.skillUnitGaps(stats, []).reduce((sum, g) => sum + g.share, 0);
    return `${base} / ${distinctive} / ${stats.skill_split.base_total.toFixed(3)} / ${f1(total)}`;
  });
  out.push(`| ${goal} | ${cells.join(" | ")} |`);
}

out.push("", "## 代表的な入力での技術スキル層の達成率", "");
out.push(`| Goal | 入力 | 技術 | ${loaded.map((s) => s.label).join(" | ")} |`);
out.push(`| --- | --- | --- | ${loaded.map(() => "---").join(" | ")} |`);
for (const goal of goals) {
  const profiles = {
    ...PROFILES[goal],
    何も持たない: [],
    採用unitすべて: score.goalSkillUnits(loaded[0].stats.get(goal)).flatMap((u) => u.members.map((m) => m.skill_id)),
  };
  for (const [name, ids] of Object.entries(profiles)) {
    const values = loaded.map((s) => {
      const stats = s.stats.get(goal);
      const all = score.goalSkillUnits(stats).flatMap((u) => u.members.map((m) => m.skill_id));
      return f1(score.weightedSkillProgress(stats, name === "採用unitすべて" ? all : ids));
    });
    const label = name === "採用unitすべて" ? "(全メンバー)" : ids.join(", ") || "-";
    out.push(`| ${goal} | ${name} | ${label} | ${values.join(" | ")} |`);
  }
}

out.push("", "## 本来必要な技術の内訳の割合（%）", "");
out.push(`| Goal | 技術 | ${loaded.map((s) => s.label).join(" | ")} |`);
out.push(`| --- | --- | ${loaded.map(() => "---").join(" | ")} |`);
for (const [goal, ids] of Object.entries(ESSENTIAL)) {
  for (const id of ids) {
    const values = loaded.map((s) => {
      const gap = score.skillUnitGaps(s.stats.get(goal), []).find((g) => g.unit.members.some((m) => m.skill_id === id));
      return gap ? f1(gap.share) : "(採用外)";
    });
    out.push(`| ${goal} | ${id} | ${values.join(" | ")} |`);
  }
}

out.push("", "## 内訳の割合が 1% 未満の採用 unit（最後の統計）", "");
const last = loaded[loaded.length - 1];
for (const goal of goals) {
  const small = score
    .skillUnitGaps(last.stats.get(goal), [])
    .filter((g) => g.share < 1)
    .map((g) => `${g.unit.unit_id}(${g.unit.roles.join("+")} ${g.share.toFixed(2)})`);
  if (small.length) out.push(`- ${goal}: ${small.join(", ")}`);
}

process.stdout.write(`${out.join("\n")}\n`);
