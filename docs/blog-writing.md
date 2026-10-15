# Blog の書き方（Markdown）

Blog の記事・編集者・カテゴリ・比較サービスは、すべてリポジトリの `content/blog/` に置く。記事を追加・変更したら、コミットして PR を出し、マージすると本番に出る。記事はブラウザの管理画面（Pages CMS）からも書ける（下の「管理画面（Pages CMS）」）。

```
content/blog/
  posts/{スラッグ}.md   記事（frontmatter + Markdown 本文）。_template.md は記事にならない
  categories.yml        カテゴリ
  authors.yml           編集者プロフィール
  services.yml          /blog の比較欄に出すスクール・転職サービス
public/blog/images/     記事・編集者・サービスの画像
```

## 公開までの流れ

1. ブランチを作り、`content/blog/posts/_template.md` をコピーして `posts/{スラッグ}.md` を作る。スラッグ（ファイル名）が URL `/blog/{スラッグ}` になる（英数字・`-`・`_`。公開後は変えない）
2. 画像を使う場合は `public/blog/images/{スラッグ}/` に置く
3. `npm test` を実行する（`content.test.ts` が全記事の形式を検査する）。開発サーバー（`npm run dev`）では下書きも表示される
4. コミットして PR を出す。Vercel のプレビュー URL で表示を確認する（プレビューでは `draft: true` の記事も表示され、冒頭に「下書きです」と出る）
5. `draft: true` を消すか `false` にしてマージする → 本番に出る（sitemap にも自動で載り、`noindex` も付かない。Webhook などの操作は不要）

- `draft: true` の記事は、本番（`VERCEL_ENV=production`）では一覧・記事ページ・sitemap・おすすめのどこにも出ない。URL を直接開いても 404。プレビューでは `noindex` を付ける
- 記事の無いカテゴリページも 404 になる。そのカテゴリの記事を公開すると、カテゴリページも自動で作られて検索エンジンに登録できる状態になる（判定は `src/lib/blog/utils.ts` の `postRobots`・`categoryRobots`）
- 形式の誤り（必須項目の欠け、存在しないカテゴリ・画像、CTA の URL の誤りなど）は、テストとビルドが「ファイル名: 理由」で失敗する。ビルドが失敗したデプロイは本番に反映されないため、壊れた記事が公開されることはない
- 自動投稿（Claude Code など）も同じ流れで行う：記事ファイルを書く → `npm test` → コミット → PR（またはマージ）

## 管理画面（Pages CMS）

[Pages CMS](https://app.pagescms.org) は、GitHub のリポジトリのファイルをブラウザの入力画面で編集する無料のサービス。保存すると GitHub にコミットされ、Vercel が自動でデプロイする。設定はリポジトリ直下の `.pages.yml`。

### 最初に1回だけ

1. https://app.pagescms.org を開き、GitHub アカウントでサインインする
2. 「GitHub App をインストール」で、`8xaidcircles/8FitLab` だけを選んでインストールする（Only select repositories）
3. リポジトリ一覧から 8FitLab を開く。左のメニューに「ブログ記事」が出る

### 記事を書いて公開する

1. 「ブログ記事」を開いて新規作成のボタンを押す。最初にファイル名を聞かれるので、`{スラッグ}.md`（英数字とハイフン。例 `backend-developer-school.md`）にする。これが URL `/blog/{スラッグ}` になり、公開後は変えない
2. タイトル・説明文・公開日・カテゴリ・職種・アイキャッチを入力する。本文には雛形（CTA ボタン・Goal Fit・比較表の例）が入っているので、書き換える
3. 「下書き」をオンのまま「Save」する。下書きは本番サイトに出ない（保存のたびに `main` にコミットされるが、公開はされない）
4. 公開するときは「下書き」をオフにして「Save」する。数分で本番に出る（sitemap にも載り、`noindex` も付かない）

- 画像は、アイキャッチは入力欄から、本文の画像は左メニューの「Media」からアップロードし、本文に `![説明](/blog/images/...)` と書く。ファイル名は英数字とハイフンにする（日本語は使わない）。共通画像（`/blog/images/common/`）はアップロード不要
- 本文は Markdown で書く（見たまま編集のエディタにすると、CTA ボタン・Goal Fit・表のセル内の `<br>` が保存時に崩れるため）
- 書き方を間違えて保存すると、そのデプロイは失敗して本番は前の状態のまま（壊れた記事は公開されない）。GitHub の Actions（CI）と Vercel のデプロイに「ファイル名: 理由」が出るので、直して保存し直す
- 公開前にプレビューしたいときは、画面左上のブランチ選択で新しいブランチ（例 `post/backend-developer-school`）を作ってから書く。そのブランチの Vercel プレビュー URL（GitHub のコミット・PR に出る）で、下書きも表示される。確認後、GitHub で PR を作ってマージする
- カテゴリ・執筆者・職種の選択肢は `.pages.yml` に書いてある。`categories.yml`・`authors.yml`・`data/goals/goals.json` を変えたら `.pages.yml` も合わせる（`pages-cms.test.ts` がずれを検出する）

## frontmatter

記事の先頭に `---` で囲んで書く（YAML）。ここに無い項目を書くとエラーになる（綴りの誤りに気づけるように）。

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `title` | ○ | タイトル（100 文字以内）。ページの h1 になる |
| `description` | ○ | 一覧・検索結果に出る説明文（300 文字以内） |
| `publishedAt` | ○ | 公開日。`2026-10-15`（日本時間の 0 時）か `2026-10-15T09:00:00+09:00`。一覧はこの新しい順 |
| `updatedAt` | | 内容を更新した日。書くと「更新 ◯◯」と構造化データの dateModified に出る |
| `category` | | `categories.yml` の id |
| `goal` | | 職種。`data/goals/goals.json` の goal_id か名前。`[frontend-developer, backend-developer]` のように複数可。職種カテゴリ（/blog/category/{goal_id}）に出る |
| `author` | | `authors.yml` の id |
| `eyecatch` | | アイキャッチ画像。`/blog/images/{スラッグ}/eyecatch.png` の形（`public/blog/` 配下だけ）。横 1200 × 縦 630 程度を推奨 |
| `draft` | | `true` の間は本番に出ない |
| `recommend_*` | | おすすめ記事の設定（下の「おすすめ記事」） |

## 本文

GitHub と同じ Markdown（GFM）で書く。表・打ち消し線・チェックリスト・脚注が使える。

- 見出しは `##`（h2）と `###`（h3）。h2・h3 が2つ以上あると目次が出る。`#`（h1）はタイトルと重なるため使えない
- 広告を含む記事は、冒頭に「※本記事はプロモーションを含みます。」と書く
- リンクは `https://`、サイト内のパス（`/goal-fit` など）、`#見出し`、`mailto:` だけ使える
- 画像は `![説明](/blog/images/{スラッグ}/xxx.png)`。サイト内の画像はファイルが無いとエラーになる
- HTML は書けない（書くとエラー）。装飾は Markdown の範囲で行う。例外として、表のセル内の改行だけ `<br>` が使える
- 表は横にスクロールでき、1行目が見出し（水色の背景・太字）になる。各列は最低 15rem の幅を保ち、1列目（項目名）は折り返さず、横にスクロールしても左に固定される

### 共通の挿入画像（public/blog/images/common）

どの記事の h2 直後にも使える 8FitLab の画像（1280×720）。記事専用の画像が無いときに使う。同じ画像を1記事で2回使わない。

| ファイル | 内容 | 向いている見出し | 書き方の例 |
| --- | --- | --- | --- |
| `career-roadmap.jpg` | コードの道を進む人と上向きの矢印 | 職種の説明、ロードマップ、キャリアの将来性 | `![コードの道を進んでキャリアアップを目指す人のイラスト](/blog/images/common/career-roadmap.jpg)` |
| `team-discussion.jpg` | 3人で画面のコードを見ながら話し合う | チーム開発、現場の仕事内容、コードレビュー | `![チームでコードを見ながら話し合うエンジニアのイラスト](/blog/images/common/team-discussion.jpg)` |
| `self-study-coding.jpg` | ノートパソコンで学習する人と成長の矢印 | 独学、学習方法、学習のステップ | `![ノートパソコンでプログラミングを学ぶ人のイラスト](/blog/images/common/self-study-coding.jpg)` |
| `choosing-options.jpg` | 3つの選択肢から1つを選ぶ人 | 選び方、比較、おすすめ | `![3つの選択肢から自分に合うものを選ぶ人のイラスト](/blog/images/common/choosing-options.jpg)` |
| `mentoring-session.jpg` | 2人で学習内容を相談する | メンター・講師のサポート、カウンセリング、転職相談 | `![メンターに学習の進め方を相談する人のイラスト](/blog/images/common/mentoring-session.jpg)` |
| `web-coding.jpg` | パソコンでWeb画面のコードを書く人 | 職種の説明、仕事内容、フロントエンド | `![ノートパソコンでWeb画面のコードを書くエンジニアのイラスト](/blog/images/common/web-coding.jpg)` |
| `choosing-path.jpg` | 3つの道から進む道を選ぶ人 | 選び方のポイント、進路・キャリアの選択 | `![3つの選択肢の前で進む道を選ぶ人のイラスト](/blog/images/common/choosing-path.jpg)` |
| `instructor-teaching.jpg` | 講師が画面のコードを指して受講生に教える | スクールの比較、授業・講師、カリキュラム | `![講師が画面のコードを指しながら受講生に教えるイラスト](/blog/images/common/instructor-teaching.jpg)` |
| `learning-growth.jpg` | 右肩上がりの矢印と学習する人 | まとめ、成長・キャリアアップ | `![右肩上がりの矢印とともに学習を進めるエンジニアのイラスト](/blog/images/common/learning-growth.jpg)` |
| `website-build-steps.jpg` | 設計図からWebサイトが完成するまでの3段階 | 手順・ステップ、学習ロードマップ、制作の流れ | `![設計図からWebサイトが完成するまでの段階を示すイラスト](/blog/images/common/website-build-steps.jpg)` |

- 説明（`![` と `]` の間）は、画像の内容を1文で書く（画像が読めない人と検索エンジン向け）
- 新しい共通画像は、内容が分かる英語のファイル名（小文字と `-`）で `public/blog/images/common/` に置き、この表に追記する

### 比較表のテンプレート

スクール・サービスの比較表は、次の形式で書く（`_template.md` にも同じ形で入っている）。

- 1行目＝見出し（左上は「スクール名」、続けて比較するサービス名）。1列目＝比較する項目
- セル内の箇条書きは「・」で始め、項目ごとに `<br>` で改行する。料金の注記は「※」で始めて `<br>` で改行する
- 最後の行は公式サイトへのリンク
- 表の直前に「**※下記の表は横にスクロールできます。**」を書く

```markdown
### 比較表（スクール名、カリキュラム、料金、講師）

**※下記の表は横にスクロールできます。**

| スクール名 | スクールA | スクールB | スクールC |
| --- | --- | --- | --- |
| 主なカリキュラム・特徴 | ・特徴1<br>・特徴2<br>・特徴3 | ・特徴1<br>・特徴2 | ・特徴1<br>・特徴2 |
| 料金目安 | 3ヶ月〇万円<br>※税込 | 〇万円〜<br>※給付金の対象 | 〇万円〜 |
| 講師・サポート体制 | ・サポート1<br>・サポート2 | ・サポート1<br>・サポート2 | ・サポート1<br>・サポート2 |
| 公式サイト | [公式サイトを見る](https://example.com/) | [公式サイトを見る](https://example.com/) | [公式サイトを見る](https://example.com/) |
```

### CTA ボタン（```cta）

外部サービス（教材・転職サービスの公式サイト、アフィリエイトリンク）へのボタンは、本文の好きな位置に `cta` のコードブロックで書く。中身は YAML。

````markdown
```cta
label: Progate の公式サイトを見る
url: https://px.a8.net/svt/ejp?a8mat=XXXX
note: 無料体験あり（2026年10月時点）
sponsored: true
tracking_pixel_url: https://www10.a8.net/0.gif?a8mat=XXXX
```
````

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `label` | ○ | ボタンの文言（60 文字以内） |
| `url` | ○ | リンク先。https のみ |
| `note` | | ボタンの下の補足（200 文字以内） |
| `sponsored` | | 広告・アフィリエイトのリンクなら `true`（省略時も `true`）。公式ドキュメントなど広告でないリンクだけ `false` |
| `tracking_pixel_url` | | ASP の広告コードに含まれる 1×1 画像の URL（https のみ） |

- 箇条書きや引用の中には置けない（本文の直下に書く）。ボタンは1記事に数個まで
- ASP（A8.net など）の広告コードは `<a href="…">` の URL を `url` に、`<img src="…">` の URL を `tracking_pixel_url` に入れる。テキストはそのまま使わず `label` に自分で書く

サイト側で自動で付けるもの：

- `sponsored: true`：ボタンの上に「PR」、リンクに `rel="sponsored nofollow noopener"`。`false`：PR 表記なし、`rel="noopener"`
- 新しいタブで開く
- クリックを Event `blog_cta_clicked`（article_id・position_index・link_host・sponsored）として記録し、GA4 にも送る

**注意（計測用画像）**：`tracking_pixel_url` を入れると、記事を**開いた時点で** ASP に情報（IP アドレス・ブラウザの情報など）が送られる。プライバシーポリシー 7-4 と Cookie・外部送信ページの「アフィリエイトサービス」は「リンクをクリックして外部サイトへ移動した場合」と書いているため、計測用画像を使う前に「記事内の広告が表示されたとき、またはリンクをクリックしたとき」のように文言を直す。

### Goal Fit 診断への誘導（```goal-fit）

Goal Fit 診断への案内は、本文の好きな位置に中身が空の `goal-fit` コードブロックを書くとそこに出る。文言は `src/components/blog-cta.tsx` で共通管理する（記事ごとに書き換えない）。診断へのリンクだけ frontmatter の `goal` から付ける。

````markdown
```goal-fit
```
````

表示される文言（テンプレート）：

- 見出し：あなたの現在地から最短の学習ロードマップを診断
- 本文：現在のスキル・経歴から、Goal達成までのステップとおすすめサービスが分かります。
- ボタン1：無料でGoal Fitを試す
- ボタン2：スキルギャップと学習ロードマップを診断する

- 読者が「自分はどうか」を考える流れの直後（職種の説明やなれるかどうかの話の後など）に置く
- 箇条書きや引用の中には置けない。中に何か書くとエラー
- 本文に書かなかった記事は、従来どおり記事の最後（シェアの下）に出る
- 文言を変えるときは `blog-cta.tsx` とこの節を一緒に直す

## おすすめ記事（recommend_*）

診断結果の「学習ロードマップ」ページ（`/goal-fit/result/[id]/learning-path`）に出すおすすめは、記事の frontmatter に次の項目を書いた記事から選ぶ。カードのリンク先は常に内部の `/blog/{スラッグ}` で、外部サイト・アフィリエイトへの案内と PR 表記は記事本文で行う。

| 項目 | 内容 |
| --- | --- |
| `recommend_type` | `material` ＝ 教材（未習得の Step に出す）、`career_service` ＝ 転職サービス（未習得の Step が無い人に出す） |
| `recommend_skill_ids` | `material` 用。対象の skill_id のリスト |
| `recommend_goal_ids` | `career_service` 用。対象の goal_id のリスト。`all` と書くとすべての Goal に共通 |
| `recommend_order` | 小さいほど上位。未入力は 100 |
| `recommend_audience` | `career_service` 用。`learning` ＝ 学習中・未経験から使えるサービス、`experienced` ＝ 経験者向けの転職・フリーランスサービス。**未入力は `experienced`**。`material` の記事では無視する |

```yaml
# 教材（JavaScript と TypeScript の Step に対応する記事）
recommend_type: material
recommend_skill_ids: [javascript, typescript]
recommend_order: 10

# 転職サービス（Frontend と Backend の診断結果に、学習中・未経験向けとして出す記事）
recommend_type: career_service
recommend_goal_ids: [frontend-developer, backend-developer]
recommend_audience: learning
recommend_order: 20
```

- **ID は次のファイルの値と完全一致させる**（表示名ではなく ID）。大文字・前後の空白は自動で整えるが、綴りの違いは一致しない。
  - skill_id：`data/skills/tech-skills.json`、`data/skills/human-skills.json`（ツールの tool_id を含む）
  - goal_id：`data/goals/goals.json`
  - Step ごとの選択肢（any_of）：`data/learning-paths/{goal_id}.json`
- 既知でない ID は無視する。既知の ID が 1 つも無い記事は表示しない（開発環境ではターミナルに除外理由を出す）。
- 教材の割り当て：
  - 未習得の Step：Step の選択肢（any_of）と `recommend_skill_ids` が 1 つでも重なれば一致。最大 3 件。
  - 習得済みの Step：ユーザーが保有している選択肢とだけ照合する（「復習・さらに深めるための教材」。例：Vue を保有していれば React の教材は出さない）。最大 2 件。
  - 未習得の Step を学習順に割り当ててから、習得済みの Step を学習順に割り当てる。同じ記事は最初に一致した Step にだけ出す。上限からあふれた記事は後ろの Step に回さない。
- 転職サービスは、ページ最下部の「転職・キャリア支援サービス」に、`recommend_audience` ごとに最大 3 件ずつ出す（Step の状態に関係なく常に表示）。未習得の Step がある人には学習中・未経験向けを先に、全 Step 習得済みの人には経験者向けを先に並べる。記事の無いグループは出さない。
- 並び順は `recommend_order` の昇順、同じ値なら記事 ID の昇順。記事の数や統計では変えない。
- 下書き（`draft: true`）の記事は、本番のおすすめには出ない。

## カテゴリ（categories.yml）

```yaml
- id: career          # URL /blog/category/{id}
  name: キャリア・転職
```

- 職種のカテゴリ（`frontend-developer` など）は `data/goals/goals.json` から自動で作るため書かない（記事の `goal` に書く）
- 一覧・サイドバーには、記事のあるカテゴリだけが出る

## 編集者プロフィール（authors.yml）

記事詳細の末尾の「AUTHOR」に出す。

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `id` | ○ | 記事の `author` に書く値 |
| `name` | ○ | 表示名（例：8FitLab 編集部） |
| `role` | | 肩書き（例：8FitLab 運営者／元 Web エンジニア） |
| `avatar` | | 顔写真・アイコン（`/blog/images/authors/xxx.png`。正方形を推奨）。未設定なら名前の1文字目を表示 |
| `bio` | | 記事末尾のプロフィール本文。改行はそのまま表示 |
| `x_url` / `github_url` / `note_url` / `website_url` | | SNS・サイトの URL（https のみ） |

- 記事の `author` に書いた編集者を、記事の末尾に表示し、構造化データ（Article の author）にも Person として出す。未設定の記事はプロフィール欄を出さず、author は運営組織になる
## スクール・転職サービス比較（services.yml）

/blog の比較欄（ランキングカード・一覧表・目的から探す）に出すサービス。0 件のときは比較欄に職種別のおすすめ表だけを出す。

| 項目 | 必須 | 内容 |
| --- | --- | --- |
| `id` | ○ | 英数字・`-`・`_`（ページ内リンク `#service-{id}` に使う） |
| `name` | ○ | サービス名 |
| `service_type` | ○ | `school` か `job_service` |
| `catch_copy` | | 例：【未経験から転職を目指すなら】 |
| `logo` | | `/blog/images/services/xxx.png` |
| `summary` | | 2〜3行の紹介 |
| `features` | | 特徴のリスト（行頭の「・」は自動で取る） |
| `price` | | 例：169,800円〜（給付金対象コースあり） |
| `period` | | スクールのみ。例：4〜16週間 |
| `learning_style` | | スクールのみ。例：オンライン |
| `career_support` | | スクールは転職サポートの有無、転職サービスはサポート内容 |
| `target` | | 転職サービスのみ。例：20代・未経験 |
| `purposes` | | 目的のリスト。例：`[未経験から転職, 費用を抑えたい]`。「目的から探す」に名前でまとめて出す |
| `official_url` | ○ | ASP の広告コードの `href`。https のみ |
| `cta_label` | | 30字まで。空なら「公式サイトを見る」 |
| `sponsored` | | 広告でないリンクだけ `false` |
| `tracking_pixel_url` | | 使う場合は CTA ボタンの注意と同じく、プライバシーポリシーの記述の変更が必要 |
| `review_article` | | 詳しい記事のスラッグ。設定すると「詳しく見る」ボタンを出す |
| `checked_at` | | 例：2026年10月2日。料金などを公式サイトで確認した日 |
| `order` | | 小さいほど上（未入力は 100）。同じ値は名前順 |

- 必須項目が欠けたサービスはテストで失敗する（比較欄から黙って消えないように）
- 広告リンクには `rel="sponsored nofollow"` と「PR」を付け、クリックを `service_clicked`（サービスID・種別・カードか表か）として記録する
- 掲載順は免責事項の「教材・サービスの選定と掲載順について」（/disclaimer#editorial-policy）のとおり、報酬の有無や金額ではなく編集部の判断で決める。評価点や「満足度」などは、根拠のある数字を用意できるまで載せない

## Blog のレイアウト

- 比較（/blog）：探し方（ページ内リンク）、Goal Fit への案内、「記事内に広告を含む場合があります。」、スクール比較、転職サービス比較、目的から探す、記事一覧
- カテゴリ別一覧（/blog/category/{カテゴリID}）：記事カードを PC・タブレット・スマホとも2列で表示
- 比較・カテゴリ別一覧のサイドバー：Goal Fit（/goal-fit へのボックスリンク）、新着記事（5件）、カテゴリ（記事数つき）
- 記事詳細のサイドバー：Goal Fit への案内、新着記事、カテゴリ
- PC はサイドバーを右側、スマホは本文の下に出す
- 記事詳細：パンくず、カテゴリ・公開日・更新日、タイトル、説明文、アイキャッチ、目次（本文の h2・h3 が2つ以上あるとき）、本文、シェア（LINK ボタンでリンクをコピー）、Goal Fit への案内（本文に ```goal-fit を書いた記事はその位置）、AUTHOR、関連記事（同じカテゴリを優先して4件）

## 表示確認用のダミー（開発環境だけ）

`.env.local` に `RECOMMENDATION_FIXTURE=1` を書くと、おすすめ記事として `data/fixtures/recommendations/dummy-articles.json` を読む。production では無効。ダミーの記事は `content/blog/posts` に無いため、カードのリンク先は 404 になる。
