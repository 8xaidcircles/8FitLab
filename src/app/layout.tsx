import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ORGANIZATION_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
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
  { href: "/goal-fit", label: "Goal Fit" },
  { href: "/blog", label: "Blog" },
];

const FOOTER_LINKS = [
  { href: ORGANIZATION_URL, label: "運営元" },
  { href: `${ORGANIZATION_URL}/privacy-policy`, label: "プライバシーポリシー" },
  { href: `${ORGANIZATION_URL}/terms-of-service`, label: "利用規約" },
  { href: "/disclaimer", label: "免責事項" },
  { href: "/contact", label: "問い合わせ" },
];

const COPYRIGHT_YEAR = 2026;

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
            </div>
            <div className="space-y-2 text-xs leading-relaxed">
              <p className="font-bold text-ink">データ出典・ライセンス</p>
              <p>
                本サービスは JobHop（CC BY 4.0）、ESCO（CC BY 4.0）、Stack Overflow Developer Survey（ODbL）のオープンデータを利用・加工しています。
                詳細なライセンス表記・クレジット・改変通知は
                <Link href="/disclaimer#licenses" className="underline hover:text-indigo">
                  データ出典・ライセンス表記
                </Link>
                をご確認ください。
              </p>
              <p>※ Goal Fitは就職・転職・採用を保証するものではありません。</p>
            </div>
          </div>
          <div className="border-t border-line">
            <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 py-5 text-xs text-muted md:flex-row md:items-center md:justify-between">
              <nav aria-label="フッターメニュー">
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {FOOTER_LINKS.map((item) => (
                    <li key={item.href}>
                      <Link href={item.href} className="hover:text-indigo hover:underline">
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
              <p>
                © {COPYRIGHT_YEAR} - {SITE_NAME}. All rights reserved.
              </p>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
