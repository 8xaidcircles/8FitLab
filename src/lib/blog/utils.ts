import { createHmac, timingSafeEqual } from "node:crypto";

const SLUG_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

export function isValidSlug(slug: unknown): slug is string {
  return typeof slug === "string" && SLUG_PATTERN.test(slug);
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** microCMS Webhook の X-MICROCMS-Signature（リクエスト本文の HMAC-SHA256 hex）を検証する */
export function verifyWebhookSignature(body: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha256", secret).update(body).digest("hex");
  return safeEqual(expected, signature);
}

/** 記事の goal フィールド（Goal の日本語名または goal_id）を goal_id に解決する */
export function resolveGoalId(
  values: string[] | null | undefined,
  goals: { goal_id: string; name: string }[],
): string | null {
  for (const value of values ?? []) {
    const goal = goals.find((g) => g.goal_id === value || g.name === value);
    if (goal) return goal.goal_id;
  }
  return null;
}

/** <script type="application/ld+json"> に埋め込んでも </script> で閉じられないようにする */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export function formatDate(iso: string | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("ja-JP", { timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric" }).format(date);
}
