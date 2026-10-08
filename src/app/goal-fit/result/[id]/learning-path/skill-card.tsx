import { RecommendationCard } from "@/components/recommendation-card";
import type { RecommendationCard as Card } from "@/lib/career-match/recommendations";

export interface RoadmapStep {
  step_id: string;
  learning_order: number;
  name: string;
  satisfied: boolean;
  options: { skill_id: string; name: string; owned: boolean }[];
  materials: Card[];
}

export function SkillCard({ step, emphasizeMissing = false }: { step: RoadmapStep; emphasizeMissing?: boolean }) {
  const choice = step.options.length > 1;
  const missingTone = emphasizeMissing ? "border-flame/40 bg-flame-soft" : "border-line bg-white";
  return (
    <li className={`flex items-start gap-3 rounded-2xl border p-4 ${step.satisfied ? "border-line bg-white" : missingTone}`}>
      <span
        className={`inline-flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-extrabold ${
          step.satisfied ? "bg-cyan-soft text-cyan" : "bg-flame-soft text-flame"
        }`}
        aria-hidden="true"
      >
        {step.satisfied ? "✓" : step.learning_order}
      </span>
      <div className="mt-1 min-w-0 flex-1">
        <p className={`font-bold ${step.satisfied ? "text-muted" : ""}`}>
          {step.name}
          {choice && <span className="ml-2 text-xs font-normal text-muted">（{step.options.length}つから1つ）</span>}
        </p>
        {choice && (
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
              </span>
            ))}
          </div>
        )}
        {step.materials.length > 0 && (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {step.materials.map((card) => (
              <li key={card.article_id}>
                <RecommendationCard card={card} />
              </li>
            ))}
          </ul>
        )}
      </div>
      <span className={`mt-2 shrink-0 self-start text-xs font-bold ${step.satisfied ? "text-cyan" : "text-flame"}`}>
        {step.satisfied ? "習得済み" : "未習得"}
      </span>
    </li>
  );
}
