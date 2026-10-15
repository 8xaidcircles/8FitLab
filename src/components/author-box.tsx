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

/** 記事末尾のプロフィール */
export function AuthorProfile({ author }: { author: BlogAuthor }) {
  const links = socialLinks(author);
  return (
    <section className="relative overflow-hidden rounded-2xl border border-line bg-white p-6">
      <div className="bg-brand-gradient absolute inset-x-0 top-0 h-1" />
      <p className="text-xs font-bold tracking-widest text-sky">AUTHOR</p>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-start">
        <Avatar author={author} size={88} />
        <div className="min-w-0">
          <p className="text-lg font-extrabold">{author.name}</p>
          {author.role && <p className="text-xs text-muted">{author.role}</p>}
          {author.bio && <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">{author.bio}</p>}
          {links.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
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
