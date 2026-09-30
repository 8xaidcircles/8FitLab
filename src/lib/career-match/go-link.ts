import type { Resource } from "./types";

// /go/[resource_id] の検証と計測。Route Handler から切り出した純粋関数（route.ts は HTTP メソッド以外を export できない）

export const GO_PLACEMENTS = ["step_resource", "career_next"] as const;
export type GoPlacement = (typeof GO_PLACEMENTS)[number];

const ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,99}$/;
const MAX_POSITION_INDEX = 99;

export interface GoParams {
  resource_id: string;
  placement: GoPlacement;
  position_index: number;
  goal_id: string | null;
  /** placement = step_resource のときだけ */
  step_id: string | null;
}

function idOrNull(value: string | null): string | null {
  return value !== null && ID_PATTERN.test(value) ? value : null;
}

// resource_id が不正なら null（404）。それ以外の不正値は既定値に置き換えてリダイレクトは続ける
export function sanitizeGoParams(params: { resource_id: string }, searchParams: URLSearchParams): GoParams | null {
  const resourceId = idOrNull(params.resource_id);
  if (resourceId === null) return null;

  const rawPlacement = searchParams.get("placement");
  const placement: GoPlacement = GO_PLACEMENTS.includes(rawPlacement as GoPlacement) ? (rawPlacement as GoPlacement) : "step_resource";

  const rawIndex = searchParams.get("position_index");
  const index = rawIndex !== null && /^\d{1,2}$/.test(rawIndex) ? Number(rawIndex) : 0;

  return {
    resource_id: resourceId,
    placement,
    position_index: Math.min(MAX_POSITION_INDEX, index),
    goal_id: idOrNull(searchParams.get("goal_id")),
    step_id: placement === "step_resource" ? idOrNull(searchParams.get("step_id")) : null,
  };
}

export function goHref(params: GoParams): string {
  const query = new URLSearchParams({ placement: params.placement, position_index: String(params.position_index) });
  if (params.goal_id) query.set("goal_id", params.goal_id);
  if (params.step_id) query.set("step_id", params.step_id);
  return `/go/${encodeURIComponent(params.resource_id)}?${query}`;
}

export function buildClickEvent(params: GoParams, resource: Resource, isAffiliate: boolean): Record<string, unknown> {
  return {
    resource_id: resource.resource_id,
    resource_type: resource.type,
    provider: resource.provider,
    editorial_rank: resource.editorial_rank,
    placement: params.placement,
    position_index: params.position_index,
    goal_id: params.goal_id,
    step_id: params.step_id,
    is_affiliate: isAffiliate,
    affiliate_program: isAffiliate ? resource.affiliate!.program : null,
  };
}

// 検索エンジン・リンクプレビュー・監視ツールのクリックを計測しない（User-Agent が無いものも含む）
const BOT_PATTERN =
  /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|discord|slack|telegram|curl|wget|python-requests|httpclient|headless|lighthouse|monitor/i;

export function isBotUserAgent(userAgent: string | null): boolean {
  return !userAgent || BOT_PATTERN.test(userAgent);
}

// リダイレクト先は https のみ（アフィリエイト有効時はアフィリエイト URL）
export function redirectUrl(resource: Resource, isAffiliate: boolean): string | null {
  const url = isAffiliate ? resource.affiliate!.url : resource.official_url;
  try {
    return new URL(url).protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}
