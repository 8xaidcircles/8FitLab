import "server-only";
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
  "resource_clicked",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/** 新規には記録しないが、過去の events 行に残っている名前（集計で読むときに使う） */
export const LEGACY_EVENT_NAMES = ["learning_skill_clicked"] as const;
export type StoredEventName = EventName | (typeof LEGACY_EVENT_NAMES)[number];

/** サーバー（/go リダイレクト）だけが記録する。/api/events からは受け付けない（クリック数の水増しを防ぐ） */
const SERVER_ONLY_EVENT_NAMES: readonly EventName[] = ["resource_clicked"];

export function isClientEventName(value: unknown): value is EventName {
  return isEventName(value) && !SERVER_ONLY_EVENT_NAMES.includes(value);
}

const MAX_EVENT_DATA_BYTES = 2048;

export function isEventName(value: unknown): value is EventName {
  return (EVENT_NAMES as readonly unknown[]).includes(value);
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
