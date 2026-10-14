import type { Nodes, Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import { parseCtaBlock, type BodyBlock, type CtaButtonBlock } from "./body-blocks";

/**
 * 記事本文の Markdown（GFM）を、HTML の本文と ```cta のボタンに分ける。
 * 生の HTML は書けない（remark-rehype が出力しないため、書いたら例外にして気づけるようにする）
 */
export type RenderedMarkdown = {
  blocks: BodyBlock[];
  /** 本文の画像で参照している public/ 配下のパス（存在確認に使う） */
  localAssets: string[];
};

const CTA_LANG = "cta";
const CTA_MARKER = "@@8FITLAB_CTA_";
const CTA_PLACEHOLDER = /<p>@@8FITLAB_CTA_(\d+)@@<\/p>/;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // 脚注の見出しは目次に出さない（buildToc は h2・h3 を拾う）
  .use(remarkRehype, { footnoteLabel: "注釈", footnoteLabelTagName: "p", footnoteBackLabel: "本文に戻る" })
  .use(rehypeStringify);

/** 本文のリンク・画像に使える URL（https・サイト内パス・ページ内リンク・メール） */
function isAllowedUrl(url: string): boolean {
  if (url.startsWith("#")) return true;
  if (url.startsWith("/")) return !url.startsWith("//");
  return /^(https:|mailto:)/i.test(url);
}

function checkNode(node: Nodes, localAssets: string[]): void {
  if (node.type === "heading" && node.depth === 1) {
    throw new Error("本文に「# 見出し」（h1）は使えません。記事タイトルが h1 になるため、本文は ## から始めてください");
  }
  if (node.type === "html") {
    throw new Error(`本文に HTML は書けません（${node.value.slice(0, 40)}）`);
  }
  if (node.type === "code" && node.lang === CTA_LANG) {
    throw new Error("```cta は箇条書きや引用の中には置けません。本文の直下に書いてください");
  }
  if (node.type === "link" || node.type === "image" || node.type === "definition") {
    if (!isAllowedUrl(node.url)) throw new Error(`使えない URL です: ${node.url}（https:// かサイト内のパス）`);
    if (node.type === "image" && node.url.startsWith("/")) localAssets.push(node.url.split(/[?#]/)[0]);
  }
  if ("children" in node) for (const child of node.children) checkNode(child, localAssets);
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const tree = processor.parse(markdown) as Root;
  const ctas: CtaButtonBlock[] = [];
  const localAssets: string[] = [];

  tree.children = tree.children.map((node) => {
    if (node.type !== "code" || node.lang !== CTA_LANG) {
      checkNode(node, localAssets);
      return node;
    }
    let raw: unknown;
    try {
      raw = parseYaml(node.value);
    } catch (error) {
      throw new Error(`cta ブロックの YAML を読めません: ${error instanceof Error ? error.message : String(error)}`);
    }
    ctas.push(parseCtaBlock(raw));
    return { type: "paragraph", children: [{ type: "text", value: `${CTA_MARKER}${ctas.length - 1}@@` }] };
  });

  const html = processor.stringify(processor.runSync(tree));
  const blocks: BodyBlock[] = [];
  const parts = html.split(CTA_PLACEHOLDER);
  // split に捕獲グループがあるため、parts は [本文, CTA の番号, 本文, CTA の番号, ...] の順になる
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      blocks.push(ctas[Number(part)]);
    } else if (part.trim()) {
      blocks.push({ kind: "rich_text", html: part.trim() });
    }
  });
  return { blocks, localAssets };
}
