import type { CareerService, LearningResource, LearningStep, Resource } from "./types";

export const MAX_RESOURCES_PER_STEP = 4;
const MAX_RESOURCES_PER_SKILL = 2;
const MAX_JOB_CHANGE_SERVICES_WITHOUT_EXPERIENCE = 2;
const MAX_CAREER_SERVICES = 4;

export function isAffiliateLink(resource: Resource): boolean {
  const { affiliate } = resource;
  return affiliate !== null && affiliate.status === "active" && Boolean(affiliate.url) && affiliate.url.startsWith("https://");
}

// 並び順は編集順位だけで決める（アフィリエイトの有無・入力の順序に左右されない）
export function compareByEditorial(a: Resource, b: Resource): number {
  if (a.editorial_rank !== b.editorial_rank) return a.editorial_rank - b.editorial_rank;
  return a.resource_id < b.resource_id ? -1 : a.resource_id > b.resource_id ? 1 : 0;
}

// 無料教材があれば最上位の 1 件を先頭にし、残りを編集順位で並べて max 件
export function selectResources(matched: readonly LearningResource[], max: number): LearningResource[] {
  const sorted = [...matched].sort(compareByEditorial);
  const free = sorted.find((r) => r.cost === "free");
  const ordered = free ? [free, ...sorted.filter((r) => r !== free)] : sorted;
  return ordered.slice(0, Math.max(0, max));
}

function isLearningResource(resource: Resource): resource is LearningResource {
  return resource.type !== "job_service";
}

function isCareerService(resource: Resource): resource is CareerService {
  return resource.type === "job_service";
}

export interface StepResources {
  step_id: string;
  resources: LearningResource[];
}

// Step の any_of の順に、Skill ごとに perSkill 件まで。Step 全体で 4 件まで、同じ教材は 1 回だけ
export function resolveStepResources(steps: readonly LearningStep[], allResources: readonly Resource[]): StepResources[] {
  const learning = allResources.filter(isLearningResource).filter((r) => r.is_active);
  return steps.map((step) => {
    const perSkill = Math.max(1, Math.min(MAX_RESOURCES_PER_SKILL, Math.floor(MAX_RESOURCES_PER_STEP / step.any_of.length)));
    const used = new Set<string>();
    const resources: LearningResource[] = [];
    for (const skillId of step.any_of) {
      const remaining = MAX_RESOURCES_PER_STEP - resources.length;
      if (remaining <= 0) break;
      const matched = learning.filter((r) => r.covers.includes(skillId) && !used.has(r.resource_id));
      for (const resource of selectResources(matched, Math.min(perSkill, remaining))) {
        used.add(resource.resource_id);
        resources.push(resource);
      }
    }
    return { step_id: step.step_id, resources };
  });
}

export interface CareerNextResources {
  job_change_services: CareerService[];
  freelance_services: CareerService[];
}

// Goal の職業の経験が無い人には、経験不要の転職サービスだけを最大 2 件。
// 経験がある人には転職（audience = all を含む）とフリーランスを最大 4 件ずつ
export function resolveCareerNextResources(
  goalId: string,
  isFullyExperienced: boolean,
  allResources: readonly Resource[],
): CareerNextResources {
  const services = allResources
    .filter(isCareerService)
    .filter((r) => r.is_active && r.goal_ids.includes(goalId))
    .sort(compareByEditorial);

  if (!isFullyExperienced) {
    return {
      job_change_services: services
        .filter((r) => !r.requires_goal_experience && r.audience !== "freelance")
        .slice(0, MAX_JOB_CHANGE_SERVICES_WITHOUT_EXPERIENCE),
      freelance_services: [],
    };
  }
  return {
    job_change_services: services.filter((r) => r.audience !== "freelance").slice(0, MAX_CAREER_SERVICES),
    freelance_services: services.filter((r) => r.audience === "freelance").slice(0, MAX_CAREER_SERVICES),
  };
}
