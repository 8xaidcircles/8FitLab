"use client";

import { useEffect, useState } from "react";

const RESET_MS = 2000;

/** Clipboard API が使えない・許可されないブラウザ向け（選択してコピーする旧来の方法） */
function copyWithSelection(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } finally {
    textarea.remove();
  }
}

// 記事の URL をクリップボードにコピーする（外部の SNS のスクリプトやリンクは使わない）
export function ShareLinks({ url }: { url: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), RESET_MS);
    return () => clearTimeout(timer);
  }, [status]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus("copied");
    } catch {
      setStatus(copyWithSelection(url) ? "copied" : "failed");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-1 text-xs font-bold tracking-widest text-muted">SHARE</p>
      <button
        type="button"
        onClick={copy}
        aria-label="記事のリンクをコピー"
        className="rounded-full border border-line bg-white px-4 py-1.5 text-xs font-bold text-indigo transition hover:border-sky"
      >
        LINK
      </button>
      <p role="status" className="text-xs text-muted">
        {status === "copied" && "コピーしました"}
        {status === "failed" && "コピーできませんでした。アドレスバーの URL をコピーしてください"}
      </p>
    </div>
  );
}
