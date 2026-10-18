-- location_region を地方（関東など）から47都道府県へ広げる。
-- 制約名は schema.sql と同じ assessment_sessions_location_region_check。
-- 旧値（kanto / kansai / tokai / other_japan）は都道府県に対応しないため NULL に戻す。

UPDATE public.assessment_sessions
SET location_region = NULL
WHERE location_region IN ('kanto', 'kansai', 'tokai', 'other_japan');

ALTER TABLE public.assessment_sessions DROP CONSTRAINT IF EXISTS assessment_sessions_location_region_check;
ALTER TABLE public.assessment_sessions
    ADD CONSTRAINT assessment_sessions_location_region_check
    CHECK (
        location_region IS NULL
        OR location_region IN (
            'hokkaido', 'aomori', 'iwate', 'miyagi', 'akita', 'yamagata', 'fukushima',
            'ibaraki', 'tochigi', 'gunma', 'saitama', 'chiba', 'tokyo', 'kanagawa',
            'niigata', 'toyama', 'ishikawa', 'fukui', 'yamanashi', 'nagano', 'gifu', 'shizuoka', 'aichi', 'mie',
            'shiga', 'kyoto', 'osaka', 'hyogo', 'nara', 'wakayama',
            'tottori', 'shimane', 'okayama', 'hiroshima', 'yamaguchi', 'tokushima', 'kagawa', 'ehime', 'kochi',
            'fukuoka', 'saga', 'nagasaki', 'kumamoto', 'oita', 'miyazaki', 'kagoshima', 'okinawa',
            'overseas', 'skipped'
        )
    );
