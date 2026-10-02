import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/external-link";
import { SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "Cookie・外部送信について",
  description: `${SITE_NAME}が利用する Cookie と、Google アナリティクス・Google AdSense・アフィリエイトサービスなどの外部サービスへ送信される情報についての公表事項です。`,
  alternates: { canonical: "/cookie-policy" },
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
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

function Transmission({
  name,
  provider,
  data,
  purpose,
  policy,
  optOut,
}: {
  name: string;
  provider: string;
  data: ReactNode;
  purpose: ReactNode;
  policy: ReactNode;
  optOut: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6">
      <h3 className="font-extrabold">{name}</h3>
      <dl className="mt-4 space-y-3 text-sm leading-relaxed">
        <div>
          <dt className="font-bold text-muted">送信先</dt>
          <dd>{provider}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">送信される情報</dt>
          <dd className="space-y-2">{data}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">利用目的</dt>
          <dd className="space-y-2">{purpose}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">送信先のプライバシーポリシー</dt>
          <dd>{policy}</dd>
        </div>
        <div>
          <dt className="font-bold text-muted">送信の停止（オプトアウト）</dt>
          <dd className="space-y-2">{optOut}</dd>
        </div>
      </dl>
    </div>
  );
}

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">Cookie・外部送信について</h1>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted">
        <p>
          {SITE_NAME}では、サービスの提供・改善、アクセス解析、広告の配信およびアフィリエイト成果の計測のためにCookieを利用し、一部の情報を外部の事業者へ送信しています。
        </p>
        <p>
          個人情報の取扱いについては、「
          <Link href="/privacy-policy" className="underline hover:text-indigo">
            プライバシーポリシー
          </Link>
          」をご覧ください。
        </p>
      </div>

      <div className="mt-8 space-y-8">
        <Section title="Cookieとは">
          <p>Cookieは、Webサイトがブラウザに保存する小さなデータです。</p>
          <p>
            {SITE_NAME}自身が発行するanonymous_user_idには、氏名、性別、メールアドレス、電話番号など、利用者を直接識別するための個人情報は含まれません。
          </p>
          <p>
            なお、Google Analytics、Google AdSense、アフィリエイトサービス等の第三者サービスが利用するCookie等については、それぞれのサービス事業者が定める方法で情報が取り扱われます。
          </p>
        </Section>

        <Section title="本サイトが発行するCookie">
          <div className="rounded-2xl border border-line bg-white p-6">
            <h3 className="font-extrabold">anonymous_user_id</h3>
            <div className="mt-2 space-y-2">
              <p>Goal Fitの診断結果を、診断を実行した匿名利用者と関連付けるためのランダムな識別子です。</p>
              <p>Cookieの有効期間は400日です。</p>
              <p>このCookieを削除すると、Cookieを利用して確認する仕組み上、過去のGoal Fitの診断結果を表示できなくなります。</p>
            </div>
          </div>
        </Section>

        <Section title="Cookieに関連付けて保存される情報">
          <p>
            Goal Fitの診断で入力された以下の情報や診断結果、ならびに本サイト上で発生したページ閲覧・操作等の記録は、匿名識別子に関連付けて本サイトのデータベースに保存され、サービスの提供・改善等に利用されます。
          </p>
          <List
            items={[
              "Goal",
              "スキル",
              "資格",
              "職務経験",
              "学歴",
              "Goal Fit等の各種スコア",
              "Skill Gap",
              "Learning Path",
              "ページ閲覧等のEvent情報",
              "Goalの選択、スキルの追加・削除、職務経験・学歴の追加、Goal Fitの計算、Skill Gap・Learning Pathの閲覧等の操作情報",
            ]}
          />
          <p>これらの情報には、氏名、性別、メールアドレス等の直接的な個人情報を紐付けて保存しません。</p>
        </Section>

        <Section title="外部サービスへの送信">
          <div className="space-y-4">
            <Transmission
              name="Google Analytics"
              provider="Google LLC"
              data={
                <>
                  <List
                    items={[
                      "閲覧したページのURL",
                      "参照元",
                      "閲覧日時",
                      "ブラウザ・端末の種類",
                      "IPアドレス",
                      "Cookieの識別子",
                      "本サイト内で発生した一部の操作・イベント",
                    ]}
                  />
                  <p>本サイトでは、氏名、メールアドレス等の直接的な個人情報をGoogle Analyticsに送信しないよう運用しています。</p>
                </>
              }
              purpose="本サイトの利用状況を分析し、サービス、コンテンツおよび機能を改善するため。"
              policy={
                <>
                  Googleの「
                  <ExternalLink href="https://policies.google.com/technologies/partner-sites?hl=ja">
                    サービスを使用するサイトやアプリから収集した情報のGoogleによる使用
                  </ExternalLink>
                  」等をご確認ください。
                </>
              }
              optOut={
                <>
                  Googleが提供する「
                  <ExternalLink href="https://tools.google.com/dlpage/gaoptout?hl=ja">Google Analytics オプトアウト アドオン</ExternalLink>
                  」を利用することができます。
                </>
              }
            />
            <Transmission
              name="Google AdSense"
              provider="Google LLCおよびGoogleが認定した第三者配信事業者"
              data={
                <List
                  items={[
                    "閲覧したページのURL",
                    "閲覧日時",
                    "ブラウザ・端末の種類",
                    "IPアドレス",
                    "Cookieの識別子",
                    "広告の表示・クリック等に関する情報",
                  ]}
                />
              }
              purpose={
                <>
                  <p>本サイトに広告を表示するため。</p>
                  <p>過去のアクセス情報等に基づき、利用者の興味・関心に応じた広告が表示される場合があります。</p>
                </>
              }
              policy={
                <>
                  Googleの
                  <ExternalLink href="https://policies.google.com/technologies/ads?hl=ja">広告に関するポリシー</ExternalLink>
                  等をご確認ください。
                </>
              }
              optOut={
                <>
                  <p>
                    <ExternalLink href="https://adssettings.google.com/">Googleの広告設定</ExternalLink>
                    でパーソナライズ広告を無効にできます。
                  </p>
                  <p>
                    また、第三者配信事業者のCookieについては、
                    <ExternalLink href="https://optout.aboutads.info/">aboutads.info</ExternalLink>
                    から無効化できる場合があります。
                  </p>
                </>
              }
            />
          </div>
        </Section>

        <Section title="アフィリエイトサービス">
          <p>本サイトでは、以下のアフィリエイトサービスを利用する場合があります。</p>
          <List
            items={[
              "A8.net（株式会社ファンコミュニケーションズ）",
              "ValueCommerce（バリューコマース株式会社）",
              "afb（株式会社フォーイット）",
              "アクセストレード（株式会社インタースペース）",
              "もしもアフィリエイト（株式会社もしも）",
            ]}
          />
          <p>
            本サイトの記事等に掲載されたアフィリエイトリンクをクリックして外部サイトへ移動した場合、各アフィリエイトサービス事業者または広告主側において、成果の計測等を目的としてCookieその他の識別技術が利用される場合があります。
          </p>
          <p>アフィリエイトサービス事業者による情報の取扱いについては、各事業者のプライバシーポリシー等をご確認ください。</p>
        </Section>

        <Section title="その他の外部サービス">
          <p>本サイトでは、サービスの提供・運営のため、以下の外部サービスを利用しています。</p>
          <List
            items={[
              "Vercel Inc.：本サイトのホスティング、配信等",
              "Supabase, Inc.：データベース、Assessment等のデータ保存等",
              "Google フォーム：お問い合わせの受付",
            ]}
          />
          <p>これらのサービスでは、本サイトの運営に必要な範囲で情報が送信・保存・処理される場合があります。</p>
        </Section>

        <Section title="Cookieを無効にするには">
          <p>利用者は、ブラウザの設定によりCookieを無効にしたり、保存されたCookieを削除したりすることができます。</p>
          <p>ただし、本サイトのCookieを無効にした場合、Goal Fitの診断結果を表示できなくなります。</p>
          <p>また、匿名利用者とAssessmentとの関連付け等、本サイトの一部機能が正常に利用できない場合があります。</p>
        </Section>

        <Section title="お問い合わせ">
          <p>
            本ページの内容についてのお問い合わせは、{SITE_NAME}の
            <Link href="/contact" className="underline hover:text-indigo">
              お問い合わせページ
            </Link>
            からご連絡ください。
          </p>
        </Section>
      </div>
    </div>
  );
}
