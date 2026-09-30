"use client";

import type { ReactNode } from "react";
import { TrackView } from "@/components/track-view";

export interface StepView {
  step_id: string;
  learning_order: number;
  name: string;
  satisfied: boolean;
  /** scored が false の選択肢は、Step を満たしても Skill Match には効かない */
  options: { skill_id: string; name: string; owned: boolean; scored?: boolean }[];
  /** 開いたときに選択肢の下に出す内容（Step の説明・教材カード。サーバーで組み立てる） */
  details?: ReactNode;
}

export function LearningSteps({
  goalId,
  assessmentId,
  steps,
  showStatus = true,
  trackView = true,
}: {
  goalId: string;
  assessmentId?: string;
  steps: StepView[];
  showStatus?: boolean;
  /** 同じページに複数並べるときは 1 つだけ true にする（閲覧イベントを重複させない） */
  trackView?: boolean;
}) {
  const missingOrder = new Map(
    steps.filter((s) => !s.satisfied).map((s, i) => [s.step_id, i + 1] as const),
  );

  return (
    <>
      {trackView && (
        <TrackView event="learning_path_viewed" data={{ goal_id: goalId, assessment_id: assessmentId ?? null }} />
      )}
      <ol className="mt-5 space-y-2">
        {steps.map((step) => {
          const choice = step.options.length > 1;
          if (!showStatus) {
            return (
              <li key={step.step_id} className="flex items-start gap-3 rounded-2xl border border-line bg-white p-4">
                <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-indigo-soft text-sm font-extrabold text-indigo">
                  {step.learning_order}
                </span>
                <div className="flex-1">
                  <p className="font-bold">
                    {step.name}
                    {choice && <span className="ml-2 text-xs font-normal text-muted">（{step.options.length}つから1つ）</span>}
                  </p>
                  {choice && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {step.options.map((option) => (
                        <span key={option.skill_id} className="rounded-full border border-line px-3 py-1 text-xs text-muted">
                          {option.name}
                        </span>
                      ))}
                    </div>
                  )}
                  {step.details}
                </div>
              </li>
            );
          }
          const order = missingOrder.get(step.step_id);
          return (
            <li key={step.step_id}>
              <details className={`group rounded-2xl border bg-white ${step.satisfied ? "border-line" : "border-flame/40"}`}>
                <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                  <span
                    className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
                      step.satisfied ? "bg-cyan-soft text-cyan" : "bg-flame-soft text-flame"
                    }`}
                    aria-hidden="true"
                  >
                    {step.satisfied ? "✓" : order}
                  </span>
                  <span className="flex-1">
                    <span className={`font-bold ${step.satisfied ? "text-muted" : ""}`}>{step.name}</span>
                    {choice && <span className="ml-2 text-xs text-muted">（{step.options.length}つから1つ）</span>}
                  </span>
                  <span className={`text-xs font-bold ${step.satisfied ? "text-cyan" : "text-flame"}`}>
                    {step.satisfied ? "習得済み" : "未習得"}
                  </span>
                  <span className="text-muted transition group-open:rotate-180" aria-hidden="true">
                    ▾
                  </span>
                </summary>
                <div className="border-t border-line px-4 py-3 text-sm">
                  <p className="text-xs text-muted">
                    {choice
                      ? "いずれか1つを習得すれば、このステップは達成です。"
                      : "このスキルを習得すると、このステップは達成です。"}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {step.options.map((option) => (
                      <span
                        key={option.skill_id}
                        className={`rounded-full border px-3 py-1 text-xs ${
                          option.owned ? "border-cyan bg-cyan-soft font-bold" : "border-line text-muted"
                        }`}
                      >
                        {option.owned && "✓ "}
                        {option.name}
                        {option.scored === false && <span className="ml-1 font-normal text-muted">（Skill対象外）</span>}
                      </span>
                    ))}
                  </div>
                  {step.details}
                </div>
              </details>
            </li>
          );
        })}
      </ol>
    </>
  );
}
