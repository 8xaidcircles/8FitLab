import { resolveAnonymousUserId } from "@/lib/anonymous-user";
import { hasValidEventFields, isEventName, isValidEventData, recordEvent } from "@/lib/events";
import { isSameOrigin } from "@/lib/request-origin";

// Server Action はクライアントごとに直列実行されるため、頻度の高い計測は Route Handler で受ける
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return new Response(null, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { anonymous_user_id, event_name, event_data = {} } = (body ?? {}) as Record<string, unknown>;
  if (!isEventName(event_name) || !isValidEventData(event_data) || !hasValidEventFields(event_name, event_data)) {
    return new Response(null, { status: 400 });
  }

  try {
    await recordEvent(resolveAnonymousUserId(anonymous_user_id), event_name, event_data);
  } catch (error) {
    console.error(error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
