import { TrackClick } from "@/components/track-click";
import type { CtaButtonBlock } from "@/lib/blog/body-blocks";

// 記事本文中の外部サービスへのボタン（microCMS の cta_button）。広告リンクには rel="sponsored nofollow" と PR 表記を付ける
export function BlogCtaButton({ block, articleId, positionIndex }: { block: CtaButtonBlock; articleId: string; positionIndex: number }) {
  return (
    <div className="relative rounded-2xl border border-line bg-white px-5 py-6 text-center">
      {block.sponsored && <p className="text-xs font-bold text-muted">PR</p>}
      <TrackClick
        className="mt-2"
        event="blog_cta_clicked"
        data={{
          article_id: articleId,
          position_index: positionIndex,
          link_host: block.linkHost,
          sponsored: block.sponsored,
        }}
      >
        <a
          href={block.url}
          target="_blank"
          rel={block.sponsored ? "sponsored nofollow noopener" : "noopener"}
          className="inline-block max-w-full rounded-full bg-indigo px-8 py-3.5 text-sm font-bold text-white shadow-lg shadow-indigo/20 transition hover:bg-ink md:text-base"
        >
          {block.label}
        </a>
      </TrackClick>
      {block.note && <p className="mt-3 text-xs leading-relaxed text-muted">{block.note}</p>}
      {block.trackingPixelUrl && (
        // ASP の計測用画像は広告コードどおりの URL を直接読み込む必要があり、next/image の最適化を通せない
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.trackingPixelUrl} width={1} height={1} alt="" className="absolute h-px w-px opacity-0" />
      )}
    </div>
  );
}
