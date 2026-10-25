---
# このファイルは記事にならない（_ で始まるファイルは読み込まない）。
# コピーして posts/{スラッグ}.md を作る。スラッグ（ファイル名）が URL /blog/{スラッグ} になる（英数字・-・_）。
# 書き方の詳細は docs/blog-writing.md
title: 記事タイトル（100 文字以内）
description: 一覧・検索結果に出る説明文（300 文字以内）
publishedAt: 2026-10-15
# updatedAt: 2026-10-20          # 内容を更新したときだけ書く
category: career                 # content/blog/categories.yml の id（任意）
goal: [frontend-developer]       # data/goals/goals.json の goal_id か名前（任意。職種カテゴリに出る）
author: editorial                # content/blog/authors.yml の id（任意。記事末尾にプロフィールが出る）
# eyecatch: /blog/images/slug/eyecatch.png   # public/blog/ 配下の画像（任意）
draft: true                      # true の間は本番に出ない（プレビュー URL では見える）
# --- おすすめ記事（学習ロードマップに出す場合だけ） ---
# recommend_type: material       # material（教材）/ career_service（転職サービス）
# recommend_skill_ids: [javascript, typescript]
# recommend_goal_ids: [frontend-developer]
# recommend_audience: learning   # learning / experienced
# recommend_order: 10
---

このページには広告（PR）を含みます

導入文。

## 見出し（本文は ## から始める）

本文。**強調**、[リンク](https://example.com)、`コード` が使えます。

```cta
label: 公式サイトで詳細を見る
url: https://example.com/
note: 無料体験あり（2026年10月時点）
sponsored: true
```

```goal-fit
```

### 比較表（スクール名、カリキュラム、料金、講師）

**※下記の表は横にスクロールできます。**

| スクール名 | スクールA | スクールB | スクールC |
| --- | --- | --- | --- |
| 主なカリキュラム・特徴 | ・特徴1<br>・特徴2<br>・特徴3 | ・特徴1<br>・特徴2 | ・特徴1<br>・特徴2 |
| 料金目安 | 3ヶ月〇万円<br>※税込 | 〇万円〜<br>※給付金の対象 | 〇万円〜 |
| 講師・サポート体制 | ・サポート1<br>・サポート2 | ・サポート1<br>・サポート2 | ・サポート1<br>・サポート2 |
| 公式サイト | [公式サイトを見る](https://example.com/) | [公式サイトを見る](https://example.com/) | [公式サイトを見る](https://example.com/) |
