import Link from "next/link";

export function BlogCta({ goal }: { goal?: { goal_id: string; name: string } | null }) {
  const href = goal ? `/goal-fit?goal=${goal.goal_id}` : "/goal-fit";
  return (
    <aside className="relative overflow-hidden rounded-3xl border border-line bg-white p-6 md:p-8">
      <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
      <p className="text-lg font-extrabold">あなたの現在地から最短の学習ステップを診断</p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        現在のスキル・経歴から、Goal達成までのロードマップとおすすめサービスが分かります。
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <Link
          href={href}
          className="rounded-full bg-indigo px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink"
        >
          無料でGoal Fitを試す
        </Link>
        <Link
          href={href}
          className="rounded-full border border-line px-6 py-3 text-sm font-bold text-indigo transition hover:border-sky"
        >
          スキルギャップと学習ロードマップを診断する
        </Link>
      </div>
    </aside>
  );
}
