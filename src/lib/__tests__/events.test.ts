import { describe, expect, it } from "vitest";
import {
  EVENT_NAMES,
  LEGACY_EVENT_NAMES,
  hasValidEventFields,
  isEventName,
  isValidEventData,
} from "../events";

describe("events", () => {
  it("MVP Event（§45）の 10 種類のみ受け付ける", () => {
    expect(EVENT_NAMES).toHaveLength(10);
    expect(isEventName("goal_selected")).toBe(true);
    expect(isEventName("recommendation_clicked")).toBe(true);
    expect(isEventName("purchase")).toBe(false);
    expect(isEventName(undefined)).toBe(false);
  });

  it("learning_skill_clicked と resource_clicked は廃止（過去ログ用の名前としてだけ残す）", () => {
    for (const name of ["learning_skill_clicked", "resource_clicked"]) {
      expect(isEventName(name), name).toBe(false);
      expect(LEGACY_EVENT_NAMES, name).toContain(name);
    }
    for (const name of LEGACY_EVENT_NAMES) expect(EVENT_NAMES).not.toContain(name);
  });

  it("recommendation_clicked は placement が決められた値のときだけ受け付ける", () => {
    for (const placement of ["step_learn", "step_review", "career_learning", "career_experienced"]) {
      expect(hasValidEventFields("recommendation_clicked", { placement }), placement).toBe(true);
    }
    for (const placement of [undefined, null, "", "career_next", "STEP_LEARN", 1]) {
      expect(hasValidEventFields("recommendation_clicked", { placement }), String(placement)).toBe(false);
    }
    expect(hasValidEventFields("goal_selected", {})).toBe(true);
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
