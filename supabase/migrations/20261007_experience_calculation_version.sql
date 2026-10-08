-- Experience Match の計算方式のバージョンを保存する（docs/scoring-model-change.md）
-- Supabase ダッシュボード > SQL Editor で実行する。何度実行しても結果は同じ
-- アプリは保存時にこの列へ書き込むため、この SQL を実行してからデプロイする
--
-- experience_calculation_version：relevance-1.0.0（前職歴 = 関連度 × 在職年数パーセンタイル）
--   既存の行は NULL（旧方式）。scripts/recompute-career-match.mjs で再計算すると現在の方式の値になる

BEGIN;

ALTER TABLE public.career_match_results
    ADD COLUMN IF NOT EXISTS experience_calculation_version TEXT;

COMMIT;
