export const SITE_NAME = "8FitLab";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://8fitlab.com").replace(/\/+$/, "");
export const SITE_DESCRIPTION =
  "目指す職種（Goal）を選び、スキル・経験・学歴を入力すると、Goalとの一致度（Career Match）と不足スキル、日本向けの学習順（Learning Path）がわかります。";
export const ORGANIZATION_NAME = "AID CIRCLES";

/** Stack Overflow Developer Survey（ODbL）の出典表示。ODbL 4.6 により派生データベース（Skill Statistics）の入手先も示す */
export const STACK_OVERFLOW_SURVEY = {
  name: "Stack Overflow Developer Survey",
  url: "https://survey.stackoverflow.co/",
  license: "Open Database License (ODbL) v1.0",
  licenseUrl: "https://opendatacommons.org/licenses/odbl/1-0/",
  contentsLicense: "Database Contents License (DbCL) v1.0",
  contentsLicenseUrl: "https://opendatacommons.org/licenses/dbcl/1-0/",
  derivedDatabaseUrl: "https://github.com/8xaidcircles/8career/tree/main/data/statistics/skill-match",
} as const;

export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}
