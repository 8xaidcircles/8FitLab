import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { OPERATOR, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "教材・サービスの選定基準",
  description: `${SITE_NAME}がLearning PathやCareer Matchの結果に掲載する教材・キャリアサービスの選定基準と、広告（アフィリエイト）の扱いです。`,
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
        {SITE_NAME}がLearning PathやCareer Matchの結果に掲載する書籍・オンライン講座・無料ドキュメント・スクール・キャリアサービス（以下「教材等」）は、{OPERATOR.name}（{SITE_NAME}運営）が以下の基準で選定しています。
      </p>

      <div className="mt-8 space-y-8">
        <Section title="選定プロセス">
          <ul className="list-inside list-disc space-y-1">
            <li>学習ステップごとに、そのステップのスキルを習得できる内容かを運営が確認して候補を選びます。</li>
            <li>対象レベル（初級・中級・上級）、内容の新しさ、公式情報との整合性、学習のしやすさを基準に比較します。</li>
            <li>掲載する教材等には、選定理由・対象レベル・価格の目安・確認日を表示します。</li>
          </ul>
        </Section>

        <Section title="掲載順位と広告収益の独立">
          <p>
            掲載順位は運営が決める編集上の順位だけで決まります。広告（アフィリエイト）契約の有無や報酬額によって、掲載の可否や順位を変えることはありません。
          </p>
          <p>
            一部のリンクはアフィリエイトリンクで、経由して購入・申込があると{SITE_NAME}が報酬を受け取る場合があります。アフィリエイトリンクには「PR」と表示します。
          </p>
        </Section>

        <Section title="無料教材の優先">
          <p>同じスキルを学べる無料の教材がある場合は、有料の教材より先に1件表示します。</p>
        </Section>

        <Section title="掲載内容の確認頻度">
          <p>
            掲載している教材等は定期的に内容・価格・リンク先を確認し、最後に確認した日を「確認日」として表示しています。提供終了や内容の大きな変更が分かった場合は、掲載を停止または更新します。
          </p>
        </Section>

        <Section title="誤りの報告">
          <p>
            掲載内容の誤り、リンク切れ、価格の変更などにお気づきの場合は、
            <Link href="/contact" className="underline hover:text-indigo">
              お問い合わせ
            </Link>
            からお知らせください。確認のうえ修正します。
          </p>
        </Section>

        <Section title="免責">
          <p>
            価格・内容・提供条件は確認日時点のものです。最新の情報や購入・申込の条件は、各提供元のサイトでご確認ください。教材等の利用によって生じた損害について、{SITE_NAME}は責任を負いません。詳しくは
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
