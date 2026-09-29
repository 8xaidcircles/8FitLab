import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LearningSteps } from "@/components/learning-steps";
import { TrackView } from "@/components/track-view";
import { loadGoals, loadLearningPath, loadSkillNames } from "@/lib/career-match";

export async function generateStaticParams() {
  return (await loadGoals()).map((goal) => ({ goalId: goal.goal_id }));
}

export const dynamicParams = false;

async function findGoal(goalId: string) {
  return (await loadGoals()).find((g) => g.goal_id === goalId);
}

export async function generateMetadata({ params }: PageProps<"/learning-path/[goalId]">): Promise<Metadata> {
  const goal = await findGoal((await params).goalId);
  if (!goal) return {};
  return {
    title: `${goal.name}のLearning Path`,
    description: `${goal.name}（${goal.summary}）を目指すための学習順を、日本のエンジニア向けに紹介します。`,
    alternates: { canonical: `/learning-path/${goal.goal_id}` },
  };
}

export default async function GoalLearningPath({ params }: PageProps<"/learning-path/[goalId]">) {
  const { goalId } = await params;
  const goal = await findGoal(goalId);
  if (!goal) notFound();

  const [path, skillNames] = await Promise.all([loadLearningPath(goalId), loadSkillNames()]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: `/learning-path/${goalId}` }} />
      <Link href="/learning-path" className="text-sm font-bold text-sky hover:underline">
        ← Learning Path一覧
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{goal.name}のLearning Path</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {goal.summary}ための学習順です（全{path.steps.length}ステップ）。
      </p>

      <LearningSteps
        goalId={goalId}
        showStatus={false}
        steps={path.steps.map((s) => ({
          step_id: s.step_id,
          learning_order: s.learning_order,
          name: s.name,
          satisfied: false,
          options: s.any_of.map((id) => ({ skill_id: id, name: skillNames.get(id) ?? id, owned: false })),
        }))}
      />

      <div className="mt-10 rounded-2xl border border-line bg-white p-6 text-center">
        <p className="font-bold">自分がどこまで進んでいるか確認しましょう</p>
        <p className="mt-1 text-sm text-muted">スキルを選ぶと、未習得のステップだけを順番に表示します。</p>
        <Link
          href={`/career-match?goal=${goalId}`}
          className="mt-4 inline-block rounded-full bg-indigo px-6 py-3 font-bold text-white hover:bg-ink"
        >
          {goal.name}でCareer Matchを始める
        </Link>
      </div>
    </div>
  );
}
