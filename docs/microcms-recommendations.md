# おすすめ記事（microCMS の recommend_* フィールド）

診断結果の「学習ロードマップ」ページ（`/career-match/result/[id]/learning-path`）に出すおすすめは、Blog（microCMS の `blogs` API）の記事から選ぶ。記事に次のフィールドを入力すると、おすすめの対象になる。カードのリンク先は常に内部の `/blog/{記事id}` で、外部サイト・アフィリエイトへの案内と PR 表記は記事本文で行う。

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

## 表示確認用のダミー（開発環境だけ）

`.env.local` に `RECOMMENDATION_FIXTURE=1` を書くと、microCMS の代わりに `data/fixtures/recommendations/dummy-articles.json` を読む。production では無効。ダミーの記事は microCMS に無いため、カードのリンク先は 404 になる。
