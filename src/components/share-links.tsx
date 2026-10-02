// 各 SNS の共有画面へのリンク（外部のスクリプトは読み込まない）
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "ポスト", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { label: "シェア", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { label: "はてブ", href: `https://b.hatena.ne.jp/entry/panel/?url=${u}` },
    { label: "LINE", href: `https://social-plugins.line.me/lineit/share?url=${u}` },
  ];
  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-1 text-xs font-bold tracking-widest text-muted">SHARE</p>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-bold text-indigo transition hover:border-sky"
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
