import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { absoluteUrl, SITE_ORIGIN } from "@/lib/site";

describe("SITE_ORIGIN", () => {
  it("正規ホストは www なしの本番 URL", () => {
    expect(SITE_ORIGIN).toBe("https://8fitlab.com");
  });
});

describe("absoluteUrl", () => {
  it("先頭が / のパスを SITE_ORIGIN に結合する", () => {
    expect(absoluteUrl("/")).toBe("https://8fitlab.com/");
    expect(absoluteUrl("/blog")).toBe("https://8fitlab.com/blog");
    expect(absoluteUrl("/blog/data-scientist-school")).toBe("https://8fitlab.com/blog/data-scientist-school");
  });

  it.each([
    ["//evil.example/x", "プロトコル相対"],
    ["blog", "先頭が / でない"],
    ["/blog?utm=1", "?"],
    ["/blog#toc", "#"],
    ["https://8fitlab.com/blog", "先頭が / でない"],
  ])("%s は例外（%s）", (input) => {
    expect(() => absoluteUrl(input)).toThrow();
  });
});

describe("src に www ホストの記述がないこと", () => {
  const root = path.resolve(__dirname, "../..");
  const www = /https:\/\/www\.8fitlab\.com/;

  function walk(dir: string, out: string[]): void {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next") continue;
      const full = path.join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) {
        walk(full, out);
        continue;
      }
      if (!/\.(ts|tsx|js|mjs|css)$/.test(name)) continue;
      if (name.includes(".test.")) continue;
      if (full.includes(`${path.sep}__tests__${path.sep}`)) continue;
      out.push(full);
    }
  }

  it("docs と tests を除く src 配下に https://www.8fitlab.com がない", () => {
    const files: string[] = [];
    walk(root, files);
    const hits: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      if (www.test(text)) hits.push(path.relative(root, file));
    }
    expect(hits).toEqual([]);
  });
});
