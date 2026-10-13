import { describe, expect, it } from "vitest";
import { isResultPath, sanitizeAnalyticsPath, toAnalyticsEventData } from "../analytics";

const ID = "0b9f2c1e-4d5a-4b6c-8d7e-9f0a1b2c3d4e";

describe("sanitizeAnalyticsPath（GA に送るパス）", () => {
  it("結果ページの UUID を [id] に置き換え、以降のパスは残す", () => {
    expect(sanitizeAnalyticsPath(`/goal-fit/result/${ID}`)).toBe("/goal-fit/result/[id]");
    expect(sanitizeAnalyticsPath(`/goal-fit/result/${ID}/learning-path`)).toBe("/goal-fit/result/[id]/learning-path");
    expect(sanitizeAnalyticsPath(`/goal-fit/result/${ID.toUpperCase()}/`)).toBe("/goal-fit/result/[id]/");
  });

  it("結果ページ以外・UUID でない ID はそのまま", () => {
    expect(sanitizeAnalyticsPath("/")).toBe("/");
    expect(sanitizeAnalyticsPath("/goal-fit")).toBe("/goal-fit");
    expect(sanitizeAnalyticsPath(`/blog/${ID}`)).toBe(`/blog/${ID}`);
    expect(sanitizeAnalyticsPath("/goal-fit/result/abc")).toBe("/goal-fit/result/abc");
    expect(sanitizeAnalyticsPath(`/goal-fit/result/${ID}x`)).toBe(`/goal-fit/result/${ID}x`);
  });

  it("isResultPath は結果ページ配下だけ true", () => {
    expect(isResultPath(`/goal-fit/result/${ID}`)).toBe(true);
    expect(isResultPath(`/goal-fit/result/${ID}/learning-path`)).toBe(true);
    expect(isResultPath("/goal-fit")).toBe(false);
  });
});

describe("toAnalyticsEventData（GA に送る event_data）", () => {
  it("assessment_id を取り除き、元のオブジェクトは変更しない", () => {
    const data = { goal_id: "frontend-developer", assessment_id: ID, stage: "learning" };
    expect(toAnalyticsEventData(data)).toEqual({ goal_id: "frontend-developer", stage: "learning" });
    expect(data).toEqual({ goal_id: "frontend-developer", assessment_id: ID, stage: "learning" });
  });

  it("assessment_id が無ければ同じ内容を返す", () => {
    expect(toAnalyticsEventData({ path: "/" })).toEqual({ path: "/" });
  });
});
