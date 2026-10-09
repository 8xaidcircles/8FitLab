-- スキルの未選択理由に「保有しているスキルはない」（none）を追加する
-- Supabase ダッシュボード > SQL Editor で実行する。何度実行しても結果は同じ
-- アプリはこの値を skill_status に保存するため、この SQL を実行してからデプロイする

ALTER TABLE public.assessment_sessions
    DROP CONSTRAINT IF EXISTS assessment_sessions_skill_status_check;

ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_skill_status_check
        CHECK (skill_status IN ('none', 'none_intent_to_learn', 'skipped'));
