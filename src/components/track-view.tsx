"use client";

import { useEffect, useRef } from "react";
import type { EventName } from "@/lib/events";
import { track } from "@/lib/track";

export function TrackView({ event, data = {} }: { event: EventName; data?: Record<string, unknown> }) {
  const sent = useRef(false);
  const payload = JSON.stringify(data);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    track(event, JSON.parse(payload));
  }, [event, payload]);

  return null;
}
