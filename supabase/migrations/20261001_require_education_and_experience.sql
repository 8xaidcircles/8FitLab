-- 診断の学歴・職歴を必須入力にし、「わかりません / 答えない」「実務経験なし」を保存できるようにする
-- Supabase ダッシュボード > SQL Editor で 1 回実行する。何度実行しても結果は同じ
-- アプリは保存時に experience_status へ書き込み、「わかりません」の学歴を degree_id = NULL で保存するため、
-- この SQL を実行してからデプロイする
--
-- 既存の行（必須化の前に保存した結果）は experience_status が NULL のまま。
-- 職歴の行が無い既存の結果が「実務経験なし」か「入力しなかった」かは区別できないため、値を埋めない

BEGIN;

-- 職歴の回答。entered：職種と年数を 1 件以上入力 / none：実務経験なし / unknown：わかりません・答えない
ALTER TABLE public.assessment_sessions
    ADD COLUMN IF NOT EXISTS experience_status TEXT
        CHECK (experience_status IN ('entered', 'none', 'unknown'));

-- 学歴の「わかりません / 答えない」（education_level_id = 'unknown'）は対応する統計上の学歴が無いため NULL
ALTER TABLE public.assessment_education
    ALTER COLUMN degree_id DROP NOT NULL;

COMMIT;
