import { describe, expect, it } from "vitest";
import { EVENT_NAMES, isEventName, isValidEventData } from "../events";

describe("events", () => {
  it("MVP Event（§45）の 10 種類のみ受け付ける", () => {
    expect(EVENT_NAMES).toHaveLength(10);
    expect(isEventName("goal_selected")).toBe(true);
    expect(isEventName("purchase")).toBe(false);
    expect(isEventName(undefined)).toBe(false);
  });

  it("event_data はオブジェクトかつ 2KB 以下", () => {
    expect(isValidEventData({ goal_id: "frontend-developer" })).toBe(true);
    expect(isValidEventData({})).toBe(true);
    expect(isValidEventData(null)).toBe(false);
    expect(isValidEventData(["a"])).toBe(false);
    expect(isValidEventData("text")).toBe(false);
    expect(isValidEventData({ text: "x".repeat(2100) })).toBe(false);
  });

  it("循環参照など JSON 化できない値は拒否", () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(isValidEventData(circular)).toBe(false);
  });
});
