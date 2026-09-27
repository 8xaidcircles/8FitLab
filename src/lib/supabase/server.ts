import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// 認証なし（anonymous_user_id）のため、DB 操作はすべてサーバー側で secret key を使って行う
export function createClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
