# グループの適用範囲の修正（Kotlin をサーバーサイドの言語に入れる）

2026-10-07。Skill の技術グループの定義だけを変えた。計算ロジック・DB スキーマ・学習ロードマップは変えていない。

## 1. 変えた理由

Kotlin だけを持つ人が、バックエンド・フルスタックのロードマップでは「バックエンド言語」を習得済みになるのに、Skill の達成率は 0.0 だった（Java だけなら、バックエンドで 14.3）。

原因は次のとおり。

- Kotlin が `mobile-native-language`（goals なし＝全 Goal に適用）に入っていた。
- `scripts/build_skill_statistics.py` の `load_groups` は、同じ Goal で同じ技術が 2 つのグループに入るのを禁止している。そのため、`server-language` に Kotlin を足せなかった。

## 2. 変更内容

| ファイル | 変更 |
|---|---|
| `data/skills/tech-skill-groups.json`（1.3.0） | 下の表のとおり、3 つのグループを変更・追加した。description に「別の Goal で別のグループに入れるときは goals を重ならないように付ける」を書いた |
| `scripts/build_skill_statistics.py` | `CALCULATION_VERSION` を 0.5.1 にした |
| `data/statistics/skill-match/*.json` | 作り直した（14 ファイル） |
| `data/skills/roadmap-scoring-exceptions.json` | 新規。ロードマップの選択肢の評価が混ざっている Step の例外リスト |
| `src/lib/career-match/__tests__/roadmap-scoring.test.ts` | 新規。混在が例外リストと一致することを確かめる |
| `src/lib/career-match/__tests__/skill-dictionary.test.ts` | Kotlin・モバイル・アーキテクト用のグループと、Kotlin のみ＝Java のみのテストを追加 |
| `scripts/compare-scoring-models.mjs` | 比較パターンに「Kotlin のみ」「Java のみ」を追加 |

| グループ | 対象 Goal | 変更 |
|---|---|---|
| `mobile-native-language` | mobile-app-developer | goals を付けた。他の Goal では Swift・Kotlin・Objective-C を個別の技術として扱う |
| `server-language` | backend-developer・full-stack-developer | kotlin を足した。software-architect を対象から外した |
| `server-language-architect` | software-architect | 新規。Kotlin を除いた、変更前の server-language と同じメンバー |

### ソフトウェアアーキテクトを別のグループにした理由

最初は server-language（対象は 3 職種）に Kotlin を足した。すると、ソフトウェアアーキテクトでは server-language が統計上有意でなくなり、採用 unit から外れた（p 値 0.000217 → 0.00186。ボンフェローニ補正後の基準を超えた）。Kotlin は Android 開発者など、ソフトウェアアーキテクト以外の人も多く使う。そのため、グループを使う人の割合がアーキテクト以外の人でも上がり（93.7% → 94.2%）、アーキテクトとの差が小さくなった。その結果、Java や Python を持つ人のアーキテクトの Skill が 11.6 → 0.0 に下がった。

そこで、アーキテクトだけは Kotlin を含まないグループにした。Kotlin のみのアーキテクトは Skill 0 のままで、例外リストに載せている。

## 3. 影響（`docs/scoring-comparison-kotlin.csv`）

### 採用 unit の変化

| Goal | 変化 |
|---|---|
| backend-developer | server-language のシェア 14.27 → 14.35（members に kotlin が入った）。ほかの unit は 0.01 ずつ下がった |
| full-stack-developer | server-language のシェア 10.41 → 10.43（members に kotlin が入った） |
| software-architect | server-language が server-language-architect に置き換わった（同じメンバー・同じシェア） |
| mobile-app-developer | 変化なし（mobile-native-language は引き続き採用） |
| 残りの 10 Goal | 変化なし |

Swift・Kotlin・Objective-C が個別の unit として新たに採用された Goal はない。

### 点数の変化

| 入力 | Goal | Skill（修正前 → 修正後） |
|---|---|---|
| Kotlin のみ | バックエンド | 0.0 → 14.4（Java のみも 14.3 → 14.4） |
| Kotlin のみ | フルスタック | 0.0 → 10.4（Java のみと同じ） |
| Python / Web開発者 0.5年 | バックエンド | 14.3 → 14.4 |

- ソフトウェアアーキテクトの全パターンは、変更前と完全に同じ。
- Kotlin・Java を含まないパターンで、Skill が 3 点を超えて変わった行はない。
- モバイルの Skill に変化はない。

### 例外リスト（ロードマップの選択肢の評価が混ざっている Step）

| Goal | Step | 評価されない選択肢 | 理由 |
|---|---|---|---|
| software-architect | backend-language（バックエンド言語） | kotlin | アーキテクト用のグループは Kotlin を除くため（上記） |
| data-engineer | data-engineering-language（データ処理言語） | java, scala, go | 要判断 |
| data-engineer | distributed-processing（分散処理） | hadoop | 要判断 |

バックエンド・フルスタックの backend-language は混在しない（テストで確かめている）。

## 4. デプロイ前の最終確認チェックリスト

- [x] ソフトウェアアーキテクトの扱い：A を採用。Kotlin のみのアーキテクトは 0 のまま、例外として扱う
- [ ] データエンジニアの例外 2 件の扱いを決め、reason を書き換える
- [ ] 統計 JSON（`data/statistics/skill-match/` の 14 ファイル）は再生成したものをコミットする
- [ ] `npm run lint`・`npx tsc --noEmit`・`npm test` が通る
- [ ] デプロイ後、保存済みの診断結果の Skill が変わるため、`scripts/recompute-career-match.mjs` で再計算する
  1. `--apply` の前に、上書きする行のバックアップを取る（例：Supabase の SQL Editor で `CREATE TABLE career_match_results_backup_20261007 AS SELECT * FROM career_match_results;`）
  2. オプションなしで実行して差分を確認し、問題なければ `--apply` を付けて実行する
- [ ] DB のスキーマ変更はない
