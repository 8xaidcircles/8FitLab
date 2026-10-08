import { layeredSkillProgress, normalizeHumanRequirements, skillMatchScope } from "./skill-layers";
import { goalSkillUnits, skillUnitSatisfied } from "./skill-score";
import type {
  LearningPathMaster,
  LearningStep,
  SkillGap,
  SkillGapStep,
  SkillGapStepScored,
  SkillScoringContext,
} from "./types";

// userSkillIds には resolveUserSkills().held を渡す（入力値のままだと、資格・ツール経由のスキルと旧 skill_id の移行が反映されず、
// Skill Match と食い違う）
//
// Skill Gap は、Learning Path の各 Step を「いまの持ちスキルで、習得すると Skill Progress が実際に上がるか」で分ける。
//   raises：上がる / credited：同じ unit・要件の別の技術で評価済み / not_scored：Skill Progress の対象外 / satisfied：習得済み
// 上がる量（gain）は、layeredSkillProgress を「いまの held」と「held に選択肢を 1 つ足した集合」で 2 回呼んだ差で求める。
// グループ・配分・人間定義層の判定を、ここに重ねて書かないため（書くと Skill Match の計算と食い違う）。
// gain は Skill Progress（達成率）の増加分。ECDF を有効にすると Skill Match は達成率と別の値になり、増加分も一致しなくなる

/** 浮動小数点の誤差で 0 にならない増加分を、0 とみなす境目 */
const GAIN_EPSILON = 1e-9;

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

// 持っているスキルで満たされている採用 unit / 要件のうち、Step の選択肢を含むものの名前（配分が 0 の層は除く）
function creditedBy(step: LearningStep, held: ReadonlySet<string>, scoring: SkillScoringContext): string[] {
  const { weights } = skillMatchScope(scoring);
  const options = new Set(step.any_of);
  const names: string[] = [];
  if (weights.tech > 0 && scoring.techStats) {
    for (const unit of goalSkillUnits(scoring.techStats)) {
      if (skillUnitSatisfied(unit, held) && unit.members.some((m) => options.has(m.skill_id))) names.push(unit.name);
    }
  }
  if (weights.human > 0) {
    for (const requirement of normalizeHumanRequirements(scoring.goalLayers.human_requirements)) {
      if (requirement.any_of.some((id) => held.has(id)) && requirement.any_of.some((id) => options.has(id))) {
        names.push(requirement.name ?? requirement.requirement_id);
      }
    }
  }
  return [...new Set(names)];
}

export function skillGap(
  path: LearningPathMaster,
  userSkillIds: Iterable<string>,
  scoring: SkillScoringContext,
): SkillGap {
  const held = new Set(userSkillIds);
  const progressWith = (extra: readonly string[]) =>
    layeredSkillProgress({ ...scoring, held: new Set([...held, ...extra]) }).progress;
  const base = progressWith([]);
  const gainOf = (extra: readonly string[]) => {
    const gain = progressWith(extra) - base;
    return gain < GAIN_EPSILON ? 0 : gain;
  };
  const scoredIds = skillMatchScope(scoring).skillIds;

  const steps: SkillGapStepScored[] = evaluateSteps(path, held).map((step) => {
    const empty = { gain: 0, option_gains: [], credited_by: [], overlaps_with: [] };
    if (step.satisfied) return { ...step, ...empty, effect: "satisfied" };
    const option_gains = step.any_of.filter((id) => scoredIds.has(id)).map((skill_id) => ({ skill_id, gain: gainOf([skill_id]) }));
    const gain = Math.max(0, ...option_gains.map((o) => o.gain));
    if (gain > 0) return { ...step, ...empty, option_gains, gain, effect: "raises" };
    if (option_gains.length > 0) return { ...step, ...empty, option_gains, effect: "credited", credited_by: creditedBy(step, held, scoring) };
    return { ...step, ...empty, effect: "not_scored" };
  });

  // 2 つの Step の選択肢を 1 つずつ同時に足した増加分が、それぞれの増加分の和より小さい組が 1 つでもあれば、同じ unit / 要件を共有している
  // （最良の選択肢どうしだけでなく、増加分のある選択肢のすべての組を見る）
  const raising = steps.filter((s) => s.effect === "raises");
  const positive = (s: SkillGapStepScored) => s.option_gains.filter((o) => o.gain > 0);
  const overlaps = (a: SkillGapStepScored, b: SkillGapStepScored) =>
    positive(a).some((x) => positive(b).some((y) => gainOf([x.skill_id, y.skill_id]) < x.gain + y.gain - GAIN_EPSILON));
  for (let i = 0; i < raising.length; i++) {
    for (let j = i + 1; j < raising.length; j++) {
      const [a, b] = [raising[i], raising[j]];
      if (overlaps(a, b)) {
        a.overlaps_with.push(b.step_id);
        b.overlaps_with.push(a.step_id);
      }
    }
  }
  return { steps };
}

/** 未習得で、習得すると Skill Progress が上がる Step（learning_order 順） */
export function raisingSteps(gap: SkillGap): SkillGapStepScored[] {
  return gap.steps.filter((s) => s.effect === "raises");
}

/** 未習得だが、習得しても Skill Progress が上がらない Step（評価済み・対象外。learning_order 順） */
export function noEffectSteps(gap: SkillGap): SkillGapStepScored[] {
  return gap.steps.filter((s) => s.effect === "credited" || s.effect === "not_scored");
}

// Skill Gap と Learning Path はどちらも「未習得 Step を learning_order 順に並べたもの」
export function learningPath(path: LearningPathMaster, userSkillIds: Iterable<string>): LearningStep[] {
  const owned = new Set(userSkillIds);
  return [...path.steps]
    .sort((a, b) => a.learning_order - b.learning_order)
    .filter((step) => !isStepSatisfied(step, owned));
}
