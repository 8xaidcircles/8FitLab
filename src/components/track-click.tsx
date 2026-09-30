"use client";

import type { ReactNode } from "react";
import type { EventName } from "@/lib/events";
import { track } from "@/lib/track";

// 子のリンクのクリック（中クリック・Ctrl+クリックを含む）を計測する。遷移は妨げない
export function TrackClick({
  event,
  data,
  children,
  className,
}: {
  event: EventName;
  data: Record<string, unknown>;
  children: ReactNode;
  className?: string;
}) {
  const send = () => track(event, data);
  return (
    <div
      className={className}
      onClickCapture={send}
      // 右クリック（button 2）はメニューを開くだけなので数えない
      onAuxClickCapture={(e) => {
        if (e.button === 1) send();
      }}
    >
      {children}
    </div>
  );
}
