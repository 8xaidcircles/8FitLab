import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { TrackClick } from "@/components/track-click";
import type { JobCategoryPick } from "@/lib/blog/job-category-picks";
import type { ComparedService } from "@/lib/blog/services";

type Placement = "card" | "table";

// 公式サイトへのリンク。広告リンクには rel="sponsored nofollow" を付ける
function OfficialLink({ service, placement, className }: { service: ComparedService; placement: Placement; className: string }) {
  return (
    <TrackClick event="service_clicked" data={{ service_id: service.id, type: service.type, placement, sponsored: service.sponsored }}>
      <a
        href={service.officialUrl}
        target="_blank"
        rel={service.sponsored ? "sponsored nofollow noopener" : "noopener"}
        className={className}
      >
        {service.ctaLabel}
      </a>
    </TrackClick>
  );
}

function specRows(service: ComparedService): { label: string; value: string | null }[] {
  return service.type === "school"
    ? [
        { label: "料金", value: service.price },
        { label: "期間", value: service.period },
        { label: "学習形式", value: service.learningStyle },
        { label: "転職サポート", value: service.careerSupport },
      ]
    : [
        { label: "対象", value: service.target },
        { label: "料金", value: service.price },
        { label: "サポート", value: service.careerSupport },
      ];
}

function Logo({ service, size }: { service: ComparedService; size: number }) {
  if (!service.logo) return null;
  return (
    <Image
      src={service.logo.url}
      alt={service.name}
      width={size}
      height={Math.round((service.logo.height / service.logo.width) * size)}
      sizes={`${size}px`}
      className="rounded-lg border border-line bg-white object-contain"
    />
  );
}

export function ServiceCard({ service, rank }: { service: ComparedService; rank: number }) {
  const rows = specRows(service).filter((row) => row.value);
  return (
    <article id={`service-${service.id}`} className="relative scroll-mt-6 overflow-hidden rounded-2xl border border-line bg-white">
      <div className="flex items-center gap-3 border-b border-line bg-indigo-soft/60 px-5 py-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-extrabold text-white">{rank}</span>
        <div className="min-w-0">
          {service.catchCopy && <p className="text-xs font-bold text-sky">{service.catchCopy}</p>}
          <h3 className="text-lg leading-snug font-extrabold">{service.name}</h3>
        </div>
        {service.sponsored && <span className="ml-auto shrink-0 rounded border border-line bg-white px-1.5 text-[10px] font-bold text-muted">PR</span>}
      </div>

      <div className="space-y-4 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {service.logo && (
            <div className="shrink-0">
              <Logo service={service} size={160} />
            </div>
          )}
          {service.summary && <p className="text-sm leading-relaxed">{service.summary}</p>}
        </div>

        {rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-center text-sm">
              <thead>
                <tr>
                  {rows.map((row) => (
                    <th key={row.label} className="border border-line bg-mist px-2 py-1.5 text-xs font-bold text-muted">
                      {row.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {rows.map((row) => (
                    <td key={row.label} className="border border-line px-2 py-2">
                      {row.value}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {service.features.length > 0 && (
          <div className="rounded-xl bg-sky-soft/60 p-4">
            <p className="text-sm font-extrabold">{service.name}の特徴</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed">
              {service.features.map((feature) => (
                <li key={feature} className="flex gap-2">
                  <span aria-hidden className="text-sky">
                    ✓
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-col gap-3 sm:flex-row">
          {service.reviewArticleId && (
            <Link
              href={`/blog/${service.reviewArticleId}`}
              className="flex-1 rounded-full border border-indigo px-6 py-3 text-center text-sm font-bold text-indigo transition hover:bg-indigo-soft"
            >
              詳しく見る
            </Link>
          )}
          <div className="flex-1">
            <OfficialLink
              service={service}
              placement="card"
              className="block rounded-full bg-flame px-6 py-3 text-center text-sm font-bold text-white shadow-lg shadow-flame/20 transition hover:brightness-95"
            />
          </div>
        </div>
        {service.checkedAt && <p className="text-right text-xs text-muted">情報確認日：{service.checkedAt}</p>}
      </div>

      {service.trackingPixelUrl && (
        // ASP の計測用画像は広告コードどおりの URL を直接読み込む必要があり、next/image の最適化を通せない
        // eslint-disable-next-line @next/next/no-img-element
        <img src={service.trackingPixelUrl} width={1} height={1} alt="" className="absolute h-px w-px opacity-0" />
      )}
    </article>
  );
}

function PickLink({
  pick,
  type,
  placement = "job_category_table",
  className,
  children,
}: {
  pick: JobCategoryPick;
  type: ComparedService["type"];
  placement?: "job_category_table" | "learning_path";
  className: string;
  children: ReactNode;
}) {
  return (
    <TrackClick
      event="service_clicked"
      data={{ service_id: pick.name, type, placement, goal_id: pick.goalId, sponsored: pick.sponsored }}
    >
      <a href={pick.officialUrl} target="_blank" rel={pick.sponsored ? "sponsored nofollow noopener" : "noopener"} className={className}>
        {children}
      </a>
    </TrackClick>
  );
}

export interface RoadmapStepLabel {
  step_id: string;
  learning_order: number;
  name: string;
}

/** コースが学習ロードマップの何ステップを扱うかのメーター */
function RoadmapCoverage({ covered, total }: { covered: number; total: number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-[11px] font-bold text-indigo sm:text-xs">
        学習ロードマップ {covered}/{total} ステップに対応
      </span>
      <span className="h-1.5 w-full max-w-28 overflow-hidden rounded-full bg-indigo-soft" aria-hidden>
        <span className="bg-brand-gradient block h-full rounded-full" style={{ width: `${(covered / total) * 100}%` }} />
      </span>
    </div>
  );
}

function coveredSteps(pick: JobCategoryPick, steps: RoadmapStepLabel[] | undefined): RoadmapStepLabel[] {
  if (!steps || !pick.coveredStepIds) return [];
  const ids = new Set(pick.coveredStepIds);
  return steps.filter((step) => ids.has(step.step_id));
}

/** 職種ごとに 1 つずつ選んだスクール・転職サービスの一覧。職種に合う理由を並べる */
export function JobCategoryPickTable({
  picks,
  type,
  goalNames,
}: {
  picks: JobCategoryPick[];
  type: ComparedService["type"];
  goalNames: Map<string, string>;
}) {
  const serviceLabel = type === "school" ? "職種に対応するスクール・コース" : "職種に対応する就職・転職サービス";
  return (
    <div className="mt-6">
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        <div className="bg-brand-gradient h-1" />
        <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,5fr)] bg-ink text-xs font-bold tracking-wide text-white sm:grid sm:text-sm">
          <p className="px-5 py-3">職種</p>
          <p className="border-l border-white/15 px-5 py-3">{serviceLabel}</p>
        </div>
        <ul>
          {picks.map((pick) => {
            return (
              <li
                key={pick.goalId}
                className="grid border-t border-line transition-colors first:border-t-0 even:bg-mist hover:bg-sky-soft sm:grid-cols-[minmax(0,2fr)_minmax(0,5fr)] sm:first:border-t"
              >
                <div className="px-4 pt-4 sm:px-5 sm:py-4">
                  <Link
                    href={`/blog/category/${pick.goalId}`}
                    className="inline-block border-l-4 border-sky pl-2 text-xs leading-snug font-bold text-ink hover:text-indigo hover:underline sm:text-sm"
                  >
                    {goalNames.get(pick.goalId) ?? pick.goalId}
                  </Link>
                </div>
                <div className="space-y-1.5 px-4 pt-2 pb-4 sm:border-l sm:border-line sm:px-5 sm:py-4">
                  <p>
                    <PickLink
                      pick={pick}
                      type={type}
                      className="group inline-flex items-center gap-1.5 text-sm font-bold text-indigo hover:text-sky sm:text-base"
                    >
                      <span className="underline decoration-sky/50 underline-offset-4 group-hover:decoration-sky">{pick.name}</span>
                      <span aria-hidden className="text-sky transition-transform group-hover:translate-x-0.5">
                        ›
                      </span>
                    </PickLink>
                    {pick.course && <span className="ml-2 text-xs text-muted">{pick.course}</span>}
                  </p>
                  <p className="text-xs leading-relaxed text-ink sm:text-sm">{pick.fit}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      {picks.some((pick) => pick.sponsored) && <p className="mt-2 text-right text-xs text-muted">※ 一部に広告リンクを含みます</p>}
    </div>
  );
}

/** Learning Path ページ用：1 職種分のスクール・転職サービスのカード */
export function JobCategoryPickCard({
  pick,
  type,
  steps,
}: {
  pick: JobCategoryPick;
  type: ComparedService["type"];
  steps?: RoadmapStepLabel[];
}) {
  const covered = coveredSteps(pick, steps);
  return (
    <article className="overflow-hidden rounded-2xl border border-line bg-white">
      <div className="bg-brand-gradient h-1" />
      <div className="space-y-3 p-5">
        <p className="text-xs font-bold text-sky">{type === "school" ? "SCHOOL" : "JOB SERVICE"}</p>
        <div>
          <h3 className="text-lg font-extrabold text-ink">{pick.name}</h3>
          {pick.course && <p className="text-sm text-muted">{pick.course}</p>}
        </div>
        <p className="text-sm leading-relaxed">{pick.fit}</p>
        {steps && covered.length > 0 && (
          <div className="rounded-xl bg-mist p-3">
            <RoadmapCoverage covered={covered.length} total={steps.length} />
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {covered.map((step) => (
                <li key={step.step_id} className="rounded-full border border-line bg-white px-2.5 py-0.5 text-xs">
                  <span className="mr-1 font-bold text-indigo">{step.learning_order}</span>
                  {step.name}
                </li>
              ))}
            </ul>
          </div>
        )}
        <PickLink
          pick={pick}
          type={type}
          placement="learning_path"
          className="inline-flex items-center gap-2 rounded-full bg-indigo px-5 py-2.5 text-sm font-bold text-white transition hover:bg-ink"
        >
          公式サイトを見る <span aria-hidden>→</span>
        </PickLink>
        {pick.sponsored && <p className="text-xs text-muted">※ 広告リンクを含みます</p>}
      </div>
    </article>
  );
}

/** サービスを列、項目を行にした比較表（横スクロール） */
export function ServiceTable({ services }: { services: ComparedService[] }) {
  if (services.length === 0) return null;
  const labels = specRows(services[0]).map((row) => row.label);
  return (
    <div>
      <p className="text-xs text-muted sm:hidden">※ 表は横にスクロールできます</p>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-line bg-white">
        <table className="w-max min-w-full border-collapse text-sm">
          <tbody>
            <tr>
              <th className="sticky left-0 z-10 w-24 border-b border-line bg-mist px-3 py-3 text-left text-xs font-bold text-muted">
                名前
              </th>
              {services.map((service, i) => (
                <td key={service.id} className="min-w-40 border-b border-l border-line px-3 py-3 text-center align-top">
                  <p className="text-xs font-bold text-sky">{i + 1}</p>
                  <a href={`#service-${service.id}`} className="font-extrabold text-indigo hover:underline">
                    {service.name}
                  </a>
                </td>
              ))}
            </tr>
            {labels.map((label) => (
              <tr key={label}>
                <th className="sticky left-0 z-10 border-b border-line bg-mist px-3 py-3 text-left text-xs font-bold text-muted">{label}</th>
                {services.map((service) => (
                  <td key={service.id} className="border-b border-l border-line px-3 py-3 text-center align-top">
                    {specRows(service).find((row) => row.label === label)?.value ?? "－"}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th className="sticky left-0 z-10 bg-mist px-3 py-3 text-left text-xs font-bold text-muted">公式サイト</th>
              {services.map((service) => (
                <td key={service.id} className="border-l border-line px-3 py-3 text-center">
                  <OfficialLink
                    service={service}
                    placement="table"
                    className="inline-block rounded-full bg-flame px-4 py-2 text-xs font-bold text-white transition hover:brightness-95"
                  />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
