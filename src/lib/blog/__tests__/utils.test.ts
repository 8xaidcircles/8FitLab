import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { formatDate, isValidSlug, resolveGoalId, safeEqual, serializeJsonLd, verifyWebhookSignature } from "../utils";

describe("isValidSlug", () => {
  it("英数字・ハイフン・アンダースコアのみ受け付ける", () => {
    expect(isValidSlug("frontend-roadmap_2026")).toBe(true);
    expect(isValidSlug("../etc/passwd")).toBe(false);
    expect(isValidSlug("a/b")).toBe(false);
    expect(isValidSlug("記事")).toBe(false);
    expect(isValidSlug("")).toBe(false);
    expect(isValidSlug("a".repeat(101))).toBe(false);
    expect(isValidSlug(null)).toBe(false);
  });
});

describe("safeEqual", () => {
  it("長さが違っても例外にならず false を返す", () => {
    expect(safeEqual("secret", "secret")).toBe(true);
    expect(safeEqual("secret", "secreT")).toBe(false);
    expect(safeEqual("secret", "secret-longer")).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ service: "8fitlab", api: "blogs", id: "abc", type: "edit" });
  const secret = "webhook-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");

  it("本文の HMAC-SHA256 と一致する署名だけ通す", () => {
    expect(verifyWebhookSignature(body, signature, secret)).toBe(true);
    expect(verifyWebhookSignature(`${body} `, signature, secret)).toBe(false);
    expect(verifyWebhookSignature(body, signature, "other-secret")).toBe(false);
  });

  it("署名やシークレットが無ければ拒否する", () => {
    expect(verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(verifyWebhookSignature(body, signature, "")).toBe(false);
  });
});

describe("resolveGoalId", () => {
  const goals = [
    { goal_id: "frontend-developer", name: "フロントエンドエンジニア" },
    { goal_id: "data-engineer", name: "データエンジニア" },
  ];

  it("日本語名・goal_id のどちらでも解決する", () => {
    expect(resolveGoalId(["フロントエンドエンジニア"], goals)).toBe("frontend-developer");
    expect(resolveGoalId(["data-engineer"], goals)).toBe("data-engineer");
  });

  it("未知の値や未設定は null", () => {
    expect(resolveGoalId(["存在しない"], goals)).toBeNull();
    expect(resolveGoalId([], goals)).toBeNull();
    expect(resolveGoalId(null, goals)).toBeNull();
  });
});

describe("serializeJsonLd", () => {
  it("</script> で閉じられないよう < をエスケープする", () => {
    const json = serializeJsonLd({ headline: "</script><script>alert(1)</script>" });
    expect(json).not.toContain("<");
    expect(JSON.parse(json).headline).toBe("</script><script>alert(1)</script>");
  });
});

describe("formatDate", () => {
  it("日本時間の日付で表示する", () => {
    expect(formatDate("2026-09-27T16:00:00.000Z")).toBe("2026年9月28日");
    expect(formatDate(undefined)).toBeNull();
    expect(formatDate("invalid")).toBeNull();
  });
});
