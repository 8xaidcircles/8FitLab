-- 診断の未該当・スキップの回答を、分析で区別できる値で保存する
-- Supabase ダッシュボード > SQL Editor で実行する。何度実行しても結果は同じ
-- アプリは保存時に skill_status / certification_status へ書き込むため、この SQL を実行してからデプロイする
--
-- 1. スキル・資格を 1 つも選ばなかった理由を assessment_sessions に保存する（個別に選んだ場合は NULL）
--    skill_status：none_intent_to_learn（まだ無いが、これから学習を開始する）/ skipped（回答をスキップする）
--    certification_status：none（保有している資格はない）/ planning_to_certify（これから学習を開始する）/ skipped
--    この列より前に保存した行は NULL のまま（スキル・資格が 0 件でも、理由を答えたかどうかは区別できない）
-- 2. 職歴・学歴の「回答をスキップする」の保存値を unknown から skipped に変える
--    （experience_status の NULL は、職歴を必須にする前に保存した行を表すため、スキップには使わない）
--
-- デプロイまでの間は旧版のアプリが unknown を保存するため、制約は unknown も受け付ける（アプリは読み出し時に skipped とみなす）。
-- デプロイ後にもう一度実行すると、その間に保存された unknown も skipped に変換される

BEGIN;

ALTER TABLE public.assessment_sessions
    ADD COLUMN IF NOT EXISTS skill_status TEXT
        CHECK (skill_status IN ('none_intent_to_learn', 'skipped')),
    ADD COLUMN IF NOT EXISTS certification_status TEXT
        CHECK (certification_status IN ('none', 'planning_to_certify', 'skipped'));

ALTER TABLE public.assessment_sessions
    DROP CONSTRAINT IF EXISTS assessment_sessions_experience_status_check;

UPDATE public.assessment_sessions
    SET experience_status = 'skipped'
    WHERE experience_status = 'unknown';

ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_experience_status_check
        CHECK (experience_status IN ('entered', 'none', 'skipped', 'unknown'));

UPDATE public.assessment_education
    SET education_level_id = 'skipped'
    WHERE education_level_id = 'unknown';

COMMIT;
