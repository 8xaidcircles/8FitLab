import { describe, expect, it } from "vitest";
import { parseCtaBlock, parseHttpsUrl } from "../body-blocks";

const cta = {
  label: "公式サイトで詳細を見る",
  url: "https://px.a8.net/svt/ejp?a8mat=TEST",
  note: "無料体験あり",
  sponsored: true,
  tracking_pixel_url: "https://www10.a8.net/0.gif?a8mat=TEST",
};

describe("parseCtaBlock", () => {
  it("CTA ボタンに整える", () => {
    expect(parseCtaBlock({ ...cta, label: " 公式サイトで詳細を見る " })).toEqual({
      kind: "cta_button",
      label: "公式サイトで詳細を見る",
      url: "https://px.a8.net/svt/ejp?a8mat=TEST",
      note: "無料体験あり",
      sponsored: true,
      trackingPixelUrl: "https://www10.a8.net/0.gif?a8mat=TEST",
      linkHost: "px.a8.net",
    });
  });

  it("sponsored は明示的に false のときだけ広告扱いを外す（未入力は広告として扱う）", () => {
    expect(parseCtaBlock({ label: "見る", url: "https://example.com" })).toMatchObject({
      sponsored: true,
      note: null,
      trackingPixelUrl: null,
    });
    expect(parseCtaBlock({ ...cta, sponsored: false })).toMatchObject({ sponsored: false });
  });

  it.each([
    ["文言が空", { ...cta, label: " " }, "label"],
    ["文言が長すぎる", { ...cta, label: "あ".repeat(61) }, "60 文字"],
    ["javascript: の URL", { ...cta, url: "javascript:alert(1)" }, "url"],
    ["http の URL", { ...cta, url: "http://example.com" }, "url"],
    ["補足が長すぎる", { ...cta, note: "あ".repeat(201) }, "note"],
    ["sponsored が真偽値でない", { ...cta, sponsored: "yes" }, "sponsored"],
    ["計測用画像が http", { ...cta, tracking_pixel_url: "http://www10.a8.net/0.gif" }, "tracking_pixel_url"],
    ["項目名の誤り", { ...cta, lable: "x" }, "lable"],
    ["YAML でない", "ボタン", "label: ..."],
    ["空", null, "label: ..."],
  ])("%s は例外", (_, raw, message) => {
    expect(() => parseCtaBlock(raw)).toThrow(message);
  });
});

describe("parseHttpsUrl", () => {
  it("https の URL だけ受け付ける", () => {
    expect(parseHttpsUrl(" https://example.com/a ")?.href).toBe("https://example.com/a");
    expect(parseHttpsUrl("data:text/html,x")).toBeNull();
    expect(parseHttpsUrl("not a url")).toBeNull();
    expect(parseHttpsUrl(1)).toBeNull();
  });
});
