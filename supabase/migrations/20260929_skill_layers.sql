-- Skill の 2 層化（技術スキル層・人間定義層）に伴うマイグレーション（MVP 要件定義書 §9〜§11 / §44）
-- Supabase ダッシュボード > SQL Editor に貼り付けて 1 回実行する。何度実行しても結果は同じ
--
-- 1. 資格の入力を保存するテーブル
-- 2. career_match_results に Skill の計算方式・内訳の列を追加（skill_calculation_version が NULL の行は旧方式）
-- 3. 保存済みの旧 skill_id を新しい skill_id に変換（data/skills/skill-migration.json の renamed / merged）
--    same / human / split_and_human は同じ ID のまま。split（backend-framework など）は
--    どれを持っていたか分からないため変換せず残す（計算では無視される）

BEGIN;

CREATE TABLE IF NOT EXISTS public.assessment_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES public.assessment_sessions(id) ON DELETE CASCADE,
    -- data/skills/certifications.json の cert_id
    cert_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_certifications ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assessment_certifications TO service_role;

ALTER TABLE public.career_match_results
    ADD COLUMN IF NOT EXISTS skill_calculation_version TEXT,
    ADD COLUMN IF NOT EXISTS skill_progress NUMERIC,
    ADD COLUMN IF NOT EXISTS tech_skill_progress NUMERIC,
    ADD COLUMN IF NOT EXISTS human_skill_progress NUMERIC;

-- renamed: shell-script → bash-shell
UPDATE public.assessment_skills SET skill_id = 'bash-shell' WHERE skill_id = 'shell-script';

-- merged: html / css → html-css（同じ Assessment に両方あれば 1 行にする）
DELETE FROM public.assessment_skills a
USING public.assessment_skills b
WHERE a.assessment_id = b.assessment_id
  AND a.skill_id IN ('html', 'css')
  AND (b.skill_id = 'html-css' OR (a.skill_id = 'css' AND b.skill_id = 'html'));
UPDATE public.assessment_skills SET skill_id = 'html-css' WHERE skill_id IN ('html', 'css');

COMMIT;
