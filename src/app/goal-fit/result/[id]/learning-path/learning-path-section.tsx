import { SERVICE_GROUP_ORDER } from "@/lib/learning-path/constants";
import type { UserStage } from "@/lib/learning-path/types";
import { ServiceCardGroup } from "./service-card-group";
import { SkillCard, type RoadmapStep } from "./skill-card";

/** 学習ロードマップ。言語の Step は全ステージで「基礎」として先に出し、未習得を強調する */
export function LearningPathSection({
  languageSteps,
  otherSteps,
}: {
  languageSteps: RoadmapStep[];
  otherSteps: RoadmapStep[];
}) {
  const missingCount = [...languageSteps, ...otherSteps].filter((s) => !s.satisfied).length;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold">学習ロードマップ</h2>
      <p className="mt-1 text-sm text-muted">
        {languageSteps.length + otherSteps.length === 0
          ? ""
          : missingCount > 0
            ? `数字は学ぶ順番です。未習得のステップは ${missingCount} つです。`
            : "すべての学習ステップを習得済みです。"}
      </p>
      {languageSteps.length + otherSteps.length > 0 &&
        [...languageSteps, ...otherSteps].every((s) => s.materials.length === 0) && (
          <p className="mt-4 rounded-xl border border-dashed border-line bg-white px-4 py-3 text-center text-sm text-muted">
            このGoalのおすすめ教材は準備中です。
          </p>
        )}

      {languageSteps.length > 0 && (
        <div className="mt-5">
          <div className="rounded-xl border-l-4 border-indigo bg-indigo-soft px-4 py-3">
            <h3 className="font-bold text-indigo">基礎：プログラミング言語</h3>
            <p className="mt-1 text-xs text-ink">この職種の土台になる言語です。未習得の言語から始めましょう。</p>
          </div>
          <ol className="mt-3 space-y-2">
            {languageSteps.map((step) => (
              <SkillCard key={step.step_id} step={step} emphasizeMissing />
            ))}
          </ol>
        </div>
      )}

      {otherSteps.length > 0 && (
        <div className="mt-6">
          {languageSteps.length > 0 && <h3 className="font-bold">その他のスキル</h3>}
          <ol className="mt-3 space-y-2">
            {otherSteps.map((step) => (
              <SkillCard key={step.step_id} step={step} />
            ))}
          </ol>
        </div>
      )}

      {languageSteps.length + otherSteps.length === 0 && (
        <p className="mt-5 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          このGoalのロードマップは準備中です。
        </p>
      )}
    </section>
  );
}

/** ステージ別のスクール・転職サービス。グループの順番はステージで変わる */
export function StageServicesSection({
  stage,
  goalId,
  goalName,
}: {
  stage: UserStage;
  goalId: string;
  goalName: string;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-extrabold">{goalName} におすすめのスクール・サービス</h2>
      <div className="mt-5 space-y-8">
        {SERVICE_GROUP_ORDER[stage].map((type) => (
          <ServiceCardGroup key={type} type={type} goalId={goalId} goalName={goalName} stage={stage} />
        ))}
      </div>
      <p className="mt-4 text-xs text-muted">料金・応募条件・実務経験の要件は、各サービスの公式サイトで確認してください。</p>
    </section>
  );
}
