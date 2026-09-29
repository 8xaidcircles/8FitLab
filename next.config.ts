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
  // fs の動的パスから data/ 全体がトレースされるため、元データ（数百 MB・再配布しない）を明示的に除外する
  outputFileTracingExcludes: {
    "/*": ["./data/raw/**"],
  },
  images: {
    remotePatterns: [{ protocol: "https", hostname: "images.microcms-assets.io" }],
  },
};

export default nextConfig;
