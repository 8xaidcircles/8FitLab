/**
 * 記事 HTML に blog-decor.css（sousyoku-*）向けのマークアップを付ける。
 * Markdown 本文に生 HTML は書けないため、変換後の hast をここで整える。
 */
import type { Element, ElementContent, Root, RootContent, Text } from "hast";

const FAQ_HEADING = /よくある質問|FAQ/;
const SUMMARY_HEADING = /^まとめ|^【まとめ】/;
const ANSWER_PREFIX = /^(?:回答[：:]|A[.．]\s*)/;
/** 記事冒頭の広告表記（Markdown の1段落 → .sousyoku-pr） */
const PR_NOTICE =
  /^(?:※本記事はプロモーションを含みます。|このページには広告（PR）を含みます)$/;

function isElement(node: RootContent | ElementContent | undefined): node is Element {
  return node?.type === "element";
}

function textOf(node: Element | Root | ElementContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element" || node.type === "root") {
    return node.children.map((child) => textOf(child as ElementContent)).join("");
  }
  return "";
}

function el(tagName: string, className: string, children: ElementContent[]): Element {
  return {
    type: "element",
    tagName,
    properties: { className: [className] },
    children,
  };
}

function stripLeadingPrefix(value: string): string | null {
  const match = ANSWER_PREFIX.exec(value);
  return match ? value.slice(match[0].length) : null;
}

function stripAnswerPrefix(nodes: ElementContent[]): ElementContent[] {
  const index = nodes.findIndex((node) => isElement(node) && node.tagName === "p");
  if (index < 0) return nodes;
  const first = nodes[index];
  if (!isElement(first) || first.children.length === 0) return nodes;

  const lead = first.children[0];
  if (lead.type === "element" && lead.tagName === "strong") {
    const text = lead.children.find((child): child is Text => child.type === "text");
    if (!text) return nodes;
    const cleaned = stripLeadingPrefix(text.value);
    if (cleaned === null) return nodes;
    const nextStrong: Element = {
      ...lead,
      children: lead.children.map((child) =>
        child === text ? { type: "text", value: cleaned } : child,
      ),
    };
    const nextParagraph: Element = {
      ...first,
      children: [nextStrong, ...first.children.slice(1)],
    };
    return [...nodes.slice(0, index), nextParagraph, ...nodes.slice(index + 1)];
  }

  if (lead.type === "text") {
    const cleaned = stripLeadingPrefix(lead.value);
    if (cleaned === null) return nodes;
    const nextParagraph: Element = {
      ...first,
      children: [{ type: "text", value: cleaned }, ...first.children.slice(1)],
    };
    return [...nodes.slice(0, index), nextParagraph, ...nodes.slice(index + 1)];
  }

  return nodes;
}

function cleanQuestion(text: string): string {
  return text.replace(/^Q\d*[.．]?\s*/i, "").trim();
}

/** 広告表記の段落を .sousyoku-pr に変換する（生 HTML は Markdown で書けないため） */
function wrapPrNotice(children: RootContent[]): RootContent[] {
  return children.map((node) => {
    if (!isElement(node) || node.tagName !== "p") return node;
    const text = textOf(node).trim();
    if (!PR_NOTICE.test(text)) return node;
    return {
      type: "element",
      tagName: "div",
      properties: { className: ["sousyoku-pr"] },
      children: [{ type: "text", value: "このページには広告（PR）を含みます" }],
    };
  });
}

/** 比較表を横スクロール＋1列目固定の枠で包む */
function wrapTables(children: RootContent[]): RootContent[] {
  return children.map((node) => {
    if (!isElement(node) || node.tagName !== "table") return node;
    return el("div", "sousyoku-table--compare", [node]);
  });
}

/**
 * 「よくある質問 / FAQ」の h2 以降〜次の h2 までを、
 * 各 h3＋直後の本文 → .sousyoku-faq（Q/A）に変換する。
 */
function decorateFaq(children: RootContent[]): RootContent[] {
  const output: RootContent[] = [];
  let i = 0;
  while (i < children.length) {
    const node = children[i];
    if (!isElement(node) || node.tagName !== "h2" || !FAQ_HEADING.test(textOf(node))) {
      output.push(node);
      i += 1;
      continue;
    }
    output.push(node);
    i += 1;
    while (i < children.length) {
      const item = children[i];
      if (isElement(item) && item.tagName === "h2") break;
      if (isElement(item) && item.tagName === "h3") {
        const question = cleanQuestion(textOf(item));
        i += 1;
        const answerNodes: ElementContent[] = [];
        while (i < children.length) {
          const next = children[i];
          if (isElement(next) && (next.tagName === "h2" || next.tagName === "h3")) break;
          answerNodes.push(next as ElementContent);
          i += 1;
        }
        output.push(
          el("div", "sousyoku-faq", [
            el("p", "sousyoku-faq__q", [{ type: "text", value: question }]),
            el("div", "sousyoku-faq__a", stripAnswerPrefix(answerNodes)),
          ]),
        );
        continue;
      }
      output.push(item);
      i += 1;
    }
  }
  return output;
}

/** まとめ見出しの直前に「目次に戻る」を挿入する */
function insertTocBack(children: RootContent[]): RootContent[] {
  const output: RootContent[] = [];
  for (const node of children) {
    if (isElement(node) && node.tagName === "h2" && SUMMARY_HEADING.test(textOf(node))) {
      output.push(
        el("div", "sousyoku-toc-back", [
          {
            type: "element",
            tagName: "a",
            properties: { href: "#blog-toc" },
            children: [{ type: "text", value: "目次に戻る" }],
          },
        ]),
      );
    }
    output.push(node);
  }
  return output;
}

/** rehype プラグイン: 記事本文の hast に装飾クラスを付ける */
export function rehypeBlogDecor() {
  return (tree: Root) => {
    tree.children = insertTocBack(decorateFaq(wrapTables(wrapPrNotice(tree.children))));
  };
}
