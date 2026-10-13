"use client";

import { toAnalyticsEventData } from "@/lib/analytics";
import { isUuid } from "@/lib/anonymous-user";
import type { EventName } from "@/lib/events";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const ANONYMOUS_USER_ID_KEY = "anonymous_user_id";

/**
 * 同じブラウザでは消されるまで同じ匿名 ID（localStorage が使えないブラウザでは undefined）。
 * 保存値が UUID でなければ（書き換え・破損）作り直して保存し直す
 */
export function getAnonymousUserId(): string | undefined {
  try {
    const existing = localStorage.getItem(ANONYMOUS_USER_ID_KEY);
    if (isUuid(existing)) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(ANONYMOUS_USER_ID_KEY, id);
    return id;
  } catch {
    return undefined;
  }
}

// 計測の失敗で画面操作を止めない（結果は待たず、エラーも無視する）
// Google アナリティクスのタグがあれば、同じイベントを送る（個人情報を含まない ID だけのイベントのため）。
// ただし assessment_id は結果 URL の鍵になるため GA には送らない（自社の DB には残す）
export function track(eventName: EventName, eventData: Record<string, unknown> = {}): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ anonymous_user_id: getAnonymousUserId(), event_name: eventName, event_data: eventData }),
    keepalive: true,
  }).catch(() => {});
  try {
    window.gtag?.("event", eventName, toAnalyticsEventData(eventData));
  } catch {}
}
