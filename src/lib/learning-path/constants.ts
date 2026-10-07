import type { ServiceGroupType, UserStage } from "./types";

/**
 * プログラミング言語として扱う skill_id。選択肢がすべてここに含まれる Step を「基礎：プログラミング言語」に分ける。
 * nodejs（JavaScript の実行環境）と bash-shell（シェルスクリプト）は、Learning Path では言語の選択肢として並ぶため含める
 */
export const LANGUAGE_SKILL_IDS: ReadonlySet<string> = new Set([
  "javascript",
  "typescript",
  "python",
  "java",
  "csharp",
  "go",
  "rust",
  "cpp",
  "kotlin",
  "swift",
  "php",
  "ruby",
  "scala",
  "r",
  "sql",
  "nodejs",
  "bash-shell",
]);

/** この年数以上、Goal の職業に就いていれば experienced とする */
export const EXPERIENCED_MIN_YEARS = 0.5;

export const STAGE_LABELS: Record<UserStage, { title: string; description: string }> = {
  learning: {
    title: "学習中",
    description: "まだ習得していないスキルがあります。未経験から学べるスクールで、未習得のスキルから順に身につけましょう。",
  },
  ready: {
    title: "転職準備OK",
    description: "学習ロードマップのスキルをすべて習得済みです。転職サービスで、この職種の求人を探しましょう。",
  },
  experienced: {
    title: "実務経験あり",
    description: "この職種の実務経験があります。経験者向けの転職サービスやフリーランス案件で、キャリアアップを目指しましょう。",
  },
};

/** ステージごとのサービスの表示順 */
export const SERVICE_GROUP_ORDER: Record<UserStage, readonly ServiceGroupType[]> = {
  learning: ["schools", "services"],
  ready: ["services", "schools"],
  experienced: ["services", "freelance", "schools"],
};

export const SERVICE_GROUP_TITLES: Record<UserStage, Partial<Record<ServiceGroupType, string>>> = {
  learning: { schools: "未経験から学べるスクール", services: "未経験者を支援する転職サービス" },
  ready: { services: "この職種の求人を扱う転職サービス", schools: "スキルを深めるスクール（参考）" },
  experienced: {
    services: "経験者向けの転職サービス",
    freelance: "フリーランス・業務委託の案件サービス",
    schools: "スキルアップ向けのスクール（参考）",
  },
};
