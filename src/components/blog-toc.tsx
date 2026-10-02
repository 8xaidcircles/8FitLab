import type { TocItem } from "@/lib/blog/toc";

// 見出しが少ない記事では目次を出さない
const MIN_ITEMS = 2;

export function BlogToc({ items }: { items: TocItem[] }) {
  if (items.length < MIN_ITEMS) return null;
  return (
    <details open className="group rounded-2xl border border-line bg-white p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between font-extrabold">
        目次
        <span className="text-xs font-bold text-muted group-open:hidden">表示</span>
        <span className="hidden text-xs font-bold text-muted group-open:inline">閉じる</span>
      </summary>
      <ol className="mt-3 space-y-1.5 text-sm leading-relaxed">
        {items.map((item) => (
          <li key={item.id} className={item.level === 3 ? "pl-5 text-muted" : "font-bold"}>
            <a href={`#${item.id}`} className="hover:text-indigo hover:underline">
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </details>
  );
}
