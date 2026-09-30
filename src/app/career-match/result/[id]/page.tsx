import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBar, ScoreRing } from "@/components/score-ring";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import {
  COMPOSITE_UNMET_GROUP_CAP,
  goHref,
  goalSkillUnits,
  humanRequirementStatus,
  isAffiliateLink,
  learningPath,
  loadEducation,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadResources,
  loadRoleGroups,
  loadRoles,
  loadSkillContext,
  loadSkillNames,
  normalizeHumanRequirements,
  resolveCareerNextResources,
  resolveStepResources,
  resolveUserSkills,
  satisfiedGroupIds,
  skillGap,
  skillMatchScope,
  skillUnitGaps,
  type GoParams,
  type LearningResource,
  type LearningStep,
  type Resource,
} from "@/lib/career-match";
import { SKILL_LAYER_WEIGHT_SOURCE_LABELS, formatPercent } from "@/lib/labels";
import { LearningSteps } from "@/components/learning-steps";
import { ResourcePending, StepResourceCard } from "@/components/step-resource-card";

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

function ResourceCard({ resource, params }: { resource: Resource; params: Omit<GoParams, "resource_id"> }) {
  return (
    <StepResourceCard
      resource={resource}
      href={goHref({ ...params, resource_id: resource.resource_id })}
      isAffiliate={isAffiliateLink(resource)}
    />
  );
}

// resources が null の Goal（教材の準備が済んでいない）は説明だけを出す
function StepDetails({
  step,
  goalId,
  resources,
  skillName,
}: {
  step: LearningStep;
  goalId: string;
  resources: LearningResource[] | null;
  skillName: (id: string) => string;
}) {
  const uncovered = resources ? step.any_of.filter((id) => !resources.some((r) => r.covers.includes(id))) : [];
  if (!step.summary && !step.done_criteria && !step.phase && !resources) return null;
  return (
    <div className="mt-4 space-y-3">
      {step.phase && <p className="text-xs font-bold text-sky">{step.phase.label}</p>}
      {step.summary && <p className="leading-relaxed">{step.summary}</p>}
      {step.done_criteria && (
        <p className="rounded-lg bg-sky-soft px-3 py-2 text-xs leading-relaxed">
          <span className="font-bold">達成の目安：</span>
          {step.done_criteria}
        </p>
      )}
      {resources && (
        <div className="grid gap-3 md:grid-cols-2">
          {resources.map((resource, index) => (
            <ResourceCard
              key={resource.resource_id}
              resource={resource}
              params={{ placement: "step_resource", position_index: index, goal_id: goalId, step_id: step.step_id }}
            />
          ))}
          {uncovered.map((id) => (
            <ResourcePending key={id} name={skillName(id)} />
          ))}
        </div>
      )}
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

  // 未習得の Step があれば教材（learning）、全部習得済みなら転職・フリーランス（career_next）。
  // 教材の準備が済んでいない Goal は Step の説明だけを出す
  const missingSteps = learningPath(path, held);
  const resourcesReady = goal.learning_resources_ready;
  const allResources = resourcesReady ? await loadResources() : [];
  const stepResources = new Map(
    resolveStepResources(resourcesReady ? missingSteps : [], allResources).map((s) => [s.step_id, s.resources]),
  );
  const stepDetails = (step: LearningStep) => (
    <StepDetails step={step} goalId={goal.goal_id} resources={stepResources.get(step.step_id) ?? null} skillName={skillName} />
  );

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

  const groups = goal.requirement_groups;
  const satisfied = satisfiedGroupIds(
    groups.map((g) => ({ group_id: g.group_id, occupations: g.occupations.map((o) => o.code) })),
    assessment.experiences,
  );
  const groupNames = (met: boolean) => groups.filter((g) => satisfied.has(g.group_id) === met).map((g) => g.name).join("・");
  const compositeNote = `このGoalは${groups.map((g) => g.name).join("と")}の達成率の平均です（${groups
    .map((g) => `${g.name}：${g.occupations.map((o) => roleName(o.code)).join(" または ")}`)
    .join("、")}）。職業そのものの経験が無い側の達成率は、前職経験の統計から最大${COMPOSITE_UNMET_GROUP_CAP}まで評価します。`;
  const tenureNote =
    "このGoalの職業そのものの経験は、同じ職業に就いた人の在職年数と比べて評価しています。在職年数が長い人ほど高くなり、半数の人より長ければ50を超えます。前職経験の評価のほうが高い場合はそちらを使います。";
  const statisticalNote =
    "このGoalに就いた人が、Goalに就く前にどんな職種を何年経験していたかと比べています。上位10%の人と同程度の前職経験で100になります。";
  const experienceNotes = [
    ...(groups.length > 1 ? [compositeNote] : []),
    ...(satisfied.size > 0 ? [tenureNote] : []),
    ...(groups.length > 1 && satisfied.size > 0 && satisfied.size < groups.length
      ? [`${groupNames(true)}は在職年数、${groupNames(false)}は前職経験の統計から達成率を出し、平均しています。`]
      : []),
    ...(satisfied.size < groups.length ? [statisticalNote] : []),
  ];
  const isFullyExperienced = groups.length > 0 && satisfied.size === groups.length;
  const careerNext =
    resourcesReady && missingSteps.length === 0
      ? resolveCareerNextResources(goal.goal_id, isFullyExperienced, allResources)
      : null;
  const careerServices = careerNext ? [...careerNext.job_change_services, ...careerNext.freelance_services] : [];
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
                details: stepDetails(s),
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
                details: stepDetails(s),
              }))}
            />
          </div>
        )}
      </section>

      {careerServices.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-extrabold">次のキャリアへ</h2>
          <p className="mt-1 text-sm text-muted">
            {isFullyExperienced
              ? "学習ステップをすべて習得済みで、このGoalの職業の経験もあります。転職やフリーランスのサービスを比べてみてください。"
              : "学習ステップをすべて習得済みです。未経験から応募できる転職サービスを紹介します。"}
          </p>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {careerServices.map((resource, index) => (
              <ResourceCard
                key={resource.resource_id}
                resource={resource}
                params={{ placement: "career_next", position_index: index, goal_id: goal.goal_id, step_id: null }}
              />
            ))}
          </div>
        </section>
      )}

      <div className="mt-10 text-center">
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
