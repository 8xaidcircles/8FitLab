import type {
  CertificationCategory,
  CertificationStatus,
  Confidence,
  DegreeId,
  EvidenceMode,
  ExperienceStatus,
  HumanSkillDomain,
  SkillLayerWeightSource,
  SkillScoringMethod,
  SkillStatus,
  SkillUnitRole,
  SKIPPED_EDUCATION_LEVEL_ID,
} from "@/lib/career-match/types";

/** 職歴の回答（診断フォームの選択肢の表示順） */
export const EXPERIENCE_STATUS_LABELS: Record<ExperienceStatus, string> = {
  entered: "実務経験がある",
  none: "実務経験なし",
  skipped: "回答をスキップする",
};

/** 統計上の学歴（data/education/education.json の degree_id）の表示名 */
export const DEGREE_LABELS: Record<DegreeId, string> = {
  None: "中学校",
  "Secondary school": "高校・専門学校・高専・短大",
  Bachelor: "大学（学士）",
  Master: "大学院（修士）",
  PhD: "大学院（博士）",
};

/** data/skills/certifications.json の category（表示順） */
export const CERTIFICATION_CATEGORIES: { id: CertificationCategory; name: string }[] = [
  { id: "it-general", name: "情報処理技術者試験（IPA）" },
  { id: "programming", name: "プログラミング言語・データベース" },
  { id: "cloud", name: "クラウド・コンテナ" },
  { id: "infrastructure", name: "ネットワーク・Linux" },
  { id: "data-ai", name: "データ分析・AI" },
  { id: "management", name: "プロジェクト管理・アジャイル" },
  { id: "design-quality", name: "デザイン・テスト" },
];

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

/** 「Skill の内訳」で、技術スキル層の unit がどちらのリストに入っているか */
export function skillUnitRoleLabel(roles: readonly SkillUnitRole[]): string {
  const base = roles.includes("base");
  const distinctive = roles.includes("distinctive");
  if (base && distinctive) return "基本＋特有";
  if (base) return "基本技術";
  if (distinctive) return "特有技術";
  throw new Error(`Skill unit has no list role: [${roles.join(", ")}]`);
}

/** Skill Match のスコアリング方式（career_match_results.skill_scoring_method） */
export const SKILL_SCORING_METHOD_LABELS: Record<SkillScoringMethod, string> = {
  linear: "達成率をそのまま点数に換算",
  ecdf: "同じGoalを目指す利用者内での位置",
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

/** スキルを個別に選ばない人の選択肢（診断フォームの表示順） */
export const SKILL_STATUS_LABELS: Record<SkillStatus, string> = {
  none: "保有しているスキルはない",
  none_intent_to_learn: "これから学習を開始する",
  skipped: "回答をスキップする",
};

/** 資格を個別に選ばない人の選択肢（診断フォームの表示順） */
export const CERTIFICATION_STATUS_LABELS: Record<CertificationStatus, string> = {
  none: "保有している資格はない",
  planning_to_certify: "これから学習を開始する",
  skipped: "回答をスキップする",
};

/** 最終学歴を選ばない人の選択肢（data/education/education.json の level_id） */
export const EDUCATION_STATUS_LABELS: Record<typeof SKIPPED_EDUCATION_LEVEL_ID, string> = {
  skipped: "回答をスキップする",
};

export const SUBMIT_ERRORS: Record<string, string> = {
  skills_required:
    "持っているスキルを選ぶか、「保有しているスキルはない」「これから学習を開始する」「回答をスキップする」のいずれかを選んでください。",
  certifications_required:
    "資格を選ぶか、「保有している資格はない」「これから学習を開始する」「回答をスキップする」のいずれかを選んでください。",
  invalid_skills: "スキルの入力内容に誤りがあります。ページを再読み込みしてもう一度お試しください。",
  invalid_certifications: "資格の入力内容に誤りがあります。ページを再読み込みしてもう一度お試しください。",
  unknown_goal: "Goalを選んでください。",
  unknown_skill: "選択肢に無いスキルが含まれています。ページを再読み込みしてもう一度お試しください。",
  unknown_certification: "選択肢に無い資格が含まれています。ページを再読み込みしてもう一度お試しください。",
  experience_required: "職務経歴は「実務経験がある」「実務経験なし」「回答をスキップする」のいずれかを選んでください。",
  experience_rows_required: "職種と年数を入力した職歴を1件以上追加してください。",
  education_required: "最終学歴を選ぶか、「回答をスキップする」を選んでください。",
  save_failed: "結果の保存に失敗しました。時間をおいてもう一度お試しください。",
};

/** 計算ボタン直上の未入力まとめ。各欄の赤文字は SUBMIT_ERRORS の説明文のまま */
export const MISSING_INPUT_SUMMARIES = {
  skills_required: "スキルが未入力です。",
  certifications_required: "資格が未入力です。",
  experience_required: "職務経歴が未入力です。",
  education_required: "最終学歴が未入力です。",
} as const;

export function formatPercent(value: number): string {
  return `${Math.round(value)}`;
}
