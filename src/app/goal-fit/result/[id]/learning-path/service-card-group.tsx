import { TrackClick } from "@/components/track-click";
import { SERVICE_GROUP_TITLES } from "@/lib/learning-path/constants";
import { stageServices } from "@/lib/learning-path/services";
import type { LearningPathService, ServiceGroupType, UserStage } from "@/lib/learning-path/types";

const EVENT_TYPES: Record<ServiceGroupType, string> = {
  schools: "school",
  services: "job_service",
  freelance: "freelance",
};

function Tags({ service }: { service: LearningPathService }) {
  const tags = [
    (service.beginner_friendly === true || service.novice_support === true) && "未経験OK",
    service.freelance_available === true && "フリーランス案件あり",
    !service.job_category_matched && "職種を問わない",
  ].filter((tag): tag is string => typeof tag === "string");
  if (tags.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span key={tag} className="rounded-full bg-sky-soft px-2 py-0.5 text-[10px] font-bold text-indigo">
          {tag}
        </span>
      ))}
    </div>
  );
}

export function ServiceCardGroup({
  type,
  goalId,
  goalName,
  stage,
}: {
  type: ServiceGroupType;
  goalId: string;
  goalName: string;
  stage: UserStage;
}) {
  const title = SERVICE_GROUP_TITLES[stage][type];
  if (!title) return null;
  const services = stageServices(goalName, stage, type);

  return (
    <div>
      <h3 className="font-bold">{title}</h3>
      {services.length === 0 ? (
        <p className="mt-2 rounded-xl border border-line bg-white px-4 py-3 text-sm text-muted">
          このGoalの推奨教材は準備中です。
        </p>
      ) : (
        <ul className="mt-3 grid gap-3 md:grid-cols-2">
          {services.map((service) => (
            <li key={service.id} className="flex flex-col rounded-2xl border border-line bg-white p-4">
              <p className="font-bold">{service.name}</p>
              {service.course && <p className="mt-0.5 text-xs text-muted">{service.course}</p>}
              <Tags service={service} />
              <TrackClick
                event="service_clicked"
                data={{ service_id: service.id, type: EVENT_TYPES[type], placement: "learning_path", goal_id: goalId, stage }}
                className="mt-auto pt-3"
              >
                <a
                  href={service.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-bold text-sky hover:underline"
                >
                  公式サイトを見る →
                </a>
              </TrackClick>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
