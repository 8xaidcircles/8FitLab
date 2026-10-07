-- Skill Match のスコアリング方式と、ECDF に使った分布の由来を保存する（MVP 要件定義書 §11 / §44）
-- Supabase ダッシュボード > SQL Editor で実行する。何度実行しても結果は同じ
-- アプリは保存時にこの 3 列へ書き込むため、この SQL を実行してからデプロイする
--
-- 1. skill_scoring_method：linear（達成率をそのまま点数にする）/ ecdf（同じ Goal の利用者内での位置）
--    既存の行はすべて linear になる（本番で ECDF の結果は無い）
-- 2. skill_distribution_sample_size / skill_distribution_version：ECDF に使った分布の標本数とバージョン。linear は NULL
-- 3. 方式と分布の列の整合：linear なら分布の 2 列は NULL、ecdf なら標本数 100 以上・バージョンあり

BEGIN;

ALTER TABLE public.career_match_results
    ADD COLUMN IF NOT EXISTS skill_scoring_method TEXT NOT NULL DEFAULT 'linear',
    ADD COLUMN IF NOT EXISTS skill_distribution_sample_size INTEGER,
    ADD COLUMN IF NOT EXISTS skill_distribution_version TEXT;

ALTER TABLE public.career_match_results DROP CONSTRAINT IF EXISTS career_match_results_skill_scoring_method_check;
ALTER TABLE public.career_match_results ADD CONSTRAINT career_match_results_skill_scoring_method_check CHECK (
    skill_scoring_method IN ('linear', 'ecdf')
);

ALTER TABLE public.career_match_results DROP CONSTRAINT IF EXISTS career_match_results_skill_scoring_consistent;
ALTER TABLE public.career_match_results ADD CONSTRAINT career_match_results_skill_scoring_consistent CHECK (
    (
        skill_scoring_method = 'linear'
        AND skill_distribution_sample_size IS NULL AND skill_distribution_version IS NULL
    )
    OR (
        skill_scoring_method = 'ecdf'
        AND skill_distribution_sample_size >= 100 AND skill_distribution_version IS NOT NULL
    )
);

COMMIT;
