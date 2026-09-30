import { getOrCreateAnonymousUserId } from "@/lib/anonymous-user";
import { hasValidEventFields, isClientEventName, isValidEventData, recordEvent } from "@/lib/events";

// Server Action はクライアントごとに直列実行されるため、頻度の高い計測は Route Handler で受ける
export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== request.headers.get("host")) {
    return new Response(null, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 400 });
  }
  const { event_name, event_data = {} } = (body ?? {}) as Record<string, unknown>;
  if (!isClientEventName(event_name) || !isValidEventData(event_data) || !hasValidEventFields(event_name, event_data)) {
    return new Response(null, { status: 400 });
  }

  try {
    await recordEvent(await getOrCreateAnonymousUserId(), event_name, event_data);
  } catch (error) {
    console.error(error);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
