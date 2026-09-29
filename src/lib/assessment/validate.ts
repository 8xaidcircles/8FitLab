import type { EducationMaster } from "@/lib/career-match/data";
import type { DegreeId, UserExperience } from "@/lib/career-match/types";

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
  certification_ids: string[];
  experiences: UserExperience[];
  // ユーザーが選んだ学歴（日本の学校区分）
  education_level_id: string | null;
  // education_level_id から導いた統計上の学歴。Education Match はこの値で計算する
  degree_id: DegreeId | null;
  field_id: string | null;
}

export interface KnownAssessmentIds {
  goalIds: ReadonlySet<string>;
  skillIds: ReadonlySet<string>;
  certificationIds: ReadonlySet<string>;
  roleIds: ReadonlySet<string>;
  // 学歴 ID → 統計上の学歴
  levelDegrees: ReadonlyMap<string, DegreeId>;
  // 専攻分野 ID → その分野を選べる学歴 ID
  fieldLevels: ReadonlyMap<string, ReadonlySet<string>>;
}

export function educationIds(education: EducationMaster): Pick<KnownAssessmentIds, "levelDegrees" | "fieldLevels"> {
  return {
    levelDegrees: new Map(education.levels.map((level) => [level.level_id, level.degree_id])),
    fieldLevels: new Map(education.fields.map((field) => [field.field_id, new Set(field.levels)])),
  };
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= LIMITS.idLength;
}

// Server Action の引数はクライアントから任意の値を送れるため、形と値の両方を検証する
export function parseAssessmentSubmission(
  raw: unknown,
  known: KnownAssessmentIds,
): ParseResult<AssessmentSubmission> {
  if (!isRecord(raw)) return { ok: false, error: "invalid_payload" };

  const { goal_id, skill_ids, experiences, education_level_id, field_id } = raw;
  // 資格の入力より前のクライアント（デプロイ直後に開いたままの画面）からは送られないため、未指定は資格なしとする
  const certification_ids = raw.certification_ids ?? [];

  if (!isId(goal_id) || !known.goalIds.has(goal_id)) return { ok: false, error: "unknown_goal" };

  if (!Array.isArray(skill_ids) || skill_ids.length > LIMITS.skills) return { ok: false, error: "invalid_skills" };
  if (!skill_ids.every((id) => isId(id) && known.skillIds.has(id))) return { ok: false, error: "unknown_skill" };

  if (!Array.isArray(certification_ids) || certification_ids.length > LIMITS.certifications) {
    return { ok: false, error: "invalid_certifications" };
  }
  if (!certification_ids.every((id) => isId(id) && known.certificationIds.has(id))) {
    return { ok: false, error: "unknown_certification" };
  }

  if (!Array.isArray(experiences) || experiences.length > LIMITS.experiences) {
    return { ok: false, error: "invalid_experiences" };
  }
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

  let level: string | null = null;
  let degree: DegreeId | null = null;
  if (education_level_id !== null && education_level_id !== undefined) {
    if (!isId(education_level_id)) return { ok: false, error: "unknown_education_level" };
    const mapped = known.levelDegrees.get(education_level_id);
    if (mapped === undefined) return { ok: false, error: "unknown_education_level" };
    level = education_level_id;
    degree = mapped;
  }

  // 専攻分野は選択肢の ID のみ受け付ける（自由入力で個人情報が混入しないようにする）
  let field: string | null = null;
  if (field_id !== null && field_id !== undefined) {
    if (!isId(field_id)) return { ok: false, error: "unknown_field" };
    const levels = known.fieldLevels.get(field_id);
    if (!levels) return { ok: false, error: "unknown_field" };
    if (level === null || !levels.has(level)) return { ok: false, error: "field_not_applicable" };
    field = field_id;
  }

  return {
    ok: true,
    value: {
      goal_id,
      skill_ids: [...new Set(skill_ids as string[])],
      certification_ids: [...new Set(certification_ids as string[])],
      experiences: parsedExperiences,
      education_level_id: level,
      degree_id: degree,
      field_id: field,
    },
  };
}
