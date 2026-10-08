// 保存済みの Assessment を、現在の計算コードと統計で再計算して career_match_results を上書きする。
// 入力（スキル・資格・職歴・学歴）と Learning Path の結果は変えない。
//
//   node scripts/system-ca.mjs --env-file=.env.local scripts/recompute-career-match.mjs           # 書き込まずに差分だけ表示
//   node scripts/system-ca.mjs --env-file=.env.local scripts/recompute-career-match.mjs --apply   # 上書きする
//
// 先に supabase/migrations/20261007_experience_calculation_version.sql を実行しておくこと。
// 何度実行しても結果は同じ（同じコード・統計なら同じ値で上書きする）。
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { createJiti } from "jiti";

const PAGE_SIZE = 500;
const apply = process.argv.includes("--apply");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SECRET_KEY が必要です（--env-file=.env.local）");
  process.exit(1);
}
const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const root = process.cwd();
const jiti = createJiti(pathToFileURL(path.join(root, "scripts", "recompute-career-match.mjs")).href);
const calc = await jiti.import(path.join(root, "src/lib/career-match/calculate.ts"));
const data = await jiti.import(path.join(root, "src/lib/career-match/data.ts"));

const known = await data.loadKnownIds();
const contexts = new Map();
async function goalContext(goalId) {
  if (!contexts.has(goalId)) {
    contexts.set(
      goalId,
      Promise.all([data.loadCareerStatistics(goalId), data.loadSkillContext(goalId)]).then(([stats, skill]) => ({ stats, skill })),
    );
  }
  return contexts.get(goalId);
}

async function* sessions() {
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rows, error } = await supabase
      .from("assessment_sessions")
      .select(
        "id, goal_id, assessment_skills(skill_id), assessment_certifications(cert_id), assessment_experiences(role_id, years), assessment_education(degree_id), career_match_results(goal_match, experience_match, experience_calculation_version)",
      )
      .order("created_at")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to load assessments: ${error.message}`);
    yield* rows;
    if (rows.length < PAGE_SIZE) return;
  }
}

const one = (value) => (Array.isArray(value) ? (value[0] ?? null) : value);
const fmt = (value) => (value === null || value === undefined ? "-" : Number(value).toFixed(1));

let total = 0;
let updated = 0;
const skipped = [];
const changes = [];

for await (const session of sessions()) {
  total++;
  const stored = one(session.career_match_results);
  if (!stored) {
    skipped.push(`${session.id}: career_match_results がない`);
    continue;
  }

  let result;
  try {
    const { stats, skill } = await goalContext(session.goal_id);
    const input = {
      skill_ids: session.assessment_skills.map((r) => r.skill_id),
      certification_ids: session.assessment_certifications.map((r) => r.cert_id),
      experiences: session.assessment_experiences.map((r) => ({ role_id: r.role_id, years: Number(r.years) })),
      degree_id: one(session.assessment_education)?.degree_id ?? null,
    };
    result = calc.calculateCareerMatch(input, stats, skill, known);
  } catch (error) {
    skipped.push(`${session.id}: ${error.message}`);
    continue;
  }

  changes.push({
    id: session.id,
    goal_id: session.goal_id,
    before: Number(stored.goal_match),
    after: result.goal_match,
    experienceBefore: stored.experience_match === null ? null : Number(stored.experience_match),
    experienceAfter: result.experience_match,
  });
  if (!apply) continue;

  const { error: resultError } = await supabase
    .from("career_match_results")
    .update({
      goal_match: result.goal_match,
      skill_match: result.skill_match,
      experience_match: result.experience_match,
      experience_calculation_version: result.experience_calculation_version,
      education_match: result.education_match,
      evidence_mode: result.evidence_mode,
      confidence: result.confidence,
      goal_sample_size: result.goal_sample_size,
      calculation_version: result.calculation_version,
      data_source_version: result.data_source_version,
      taxonomy_version: result.taxonomy_version,
      skill_calculation_version: result.skill_calculation_version,
      skill_statistics_version: result.skill_statistics_version,
      skill_progress: result.skill_progress,
      tech_skill_progress: result.tech_skill_progress,
      human_skill_progress: result.human_skill_progress,
      skill_weight_tech: result.skill_layer_weights.tech,
      skill_weight_human: result.skill_layer_weights.human,
      skill_weight_source: result.skill_layer_weights.source,
      skill_scoring_method: result.skill_scoring_method,
      skill_distribution_sample_size: result.skill_distribution_sample_size,
      skill_distribution_version: result.skill_distribution_version,
    })
    .eq("assessment_id", session.id);
  if (resultError) {
    skipped.push(`${session.id}: career_match_results の更新に失敗（${resultError.message}）`);
    continue;
  }
  const { error: sessionError } = await supabase
    .from("assessment_sessions")
    .update({
      calculation_version: result.calculation_version,
      data_source_version: result.data_source_version,
      taxonomy_version: result.taxonomy_version,
    })
    .eq("id", session.id);
  if (sessionError) {
    skipped.push(`${session.id}: assessment_sessions の更新に失敗（${sessionError.message}）`);
    continue;
  }
  updated++;
}

const deltas = changes.map((c) => c.after - c.before);
const changed = deltas.filter((d) => Math.abs(d) >= 0.05);
console.log(`${apply ? "上書き" : "確認のみ（--apply で上書き）"}: Assessment ${total} 件`);
console.log(`  再計算できた ${changes.length} 件 / 点数が変わる ${changed.length} 件 / 上がる ${changed.filter((d) => d > 0).length} 件 / 下がる ${changed.filter((d) => d < 0).length} 件`);
if (deltas.length > 0) {
  console.log(`  差の範囲 ${fmt(Math.min(...deltas))} 〜 ${fmt(Math.max(...deltas))}`);
}
if (apply) console.log(`  上書きした ${updated} 件`);

const largest = [...changes].sort((a, b) => Math.abs(b.after - b.before) - Math.abs(a.after - a.before)).slice(0, 10);
if (largest.length > 0) {
  console.log("差が大きい Assessment（最大 10 件）:");
  for (const c of largest) {
    console.log(
      `  ${c.id} ${c.goal_id}: Goal Fit ${fmt(c.before)} → ${fmt(c.after)}（Experience ${fmt(c.experienceBefore)} → ${fmt(c.experienceAfter)}）`,
    );
  }
}
if (skipped.length > 0) {
  console.log(`再計算・上書きできなかった ${skipped.length} 件:`);
  for (const line of skipped) console.log(`  ${line}`);
  process.exitCode = 1;
}
