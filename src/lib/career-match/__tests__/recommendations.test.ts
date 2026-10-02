import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadGoals, loadKnownIds } from "../data";
import {
  DEFAULT_RECOMMEND_ORDER,
  MAX_CAREER_RECOMMENDATIONS,
  MAX_LEARN_RECOMMENDATIONS,
  MAX_REVIEW_RECOMMENDATIONS,
  buildLearningPathView,
  isRecommendationPlacement,
  normalizeRecommendationArticles,
  resolveCareerRecommendations,
  resolveStepRecommendations,
  type CareerAudience,
  type RawRecommendationArticle,
  type RecommendationArticle,
} from "../recommendations";
import type { LearningStep } from "../types";

const known = {
  skillIds: new Set(["html-css", "javascript", "typescript", "react", "vue", "angular", "git-github"]),
  goalIds: new Set(["frontend-developer", "backend-developer"]),
};

function raw(id: string, fields: Partial<RawRecommendationArticle> = {}): RawRecommendationArticle {
  return { id, title: id, description: "", eyecatch: null, category: null, ...fields };
}

function material(id: string, skill_ids: string[], order = DEFAULT_RECOMMEND_ORDER): RecommendationArticle {
  return { id, title: id, description: "", eyecatch: null, type: "material", skill_ids, goal_ids: [], audience: null, order };
}

function career(id: string, goal_ids: string[], audience: CareerAudience, order = DEFAULT_RECOMMEND_ORDER): RecommendationArticle {
  return { id, title: id, description: "", eyecatch: null, type: "career_service", skill_ids: [], goal_ids, audience, order };
}

function step(learning_order: number, step_id: string, any_of: string[]): LearningStep {
  return { learning_order, step_id, name: step_id, any_of };
}

function permutations<T>(items: readonly T[]): T[][] {
  if (items.length <= 1) return [[...items]];
  return items.flatMap((item, i) => permutations([...items.slice(0, i), ...items.slice(i + 1)]).map((rest) => [item, ...rest]));
}

const ids = (articles: readonly { id: string }[]) => articles.map((a) => a.id);

const steps = [
  step(1, "html-css", ["html-css"]),
  step(2, "javascript", ["javascript"]),
  step(3, "git-github", ["git-github"]),
  step(4, "typescript", ["typescript"]),
  step(5, "framework", ["react", "vue", "angular"]),
];

function byStep(held: ReadonlySet<string>, articles: RecommendationArticle[], input = steps) {
  return Object.fromEntries(
    resolveStepRecommendations(input, held, articles).map((s) => [s.step_id, { mode: s.mode, ids: ids(s.articles) }]),
  );
}

describe("normalizeRecommendationArticles", () => {
  it("セレクトの配列・文字列のどちらも受け付け、不正な種別は除外する", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("array", { recommend_type: ["material"], recommend_skill_ids: "html-css" }),
        raw("string", { recommend_type: "Material ", recommend_skill_ids: "html-css" }),
        raw("invalid", { recommend_type: ["course"], recommend_skill_ids: "html-css" }),
        raw("empty", { recommend_type: [], recommend_skill_ids: "html-css" }),
        raw("missing", { recommend_skill_ids: "html-css" }),
      ],
      known,
    );
    expect(ids(result)).toEqual(["array", "string"]);
  });

  it("カンマ・読点・改行・空白で区切り、前後の空白を除いて小文字にする。重複は 1 つにする", () => {
    const [article] = normalizeRecommendationArticles(
      [raw("a", { recommend_type: ["material"], recommend_skill_ids: " HTML-CSS,javascript\nTypeScript、react  vue,javascript " })],
      known,
    );
    expect(article.skill_ids).toEqual(["html-css", "javascript", "typescript", "react", "vue"]);
  });

  it("既知でない ID は捨て、既知の ID が 1 つも無い記事は除外する", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("mixed", { recommend_type: ["material"], recommend_skill_ids: "javascript, not-a-skill" }),
        raw("unknown", { recommend_type: ["material"], recommend_skill_ids: "not-a-skill" }),
        raw("blank", { recommend_type: ["material"], recommend_skill_ids: "  " }),
        raw("career-unknown", { recommend_type: ["career_service"], recommend_goal_ids: "astronaut" }),
      ],
      known,
    );
    expect(ids(result)).toEqual(["mixed"]);
    expect(result[0].skill_ids).toEqual(["javascript"]);
  });

  it("recommend_goal_ids の all は既知の ID として残す（大文字でも可）", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("all", { recommend_type: ["career_service"], recommend_goal_ids: "ALL" }),
        raw("all-and-unknown", { recommend_type: ["career_service"], recommend_goal_ids: "all, astronaut" }),
        raw("material-all", { recommend_type: ["material"], recommend_skill_ids: "all" }),
      ],
      known,
    );
    expect(result.map((a) => [a.id, a.goal_ids])).toEqual([
      ["all", ["all"]],
      ["all-and-unknown", ["all"]],
    ]);
  });

  it("recommend_audience は career_service だけで使い、配列・文字列を受け付け、未入力・不正な値は experienced", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("array", { recommend_type: ["career_service"], recommend_goal_ids: "all", recommend_audience: ["learning"] }),
        raw("string", { recommend_type: ["career_service"], recommend_goal_ids: "all", recommend_audience: " Learning" }),
        raw("missing", { recommend_type: ["career_service"], recommend_goal_ids: "all" }),
        raw("empty", { recommend_type: ["career_service"], recommend_goal_ids: "all", recommend_audience: [] }),
        raw("invalid", { recommend_type: ["career_service"], recommend_goal_ids: "all", recommend_audience: ["student"] }),
        raw("material", { recommend_type: ["material"], recommend_skill_ids: "react", recommend_audience: ["learning"] }),
      ],
      known,
    );
    expect(result.map((a) => [a.id, a.audience])).toEqual([
      ["array", "learning"],
      ["string", "learning"],
      ["missing", "experienced"],
      ["empty", "experienced"],
      ["invalid", "experienced"],
      ["material", null],
    ]);
  });

  it("種別ごとに使う欄だけを読む（material は goal_ids、career_service は skill_ids を無視）", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("m", { recommend_type: ["material"], recommend_skill_ids: "react", recommend_goal_ids: "frontend-developer" }),
        raw("c", { recommend_type: ["career_service"], recommend_skill_ids: "react", recommend_goal_ids: "Frontend-Developer" }),
        raw("c-without-goal", { recommend_type: ["career_service"], recommend_skill_ids: "react" }),
      ],
      known,
    );
    expect(result).toMatchObject([
      { id: "m", skill_ids: ["react"], goal_ids: [] },
      { id: "c", skill_ids: [], goal_ids: ["frontend-developer"] },
    ]);
  });

  it("recommend_order の未入力・不正な値は 100", () => {
    const result = normalizeRecommendationArticles(
      [
        raw("set", { recommend_type: ["material"], recommend_skill_ids: "react", recommend_order: 5 }),
        raw("null", { recommend_type: ["material"], recommend_skill_ids: "react", recommend_order: null }),
        raw("none", { recommend_type: ["material"], recommend_skill_ids: "react" }),
      ],
      known,
    );
    expect(result.map((a) => a.order)).toEqual([5, DEFAULT_RECOMMEND_ORDER, DEFAULT_RECOMMEND_ORDER]);
  });
});

describe("resolveStepRecommendations", () => {
  it("未習得は learn（any_of 全体で一致）、習得済みは review（保有している選択肢だけで一致）", () => {
    const held = new Set(["html-css", "vue"]);
    const result = byStep(held, [
      material("html-book", ["html-css"]),
      material("react-book", ["react"]),
      material("vue-book", ["vue"]),
      material("ts-book", ["typescript"]),
    ]);
    expect(result).toEqual({
      "html-css": { mode: "review", ids: ["html-book"] },
      javascript: { mode: "learn", ids: [] },
      "git-github": { mode: "learn", ids: [] },
      typescript: { mode: "learn", ids: ["ts-book"] },
      // Vue を保有 → 習得済み。保有していない React の教材は出さない
      framework: { mode: "review", ids: ["vue-book"] },
    });
  });

  it("未習得と習得済みの両方に一致する記事は、learning_order が後でも未習得の Step に出す", () => {
    const held = new Set(["javascript"]);
    const result = byStep(held, [material("js-and-ts", ["javascript", "typescript"])]);
    expect(result.javascript).toEqual({ mode: "review", ids: [] });
    expect(result.typescript).toEqual({ mode: "learn", ids: ["js-and-ts"] });
  });

  it("recommend_order の昇順、同順位は記事 id の昇順。教材以外は出さない", () => {
    const result = byStep(new Set(), [
      material("c", ["html-css"], 10),
      material("b", ["html-css"], 10),
      material("a", ["html-css"], 20),
      career("agent", ["all"], "learning", 1),
    ]);
    expect(result["html-css"].ids).toEqual(["b", "c", "a"]);
  });

  it(`上限は learn ${MAX_LEARN_RECOMMENDATIONS} 件・review ${MAX_REVIEW_RECOMMENDATIONS} 件`, () => {
    const articles = ["a", "b", "c", "d"].flatMap((x) => [material(`html-${x}`, ["html-css"]), material(`js-${x}`, ["javascript"])]);
    const result = byStep(new Set(["html-css"]), articles);
    expect(result["html-css"]).toEqual({ mode: "review", ids: ["html-a", "html-b"] });
    expect(result.javascript).toEqual({ mode: "learn", ids: ["js-a", "js-b", "js-c"] });
  });

  it("最初に一致した Step で上限からあふれた記事も、後ろの Step には回さない", () => {
    const articles = [...["a", "b", "c"].map((x) => material(x, ["javascript"], 1)), material("overflow", ["javascript", "typescript"], 2)];
    const result = byStep(new Set(), articles);
    expect(result.javascript.ids).toEqual(["a", "b", "c"]);
    expect(result.typescript.ids).toEqual([]);
  });

  it("Step と記事の入力順を入れ替えても結果が同じ", () => {
    const held = new Set(["html-css", "javascript"]);
    const articles = [
      material("b", ["html-css"], 10),
      material("a", ["html-css", "git-github"], 10),
      material("c", ["javascript", "typescript"], 5),
      material("d", ["javascript"]),
    ];
    const expected = byStep(held, articles);
    for (const p of permutations(articles)) expect(byStep(held, p)).toEqual(expected);
    for (const p of permutations(steps)) expect(byStep(held, articles, p)).toEqual(expected);
    expect(expected).toMatchObject({
      "html-css": { mode: "review", ids: ["b"] },
      javascript: { mode: "review", ids: ["d"] },
      "git-github": { mode: "learn", ids: ["a"] },
      typescript: { mode: "learn", ids: ["c"] },
    });
  });
});

describe("resolveCareerRecommendations", () => {
  const articles = [
    career("learn-b", ["frontend-developer"], "learning", 20),
    career("learn-a", ["frontend-developer"], "learning", 10),
    career("exp-backend", ["backend-developer"], "experienced", 1),
    career("exp-all", ["all"], "experienced", 30),
    career("exp-a", ["frontend-developer", "backend-developer"], "experienced", 10),
    career("exp-b", ["frontend-developer"], "experienced", 10),
    career("exp-c", ["frontend-developer"], "experienced", 40),
    material("book", ["react"], 1),
  ];

  it(`audience で分け、goalId か all の記事を recommend_order → id の順で最大 ${MAX_CAREER_RECOMMENDATIONS} 件`, () => {
    const result = resolveCareerRecommendations("frontend-developer", articles);
    expect(ids(result.learning)).toEqual(["learn-a", "learn-b"]);
    expect(ids(result.experienced)).toEqual(["exp-a", "exp-b", "exp-all"]);
  });

  it("別の Goal の記事は出さず、all は全 Goal に出す。該当が無いグループは空", () => {
    const backend = resolveCareerRecommendations("backend-developer", articles);
    expect(ids(backend.learning)).toEqual([]);
    expect(ids(backend.experienced)).toEqual(["exp-backend", "exp-a", "exp-all"]);
    const other = resolveCareerRecommendations("data-analyst", articles);
    expect(ids(other.learning)).toEqual([]);
    expect(ids(other.experienced)).toEqual(["exp-all"]);
    expect(resolveCareerRecommendations("data-analyst", [])).toEqual({ learning: [], experienced: [] });
  });
});

describe("表示確認用のダミー（data/fixtures/recommendations/dummy-articles.json）", () => {
  it("実データの ID で正規化すると、未知の ID と不正な種別の記事だけが除外される", async () => {
    const [text, knownIds, goals] = await Promise.all([
      readFile(path.join(process.cwd(), "data", "fixtures", "recommendations", "dummy-articles.json"), "utf-8"),
      loadKnownIds(),
      loadGoals(),
    ]);
    const { contents } = JSON.parse(text) as { contents: RawRecommendationArticle[] };
    const result = normalizeRecommendationArticles(contents, {
      skillIds: knownIds.skillIds,
      goalIds: new Set(goals.map((g) => g.goal_id)),
    });
    const excluded = ["dummy-unknown-skill", "dummy-invalid-type", "dummy-career-unknown-goal"];
    expect(ids(result).sort()).toEqual(
      ids(contents)
        .filter((id) => !excluded.includes(id))
        .sort(),
    );
    expect(result.filter((a) => a.type === "career_service")).toHaveLength(5);
    for (const article of contents) expect(article.title, article.id).toMatch(/^【ダミー】/);
  });
});

describe("buildLearningPathView", () => {
  const skillName = (id: string) => id.toUpperCase();
  const articles = [
    material("html-book", ["html-css"], 1),
    material("vue-book", ["vue"], 1),
    material("react-book", ["react"], 1),
    career("learn-a", ["frontend-developer"], "learning", 1),
    career("exp-a", ["all"], "experienced", 1),
  ];
  const allSkills = new Set(steps.flatMap((s) => s.any_of));

  function cardsOf(view: ReturnType<typeof buildLearningPathView>) {
    return [...view.missing, ...view.satisfied].flatMap((s) => s.cards).concat(view.career.flatMap((g) => g.cards));
  }

  it("未習得を learning_order 順に番号付けし、習得済みには保有スキル名と review のカードを付ける", () => {
    const view = buildLearningPathView("frontend-developer", [...steps].reverse(), new Set(["html-css", "vue"]), articles, skillName);
    expect(view.missing.map((s) => [s.number, s.step.step_id, s.cards.map((c) => c.article_id)])).toEqual([
      [1, "javascript", []],
      [2, "git-github", []],
      [3, "typescript", []],
    ]);
    expect(view.satisfied.map((s) => [s.step.step_id, s.held_names, s.cards.map((c) => [c.article_id, c.placement])])).toEqual([
      ["html-css", ["HTML-CSS"], [["html-book", "step_review"]]],
      ["framework", ["VUE"], [["vue-book", "step_review"]]],
    ]);
    expect(view.has_materials).toBe(true);
  });

  it("未習得のカードは placement = step_learn、step_id と位置を持つ", () => {
    const view = buildLearningPathView("frontend-developer", steps, new Set(), articles, skillName);
    expect(view.missing[4].cards.map((c) => [c.article_id, c.placement, c.step_id, c.position_index, c.type_label])).toEqual([
      ["react-book", "step_learn", "framework", 0, "教材"],
      ["vue-book", "step_learn", "framework", 1, "教材"],
    ]);
  });

  it("未習得があるときも転職セクションがあり、学習中向けが先", () => {
    const view = buildLearningPathView("frontend-developer", steps, new Set(["html-css"]), articles, skillName);
    expect(view.career.map((g) => [g.audience, g.heading, g.cards.map((c) => [c.article_id, c.placement, c.step_id])])).toEqual([
      ["learning", "学習中・未経験から使えるサービス", [["learn-a", "career_learning", null]]],
      ["experienced", "経験者向けの転職・フリーランスサービス", [["exp-a", "career_experienced", null]]],
    ]);
  });

  it("全 Step 習得済みなら経験者向けが先", () => {
    const view = buildLearningPathView("frontend-developer", steps, allSkills, articles, skillName);
    expect(view.missing).toEqual([]);
    expect(view.career.map((g) => g.audience)).toEqual(["experienced", "learning"]);
  });

  it("記事の無いグループは出さない。教材が 0 件なら has_materials = false", () => {
    const onlyExperienced = buildLearningPathView("frontend-developer", steps, new Set(), [career("exp-a", ["all"], "experienced")], skillName);
    expect(onlyExperienced.career.map((g) => g.audience)).toEqual(["experienced"]);
    expect(onlyExperienced.has_materials).toBe(false);
    expect(buildLearningPathView("frontend-developer", steps, new Set(), [], skillName).career).toEqual([]);
  });

  it("すべてのリンクが内部の /blog/ で始まる（外部サイトへのリンクを出さない）", () => {
    const tricky = [
      material("https://evil.example.com", ["html-css"]),
      material("//evil.example.com", ["javascript"]),
      career("javascript:alert(1)", ["frontend-developer"], "learning"),
    ];
    for (const held of [new Set<string>(), new Set(["html-css"]), allSkills]) {
      const cards = cardsOf(buildLearningPathView("frontend-developer", steps, held, [...articles, ...tricky], skillName));
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        expect(card.href, card.article_id).toMatch(/^\/blog\/[^/]/);
        expect(isRecommendationPlacement(card.placement), card.article_id).toBe(true);
      }
    }
  });
});
