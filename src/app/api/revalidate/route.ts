import { revalidateTag } from "next/cache";
import { BLOG_CACHE_TAG } from "@/lib/blog/microcms";
import { verifyWebhookSignature } from "@/lib/blog/utils";

/** microCMS の Webhook（カスタム通知）。記事の公開・更新・削除でブログのキャッシュを破棄する */
export async function POST(request: Request) {
  const secret = process.env.MICROCMS_WEBHOOK_SECRET ?? "";
  const body = await request.text();
  if (!verifyWebhookSignature(body, request.headers.get("x-microcms-signature"), secret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  revalidateTag(BLOG_CACHE_TAG, { expire: 0 });
  return Response.json({ revalidated: true });
}
