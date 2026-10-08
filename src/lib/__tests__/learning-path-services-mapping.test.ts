import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

type School = {
  id: string;
  name: string;
  url: string;
  beginner_friendly: boolean | null;
  job_category_matched: boolean;
};

type Service = {
  id: string;
  name: string;
  url: string;
  novice_support: boolean | null;
  freelance_available: boolean | null;
  job_category_matched: boolean;
};

type CategoryMapping = {
  learning: { schools: School[]; services: Service[] };
  ready: { services: Service[]; schools: School[] };
  experienced: { services: Service[]; schools: School[]; freelance: Service[] };
};

const mapping = JSON.parse(
  await readFile(path.join(process.cwd(), "src", "lib", "learning-path-services-mapping.json"), "utf-8"),
) as Record<string, CategoryMapping>;
const goalNames = (
  JSON.parse(await readFile(path.join(process.cwd(), "data", "goals", "goals.json"), "utf-8")) as {
    goals: { name: string }[];
  }
).goals.map((goal) => goal.name);

const lists = (m: CategoryMapping) => [
  m.learning.schools,
  m.learning.services,
  m.ready.services,
  m.ready.schools,
  m.experienced.services,
  m.experienced.schools,
  m.experienced.freelance,
];

describe("learning-path-services-mapping.json", () => {
  it("covers exactly the Goal names", () => {
    expect(Object.keys(mapping).sort()).toEqual([...goalNames].sort());
  });

  it.each(Object.entries(mapping))("%s: follows the stage rules", (_, m) => {
    for (const list of lists(m)) {
      expect(new Set(list.map((entry) => entry.id)).size).toBe(list.length);
      for (const entry of list) expect(entry.url).toMatch(/^https:\/\//);
    }

    expect(m.learning.schools.every((s) => s.beginner_friendly === true && s.job_category_matched)).toBe(true);
    expect(m.learning.services.every((s) => s.novice_support === true && s.job_category_matched)).toBe(true);
    expect(m.ready.schools.every((s) => s.job_category_matched)).toBe(true);
    expect(m.ready.services.every((s) => s.job_category_matched)).toBe(true);
    expect(m.experienced.services.every((s) => s.job_category_matched && s.freelance_available !== true)).toBe(true);
    expect(m.experienced.freelance.every((s) => s.freelance_available === true)).toBe(true);

    const freelanceIds = new Set(m.experienced.freelance.map((s) => s.id));
    expect(m.experienced.services.some((s) => freelanceIds.has(s.id))).toBe(false);
    const matchedFreelance = m.ready.services.filter((s) => s.freelance_available === true).map((s) => s.id);
    expect(m.experienced.freelance.slice(0, matchedFreelance.length).map((s) => s.id)).toEqual(matchedFreelance);
  });

  it("records every attribute on every entry", () => {
    for (const m of Object.values(mapping)) {
      for (const school of [...m.ready.schools, ...m.learning.schools]) {
        expect(school).toHaveProperty("beginner_friendly");
        expect(school).toHaveProperty("job_category_matched");
      }
      for (const service of [...m.ready.services, ...m.experienced.freelance]) {
        expect(service).toHaveProperty("novice_support");
        expect(service).toHaveProperty("freelance_available");
        expect(service).toHaveProperty("job_category_matched");
      }
    }
  });
});
