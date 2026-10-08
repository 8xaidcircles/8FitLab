// Goal Fit の計算方式を変えたときに、代表的な入力 × 14 Goal の点数を変更前後で比べる。
//
//   node scripts/compare-scoring-models.mjs snapshot <out.json>
//     作業ディレクトリ（process.cwd()）の計算コードとデータで点数を出して保存する
//   node scripts/compare-scoring-models.mjs compare <before.json> <after.json> > scoring-comparison.csv
//     2 つの snapshot を並べた CSV を出す
//
// 変更前の snapshot は、変更前のコミットを git worktree で取り出し、そのディレクトリで snapshot を実行して作る。
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createJiti } from "jiti";

const PATTERNS = [
  {
    id: "r-web-0.5-junior-college",
    label: "R / Web開発者 0.5年 / 短大",
    input: { skill_ids: ["r"], experiences: [{ role_id: "2513.5", years: 0.5 }], degree_id: "Secondary school" },
  },
  {
    id: "python-web-0.5-junior-college",
    label: "Python / Web開発者 0.5年 / 短大",
    input: { skill_ids: ["python"], experiences: [{ role_id: "2513.5", years: 0.5 }], degree_id: "Secondary school" },
  },
  {
    id: "python-stack-web-2-bachelor",
    label: "Python・pandas・NumPy・Jupyter・SQL / Web開発者 2年 / 学士",
    input: {
      skill_ids: ["python", "pandas", "numpy", "jupyter", "sql"],
      experiences: [{ role_id: "2513.5", years: 2 }],
      degree_id: "Bachelor",
    },
  },
  {
    id: "js-swdev-3-bachelor",
    label: "JavaScript・HTML/CSS・React / ソフトウェア開発者 3年 / 学士",
    input: {
      skill_ids: ["javascript", "html-css", "react"],
      experiences: [{ role_id: "2512.4", years: 3 }],
      degree_id: "Bachelor",
    },
  },
  {
    id: "none-sales-5-highschool",
    label: "スキルなし / 販売員 5年 / 高卒",
    input: { skill_ids: [], experiences: [{ role_id: "5223.4", years: 5 }], degree_id: "Secondary school" },
  },
  {
    id: "none-goal-1-bachelor",
    label: "スキルなし / Goal の職業 1年 / 学士",
    input: { skill_ids: [], experiences: "goal-occupation-1", degree_id: "Bachelor" },
  },
  {
    id: "kotlin-only",
    label: "Kotlin のみ / 経験なし / 学士",
    input: { skill_ids: ["kotlin"], experiences: [], degree_id: "Bachelor" },
  },
  {
    id: "java-only",
    label: "Java のみ / 経験なし / 学士",
    input: { skill_ids: ["java"], experiences: [], degree_id: "Bachelor" },
  },
];

async function snapshot(out) {
  const root = process.cwd();
  const jiti = createJiti(pathToFileURL(path.join(root, "scripts", "compare-scoring-models.mjs")).href);
  const calc = await jiti.import(path.join(root, "src/lib/career-match/calculate.ts"));
  const data = await jiti.import(path.join(root, "src/lib/career-match/data.ts"));
  const [goals, known] = await Promise.all([data.loadGoals(), data.loadKnownIds()]);

  const rows = [];
  for (const goal of goals) {
    const [stats, skill] = await Promise.all([data.loadCareerStatistics(goal.goal_id), data.loadSkillContext(goal.goal_id)]);
    for (const pattern of PATTERNS) {
      const input = {
        certification_ids: [],
        ...pattern.input,
        experiences:
          pattern.input.experiences === "goal-occupation-1"
            ? stats.requirement_groups.map((g) => ({ role_id: g.occupations[0], years: 1 }))
            : pattern.input.experiences,
      };
      const r = calc.calculateCareerMatch(input, stats, skill, known);
      rows.push({
        pattern: pattern.id,
        label: pattern.label,
        goal_id: goal.goal_id,
        goal_name: goal.name,
        goal_match: r.goal_match,
        skill_match: r.skill_match,
        experience_match: r.experience_match,
        education_match: r.education_match,
      });
    }
  }
  await writeFile(out, JSON.stringify(rows, null, 1), "utf-8");
  console.error(`wrote ${rows.length} rows to ${out}`);
}

async function compare(beforePath, afterPath) {
  const [before, after] = await Promise.all([beforePath, afterPath].map(async (p) => JSON.parse(await readFile(p, "utf-8"))));
  const key = (r) => `${r.pattern}|${r.goal_id}`;
  const beforeByKey = new Map(before.map((r) => [key(r), r]));
  const fmt = (v) => (v === null || v === undefined ? "" : v.toFixed(1));
  const csv = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const lines = [
    [
      "入力パターン", "職種", "修正前 Goal Fit", "修正後 Goal Fit", "差",
      "修正前 Skill", "修正後 Skill", "修正前 Experience", "修正後 Experience", "Education",
    ].join(","),
  ];
  for (const a of after) {
    const b = beforeByKey.get(key(a));
    if (!b) continue;
    lines.push(
      [
        csv(a.label), csv(a.goal_name), fmt(b.goal_match), fmt(a.goal_match), fmt(a.goal_match - b.goal_match),
        fmt(b.skill_match), fmt(a.skill_match), fmt(b.experience_match), fmt(a.experience_match), fmt(a.education_match),
      ].join(","),
    );
  }
  process.stdout.write(`\uFEFF${lines.join("\n")}\n`);
}

const [mode, ...args] = process.argv.slice(2);
if (mode === "snapshot" && args.length === 1) await snapshot(args[0]);
else if (mode === "compare" && args.length === 2) await compare(args[0], args[1]);
else {
  console.error("usage: node scripts/compare-scoring-models.mjs snapshot <out.json> | compare <before.json> <after.json>");
  process.exit(1);
}
