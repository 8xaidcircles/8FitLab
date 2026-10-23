/**
 * ブログ記事（content/blog/posts）の内部リンクを検査する。
 * このリポジトリの記事は microCMS ではなくローカル Markdown。
 * 本文は修正せず、レポートだけ出す。
 *
 * 使い方: node scripts/check-internal-links.mjs
 *
 * ※ 手順書の「microCMS + .env.local の API キー」は、本リポジトリでは未使用。
 *   microCMS を導入した場合は、API から本文を取得するようこのスクリプトを拡張する。
 */
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const postsDir = path.join(root, "content/blog/posts");
const SITE_HOSTS = new Set(["8fitlab.com", "www.8fitlab.com"]);
const OLD_PATH_PREFIXES = ["/career-match", "/learning-path", "/editorial-policy"];

const STATIC_ROUTES = new Set([
  "/",
  "/blog",
  "/goal-fit",
  "/contact",
  "/cookie-policy",
  "/disclaimer",
  "/privacy-policy",
]);

function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return { draft: false, body: raw, category: null };
  const fm = match[1];
  const draft = /^\s*draft:\s*true\s*$/m.test(fm);
  const categoryMatch = fm.match(/^\s*category:\s*(\S+)\s*$/m);
  return { draft, body: match[2], category: categoryMatch?.[1] ?? null };
}

function extractMarkdownHrefs(body) {
  const hrefs = [];
  const re = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let m;
  while ((m = re.exec(body))) {
    hrefs.push({ raw: m[2], isImage: m[0].startsWith("![") });
  }
  return hrefs;
}

function toInternalPath(href) {
  if (href.startsWith("#")) return { kind: "hash", path: href };
  if (href.startsWith("/")) {
    const noHash = href.split("#")[0] || "/";
    return { kind: "path", path: noHash === "" ? "/" : noHash, www: false };
  }
  try {
    const url = new URL(href);
    if (!SITE_HOSTS.has(url.hostname)) return { kind: "external" };
    const pathname = url.pathname || "/";
    return {
      kind: "path",
      path: pathname,
      www: url.hostname === "www.8fitlab.com",
      absolute: href,
    };
  } catch {
    return { kind: "other" };
  }
}

function loadKnownRoutes() {
  const known = new Set(STATIC_ROUTES);
  const posts = [];
  for (const name of readdirSync(postsDir)) {
    if (!name.endsWith(".md") || name.startsWith("_")) continue;
    const slug = name.replace(/\.md$/, "");
    const raw = readFileSync(path.join(postsDir, name), "utf8");
    const { draft, body, category } = parseFrontmatter(raw);
    posts.push({ slug, draft, body, category, file: name });
    if (!draft) {
      known.add(`/blog/${slug}`);
      if (category) known.add(`/blog/category/${category}`);
    }
  }
  return { known, posts };
}

function looksLikeOldSlug(pathname) {
  return OLD_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const { known, posts } = loadKnownRoutes();
const wwwHits = [];
const missing = [];
const oldSlugHits = [];

for (const post of posts) {
  if (post.draft) continue;
  for (const { raw, isImage } of extractMarkdownHrefs(post.body)) {
    const parsed = toInternalPath(raw);
    if (parsed.kind === "external" || parsed.kind === "other" || parsed.kind === "hash") continue;
    if (parsed.www) {
      wwwHits.push({ post: post.slug, href: parsed.absolute ?? raw, path: parsed.path });
    }
    if (looksLikeOldSlug(parsed.path)) {
      oldSlugHits.push({ post: post.slug, href: raw, path: parsed.path });
    }
    if (parsed.path.startsWith("/blog/images/") || parsed.path.startsWith("/brand/") || parsed.path.startsWith("/favicon")) {
      const filePath = path.join(root, "public", parsed.path.replace(/^\//, ""));
      if (!existsSync(filePath)) {
        missing.push({ post: post.slug, href: raw, path: parsed.path, reason: "public にファイルなし", isImage });
      }
      continue;
    }
    if (!known.has(parsed.path)) {
      missing.push({ post: post.slug, href: raw, path: parsed.path, reason: "既知ルートにない", isImage });
    }
  }
}

function printTable(title, rows, columns) {
  console.log(`\n## ${title}`);
  if (rows.length === 0) {
    console.log("(なし)");
    return;
  }
  console.log(columns.join(" | "));
  console.log(columns.map(() => "---").join(" | "));
  for (const row of rows) {
    console.log(columns.map((c) => String(row[c] ?? "")).join(" | "));
  }
}

console.log("# 内部リンク検査レポート");
console.log(`既知ルート数: ${known.size} / 公開記事数: ${posts.filter((p) => !p.draft).length}`);
console.log("※ 記事は content/blog/posts（microCMS は未使用）。API キーは不要。");
console.log("※ 正規ホストは https://8fitlab.com（www なし）。www ありの絶対 URL を (1) に出す。");

printTable("(1) www ホストの絶対 URL（正規ホストではない）", wwwHits, ["post", "href", "path"]);
printTable("(2) 存在しない内部リンク（404 候補）", missing, ["post", "href", "path", "reason"]);
printTable("(3) 旧 slug らしいもの", oldSlugHits, ["post", "href", "path"]);
