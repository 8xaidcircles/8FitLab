"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { isResultPath, sanitizeAnalyticsPath } from "@/lib/analytics";

// gtag は afterInteractive の初期化スクリプトで定義されるため、初回表示では少し待つ
const WAIT_INTERVAL_MS = 100;
const MAX_WAIT_ATTEMPTS = 50;

/** Google アナリティクスの page_view を、結果ページの ID を [id] に置き換えて送る（GA を使っていなければ何もしない） */
export function AnalyticsPageView() {
  const pathname = usePathname();

  useEffect(() => {
    let attempts = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const send = () => {
      if (!window.gtag) {
        attempts += 1;
        if (attempts < MAX_WAIT_ATTEMPTS) timer = setTimeout(send, WAIT_INTERVAL_MS);
        return;
      }
      const pagePath = sanitizeAnalyticsPath(pathname);
      // 結果ページはクエリも閲覧の手がかりになりうるため送らない
      const search = isResultPath(pathname) ? "" : location.search;
      try {
        window.gtag("event", "page_view", {
          page_location: location.origin + pagePath + search,
          page_path: pagePath,
          page_title: document.title,
        });
      } catch {}
    };
    send();
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
