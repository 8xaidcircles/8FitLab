import type { LearningPathMaster, LearningStep, SkillGapStep } from "./types";

// userSkillIds には resolveUserSkills().held を渡す（入力値のままだと、資格・ツール経由のスキルと旧 skill_id の移行が反映されず、
// Skill Match と食い違う）

export function isStepSatisfied(step: LearningStep, userSkillIds: ReadonlySet<string>): boolean {
  return step.any_of.some((skillId) => userSkillIds.has(skillId));
}

export function satisfiedStepIds(path: LearningPathMaster, userSkillIds: Iterable<string>): Set<string> {
  const owned = new Set(userSkillIds);
  return new Set(path.steps.filter((step) => isStepSatisfied(step, owned)).map((step) => step.step_id));
}

export function evaluateSteps(path: LearningPathMaster, userSkillIds: Iterable<string>): SkillGapStep[] {
  const owned = new Set(userSkillIds);
  return [...path.steps]
    .sort((a, b) => a.learning_order - b.learning_order)
    .map((step) => ({ ...step, satisfied: isStepSatisfied(step, owned) }));
}

// Skill Gap と Learning Path はどちらも「未習得 Step を learning_order 順に並べたもの」
export function learningPath(path: LearningPathMaster, userSkillIds: Iterable<string>): LearningStep[] {
  const owned = new Set(userSkillIds);
  return [...path.steps]
    .sort((a, b) => a.learning_order - b.learning_order)
    .filter((step) => !isStepSatisfied(step, owned));
}
