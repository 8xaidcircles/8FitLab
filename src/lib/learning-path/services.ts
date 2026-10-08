import mapping from "@/lib/learning-path-services-mapping.json";
import type { CategoryServices, LearningPathService, ServiceGroupType, UserStage } from "./types";

const MAPPING: Readonly<Record<string, CategoryServices>> = mapping;

/** 職種（Goal の name）× ステージのサービス一覧。職種がマッピングに無い、またはステージに無いグループは空配列 */
export function stageServices(goalName: string, stage: UserStage, group: ServiceGroupType): LearningPathService[] {
  const stageData: Partial<Record<ServiceGroupType, LearningPathService[]>> | undefined = MAPPING[goalName]?.[stage];
  return stageData?.[group] ?? [];
}
