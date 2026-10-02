"use client";

import type { EventName } from "@/lib/events";

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

// 計測の失敗で画面操作を止めない（結果は待たず、エラーも無視する）
// Google アナリティクスのタグがあれば、同じイベントを送る（個人情報を含まない ID だけのイベントのため）
export function track(eventName: EventName, eventData: Record<string, unknown> = {}): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_name: eventName, event_data: eventData }),
    keepalive: true,
  }).catch(() => {});
  try {
    window.gtag?.("event", eventName, eventData);
  } catch {}
}
