import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/json-ld";
import { PostCard } from "@/components/post-card";
import { TrackView } from "@/components/track-view";
import { listPosts } from "@/lib/blog/microcms";
import { loadGoals } from "@/lib/career-match";
import { absoluteUrl, ORGANIZATION_NAME, SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const STEPS = [
  { title: "Goalを選ぶ", body: "目指したいエンジニア職種を14のGoalから選びます。" },
  { title: "今の自分を入力", body: "スキル・職歴・学歴を選ぶだけ。氏名などの個人情報は入力しません。" },
  { title: "差分と学習順がわかる", body: "Goalとの一致度、不足スキル、日本向けの学習順を表示します。" },
];

export default async function Home() {
  const [goals, posts] = await Promise.all([loadGoals(), listPosts(3)]);

  return (
    <>
      <TrackView event="page_viewed" data={{ path: "/" }} />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "SoftwareApplication",
          name: SITE_NAME,
          description: SITE_DESCRIPTION,
          url: absoluteUrl("/"),
          applicationCategory: "EducationalApplication",
          operatingSystem: "Web",
          inLanguage: "ja",
          offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
          publisher: { "@type": "Organization", name: ORGANIZATION_NAME },
        }}
      />

      <section className="relative overflow-hidden bg-white">
        <div className="bg-brand-gradient absolute -top-32 -right-32 size-96 rounded-full opacity-20 blur-3xl" />
        <div className="relative mx-auto max-w-5xl px-4 py-16 md:py-24">
          <p className="mb-4 inline-flex rounded-full bg-sky-soft px-3 py-1 text-xs font-bold text-indigo">
            無料・登録不要のキャリア診断
          </p>
          <h1 className="text-3xl leading-tight font-extrabold md:text-5xl">
            <span className="text-brand-gradient">Goal</span>から逆算して、
            <br />
            エンジニアのキャリアをつくる
          </h1>
          <p className="mt-6 max-w-2xl leading-relaxed text-muted">
            目指す職種と今の自分を比べて、どこが合っていて、何が足りないのか。
            実際の職歴データとスキル定義にもとづいて、Goalまでの距離と次に学ぶことを示します。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/goal-fit"
              className="rounded-full bg-indigo px-6 py-3 font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink"
            >
              Goal Fitを始める
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14">
        <ol className="grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-line bg-white p-6">
              <span className="bg-brand-gradient inline-flex size-8 items-center justify-center rounded-full text-sm font-extrabold text-ink">
                {i + 1}
              </span>
              <h2 className="mt-3 font-bold">{step.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-5xl px-4">
        <h2 className="text-xl font-extrabold">Goalを選んで始める</h2>
        <p className="mt-2 text-sm text-muted">選んだGoalでGoal Fitの入力画面が開きます。</p>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((goal) => (
            <li key={goal.goal_id}>
              <Link
                href={`/goal-fit?goal=${goal.goal_id}`}
                className="group block h-full rounded-2xl border border-line bg-white p-5 transition hover:-translate-y-0.5 hover:border-sky hover:shadow-md"
              >
                <p className="font-bold group-hover:text-indigo">{goal.name}</p>
                <p className="mt-1 text-xs text-muted">{goal.summary}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {posts.length > 0 && (
        <section className="mx-auto mt-14 max-w-5xl px-4">
          <div className="flex items-end justify-between gap-2">
            <h2 className="text-xl font-extrabold">最新の記事</h2>
            <Link href="/blog" className="text-sm font-bold text-indigo hover:underline">
              記事一覧 →
            </Link>
          </div>
          <ul className="mt-6 grid gap-4 sm:grid-cols-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} headingLevel="h3" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
