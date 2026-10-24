import type { ReactNode } from "react";

/**
 * 記事本文の挿入広告テンプレート（```ad-insert）。
 * バナー／CTA の ASP HTML は計測のため属性・URL を改変せず埋め込む（文言のみ差し替え可）。
 */

export type BlogAdInsertContent = {
  /** 左上の注目バッジ文言 */
  badge: string;
  /** ASP 提供のバナー HTML（クリック + インプレッション） */
  bannerHtml: string;
  /** 箇条書き本文（強調は <span className="w8-adinsert__em">） */
  bullets: ReactNode;
  /** ASP 提供のテキスト広告 HTML（自由テキスト部分だけ差し替え、CSS でボタン化） */
  ctaHtml: string;
};

/** もしま Remoful */
export const REMOFUL_AD_INSERT: BlogAdInsertContent = {
  badge: "注目　リモート求人",
  bannerHtml:
    '<a href="//af.moshimo.com/af/c/click?a_id=5862991&p_id=5870&pc_id=16301&pl_id=75329" rel="nofollow" referrerpolicy="no-referrer-when-downgrade" attributionsrc><img src="//image.moshimo.com/af-img/1052/000000075329.png" width="504" height="504" style="border:none;"></a><img src="//i.moshimo.com/af/i/impression?a_id=5862991&p_id=5870&pc_id=16301&pl_id=75329" width="1" height="1" style="border:none;" loading="lazy">',
  bullets: (
    <>
      ・リモート求人に特化し、<span className="w8-adinsert__em">希望に合う案件を選りすぐって紹介！</span>
      <br />
      ・競争率の高いリモート求人も、<span className="w8-adinsert__em">企業の実態まで踏まえて伴走！</span>
      <br />
      ・無理な勧誘は一切なし。<span className="w8-adinsert__em">無料のキャリア相談</span>から始められる！
    </>
  ),
  // 自由テキストのみ変更。href / rel / referrerpolicy / attributionsrc / 計測 img はそのまま
  ctaHtml:
    '<a href="//af.moshimo.com/af/c/click?a_id=5862991&p_id=5870&pc_id=16301&pl_id=75201" rel="nofollow" referrerpolicy="no-referrer-when-downgrade" attributionsrc>Remofulで無料相談</a><img src="//i.moshimo.com/af/i/impression?a_id=5862991&p_id=5870&pc_id=16301&pl_id=75201" width="1" height="1" style="border:none;" loading="lazy">',
};

/** 挿入広告の見た目テンプレート（色・余白は blog-decor.css の .w8-adinsert*） */
export function BlogAdInsertTemplate({ content }: { content: BlogAdInsertContent }) {
  return (
    <aside className="w8-adinsert-stack" aria-label="広告">
      <div className="w8-adinsert">
        <p className="w8-adinsert__pr">PR</p>
        <div className="w8-adinsert__badge">{content.badge}</div>
        <div className="w8-adinsert__visual" dangerouslySetInnerHTML={{ __html: content.bannerHtml }} />
        <div className="w8-adinsert__bullets">{content.bullets}</div>
        <div className="w8-adinsert__cta-wrap" dangerouslySetInnerHTML={{ __html: content.ctaHtml }} />
      </div>
    </aside>
  );
}

/** ```ad-insert``` 用。現状は Remoful 1 種 */
export function BlogAdInsert() {
  return <BlogAdInsertTemplate content={REMOFUL_AD_INSERT} />;
}
