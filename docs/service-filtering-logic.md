# 職種別 × ステージ別 サービス仕分けロジック

`src/lib/learning-path-services-mapping.json` の生成方法と判定根拠をまとめる。

- 生成: `node scripts/build_learning_path_services_mapping.mjs`（属性の修正はスクリプト内の `SCHOOLS` / `SERVICES` を編集して再生成する）
- 確認日: 2026-10-06（各サービスの公式サイトで確認）。2026-10-07 に件数不足の職種へ追加調査分を補充
- 検証: `src/lib/__tests__/learning-path-services-mapping.test.ts`

## 入力

| 入力 | 内容 |
|---|---|
| `files/service-data/ITスクール.xlsm - カテゴリ別サマリー.csv` | 職種ごとのスクール候補（名前のみ） |
| `files/service-data/IT転職サービス.xlsm - カテゴリ別サマリー.csv` | 職種ごとの転職サービス候補（名前のみ） |

| 2026-10-07 の追加調査 | プロダクトマネージャー・DevOps / SRE の転職サービス、モバイル・DevOps / SRE・クラウドアーキテクトのスクール |

CSV には属性が無いため、`beginner_friendly` / `novice_support` / `freelance_available` は公式サイトの記載から判定した。`job_category_matched` は「CSV または追加調査でその職種の候補に挙がっているか」で決める。追加調査で挙がった既存事業者（RaiseTech、SAMURAI ENGINEER、Winスクール など）は、該当職種を `categories` に足している。

## 属性の判定基準

| 属性 | true | false | null |
|---|---|---|---|
| `beginner_friendly`（スクール） | 公式サイトに「未経験」「初心者」向けと明記されたコース・講座がある | 経験者・実務者向けと明記されている | 公式サイトから判断できない |
| `novice_support`（転職サービス） | 未経験者・第二新卒の支援を明記している | 経験者限定・スキル審査ありと明記している | 公式サイトから判断できない |
| `freelance_available`（転職サービス） | フリーランス・業務委託・副業案件を扱うと明記している | 正社員転職のみと明記している | 公式サイトから判断できない |
| `job_category_matched` | CSV でその職種の候補に挙がっている | — | — |

`null` は「該当しない」とは扱わず、絞り込み条件（`=== true`）を満たさないものとして除外する。人間が確認して true/false を確定すると、次の再生成で反映される。

## ステージ別の絞り込み

各職種について、その職種の候補に挙がっていて、かつ提供中（`status: active`）のものを候補とする。並び順はスクリプト内の並び（CSV 順。追加調査の新規分は末尾）に従う。

| ステージ | スクール | 転職サービス | 表示順 |
|---|---|---|---|
| `learning` | `beginner_friendly === true` | `novice_support === true` | スクール → 転職サービス |
| `ready` | 候補すべて | 候補すべて | 転職サービス → スクール |
| `experienced` | 候補すべて | 候補のうち `freelance_available !== true`。フリーランス対応のものは `freelance` に分ける | 転職サービス → スクール、`freelance` は別枠 |

`experienced.freelance` は「職種一致 OR フリーランス対応」の条件どおり、全職種のフリーランス対応サービス（12件）を含む。職種一致のものを先頭に並べ、各エントリの `job_category_matched` で区別できる。同じサービスは `services` と `freelance` の両方には入らない。

## 候補から除外したもの

| 名前 | 職種 | 理由 |
|---|---|---|
| Code Village | フロントエンド | 公式サイトがエラー（500）で内容を確認できない |
| 東京ITスクール（フルスタック研修 / PM&PdM研修） | フルスタック / ITPM | 法人向け研修で個人は申し込めない |
| TechAcademy | フルスタック / DS / QA | 新規申し込みの受付を停止 |
| Aidemy | DA / DS | Aidemy Premium は 2026-06-30 で終了 |
| AI boost | DS | 公式サイトを特定できない |
| PM School | PdM | LP が 404 |
| テックキャンプ PM講座 | PdM | 該当講座を公式サイトで確認できない |
| CHATY | モバイル | 公式サイトを特定できない |
| DevOpsSchool.jp | DevOps / SRE | 英語サイトのみで日本での提供実態を確認できない |
| データサイエンティスト転職ナビ | DS | 公式サイトを特定できない |

## 件数とチェックリスト

| 職種 | learning スクール | learning 転職 | ready 転職 | ready スクール | experienced 転職 | experienced freelance |
|---|---|---|---|---|---|---|
| フロントエンドエンジニア | **2** | 2 | 3 | 2 | 2 | 12 |
| バックエンドエンジニア | 5 | 2 | 3 | 6 | 3 | 12 |
| フルスタックエンジニア | **2** | 3 | 3 | 2 | 2 | 12 |
| データアナリスト | 5 | 5 | 8 | 6 | 6 | 12 |
| データサイエンティスト | 12 | 7 | 11 | 12 | 10 | 12 |
| データエンジニア | 5 | 4 | 5 | 5 | 4 | 12 |
| ITプロジェクトマネージャー | 4 | 3 | 3 | 4 | 3 | 12 |
| プロダクトマネージャー | **1** | 3 | 7 | 2 | 6 | 12 |
| ソフトウェアアーキテクト | 3 | 1 | 3 | 5 | 3 | 12 |
| モバイルアプリエンジニア | **2** | 2 | 3 | 2 | 1 | 12 |
| ネットワークエンジニア | 4 | 3 | 6 | 4 | 3 | 12 |
| テストエンジニア / QA | 3 | 1 | 3 | 4 | 3 | 12 |
| DevOps / SREエンジニア | 7 | 2 | 6 | 11 | 3 | 12 |
| クラウドアーキテクト | 6 | 4 | 10 | 6 | 4 | 12 |

太字は基準（learning スクール 3 件以上・転職サービス 1 件以上）に届いていない箇所。候補の追加はスクリプトの `SCHOOLS` / `SERVICES` に事業者と `categories` を足して再生成する。

- 同一ステージ内の重複: なし（テストで確認）
- 全エントリの属性: あり（未確認は `null`）
- `ready` の職種フィルタ: 全エントリ `job_category_matched: true`（テストで確認）
- `freelance` の正確性: 全エントリ `freelance_available: true`（テストで確認）

## 人間の確認が必要なもの

- **テックギーク**: 現在の主力は Shopify AI アプリ開発講座で、バックエンド全般の講座ではない。バックエンドの候補に残すか判断が必要。
- **AIジョブカレ**: 未経験向けの根拠はプレスリリースのみ。個人向けの申し込みは E資格パッケージに限られる。
- **0円スクール**: 運営会社への就職が前提（18〜35歳・通学）。
- **MyVision**: コンサル転職特化のエージェント（テックゴーの運営会社）。「未経験 8 割」はコンサル未経験を指し、PdM 未経験の支援とは限らない。
- **Winスクール（モバイル）**: 追加調査の URL は法人向けブランド「Winラーニング」のコース。個人は Winスクールの個人レッスンで「スマホアプリ開発実践（React Native）」を受講できる（145,640円・20時間）。
- **KodeKloud / Google Cloud SRE コース**: 英語のみ。Google のコースは中級のため `beginner_friendly: false`。
- **Microsoft Learn**: 無料だが AZ-400（DevOps エンジニア資格）向けの上級レベルのため `beginner_friendly: false`。
- **CloudTech Academy**: 転職サービスの「クラウドワークス テック（旧 クラウドテック）」とは別事業者。
- **beginner_friendly はスクール単位**: エディフィストラーニング・日立アカデミー・CTC教育サービスは初心者向け講座があるため true だが、アーキテクト／QA／DevOps 向けの講座自体が初心者向けとは限らない。
- **null の項目**: スクールはワンダフルコード、ストアカ、Product Institute Japan、JSTQB 認定講座、トップアウト。転職サービスの `novice_support` はテックゴー、転職ドラフト、TechClipsエージェント、Findy、Direct type、Offers、ビズリーチ、フォスターフリーランス、クロスネットワーク、レバテックダイレクト、Midworks。

## 属性一覧（確認日 2026-10-06）

### スクール

| 名前 | 状態 | beginner_friendly | 候補の職種 | 根拠 URL |
|---|---|---|---|---|
| Tech Mentor（Webエンジニアコース） | active | true | FE | https://tech-mentor.dev/ |
| Akros | active | true | FE | https://akros-ac.jp/ |
| 0円スクール（ゼロスク） | active | true | BE | https://zero-school.com/new/ |
| テックギーク | active | true | BE | https://techgeek-school.com/ |
| ポテパンキャンプ | active | true | BE | https://camp.potepan.com/ |
| RUNTEQ | active | true | BE、FS | https://runteq.jp/ |
| RaiseTech | active | true | BE、DevOps、クラウド | https://raise-tech.net/ |
| ワンダフルコード | active | null | BE | https://wonderful-wife.net/study/ |
| テラキャン プログラミング（旧 DMM WEBCAMP） | active | true | FS、DS | https://web-camp.io/ |
| ストアカ | active | null | DA | https://www.street-academy.com/ |
| データミックス（データサイエンティスト育成講座） | active | true | DA | https://datamix.co.jp/school/data-scientist/ |
| CodeCamp | active | true | DA、DS | https://codecamp.jp/courses/engineer |
| AI Academy Bootcamp（AI人材コース） | active | true | DA | https://aiacademy.jp/bootcamp/ |
| インターネット・アカデミー | active | true | DA、QA、DevOps | https://www.internetacademy.jp/ |
| Winスクール | active | true | DA、モバイル、クラウド | https://www.winschool.jp/ |
| データラーニングスクール | active | true | DS、DE | https://school.data-learning.com/ |
| データサイエンスブートキャンプ | active | true | DS | https://l.datasciencebootcamp.net/ |
| スタアカ | active | true | DS | https://toukei-lab.com/achademy/ |
| SAMURAI ENGINEER | active | true | DS、DevOps、クラウド | https://www.sejuku.net/ |
| TECH I.S. | active | true | DS | https://techis.jp/ |
| AIジョブカレ | active | true | DS | https://www.aijobcolle.com/ |
| MITRAtech | active | true | DS | https://mitra-tech.jp/ |
| AI CONNECT | active | true | DS | https://ai-c.net/ |
| .Pro | active | true | DS | https://dotpro.net/ |
| RareTECH | active | true | DS、NW | https://raretech.site/ |
| データミックス（データエンジニア育成講座） | active | true | DE | https://datamix.co.jp/school/expert/dataengineer/ |
| AWS 公式トレーニング | active | true | DE、DevOps、クラウド | https://aws.amazon.com/jp/training/ |
| Google Skills（旧 Google Cloud Skills Boost） | active | true | DE | https://www.skills.google/ |
| Snowflake University | active | true | DE | https://learn.snowflake.com/ |
| アイシンク（PMP 試験対策講座） | active | true | ITPM | https://www.i-think.co.jp/open-seminar/acquisition-online/ |
| トレノケート | active | true | ITPM | https://www.trainocate.co.jp/ |
| アイ・ラーニング | active | true | ITPM | https://www.i-learning.jp/ |
| エディフィストラーニング | active | true | ITPM、アーキテクト、QA | https://www.edifist.co.jp/ |
| Product Institute Japan | active | null | PdM | https://www.productinstitute-japan.com/ |
| Schoo | active | true | PdM | https://schoo.jp/class/2931 |
| カサレアル（クラウドネイティブ道場） | active | false | アーキテクト、DevOps | https://learning.casareal.co.jp/search/cloudnative-dojo |
| CTC教育サービス | active | true | アーキテクト、DevOps | https://www.school.ctc-g.co.jp/ |
| NTTデータ先端技術 | active | false | アーキテクト | https://academy.intellilink.co.jp/ |
| 日立アカデミー | active | true | アーキテクト、QA | https://www.hitachi-ac.co.jp/ |
| ササエル | active | true | NW | https://www.sasa-yell.tech/ |
| ウズウズカレッジ（CCNA コース・有料） | active | true | NW | https://uzuz-college.jp/ccna/ |
| ウズカレIT | active | true | NW | https://uzuz-college.jp/it-shushoku/ |
| JSTQB 認定講座 | active | null | QA | https://www.jstqb.jp/ |
| トップアウト（DevOps 研修） | active | null | DevOps | https://www.topout.co.jp/devops/ |
| iOSアカデミア（追加） | active | true | モバイル | https://ios-academia.com/ |
| Udemy（いまからはじめる DevOps 入門講座）（追加） | active | true | DevOps | https://www.udemy.com/course/getting-started-devops/ |
| KodeKloud（DevOps / SRE Learning Path）（追加） | active | true | DevOps | https://kodekloud.com/learning-path/devops |
| Microsoft Learn（AZ-400 DevOps ラーニングパス）（追加） | active | false | DevOps | https://learn.microsoft.com/ja-jp/training/paths/az-400-work-git-for-enterprise-devops/ |
| Google Cloud SRE コース（Coursera）（追加） | active | false | DevOps | https://cloud.google.com/sre?hl=ja |
| CloudTech Academy（追加） | active | true | クラウド | https://kws-cloud-tech.com/cloudtech-academy-2/ |
| ネットワークアカデミー（AWS SAA 合格保証コース）（追加） | active | true | クラウド | https://www.networkacademy.jp/aws-couse |

### 転職サービス

| 名前 | novice_support | freelance_available | 候補の職種 | 根拠 URL |
|---|---|---|---|---|
| レバテックキャリア | true | false | FE、BE、FS、DA、DS、DE、ITPM、アーキテクト、モバイル、NW、QA、DevOps、クラウド | https://career.levtech.jp/ |
| paiza転職 | false | false | FE、DA | https://paiza.jp/career |
| Green | true | true | FE、FS、モバイル | https://www.green-japan.com/ |
| マイナビ転職 IT AGENT | true | null | BE、DA、DS、DE、PdM、NW | https://mynavi-agent.jp/it/ |
| テックゴー | null | null | BE、DS、PdM、アーキテクト、QA、DevOps | https://tech-go.jp/ |
| ワークポート | true | null | FS | https://www.workport.co.jp/ |
| Geekly | true | null | DA、DS、ITPM、PdM | https://www.geekly.co.jp/ |
| type転職エージェント IT | true | false | DA、DS、クラウド | https://type.career-agent.jp/service/it.html |
| Webist | true | true | DA | https://webist-cri.com/ |
| キッカケエージェント | false | null | DA、PdM | https://kikkakeagent.co.jp/ |
| 転職ドラフト | null | true | DA | https://job-draft.jp/ |
| Symbiorise | true | null | DS、DE | https://symbiorise.com/ |
| ユニゾンキャリア | true | null | DS | https://unison-career.jp/ |
| TechClipsエージェント | null | null | DS | https://agent.tech-clips.com/ |
| Findy | null | false | DS、DE、PdM、DevOps | https://findy-code.io/ |
| Direct type | null | null | DS | https://directtype.jp/ |
| Forkwell Jobs | true | true | DS、DevOps | https://jobs.forkwell.com/ |
| LAPRAS | true | true | DE | https://lapras.com/ |
| リクルートエージェント | true | false | ITPM、NW | https://www.r-agent.com/ |
| Offers | null | true | PdM、モバイル | https://offers.jp/ |
| ビズリーチ | null | null | アーキテクト | https://www.bizreach.jp/ |
| レバテックフリーランス | false | true | NW、DevOps、クラウド | https://freelance.levtech.jp/ |
| フォスターフリーランス | null | true | NW、クラウド | https://freelance.fosternet.jp/ |
| クロスネットワーク | null | true | NW、クラウド | https://www.xnetwork.jp/ |
| レバテックダイレクト | null | false | QA | https://levtech-direct.jp/ |
| クラウドワークス テック（旧 クラウドテック） | false | true | DevOps、クラウド | https://tech.crowdworks.jp/ |
| Midworks | null | true | クラウド | https://mid-works.com/ |
| PE-BANK | false | true | クラウド | https://pe-bank.jp/ |
| パソナキャリア | true | null | クラウド | https://www.pasonacareer.jp/ |
| ソリューションパートナー | true | false | クラウド | https://sol-partner.co.jp/ |
| MyVision（追加） | true | null | PdM | https://my-vision.co.jp/ |
