import { describe, expect, it } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { SITE_ORIGIN } from "@/lib/site";

describe("sitemap", () => {
  it("全エントリが SITE_ORIGIN で始まる", async () => {
    const entries = await sitemap();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(entry.url.startsWith(SITE_ORIGIN), entry.url).toBe(true);
    }
  });

  it("結果ページ（/goal-fit/result/）を含まない", async () => {
    const entries = await sitemap();
    for (const entry of entries) {
      expect(entry.url.includes("/goal-fit/result/"), entry.url).toBe(false);
    }
  });
});

describe("robots", () => {
  it("sitemap が SITE_ORIGIN の sitemap.xml", () => {
    const result = robots();
    expect(result.sitemap).toBe(`${SITE_ORIGIN}/sitemap.xml`);
  });
});
