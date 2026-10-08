import type { EducationMaster } from "@/lib/career-match/data";
import {
  CERTIFICATION_STATUSES,
  EXPERIENCE_STATUSES,
  LEGACY_SKIPPED_VALUE,
  SKILL_STATUSES,
  SKIPPED_EDUCATION_LEVEL_ID,
  type CertificationStatus,
  type DegreeId,
  type ExperienceStatus,
  type SkillStatus,
  type UserExperience,
} from "@/lib/career-match/types";

export const LIMITS = {
  skills: 100,
  certifications: 50,
  experiences: 20,
  idLength: 64,
  maxYears: 50,
} as const;

export interface AssessmentSubmission {
  goal_id: string;
  // 技術スキル層・人間定義層の skill_id と、人間定義層のツールの tool_id
  skill_ids: string[];
  // スキルを 1 つも選ばなかった理由。スキルを選んだとき（と、この項目より前の画面から送られたとき）は null
  skill_status: SkillStatus | null;
  certification_ids: string[];
  // 資格を 1 つも選ばなかった理由。資格を選んだとき（と、この項目より前の画面から送られたとき）は null
  certification_status: CertificationStatus | null;
  experience_status: ExperienceStatus;
  // experience_status が entered のときだけ 1 件以上。none / skipped は空
  experiences: UserExperience[];
  // ユーザーが選んだ学歴（日本の学校区分。「回答をスキップする」も 1 つの選択肢）
  education_level_id: string;
  // education_level_id から導いた統計上の学歴。Education Match はこの値で計算する。「回答をスキップする」は null
  degree_id: DegreeId | null;
}

export interface KnownAssessmentIds {
  goalIds: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  certificationIds: ReadonlySet<string>;
  roleIds: ReadonlySet<string>;
  // 学歴 ID → 統計上の学歴（「回答をスキップする」は null）
  levelDegrees: ReadonlyMap<string, DegreeId | null>;
}

export function educationIds(education: EducationMaster): Pick<KnownAssessmentIds, "levelDegrees"> {
  return {
    levelDegrees: new Map(education.levels.map((level) => [level.level_id, level.degree_id])),
  };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= LIMITS.idLength;
}

const INVALID = Symbol("invalid");

// undefined は、選ばなくても送信できた以前の画面から送られた場合。null と同じく理由なしとする
function parseStatus<T extends string>(value: unknown, allowed: readonly T[]): T | null | typeof INVALID {
  if (value === undefined || value === null) return null;
  return allowed.includes(value as T) ? (value as T) : INVALID;
}

const fromLegacySkipped = (value: unknown, skipped: string) => (value === LEGACY_SKIPPED_VALUE ? skipped : value);

// Server Action の引数はクライアントから任意の値を送れるため、形と値の両方を検証する
export function parseAssessmentSubmission(
  raw: unknown,
  known: KnownAssessmentIds,
): ParseResult<AssessmentSubmission> {
  if (!isRecord(raw)) return { ok: false, error: "invalid_payload" };

  // 専攻分野（field_id）は入力をやめた。開いたままの古い画面から送られても無視する
  const { goal_id, skill_ids, experiences } = raw;
  // 資格の入力より前のクライアント（デプロイ直後に開いたままの画面）からは送られないため、未指定は資格なしとする
  const certification_ids = raw.certification_ids ?? [];
  const experience_status = fromLegacySkipped(raw.experience_status, "skipped");
  const education_level_id = fromLegacySkipped(raw.education_level_id, SKIPPED_EDUCATION_LEVEL_ID);

  if (!isId(goal_id) || !known.goalIds.has(goal_id)) return { ok: false, error: "unknown_goal" };

  if (!Array.isArray(skill_ids) || skill_ids.length > LIMITS.skills) return { ok: false, error: "invalid_skills" };
  if (!skill_ids.every((id) => isId(id) && known.skillIds.has(id))) return { ok: false, error: "unknown_skill" };
  const skill_status = parseStatus(raw.skill_status, SKILL_STATUSES);
  if (skill_status === INVALID || (skill_status !== null && skill_ids.length > 0)) {
    return { ok: false, error: "invalid_skills" };
  }
  if (raw.skill_status === null && skill_ids.length === 0) return { ok: false, error: "skills_required" };

  if (!Array.isArray(certification_ids) || certification_ids.length > LIMITS.certifications) {
    return { ok: false, error: "invalid_certifications" };
  }
  if (!certification_ids.every((id) => isId(id) && known.certificationIds.has(id))) {
    return { ok: false, error: "unknown_certification" };
  }
  const certification_status = parseStatus(raw.certification_status, CERTIFICATION_STATUSES);
  if (certification_status === INVALID || (certification_status !== null && certification_ids.length > 0)) {
    return { ok: false, error: "invalid_certifications" };
  }
  if (raw.certification_status === null && certification_ids.length === 0) {
    return { ok: false, error: "certifications_required" };
  }

  if (!EXPERIENCE_STATUSES.includes(experience_status as ExperienceStatus)) {
    return { ok: false, error: "experience_required" };
  }
  if (!Array.isArray(experiences) || experiences.length > LIMITS.experiences) {
    return { ok: false, error: "invalid_experiences" };
  }
  if (experience_status !== "entered" && experiences.length > 0) return { ok: false, error: "invalid_experiences" };
  if (experience_status === "entered" && experiences.length === 0) return { ok: false, error: "experience_rows_required" };
  const parsedExperiences: UserExperience[] = [];
  for (const experience of experiences) {
    if (!isRecord(experience)) return { ok: false, error: "invalid_experiences" };
    const { role_id, years } = experience;
    if (!isId(role_id) || !known.roleIds.has(role_id)) return { ok: false, error: "unknown_role" };
    if (typeof years !== "number" || !Number.isFinite(years) || years <= 0 || years > LIMITS.maxYears) {
      return { ok: false, error: "invalid_years" };
    }
    parsedExperiences.push({ role_id, years });
  }

  if (education_level_id === null || education_level_id === undefined || education_level_id === "") {
    return { ok: false, error: "education_required" };
  }
  if (!isId(education_level_id)) return { ok: false, error: "unknown_education_level" };
  const degree = known.levelDegrees.get(education_level_id);
  if (degree === undefined) return { ok: false, error: "unknown_education_level" };

  return {
    ok: true,
    value: {
      goal_id,
      skill_ids: [...new Set(skill_ids as string[])],
      skill_status,
      certification_ids: [...new Set(certification_ids as string[])],
      certification_status,
      experience_status: experience_status as ExperienceStatus,
      experiences: parsedExperiences,
      education_level_id,
      degree_id: degree,
    },
  };
}
