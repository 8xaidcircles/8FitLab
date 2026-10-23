import type { Metadata } from "next";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { metadata as blogMetadata } from "@/app/blog/page";
import { metadata as contactMetadata } from "@/app/contact/page";
import { metadata as cookieMetadata } from "@/app/cookie-policy/page";
import { metadata as disclaimerMetadata } from "@/app/disclaimer/page";
import { metadata as goalFitMetadata } from "@/app/goal-fit/page";
import { metadata as homeMetadata } from "@/app/page";
import { metadata as privacyMetadata } from "@/app/privacy-policy/page";
import { absoluteUrl, SITE_ORIGIN } from "@/lib/site";

describe("主要ページの canonical / openGraph.url", () => {
  const cases: { name: string; path: string; metadata: Metadata }[] = [
    { name: "ホーム", path: "/", metadata: homeMetadata },
    { name: "Blog", path: "/blog", metadata: blogMetadata },
    { name: "Goal Fit", path: "/goal-fit", metadata: goalFitMetadata },
    { name: "お問い合わせ", path: "/contact", metadata: contactMetadata },
    { name: "Cookie", path: "/cookie-policy", metadata: cookieMetadata },
    { name: "免責", path: "/disclaimer", metadata: disclaimerMetadata },
    { name: "プライバシー", path: "/privacy-policy", metadata: privacyMetadata },
  ];

  it.each(cases)("$name の canonical は $path（metadataBase で SITE_ORIGIN に解決）", ({ path, metadata }) => {
    expect(metadata.alternates?.canonical).toBe(path);
    expect(metadata.openGraph?.url).toBe(absoluteUrl(path));
    expect(String(metadata.openGraph?.url)).toBe(`${SITE_ORIGIN}${path === "/" ? "/" : path}`);
  });
});

describe("記事ページの generateMetadata", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("canonical はパス、openGraph.url は SITE_ORIGIN + パス", async () => {
    vi.doMock("@/lib/blog/content", () => ({
      getPost: vi.fn(async () => ({
        id: "data-scientist-school",
        title: "タイトル",
        description: "説明",
        publishedAt: "2026-10-21",
        updatedAt: "2026-10-21",
        draft: false,
        blocks: [],
      })),
      listPosts: vi.fn(async () => []),
    }));

    const { generateMetadata } = await import("@/app/blog/[slug]/page");
    const meta = await generateMetadata({
      params: Promise.resolve({ slug: "data-scientist-school" }),
    } as Parameters<typeof generateMetadata>[0]);
    expect(meta.alternates?.canonical).toBe("/blog/data-scientist-school");
    expect(meta.openGraph?.url).toBe(`${SITE_ORIGIN}/blog/data-scientist-school`);
  });
});
