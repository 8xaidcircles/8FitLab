-- Goal Fit の属性（年齢層・地域・希望時期・就労状態・学習時間）と、B2B 抽出用の適合度・不足数。
-- 氏名や連絡先は保存しない。第三者への提供は免責事項・プライバシーポリシーに記載し、同意チェックは持たない。
-- この項目より前に保存した行は NULL。skipped は「回答をスキップする」。

ALTER TABLE public.assessment_sessions
    ADD COLUMN IF NOT EXISTS age_group TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS location_region TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS timeframe TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS employment_status TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS weekly_learning_hours TEXT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS calculated_fit_score NUMERIC(5, 2) DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS skill_gap_count INTEGER DEFAULT NULL;

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_age_group_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_age_group_check
    CHECK (age_group IS NULL OR age_group IN ('20s_early', '20s_late', '30s_early', '30s_late', '40s_or_above', 'skipped'));

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_location_region_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_location_region_check
    CHECK (location_region IS NULL OR location_region IN ('kanto', 'kansai', 'tokai', 'other_japan', 'overseas', 'skipped'));

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_timeframe_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_timeframe_check
    CHECK (timeframe IS NULL OR timeframe IN ('immediately', 'within_3_months', 'within_6_months', 'just_learning', 'skipped'));

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_employment_status_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_employment_status_check
    CHECK (employment_status IS NULL OR employment_status IN ('full_time', 'contract', 'freelance', 'student', 'unemployed', 'skipped'));

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_weekly_learning_hours_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_weekly_learning_hours_check
    CHECK (weekly_learning_hours IS NULL OR weekly_learning_hours IN ('under_5h', '5_15h', '15_30h', 'over_30h', 'skipped'));

CREATE INDEX IF NOT EXISTS idx_assessment_sessions_b2b_filter
    ON public.assessment_sessions (goal_id, timeframe, age_group);
