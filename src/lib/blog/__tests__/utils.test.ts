import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  collectGoalCategories,
  formatDate,
  isInGoalCategory,
  isValidSlug,
  resolveGoalId,
  safeEqual,
  serializeJsonLd,
  verifyWebhookSignature,
} from "../utils";

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

describe("職種カテゴリ", () => {
  const goals = [
    { goal_id: "frontend-developer", name: "フロントエンドエンジニア" },
    { goal_id: "data-engineer", name: "データエンジニア" },
  ];
  const posts = [
    { goal: ["フロントエンドエンジニア"] },
    { goal: ["frontend-developer", "データエンジニア"] },
    { category: { id: "data-engineer" } },
    { category: { id: "career" }, goal: null },
  ];

  it("goal フィールド（日本語名・goal_id）か、カテゴリ ID が goal_id と同じ記事を職種カテゴリに入れる", () => {
    expect(posts.map((post) => isInGoalCategory(post, goals[0]))).toEqual([true, true, false, false]);
    expect(posts.map((post) => isInGoalCategory(post, goals[1]))).toEqual([false, true, true, false]);
  });

  it("Goal の並び順で、記事の無い職種も含めて記事数を数える", () => {
    expect(collectGoalCategories(posts, goals)).toEqual([
      { id: "frontend-developer", name: "フロントエンドエンジニア", count: 2 },
      { id: "data-engineer", name: "データエンジニア", count: 2 },
    ]);
    expect(collectGoalCategories([], goals).map((c) => c.count)).toEqual([0, 0]);
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
