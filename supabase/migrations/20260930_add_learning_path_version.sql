-- Learning Path の結果に、判定に使った Learning Path Master の version を保存する
-- Supabase ダッシュボード > SQL Editor で 1 回実行する。何度実行しても結果は同じ
-- アプリは保存時にこの列へ書き込むため、この SQL を実行してからデプロイする
--
-- 既存の行（この列の追加前に保存した結果）は NULL のまま

BEGIN;

ALTER TABLE public.learning_path_results
    ADD COLUMN IF NOT EXISTS learning_path_version TEXT;

COMMIT;
