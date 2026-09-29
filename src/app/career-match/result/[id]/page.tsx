import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBar, ScoreRing } from "@/components/score-ring";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import {
  COMPOSITE_UNMET_GROUP_CAP,
  goalOccupations,
  goalSkillUnits,
  humanRequirementStatus,
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
  satisfiedGroupIds,
  skillGap,
  skillMatchScope,
  skillUnitGaps,
} from "@/lib/career-match";
import { CONFIDENCE_LABELS, EVIDENCE_LABELS, SKILL_LAYER_WEIGHT_SOURCE_LABELS, formatPercent } from "@/lib/labels";
import { LearningSteps } from "@/components/learning-steps";
import { STACK_OVERFLOW_SURVEY } from "@/lib/site";

export const metadata: Metadata = {
  title: "Career Matchの結果",
  robots: { index: false },
};

function CategoryCard({
  title,
  value,
  source,
  notes = [],
}: {
  title: string;
  value: number | null;
  source: string;
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
      {notes.map((note) => (
        <p key={note} className="mt-2 rounded-lg bg-sky-soft px-3 py-2 text-xs leading-relaxed text-ink">
          {note}
        </p>
      ))}
    </div>
  );
}

export default async function ResultPage({ params }: PageProps<"/career-match/result/[id]">) {
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
  const skillNotes = stored
    ? [
        `技術はStack Overflow Developer Surveyで、このGoalの人に特徴的な技術を重要度で重み付けしています（${SKILL_LAYER_WEIGHT_SOURCE_LABELS[stored.skill_layer_weights.source]}）。`,
        ...(certificationNames.length > 0 ? [`資格（${certificationNames.join("、")}）が証明するスキルも含めています。`] : []),
      ]
    : ["もう一度計算すると、現在の方式（技術 × 手法・知識の2層）で算出します。"];
  if (assessment.legacy_skill_ids.length > 0) {
    skillNotes.push(
      "以前の入力のうち、具体的な技術が分からない項目（例：「クラウド」）は計算に含めていません。もう一度計算するときに具体的な技術を選んでください。",
    );
  }
  const level = education.levels.find((l) => l.level_id === assessment.education_level_id);
  const field = education.fields.find((f) => f.field_id === assessment.field_id);

  const statsNotes: string[] = [];
  if (match.evidence_mode === "proxy") {
    statsNotes.push(
      `このGoalの職業はデータに直接存在しないため、職務内容が近い職業（${goalOccupations(goal)
        .map((o) => roleName(o.code))
        .join("、")}）の統計を代わりに使用しています。`,
    );
  }
  if (match.goal_sample_size > 0 && match.goal_sample_size < 100) {
    statsNotes.push(`統計の母数が少ない（N = ${match.goal_sample_size}）ため、解釈には注意が必要です。`);
  }
  const groups = goal.requirement_groups;
  const satisfied = satisfiedGroupIds(
    groups.map((g) => ({ group_id: g.group_id, occupations: g.occupations.map((o) => o.code) })),
    assessment.experiences,
  );
  const groupNames = (met: boolean) => groups.filter((g) => satisfied.has(g.group_id) === met).map((g) => g.name).join("・");
  const compositeNote = `このGoalは${groups.map((g) => g.name).join("と")}の達成率の平均で、両方の経験があって100になります（${groups
    .map((g) => `${g.name}：${g.occupations.map((o) => roleName(o.code)).join(" または ")}`)
    .join("、")}）。経験していない側の達成率は、前職経験の統計から最大${COMPOSITE_UNMET_GROUP_CAP}まで評価します。`;
  const statisticalNote =
    "このGoalに就いた人が、Goalに就く前にどんな職種を何年経験していたかと比べています。上位10%の人と同程度の前職経験で100になります。";
  const experienceNotes =
    satisfied.size === groups.length
      ? ["このGoalの職業そのものの経験があるため、すでにGoalに到達しているとみなして100としています。"]
      : [
          ...(groups.length > 1 ? [compositeNote] : []),
          ...(satisfied.size > 0
            ? [
                `${groupNames(true)}は経験済みのため100、${groupNames(false)}は前職経験の統計から達成率を出し、平均しています。`,
              ]
            : []),
          statisticalNote,
        ];
  const educationNotes = [
    "このGoalに就いた人に最も多く、特徴的な学歴を100としています。",
    ...(level?.mapping_note ? [level.mapping_note] : []),
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/career-match/result", goal_id: goal.goal_id }} />
      <TrackView event="skill_gap_viewed" data={{ assessment_id: id, goal_id: goal.goal_id, missing: missingDataDriven + missingChecklist }} />

      <p className="text-sm font-bold text-sky">Career Match</p>
      <h1 className="mt-1 text-2xl font-extrabold md:text-3xl">{goal.name}との一致度</h1>

      <section className="mt-6 grid items-center gap-8 rounded-3xl border border-line bg-white p-6 md:grid-cols-[auto_1fr] md:p-8">
        <div className="mx-auto">
          <ScoreRing value={match.goal_match} />
        </div>
        <div>
          <p className="text-sm font-bold text-muted">Goal Match</p>
          <p className="mt-2 leading-relaxed">
            スキル・職歴・学歴のうち、算出できたカテゴリの平均です。
            {match.evidence_mode === "skill_only" &&
              "このGoalは職歴・学歴の統計を算出できないため、スキルのみで算出しています。"}
          </p>
          <dl className="mt-4 flex flex-wrap gap-2 text-xs">
            <div className="rounded-full bg-indigo-soft px-3 py-1">
              <dt className="inline text-muted">根拠：</dt>
              <dd className="inline font-bold text-indigo">{EVIDENCE_LABELS[match.evidence_mode]}</dd>
            </div>
            <div className="rounded-full bg-indigo-soft px-3 py-1">
              <dt className="inline text-muted">信頼度：</dt>
              <dd className="inline font-bold text-indigo">{CONFIDENCE_LABELS[match.confidence]}</dd>
            </div>
            <div className="rounded-full bg-indigo-soft px-3 py-1">
              <dt className="inline text-muted">統計の母数：</dt>
              <dd className="inline font-bold text-indigo">N = {match.goal_sample_size.toLocaleString()}</dd>
            </div>
          </dl>
          {statsNotes.length > 0 && (
            <ul className="mt-4 space-y-1.5 text-xs leading-relaxed text-muted">
              {statsNotes.map((note) => (
                <li key={note}>※ {note}</li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        <CategoryCard
          title="Skill"
          value={match.skill_match}
          source={skillSource}
          notes={skillNotes}
        />
        <CategoryCard
          title="Experience"
          value={match.experience_match}
          source={
            assessment.experiences.length > 0
              ? assessment.experiences.map((e) => `${roleName(e.role_id)} ${e.years}年`).join("、")
              : "職歴の入力なし"
          }
          notes={experienceNotes}
        />
        <CategoryCard
          title="Education"
          value={match.education_match}
          source={level ? [level.name, field?.name].filter(Boolean).join("・") : "学歴の入力なし"}
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
          <Link href={`/learning-path/${goal.goal_id}`} className="text-sm font-bold text-indigo hover:underline">
            {goal.name}のLearning Pathを見る →
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

      <section className="mt-10 space-y-2 rounded-2xl bg-white p-5 text-xs leading-relaxed text-muted">
        <p className="font-bold text-ink">この結果について</p>
        <p>
          Experience・Educationの一致度は欧州の労働市場データ（JobHop / ESCO）に基づいており、日本の労働市場を完全に反映するものではありません。
          Skillは、調査データのあるGoalでは世界の開発者調査（Stack Overflow Developer Survey）を8FitLabが集計し、日本の回答で補正した技術で評価します。
          調査に対応する職種が無いGoal（PM・PdM・テスト・ネットワーク）は、8FitLabが定義した手法・知識・資格で評価します。
          Career Matchは就職・転職・採用を保証するものではありません。
        </p>
        <p>
          Data Source：Experience / Education：JobHop v2（CC BY 4.0）＋ ESCO v1.1.2 ／ Skill：
          <a href={STACK_OVERFLOW_SURVEY.url} className="underline hover:text-indigo" target="_blank" rel="noopener noreferrer">
            {STACK_OVERFLOW_SURVEY.name}
          </a>{" "}
          2023–2025（
          <a
            href={STACK_OVERFLOW_SURVEY.licenseUrl}
            className="underline hover:text-indigo"
            target="_blank"
            rel="noopener noreferrer"
          >
            {STACK_OVERFLOW_SURVEY.license}
          </a>
          。8FitLabが集計・日本補正）＋ 8FitLab 手法・知識・資格マスタ ／ 計算バージョン {match.calculation_version}
          {stored && ` ／ Skill計算 ${stored.skill_calculation_version}`}
          {stored?.skill_statistics_version && ` ／ Skill統計 ${stored.skill_statistics_version}`}
        </p>
      </section>

      <div className="mt-8 text-center">
        <Link
          href={`/career-match?goal=${goal.goal_id}`}
          className="inline-block rounded-full border border-line bg-white px-6 py-3 text-sm font-bold text-indigo hover:border-sky"
        >
          入力を変えてもう一度計算する
        </Link>
      </div>
    </div>
  );
}
