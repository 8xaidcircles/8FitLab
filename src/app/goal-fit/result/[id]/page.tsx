import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ScoreBar, ScoreRing } from "@/components/score-ring";
import { TrackView } from "@/components/track-view";
import { getAnonymousUserId, isUuid } from "@/lib/anonymous-user";
import { getAssessment } from "@/lib/assessment/repository";
import {
  evaluateSteps,
  loadEducation,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadRoleGroups,
  loadRoles,
  loadSkillContext,
  resolveUserSkills,
} from "@/lib/career-match";
import { SKIPPED_EDUCATION_LEVEL_ID } from "@/lib/career-match/types";
import { EXPERIENCE_STATUS_LABELS, formatPercent, SKILL_STATUS_LABELS } from "@/lib/labels";
import { determineUserStage } from "@/lib/learning-path/determine-stage";

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

  const [goals, path, known, skillContext, roles, roleGroups, education] = await Promise.all([
    loadGoals(),
    loadLearningPath(assessment.goal_id),
    loadKnownIds(),
    loadSkillContext(assessment.goal_id),
    loadRoles(),
    loadRoleGroups(),
    loadEducation(),
  ]);
  const goal = goals.find((g) => g.goal_id === assessment.goal_id)!;
  const match = assessment.career_match;
  const jaRoleNames = new Map(roleGroups.flatMap((g) => g.roles.map((r) => [r.role_id, r.name])));
  const roleName = (roleId: string) => jaRoleNames.get(roleId) ?? roles.find((r) => r.role_id === roleId)?.label ?? roleId;

  const { held } = resolveUserSkills(
    { skill_ids: assessment.skill_ids, certification_ids: assessment.certification_ids },
    skillContext,
    known,
  );
  // 学習ロードマップのページへの案内文を、ステージ（実務経験・未習得の Step の有無）で切り替える
  const stage = determineUserStage(goal, assessment.experiences, evaluateSteps(path, held));

  const certificationNames = skillContext.certifications
    .filter((c) => assessment.certification_ids.includes(c.cert_id))
    .map((c) => c.name);
  const percent = (w: number) => `${Math.round(w * 100)}%`;

  const stored = match.skill;
  const layerBreakdown = stored
    ? [
        stored.skill_layer_weights.tech > 0 &&
          `技術 ${formatPercent(stored.tech_skill_progress ?? 0)}（配分 ${percent(stored.skill_layer_weights.tech)}）`,
        stored.skill_layer_weights.human > 0 &&
          `手法・知識 ${formatPercent(stored.human_skill_progress ?? 0)}（配分 ${percent(stored.skill_layer_weights.human)}）`,
      ]
        .filter(Boolean)
        .join(" ＋ ")
    : "";
  // 現在は linear 固定。ecdf で保存された結果を読んだ場合は、点数が達成率ではなく利用者内での位置であることを示す
  const rankedSkill = stored?.skill_scoring_method === "ecdf";
  const skillBreakdown = !stored
    ? "旧方式（8FitLabの学習ステップの達成率）で計算した結果です"
    : rankedSkill
      ? `同じGoalを目指す ${stored.skill_distribution_sample_size} 人の中での位置。達成率 ${formatPercent(stored.skill_progress)}%（${layerBreakdown}）`
      : layerBreakdown;
  const skillAnswer =
    assessment.skill_ids.length === 0 && assessment.skill_status
      ? SKILL_STATUS_LABELS[assessment.skill_status]
      : null;
  const skillSource = skillAnswer ? `${skillAnswer}。${skillBreakdown}` : skillBreakdown;
  const skillDescription = `目標ポジションで求められる技術やスキルの保有状況です。${
    rankedSkill
      ? "達成率が上がると位置も上がります。満点にならない場合があります。"
      : "不足しているスキルを習得することでスコアが上がります。"
  }${certificationNames.length > 0 ? " 保有資格によるスキル証明を含んでいます。" : ""}`;
  const usesHumanLayer = (stored?.skill_layer_weights.human ?? 0) > 0;
  const skillNotes = [
    ...(usesHumanLayer
      ? [
          "この職種は公開統計（Stack Overflow 開発者調査）から必要な技術を特定できないため、Skill は 8FitLab が定義した要件（手法・知識）の達成度で評価しています。",
        ]
      : []),
    ...(assessment.legacy_skill_ids.length > 0
      ? [
          "以前の入力のうち、具体的な技術が分からない項目（例：「クラウド」）は計算に含めていません。もう一度計算するときに具体的な技術を選んでください。",
        ]
      : []),
  ];
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

      <p className="mt-4 text-center text-xs leading-relaxed text-muted">
        Goal Fit の計算結果は、キャリア判断の参考値であり、
        <br className="hidden sm:inline" />
        実際の就職・転職・採用の結果を保証するものではありません。
      </p>

      <section className="mt-4 grid gap-4 md:grid-cols-3">
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
        <div className="text-center">
          <Link
            href={`/goal-fit/result/${id}/learning-path`}
            className="group inline-block w-full max-w-lg rounded-2xl p-[3px] shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
            style={{
              backgroundImage: "linear-gradient(90deg, #e84545, #f27035, #f2e26e, #8ee8c8, #22c3e0, #38a6f2, #2b3192, #a855f7)",
            }}
          >
            <span className="flex justify-center rounded-[13px] bg-indigo px-4 py-4 text-[clamp(0.95rem,4.5vw,1.25rem)] leading-snug font-extrabold whitespace-nowrap text-white transition group-hover:bg-ink sm:px-6 sm:py-5">
              {/* 矢印は文字の中央揃えに影響しないよう、文字ブロックの右外に絶対配置する */}
              <span className="relative text-center">
                {stage === "learning" ? (
                  <>
                    <span className="block">学習ロードマップ</span>
                    <span className="block">スクール・サービスを見る</span>
                  </>
                ) : stage === "ready" ? (
                  "おすすめの転職サービスを見る"
                ) : (
                  <>
                    <span className="block">キャリアアップ向けの</span>
                    <span className="block">転職・フリーランス案件を見る</span>
                  </>
                )}
                <span
                  aria-hidden
                  className="absolute top-1/2 left-full ml-[1em] flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-white text-indigo transition-transform group-hover:translate-x-1 sm:size-8"
                >
                  →
                </span>
              </span>
            </span>
          </Link>
        </div>
      </section>

      <div className="mt-10 text-center">
        <Link
          href={`/goal-fit?goal=${goal.goal_id}`}
          className="inline-block rounded-full border border-line bg-white px-6 py-3 text-sm font-bold text-indigo hover:border-sky"
        >
          入力を変えてもう一度計算する
        </Link>
      </div>

      <p className="mt-10 text-center text-xs text-muted">
        JobHop・ESCO・Stack Overflow Developer Survey のデータを加工して算出（
        <Link href="/disclaimer#licenses" className="underline hover:text-indigo">
          データ出典・ライセンス
        </Link>
        ）
      </p>
    </div>
  );
}
