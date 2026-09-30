import Link from "next/link";
import type { ReactNode } from "react";
import type { Resource } from "@/lib/career-match/types";
import { RESOURCE_LEVEL_LABELS, RESOURCE_TYPE_LABELS } from "@/lib/labels";

function Badge({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${className}`}>{children}</span>;
}

// リンクは /go 経由（クリック計測）。next/link だとプリフェッチでリダイレクトと計測が走るため <a> を使う
export function StepResourceCard({ resource, href, isAffiliate }: { resource: Resource; href: string; isAffiliate: boolean }) {
  const learning = resource.type === "job_service" ? null : resource;
  return (
    <div className="rounded-xl border border-line bg-white p-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge className="bg-indigo-soft text-indigo">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
        {learning && <Badge className="bg-sky-soft text-ink">{RESOURCE_LEVEL_LABELS[learning.level]}</Badge>}
        {learning?.cost === "free" && <Badge className="bg-cyan-soft text-cyan">無料</Badge>}
        {isAffiliate && (
          <Badge className="border border-line text-muted">
            <abbr title="広告（アフィリエイトリンク）です。掲載順位には影響しません。" className="no-underline">
              PR
            </abbr>
          </Badge>
        )}
      </div>
      <a
        href={href}
        target="_blank"
        rel={isAffiliate ? "noopener noreferrer sponsored" : "noopener noreferrer"}
        className="mt-2 block font-bold text-indigo hover:underline"
      >
        {resource.name}
      </a>
      <p className="text-xs text-muted">{resource.provider}</p>
      <p className="mt-2 text-sm leading-relaxed">{resource.selection_reason}</p>
      <p className="mt-2 text-xs text-muted">
        {resource.price_note && <>{resource.price_note} ／ </>}
        確認日：{resource.verified_at}
      </p>
      <p className="mt-2 text-[11px] text-muted">
        8FitLab 運営による選定 ・{" "}
        <Link href="/editorial-policy" className="underline hover:text-indigo">
          選定基準
        </Link>
      </p>
    </div>
  );
}

export function ResourcePending({ name }: { name: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-3 text-xs text-muted">
      {name}：教材を準備中です
    </div>
  );
}
