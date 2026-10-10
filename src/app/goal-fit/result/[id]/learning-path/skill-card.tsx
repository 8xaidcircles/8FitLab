import { RecommendationCard } from "@/components/recommendation-card";
import { TrackClick } from "@/components/track-click";
import type { RecommendationCard as Card } from "@/lib/career-match/recommendations";
import type { UserStage } from "@/lib/learning-path/types";
import type { UdemyCourseCard } from "@/lib/learning-path/udemy";

export interface RoadmapStep {
  step_id: string;
  learning_order: number;
  name: string;
  satisfied: boolean;
  options: { skill_id: string; name: string; owned: boolean }[];
  materials: Card[];
  courses: UdemyCourseCard[];
}

export interface RoadmapTracking {
  goalId: string;
  stage: UserStage;
}

function UdemyCourses({ step, tracking }: { step: RoadmapStep; tracking: RoadmapTracking }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-bold text-muted">Udemy で学ぶ</p>
      <ul className="mt-1.5 grid gap-2 lg:grid-cols-2">
        {step.courses.map((course) => (
          <li key={course.skill_id}>
            <TrackClick
              event="service_clicked"
              data={{
                service_id: `udemy:${course.skill_id}`,
                type: "udemy_course",
                placement: "learning_path",
                goal_id: tracking.goalId,
                stage: tracking.stage,
                step_id: step.step_id,
                skill_id: course.skill_id,
              }}
              className="h-full"
            >
              <a
                href={course.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-full flex-col rounded-xl border border-line bg-white p-3 transition hover:border-sky"
              >
                {step.options.length > 1 && (
                  <span className="self-start rounded-full bg-sky-soft px-2 py-0.5 text-[10px] font-bold text-indigo">
                    {course.skill_name}
                  </span>
                )}
                <span className="text-sm leading-snug font-bold break-words">{course.title}</span>
                <span className="mt-1 text-xs leading-snug break-words text-muted">{course.instructor}</span>
                <span className="mt-auto pt-2 text-xs font-bold text-sky">Udemy で見る →</span>
              </a>
            </TrackClick>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function SkillCard({
  step,
  tracking,
  emphasizeMissing = false,
}: {
  step: RoadmapStep;
  tracking: RoadmapTracking;
  emphasizeMissing?: boolean;
}) {
  const choice = step.options.length > 1;
  const missingTone = emphasizeMissing ? "border-flame/40 bg-flame-soft" : "border-line bg-white";
  return (
    <li className={`rounded-2xl border p-3 ${step.satisfied ? "border-line bg-white" : missingTone}`}>
      <div className="flex items-start gap-3">
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
        </div>
        <span className={`mt-2 shrink-0 self-start text-xs font-bold ${step.satisfied ? "text-cyan" : "text-flame"}`}>
          {step.satisfied ? "習得済み" : "未習得"}
        </span>
      </div>
      {step.materials.length > 0 && (
        <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {step.materials.map((card) => (
            <li key={card.article_id}>
              <RecommendationCard card={card} />
            </li>
          ))}
        </ul>
      )}
      {step.courses.length > 0 && <UdemyCourses step={step} tracking={tracking} />}
    </li>
  );
}
