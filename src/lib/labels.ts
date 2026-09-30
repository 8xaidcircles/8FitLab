import type {
  Confidence,
  EvidenceMode,
  HumanSkillDomain,
  LearningResource,
  Resource,
  SkillLayerWeightSource,
} from "@/lib/career-match/types";

export const RESOURCE_TYPE_LABELS: Record<Resource["type"], string> = {
  book: "書籍",
  online_course: "オンライン講座",
  free_doc: "無料ドキュメント",
  school: "スクール",
  job_service: "キャリアサービス",
};

export const RESOURCE_LEVEL_LABELS: Record<LearningResource["level"], string> = {
  beginner: "初級",
  intermediate: "中級",
  advanced: "上級",
  all: "全対応",
};

/** data/skills/tech-skills.json の category（表示順） */
export const TECH_SKILL_CATEGORIES: { id: string; name: string }[] = [
  { id: "language", name: "プログラミング言語" },
  { id: "framework", name: "フレームワーク" },
  { id: "library", name: "ライブラリ" },
  { id: "database", name: "データベース" },
  { id: "cloud", name: "クラウド" },
  { id: "infrastructure", name: "インフラ・コンテナ" },
  { id: "build_tool", name: "ビルドツール・パッケージ管理" },
  { id: "dev_env", name: "開発環境・エディタ" },
];

/** data/skills/human-skills.json の domain（表示順） */
export const HUMAN_SKILL_DOMAINS: { id: HumanSkillDomain; name: string }[] = [
  { id: "methodology_process", name: "手法・工程" },
  { id: "knowledge_concepts", name: "知識・概念" },
  { id: "management_business_tools", name: "マネジメント・ビジネス" },
];

export const SKILL_LAYER_WEIGHT_SOURCE_LABELS: Record<SkillLayerWeightSource, string> = {
  default: "標準の配分",
  goal: "このGoal用の配分",
  fallback: "片方の層が無いため、もう片方で100%",
};

export const EVIDENCE_LABELS: Record<EvidenceMode, string> = {
  full: "職業データに基づく",
  proxy: "近い職業のデータで代用",
  skill_only: "スキルのみで算出",
};

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  moderate: "中",
  moderate_low: "やや低",
  low: "低",
};

export const SUBMIT_ERRORS: Record<string, string> = {
  unknown_goal: "Goalを選んでください。",
  unknown_skill: "選択肢に無いスキルが含まれています。ページを再読み込みしてもう一度お試しください。",
  unknown_certification: "選択肢に無い資格が含まれています。ページを再読み込みしてもう一度お試しください。",
  save_failed: "結果の保存に失敗しました。時間をおいてもう一度お試しください。",
};

export function formatPercent(value: number): string {
  return `${Math.round(value)}`;
}
