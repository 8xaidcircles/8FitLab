import { describe, expect, it } from "vitest";
import { normalizeBodyBlocks, parseHttpsUrl } from "../body-blocks";

const cta = {
  fieldId: "cta_button",
  label: "公式サイトで詳細を見る",
  url: "https://px.a8.net/svt/ejp?a8mat=TEST",
  note: "無料体験あり",
  sponsored: true,
  tracking_pixel_url: "https://www10.a8.net/0.gif?a8mat=TEST",
};

describe("normalizeBodyBlocks", () => {
  it("rich_text と cta_button を入力順のまま整える", () => {
    expect(normalizeBodyBlocks([{ fieldId: "rich_text", content: " <p>本文</p> " }, cta])).toEqual([
      { kind: "rich_text", html: "<p>本文</p>" },
      {
        kind: "cta_button",
        label: "公式サイトで詳細を見る",
        url: "https://px.a8.net/svt/ejp?a8mat=TEST",
        note: "無料体験あり",
        sponsored: true,
        trackingPixelUrl: "https://www10.a8.net/0.gif?a8mat=TEST",
        linkHost: "px.a8.net",
      },
    ]);
  });

  it("sponsored は明示的に false のときだけ広告扱いを外す（未入力は広告として扱う）", () => {
    const [unset] = normalizeBodyBlocks([{ ...cta, sponsored: undefined }]);
    const [off] = normalizeBodyBlocks([{ ...cta, sponsored: false }]);
    expect(unset).toMatchObject({ sponsored: true });
    expect(off).toMatchObject({ sponsored: false });
  });

  it("ボタン文言・https の URL が無い CTA、空の本文、未知のブロックは捨てる", () => {
    expect(
      normalizeBodyBlocks([
        { ...cta, label: " " },
        { ...cta, label: "あ".repeat(61) },
        { ...cta, url: "javascript:alert(1)" },
        { ...cta, url: "http://example.com" },
        { fieldId: "rich_text", content: "  " },
        { fieldId: "unknown", content: "<p>x</p>" },
        null,
        "text",
      ]),
    ).toEqual([]);
  });

  it("計測用画像は https だけ。不正なら画像だけ外してボタンは残す", () => {
    const [block] = normalizeBodyBlocks([{ ...cta, tracking_pixel_url: "http://www10.a8.net/0.gif" }]);
    expect(block).toMatchObject({ kind: "cta_button", trackingPixelUrl: null });
  });

  it("配列でなければ空", () => {
    expect(normalizeBodyBlocks(undefined)).toEqual([]);
    expect(normalizeBodyBlocks({ fieldId: "rich_text", content: "<p>x</p>" })).toEqual([]);
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
