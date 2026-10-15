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

  it("GFM（表・打ち消し線）を HTML にする", () => {
    const { blocks } = renderMarkdown("| a | b |\n| --- | --- |\n| 1 | 2 |\n\n~~古い~~");
    const [block] = blocks;
    expect(block.kind === "rich_text" && block.html).toContain("<table>");
    expect(block.kind === "rich_text" && block.html).toContain("<del>古い</del>");
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
    ["javascript: のリンク", "[x](javascript:alert(1))", "使えない URL"],
    ["プロトコル相対のリンク", "[x](//evil.example.com)", "使えない URL"],
    ["CTA の項目の誤り", "```cta\nlabel: 見る\n```", "url"],
    ["CTA の YAML の誤り", "```cta\nlabel: [\n```", "YAML"],
    ["箇条書きの中の CTA", "- 項目\n\n  ```cta\n  label: 見る\n  url: https://example.com\n  ```", "本文の直下"],
    ["中身のある goal-fit", "```goal-fit\nlabel: 試す\n```", "何も書かない"],
    ["引用の中の goal-fit", "> ```goal-fit\n> ```", "本文の直下"],
  ])("%s は例外", (_, markdown, message) => {
    expect(() => renderMarkdown(markdown)).toThrow(message);
  });
});
