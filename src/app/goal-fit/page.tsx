import type { Metadata } from "next";
import { TrackView } from "@/components/track-view";
import {
  loadCertifications,
  loadEducation,
  loadGoals,
  loadHumanSkills,
  loadLearningPath,
  loadRoleGroups,
  loadRoles,
  loadSkillContext,
  loadTechSkills,
  skillMatchScope,
  type SkillContext,
} from "@/lib/career-match";
import type { Certification, HumanSkill, LearningPathMaster } from "@/lib/career-match/types";
import { CERTIFICATION_CATEGORIES, HUMAN_SKILL_DOMAINS, TECH_SKILL_CATEGORIES } from "@/lib/labels";
import { AssessmentForm } from "./assessment-form";

export const metadata: Metadata = {
  title: "Goal Fit",
  description: "目指す職種（Goal）とあなたのスキル・経験・学歴の一致度を診断します。",
  alternates: { canonical: "/goal-fit" },
};

// Goal に関係する選択肢 = 計算に使う層（配分が 0 の層は除く）の技術スキル・人間定義層の要件 ∪ Learning Path の Step
// ∪ それらの人間定義層スキルに結び付くツール ∪ それらを証明する資格
function goalRelevantIds(
  context: SkillContext,
  path: LearningPathMaster,
  humanSkills: readonly HumanSkill[],
  certifications: readonly Certification[],
): string[] {
  const ids = new Set(
    skillMatchScope({
      techStats: context.techStats,
      goalLayers: context.goalLayers,
      defaultWeights: context.defaultWeights,
    }).skillIds,
  );
  for (const step of path.steps) for (const id of step.any_of) ids.add(id);
  for (const skill of humanSkills) {
    if (ids.has(skill.skill_id)) for (const tool of skill.tools ?? []) ids.add(tool.tool_id);
  }
  for (const cert of certifications) {
    if (cert.proves.some((id) => ids.has(id))) ids.add(cert.cert_id);
  }
  return [...ids];
}

export default async function GoalFitPage({ searchParams }: PageProps<"/goal-fit">) {
  const [{ goal }, goals, techSkills, humanSkills, certifications, roleGroups, roles, education] = await Promise.all([
    searchParams,
    loadGoals(),
    loadTechSkills(),
    loadHumanSkills(),
    loadCertifications(),
    loadRoleGroups(),
    loadRoles(),
    loadEducation(),
  ]);

  const relevantByGoal = Object.fromEntries(
    await Promise.all(
      goals.map(async (g) => {
        const [context, path] = await Promise.all([loadSkillContext(g.goal_id), loadLearningPath(g.goal_id)]);
        return [g.goal_id, goalRelevantIds(context, path, humanSkills, certifications)] as const;
      }),
    ),
  );

  const techGroups = TECH_SKILL_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    options: techSkills
      .filter((s) => s.category === category.id)
      .map((s) => ({ id: s.skill_id, name: s.name }))
      .sort((a, b) => a.name.localeCompare(b.name, "en")),
  })).filter((group) => group.options.length > 0);

  const humanGroups = HUMAN_SKILL_DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    options: humanSkills
      .filter((s) => s.domain === domain.id)
      .map((s) => ({ id: s.skill_id, name: s.name, description: s.description })),
  })).filter((group) => group.options.length > 0);

  const toolGroups = HUMAN_SKILL_DOMAINS.map((domain) => ({
    id: domain.id,
    name: domain.name,
    options: humanSkills
      .filter((s) => s.domain === domain.id)
      .flatMap((s) => (s.tools ?? []).map((t) => ({ id: t.tool_id, name: t.name, description: `${s.name}の経験として扱います` }))),
  })).filter((group) => group.options.length > 0);

  const certificationGroups = CERTIFICATION_CATEGORIES.map((category) => ({
    id: category.id,
    name: category.name,
    options: certifications
      .filter((c) => c.category === category.id)
      .map((c) => ({ id: c.cert_id, name: c.name, description: c.issuer })),
  })).filter((group) => group.options.length > 0);

  const initialGoal = typeof goal === "string" && goals.some((g) => g.goal_id === goal) ? goal : null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <TrackView event="page_viewed" data={{ path: "/goal-fit" }} />
      <h1 className="text-2xl font-extrabold md:text-3xl">Goal Fit</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        Goalを選び、今のスキル・資格・職歴・学歴を入力してください。氏名や連絡先などの個人情報は入力しません。
      </p>
      <AssessmentForm
        goals={goals.map(({ goal_id, name, summary }) => ({ goal_id, name, summary }))}
        relevantByGoal={relevantByGoal}
        techGroups={techGroups}
        humanGroups={humanGroups}
        toolGroups={toolGroups}
        certificationGroups={certificationGroups}
        roleGroups={roleGroups}
        allRoles={roles.map(({ role_id, label }) => ({ role_id, label }))}
        education={education}
        initialGoal={initialGoal}
      />
    </div>
  );
}
