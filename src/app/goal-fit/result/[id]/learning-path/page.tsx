import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import { listRecommendationArticles } from "@/lib/blog/microcms";
import {
  evaluateSteps,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadSkillContext,
  loadSkillNames,
  normalizeRecommendationArticles,
  resolveUserSkills,
} from "@/lib/career-match";
import { SHOW_STEP_MATERIALS, STAGE_LABELS } from "@/lib/learning-path/constants";
import { determineUserStage, isLanguageStep } from "@/lib/learning-path/determine-stage";
import { stepMaterialCards } from "@/lib/learning-path/materials";
import { LearningPathSection, StageServicesSection } from "./learning-path-section";
import type { RoadmapStep } from "./skill-card";

export const metadata: Metadata = {
  title: "学習ロードマップ",
  robots: { index: false },
};

export default async function LearningPathPage({ params }: PageProps<"/goal-fit/result/[id]/learning-path">) {
  const { id } = await params;
  const anonymousUserId = await getAnonymousUserId();
  if (!isUuid(id) || !anonymousUserId) notFound();

  const assessment = await getAssessment(id, anonymousUserId);
  if (!assessment) notFound();

  const [goals, path, skillNames, known, skillContext, rawArticles] = await Promise.all([
    loadGoals(),
    loadLearningPath(assessment.goal_id),
    loadSkillNames(),
    loadKnownIds(),
    loadSkillContext(assessment.goal_id),
    SHOW_STEP_MATERIALS ? listRecommendationArticles() : Promise.resolve([]),
  ]);
  const goal = goals.find((g) => g.goal_id === assessment.goal_id)!;
  const skillName = (skillId: string) => skillNames.get(skillId) ?? skillId;

  const { held } = resolveUserSkills(
    { skill_ids: assessment.skill_ids, certification_ids: assessment.certification_ids },
    skillContext,
    known,
  );
  const steps = evaluateSteps(path, held);
  const stage = determineUserStage(goal, assessment.experiences, steps);
  const articles = normalizeRecommendationArticles(rawArticles, {
    skillIds: known.skillIds,
    goalIds: new Set(goals.map((g) => g.goal_id)),
  });
  const materials = stepMaterialCards(goal.goal_id, path.steps, held, articles);
  const toView = (step: (typeof steps)[number]): RoadmapStep => ({
    step_id: step.step_id,
    learning_order: step.learning_order,
    name: step.name,
    satisfied: step.satisfied,
    options: step.any_of.map((skillId) => ({ skill_id: skillId, name: skillName(skillId), owned: held.has(skillId) })),
    materials: materials.get(step.step_id) ?? [],
  });
  const languageSteps = steps.filter(isLanguageStep).map(toView);
  const otherSteps = steps.filter((step) => !isLanguageStep(step)).map(toView);

  const roadmap = <LearningPathSection languageSteps={languageSteps} otherSteps={otherSteps} />;
  const services = <StageServicesSection stage={stage} goalId={goal.goal_id} goalName={goal.name} />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/goal-fit/result/learning-path", goal_id: goal.goal_id }} />
      <TrackView event="learning_path_viewed" data={{ goal_id: goal.goal_id, assessment_id: id, stage }} />

      <Link href={`/goal-fit/result/${id}`} className="text-sm font-bold text-sky hover:underline">
        ← 診断結果に戻る
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{goal.name} の学習ロードマップ</h1>

      <div className="mt-5 rounded-2xl border border-line bg-white p-5">
        <span className="inline-block rounded-full bg-indigo px-3 py-1 text-xs font-bold text-white">
          {STAGE_LABELS[stage].title}
        </span>
        <p className="mt-2 text-sm leading-relaxed text-ink">{STAGE_LABELS[stage].description}</p>
      </div>

      {stage === "learning" ? (
        <>
          {roadmap}
          {services}
        </>
      ) : (
        <>
          {services}
          {roadmap}
        </>
      )}
    </div>
  );
}
