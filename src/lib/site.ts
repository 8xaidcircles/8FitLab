export const SITE_NAME = "8FitLab";
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://8fitlab.com").replace(/\/+$/, "");
export const SITE_DESCRIPTION =
  "目指す職種（Goal）を選び、スキル・経験・学歴を入力すると、Goalとの一致度（Career Match）と不足スキル、日本向けの学習順（Learning Path）がわかります。";
export const ORGANIZATION_NAME = "AID CIRCLES";
export const ORGANIZATION_URL = "https://8xaidcircles.com";
export const CONTACT_FORM = {
  url: "https://forms.gle/oTZjzmU8ChxcCyGH6",
  embedUrl: "https://docs.google.com/forms/d/e/1FAIpQLSfIqaxi9Twu3uw9dno9GvnbVGi2kuxgqhu21WX402EWlD30Ew/viewform?embedded=true",
} as const;
export const OPERATOR = {
  name: "8X Aid Circles",
  address: "京都府京都市下京区朱雀宝蔵町44番地協栄ビル2階京都朱雀スタジオAR-204",
  email: "8xaidcircles@gmail.com",
} as const;

const CC_BY_4_0 = { license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/deed.ja" } as const;

/** JobHop（CC BY 4.0）。表示者は Ghent University AIDA、データ提供は VDAB（欧州委員会ではない） */
export const JOBHOP = {
  name: "JobHop v2",
  url: "https://huggingface.co/datasets/aida-ugent/JobHop",
  creator: "Ghent University（AIDA）、データ提供：VDAB（ベルギー・フランダース地域公共職業安定所）",
  ...CC_BY_4_0,
} as const;

/** ESCO（© European Union, CC BY 4.0）。利用時は英語の定型文と、改変・翻訳している旨の表示が必要 */
export const ESCO = {
  name: "ESCO（European Skills, Competences, Qualifications and Occupations）v1.1.2",
  url: "https://esco.ec.europa.eu/",
  creator: "© European Union",
  statement: "This service uses the ESCO classification of the European Commission.",
  ...CC_BY_4_0,
} as const;

/** Stack Overflow Developer Survey（ODbL）の出典表示。ODbL 4.6 により派生データベース（Skill Statistics）の入手先も示す */
export const STACK_OVERFLOW_SURVEY = {
  name: "Stack Overflow Developer Survey",
  creator: "Stack Exchange, Inc.",
  years: "2023–2025",
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
