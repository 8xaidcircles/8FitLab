import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { ThirdPartyScripts } from "@/components/third-party-scripts";
import { loadGoals } from "@/lib/career-match";
import { ADSENSE_CLIENT_ID, ORGANIZATION_URL, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
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
  // AdSense のサイト所有権の確認用
  ...(ADSENSE_CLIENT_ID && { other: { "google-adsense-account": ADSENSE_CLIENT_ID } }),
};

const NAV = [
  { href: "/goal-fit", label: "Goal Fit" },
  { href: "/blog", label: "Blog" },
];

const FOOTER_LINKS = [
  { href: ORGANIZATION_URL, label: "運営元" },
  { href: "/privacy-policy", label: "プライバシーポリシー" },
  { href: "/cookie-policy", label: "Cookie・外部送信" },
  { href: `${ORGANIZATION_URL}/terms-of-service`, label: "利用規約" },
  { href: "/disclaimer", label: "免責事項" },
  { href: "/disclaimer#licenses", label: "データ出典" },
  { href: "/contact", label: "問い合わせ" },
];

const COPYRIGHT_YEAR = 2026;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const goals = await loadGoals();
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
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 text-sm text-muted md:grid-cols-[1fr_2fr] md:gap-10">
            <div className="space-y-3">
              <Logo />
              <p>Goalから逆算して、エンジニアのキャリアをつくる。</p>
            </div>
            <nav aria-labelledby="footer-categories">
              <p id="footer-categories" className="text-xs font-bold tracking-widest text-sky">
                JOB CATEGORY
                <span className="ml-2 font-bold tracking-normal text-ink">職種別カテゴリ</span>
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {goals.map((goal) => (
                  <li key={goal.goal_id} className="min-w-0">
                    <Link
                      href={`/blog/category/${goal.goal_id}`}
                      className="group flex items-start gap-1.5 py-1 text-xs leading-snug transition-colors hover:text-indigo"
                    >
                      <span aria-hidden className="text-sky transition-transform group-hover:translate-x-0.5">
                        ›
                      </span>
                      <span className="group-hover:underline">{goal.name}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
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
        <ThirdPartyScripts />
      </body>
    </html>
  );
}
