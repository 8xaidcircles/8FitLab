import Image from "next/image";
import { ExternalLink } from "@/components/external-link";
import { parseHttpsUrl } from "@/lib/blog/body-blocks";
import type { BlogAuthor } from "@/lib/blog/types";

function Avatar({ author, size }: { author: BlogAuthor; size: number }) {
  if (author.avatar) {
    return (
      <Image
        src={author.avatar.url}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-line object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      aria-hidden
      className="bg-brand-gradient flex shrink-0 items-center justify-center rounded-full font-extrabold text-white"
      style={{ width: size, height: size }}
    >
      {author.name.slice(0, 1)}
    </div>
  );
}

function lines(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・\-*]\s*/, "").trim())
    .filter(Boolean);
}

const SOCIAL_LINKS = [
  { key: "x_url", label: "X" },
  { key: "github_url", label: "GitHub" },
  { key: "note_url", label: "note" },
  { key: "website_url", label: "Web" },
] as const;

function socialLinks(author: BlogAuthor) {
  return SOCIAL_LINKS.flatMap(({ key, label }) => {
    const url = parseHttpsUrl(author[key]);
    return url ? [{ label, href: url.href }] : [];
  });
}

/** 記事冒頭の「この記事を書いた人」 */
export function AuthorSummary({ author }: { author: BlogAuthor }) {
  const points = lines(author.highlights);
  return (
    <aside className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-bold text-muted">この記事を書いた人</p>
      <div className="mt-3 flex items-start gap-4">
        <Avatar author={author} size={56} />
        <div className="min-w-0">
          <p className="font-extrabold">{author.name}</p>
          {author.role && <p className="text-xs text-muted">{author.role}</p>}
          {points.length > 0 && (
            <ul className="mt-2 list-inside list-disc space-y-1 text-sm leading-relaxed marker:text-sky">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </aside>
  );
}

/** 記事末尾・サイドバーのプロフィール */
export function AuthorProfile({ author, compact = false }: { author: BlogAuthor; compact?: boolean }) {
  const links = socialLinks(author);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-6">
      <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
      <p className="text-xs font-bold tracking-widest text-sky">{compact ? "EDITOR" : "AUTHOR"}</p>
      <div className={compact ? "mt-3 flex flex-col items-center text-center" : "mt-3 flex flex-col gap-4 sm:flex-row sm:items-start"}>
        <Avatar author={author} size={compact ? 72 : 88} />
        <div className={compact ? "mt-3" : "min-w-0"}>
          <p className="text-lg font-extrabold">{author.name}</p>
          {author.role && <p className="text-xs text-muted">{author.role}</p>}
          {author.bio && (
            <p className={`mt-2 text-sm leading-relaxed whitespace-pre-line ${compact ? "line-clamp-5 text-left" : ""}`}>{author.bio}</p>
          )}
          {links.length > 0 && (
            <ul className={`mt-3 flex flex-wrap gap-2 ${compact ? "justify-center" : ""}`}>
              {links.map((link) => (
                <li key={link.label}>
                  <ExternalLink
                    href={link.href}
                    className="inline-block rounded-full border border-line px-3 py-1 text-xs font-bold text-indigo transition hover:border-sky"
                  >
                    {link.label}
                  </ExternalLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
