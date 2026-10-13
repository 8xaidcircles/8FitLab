// 結果ページの URL は閲覧の鍵になるため、Google アナリティクスなど外部の計測には assessmentId を送らない

const RESULT_PATH_PATTERN = /^\/goal-fit\/result\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=\/|$)/i;

export function isResultPath(pathname: string): boolean {
  return RESULT_PATH_PATTERN.test(pathname);
}

/** /goal-fit/result/<UUID>（以降の /learning-path などは残す）の UUID を [id] に置き換える */
export function sanitizeAnalyticsPath(pathname: string): string {
  return pathname.replace(RESULT_PATH_PATTERN, "/goal-fit/result/[id]");
}

/** GA に送る event_data から assessment_id を取り除く（元のオブジェクトは変更しない） */
export function toAnalyticsEventData(data: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...data };
  delete rest.assessment_id;
  return rest;
}
