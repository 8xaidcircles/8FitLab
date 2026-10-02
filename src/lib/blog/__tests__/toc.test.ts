import { describe, expect, it } from "vitest";
import { buildToc } from "../toc";
import { collectCategories } from "../utils";

describe("buildToc", () => {
  it("h2・h3 を順に目次にし、既存の id はそのまま使う", () => {
    const { html, items } = buildToc('<h2 id="h1abc">学ぶ順番</h2><p>本文</p><h3>HTML &amp; CSS</h3><h4>対象外</h4>');
    expect(items).toEqual([
      { id: "h1abc", text: "学ぶ順番", level: 2 },
      { id: "toc-1", text: "HTML & CSS", level: 3 },
    ]);
    expect(html).toContain('<h2 id="h1abc">学ぶ順番</h2>');
    expect(html).toContain('<h3 id="toc-1">HTML &amp; CSS</h3>');
    expect(html).toContain("<h4>対象外</h4>");
  });

  it("見出し内のタグを除いた文字を使い、空の見出しは目次に入れない", () => {
    const { items } = buildToc('<h2 class="x"><strong>太字</strong>の見出し</h2><h2> </h2>', "b");
    expect(items).toEqual([{ id: "b-1", text: "太字の見出し", level: 2 }]);
  });

  it("ブロックごとの prefix で id が重複しない", () => {
    const a = buildToc("<h2>A</h2>", "toc-1").items[0].id;
    const b = buildToc("<h2>B</h2>", "toc-2").items[0].id;
    expect(a).not.toBe(b);
  });
});

describe("collectCategories", () => {
  it("カテゴリごとの記事数を数え、多い順・同数は名前順。カテゴリ無し・不正な id は除く", () => {
    expect(
      collectCategories([
        { category: { id: "career", name: "キャリア" } },
        { category: { id: "skill", name: "スキル" } },
        { category: { id: "career", name: "キャリア" } },
        { category: null },
        { category: { id: "../x", name: "不正" } },
      ]),
    ).toEqual([
      { id: "career", name: "キャリア", count: 2 },
      { id: "skill", name: "スキル", count: 1 },
    ]);
  });
});
