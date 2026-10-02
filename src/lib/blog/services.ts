import { parseHttpsUrl } from "./body-blocks";
import type { MicroCMSImage } from "./types";

/**
 * 比較ページ（/blog）に掲載するスクール・転職サービス（microCMS の services API）。
 * 管理画面の入力ミスで比較表全体を壊さないよう、名前・種別・公式サイトの URL が無いものは出さない
 */
export type ServiceType = "school" | "job_service";

export type ComparedService = {
  id: string;
  type: ServiceType;
  name: string;
  catchCopy: string | null;
  logo: MicroCMSImage | null;
  summary: string | null;
  features: string[];
  /** スクール：受講料 / 転職サービス：利用料金 */
  price: string | null;
  /** スクール：受講期間 */
  period: string | null;
  /** スクール：オンライン・教室など */
  learningStyle: string | null;
  /** スクール：転職サポートの有無 / 転職サービス：サポート内容 */
  careerSupport: string | null;
  /** 転職サービス：対象者 */
  target: string | null;
  purposes: string[];
  officialUrl: string;
  ctaLabel: string;
  sponsored: boolean;
  trackingPixelUrl: string | null;
  reviewArticleId: string | null;
  checkedAt: string | null;
  order: number;
};

export type RawService = {
  id?: unknown;
  name?: unknown;
  service_type?: unknown;
  catch_copy?: unknown;
  logo?: unknown;
  summary?: unknown;
  features?: unknown;
  price?: unknown;
  period?: unknown;
  learning_style?: unknown;
  career_support?: unknown;
  target?: unknown;
  purposes?: unknown;
  official_url?: unknown;
  cta_label?: unknown;
  sponsored?: unknown;
  tracking_pixel_url?: unknown;
  review_article?: unknown;
  checked_at?: unknown;
  order?: unknown;
};

const DEFAULT_ORDER = 100;
const DEFAULT_CTA_LABEL = "公式サイトを見る";
const MAX_CTA_LABEL_LENGTH = 30;
const SERVICE_TYPES: Record<string, ServiceType> = { school: "school", job_service: "job_service" };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** セレクトフィールドは配列で返る（複数選択オフでも配列） */
function selections(value: unknown): string[] {
  const values = Array.isArray(value) ? value : [value];
  return [...new Set(values.map(text).filter((v): v is string => v !== null))];
}

function lines(value: unknown): string[] {
  return (text(value) ?? "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^[・\-*]\s*/, "").trim())
    .filter(Boolean);
}

function image(value: unknown): MicroCMSImage | null {
  if (typeof value !== "object" || value === null) return null;
  const { url, width, height } = value as Record<string, unknown>;
  return typeof url === "string" && typeof width === "number" && typeof height === "number" && parseHttpsUrl(url)
    ? { url, width, height }
    : null;
}

function referenceId(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const id = (value as Record<string, unknown>).id;
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(id) ? id : null;
}

function toService(raw: RawService): ComparedService | null {
  const id = typeof raw.id === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(raw.id) ? raw.id : null;
  const name = text(raw.name);
  const type = SERVICE_TYPES[selections(raw.service_type)[0] ?? ""];
  const officialUrl = parseHttpsUrl(raw.official_url);
  if (!id || !name || !type || !officialUrl) return null;
  const ctaLabel = text(raw.cta_label);
  return {
    id,
    type,
    name,
    catchCopy: text(raw.catch_copy),
    logo: image(raw.logo),
    summary: text(raw.summary),
    features: lines(raw.features),
    price: text(raw.price),
    period: text(raw.period),
    learningStyle: text(raw.learning_style),
    careerSupport: text(raw.career_support),
    target: text(raw.target),
    purposes: selections(raw.purposes),
    officialUrl: officialUrl.href,
    ctaLabel: ctaLabel && ctaLabel.length <= MAX_CTA_LABEL_LENGTH ? ctaLabel : DEFAULT_CTA_LABEL,
    sponsored: raw.sponsored !== false,
    trackingPixelUrl: parseHttpsUrl(raw.tracking_pixel_url)?.href ?? null,
    reviewArticleId: referenceId(raw.review_article),
    checkedAt: text(raw.checked_at),
    order: typeof raw.order === "number" && Number.isFinite(raw.order) ? raw.order : DEFAULT_ORDER,
  };
}

/** 種別ごとに order の昇順、同じ値なら名前順 */
export function normalizeServices(raw: RawService[]): Record<ServiceType, ComparedService[]> {
  const services = raw
    .map(toService)
    .filter((s): s is ComparedService => s !== null)
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, "ja"));
  return {
    school: services.filter((s) => s.type === "school"),
    job_service: services.filter((s) => s.type === "job_service"),
  };
}

/** 目的ごとのサービス（目的は最初に出てきた順） */
export function groupByPurpose(services: ComparedService[]): { purpose: string; services: ComparedService[] }[] {
  const groups = new Map<string, ComparedService[]>();
  for (const service of services) {
    for (const purpose of service.purposes) groups.set(purpose, [...(groups.get(purpose) ?? []), service]);
  }
  return [...groups].map(([purpose, list]) => ({ purpose, services: list }));
}
