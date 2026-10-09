import master from "@/lib/learning-path/udemy-courses.json";

/** src/lib/learning-path/udemy-courses.json の 1 講座。skill_id は学習ロードマップの any_of の skill_id */
export interface UdemyCourse {
  skill_id: string;
  title: string;
  url: string;
  instructor: string;
}

export interface UdemyCourseCard extends UdemyCourse {
  /** 講座が対応するスキルの表示名 */
  skill_name: string;
}

export interface UdemyCourseMaster {
  version: string;
  checked_at: string;
  courses: UdemyCourse[];
  /** 日本語の適切な講座が見つからなかったスキル。ロードマップの全スキルは courses か unavailable のどちらかに入る */
  unavailable: { skill_id: string; reason: string }[];
}

const MASTER: UdemyCourseMaster = master;
const BY_SKILL: ReadonlyMap<string, UdemyCourse> = new Map(MASTER.courses.map((c) => [c.skill_id, c]));

export function udemyCourse(skillId: string): UdemyCourse | undefined {
  return BY_SKILL.get(skillId);
}

/**
 * Step に表示する Udemy の講座。未習得の Step だけ、選択肢の順に 1 スキル 1 講座。
 * 習得済みの Step は学ぶ必要が無いため出さない。講座が無いスキルは飛ばす
 */
export function stepUdemyCourses(
  step: { any_of: readonly string[]; satisfied: boolean },
  skillName: (skillId: string) => string,
): UdemyCourseCard[] {
  if (step.satisfied) return [];
  return step.any_of.flatMap((skillId) => {
    const course = BY_SKILL.get(skillId);
    return course ? [{ ...course, skill_name: skillName(skillId) }] : [];
  });
}
