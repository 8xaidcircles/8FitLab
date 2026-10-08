# Goal Fit 計算方式の改善（Skill の再構成と Experience の再計算）

2026-10-07。Skill と Experience を同時に変えた。Education は変えていない。

> §2〜§4 の数値は、この変更の時点（Skill Statistics 0.5.0、グループ定義 1.2.0）のもの。その後 Skill は、基本リスト＋特有リスト（0.6.0）、β による採点（layered-2.0.0、0.7.0）、基本リストの重みの d\* による割り引き（0.8.0）と変わった。現在（0.8.0）との比較は §7、デプロイ前の確認は §6 を見る。

## 1. 変えた理由

入力「R / Web開発者 0.5 年 / 短大」でデータアナリストが 8.6 点（画面表示 9）だった。原因は 2 つ。

- **Skill**: Python・pandas・NumPy・Jupyter・scikit-learn が別々の単位になっており、Python を使う人の多さが何重にも数えられていた。R は 1 単位しかなく、R だけ使う人は 8.0 点だった。
- **Experience**: 前職から Goal への移り方の評価（品質 71.6）が良くても、「データアナリストの前職が Web 開発者だった人は 1.1%」という少なさで割り引かれ、4.1 点になっていた。

## 2. Skill: 代わりのきく言語を 1 単位にまとめる

`data/skills/tech-skill-groups.json`（1.2.0）に次のグループを追加した。どれもメンバーのどれか 1 つを持っていれば満たす（OR）。

| グループ | 対象 Goal | メンバー |
|---|---|---|
| `analysis-language` | data-analyst・data-scientist | python・pandas・numpy・scikit-learn・jupyter・r・tidyverse・rstudio |
| `data-engineering-python` | data-engineer | python・pandas・numpy・scikit-learn・jupyter |
| `infrastructure-language` | cloud-architect・devops-sre | python・go |
| `javascript-language` | frontend-developer・full-stack-developer | javascript・typescript |

既存の `server-framework` は data-engineer にも使うようにした。これで fastapi と flask が 1 つにまとまる。

- SQL・データウェアハウス・VBA は別の単位のまま。
- data-engineer では、まとめたフレームワークのグループが統計上有意にならないため、選ばれる単位から外れた。修正前は fastapi 6.8 と flask 5.0 が別々に選ばれていた。
- data-scientist の fastapi と flask は、今回は別々の単位のまま残している。
- グループの集計（Stack Overflow 調査での「使っている人の割合」）は、メンバーの誰かを使っている人の割合で数える。Python 系と R 系の両方を使う人は 1 人として数えるため、二重に数えなくなった。
- Goal が重ならなければ、同じスキルを別グループに入れてよいことにした。`scripts/build_skill_statistics.py` の検証で、Goal が重なる場合だけを重複として止める。
- 統計は `python scripts/build_skill_statistics.py` で作り直した（`calculation_version` 0.5.0）。まとめた単位のシェアは次のとおり。

| Goal | まとめた単位 | シェア | 修正前（別々の単位の合計） |
|---|---|---|---|
| data-analyst | analysis-language | 31.0 | python・pandas など＋r |
| data-engineer | data-engineering-python | 15.3 | python 10.9＋pandas 9.5＋jupyter 5.8＋numpy 5.4 = 31.6 |
| cloud-architect | infrastructure-language | 8.8 | python 7.0＋go 6.5 = 13.5 |
| devops-sre | infrastructure-language | 8.3 | python 7.5＋go 5.1 = 12.6 |
| frontend-developer | javascript-language | 14.3 | javascript 12.8＋typescript 10.9 = 23.7 |
| full-stack-developer | javascript-language | 11.7 | javascript 9.6＋typescript 8.1 = 17.7 |

- 残りの職種は、言語・ツールが既存のグループ（サーバー言語、データベース、クラウド、コンテナなど）ですでに OR になっており、結果は変わらない（版と日付だけ更新）。
- software-architect の typescript は単独の単位のまま（JavaScript が選ばれる単位に入っておらず、まとめる相手がいない）。
- アプリ側は、持っているスキルとグループの `members` を照らし合わせるだけで済むため、コードの変更は要らない。

## 3. Experience: 前職歴を「関連度 × 年数」で評価する

### 計算式

Goal の職業そのものの経験（同職種）は、これまでどおり在職年数のパーセンタイルで評価する。変えたのは、別の職業での経験（前職歴）の評価。

```
関連度(role) = (50 + (品質 − 50) × 重み) / 100
  品質 = JobHop で「その職業 → Goal」へ移った人の評価（0〜100、最短の年数単位を使う）
  重み = 人数 / (人数 + 5)            人数 = Goal の人数 × その前職の割合
  統計にない職業は 0

前職歴(group) = max over 前職 { 関連度(role) × 在職年数パーセンタイル(Goal の職業, 年数) }

Group の点 = max(同職種の在職年数パーセンタイル, 前職歴)
  同職種の経験がない場合は、前職歴だけで上限 50（複合 Goal）または 100
```

- 前職が複数あるときは、点が最も高い前職を使う（max）。
- 統計に「Goal の職業の在職年数分布」がない Group は、計算できないものとして扱う（null）。
- `experience_reference` は、計算できるかどうかの判定にだけ使い、点には使わない。
- 結果には計算方式のバージョン `experience_calculation_version`（`relevance-1.0.0`）を保存する。NULL の行は旧方式で計算した結果。
- 実装: `src/lib/career-match/calculate.ts` の `roleRelevance`、`priorExperienceAchievement`、`groupAchievement`。

### 依頼の仕様と違う点（理由）

| 依頼 | 実装 | 理由 |
|---|---|---|
| 年数の効果 = min(年数 / 3, 1) | Goal の職業の在職年数パーセンタイル | min(年数/3, 1) だと、関連する前職 3 年が同職種 1 年を上回る逆転が起きる。同じ物差しを使えば、前職歴は同じ年数の同職種経験を超えない |
| 関連度 = (品質 − 50) / 50 | 品質 / 100 | (品質 − 50) / 50 だと、品質 50 未満の営業・コンサルタントなどの非 IT 職が 0 点になる。以前「0 点になるのは不満」という指摘があった。依頼のサンプルコードも `adjustedStrength / 100` だった |
| 人数が少ないときの補正 = 人数 / 100 | 人数 / (人数 + 5) で 50 に寄せる | 人数 / 100 では、少人数の職業がほぼ 0 になり、もとの問題（1.1% の少なさで割り引かれる）が残る |

## 4. 比較結果（`docs/scoring-comparison.csv`）

14 職種 × 6 パターン = 84 行。作り方は `node scripts/compare-scoring-models.mjs snapshot <out.json>` を修正前と修正後のコードでそれぞれ実行し、`compare <before> <after>` で CSV を作る。

| 集計 | 結果 |
|---|---|
| 上がった | 45 行 |
| 同じ | 18 行（Goal の職業そのものの経験と、関係のない職種） |
| 下がった | 21 行 |
| 最大の上昇 | +16.1（Python 系 + SQL / Web 2 年 → テストエンジニア） |
| 最大の下降 | −12.3（スキルなし / 販売員 5 年 → テストエンジニア） |
| 極端な値 | なし（100 点に張り付くケースや、0 に落ちるケースはない） |

### 起点の入力「R / Web開発者 0.5 年 / 短大」→ データアナリスト

| 項目 | 修正前 | 修正後 |
|---|---|---|
| Skill | 8.0 | 31.0 |
| Experience | 4.1 | 10.4 |
| Education | 13.8 | 13.8 |
| Goal Fit | 8.6 | **18.4** |

20 点には届いていない。理由は、同じ職業での 0.5 年でも Experience が 16.4 点にとどまる（JobHop の在職年数分布で 0.5 年は短い側）ためで、Web 開発者 0.5 年はそれ以上にはならない。Education（短大 13.8）も影響している。

### 下がったケース

| ケース | 主な原因 |
|---|---|
| Python 系スキルを多く持つ人（Skill がデータサイエンティストで 37.4 → 15.6、データエンジニアで 41.1 → 28.6） | Python 系を 1 単位にまとめたため、二重に数えていた分がなくなった |
| 長い前職歴（ソフトウェア開発者 3 年 → フロントエンド：Experience 100 → 68.8） | 前職歴を、Goal の職業の在職年数カーブで評価するようになった |
| 非常に短い前職歴（Web 0.5 年 → バックエンド：30.6 → 11.2） | 同上。0.5 年はパーセンタイルが低い |
| 販売員 5 年 → テストエンジニア（88.1 → 51.2） | 以前は特定の移り方の割合が高く、過大に評価されていた |

## 5. テスト

| ファイル | 確かめる内容 |
|---|---|
| `skill-dictionary.test.ts` | DA と DS に analysis-language があり、python と r を含む。data-engineering-python・infrastructure-language・javascript-language も対象 Goal で 1 項目になる。どれもメンバーが単独の単位として残っていない。グループのメンバーは Goal ごとに重複しない |
| `calculate.test.ts` | 関連度（少人数は 50 に寄る、関係のない職業、統計にない職業）。前職が複数あるときは max。上限 50 |
| `golden.test.ts` | 前職歴は、同じ年数の同職種経験を超えない。非 IT 職も 0 にならず、ソフトウェア開発者より低い |
| `data/fixtures/career-match/spec-examples.json` | 要件定義書 §19 の計算例。新しい値に更新した（Web開発者 2 年：[67.41, 47.24] → 57.32、ICTアプリケーション開発者 3 年：[70.63, 59.08] → 50） |

## 6. デプロイ前の最終確認チェックリスト

- [ ] `npx vitest run`、`npx tsc --noEmit`、`npx eslint src scripts` がすべて通る（2026-10-07 時点で通過。DB テスト 13 件はスキップ）
- [ ] `npm run build` が通る
- [ ] 要件定義書 §19 の計算例と Experience の計算式を、この文書に合わせて人が更新する（`files/RDD` は Git 管理外のため、今回は変更していない）
- [ ] 画面で、起点の入力（R / Web開発者 0.5 年 / 短大）のデータアナリストが 21 点（Goal Fit 21.3、Skill 39.9）になるのを確認する（Skill Statistics 0.8.0 の値。§4 の 18.4 は 0.5.0 時点。診断フォームの送信は人が行う）
- [ ] 次の 2 つを本番の SQL Editor で実行する（デプロイより先に。アプリと再計算スクリプトは保存時にこれらの列へ書き込む。何度実行しても結果は同じ）
  - `supabase/migrations/20261006_skill_scoring_method.sql`（`skill_scoring_method`・`skill_distribution_sample_size`・`skill_distribution_version`）
  - `supabase/migrations/20261007_experience_calculation_version.sql`（`experience_calculation_version`）
- [ ] デプロイ後、保存済みの診断結果を再計算して上書きする（入力と Learning Path の結果は変えない）
  1. 先に `career_match_results` と `assessment_sessions` をバックアップする（`public` ではなく別のスキーマに。例：`CREATE SCHEMA IF NOT EXISTS backup; CREATE TABLE backup.career_match_results_20261007 AS SELECT * FROM public.career_match_results;`）
  2. `node scripts/system-ca.mjs --env-file=.env.local scripts/recompute-career-match.mjs` で、件数・上がる / 下がる件数・差が大きい結果を確認する（書き込まない）
  3. 問題がなければ `--apply` を付けて実行する
  4. 「再計算・上書きできなかった」行が出たら内容を確認する（Goal が無くなった、など）。同じコマンドは何度実行してもよい
  5. 確認用 SQL：`SELECT experience_calculation_version, count(*) FROM career_match_results GROUP BY 1;` が `relevance-1.0.0` だけになる。`SELECT skill_calculation_version, skill_statistics_version, count(*) FROM career_match_results GROUP BY 1, 2;` で、技術スキル層を使う Goal の行が `layered-2.0.0` と `…:0.8.0:…:dref=0.094321` になる（技術スキル層の配分が 0 の Goal は skill_statistics_version が NULL）
  6. 再計算するまでは、結果画面の「Skill の内訳」に「計算方式の更新前の結果です」と注記が出る（保存した点数と現在の内訳の割合が一致しないため）。再計算すると消える
- [x] ~~20 点に届かない点を受け入れる~~（0.8.0 で起点の入力は 21.3 になり、20 点に届いた）
- [ ] Stack Overflow と ESCO の出典表記が残っていることを確認する
- [ ] `data/raw`・`files/`・`.env.local` がコミットに含まれていないことを確認する
- [ ] コミット・push・デプロイは人が行う

## 7. Skill Statistics 0.7.0 → 0.8.0 の比較（`docs/scoring-comparison-0.8.0.csv`）

0.8.0 で基本リストの重みを pg × min(1, d / d\*) にした（d\* = 0.094321、β は 0.2137 → 0.2942）。計算コードは同じ（layered-2.0.0）で、統計だけを替えて比べた。14 職種 × 8 パターン（§4 の 6 パターン＋Kotlin のみ・Java のみ）= 112 行。

作り方：統計を 0.7.0 に差し替えた一時フォルダ（`src`・`data` の写し）と、作業ディレクトリ（0.8.0）でそれぞれ `node scripts/compare-scoring-models.mjs snapshot <out.json>` を実行し、`compare <before> <after>` で CSV を作る（本番の `data/statistics/` は上書きしない）。§4 の `docs/scoring-comparison.csv` は 0.5.0 の変更の記録として残す。

| 集計 | 結果 |
|---|---|
| 上がった | 18 行 |
| 同じ | 76 行（Experience・Education は変わらない。差はすべて Skill） |
| 下がった | 18 行 |
| 最大の上昇 | +12.1（Python・pandas・NumPy・Jupyter・SQL / Web 2 年 → データアナリスト。Skill 41.1 → 77.3） |
| 最大の下降 | −4.2（JavaScript・HTML/CSS・React / ソフトウェア開発者 3 年 → バックエンド。Skill 12.5 → 0.0） |

- 起点の入力「R / Web開発者 0.5 年 / 短大」→ データアナリスト：Goal Fit 15.1 → **21.3**（Skill 21.1 → 39.9。データアナリストでは他職種と同じくらい使われるパブリッククラウド・HTML/CSS が基本リストから外れ、データ分析の言語の割合が上がった）
- 下がったのは、他職種と同じくらい使われる技術だけを持つ入力：JavaScript・HTML/CSS・React は Backend・DevOps・DA・Cloud・Mobile・DS で Skill 0 になった。Python・Kotlin・Java だけの入力は server-language（どの職種でも9割以上が使い d が小さい）の割り引きで、Software Architect 9.0 → 1.0、Full-stack 9.7 → 3.0、Backend 12.8 → 8.1
- Kotlin だけと Java だけの点は、0.7.0・0.8.0 とも 3 Goal で同じ（server-language で代わりがきく）
