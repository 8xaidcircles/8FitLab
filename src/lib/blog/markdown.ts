import type { Nodes, Root } from "mdast";
import rehypeStringify from "rehype-stringify";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { parse as parseYaml } from "yaml";
import {
  parseCtaBlock,
  type AdInsertBlock,
  type BodyBlock,
  type CtaButtonBlock,
  type GoalFitBlock,
} from "./body-blocks";
import { rehypeBlogDecor } from "./decorate-html";

/**
 * 記事本文の Markdown（GFM）を、HTML の本文と ```cta のボタン・```goal-fit の診断誘導・```ad-insert の挿入広告に分ける。
 * 生の HTML は書けない（remark-rehype が出力しないため、書いたら例外にして気づけるようにする）。
 * FAQ・比較表・「目次に戻る」は rehypeBlogDecor が sousyoku-* クラスを付ける。
 */
export type RenderedMarkdown = {
  blocks: BodyBlock[];
  /** 本文の画像で参照している public/ 配下のパス（存在確認に使う） */
  localAssets: string[];
};

const CTA_LANG = "cta";
const GOAL_FIT_LANG = "goal-fit";
const AD_INSERT_LANG = "ad-insert";
const BLOCK_LANGS = new Set([CTA_LANG, GOAL_FIT_LANG, AD_INSERT_LANG]);
const BLOCK_MARKER = "@@8FITLAB_BLOCK_";
const BLOCK_PLACEHOLDER = /<p>@@8FITLAB_BLOCK_(\d+)@@<\/p>/;
const LINE_BREAK = /^<br\s*\/?>$/i;

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  // 脚注の見出しは目次に出さない（buildToc は h2・h3 を拾う）
  .use(remarkRehype, { footnoteLabel: "注釈", footnoteLabelTagName: "p", footnoteBackLabel: "本文に戻る" })
  .use(rehypeBlogDecor)
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
    throw new Error(`本文に HTML は書けません（${node.value.slice(0, 40)}）。表のセル内の改行 <br> だけ使えます`);
  }
  // Markdown の表はセル内で改行できないため、<br> だけを改行として受け付ける
  if (node.type === "tableCell") {
    node.children = node.children.map((child) =>
      child.type === "html" && LINE_BREAK.test(child.value.trim()) ? { type: "break" } : child,
    );
  }
  if (node.type === "code" && node.lang && BLOCK_LANGS.has(node.lang)) {
    throw new Error(`\`\`\`${node.lang} は箇条書きや引用の中には置けません。本文の直下に書いてください`);
  }
  if (node.type === "link" || node.type === "image" || node.type === "definition") {
    if (!isAllowedUrl(node.url)) throw new Error(`使えない URL です: ${node.url}（https:// かサイト内のパス）`);
    if (node.type === "image" && node.url.startsWith("/")) localAssets.push(node.url.split(/[?#]/)[0]);
  }
  if ("children" in node) for (const child of node.children) checkNode(child, localAssets);
}

function parseCta(value: string): CtaButtonBlock {
  let raw: unknown;
  try {
    raw = parseYaml(value);
  } catch (error) {
    throw new Error(`cta ブロックの YAML を読めません: ${error instanceof Error ? error.message : String(error)}`);
  }
  return parseCtaBlock(raw);
}

function parseGoalFit(value: string): GoalFitBlock {
  if (value.trim()) throw new Error("```goal-fit の中には何も書かないでください（文言は blog-cta.tsx で共通です）");
  return { kind: "goal_fit" };
}

function parseAdInsert(value: string): AdInsertBlock {
  if (value.trim()) throw new Error("```ad-insert の中には何も書かないでください（文言・バナーは blog-ad-insert.tsx で共通です）");
  return { kind: "ad_insert" };
}

function parseSpecialBlock(lang: string, value: string): BodyBlock {
  if (lang === CTA_LANG) return parseCta(value);
  if (lang === GOAL_FIT_LANG) return parseGoalFit(value);
  return parseAdInsert(value);
}

export function renderMarkdown(markdown: string): RenderedMarkdown {
  const tree = processor.parse(markdown) as Root;
  const specials: BodyBlock[] = [];
  const localAssets: string[] = [];

  tree.children = tree.children.map((node) => {
    if (node.type !== "code" || !node.lang || !BLOCK_LANGS.has(node.lang)) {
      checkNode(node, localAssets);
      return node;
    }
    specials.push(parseSpecialBlock(node.lang, node.value));
    return { type: "paragraph", children: [{ type: "text", value: `${BLOCK_MARKER}${specials.length - 1}@@` }] };
  });

  const html = processor.stringify(processor.runSync(tree));
  const blocks: BodyBlock[] = [];
  const parts = html.split(BLOCK_PLACEHOLDER);
  // split に捕獲グループがあるため、parts は [本文, ブロックの番号, 本文, ブロックの番号, ...] の順になる
  parts.forEach((part, i) => {
    if (i % 2 === 1) {
      blocks.push(specials[Number(part)]);
    } else if (part.trim()) {
      blocks.push({ kind: "rich_text", html: part.trim() });
    }
  });
  return { blocks, localAssets };
}
