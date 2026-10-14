/**
 * 記事本文のブロック。Markdown の本文（rich_text）と、```cta で書いた外部サービスへのボタン（cta_button）を出現順に並べる。
 * CTA の書き間違いは記事を出さずにビルドとテストで止める（広告リンクが壊れたまま公開しない）
 */
export type RichTextBlock = { kind: "rich_text"; html: string };

export type CtaButtonBlock = {
  kind: "cta_button";
  label: string;
  url: string;
  note: string | null;
  /** 広告・アフィリエイトのリンク。rel="sponsored nofollow" と PR 表記を付ける。未入力は true */
  sponsored: boolean;
  /** ASP の広告コードに含まれる計測用の 1×1 画像の URL */
  trackingPixelUrl: string | null;
  linkHost: string;
};

export type BodyBlock = RichTextBlock | CtaButtonBlock;

const MAX_LABEL_LENGTH = 60;
const MAX_NOTE_LENGTH = 200;
const CTA_KEYS = new Set(["label", "url", "note", "sponsored", "tracking_pixel_url"]);

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** https の URL だけ受け付ける（javascript: などを本文に出さない） */
export function parseHttpsUrl(value: unknown): URL | null {
  const raw = text(value);
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** ```cta ブロックの中身（YAML を読んだ値）を CTA ボタンにする。不正なら理由つきで例外 */
export function parseCtaBlock(raw: unknown): CtaButtonBlock {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("cta ブロックは「label: ...」「url: ...」の形で書いてください");
  }
  const item = raw as Record<string, unknown>;
  const unknownKeys = Object.keys(item).filter((key) => !CTA_KEYS.has(key));
  if (unknownKeys.length > 0) throw new Error(`cta ブロックに使えない項目があります: ${unknownKeys.join(", ")}`);

  const label = text(item.label);
  if (!label) throw new Error("cta ブロックの label（ボタンの文言）がありません");
  if (label.length > MAX_LABEL_LENGTH) throw new Error(`cta ブロックの label は ${MAX_LABEL_LENGTH} 文字以内にしてください`);

  const url = parseHttpsUrl(item.url);
  if (!url) throw new Error("cta ブロックの url は https:// で始まる URL にしてください");

  const note = text(item.note);
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`cta ブロックの note は ${MAX_NOTE_LENGTH} 文字以内にしてください`);

  if (item.sponsored !== undefined && typeof item.sponsored !== "boolean") {
    throw new Error("cta ブロックの sponsored は true か false にしてください");
  }

  let trackingPixelUrl: string | null = null;
  if (item.tracking_pixel_url !== undefined && item.tracking_pixel_url !== null) {
    const pixel = parseHttpsUrl(item.tracking_pixel_url);
    if (!pixel) throw new Error("cta ブロックの tracking_pixel_url は https:// で始まる URL にしてください");
    trackingPixelUrl = pixel.href;
  }

  return {
    kind: "cta_button",
    label,
    url: url.href,
    note: note || null,
    sponsored: item.sponsored !== false,
    trackingPixelUrl,
    linkHost: url.host,
  };
}
