import "server-only";
import { isRecommendationPlacement } from "@/lib/career-match/recommendations";
import { createClient } from "@/lib/supabase/server";

export const EVENT_NAMES = [
  "page_viewed",
  "goal_selected",
  "skill_added",
  "skill_removed",
  "experience_added",
  "education_added",
  "career_match_calculated",
  "skill_gap_viewed",
  "learning_path_viewed",
  "recommendation_clicked",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** 新規には記録しないが、過去の events 行に残っている名前（集計で読むときに使う） */
export const LEGACY_EVENT_NAMES = ["learning_skill_clicked", "resource_clicked"] as const;
export type StoredEventName = EventName | (typeof LEGACY_EVENT_NAMES)[number];

const MAX_EVENT_DATA_BYTES = 2048;

export function isEventName(value: unknown): value is EventName {
  return (EVENT_NAMES as readonly unknown[]).includes(value);
}

/** Event ごとの必須項目。recommendation_clicked は placement が決められた値のときだけ保存する */
export function hasValidEventFields(eventName: EventName, data: Record<string, unknown>): boolean {
  if (eventName === "recommendation_clicked") return isRecommendationPlacement(data.placement);
  return true;
}

export function isValidEventData(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    return new TextEncoder().encode(JSON.stringify(value)).length <= MAX_EVENT_DATA_BYTES;
  } catch {
    return false;
  }
}

export async function recordEvent(
  anonymousUserId: string,
  eventName: EventName,
  eventData: Record<string, unknown> = {},
): Promise<void> {
  const { error } = await createClient()
    .from("events")
    .insert({ anonymous_user_id: anonymousUserId, event_name: eventName, event_data: eventData });
  if (error) throw new Error(`Failed to record event ${eventName}: ${error.message}`);
}
