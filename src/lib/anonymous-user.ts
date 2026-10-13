const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * ブラウザ単位の匿名 ID（localStorage）を受け取る。
 * 届かない・形式が不正なときは、その送信だけの ID を作る（Cookie は使わない）
 */
export function resolveAnonymousUserId(value: unknown): string {
  return isUuid(value) ? value : crypto.randomUUID();
}
