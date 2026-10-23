# 正規ホスト（https://8fitlab.com / www なし）への統一 — 人が行う作業

コード側は `src/lib/site.ts` の `SITE_ORIGIN = "https://8fitlab.com"` に固定済み。  
**ホストのリダイレクトは Vercel の Domains で行い、next.config には書かない**（逆向き設定とのループを避ける）。

## 1. Vercel（Domains）

1. Project → Settings → Domains
2. `8fitlab.com` を Production のドメインにする
3. `www.8fitlab.com` は「Redirect to 8fitlab.com」（恒久：308）に設定する
4. 両方の証明書が有効なことを確認する

## 2. 確認（ターミナル）

```bash
curl -sI https://www.8fitlab.com/blog
# → 308 または 301、Location: https://8fitlab.com/blog

curl -sI http://8fitlab.com/
# → https の apex（www なし）に転送される
```

## 3. Search Console

1. ドメインプロパティ（`sc-domain:8fitlab.com`）で、www あり・なし・http・https をまとめて見られるようにする
2. sitemap `https://8fitlab.com/sitemap.xml` を送信する
3. 主要ページを URL 検査してインデックス登録をリクエストする

## 4. GA4

データストリームの URL を www なし（`https://8fitlab.com`）にする。

## 5. 外部からのコールバック URL

microCMS の Webhook など、外部から呼ぶ URL は **www なし（最終ホスト）** に直す。  
リダイレクトだと POST が失われることがある。

※ 現状の 8FitLab ブログは `content/blog/posts` の Markdown であり、microCMS Webhook はコードベースに見当たらない。今後追加する場合は apex（www なし）で登録する。

## 6. 外部のリンク

SNS のプロフィール、ASP の登録、名刺などを www なし（`https://8fitlab.com`）に直す。

## 7. 反映の確認

Search Console の「ページ」で、www あり（`https://www.8fitlab.com/...`）の表示が減ること（数週間かかることがある）。

## 補足

- localStorage はホストごとに別なので、www で付いた匿名 ID は apex では引き継がれない（許容）
- 内部リンク検査: `node scripts/check-internal-links.mjs`（レポートのみ。本文は人が直す）
