import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, STACK_OVERFLOW_SURVEY } from "@/lib/site";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Goalから逆算して、エンジニアのキャリアをつくる`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, locale: "ja_JP", type: "website" },
  twitter: { card: "summary_large_image" },
};

const NAV = [
  { href: "/career-match", label: "Career Match" },
  { href: "/learning-path", label: "Learning Path" },
  { href: "/blog", label: "Blog" },
];

const footerLinkClass = "underline hover:text-indigo";

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <div className="bg-brand-gradient h-1" />
        <header className="border-b border-line bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
            <Logo />
            <nav className="flex items-center gap-1 text-sm font-medium">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-full px-3 py-2 text-muted transition-colors hover:bg-sky-soft hover:text-indigo"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-16 border-t border-line bg-white">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm text-muted md:grid-cols-[1fr_2fr]">
            <div className="space-y-3">
              <Logo />
              <p>Goalから逆算して、エンジニアのキャリアをつくる。</p>
              <p className="text-xs">
                運営：AID CIRCLES ／ 姉妹サービス：8Wheel（Webサービス検索）
              </p>
            </div>
            <div className="space-y-3 text-xs leading-relaxed">
              <p className="font-bold text-ink">データソース</p>
              <p>
                This service uses the ESCO classification of the European Commission.
                8FitLabは、ESCOの職業分類を独自のGoal（目標職種）に再構成・翻訳して使用しています。表示内容は欧州委員会が公開するESCOの原文とは異なり、欧州委員会はその正確性・最新性・完全性を保証しません。
              </p>
              <p>
                Career statistics are derived from JobHop v2 (Ghent University AIDA / VDAB, CC BY 4.0).
                8FitLabはJobHopの職歴データを集計・加工して統計値を算出しています。
              </p>
              <p>
                Skill statistics contain information from the{" "}
                <a href={STACK_OVERFLOW_SURVEY.url} className={footerLinkClass} target="_blank" rel="noopener noreferrer">
                  {STACK_OVERFLOW_SURVEY.name}
                </a>{" "}
                2023–2025, which is made available under the{" "}
                <a href={STACK_OVERFLOW_SURVEY.licenseUrl} className={footerLinkClass} target="_blank" rel="noopener noreferrer">
                  {STACK_OVERFLOW_SURVEY.license}
                </a>{" "}
                (individual contents:{" "}
                <a
                  href={STACK_OVERFLOW_SURVEY.contentsLicenseUrl}
                  className={footerLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {STACK_OVERFLOW_SURVEY.contentsLicense}
                </a>
                ). 8FitLabは回答データを独自に集計・加工（Goal別の集計、日本市場向けの補正を含む）して統計値を算出しています。算出した統計データはODbLで
                <a
                  href={STACK_OVERFLOW_SURVEY.derivedDatabaseUrl}
                  className={footerLinkClass}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  公開しています
                </a>
                。
              </p>
              <p>Career Matchは就職・転職・採用を保証するものではありません。</p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
