# Blog の書き方（Markdown）

Blog の記事・編集者・カテゴリ・比較サービスは、すべてリポジトリの `content/blog/` に置く。CMS は使わない。記事を追加・変更したら、コミットして PR を出し、マージすると本番に出る。

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

「あなたの場合はどうでしょう？」で始まる Goal Fit 診断への案内は、本文の好きな位置に中身が空の `goal-fit` コードブロックを書くとそこに出る。文言と診断へのリンクは frontmatter の `goal` から自動で作る（`goal` が無い記事は「目標職種との」になる）。

````markdown
```goal-fit
```
````

- 読者が「自分はどうか」を考える流れの直後（職種の説明やなれるかどうかの話の後など）に置く
- 箇条書きや引用の中には置けない。中に何か書くとエラー
- 本文に書かなかった記事は、従来どおり記事の最後（シェアの下）に出る

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
