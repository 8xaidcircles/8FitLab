import Script from "next/script";
import { ADSENSE_CLIENT_ID, GA_MEASUREMENT_ID } from "@/lib/site";

/** Google アナリティクス 4 と Google AdSense（自動広告）のタグ。ID が未設定のものは読み込まない */
export function ThirdPartyScripts() {
  return (
    <>
      {GA_MEASUREMENT_ID && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} strategy="afterInteractive" />
          <Script id="ga4-init" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`}
          </Script>
        </>
      )}
      {/* next/script は AdSense が対応していない data-nscript 属性を付けるため、通常の script で読み込む */}
      {ADSENSE_CLIENT_ID && (
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
          crossOrigin="anonymous"
        />
      )}
    </>
  );
}
