-- 8FitLab スキーマ（MVP 要件定義書 v1.0 §44 / §45）
-- Supabase ダッシュボード > SQL Editor に貼り付けて実行する
--
-- 認証なし。anonymous_user_id は Cookie のランダム UUID で、個人情報は保存しない。
-- DB 操作はすべてサーバー側（secret key）から行うため、全テーブルで RLS を有効にし、
-- ポリシーは作らない（= anon / authenticated からは読み書き不可）。
-- Assessment は上書きせず、入力のたびに新しい行を作る。

CREATE TABLE IF NOT EXISTS public.assessment_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL,
    goal_id TEXT NOT NULL,
    -- 職歴の回答。entered：職種と年数を 1 件以上入力 / none：実務経験なし / skipped：回答をスキップする。
    -- 必須化の前に保存した行は NULL。unknown は skipped の旧値（読み出し時に skipped とみなす）
    experience_status TEXT CHECK (experience_status IN ('entered', 'none', 'skipped', 'unknown')),
    -- スキルを 1 つも選ばなかった理由。none_intent_to_learn：まだ無いが、これから学習を開始する / skipped：回答をスキップする。
    -- スキルを選んだ行と、この列より前に保存した行は NULL
    skill_status TEXT CHECK (skill_status IN ('none_intent_to_learn', 'skipped')),
    -- 資格を 1 つも選ばなかった理由。none：保有している資格はない / planning_to_certify：これから学習を開始する /
    -- skipped：回答をスキップする。資格を選んだ行と、この列より前に保存した行は NULL
    certification_status TEXT CHECK (certification_status IN ('none', 'planning_to_certify', 'skipped')),
    calculation_version TEXT NOT NULL,
    data_source_version TEXT NOT NULL,
    taxonomy_version TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_user
    ON public.assessment_sessions(anonymous_user_id);

CREATE TABLE IF NOT EXISTS public.assessment_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_experiences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    role_id TEXT NOT NULL,
    years NUMERIC NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.assessment_education (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    -- ユーザーが選んだ学歴（data/education/education.json の level_id。例：technical-college）
    education_level_id TEXT NOT NULL,
    -- 統計上の学歴（JobHop 5 段階）。Education Match はこの値で計算する（例：高専 → Secondary school）。
    -- 「回答をスキップする」（education_level_id = 'skipped'。旧値は 'unknown'）は NULL
    degree_id TEXT,
    -- 専攻分野。入力をやめたため新しい行は NULL（以前に保存した行のために列を残している）
    field_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.career_match_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    goal_match NUMERIC,
    skill_match NUMERIC,
    -- 算出不可（skill_only）の場合は NULL。0 点としては保存しない
    experience_match NUMERIC,
    education_match NUMERIC,
    evidence_mode TEXT NOT NULL CHECK (evidence_mode IN ('full', 'proxy', 'skill_only')),
    confidence TEXT NOT NULL CHECK (confidence IN ('moderate', 'moderate_low', 'low')),
    goal_sample_size INTEGER NOT NULL,
    calculation_version TEXT NOT NULL,
    data_source_version TEXT NOT NULL,
    taxonomy_version TEXT NOT NULL,
    -- Skill の計算方式（NULL は旧方式＝Learning Step の達成率）と、2 層の達成率の内訳
    skill_calculation_version TEXT,
    -- 技術スキル層に使った Skill Statistics の由来（出典:年:計算バージョン:k）。技術スキル層を計算しない Goal は NULL
    skill_statistics_version TEXT,
    skill_progress NUMERIC,
    tech_skill_progress NUMERIC,
    human_skill_progress NUMERIC,
    -- 適用した配分（設定が後で変わっても保存時の値を表示する）。source は default / goal / fallback
    skill_weight_tech NUMERIC,
    skill_weight_human NUMERIC,
    skill_weight_source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT career_match_results_skill_weights_check CHECK (
        (skill_weight_tech IS NULL AND skill_weight_human IS NULL AND skill_weight_source IS NULL)
        OR (
            skill_weight_tech IS NOT NULL AND skill_weight_human IS NOT NULL AND skill_weight_source IS NOT NULL
            AND skill_weight_tech >= 0 AND skill_weight_human >= 0
            AND abs(skill_weight_tech + skill_weight_human - 1) <= 0.000001
            AND skill_weight_source IN ('default', 'goal', 'fallback')
        )
    ),
    -- 旧方式（skill_calculation_version が NULL）の行は配分も NULL、2 層方式の行は配分を必ず持つ
    CONSTRAINT career_match_results_skill_version_weights_check CHECK (
        (skill_calculation_version IS NULL) = (skill_weight_source IS NULL)
    )
);

CREATE TABLE IF NOT EXISTS public.assessment_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    -- data/skills/certifications.json の cert_id
    cert_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- step_id は data/learning-paths の Learning Step（any_of のいずれかを保有すれば習得済み）
CREATE TABLE IF NOT EXISTS public.skill_gap_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    learning_order INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.learning_path_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    step_id TEXT NOT NULL,
    learning_order INTEGER NOT NULL,
    -- 判定に使った Learning Path Master（data/learning-paths）の version。列の追加前の行は NULL
    learning_path_version TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    anonymous_user_id UUID NOT NULL,
    event_name TEXT NOT NULL,
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_user ON public.events(anonymous_user_id);
CREATE INDEX IF NOT EXISTS idx_events_name ON public.events(event_name);

ALTER TABLE public.assessment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_experiences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_education ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_certifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.career_match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skill_gap_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.learning_path_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- テーブル権限はサーバー用の service_role（secret key）にのみ付与する。anon / authenticated には付与しない
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    public.assessment_sessions,
    public.assessment_skills,
    public.assessment_experiences,
    public.assessment_education,
    public.assessment_certifications,
    public.career_match_results,
    public.skill_gap_results,
    public.learning_path_results,
    public.events
TO service_role;
