"use server";

import { getOrCreateAnonymousUserId } from "@/lib/anonymous-user";
import { saveAssessment } from "@/lib/assessment/repository";
import { educationIds, parseAssessmentSubmission } from "@/lib/assessment/validate";
import {
  calculateCareerMatch,
  learningPath,
  loadCareerStatistics,
  loadEducation,
  loadGoals,
  loadKnownIds,
  loadLearningPath,
  loadSkillContext,
  resolveUserSkills,
} from "@/lib/career-match";
import { recordEvent } from "@/lib/events";

export type SubmitAssessmentResult = { ok: true; assessmentId: string } | { ok: false; error: string };

export async function submitAssessment(raw: unknown): Promise<SubmitAssessmentResult> {
  const [goals, known, education] = await Promise.all([loadGoals(), loadKnownIds(), loadEducation()]);
  const parsed = parseAssessmentSubmission(raw, {
    goalIds: new Set(goals.map((goal) => goal.goal_id)),
    skillIds: known.skillIds,
    certificationIds: known.certificationIds,
    roleIds: known.roleIds,
    ...educationIds(education),
  });
  if (!parsed.ok) return parsed;
  const submission = parsed.value;

  const [stats, skillContext, path] = await Promise.all([
    loadCareerStatistics(submission.goal_id),
    loadSkillContext(submission.goal_id),
    loadLearningPath(submission.goal_id),
  ]);
  const result = calculateCareerMatch(submission, stats, skillContext, known);
  const missingSteps = learningPath(path, resolveUserSkills(submission, skillContext, known).held);

  const anonymousUserId = await getOrCreateAnonymousUserId();
  let assessmentId: string;
  try {
    assessmentId = await saveAssessment({ anonymousUserId, submission, result, missingSteps });
  } catch (error) {
    console.error(error);
    return { ok: false, error: "save_failed" };
  }

  try {
    await recordEvent(anonymousUserId, "career_match_calculated", {
      assessment_id: assessmentId,
      goal_id: submission.goal_id,
      goal_match: result.goal_match,
      evidence_mode: result.evidence_mode,
    });
  } catch (error) {
    console.error(error);
  }

  return { ok: true, assessmentId };
}
