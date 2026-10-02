# おすすめ記事（microCMS の recommend_* フィールド）

診断結果の「学習ロードマップ」ページ（`/goal-fit/result/[id]/learning-path`）に出すおすすめは、Blog（microCMS の `blogs` API）の記事から選ぶ。記事に次のフィールドを入力すると、おすすめの対象になる。カードのリンク先は常に内部の `/blog/{記事id}` で、外部サイト・アフィリエイトへの案内と PR 表記は記事本文で行う。

## フィールド（管理画面の「API スキーマ」に追加する。すべて任意）

| フィールド ID | 種類 | 内容 |
| --- | --- | --- |
| `recommend_type` | セレクトフィールド（選択肢：`material`、`career_service`。複数選択はオフ） | `material` ＝ 教材（未習得の Step に出す）、`career_service` ＝ 転職サービス（未習得の Step が無い人に出す） |
| `recommend_skill_ids` | テキストエリア | `material` 用。対象の skill_id をカンマまたは改行で区切って入力 |
| `recommend_goal_ids` | テキストエリア | `career_service` 用。対象の goal_id をカンマまたは改行で区切って入力。`all` と書くとすべての Goal に共通 |
| `recommend_order` | 数字 | 小さいほど上位。未入力は 100 |
| `recommend_audience` | セレクトフィールド（選択肢：`learning`、`experienced`。複数選択はオフ） | `career_service` 用。`learning` ＝ 学習中・未経験から使えるサービス、`experienced` ＝ 経験者向けの転職・フリーランスサービス。**未入力（と不正な値）は `experienced`** として扱う。`material` の記事では無視する |

`recommend_type` を入力した記事だけを取得する（`filters=recommend_type[exists]`）。フィールドを追加するまでは、おすすめは 0 件として扱う（ページは学習ロードマップだけを表示する）。

## 入力例

教材（JavaScript と TypeScript の Step に対応する記事）

```
recommend_type:      material
recommend_skill_ids: javascript, typescript
recommend_order:     10
```

転職サービス（Frontend と Backend の診断結果に、学習中・未経験向けとして出す記事）

```
recommend_type:     career_service
recommend_goal_ids: frontend-developer
                    backend-developer
recommend_audience: learning
recommend_order:    20
```

全 Goal 共通の経験者向けサービス（recommend_audience は未入力でも experienced になる）

```
recommend_type:     career_service
recommend_goal_ids: all
recommend_order:    30
```

## 注意点

- **ID は次のファイルの値と完全一致させる**（表示名ではなく ID）。大文字・前後の空白は自動で整えるが、綴りの違いは一致しない。
  - skill_id：`data/skills/tech-skills.json`、`data/skills/human-skills.json`（ツールの tool_id を含む）
  - goal_id：`data/goals/goals.json`
  - Step ごとの選択肢（any_of）：`data/learning-paths/{goal_id}.json`
- 既知でない ID は無視する。既知の ID が 1 つも無い記事と、`recommend_type` が `material` / `career_service` 以外の記事は表示しない（開発環境ではターミナルに除外理由を出す）。
- 教材の割り当て：
  - 未習得の Step：Step の選択肢（any_of）と `recommend_skill_ids` が 1 つでも重なれば一致。最大 3 件。
  - 習得済みの Step：ユーザーが保有している選択肢とだけ照合する（「復習・さらに深めるための教材」。例：Vue を保有していれば React の教材は出さない）。最大 2 件。
  - 未習得の Step を学習順に割り当ててから、習得済みの Step を学習順に割り当てる。同じ記事は最初に一致した Step にだけ出す（未習得と習得済みの両方に一致する記事は未習得側に出る）。上限からあふれた記事は後ろの Step に回さない。
- 転職サービスは、ページ最下部の「転職・キャリア支援サービス」に、`recommend_audience` ごとに最大 3 件ずつ出す（Step の状態に関係なく常に表示）。未習得の Step がある人には学習中・未経験向けを先に、全 Step 習得済みの人には経験者向けを先に並べる。記事の無いグループは出さない。
- 並び順は `recommend_order` の昇順、同じ値なら記事 ID の昇順。記事の数や統計では変えない。
- 表示は下書きでは確認できない（一覧 API は公開済みの記事だけを返す）。本番の Blog 一覧・sitemap にも出るため、公開してよい記事にだけ入力する。
- 本番ではキャッシュ（最大 1 時間。Webhook で即時に破棄）を使う。開発環境では毎回取得する。

## 記事本文の CTA ボタン（繰り返しフィールド body）

記事本文に外部サービス（教材・転職サービスの公式サイト、アフィリエイトリンク）へのボタンを置くには、本文を繰り返しフィールド `body` で書く。本文のブロックとボタンのブロックを好きな順に並べられる。既存の `content`（リッチエディタ）は残してよく、両方あるときは `content` → `body` の順に表示する。

### スキーマの設定（管理画面 > blogs > API 設定 > API スキーマ）

1. **カスタムフィールドを 2 つ作る**（API スキーマの画面の「カスタムフィールド」タブ）

   | カスタムフィールド ID | 表示名 | フィールド（ID：種類） |
   | --- | --- | --- |
   | `rich_text` | 本文 | `content`：リッチエディタ |
   | `cta_button` | CTA ボタン | `label`：テキストフィールド（必須。ボタンの文言。60 文字以内）<br>`url`：テキストフィールド（必須。リンク先。https のみ）<br>`note`：テキストフィールド（任意。ボタンの下の補足。例：無料体験あり／2026年10月時点）<br>`sponsored`：真偽値（初期値 ON。広告・アフィリエイトのリンクなら ON）<br>`tracking_pixel_url`：テキストフィールド（任意。ASP の広告コードに含まれる 1×1 画像の URL） |

2. **API スキーマに繰り返しフィールドを追加する**：フィールド ID `body`、表示名「本文（ブロック）」、種類「繰り返し」、使うカスタムフィールドに `rich_text` と `cta_button` を選ぶ
3. 既存の `content` が必須になっている場合は、必須を外す（`body` だけで書けるようにする）

### 記事の書き方

1. `body` の「＋」で「本文」を追加し、導入・教材の説明を書く。冒頭に「※本記事はプロモーションを含みます」と書く
2. ボタンを置きたい位置で「CTA ボタン」を追加し、`label`（例：「Progate の公式サイトを見る」）と `url` を入れる
3. 続けて「本文」「CTA ボタン」を交互に追加する（ボタンは1記事に数個まで）
4. 画面プレビューで、ボタンの位置・文言・PR 表記を確認してから公開する

### ASP の広告コードの入れ方

ASP（A8.net など）の「テキストリンク」の広告コードは、例えば次の形をしている。

```html
<a href="https://px.a8.net/svt/ejp?a8mat=XXXX" rel="nofollow">テキスト</a>
<img border="0" width="1" height="1" src="https://www10.a8.net/0.gif?a8mat=XXXX" alt="">
```

- `<a href="…">` の URL → `url`
- `<img src="…">` の URL → `tracking_pixel_url`（無い ASP は空欄）
- テキストはそのまま使わず、`label` に自分で書く

### 表示（サイト側で自動で付けるもの）

- `sponsored` が ON：ボタンの上に「PR」、リンクに `rel="sponsored nofollow noopener"`（Google の有料リンクの扱いに合わせる）。OFF（公式ドキュメントなど広告でないリンク）：PR 表記なし、`rel="noopener"`
- 新しいタブで開く
- クリックを Event `blog_cta_clicked`（article_id・position_index・link_host・sponsored）として記録し、GA4 にも送る
- 形式に合わないブロック（文言が空・60 文字超、URL が https でない、空の本文）は表示しない。計測用画像の URL だけ不正なら、画像だけ外してボタンは表示する

### 注意：計測用画像を使う場合

`tracking_pixel_url` を入れると、記事を**開いた時点で** ASP に情報（IP アドレス・ブラウザの情報など）が送られる。プライバシーポリシー 7-4 と Cookie・外部送信ページの「アフィリエイトサービス」は「リンクをクリックして外部サイトへ移動した場合」と書いているため、計測用画像を使う前に「記事内の広告が表示されたとき、またはリンクをクリックしたとき」のように文言を直す。

## 編集者プロフィール（authors API）

記事詳細の冒頭「この記事を書いた人」、記事末尾の「AUTHOR」、サイドバーの「EDITOR」に編集者のプロフィールを出す。

### 設定（最初に1回だけ）

1. **API を作る**：管理画面 > API を作成 > 「リスト形式」、API 名「編集者」、エンドポイント `authors`
2. **authors のスキーマ**

   | フィールド ID | 種類 | 内容 |
   | --- | --- | --- |
   | `name` | テキストフィールド（必須） | 表示名（例：立川 太郎、8FitLab 編集部） |
   | `role` | テキストフィールド | 肩書き（例：8FitLab 運営者／元 Web エンジニア） |
   | `avatar` | 画像 | 顔写真・アイコン（正方形を推奨）。未設定なら名前の1文字目を表示 |
   | `highlights` | テキストエリア | 「この記事を書いた人」に出す要点。1行に1つ（例：Web 制作会社で 5 年間フロントエンド開発） |
   | `bio` | テキストエリア | 記事末尾のプロフィール本文。改行はそのまま表示 |
   | `x_url` / `github_url` / `note_url` / `website_url` | テキストフィールド | SNS・サイトの URL（https のみ表示。空欄は出さない） |

3. **blogs のスキーマに `author` を追加**：種類「コンテンツ参照」、参照先 `authors`
4. API キーの権限で `authors` の GET を許可する（blogs と同じキーを使う）

### 表示のルール

- 記事詳細：記事の `author` に設定した編集者を、冒頭（名前・肩書き・要点）と末尾（プロフィール本文・SNS）に表示し、構造化データ（Article の author）にも Person として出す。未設定の記事はプロフィール欄を出さず、author は運営組織になる
- サイドバー（記事詳細）：記事の編集者。記事に未設定の場合は authors の最初に作った編集者
- authors API が無い・取得に失敗した場合は、プロフィール欄を出さないだけで、ページは表示する

## スクール・転職サービス比較（services API）

/blog の比較欄（ランキングカード・一覧表・目的から探す）に出すサービス。API が無い・0件のときは「掲載サービスは準備中です。」と出す。

### 設定（管理画面 > API を作成）

- API 名：掲載サービス / エンドポイント：`services` / 型：リスト形式
- API 設定 > Webhook：blogs と同じカスタム通知（`/api/revalidate`・同じシークレット）を追加する。追加しないと、変更が反映されるまで最大1時間かかる

| フィールドID | 表示名 | 種類 | 必須 | 内容 |
| --- | --- | --- | --- | --- |
| `name` | サービス名 | テキストフィールド | ○ | |
| `service_type` | 種別 | セレクトフィールド | ○ | 選択肢は `school` と `job_service` の2つ（この文字列のまま） |
| `catch_copy` | キャッチコピー | テキストフィールド | | 例：【未経験から転職を目指すなら】 |
| `logo` | ロゴ | 画像 | | |
| `summary` | 概要 | テキストエリア | | 2〜3行の紹介 |
| `features` | 特徴 | テキストエリア | | 1行に1つ（行頭の「・」は自動で取る） |
| `price` | 料金 | テキストフィールド | | 例：169,800円〜（給付金対象コースあり） |
| `period` | 期間 | テキストフィールド | | スクールのみ。例：4〜16週間 |
| `learning_style` | 学習形式 | テキストフィールド | | スクールのみ。例：オンライン |
| `career_support` | 転職サポート / サポート内容 | テキストフィールド | | スクールは有無、転職サービスは内容 |
| `target` | 対象 | テキストフィールド | | 転職サービスのみ。例：20代・未経験 |
| `purposes` | 目的 | セレクトフィールド（複数選択可） | | 例：未経験から転職、副業・フリーランス、費用を抑えたい。「目的から探す」に選択肢の名前でまとめて出す |
| `official_url` | 公式サイト（広告リンク） | テキストフィールド | ○ | ASP の広告コードの `href`。https のみ |
| `cta_label` | ボタン名 | テキストフィールド | | 30字まで。空なら「公式サイトを見る」 |
| `sponsored` | 広告リンク | 真偽値（初期値 ON） | | 広告でないリンクだけ OFF |
| `tracking_pixel_url` | 計測用画像の URL | テキストフィールド | | 使う場合は「記事本文の CTA ボタン」の注意と同じく、プライバシーポリシーの記述の変更が必要 |
| `review_article` | 詳しい記事 | コンテンツ参照（blogs） | | 設定すると「詳しく見る」ボタンを出す |
| `checked_at` | 情報確認日 | テキストフィールド | | 例：2026年10月2日。料金などを公式サイトで確認した日 |
| `order` | 掲載順 | 数字 | | 小さいほど上（未入力は 100）。同じ値は名前順 |

### 表示のルール

- 種別ごとに、掲載順にランキングカード（番号・キャッチコピー・ロゴ・概要・項目表・特徴・ボタン）と一覧表（横スクロール）を出す
- 項目表の列：スクールは料金・期間・学習形式・転職サポート、転職サービスは対象・料金・サポート
- 名前・種別・https の公式サイトのどれかが無いものは出さない
- 広告リンクには `rel="sponsored nofollow"` と「PR」を付け、クリックを `service_clicked`（サービスID・種別・カードか表か）として記録する
- 掲載順は免責事項の「教材・サービスの選定と掲載順について」（/disclaimer#editorial-policy）のとおり、報酬の有無や金額ではなく編集部の判断で決める。評価点や「満足度」などは、根拠のある数字を用意できるまで載せない

## Blog のレイアウト

- 比較（/blog）：探し方（ページ内リンク）、Goal Fit への案内、「記事内に広告を含む場合があります。」、スクール比較、転職サービス比較、目的から探す、記事一覧
- カテゴリ別一覧（/blog/category/{カテゴリID}）：記事カードを PC・タブレット・スマホとも2列で表示
- 比較・カテゴリ別一覧のサイドバー：Goal Fit（/goal-fit へのボックスリンク）、新着記事（5件）、カテゴリ（記事数つき。公開済みの記事から集計）
- 記事詳細のサイドバー：編集者プロフィール、Goal Fit への案内、新着記事、カテゴリ
- PC はサイドバーを右側、スマホは本文の下に出す
- 記事詳細：パンくず、カテゴリ・公開日・更新日、タイトル、説明文、この記事を書いた人、アイキャッチ、目次（本文の h2・h3 が2つ以上あるとき）、本文、シェア（X・Facebook・はてブ・LINE）、Goal Fit への案内、AUTHOR、関連記事（同じカテゴリを優先して4件）

## 表示確認用のダミー（開発環境だけ）

`.env.local` に `RECOMMENDATION_FIXTURE=1` を書くと、microCMS の代わりに `data/fixtures/recommendations/dummy-articles.json` を読む。production では無効。ダミーの記事は microCMS に無いため、カードのリンク先は 404 になる。
