import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBar, ScoreRing } from "@/components/score-ring";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import {
  goalSkillUnits,
  humanRequirementStatus,
  learningPath,
  loadEducation,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadRoleGroups,
  loadRoles,
  loadSkillContext,
  loadSkillNames,
  normalizeHumanRequirements,
  resolveUserSkills,
  skillGap,
  skillMatchScope,
  skillUnitGaps,
} from "@/lib/career-match";
import { SKIPPED_EDUCATION_LEVEL_ID } from "@/lib/career-match/types";
import { EXPERIENCE_STATUS_LABELS, formatPercent } from "@/lib/labels";
import { LearningSteps } from "@/components/learning-steps";

export const metadata: Metadata = {
  title: "Goal Fitの診断結果",
  robots: { index: false },
};

function CategoryCard({
  title,
  value,
  source,
  description,
  notes = [],
}: {
  title: string;
  value: number | null;
  source: string;
  description: string;
  notes?: string[];
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-bold">{title}</h3>
        {value === null ? (
          <span className="text-sm font-bold text-muted">統計なし</span>
        ) : (
          <span className="text-2xl font-extrabold text-indigo">
            {formatPercent(value)}
            <span className="text-xs text-muted"> / 100</span>
          </span>
        )}
      </div>
      {value !== null && (
        <div className="mt-3">
          <ScoreBar value={value} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{source}</p>
      <p className="mt-2 text-sm leading-relaxed text-ink">{description}</p>
      {notes.map((note) => (
        <p key={note} className="mt-2 rounded-lg bg-sky-soft px-3 py-2 text-xs leading-relaxed text-ink">
          {note}
        </p>
      ))}
    </div>
  );
}

export default async function ResultPage({ params }: PageProps<"/goal-fit/result/[id]">) {
  const { id } = await params;
  const anonymousUserId = await getAnonymousUserId();
  if (!isUuid(id) || !anonymousUserId) notFound();

  const assessment = await getAssessment(id, anonymousUserId);
  if (!assessment) notFound();

  const [goals, path, skillNames, known, skillContext, roles, roleGroups, education] = await Promise.all([
    loadGoals(),
    loadLearningPath(assessment.goal_id),
    loadSkillNames(),
    loadKnownIds(),
    loadSkillContext(assessment.goal_id),
    loadRoles(),
    loadRoleGroups(),
    loadEducation(),
  ]);
  const goal = goals.find((g) => g.goal_id === assessment.goal_id)!;
  const match = assessment.career_match;
  const skillName = (id: string) => skillNames.get(id) ?? id;
  const jaRoleNames = new Map(roleGroups.flatMap((g) => g.roles.map((r) => [r.role_id, r.name])));
  const roleName = (roleId: string) => jaRoleNames.get(roleId) ?? roles.find((r) => r.role_id === roleId)?.label ?? roleId;

  const { held } = resolveUserSkills(
    { skill_ids: assessment.skill_ids, certification_ids: assessment.certification_ids },
    skillContext,
    known,
  );
  // 現在の定義で、Skill Match に効く skill_id（配分と Skill Gap の分類に使う）
  const scope = skillMatchScope({
    techStats: skillContext.techStats,
    goalLayers: skillContext.goalLayers,
    defaultWeights: skillContext.defaultWeights,
  });
  const gap = skillGap(path, held, scope.skillIds);
  const missingDataDriven = gap.data_driven.filter((s) => !s.satisfied).length;
  const missingChecklist = gap.checklist.filter((s) => !s.satisfied).length;

  // 学習ロードマップのページへの案内文を、未習得の Step の有無で切り替える
  const missingSteps = learningPath(path, held);

  const certificationNames = skillContext.certifications
    .filter((c) => assessment.certification_ids.includes(c.cert_id))
    .map((c) => c.name);
  const techGaps =
    skillContext.techStats && goalSkillUnits(skillContext.techStats).length > 0
      ? skillUnitGaps(skillContext.techStats, held)
      : [];
  const humanRequirements = humanRequirementStatus(
    normalizeHumanRequirements(skillContext.goalLayers.human_requirements),
    held,
  );
  // 「Skill の内訳」は保存した入力を現在の定義で判定する。スコアと配分は保存時の値（再計算しない）
  const currentWeights = scope.weights;
  const showTech = currentWeights.tech > 0;
  const showHuman = currentWeights.human > 0;
  const percent = (w: number) => `${Math.round(w * 100)}%`;

  const stored = match.skill;
  const skillSource = stored
    ? [
        stored.skill_layer_weights.tech > 0 &&
          `技術 ${formatPercent(stored.tech_skill_progress ?? 0)}（配分 ${percent(stored.skill_layer_weights.tech)}）`,
        stored.skill_layer_weights.human > 0 &&
          `手法・知識 ${formatPercent(stored.human_skill_progress ?? 0)}（配分 ${percent(stored.skill_layer_weights.human)}）`,
      ]
        .filter(Boolean)
        .join(" ＋ ")
    : "旧方式（8FitLabの学習ステップの達成率）で計算した結果です";
  const skillDescription = `目標ポジションで求められる技術やスキルの保有状況です。不足しているスキルを習得することでスコアが上がります。${
    certificationNames.length > 0 ? " 保有資格によるスキル証明を含んでいます。" : ""
  }`;
  const skillNotes =
    assessment.legacy_skill_ids.length > 0
      ? [
          "以前の入力のうち、具体的な技術が分からない項目（例：「クラウド」）は計算に含めていません。もう一度計算するときに具体的な技術を選んでください。",
        ]
      : [];
  const level = education.levels.find((l) => l.level_id === assessment.education_level_id);
  const experienceSource =
    assessment.experiences.length > 0
      ? assessment.experiences.map((e) => `${roleName(e.role_id)} ${e.years}年`).join("、")
      : assessment.experience_status === "skipped"
        ? "回答をスキップ"
        : assessment.experience_status === "none"
          ? EXPERIENCE_STATUS_LABELS.none
          : "職歴の入力なし";
  const experienceNotes =
    match.experience_match === null
      ? []
      : assessment.experience_status === "skipped"
        ? ["職歴の回答をスキップしたため、実務経験の適合度は参考値です。"]
        : assessment.experience_status === "none"
          ? ["実務経験がないため、経験面での適合度は 0 です。未経験からの転職では、スキル習得が成功の鍵になります。"]
          : [];
  const educationNotes =
    match.education_match !== null && assessment.education_level_id === SKIPPED_EDUCATION_LEVEL_ID
      ? ["学歴の回答をスキップしたため、教育面での適合度は参考値です。"]
      : [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/goal-fit/result", goal_id: goal.goal_id }} />
      <TrackView event="skill_gap_viewed" data={{ assessment_id: id, goal_id: goal.goal_id, missing: missingDataDriven + missingChecklist }} />

      <p className="text-sm font-bold text-sky">Goal Fit</p>
      <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{goal.name}との一致度</h1>

      <section className="mt-6 grid items-center gap-8 rounded-3xl border border-line bg-white p-6 md:grid-cols-[auto_1fr] md:p-8">
        <div className="mx-auto">
          <ScoreRing value={match.goal_match} />
        </div>
        <div>
          <p className="text-sm font-bold text-muted">Goal Fit</p>
          <p className="mt-2 leading-relaxed">
            スキル・職歴・学歴を総合的に評価した、目標ポジションとの適合度です。
            {match.evidence_mode === "skill_only" &&
              "このGoalは職歴・学歴の統計を算出できないため、スキルのみで算出しています。"}
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <CategoryCard
          title="Skill"
          value={match.skill_match}
          source={skillSource}
          description={skillDescription}
          notes={skillNotes}
        />
        <CategoryCard
          title="Experience"
          value={match.experience_match}
          source={experienceSource}
          description="これまでの実務経験や関連職種での実績に基づく適合度です。"
          notes={experienceNotes}
        />
        <CategoryCard
          title="Education"
          value={match.education_match}
          source={level?.level_id === SKIPPED_EDUCATION_LEVEL_ID ? "回答をスキップ" : level ? level.name : "学歴の入力なし"}
          description="目標ポジションに就いている人々の学歴傾向に対する適合度です。"
          notes={educationNotes}
        />
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-extrabold">Skill の内訳</h2>
        <p className="mt-1 text-sm text-muted">
          現在のスキル定義で、今の入力が満たしている項目です。満たしていない項目を習得すると Skill が上がります。
        </p>
        <div className={`mt-5 grid gap-4 ${showTech && showHuman ? "md:grid-cols-2" : ""}`}>
          {showTech && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-bold">技術（配分 {percent(currentWeights.tech)}）</h3>
              <p className="mt-1 text-xs text-muted">右の数字は、満たすと技術の達成率が上がる割合です。</p>
              <ul className="mt-3 space-y-2 text-sm">
                {techGaps.map(({ unit, satisfied, share }) => (
                  <li key={unit.unit_id} className="flex items-start gap-2">
                    <span className={satisfied ? "text-cyan" : "text-flame"} aria-hidden="true">
                      {satisfied ? "✓" : "・"}
                    </span>
                    <span className="flex-1">
                      <span className={satisfied ? "font-bold" : ""}>{unit.name}</span>
                      {unit.type === "group" && (
                        <span className="block text-xs text-muted">
                          {unit.members
                            .slice(0, 5)
                            .map((m) => m.name)
                            .join(" / ")}
                          {unit.members.length > 5 && " ほか"}（どれか1つ）
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-muted">{share.toFixed(1)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showHuman && (
            <div className="rounded-2xl border border-line bg-white p-5">
              <h3 className="font-bold">手法・知識（配分 {percent(currentWeights.human)}）</h3>
              <p className="mt-1 text-xs text-muted">各項目を同じ重さで数えています。</p>
              <ul className="mt-3 space-y-2 text-sm">
                {humanRequirements.map((r) => (
                  <li key={r.requirement_id} className="flex items-start gap-2">
                    <span className={r.satisfied ? "text-cyan" : "text-flame"} aria-hidden="true">
                      {r.satisfied ? "✓" : "・"}
                    </span>
                    <span className="flex-1">
                      <span className={r.satisfied ? "font-bold" : ""}>{r.name ?? skillName(r.any_of[0])}</span>
                      {r.any_of.length > 1 && (
                        <span className="block text-xs text-muted">
                          {r.any_of.map(skillName).join(" / ")}（どれか1つ）
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-xl font-extrabold">Skill Gap と Learning Path</h2>
            <p className="mt-1 text-sm text-muted">
              {missingDataDriven + missingChecklist === 0
                ? "すべての学習ステップを習得済みです。"
                : `未習得のステップが ${missingDataDriven + missingChecklist} つあります。それぞれ上から順に学ぶのがおすすめです。`}
              現在の学習ステップの定義で判定しています。
            </p>
          </div>
          <Link
            href={`/goal-fit/result/${id}/learning-path`}
            className="group inline-block rounded-full p-[3px] shadow-md transition hover:shadow-lg"
            style={{
              backgroundImage: "linear-gradient(90deg, #e84545, #f27035, #f2e26e, #8ee8c8, #22c3e0, #38a6f2, #2b3192, #a855f7)",
            }}
          >
            <span className="block rounded-full bg-white px-5 py-2.5 text-sm font-extrabold text-indigo transition group-hover:bg-indigo-soft">
              {missingSteps.length > 0 ? "学習ロードマップとおすすめ教材を見る →" : "おすすめの転職サービスを見る →"}
            </span>
          </Link>
        </div>

        {gap.data_driven.length > 0 && (
          <div className="mt-6">
            <h3 className="font-bold">Skillに反映されるステップ（未習得 {missingDataDriven}）</h3>
            <p className="mt-1 text-xs text-muted">習得すると Skill が上がります。</p>
            <LearningSteps
              goalId={goal.goal_id}
              assessmentId={id}
              steps={gap.data_driven.map((s) => ({
                step_id: s.step_id,
                learning_order: s.learning_order,
                name: s.name,
                satisfied: s.satisfied,
                options: s.any_of.map((skillId) => ({
                  skill_id: skillId,
                  name: skillName(skillId),
                  owned: held.has(skillId),
                  scored: s.scored_options.includes(skillId),
                })),
              }))}
            />
          </div>
        )}

        {gap.checklist.length > 0 && (
          <div className="mt-8">
            <h3 className="font-bold">前提・基本要件のチェックリスト（未習得 {missingChecklist}）</h3>
            <p className="mt-1 text-xs text-muted">
              仕事や学習を進めるうえで前提になる項目です。Skillの計算には含めていません（調査データでこのGoalに特徴的とは判定されなかった技術と、配分のない手法・知識）。
            </p>
            <LearningSteps
              goalId={goal.goal_id}
              assessmentId={id}
              trackView={gap.data_driven.length === 0}
              steps={gap.checklist.map((s) => ({
                step_id: s.step_id,
                learning_order: s.learning_order,
                name: s.name,
                satisfied: s.satisfied,
                options: s.any_of.map((skillId) => ({
                  skill_id: skillId,
                  name: skillName(skillId),
                  owned: held.has(skillId),
                })),
              }))}
            />
          </div>
        )}
      </section>

      <div className="mt-10 text-center">
        <Link
          href={`/goal-fit?goal=${goal.goal_id}`}
          className="inline-block rounded-full border border-line bg-white px-6 py-3 text-sm font-bold text-indigo hover:border-sky"
        >
          入力を変えてもう一度計算する
        </Link>
      </div>

    </div>
  );
}
