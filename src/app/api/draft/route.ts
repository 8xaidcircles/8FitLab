import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { DRAFT_KEY_COOKIE, getPost } from "@/lib/blog/microcms";
import { isValidSlug, safeEqual } from "@/lib/blog/utils";

/**
 * microCMS の「画面プレビュー」から開く入口。
 * プレビューURL: https://<サイト>/api/draft?secret=<MICROCMS_PREVIEW_SECRET>&slug={CONTENT_ID}&draftKey={DRAFT_KEY}
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get("secret") ?? "";
  const slug = searchParams.get("slug");
  const draftKey = searchParams.get("draftKey");
  const expected = process.env.MICROCMS_PREVIEW_SECRET ?? "";

  if (!expected || !safeEqual(secret, expected)) {
    return new Response("Invalid token", { status: 401 });
  }
  if (!isValidSlug(slug) || !isValidSlug(draftKey)) {
    return new Response("Invalid parameters", { status: 400 });
  }

  const post = await getPost(slug, draftKey);
  if (!post) return new Response("Post not found", { status: 404 });

  (await draftMode()).enable();
  (await cookies()).set(DRAFT_KEY_COOKIE, draftKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60,
  });
  redirect(`/blog/${post.id}`);
}
