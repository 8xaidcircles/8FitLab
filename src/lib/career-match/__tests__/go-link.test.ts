import { describe, expect, it } from "vitest";
import { buildClickEvent, goHref, isBotUserAgent, redirectUrl, sanitizeGoParams, type GoParams } from "../go-link";
import type { CareerService, LearningResource } from "../types";

const book: LearningResource = {
  resource_id: "book-react",
  type: "book",
  provider: "技術評論社",
  name: "React入門",
  official_url: "https://example.com/react",
  selection_reason: "基礎から学べる",
  editorial_rank: 3,
  is_active: true,
  verified_at: "2026-09-01",
  affiliate: null,
  covers: ["react"],
  level: "beginner",
  cost: "paid",
};

const service: CareerService = {
  resource_id: "agent-a",
  type: "job_service",
  provider: "Agent A",
  name: "Agent A 転職",
  official_url: "https://example.com/agent",
  selection_reason: "IT職種に強い",
  editorial_rank: 1,
  is_active: true,
  verified_at: "2026-09-01",
  affiliate: { status: "active", program: "a8", url: "https://px.example.com/agent" },
  goal_ids: ["frontend-developer"],
  audience: "career_change",
  requires_goal_experience: false,
};

const query = (q: Record<string, string>) => new URLSearchParams(q);

describe("sanitizeGoParams", () => {
  it("正しい値はそのまま使う", () => {
    expect(
      sanitizeGoParams(
        { resource_id: "book-react" },
        query({ placement: "step_resource", position_index: "3", goal_id: "frontend-developer", step_id: "frontend-framework" }),
      ),
    ).toEqual({
      resource_id: "book-react",
      placement: "step_resource",
      position_index: 3,
      goal_id: "frontend-developer",
      step_id: "frontend-framework",
    });
  });

  it("不正な resource_id は null", () => {
    for (const resource_id of ["", "../etc", "Book", "a b", "x".repeat(101)]) {
      expect(sanitizeGoParams({ resource_id }, query({})), resource_id).toBeNull();
    }
  });

  it("クエリが無ければ既定値（step_resource・0・null）", () => {
    expect(sanitizeGoParams({ resource_id: "book-react" }, query({}))).toEqual({
      resource_id: "book-react",
      placement: "step_resource",
      position_index: 0,
      goal_id: null,
      step_id: null,
    });
  });

  it("placement は step_resource / career_next 以外を step_resource にする", () => {
    expect(sanitizeGoParams({ resource_id: "a" }, query({ placement: "career_next" }))!.placement).toBe("career_next");
    expect(sanitizeGoParams({ resource_id: "a" }, query({ placement: "banner" }))!.placement).toBe("step_resource");
  });

  it("position_index は 0〜99 の整数だけ。それ以外は 0", () => {
    const index = (value: string) => sanitizeGoParams({ resource_id: "a" }, query({ position_index: value }))!.position_index;
    expect(index("0")).toBe(0);
    expect(index("99")).toBe(99);
    for (const invalid of ["100", "-1", "1.5", "abc", "", "1e2"]) expect(index(invalid), invalid).toBe(0);
  });

  it("goal_id・step_id は ID の形式でなければ null", () => {
    const p = sanitizeGoParams({ resource_id: "a" }, query({ goal_id: "<script>", step_id: "Step 1" }))!;
    expect(p.goal_id).toBeNull();
    expect(p.step_id).toBeNull();
  });

  it("career_next では step_id を捨てる", () => {
    const p = sanitizeGoParams(
      { resource_id: "agent-a" },
      query({ placement: "career_next", goal_id: "frontend-developer", step_id: "frontend-framework" }),
    )!;
    expect(p.goal_id).toBe("frontend-developer");
    expect(p.step_id).toBeNull();
  });

  it("goHref で作った URL を読み戻すと同じ値になる", () => {
    const params: GoParams = {
      resource_id: "book-react",
      placement: "step_resource",
      position_index: 2,
      goal_id: "frontend-developer",
      step_id: "frontend-framework",
    };
    const url = new URL(goHref(params), "https://8fitlab.example");
    expect(url.pathname).toBe("/go/book-react");
    expect(sanitizeGoParams({ resource_id: "book-react" }, url.searchParams)).toEqual(params);
  });
});

describe("buildClickEvent", () => {
  const params: GoParams = {
    resource_id: "book-react",
    placement: "step_resource",
    position_index: 1,
    goal_id: "frontend-developer",
    step_id: "frontend-framework",
  };

  it("教材のクリック（アフィリエイトなし）", () => {
    expect(buildClickEvent(params, book, false)).toEqual({
      resource_id: "book-react",
      resource_type: "book",
      provider: "技術評論社",
      editorial_rank: 3,
      placement: "step_resource",
      position_index: 1,
      goal_id: "frontend-developer",
      step_id: "frontend-framework",
      is_affiliate: false,
      affiliate_program: null,
    });
  });

  it("アフィリエイトのときだけ affiliate_program を入れる", () => {
    const careerParams: GoParams = { ...params, resource_id: "agent-a", placement: "career_next", step_id: null };
    expect(buildClickEvent(careerParams, service, true)).toMatchObject({
      resource_type: "job_service",
      placement: "career_next",
      step_id: null,
      is_affiliate: true,
      affiliate_program: "a8",
    });
    expect(buildClickEvent(careerParams, service, false).affiliate_program).toBeNull();
  });
});

describe("isBotUserAgent", () => {
  it("クローラー・プレビュー・User-Agent なしは計測しない", () => {
    for (const ua of [
      null,
      "",
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)",
      "facebookexternalhit/1.1",
      "curl/8.4.0",
    ]) {
      expect(isBotUserAgent(ua), String(ua)).toBe(true);
    }
  });

  it("通常のブラウザは計測する", () => {
    expect(
      isBotUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"),
    ).toBe(false);
  });
});

describe("redirectUrl", () => {
  it("アフィリエイト有効ならアフィリエイト URL、それ以外は公式 URL", () => {
    expect(redirectUrl(service, true)).toBe("https://px.example.com/agent");
    expect(redirectUrl(service, false)).toBe("https://example.com/agent");
  });

  it("https 以外には飛ばさない", () => {
    expect(redirectUrl({ ...book, official_url: "http://example.com" }, false)).toBeNull();
    expect(redirectUrl({ ...book, official_url: "javascript:alert(1)" }, false)).toBeNull();
    expect(redirectUrl({ ...book, official_url: "not a url" }, false)).toBeNull();
  });
});
