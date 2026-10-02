import { ADSENSE_CLIENT_ID } from "@/lib/site";

// AdSense の承認・広告配信に必要な ads.txt。f08c47fec0942fa0 は Google の認証局 ID（全サイト共通）
export function GET() {
  if (!ADSENSE_CLIENT_ID) return new Response("Not Found", { status: 404 });
  const publisherId = ADSENSE_CLIENT_ID.replace(/^ca-/, "");
  return new Response(`google.com, ${publisherId}, DIRECT, f08c47fec0942fa0\n`, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
