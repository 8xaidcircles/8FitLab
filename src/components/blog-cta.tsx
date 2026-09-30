import Link from "next/link";

export function BlogCta({ goal }: { goal?: { goal_id: string; name: string } | null }) {
  return (
    <aside className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 md:p-8">
      <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
      <p className="text-lg font-extrabold">あなたの場合はどうでしょう？</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        8FitLab Career Matchで、現在のスキル・経験と
        {goal ? `${goal.name}との` : "目標職種との"}
        統計的な一致度を確認できます。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={goal ? `/career-match?goal=${goal.goal_id}` : "/career-match"}
          className="rounded-full bg-indigo px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink"
        >
          無料でCareer Matchを試す
        </Link>
        {goal && (
          <Link
            href={`/career-match?goal=${goal.goal_id}`}
            className="rounded-full border border-line px-6 py-3 text-sm font-bold text-indigo transition hover:border-sky"
          >
            {goal.name}の学習ロードマップを診断する
          </Link>
        )}
      </div>
    </aside>
  );
}
