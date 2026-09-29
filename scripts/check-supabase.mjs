// Supabase 接続確認: events に 1 行書き込み → 読み出し → 削除
// 実行: node --use-system-ca --env-file=.env.local scripts/check-supabase.mjs
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    return "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY が .env.local にありません";
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const row = {
    anonymous_user_id: randomUUID(),
    event_name: "connection_check",
    event_data: { source: "scripts/check-supabase.mjs" },
  };

  const inserted = await supabase.from("events").insert(row).select("id").single();
  if (inserted.error) return `INSERT 失敗: ${inserted.error.message}`;

  const read = await supabase.from("events").select("event_name").eq("id", inserted.data.id).single();
  const removed = await supabase.from("events").delete().eq("id", inserted.data.id);
  if (read.error || removed.error) {
    return `SELECT/DELETE 失敗: ${(read.error ?? removed.error).message}`;
  }
  return null;
}

// process.exit() は Windows で libuv のアサーションを起こすため exitCode で終了する
const error = await main();
if (error) {
  console.error(error);
  process.exitCode = 1;
} else {
  console.log("OK: events への書き込み・読み出し・削除に成功しました");
}
