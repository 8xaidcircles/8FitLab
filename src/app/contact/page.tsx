import type { Metadata } from "next";
import { CONTACT_FORM, SITE_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: "お問い合わせ",
  description: `${SITE_NAME}へのお問い合わせフォームです。`,
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-extrabold md:text-3xl">お問い合わせ</h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {SITE_NAME}へのご意見・ご要望・不具合のご報告などは、以下のフォームからお送りください。
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-line bg-white">
        <iframe src={CONTACT_FORM.embedUrl} title="お問い合わせフォーム" className="block h-[900px] w-full" loading="lazy">
          読み込んでいます…
        </iframe>
      </div>
      <p className="mt-4 text-xs text-muted">
        フォームが表示されない場合は
        <a href={CONTACT_FORM.url} className="underline hover:text-indigo" target="_blank" rel="noopener noreferrer">
          こちら
        </a>
        から開いてください（Googleフォーム）。
      </p>
    </div>
  );
}
