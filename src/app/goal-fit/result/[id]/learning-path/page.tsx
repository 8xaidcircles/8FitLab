import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecommendationCard } from "@/components/recommendation-card";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import { listRecommendationArticles } from "@/lib/blog/microcms";
import {
  buildLearningPathView,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadSkillContext,
  loadSkillNames,
  normalizeRecommendationArticles,
  resolveUserSkills,
  type RecommendationCard as Card,
  type RoadmapStep,
} from "@/lib/career-match";

export const metadata: Metadata = {
  title: "学習ロードマップとおすすめ",
  robots: { index: false },
};

function StepDescription({ step }: { step: RoadmapStep["step"] }) {
  return (
    <>
      {step.phase && <p className="text-xs font-bold text-sky">{step.phase.label}</p>}
      {step.summary && <p className="leading-relaxed">{step.summary}</p>}
      {step.done_criteria && (
        <p className="rounded-lg bg-sky-soft px-3 py-2 text-xs leading-relaxed">
          <span className="font-bold">達成の目安：</span>
          {step.done_criteria}
        </p>
      )}
    </>
  );
}

function CardGrid({ cards }: { cards: Card[] }) {
  return (
    <ul className="mt-2 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <li key={card.article_id}>
          <RecommendationCard card={card} />
        </li>
      ))}
    </ul>
  );
}

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
    listRecommendationArticles(),
  ]);
  const goal = goals.find((g) => g.goal_id === assessment.goal_id)!;
  const skillName = (skillId: string) => skillNames.get(skillId) ?? skillId;

  const { held } = resolveUserSkills(
    { skill_ids: assessment.skill_ids, certification_ids: assessment.certification_ids },
    skillContext,
    known,
  );
  const articles = normalizeRecommendationArticles(rawArticles, {
    skillIds: known.skillIds,
    goalIds: new Set(goals.map((g) => g.goal_id)),
  });
  const view = buildLearningPathView(goal.goal_id, path.steps, held, articles, skillName);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/goal-fit/result/learning-path", goal_id: goal.goal_id }} />
      <TrackView event="learning_path_viewed" data={{ goal_id: goal.goal_id, assessment_id: id }} />

      <Link href={`/goal-fit/result/${id}`} className="text-sm font-bold text-sky hover:underline">
        ← 診断結果に戻る
      </Link>
      <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">{goal.name} の学習ロードマップ</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {view.missing.length > 0
          ? `未習得のステップが ${view.missing.length} つあります。上から順に学ぶのがおすすめです。`
          : "すべての学習ステップを習得済みです。"}
      </p>
      <a href="#career-services" className="mt-2 inline-block text-sm font-bold text-indigo hover:underline">
        転職・キャリア支援サービスへ ↓
      </a>

      {!view.has_materials && (
        <p className="mt-6 rounded-2xl border border-dashed border-line bg-white p-5 text-center text-sm text-muted">
          この Goal のおすすめ教材は準備中です。
        </p>
      )}

      {view.missing.length > 0 ? (
        <ol className="mt-6 space-y-3">
          {view.missing.map(({ step, number, option_names, cards }) => (
            <li key={step.step_id}>
              <details open={number === 1} className="group rounded-2xl border border-flame/40 bg-white">
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span
                    className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-flame-soft text-sm font-extrabold text-flame"
                    aria-hidden="true"
                  >
                    {number}
                  </span>
                  <span className="flex-1 font-bold">
                    {step.name}
                    {option_names.length > 1 && (
                      <span className="ml-2 text-xs font-normal text-muted">（{option_names.length}つから1つ）</span>
                    )}
                  </span>
                  <span className="text-muted transition group-open:rotate-180" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="space-y-3 border-t border-line px-4 py-4 text-sm">
                  <StepDescription step={step} />
                  <div>
                    <p className="text-xs text-muted">
                      {option_names.length > 1 ? "いずれか1つを習得すれば、このステップは達成です。" : "習得するスキル"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {option_names.map((name) => (
                        <span key={name} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                          {name}
                        </span>
                      ))}
                    </div>
                  </div>
                  {cards.length > 0 && (
                    <div>
                      <p className="text-xs font-bold">おすすめ教材</p>
                      <CardGrid cards={cards} />
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-6 rounded-2xl border border-cyan/40 bg-cyan-soft p-5 font-bold">主要スキルはそろっています</p>
      )}

      {view.satisfied.length > 0 && (
        <details className="group/done mt-8 rounded-2xl border border-line bg-white">
          <summary className="flex cursor-pointer list-none items-center gap-2 p-4 text-sm font-bold text-muted">
            <span className="flex-1">✓ 習得済み {view.satisfied.length} ステップ</span>
            <span className="transition group-open/done:rotate-180" aria-hidden="true">
              ▾
            </span>
          </summary>
          <ul className="divide-y divide-line border-t border-line">
            {view.satisfied.map(({ step, held_names, cards }) => {
              const label = (
                <>
                  <span className="flex-1">
                    <span className="font-bold">{step.name}</span>
                    <span className="ml-2 text-xs text-muted">{held_names.join("・")}</span>
                  </span>
                </>
              );
              return (
                <li key={step.step_id}>
                  {cards.length > 0 ? (
                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm">
                        <span className="text-cyan" aria-hidden="true">
                          ✓
                        </span>
                        {label}
                        <span className="text-muted transition group-open:rotate-180" aria-hidden="true">
                          ▾
                        </span>
                      </summary>
                      <div className="px-4 pb-4 text-sm">
                        <p className="text-xs font-bold">復習・さらに深めるための教材</p>
                        <CardGrid cards={cards} />
                      </div>
                    </details>
                  ) : (
                    <div className="flex items-center gap-2 px-4 py-3 text-sm">
                      <span className="text-cyan" aria-hidden="true">
                        ✓
                      </span>
                      {label}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}

      <section id="career-services" className="mt-12 scroll-mt-6">
        <h2 className="text-xl font-extrabold">転職・キャリア支援サービス</h2>
        {view.career.length > 0 ? (
          view.career.map((group) => (
            <div key={group.audience} className="mt-5">
              <h3 className="font-bold">{group.heading}</h3>
              <CardGrid cards={group.cards} />
            </div>
          ))
        ) : (
          <p className="mt-2 text-sm text-muted">この Goal のおすすめ転職サービスは準備中です。</p>
        )}
        <p className="mt-4 text-xs text-muted">応募条件や実務経験の要件は、各サービスの公式サイトで確認してください。</p>
      </section>
    </div>
  );
}
