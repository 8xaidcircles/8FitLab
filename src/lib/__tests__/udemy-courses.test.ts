import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { stepUdemyCourses, type UdemyCourseMaster } from "@/lib/learning-path/udemy";

const master = JSON.parse(
  await readFile(path.join(process.cwd(), "src", "lib", "learning-path", "udemy-courses.json"), "utf-8"),
) as UdemyCourseMaster;

const pathsDir = path.join(process.cwd(), "data", "learning-paths");
const roadmapSkillIds = new Set(
  (
    await Promise.all(
      (await readdir(pathsDir))
        .filter((file) => file.endsWith(".json"))
        .map(async (file) => JSON.parse(await readFile(path.join(pathsDir, file), "utf-8")) as { steps: { any_of: string[] }[] }),
    )
  ).flatMap((p) => p.steps.flatMap((s) => s.any_of)),
);

describe("udemy-courses.json", () => {
  const courseIds = master.courses.map((c) => c.skill_id);
  const unavailableIds = master.unavailable.map((u) => u.skill_id);

  it("ロードマップの全スキルが、講座か「講座なし」のどちらか一方にだけ入る", () => {
    expect(new Set(courseIds).size).toBe(courseIds.length);
    expect(new Set(unavailableIds).size).toBe(unavailableIds.length);
    for (const id of courseIds) expect(unavailableIds, id).not.toContain(id);
    expect([...courseIds, ...unavailableIds].sort()).toEqual([...roadmapSkillIds].sort());
  });

  it("講座は Udemy の講座ページの URL で、講座名・講師がある", () => {
    for (const course of master.courses) {
      expect(course.url, course.skill_id).toMatch(/^https:\/\/www\.udemy\.com\/course\/[a-z0-9_-]+\/$/i);
      expect(course.title.trim(), course.skill_id).not.toBe("");
      expect(course.instructor.trim(), course.skill_id).not.toBe("");
    }
    for (const u of master.unavailable) expect(u.reason.trim(), u.skill_id).not.toBe("");
  });

  it("習得済みの Step には出さず、未習得の Step には選択肢の順に講座のあるスキルだけ出す", () => {
    const [first, second] = master.courses;
    const name = (id: string) => `name:${id}`;
    const anyOf = [first.skill_id, "no-such-skill", second.skill_id];
    expect(stepUdemyCourses({ any_of: anyOf, satisfied: true }, name)).toEqual([]);
    expect(stepUdemyCourses({ any_of: anyOf, satisfied: false }, name).map((c) => [c.skill_id, c.skill_name])).toEqual([
      [first.skill_id, name(first.skill_id)],
      [second.skill_id, name(second.skill_id)],
    ]);
  });
});
