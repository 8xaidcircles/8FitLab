import { cookies, draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { DRAFT_KEY_COOKIE } from "@/lib/blog/microcms";

async function exitPreview(formData: FormData) {
  "use server";
  (await draftMode()).disable();
  (await cookies()).delete(DRAFT_KEY_COOKIE);
  const slug = formData.get("slug");
  redirect(typeof slug === "string" && /^[A-Za-z0-9_-]+$/.test(slug) ? `/blog/${slug}` : "/blog");
}

export function PreviewBanner({ slug }: { slug: string }) {
  return (
    <aside role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-flame-soft px-4 py-3 text-sm">
      <span className="font-bold text-flame">プレビュー表示中（下書きの内容です）</span>
      <form action={exitPreview}>
        <input type="hidden" name="slug" value={slug} />
        <button type="submit" className="rounded-full border border-flame px-4 py-1.5 font-bold text-flame hover:bg-white">
          プレビューを終了
        </button>
      </form>
    </aside>
  );
}
