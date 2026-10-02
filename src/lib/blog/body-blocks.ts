/**
 * 記事本文の繰り返しフィールド（microCMS の body）。
 * カスタムフィールド rich_text（リッチエディタ）と cta_button（外部サービスへのボタン）を任意の順に並べる。
 * 管理画面の入力ミスで記事全体を壊さないよう、形式に合わないブロックは捨てる
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

function toBlock(raw: unknown): BodyBlock | null {
  if (typeof raw !== "object" || raw === null) return null;
  const item = raw as Record<string, unknown>;

  if (item.fieldId === "rich_text") {
    const html = text(item.content);
    return html ? { kind: "rich_text", html } : null;
  }

  if (item.fieldId === "cta_button") {
    const label = text(item.label);
    const url = parseHttpsUrl(item.url);
    if (!label || label.length > MAX_LABEL_LENGTH || !url) return null;
    const note = text(item.note);
    return {
      kind: "cta_button",
      label,
      url: url.href,
      note: note ? note.slice(0, MAX_NOTE_LENGTH) : null,
      sponsored: item.sponsored !== false,
      trackingPixelUrl: parseHttpsUrl(item.tracking_pixel_url)?.href ?? null,
      linkHost: url.host,
    };
  }

  return null;
}

export function normalizeBodyBlocks(raw: unknown): BodyBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(toBlock).filter((block): block is BodyBlock => block !== null);
}
