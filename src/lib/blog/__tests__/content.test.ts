import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadBlogContent } from "../content";
import { renderMarkdown } from "../markdown";
import { normalizeServices } from "../services";

// content/blog の実データの検査。記事の追加・変更の PR は、このテストとビルドが通れば形式は正しい
describe("content/blog", () => {
  it("記事・編集者・カテゴリ・サービスを読み込める（形式の誤りがあれば、ファイル名と理由つきで失敗する）", async () => {
    await expect(loadBlogContent()).resolves.toBeDefined();
  });

  it("サービスはすべて比較欄に掲載される（名前・種別・https の公式サイトがそろっている）", async () => {
    const { services } = await loadBlogContent();
    const normalized = normalizeServices(services);
    expect(normalized.school.length + normalized.job_service.length).toBe(services.length);
  });

  it("サービスの review_article は存在する記事を指す", async () => {
    const { services, posts } = await loadBlogContent();
    const ids = new Set(posts.map((post) => post.id));
    const missing = Object.values(normalizeServices(services))
      .flat()
      .filter((service) => service.reviewArticleId && !ids.has(service.reviewArticleId))
      .map((service) => `${service.id} → ${service.reviewArticleId}`);
    expect(missing).toEqual([]);
  });

  it("テンプレートの本文はそのまま記事として変換できる", async () => {
    const source = await readFile(path.join(process.cwd(), "content", "blog", "posts", "_template.md"), "utf-8");
    const body = source.replace(/\r\n?/g, "\n").split(/^---$/m).slice(2).join("---");
    expect(renderMarkdown(body).blocks.map((block) => block.kind)).toEqual(["rich_text", "cta_button", "rich_text"]);
  });
});
