-- Skill の結果の由来と、保存する配分の制約（MVP 要件定義書 §11 / §27 / §44）
-- 20260929_skill_layers.sql の後に、Supabase ダッシュボード > SQL Editor で 1 回実行する。何度実行しても結果は同じ
--
-- 1. 技術スキル層に使った Skill Statistics の由来（出典:年:計算バージョン:k）を保存する列
-- 2. 配分の制約：3 列とも NULL（旧方式）か、3 列とも値があり tech + human = 1・source が既定の値
-- 3. 旧方式（skill_calculation_version が NULL）の行は配分も NULL、2 層方式の行は配分を必ず持つ

BEGIN;

ALTER TABLE public.career_match_results
    ADD COLUMN IF NOT EXISTS skill_statistics_version TEXT;

ALTER TABLE public.career_match_results DROP CONSTRAINT IF EXISTS career_match_results_skill_weights_check;
ALTER TABLE public.career_match_results ADD CONSTRAINT career_match_results_skill_weights_check CHECK (
    (skill_weight_tech IS NULL AND skill_weight_human IS NULL AND skill_weight_source IS NULL)
    OR (
        skill_weight_tech IS NOT NULL AND skill_weight_human IS NOT NULL AND skill_weight_source IS NOT NULL
        AND skill_weight_tech >= 0 AND skill_weight_human >= 0
        AND abs(skill_weight_tech + skill_weight_human - 1) <= 0.000001
        AND skill_weight_source IN ('default', 'goal', 'fallback')
    )
);

ALTER TABLE public.career_match_results DROP CONSTRAINT IF EXISTS career_match_results_skill_version_weights_check;
ALTER TABLE public.career_match_results ADD CONSTRAINT career_match_results_skill_version_weights_check CHECK (
    (skill_calculation_version IS NULL) = (skill_weight_source IS NULL)
);

COMMIT;
