import type { LearningPathMaster, LearningStep, SkillGap, SkillGapStep } from "./types";

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

// Learning Path の Step を、Skill Match の達成率に効くもの（data_driven）と、効かない前提・基本要件（checklist）に分ける。
// scoredSkillIds には skillMatchScope().skillIds を渡す。選択肢の一部だけが効く Step は data_driven とし、
// 効かない選択肢は scored_options に含めない
export function skillGap(
  path: LearningPathMaster,
  userSkillIds: Iterable<string>,
  scoredSkillIds: ReadonlySet<string>,
): SkillGap {
  const gap: SkillGap = { data_driven: [], checklist: [] };
  for (const step of evaluateSteps(path, userSkillIds)) {
    const scored_options = step.any_of.filter((id) => scoredSkillIds.has(id));
    if (scored_options.length > 0) gap.data_driven.push({ ...step, scored_options });
    else gap.checklist.push(step);
  }
  return gap;
}

// Skill Gap と Learning Path はどちらも「未習得 Step を learning_order 順に並べたもの」
export function learningPath(path: LearningPathMaster, userSkillIds: Iterable<string>): LearningStep[] {
  const owned = new Set(userSkillIds);
  return [...path.steps]
    .sort((a, b) => a.learning_order - b.learning_order)
    .filter((step) => !isStepSatisfied(step, owned));
}
