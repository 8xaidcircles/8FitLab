import "server-only";
import { cookies } from "next/headers";

export const ANONYMOUS_USER_COOKIE = "anonymous_user_id";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ブラウザが受け付ける Cookie の最長有効期限（400 日）
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

// Server Component から読む用。Cookie の発行はしない
export async function getAnonymousUserId(): Promise<string | null> {
  const value = (await cookies()).get(ANONYMOUS_USER_COOKIE)?.value;
  return isUuid(value) ? value : null;
}

// Server Action / Route Handler 専用（Cookie を発行するため）
export async function getOrCreateAnonymousUserId(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(ANONYMOUS_USER_COOKIE)?.value;
  if (isUuid(existing)) return existing;

  const id = crypto.randomUUID();
  cookieStore.set(ANONYMOUS_USER_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return id;
}
