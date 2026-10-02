export type TocItem = { id: string; text: string; level: 2 | 3 };

const HEADING_PATTERN = /<h([23])((?:\s[^>]*)?)>([\s\S]*?)<\/h\1>/gi;
const ID_PATTERN = /\sid\s*=\s*["']([^"']+)["']/i;

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };

function plainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 本文の h2・h3 から目次を作る。id の無い見出しには id を付けた HTML を返す
 * （microCMS のリッチエディタは見出しに id を付けるが、付いていない本文でも目次から移動できるようにする）
 * 複数の本文ブロックで id が重複しないよう、prefix をブロックごとに変える
 */
export function buildToc(html: string, prefix = "toc"): { html: string; items: TocItem[] } {
  const items: TocItem[] = [];
  let index = 0;
  const output = html.replace(HEADING_PATTERN, (match, level: string, attrs: string, inner: string) => {
    const text = plainText(inner);
    if (!text) return match;
    const existing = attrs.match(ID_PATTERN)?.[1];
    const id = existing ?? `${prefix}-${++index}`;
    items.push({ id, text, level: level === "2" ? 2 : 3 });
    return existing ? match : `<h${level} id="${id}"${attrs}>${inner}</h${level}>`;
  });
  return { html: output, items };
}
