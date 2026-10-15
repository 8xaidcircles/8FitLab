import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { loadGoals } from "@/lib/career-match";
import { loadBlogContent, POST_KEYS } from "../content";
import { renderMarkdown } from "../markdown";

type Field = { name: string; type: string; default?: unknown; options?: { values?: { name: string }[] } };
type Collection = { name: string; path: string; fields: Field[] };

async function postFields(): Promise<Map<string, Field>> {
  const config = parseYaml(await readFile(path.join(process.cwd(), ".pages.yml"), "utf-8")) as { content: Collection[] };
  const posts = config.content.find((c) => c.name === "posts");
  if (!posts) throw new Error(".pages.yml に posts がありません");
  expect(posts.path).toBe("content/blog/posts");
  return new Map(posts.fields.map((field) => [field.name, field]));
}

function values(field: Field | undefined): string[] {
  return (field?.options?.values ?? []).map((v) => v.name).sort();
}

// 管理画面（Pages CMS）の入力欄が、記事の読み込み（content.ts）と content/blog のデータに合っているか
describe(".pages.yml", () => {
  it("記事の項目は frontmatter で使える項目と本文だけ", async () => {
    const names = [...(await postFields()).keys()].filter((name) => name !== "body");
    expect(names.sort()).toEqual([...POST_KEYS].sort());
  });

  it("カテゴリ・執筆者・職種の選択肢がデータと一致する", async () => {
    const fields = await postFields();
    const [{ categories, authors }, goals] = await Promise.all([loadBlogContent(), loadGoals()]);
    expect(values(fields.get("category"))).toEqual(categories.map((c) => c.id).sort());
    expect(values(fields.get("author"))).toEqual(authors.map((a) => a.id).sort());
    expect(values(fields.get("goal"))).toEqual(goals.map((g) => g.goal_id).sort());
    expect(values(fields.get("recommend_goal_ids"))).toEqual(goals.map((g) => g.goal_id).sort());
  });

  it("新しい記事の本文の初期値は、そのまま記事として変換できる", async () => {
    const body = (await postFields()).get("body")?.default;
    expect(typeof body).toBe("string");
    expect(renderMarkdown(body as string).blocks.map((block) => block.kind)).toEqual(["rich_text", "cta_button", "goal_fit", "rich_text"]);
  });
});
