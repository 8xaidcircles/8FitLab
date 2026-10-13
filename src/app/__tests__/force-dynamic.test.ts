import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP_DIR = path.resolve(__dirname, "..");

function pageFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === "__tests__" ? [] : pageFiles(full);
    return /^page\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

// 結果は URL を知っていれば読めるため、キャッシュされると再計算後も古い結果を返してしまう
describe("getAssessment を呼ぶページは force-dynamic", () => {
  const pages = pageFiles(APP_DIR).filter((file) => /\bgetAssessment\s*\(/.test(readFileSync(file, "utf-8")));

  it("対象のページが見つかる（結果ページと学習ロードマップ）", () => {
    const relative = pages.map((file) => path.relative(APP_DIR, file).replaceAll(path.sep, "/"));
    expect(relative).toEqual(
      expect.arrayContaining(["goal-fit/result/[id]/page.tsx", "goal-fit/result/[id]/learning-path/page.tsx"]),
    );
  });

  it.each(pages.map((file) => [path.relative(APP_DIR, file)]))("%s", (relative) => {
    const source = readFileSync(path.join(APP_DIR, relative), "utf-8");
    expect(source).toMatch(/^export const dynamic = ["']force-dynamic["'];?$/m);
  });
});
