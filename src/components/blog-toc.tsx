import type { TocItem } from "@/lib/blog/toc";

// 見出しが少ない記事では目次を出さない
const MIN_ITEMS = 2;

type TocGroup = { item: TocItem; children: TocItem[] };

/** h3 を直前の h2 の下にまとめる（h2 より前の h3 はそのまま上の階層に置く） */
function groupItems(items: TocItem[]): TocGroup[] {
  const groups: TocGroup[] = [];
  for (const item of items) {
    const parent = groups.at(-1);
    if (item.level === 3 && parent?.item.level === 2) parent.children.push(item);
    else groups.push({ item, children: [] });
  }
  return groups;
}

function ListIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 fill-none stroke-white stroke-[2.5]">
      <path strokeLinecap="round" d="M9 6h11M9 12h11M9 18h11" />
      <circle cx="4.5" cy="6" r="1" className="fill-white stroke-none" />
      <circle cx="4.5" cy="12" r="1" className="fill-white stroke-none" />
      <circle cx="4.5" cy="18" r="1" className="fill-white stroke-none" />
    </svg>
  );
}

// 最初は閉じておき、「表示」で開く
export function BlogToc({ items }: { items: TocItem[] }) {
  if (items.length < MIN_ITEMS) return null;
  return (
    // 閉じた details は summary 以外を隠すため、上端の線は外側の要素に付ける
    <div className="overflow-hidden rounded-b-xl bg-white shadow-[0_2px_12px_rgba(15,23,42,0.07)]">
      <div className="bg-brand-gradient h-1" />
      <details className="group">
        <summary className="flex cursor-pointer list-none items-center gap-3 px-5 py-4 md:px-6 [&::-webkit-details-marker]:hidden">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-sky to-indigo">
            <ListIcon />
          </span>
          <span className="text-brand-gradient text-xl font-extrabold">目次</span>
          <span className="ml-2 rounded-full bg-muted/40 px-3.5 py-0.5 text-xs font-bold text-white transition group-hover:bg-muted/60">
            <span className="group-open:hidden">表示</span>
            <span className="hidden group-open:inline">閉じる</span>
          </span>
        </summary>
        <ul className="list-disc space-y-3 pr-5 pb-6 pl-10 marker:text-sky md:pr-6 md:pl-11">
          {groupItems(items).map(({ item, children }) => (
            <li key={item.id} className="text-[0.95rem] leading-relaxed font-bold text-ink">
              <a href={`#${item.id}`} className="hover:text-indigo hover:underline">
                {item.text}
              </a>
              {children.length > 0 && (
                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm font-normal text-muted marker:text-sky/50">
                  {children.map((child) => (
                    <li key={child.id}>
                      <a href={`#${child.id}`} className="hover:text-indigo hover:underline">
                        {child.text}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
