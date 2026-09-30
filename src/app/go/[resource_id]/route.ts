import { getOrCreateAnonymousUserId } from "@/lib/anonymous-user";
import {
  buildClickEvent,
  isAffiliateLink,
  isBotUserAgent,
  loadLearningPath,
  loadResources,
  redirectUrl,
  sanitizeGoParams,
  type GoParams,
} from "@/lib/career-match";
import { recordEvent } from "@/lib/events";

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow",
};

function notFound(): Response {
  return new Response("Not Found", { status: 404, headers: HEADERS });
}

// 存在しない Goal・Step は計測に残さない（リダイレクトは止めない）
async function withKnownGoalStep(params: GoParams): Promise<GoParams> {
  if (!params.goal_id) return { ...params, step_id: null };
  try {
    const path = await loadLearningPath(params.goal_id);
    const stepKnown = params.step_id !== null && path.steps.some((s) => s.step_id === params.step_id);
    return { ...params, step_id: stepKnown ? params.step_id : null };
  } catch {
    return { ...params, goal_id: null, step_id: null };
  }
}

async function resolve(request: Request, context: RouteContext<"/go/[resource_id]">) {
  const params = sanitizeGoParams(await context.params, new URL(request.url).searchParams);
  if (!params) return null;
  const resource = (await loadResources()).find((r) => r.resource_id === params.resource_id && r.is_active);
  if (!resource) return null;
  const isAffiliate = isAffiliateLink(resource);
  const location = redirectUrl(resource, isAffiliate);
  if (!location) return null;
  return { params, resource, isAffiliate, location };
}

export async function GET(request: Request, context: RouteContext<"/go/[resource_id]">) {
  const target = await resolve(request, context);
  if (!target) return notFound();

  if (!isBotUserAgent(request.headers.get("user-agent"))) {
    try {
      const params = await withKnownGoalStep(target.params);
      await recordEvent(
        await getOrCreateAnonymousUserId(),
        "resource_clicked",
        buildClickEvent(params, target.resource, target.isAffiliate),
      );
    } catch (error) {
      console.error("resource_clicked の記録に失敗しました", error);
    }
  }

  return new Response(null, { status: 302, headers: { ...HEADERS, Location: target.location } });
}

// リンクチェッカー・プレビュー用。計測もリダイレクトもしない
export async function HEAD(request: Request, context: RouteContext<"/go/[resource_id]">) {
  const target = await resolve(request, context);
  return new Response(null, { status: target ? 200 : 404, headers: HEADERS });
}
