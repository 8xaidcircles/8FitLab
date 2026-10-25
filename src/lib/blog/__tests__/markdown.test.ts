import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../markdown";

describe("renderMarkdown", () => {
  it("本文と ```cta を出現順のブロックに分ける", () => {
    const { blocks } = renderMarkdown(
      [
        "導入。",
        "",
        "## 見出し",
        "",
        "```cta",
        "label: 公式サイトを見る",
        "url: https://example.com/",
        "```",
        "",
        "まとめ。",
      ].join("\n"),
    );
    expect(blocks).toEqual([
      { kind: "rich_text", html: "<p>導入。</p>\n<h2>見出し</h2>" },
      expect.objectContaining({ kind: "cta_button", label: "公式サイトを見る", url: "https://example.com/" }),
      { kind: "rich_text", html: "<p>まとめ。</p>" },
    ]);
  });

  it("```goal-fit を書いた位置に Goal Fit 誘導のブロックを置く", () => {
    const { blocks } = renderMarkdown("前。\n\n```goal-fit\n```\n\n後。");
    expect(blocks).toEqual([
      { kind: "rich_text", html: "<p>前。</p>" },
      { kind: "goal_fit" },
      { kind: "rich_text", html: "<p>後。</p>" },
    ]);
  });

  it("```ad-insert を書いた位置に挿入広告のブロックを置く", () => {
    const { blocks } = renderMarkdown("前。\n\n```ad-insert\n```\n\n後。");
    expect(blocks).toEqual([
      { kind: "rich_text", html: "<p>前。</p>" },
      { kind: "ad_insert" },
      { kind: "rich_text", html: "<p>後。</p>" },
    ]);
  });

  it("広告表記の段落を sousyoku-pr にする", () => {
    const { blocks } = renderMarkdown("このページには広告（PR）を含みます\n\n本文。");
    const [block] = blocks;
    expect(block.kind === "rich_text" && block.html).toContain('class="sousyoku-pr"');
    expect(block.kind === "rich_text" && block.html).toContain("このページには広告（PR）を含みます");
    expect(block.kind === "rich_text" && block.html).not.toContain("<p>このページには広告");
  });

  it("GFM（表・打ち消し線）を HTML にする", () => {
    const { blocks } = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n~~古い~~");
    const [block] = blocks;
    expect(block.kind === "rich_text" && block.html).toContain('<div class="sousyoku-table--compare">');
    expect(block.kind === "rich_text" && block.html).toContain("<table>");
    expect(block.kind === "rich_text" && block.html).toContain("<del>古い</del>");
  });

  it("FAQ 見出し以下の h3 を sousyoku-faq にする", () => {
    const { blocks } = renderMarkdown(
      [
        "## よくある質問",
        "",
        "### 未経験でも大丈夫ですか？",
        "",
        "**回答：はい、可能です。**",
        "",
        "サポートがあります。",
        "",
        "## まとめ：はじめの一歩",
        "",
        "まずは相談を。",
      ].join("\n"),
    );
    const [block] = blocks;
    expect(block.kind).toBe("rich_text");
    if (block.kind !== "rich_text") return;
    expect(block.html).toContain('class="sousyoku-faq"');
    expect(block.html).toContain('class="sousyoku-faq__q"');
    expect(block.html).toContain("未経験でも大丈夫ですか？");
    expect(block.html).toContain('class="sousyoku-faq__a"');
    expect(block.html).toContain("<strong>はい、可能です。</strong>");
    expect(block.html).not.toContain("<h3>");
    expect(block.html).toContain('class="sousyoku-toc-back"');
    expect(block.html).toContain('href="#blog-toc"');
  });

  it("表のセル内の <br> は改行にする", () => {
    const { blocks } = renderMarkdown("| a | b |\n| --- | --- |\n| 1<br>2 | 3<br />4 |");
    const [block] = blocks;
    expect(block.kind === "rich_text" && block.html).toContain("<td>1<br>\n2</td>");
    expect(block.kind === "rich_text" && block.html).toContain("<td>3<br>\n4</td>");
  });

  it("CTA 以外のコードブロックはそのまま本文に出す", () => {
    const { blocks } = renderMarkdown("```ts\nconst a = 1;\n```");
    expect(blocks).toEqual([{ kind: "rich_text", html: '<pre><code class="language-ts">const a = 1;\n</code></pre>' }]);
  });

  it("サイト内の画像のパスを集める", () => {
    expect(renderMarkdown("![図](/blog/images/a.png)\n\n![外部](https://example.com/b.png)").localAssets).toEqual([
      "/blog/images/a.png",
    ]);
  });

  it.each([
    ["h1 見出し", "# タイトル", "h1"],
    ["生の HTML", '<script>alert(1)</script>', "HTML"],
    ["インラインの HTML", 'a <img src="x" onerror="alert(1)"> b', "HTML"],
    ["表の外の <br>", "a<br>b", "HTML"],
    ["表のセル内の <br> 以外の HTML", '| a |\n| --- |\n| <img src="x" onerror="alert(1)"> |', "HTML"],
    ["javascript: のリンク", "[x](javascript:alert(1))", "使えない URL"],
    ["プロトコル相対のリンク", "[x](//evil.example.com)", "使えない URL"],
    ["CTA の項目の誤り", "```cta\nlabel: 見る\n```", "url"],
    ["CTA の YAML の誤り", "```cta\nlabel: [\n```", "YAML"],
    ["箇条書きの中の CTA", "- 項目\n\n  ```cta\n  label: 見る\n  url: https://example.com\n  ```", "本文の直下"],
    ["中身のある goal-fit", "```goal-fit\nlabel: 試す\n```", "何も書かない"],
    ["引用の中の goal-fit", "> ```goal-fit\n> ```", "本文の直下"],
    ["中身のある ad-insert", "```ad-insert\nid: remoful\n```", "何も書かない"],
  ])("%s は例外", (_, markdown, message) => {
    expect(() => renderMarkdown(markdown)).toThrow(message);
  });
});
