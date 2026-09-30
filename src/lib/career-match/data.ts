import { readFile } from "node:fs/promises";
import path from "node:path";
import type { KnownIds, SkillContext } from "./calculate";
import type { SkillMigrationMapping } from "./skill-migration";
import type {
  CareerStatistics,
  Certification,
  DegreeId,
  GoalSkillLayers,
  HumanSkill,
  LearningPathMaster,
  MappingStatus,
  Resource,
  SkillLayersMaster,
  SkillStatistics,
} from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const GOAL_ID_PATTERN = /^[a-z0-9-]+$/;

export interface Goal {
  goal_id: string;
  display_name: string;
  name: string;
  summary: string;
  mapping_status: MappingStatus;
  requirement_groups: GoalRequirementGroup[];
  /** true の Goal は、全 Learning Step に教材が 1 件以上ある（Data Test で保証） */
  learning_resources_ready: boolean;
}

export interface GoalRequirementGroup {
  group_id: string;
  name: string;
  occupations: { code: string; label: string }[];
}

export function goalOccupations(goal: Goal): { code: string; label: string }[] {
  return goal.requirement_groups.flatMap((group) => group.occupations);
}

export interface Role {
  role_id: string;
  label: string;
  alt_labels: string[];
  jobhop_persons: number;
}

export interface EducationLevel {
  level_id: string;
  name: string;
  // Career Statistics（JobHop 5 段階）での扱い。Education Match はこの値で計算する
  degree_id: DegreeId;
  isced: number;
  field_selectable: boolean;
  mapping_note?: string;
}

export interface EducationField {
  field_id: string;
  name: string;
  levels: string[];
}

export interface EducationMaster {
  levels: EducationLevel[];
  fields: EducationField[];
}

const cache = new Map<string, Promise<unknown>>();

function readJson<T>(relativePath: string): Promise<T> {
  let entry = cache.get(relativePath);
  if (!entry) {
    entry = readFile(path.join(DATA_DIR, relativePath), "utf-8").then((text) => JSON.parse(text));
    entry.catch(() => cache.delete(relativePath));
    cache.set(relativePath, entry);
  }
  return entry as Promise<T>;
}

export async function loadGoals(): Promise<Goal[]> {
  return (await readJson<{ goals: Goal[] }>("goals/goals.json")).goals;
}

export interface TechSkill {
  skill_id: string;
  name: string;
  category: string;
  so_items: string[];
  note?: string;
}

export async function loadTechSkills(): Promise<TechSkill[]> {
  return (await readJson<{ skills: TechSkill[] }>("skills/tech-skills.json")).skills;
}

export async function loadHumanSkills(): Promise<HumanSkill[]> {
  return (await readJson<{ skills: HumanSkill[] }>("skills/human-skills.json")).skills;
}

export async function loadCertifications(): Promise<Certification[]> {
  return (await readJson<{ certifications: Certification[] }>("skills/certifications.json")).certifications;
}

export async function loadSkillLayersMaster(): Promise<SkillLayersMaster> {
  const { default_layer_weights, goals } = await readJson<SkillLayersMaster>("skills/goal-skill-layers.json");
  return { default_layer_weights, goals };
}

export async function loadGoalSkillLayers(goalId: string): Promise<GoalSkillLayers> {
  await assertGoalId(goalId);
  const layers = (await loadSkillLayersMaster()).goals.find((g) => g.goal_id === goalId);
  if (!layers) throw new Error(`Skill layers are not defined for goal: ${goalId}`);
  return layers;
}

export async function loadSkillMigration(): Promise<SkillMigrationMapping[]> {
  return (await readJson<{ mappings: SkillMigrationMapping[] }>("skills/skill-migration.json")).mappings;
}

export async function loadRoles(): Promise<Role[]> {
  return (await readJson<{ roles: Role[] }>("career/roles.json")).roles;
}

export interface RoleGroup {
  group_id: string;
  name: string;
  roles: { role_id: string; name: string }[];
}

export async function loadRoleGroups(): Promise<RoleGroup[]> {
  return (await readJson<{ groups: RoleGroup[] }>("career/roles-ja.json")).groups;
}

export async function loadEducation(): Promise<EducationMaster> {
  const { levels, fields } = await readJson<EducationMaster>("education/education.json");
  return { levels, fields };
}

export async function loadKnownIds(): Promise<KnownIds> {
  const [names, certifications, roles] = await Promise.all([loadSkillNames(), loadCertifications(), loadRoles()]);
  return {
    skillIds: new Set(names.keys()),
    certificationIds: new Set(certifications.map((cert) => cert.cert_id)),
    roleIds: new Set(roles.map((role) => role.role_id)),
  };
}

/** 技術スキル層・人間定義層の skill_id と、人間定義層のツールの tool_id → 表示名 */
export async function loadSkillNames(): Promise<Map<string, string>> {
  const [techSkills, humanSkills] = await Promise.all([loadTechSkills(), loadHumanSkills()]);
  const names = new Map<string, string>();
  for (const skill of techSkills) names.set(skill.skill_id, skill.name);
  for (const skill of humanSkills) {
    names.set(skill.skill_id, skill.name);
    for (const tool of skill.tools ?? []) names.set(tool.tool_id, tool.name);
  }
  return names;
}

export async function loadSkillContext(goalId: string): Promise<SkillContext> {
  const [techStats, goalLayers, master, humanSkills, certifications, skillMigration] = await Promise.all([
    loadSkillStatistics(goalId),
    loadGoalSkillLayers(goalId),
    loadSkillLayersMaster(),
    loadHumanSkills(),
    loadCertifications(),
    loadSkillMigration(),
  ]);
  return {
    techStats,
    goalLayers,
    defaultWeights: master.default_layer_weights,
    humanSkills,
    certifications,
    skillMigration,
  };
}

async function assertGoalId(goalId: string): Promise<void> {
  const goals = await loadGoals();
  if (!GOAL_ID_PATTERN.test(goalId) || !goals.some((goal) => goal.goal_id === goalId)) {
    throw new Error(`Unknown goal: ${goalId}`);
  }
}

export async function loadCareerStatistics(goalId: string): Promise<CareerStatistics> {
  await assertGoalId(goalId);
  return readJson<CareerStatistics>(`statistics/career-match/${goalId}.json`);
}

/** 技術スキル統計が無い Goal は null（Skill Progress は人間定義層だけで計算する） */
export async function loadSkillStatistics(goalId: string): Promise<SkillStatistics | null> {
  await assertGoalId(goalId);
  try {
    return await readJson<SkillStatistics>(`statistics/skill-match/${goalId}.json`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

export async function loadResources(): Promise<Resource[]> {
  return (await readJson<{ resources: Resource[] }>("resources/resources.json")).resources;
}

export async function loadLearningPath(goalId: string): Promise<LearningPathMaster> {
  await assertGoalId(goalId);
  return readJson<LearningPathMaster>(`learning-paths/${goalId}.json`);
}
