import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // data/ の JSON は fs で読むため、サーバー関数のトレースに明示的に含める（data/raw は巨大なため含めない）
  outputFileTracingIncludes: {
    "/*": [
      "./data/goals/**/*.json",
      "./data/skills/**/*.json",
      "./data/career/**/*.json",
      "./data/education/**/*.json",
      "./data/learning-paths/**/*.json",
      "./data/statistics/**/*.json",
    ],
  },
  // fs の動的パスから data/ 全体がトレースされるため、元データ（数百 MB・再配布しない）と
  // テスト・表示確認用のデータ（production では読まない）を明示的に除外する
  outputFileTracingExcludes: {
    "/*": ["./data/raw/**", "./data/fixtures/**"],
  },
  async redirects() {
    return [
      // 公開の Learning Path ページは廃止し、診断結果から開く学習ロードマップに一本化した
      { source: "/learning-path", destination: "/goal-fit", permanent: true },
      { source: "/learning-path/:path*", destination: "/goal-fit", permanent: true },
      // 機能名を Career Match から Goal Fit に変えた。クエリ（?goal=）はそのまま引き継がれる
      { source: "/career-match", destination: "/goal-fit", permanent: true },
      { source: "/career-match/:path*", destination: "/goal-fit/:path*", permanent: true },
      { source: "/editorial-policy", destination: "/disclaimer#editorial-policy", permanent: true },
    ];
  },
  async headers() {
    return [
      // 結果ページの URL は閲覧の鍵のため、外部サイトへの遷移時にパスを渡さず、検索エンジンにも登録させない
      {
        source: "/goal-fit/result/:path*",
        headers: [
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.microcms-assets.io" }],
  },
};

export default nextConfig;
