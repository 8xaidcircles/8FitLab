import { describe, expect, it } from "vitest";
import { groupByPurpose, normalizeServices, type RawService } from "../services";

const base: RawService = {
  id: "school-a",
  name: "スクールA",
  service_type: ["school"],
  official_url: "https://example.com/a",
};

describe("normalizeServices", () => {
  it("名前・種別・https の公式サイトが無いものは出さない", () => {
    const result = normalizeServices([
      base,
      { ...base, id: "no-name", name: " " },
      { ...base, id: "no-type", service_type: ["other"] },
      { ...base, id: "http", official_url: "http://example.com" },
      { ...base, id: "js", official_url: "javascript:alert(1)" },
    ]);
    expect(result.school.map((s) => s.id)).toEqual(["school-a"]);
    expect(result.job_service).toEqual([]);
  });

  it("種別ごとに分け、order の昇順に並べる", () => {
    const result = normalizeServices([
      { ...base, id: "b", name: "B", order: 2 },
      { ...base, id: "a", name: "A", order: 1 },
      { ...base, id: "none", name: "C" },
      { ...base, id: "job", name: "転職X", service_type: ["job_service"] },
    ]);
    expect(result.school.map((s) => s.id)).toEqual(["a", "b", "none"]);
    expect(result.job_service.map((s) => s.id)).toEqual(["job"]);
  });

  it("特徴を 1 行ずつに分け、行頭の記号を取る", () => {
    const [service] = normalizeServices([{ ...base, features: "・現役エンジニアが講師\n- 転職保証あり\r\n\n給付金対象" }]).school;
    expect(service.features).toEqual(["現役エンジニアが講師", "転職保証あり", "給付金対象"]);
  });

  it("広告扱いは明示的に false のときだけ外し、ボタン名は長すぎれば既定に戻す", () => {
    const [a, b] = normalizeServices([
      { ...base, id: "a", name: "A", order: 1, cta_label: "無料カウンセリングを予約" },
      { ...base, id: "b", name: "B", order: 2, sponsored: false, cta_label: "あ".repeat(31) },
    ]).school;
    expect(a.sponsored).toBe(true);
    expect(a.ctaLabel).toBe("無料カウンセリングを予約");
    expect(b.sponsored).toBe(false);
    expect(b.ctaLabel).toBe("公式サイトを見る");
  });

  it("参照記事の id と計測用 URL を検証する", () => {
    const [service] = normalizeServices([
      { ...base, review_article: { id: "review-1" }, tracking_pixel_url: "http://example.com/px" },
    ]).school;
    expect(service.reviewArticleId).toBe("review-1");
    expect(service.trackingPixelUrl).toBeNull();
  });
});

describe("groupByPurpose", () => {
  it("目的ごとにまとめる", () => {
    const { school, job_service } = normalizeServices([
      { ...base, id: "a", name: "A", order: 1, purposes: ["転職", "副業"] },
      { ...base, id: "b", name: "B", order: 2, purposes: ["転職"] },
      { ...base, id: "j", name: "J", service_type: ["job_service"], purposes: ["副業", "副業"] },
    ]);
    const groups = groupByPurpose([...school, ...job_service]);
    expect(groups.map((g) => [g.purpose, g.services.map((s) => s.id)])).toEqual([
      ["転職", ["a", "b"]],
      ["副業", ["a", "j"]],
    ]);
  });
});
