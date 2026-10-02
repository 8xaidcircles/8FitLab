import Image from "next/image";
import Link from "next/link";
import { TrackClick } from "@/components/track-click";
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
