# Skill Statistics（技術スキル層）

このディレクトリの JSON は、Stack Overflow Developer Survey 2023〜2025 の公開データから 8FitLab が算出した派生データベースです。

Contains information from the [Stack Overflow Developer Survey](https://survey.stackoverflow.co/), which is made available under the [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/). Individual contents are made available under the [Database Contents License (DbCL) v1.0](https://opendatacommons.org/licenses/dbcl/1-0/).

## ライセンス

このディレクトリのデータ（派生データベース）は、元データと同じ [Open Database License (ODbL) v1.0](https://opendatacommons.org/licenses/odbl/1-0/) で提供します。

## 加工の内容

8FitLab は回答データを次のように集計・加工しています。元データの回答そのもの（個票）は含みません。

- Goal（目標職種）ごとに、Stack Overflow の DevType（`data/skills/so-devtype-mapping.json`）で回答者を分けて技術の利用率を集計
- 代わりのきく技術をグループにまとめて集計（`data/skills/tech-skill-groups.json`）
- 日本の回答者の利用率を、世界の利用率へ縮小推定して日本市場向けに補正（経験ベイズ、Beta-Binomial）
- Quantity / Quality / Contribution を算出し、Goal を特徴づける技術を統計的に選択

算出方法（アルゴリズム）の全体は [`scripts/build_skill_statistics.py`](../../../scripts/build_skill_statistics.py) にあります。
