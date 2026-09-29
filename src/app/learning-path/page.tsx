import type { Metadata } from "next";
import Link from "next/link";
import { TrackView } from "@/components/track-view";
import { loadGoals, loadLearningPath } from "@/lib/career-match";

export const metadata: Metadata = {
  title: "Learning Path",
  description: "エンジニア職種（Goal）ごとに、日本向けに定義した学習順を紹介します。",
  alternates: { canonical: "/learning-path" },
};

export default async function LearningPathIndex() {
  const goals = await loadGoals();
  const paths = await Promise.all(goals.map((g) => loadLearningPath(g.goal_id)));

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/learning-path" }} />
      <h1 className="text-2xl font-extrabold md:text-3xl">Learning Path</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
        Goalごとに、日本のエンジニア向けに8FitLabが定義した学習順です。言語やフレームワークは選択肢から1つ選べば進められます。
      </p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {goals.map((goal, i) => (
          <li key={goal.goal_id}>
            <Link
              href={`/learning-path/${goal.goal_id}`}
              className="group block h-full rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md"
            >
              <p className="font-bold group-hover:text-indigo">{goal.name}</p>
              <p className="mt-1 text-xs text-muted">{goal.summary}</p>
              <p className="mt-3 text-xs font-bold text-sky">{paths[i].steps.length} ステップ</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
