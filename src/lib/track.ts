"use client";

import type { EventName } from "@/lib/events";

// 計測の失敗で画面操作を止めない（結果は待たず、エラーも無視する）
export function track(eventName: EventName, eventData: Record<string, unknown> = {}): void {
  fetch("/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ event_name: eventName, event_data: eventData }),
    keepalive: true,
  }).catch(() => {});
}
