import type { Metadata } from "next";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/external-link";
import { loadCareerStatistics, loadGoals } from "@/lib/career-match";
import { ESCO, JOBHOP, OPERATOR, SITE_NAME, SITE_URL, STACK_OVERFLOW_SURVEY } from "@/lib/site";

export const metadata: Metadata = {
  title: "免責事項・データ出典",
  description: `${SITE_NAME}の運営者・免責事項と、利用しているオープンデータの出典・ライセンス表記です。`,
  alternates: { canonical: "/disclaimer" },
};

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function Source({ title, rightsHolder, license, usage }: { title: ReactNode; rightsHolder: string; license: ReactNode; usage: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="font-extrabold">{title}</h3>
      <dl className="mt-4 space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-bold text-muted">権利者</dt>
          <dd>{rightsHolder}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">ライセンス</dt>
          <dd>{license}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">利用方法・改変</dt>
          <dd>{usage}</dd>
        </div>
      </dl>
    </div>
  );
}

export default async function DisclaimerPage() {
  const [goal] = await loadGoals();
  const { calculation_version: careerStatisticsVersion } = await loadCareerStatistics(goal.goal_id);
  const siteUrl = `${SITE_URL}/`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">免責事項</h1>

      <div className="mt-8 space-y-8">
        <Section title="運営者">
          <p>
            本サイト（{siteUrl}）の運営者は以下のとおりです。
          </p>
          <dl className="space-y-1">
            <div>
              <dt className="inline">屋号：</dt>
              <dd className="inline">{OPERATOR.name}</dd>
            </div>
            <div>
              <dt className="inline">住所：</dt>
              <dd className="inline">{OPERATOR.address}</dd>
            </div>
            <div>
              <dt className="inline">お問い合わせ先：</dt>
              <dd className="inline">
                <a href={`mailto:${OPERATOR.email}`} className="underline hover:text-indigo">
                  {OPERATOR.email}
                </a>
              </dd>
            </div>
          </dl>
          <p>
            本ページ内では、上記運営者が運営するキャリア診断サービス「{SITE_NAME}」（{siteUrl}）を「{SITE_NAME}」と表記します。
          </p>
        </Section>

        <Section title="コンテンツに関する免責">
          <p>
            {SITE_NAME}のコンテンツは信頼できると思われる情報などに基づいて制作されていますが、配信したコンテンツ情報などに対して{SITE_NAME}は一切責任を負いません。
          </p>
          <p>
            Goal Fit による診断および提供情報は統計データに基づく参考値であり、就職・転職・採用等の結果を保証するものではありません。
          </p>
        </Section>

        <Section title="記事の訂正について">
          <p>記事の内容に事実と異なる点があることが明らかになった場合、真摯に記事の訂正に努めます。</p>
        </Section>

        <Section title="外部リンクに関する免責">
          <p>
            {SITE_NAME}がサイト上やソーシャルメディア上などで共有・配信した外部リンク先の情報においても、{SITE_NAME}は一切責任を負いません。
          </p>
        </Section>

        <Section title="広告リンクに関する免責">
          <p>{SITE_NAME}で配信している広告リンクなどを利用して閲覧者が損害を受けた場合にも、{SITE_NAME}は一切責任を負いません。</p>
        </Section>

        <Section id="licenses" title="データ出典・ライセンス表記">
          <p>{SITE_NAME}のマッチ度算出およびスキル分析エンジンでは、以下のオープンデータセットを活用・独自加工しています。</p>
          <div className="space-y-4 pt-2">
            <Source
              title={<ExternalLink href={JOBHOP.url}>1. {JOBHOP.name}</ExternalLink>}
              rightsHolder={JOBHOP.creator}
              license={
                <ExternalLink href={JOBHOP.licenseUrl}>Creative Commons Attribution 4.0 International（{JOBHOP.license}）</ExternalLink>
              }
              usage={`${SITE_NAME}にて職歴データを独自に集計・加工し、統計値（${careerStatisticsVersion}）を算出・使用しています。`}
            />
            <Source
              title={<ExternalLink href={ESCO.url}>2. {ESCO.name}</ExternalLink>}
              rightsHolder={ESCO.creator}
              license={
                <ExternalLink href={ESCO.licenseUrl}>Creative Commons Attribution 4.0 International（{ESCO.license}）</ExternalLink>
              }
              usage={
                <ul className="list-inside list-disc space-y-1">
                  <li lang="en">{ESCO.statement}</li>
                  <li>{SITE_NAME}は、ESCOの職業分類を独自のGoal（目標職種）に再構成・翻訳して使用しています。</li>
                  <li>表示内容は欧州委員会が公開するESCOの原文とは異なり、欧州委員会はその正確性・最新性・完全性を保証しません。</li>
                </ul>
              }
            />
            <Source
              title={
                <ExternalLink href={STACK_OVERFLOW_SURVEY.url}>
                  3. {STACK_OVERFLOW_SURVEY.name}（{STACK_OVERFLOW_SURVEY.years}）
                </ExternalLink>
              }
              rightsHolder={STACK_OVERFLOW_SURVEY.creator}
              license={
                <>
                  <ExternalLink href={STACK_OVERFLOW_SURVEY.licenseUrl}>{STACK_OVERFLOW_SURVEY.license}</ExternalLink>
                  （個々のデータ内容は
                  <ExternalLink href={STACK_OVERFLOW_SURVEY.contentsLicenseUrl}>{STACK_OVERFLOW_SURVEY.contentsLicense}</ExternalLink>）
                </>
              }
              usage={
                <>
                  {SITE_NAME}は回答データを独自に集計・加工（Goal別の集計、日本市場向けの補正を含む）して統計値を算出しています。算出した統計データは
                  ODbLに基づき
                  <ExternalLink href={STACK_OVERFLOW_SURVEY.derivedDatabaseUrl}>公開・還元しています</ExternalLink>。
                </>
              }
            />
          </div>
        </Section>

        <div className="space-y-1 text-sm text-muted">
          <p>制定日：2026年9月30日</p>
          <p>最終改定日：2026年9月30日</p>
        </div>
      </div>
    </div>
  );
}
