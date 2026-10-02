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

function List({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-inside list-disc space-y-1">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
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
          <p>本サイト（{siteUrl}）の運営者は以下のとおりです。</p>
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
            本ページ内では、上記運営者が運営するキャリア・スキル分析サイト「{SITE_NAME}」（{siteUrl}）を「{SITE_NAME}」または「本サイト」と表記し、上記運営者を「運営者」と表記します。
          </p>
        </Section>

        <Section title="本サイトの情報について">
          <p>{SITE_NAME}では、キャリア、スキル、職種、学習等に関する情報および各種分析結果を提供しています。</p>
          <p>
            これらの情報は、一定のデータ、定義、計算方法および事前に定めたルール等に基づいて提供されるものであり、すべての利用者にとって適切または正確であることを保証するものではありません。
          </p>
          <p>利用者は、本サイトの情報を自身の判断および責任において利用するものとします。</p>
        </Section>

        <Section title="Goal Fitについて">
          <p>
            {SITE_NAME}の「Goal Fit」は、利用者が入力したスキル、職務経験、学歴等をもとに、目標とする職種（Goal）との適合度を算出する機能です。
          </p>
          <p>
            Goal Fitでは、Experience（職務経験）およびEducation（学歴）については職歴の統計データをもとに、Skill（スキル）については開発者調査の統計データおよび運営者が独自に定義したスキル要件をもとに、それぞれ定められた計算方法により評価を行います。
          </p>
          <p>
            Goal Fitの計算結果は、一定のデータおよび計算ルールに基づく<strong>参考情報</strong>
            であり、個々の利用者の将来の結果を予測または保証するものではありません。
          </p>
          <p>特に、Goal Fitの結果は、以下を保証するものではありません。</p>
          <List
            items={[
              "就職できること",
              "転職できること",
              "採用されること",
              "希望する職種に就けること",
              "希望する企業に採用されること",
              "希望する給与・待遇を得られること",
              "キャリア上の成功",
              "学習によって一定の成果が得られること",
            ]}
          />
          <p>
            実際の就職・転職・採用等の結果は、求人市場、企業の採用方針、選考内容、実務能力、経験、資格、地域、時期、他の応募者との関係その他のさまざまな要因によって異なります。
          </p>
          <p>したがって、Goal Fitの結果のみをもって、就職、転職、採用その他のキャリア上の判断を行わないでください。</p>
        </Section>

        <Section title="Learning Pathについて">
          <p>
            {SITE_NAME}の「Learning Path」は、利用者のGoalやスキル等に応じて、日本向けに事前に定義された学習順序や、学習に役立つ教材・サービスを紹介する記事等を提示する機能です。
          </p>
          <p>
            Learning Pathで提示される学習順序、教材その他の情報は、学習計画を検討する際の参考情報として提供するものであり、学習効果、資格取得、試験合格、就職、転職、採用その他の成果を保証するものではありません。
          </p>
          <p>また、学習者の知識、経験、学習時間、学習方法その他の状況によって、適切な学習順序や教材は異なる場合があります。</p>
        </Section>

        <Section title="使用データについて">
          <p>{SITE_NAME}では、Goal Fit等の機能において、公開されているオープンデータを利用・加工しています。</p>
          <p>主なデータソースには、以下が含まれます（詳細は下記「データ出典・ライセンス表記」をご覧ください）。</p>
          <List items={["JobHop（CC BY 4.0）", "ESCO（CC BY 4.0）", "Stack Overflow Developer Survey（ODbL）"]} />
          <p>
            JobHopは欧州（ベルギー・フランダース地域）の求職者の職歴データ、ESCOは欧州連合の職業・スキル分類です。そのため、これらをもとに算出したExperienceおよびEducationの評価は、日本の労働市場や採用の傾向と異なる場合があります。また、Stack Overflow Developer Surveyは世界の開発者を対象とした調査であり、{SITE_NAME}では日本の回答者の傾向を反映する補正を行っていますが、日本の実態と一致することを保証するものではありません。
          </p>
          <p>
            これらのデータを利用して算出・表示される情報について、運営者は、元データ自体の完全性、正確性、最新性または将来にわたる有効性を保証するものではありません。
          </p>
          <p>
            また、{SITE_NAME}では、これらのデータをそのまま表示するのではなく、サービスの目的に応じて加工・整理し、独自の計算方法やルールに基づいて利用しています。
          </p>
          <p>そのため、{SITE_NAME}上の表示内容や分析結果は、各データ提供元の見解、評価または推奨を示すものではありません。</p>
        </Section>

        <Section title="情報の正確性・最新性について">
          <p>
            {SITE_NAME}では、掲載する情報について正確な情報を提供するよう努めていますが、その完全性、正確性、最新性、有用性等を保証するものではありません。
          </p>
          <p>
            職種、スキル、資格、学習教材、求人その他の情報は、社会情勢、技術、企業の採用方針、市場環境等によって変更される場合があります。
          </p>
          <p>
            利用者が具体的な就職、転職、学習、資格取得その他の判断を行う際には、必要に応じて各企業、教育機関、資格試験の実施機関、教材提供者その他の公式情報も確認してください。
          </p>
          <p>記事の内容に事実と異なる点があることが明らかになった場合は、速やかに訂正するよう努めます。</p>
        </Section>

        <Section title="外部リンクに関する免責">
          <p>{SITE_NAME}では、外部のウェブサイト、サービス、教材、求人情報その他の情報へのリンクを掲載する場合があります。</p>
          <p>
            リンク先のウェブサイトやサービスは各運営者が管理・提供するものであり、運営者はその内容、正確性、最新性、安全性、継続性等を保証するものではありません。
          </p>
          <p>リンク先の利用によって生じた損害について、運営者は責任を負いません。</p>
        </Section>

        <Section title="広告・アフィリエイトリンクに関する免責">
          <p>{SITE_NAME}では、広告、アフィリエイトリンクその他の紹介リンクを掲載する場合があります。</p>
          <p>
            これらのリンクを経由して利用者が外部サイトの商品・サービス等を購入または利用する場合、その契約は利用者と各商品・サービスの提供事業者との間で成立するものです。
          </p>
          <p>商品・サービスの内容、価格、品質、安全性、提供条件、契約内容その他については、各提供事業者の情報をご確認ください。</p>
          <p>広告・アフィリエイトリンクを通じた外部サービスの利用によって生じた損害について、運営者は責任を負いません。</p>
          <p>
            なお、アフィリエイトリンクを通じて商品・サービスの購入・申込み等が行われた場合、運営者が紹介料等の報酬を受け取ることがあります。これにより、利用者に追加の料金が発生することはありません。
          </p>
        </Section>

        <Section id="editorial-policy" title="教材・サービスの選定と掲載順について">
          <p>
            {SITE_NAME}では、Learning Path（学習ロードマップ）やブログのスクール・転職サービス比較等において、教材、プログラミングスクール、転職・キャリア支援サービス等を紹介しています。紹介する教材・サービスは、以下の基準で選定・掲載しています。
          </p>
          <List
            items={[
              "学習ステップごとに、そのステップのスキルを習得できる内容かを運営者が確認して選定します。",
              "対象レベル、内容の新しさ、料金や期間、サポート内容、学習のしやすさ等をもとに比較します。",
              "紹介する教材・サービスごとに、選定した理由を記事の中に記載します。",
            ]}
          />
          <p>
            教材・サービスの掲載の有無および掲載順は、運営者が定める編集上の基準のみによって決定します。広告・アフィリエイト契約の有無や報酬の金額によって、掲載の有無や順位を変えることはありません。アフィリエイトリンクを含むページには、その旨を表示します。
          </p>
          <p>
            記事等に記載した料金・内容・提供条件等は、記事の執筆・更新時点または情報確認日時点のものです。最新の情報や購入・申込みの条件は、各提供事業者の公式サイトでご確認ください。紹介している教材・サービスの提供終了や内容の大きな変更を把握した場合は、記事を更新するか、掲載を停止します。
          </p>
        </Section>

        <Section title="サービスの変更・停止について">
          <p>運営者は、予告なく、本サイトの内容、機能、提供方法等を変更、追加、削除または停止する場合があります。</p>
          <p>また、システム障害、メンテナンス、通信環境その他の事情により、本サイトを一時的に利用できない場合があります。</p>
          <p>これらによって利用者に生じた損害について、運営者は責任を負いません。</p>
        </Section>

        <Section title="損害等について">
          <p>
            利用者が本サイトの情報、Goal Fit、Learning Pathその他の本サイトの機能を利用したこと、または利用できなかったことによって生じた損害について、運営者に故意または重大な過失がある場合を除き、運営者は責任を負いません。
          </p>
          <p>本ページの各項目において運営者が責任を負わない旨を定めた事項についても、本項の定めが適用されます。</p>
          <p>ただし、適用される法令により免責または責任の制限が認められない場合には、その限りではありません。</p>
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
          <p>制定日：2026年10月2日</p>
          <p>最終改定日：2026年10月2日</p>
        </div>
      </div>
    </div>
  );
}
