import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ExternalLink } from "@/components/external-link";
import { OPERATOR, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "プライバシーポリシー",
  description: `${SITE_NAME}における利用者の情報（キャリア情報・アクセス情報・Cookie 等）の取扱いについて定めたプライバシーポリシーです。`,
  alternates: { canonical: "/privacy-policy" },
};

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="text-lg font-extrabold">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

function SubSection({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-6 space-y-2 pt-2">
      <h3 className="font-extrabold">{title}</h3>
      {children}
    </div>
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

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-sky-soft px-1 py-0.5 text-xs">{children}</code>;
}

export default function PrivacyPolicyPage() {
  const siteUrl = `${SITE_URL}/`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">プライバシーポリシー</h1>
      <p className="mt-3 text-sm leading-relaxed">
        {OPERATOR.name}（以下「当事業者」といいます。）は、当事業者が運営するウェブサイト「{SITE_NAME}」（{siteUrl}
        、以下「本サイト」といいます。）における、利用者の情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。
      </p>

      <div className="mt-8 space-y-8">
        <Section title="1. 運営者">
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
        </Section>

        <Section title="2. 適用範囲">
          <p>本プライバシーポリシーは、本サイトおよび本サイトを通じて提供する{SITE_NAME}の各種機能・サービスに適用されます。</p>
          <p>
            本サイトでは、利用者が入力するキャリア情報、サイト利用に伴って自動的に取得される情報、Cookie等の識別情報、お問い合わせ時に利用者が自ら提供する情報等を取り扱います。
          </p>
        </Section>

        <Section title="3. 個人情報の取得について">
          <p>{SITE_NAME}では、通常のサービス利用にあたり、利用者本人を直接識別することのできる以下の個人情報を取得しません。</p>
          <List
            items={["氏名", "性別", "メールアドレス", "電話番号", "住所", "生年月日", "その他、利用者本人を直接識別することのできる情報"]}
          />
          <p>
            なお、お問い合わせの際などに、利用者が自ら氏名、メールアドレスその他の情報を送信した場合には、当該情報をお問い合わせへの対応に必要な範囲で取得・利用することがあります。
          </p>
        </Section>

        <Section title="4. 匿名識別情報について">
          <p>
            {SITE_NAME}では、会員登録やログイン認証を行わず、本サイトのページ閲覧等の計測イベントが送信されたとき、または診断を送信したときに、サーバーがランダムに生成したUUIDをCookieに保存し、匿名識別子（
            <Code>anonymous_user_id</Code>）として利用します。
          </p>
          <p>
            <Code>anonymous_user_id</Code>
            はランダムに生成された識別子であり、氏名、性別、メールアドレス、電話番号その他の直接的な個人情報を含みません。また、これらの個人情報を紐付けて保存することはありません。
          </p>
          <p>
            <Code>anonymous_user_id</Code> のCookieの有効期間は400日です。
          </p>
          <p>Cookieを削除した場合や、別のブラウザ・端末からアクセスした場合には、別の匿名利用者として扱われることがあります。</p>
        </Section>

        <Section title="5. 当事業者が取得する情報">
          <SubSection title="5-1. キャリア・Assessment情報">
            <p>
              {SITE_NAME}では、Goal Fit、Skill Gap、Learning Path等の機能を提供するため、利用者が入力した以下の情報をAssessment単位で保存します。
            </p>
            <List
              items={[
                "目標職種（Goal）",
                "保有スキル",
                "保有資格",
                "職務経験・経験年数",
                "職務経験の有無に関する回答（実務経験がある／ない／わからない・回答しない）",
                "学歴・学校区分",
                "Goal Fitの計算結果",
                "Skill Match、Experience Match、Education Match等の各評価結果",
                "Skill Gapに関する判定結果",
                "Learning Pathに関する判定結果",
                `その他、${SITE_NAME}の機能提供に必要なAssessment関連情報`,
              ]}
            />
            <p>
              同一利用者が後日スキル、職務経験、学歴等を変更した場合であっても、過去のAssessmentを上書きせず、別のAssessmentとして保存する場合があります。
            </p>
            <p>これらの情報は、氏名、メールアドレスその他の直接的な個人情報と結び付けて保存するものではありません。</p>
          </SubSection>

          <SubSection title="5-2. サイト利用・アクセス情報">
            <p>本サイトでは、以下のような情報を自動的に取得する場合があります。</p>
            <List
              items={[
                "Cookieに保存された識別子",
                "IPアドレス",
                "アクセス日時",
                "閲覧したページのURL",
                "参照元URL",
                "ブラウザの種類・バージョン",
                "OS・端末の種類等の利用環境情報",
                "ページの閲覧、クリックその他の利用履歴",
                "エラーやシステム障害の発生状況",
                "その他、本サイトの提供・保守・安全確保に必要な情報",
              ]}
            />
            <p>
              なお、IPアドレス等のアクセス情報は、本サイトのデータベースに保存していない場合であっても、Vercelのアクセスログ、Google Analyticsその他の外部サービスにより取得・処理される場合があります。
            </p>
          </SubSection>

          <SubSection title="5-3. Event情報">
            <p>
              {SITE_NAME}では、サービスの改善、利用状況の把握、機能設計、統計分析等のため、以下のような利用イベントを記録することがあります。
            </p>
            <List
              items={[
                "ページ閲覧",
                "Goalの選択",
                "Skillの追加・削除",
                "Experienceの追加",
                "Educationの追加",
                "Goal Fitの計算",
                "Skill Gapの閲覧",
                "Learning Pathの閲覧",
                "おすすめ記事のクリック",
              ]}
            />
            <p>おすすめ記事のクリックについては、以下の情報を記録する場合があります。</p>
            <List items={["記事ID", "記事の種別", "表示位置（placement）", "表示順位", "Goal", "Learning Step"]} />
            <p>これらは、サイト利用状況の分析、コンテンツ改善、記事の掲載状況の分析、サービス改善等に利用します。</p>
          </SubSection>
        </Section>

        <Section title="6. 情報の利用目的">
          <p>当事業者は、取得した情報を以下の目的で利用します。</p>
          <SubSection title="6-1. サービスの提供">
            <List
              items={[
                "Goal Fitの計算・表示",
                "Skill Gapの判定・表示",
                "Learning Pathの提示",
                "Assessment情報の保存・参照",
                "サービス上の各種機能の提供",
              ]}
            />
          </SubSection>
          <SubSection title="6-2. サービスの改善・分析">
            <List
              items={[
                "本サイトの利用状況の把握",
                "機能・UI・コンテンツの改善",
                "Goal Fit、Skill Gap、Learning Path等の品質改善",
                "統計資料の作成",
                "利用傾向やキャリア・学習行動の分析",
                "将来のサービス・データ分析機能の開発",
              ]}
            />
          </SubSection>
          <SubSection title="6-3. 広告・アフィリエイト">
            <List
              items={[
                "広告の表示",
                "広告効果の測定",
                "アフィリエイト成果の計測",
                "広告・教材・サービス等の掲載効果の分析",
                "利用者に適した広告・コンテンツを表示するための分析",
              ]}
            />
          </SubSection>
          <SubSection title="6-4. セキュリティ・システム管理">
            <List
              items={[
                "不正アクセス、スパム、ボットその他の不正行為への対応",
                "システム障害・エラーの検知および原因調査",
                "本サイトの安全な運営",
              ]}
            />
          </SubSection>
          <SubSection title="6-5. お問い合わせ対応">
            <List items={["お問い合わせへの回答", "お問い合わせ履歴の管理", "必要な連絡"]} />
          </SubSection>
          <SubSection title="6-6. 法令等への対応">
            <List
              items={["法令、裁判所、行政機関その他の公的機関の要請への対応", "当事業者の権利・財産・安全の保護"]}
            />
          </SubSection>
        </Section>

        <Section id="cookie" title="7. Cookieの利用について">
          <p>
            本サイトでは、サービス提供、利用状況の把握、広告配信、アフィリエイト成果の計測等のため、Cookieその他の識別技術を使用しています。
          </p>
          <p>Cookieとは、利用者がウェブサイトを閲覧した際に、ブラウザや端末に保存される小さな情報です。</p>

          <SubSection title={`7-1. ${SITE_NAME}自身が使用するCookie`}>
            <p>{SITE_NAME}では、匿名利用者を識別するため、ランダムに生成したUUIDをCookieに保存する場合があります。</p>
            <p>このCookieは、本サイトのページ閲覧等の計測イベントが送信されたとき、または診断が送信されたときに、サーバーから発行されます。</p>
            <p>
              Cookieに保存される情報は、匿名識別子（<Code>anonymous_user_id</Code>）として使用するランダムなUUIDです。
            </p>
            <p>このCookieには、氏名、性別、メールアドレス、電話番号、住所その他の直接的な個人情報を保存しません。</p>
            <p>Cookieの有効期間は400日です。</p>
            <p>主な利用目的は、以下のとおりです。</p>
            <List
              items={[
                "Assessmentと匿名利用者を関連付けるため",
                "複数のAssessmentやEventを同一の匿名利用者に関連付けるため",
                "サービス利用状況を分析するため",
              ]}
            />
            <p>
              なお、本サイトのGoal Fitの診断結果は、このCookieを利用して診断を実行した利用者を確認したうえで表示する仕組みとなっています。そのため、本サイトのCookieを無効にした場合、Goal Fitの診断結果を表示できません。
            </p>
          </SubSection>

          <SubSection title="7-2. Google AnalyticsのCookie">
            <p>本サイトでは、Google LLCが提供するGoogle Analytics 4を利用しています。</p>
            <p>Google Analytics 4では、例えば以下のファーストパーティCookieが使用されます。</p>
            <List items={[<Code key="ga">_ga</Code>, <Code key="ga-id">_ga_&lt;識別子&gt;</Code>]} />
            <p>これらのCookieは、ユーザーやセッションを識別し、本サイトの利用状況を分析するために利用されます。</p>
            <p>
              取得される情報には、閲覧したページ、アクセス日時、参照元、ブラウザ・端末等の情報や、サイト上で発生したイベント情報等が含まれる場合があります。
            </p>
            <p>本サイト上で発生した一部の計測イベントは、Google Analytics 4にも送信される場合があります。</p>
            <p>
              Google AnalyticsによるCookie等を利用した計測を希望しない場合は、Googleが提供する「
              <ExternalLink href="https://tools.google.com/dlpage/gaoptout?hl=ja">Google Analytics オプトアウト アドオン</ExternalLink>
              」等を利用することができます。
            </p>
          </SubSection>

          <SubSection title="7-3. Google AdSenseのCookie等">
            <p>本サイトでは、Google LLCが提供するGoogle AdSenseを利用する場合があります。</p>
            <p>
              Google AdSenseでは、広告の配信、広告表示・クリック等の計測、広告の重複表示の抑制、広告配信の最適化等のため、Cookieその他の技術が利用される場合があります。
            </p>
            <p>利用者が過去に本サイトまたは他のウェブサイトを閲覧した情報等に基づき、パーソナライズされた広告が表示される場合があります。</p>
            <p>広告配信に関連して、第三者がCookie、ウェブビーコン、IPアドレス等を利用して情報を取得する場合があります。</p>
            <p>
              パーソナライズ広告は、
              <ExternalLink href="https://adssettings.google.com/">Googleの広告設定</ExternalLink>
              から無効にすることができます。
            </p>
            <p>
              また、第三者配信事業者によるCookieの利用については、
              <ExternalLink href="https://optout.aboutads.info/">aboutads.info</ExternalLink>
              のページから無効化できる場合があります。
            </p>
          </SubSection>

          <SubSection title="7-4. アフィリエイトCookie">
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
              これらのアフィリエイトサービスでは、広告・リンクのクリック、成果の発生、広告効果の測定等を行うため、Cookie、広告識別子、アクセス履歴、ブラウザ・端末情報、参照元情報その他の識別情報が利用される場合があります。
            </p>
            <p>
              利用者が本サイト上の記事内等に掲載されたアフィリエイトリンクをクリックして外部サイトへ移動した場合、アフィリエイトサービス事業者または広告主側において、成果計測のための情報が取得されることがあります。
            </p>
            <p>アフィリエイトサービス事業者による情報の取扱いについては、各事業者のプライバシーポリシー等をご確認ください。</p>
          </SubSection>

          <SubSection title="7-5. Cookieの拒否・削除">
            <p>利用者は、ブラウザの設定によりCookieを無効化したり、保存されたCookieを削除したりすることができます。</p>
            <p>
              ただし、本サイトのCookieを無効化した場合、Goal Fitの診断結果を表示できないほか、匿名利用者の識別、Assessmentの継続的な関連付け等、本サイトの一部機能が正常に利用できない場合があります。
            </p>
            <p>
              また、Google Analytics、Google AdSense、各アフィリエイトサービス等については、各サービスが提供するオプトアウト等の機能を利用できる場合があります。
            </p>
            <p>
              本サイトが利用するCookieおよび外部送信の詳細については、「
              <Link href="/cookie-policy" className="underline hover:text-indigo">
                Cookie・外部送信について
              </Link>
              」をご確認ください。
            </p>
          </SubSection>
        </Section>

        <Section title="8. 外部サービスの利用">
          <p>
            当事業者は、本サイトの提供・運営・分析・お問い合わせ受付・広告配信等のため、以下の外部サービスを利用しています。
          </p>
          <SubSection title="Google LLC">
            <List
              items={[
                "Google Analytics",
                "Google AdSense",
                "Google フォーム（お問い合わせの受付）",
                "その他Googleが提供する本サイト運営上必要なサービス",
              ]}
            />
          </SubSection>
          <SubSection title="株式会社ファンコミュニケーションズ">
            <List items={["A8.net"]} />
          </SubSection>
          <SubSection title="バリューコマース株式会社">
            <List items={["ValueCommerce"]} />
          </SubSection>
          <SubSection title="株式会社フォーイット">
            <List items={["afb"]} />
          </SubSection>
          <SubSection title="株式会社インタースペース">
            <List items={["アクセストレード"]} />
          </SubSection>
          <SubSection title="株式会社もしも">
            <List items={["もしもアフィリエイト"]} />
          </SubSection>
          <SubSection title="Vercel Inc.">
            <p>本サイトのホスティング、配信その他のインフラストラクチャのためにVercelを利用しています。</p>
          </SubSection>
          <SubSection title="Supabase, Inc.">
            <p>Assessment等のデータ保存、データベースその他のサービス提供のためにSupabaseを利用しています。</p>
          </SubSection>
          <p className="pt-2">これらの外部サービス事業者は、それぞれのサービス提供に必要な範囲で情報を取り扱うことがあります。</p>
          <p>
            当事業者は、Google Analytics等の解析・広告サービスに対し、氏名、性別、メールアドレス、電話番号等の直接的に本人を識別できる情報を不必要に送信しないよう運用します。
          </p>
        </Section>

        <Section title="9. 外部送信・第三者サービスによる情報取得">
          <p>
            本サイトでは、第三者が提供する広告、アクセス解析、アフィリエイト、お問い合わせフォームその他のサービスを利用することにより、利用者のブラウザまたは端末から、当該第三者へ以下のような情報が送信される場合があります。
          </p>
          <List
            items={[
              "Cookie等の識別子",
              "IPアドレス",
              "閲覧したページのURL",
              "参照元URL",
              "アクセス日時",
              "広告の表示・クリック情報",
              "ブラウザ・OS・端末等の情報",
              "本サイト上で発生したイベント情報",
              "お問い合わせフォームに利用者が入力した情報",
              "その他、各外部サービスが定める情報",
            ]}
          />
          <p>外部サービスへ送信された情報は、各サービス事業者のプライバシーポリシーその他の規定に基づいて管理・利用されます。</p>
        </Section>

        <Section title="10. 第三者提供">
          <p>当事業者は、取得した個人情報について、法令に基づく場合を除き、あらかじめ本人の同意を得ずに第三者へ提供しません。</p>
          <p>ただし、以下の場合を除きます。</p>
          <ol className="list-inside list-decimal space-y-1">
            <li>個人情報の取扱いを外部の事業者へ委託する場合</li>
            <li>事業承継その他の事情により事業の承継に伴って個人情報が提供される場合</li>
            <li>法令に基づく場合</li>
            <li>人の生命、身体または財産の保護のために必要であり、本人の同意を得ることが困難である場合</li>
            <li>その他、個人情報保護法その他の法令により認められる場合</li>
          </ol>
          <p>
            Cookie、広告識別子その他の情報について、第三者において個人データとして取得されることが想定され、法令上本人の同意その他の対応が必要となる場合には、法令に従って必要な措置を講じます。
          </p>
        </Section>

        <Section title="11. 外国にある事業者への提供・委託">
          <p>本サイトで利用する外部サービスには、日本国外に所在する事業者または国外のサーバー等を利用するものが含まれます。</p>
          <p>そのため、情報が日本国外で保存、処理または取り扱われる場合があります。</p>
          <p>
            当事業者は、外国にある第三者への個人データの提供または委託について、個人情報保護法その他の適用法令に従い、必要な措置を講じます。
          </p>
          <p>
            外部サービス事業者における具体的なデータの保管・処理場所、再委託先その他の取扱いについては、各事業者が公表するプライバシーポリシー、データ処理に関する規約等をご確認ください。
          </p>
        </Section>

        <Section title="12. 情報の保存期間">
          <p>当事業者は、取得した情報について、利用目的を達成するために必要な期間保存します。</p>
          <p>
            Assessment情報については、サービスの提供、過去の結果の参照、サービス改善、統計分析その他の利用目的に必要な範囲で保存する場合があります。
          </p>
          <p>アクセスログ、Event情報等についても、サービスの運営、分析、セキュリティ確保等に必要な期間保存します。</p>
          <p>法令により保存期間が定められている場合には、当該法令に従って保存します。</p>
          <p>保存の必要がなくなった情報については、適切な方法により削除または匿名化等を行います。</p>
          <p>なお、匿名識別Cookieの有効期間は400日です。</p>
        </Section>

        <Section title="13. 安全管理措置">
          <p>当事業者は、取得した情報について、漏えい、滅失または毀損等を防止するため、必要かつ適切な安全管理措置を講じます。</p>
          <p>
            また、アクセス権限の管理、通信の暗号化その他、サービスの規模および性質に応じた技術的・組織的安全管理措置を講じます。
          </p>
        </Section>

        <Section title="14. お問い合わせ時に取得する情報">
          <p>
            お問い合わせは、
            <Link href="/contact" className="underline hover:text-indigo">
              Googleフォーム
            </Link>
            を通じて受け付けます。
          </p>
          <p>お問い合わせの際に利用者が入力した氏名、メールアドレス、その他の情報は、Googleのサービスを通じて送信・保存される場合があります。</p>
          <p>当事業者は、これらの情報をお問い合わせへの対応、本人確認、連絡および対応履歴の管理に必要な範囲で利用します。</p>
        </Section>

        <Section title="15. 個人情報の開示、訂正、利用停止、削除等">
          <p>
            本人は、個人情報保護法その他の法令に基づき、当事業者が保有する本人の個人データについて、開示、訂正、追加、削除、利用停止、消去、第三者提供の停止等を請求できる場合があります。
          </p>
          <p>
            請求を希望される場合は、
            <a href={`mailto:${OPERATOR.email}`} className="underline hover:text-indigo">
              {OPERATOR.email}
            </a>
            までご連絡ください。
          </p>
          <p>当事業者は、法令に従い、本人確認その他必要な手続を行ったうえで、合理的な期間および範囲で対応します。</p>
        </Section>

        <Section title="16. アフィリエイト広告について">
          <p>本サイトには、アフィリエイトプログラムを利用した広告・紹介リンクが含まれています。</p>
          <p>
            利用者が本サイト上の広告・紹介リンクを経由して商品・サービスを購入または申込みした場合、当事業者が紹介料その他の成果報酬を受け取ることがあります。
          </p>
          <p>これにより、利用者に通常の購入・申込みとは別に追加の料金が発生するものではありません。</p>
          <p>また、本サイトでは、広告・アフィリエイトであることが利用者に分かるよう、適切な表示に努めます。</p>
        </Section>

        <Section title="17. 本サイトの情報について">
          <p>本サイトでは、キャリア、スキル、学習、資格、教材、求人その他に関する情報を提供します。</p>
          <p>
            Goal Fit等の結果は、一定のデータ、定義および計算方法に基づいて算出される参考情報であり、特定の職業への就職、転職その他の結果を保証するものではありません。
          </p>
          <p>また、外部サイト、商品またはサービスの内容については、各提供事業者の最新情報をご確認ください。</p>
        </Section>

        <Section title="18. 本プライバシーポリシーの変更">
          <p>
            当事業者は、法令の改正、サービス内容の変更、利用する外部サービスの変更その他必要に応じて、本プライバシーポリシーを変更することがあります。
          </p>
          <p>変更後のプライバシーポリシーは、本サイト上に掲載した時点または別途定めた施行日から効力を生じるものとします。</p>
        </Section>

        <div className="space-y-1 text-sm text-muted">
          <p>制定日：2026年10月2日</p>
          <p>最終改定日：2026年10月2日</p>
        </div>
      </div>
    </div>
  );
}
