/**
 * 同じサイトからのリクエストか。Origin ヘッダが無ければ true（同一オリジンの GET や古いブラウザ）。
 * 有れば host ヘッダと比べる。"null"（サンドボックスの iframe など）や不正な値は、例外を投げず false
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
