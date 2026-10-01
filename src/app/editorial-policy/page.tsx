import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "教材・サービスの選定基準",
  description: `${SITE_NAME}が学習ロードマップで紹介する教材・転職サービスの選び方と、広告（アフィリエイト）の扱いです。`,
  alternates: { canonical: "/editorial-policy" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-extrabold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function EditorialPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">教材・サービスの選定基準</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {SITE_NAME}の学習ロードマップ（Goal Fit の結果から開くページ）では、学習ステップに合う教材や転職・キャリア支援サービスを、{OPERATOR.name}（{SITE_NAME}運営）が書いた
        <Link href="/blog" className="underline hover:text-indigo">
          ブログ
        </Link>
        記事として紹介しています。記事は以下の基準で作成・選定しています。
      </p>

      <div className="mt-8 space-y-8">
        <Section title="選定プロセス">
          <ul className="list-inside list-disc space-y-1">
            <li>学習ステップごとに、そのステップのスキルを習得できる内容かを運営が確認して、紹介する教材を選びます。</li>
            <li>対象レベル、内容の新しさ、公式情報との整合性、学習のしやすさを基準に比較します。</li>
            <li>紹介する教材・サービスごとに、選んだ理由を記事の中に書きます。</li>
          </ul>
        </Section>

        <Section title="表示順と広告収益の独立">
          <p>
            学習ロードマップに表示する記事と、その表示順は運営が決める編集上の順位だけで決まります。広告（アフィリエイト）契約の有無や報酬額によって、表示の可否や順位を変えることはありません。
          </p>
          <p>
            記事内の一部のリンクはアフィリエイトリンクで、経由して購入・申込があると{SITE_NAME}が報酬を受け取る場合があります。アフィリエイトリンクを含む記事には、その旨を記事内に表示します。
          </p>
        </Section>

        <Section title="記事の更新">
          <p>
            紹介している教材・サービスの提供終了や内容の大きな変更が分かった場合は、記事を更新するか、学習ロードマップへの表示を停止します。
          </p>
        </Section>

        <Section title="誤りの報告">
          <p>
            記事の誤り、リンク切れ、内容の変更などにお気づきの場合は、
            <Link href="/contact" className="underline hover:text-indigo">
              お問い合わせ
            </Link>
            からお知らせください。確認のうえ修正します。
          </p>
        </Section>

        <Section title="免責">
          <p>
            記事に書いた価格・内容・提供条件は執筆・更新時点のものです。最新の情報や購入・申込の条件は、各提供元のサイトでご確認ください。教材等の利用によって生じた損害について、{SITE_NAME}は責任を負いません。詳しくは
            <Link href="/disclaimer" className="underline hover:text-indigo">
              免責事項
            </Link>
            をご覧ください。
          </p>
        </Section>

        <div className="space-y-1 text-sm text-muted">
          <p>制定日：2026年9月30日</p>
        </div>
      </div>
    </div>
  );
}
