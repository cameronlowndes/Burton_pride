import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };
const QUERY_TIMEOUT_MS = 15_000;

function response(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store, no-cache, must-revalidate, max-age=0",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function originAllowed(request: NextRequest) {
  const origin = request.headers.get("origin");
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin || !configured || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const trusted = new URL(configured);
    return ["https:", "http:"].includes(trusted.protocol) && new URL(origin).origin === trusted.origin;
  } catch { return false; }
}

async function getVerifiedAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  const store = await cookies();
  const auth = createServerClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(QUERY_TIMEOUT_MS) }),
    },
    cookies: {
      getAll: () => store.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) store.set(name, value, options);
      },
    },
  });
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) return null;
  // Bind the administrator selected by the legacy helper to a verified identity.
  // The helper's active-account and custom-session revocation checks remain a
  // shared dependency and must be reviewed separately.
  const admin = await getAuthenticatedAdmin();
  if (!admin || !isValidUuid(admin.id) || typeof admin.email !== "string" ||
      admin.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return null;
  return admin;
}

/**
 * REQUIRED DATABASE CONTRACT -- not included in the supplied route/schema.
 *
 * lottery_duplicate_atomic(
 *   p_source_lottery_id uuid, p_admin_id uuid,
 *   p_idempotency_key uuid, p_request_id text
 * ) -> jsonb
 *
 * Implement against the actual schema before enabling duplication. Restrict
 * execution to the authorized server role. In ONE transaction the function must:
 * 1. Verify an active actor with lottery:create and source-record access.
 * 2. Lock/claim a persistent idempotency record unique on actor + key. A replay
 *    returns the same copy without another audit; a key reused for another
 *    source returns IDEMPOTENCY_CONFLICT. Concurrent requests must not double-copy.
 * 3. Read a consistent source + prize snapshot and copy only an explicit allowlist
 *    of template fields. Never spread the source row, auto-generated columns,
 *    counters, financial totals, provider references, draw/publication/approval
 *    history, or ownership identifiers into an INSERT.
 * 4. Generate a new UUID, unique bounded slug/reference and appropriately bounded
 *    copy title. Set draft, is_active=false, show_in_public_directory=false.
 *    Clear/disable legacy show_in_directory if still present. Clear approvals,
 *    archiving, publication, sales/draw/results dates and operational history.
 *    Preserve profile-driven template settings without copying its approval.
 * 5. Copy ALL prize templates using an explicit prize-column allowlist, new UUIDs,
 *    and the NEW lottery_id. Preserve template labels, values, images, tiers and
 *    ordering where supported. Clear winner/claim/fulfilment links and state.
 *    Do not copy orders, tickets, entrants, refunds, acceptances, winners or draws.
 * 6. Write one mandatory lottery_audit_logs row with non-null action_group and
 *    risk_level, linking the source and copy. Audit, prize or insertion failure
 *    must roll back the ENTIRE duplication, including the idempotency record.
 *
 * Success result:
 * { ok: true, source_id: uuid, idempotency_key: uuid, replayed: boolean,
 *   source_prize_count: integer, copied_prize_count: integer, item: <new lottery> }
 * Rejections: { ok: false, code: NOT_FOUND | PERMISSION_DENIED |
 *   INVALID_SOURCE | IDEMPOTENCY_CONFLICT | CONFLICT }
 *
 * There is no non-transactional insert/best-effort-audit fallback.
 * The client must send a UUID Idempotency-Key header, generated ONCE per intended
 * duplication and retained across timeout/retry. A new intentional copy uses a
 * new key. The existing client needs this header added if it does not send it.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const requestId = `LOT-COPY-${crypto.randomUUID()}`;
  const fail = (code: string, error: string, status: number) =>
    response({ ok: false, code, error, request_id: requestId }, status);
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) return fail("LOTTERY_AUTH_REQUIRED", "A verified administrator session is required.", 401);
    if (!hasLotteryPermission(admin, "lottery:create")) {
      return fail("LOTTERY_PERMISSION_DENIED", "You do not have permission to duplicate lotteries.", 403);
    }
    if (!originAllowed(request)) return fail("LOTTERY_ORIGIN_DENIED", "The request origin is not allowed.", 403);
    const { id: rawId } = await context.params;
    const id = typeof rawId === "string" ? rawId.trim() : "";
    if (!isValidUuid(id)) return fail("LOTTERY_INVALID_ID", "The lottery ID is invalid.", 400);
    const rawKey = request.headers.get("idempotency-key");
    if (!isValidUuid(rawKey)) {
      return fail("LOTTERY_IDEMPOTENCY_KEY_REQUIRED", "The duplicate request requires a valid unique request key.", 400);
    }
    const key = rawKey.toLowerCase();
    const sourceId = id.toLowerCase();

    // The transaction owns source lookup and locking. In particular, a replay
    // must not fail solely because the original source was subsequently removed.
    const db = getAuditServiceClient();
    const { data: result, error: transactionError } = await db.rpc("lottery_duplicate_atomic", {
      p_source_lottery_id: sourceId,
      p_admin_id: admin.id,
      p_idempotency_key: key,
      p_request_id: requestId,
    }).abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS));
    if (transactionError) {
      console.error(`[${requestId}] Lottery duplication transaction failed:`, transactionError);
      if (transactionError.code === "PGRST202" || transactionError.code === "42883") {
        return fail("LOTTERY_DUPLICATE_WORKFLOW_UNAVAILABLE",
          "The secure duplication workflow is not configured. No fallback copy was attempted.", 503);
      }
      // A timeout may occur after commit. Retrying with the SAME key must return
      // the same copy, not create another one.
      return fail("LOTTERY_DUPLICATE_OUTCOME_UNCONFIRMED",
        "The result could not be confirmed. Reload the list or retry with the same request key.", 503);
    }
    if (!result || typeof result !== "object" || Array.isArray(result)) {
      return fail("LOTTERY_DUPLICATE_OUTCOME_UNCONFIRMED", "Reload the lottery list to confirm the result.", 503);
    }
    if (result.ok !== true) {
      const errors: Record<string, [string, number]> = {
        NOT_FOUND: ["Lottery not found.", 404],
        PERMISSION_DENIED: ["You do not have permission to duplicate this lottery.", 403],
        INVALID_SOURCE: ["This lottery cannot be duplicated through this workflow.", 409],
        IDEMPOTENCY_CONFLICT: ["This request key belongs to a different duplication request.", 409],
        CONFLICT: ["The duplication request conflicted with another change. Retry with the same request key.", 409],
      };
      const publicError = typeof result.code === "string" && Object.hasOwn(errors, result.code)
        ? errors[result.code] : undefined;
      if (publicError) return fail(`LOTTERY_DUPLICATE_${result.code}`, publicError[0], publicError[1]);
      return fail("LOTTERY_DUPLICATE_OUTCOME_UNCONFIRMED", "Reload the lottery list to confirm the result.", 503);
    }
    const item = result.item;
    const invalidResult = !item || typeof item !== "object" || Array.isArray(item) ||
      !isValidUuid(item.id) || item.id.toLowerCase() === sourceId ||
      result.source_id !== sourceId || result.idempotency_key !== key ||
      typeof result.replayed !== "boolean" ||
      !Number.isSafeInteger(result.source_prize_count) || result.source_prize_count < 0 ||
      !Number.isSafeInteger(result.copied_prize_count) ||
      result.copied_prize_count !== result.source_prize_count ||
      item.status !== "draft" || item.is_active !== false ||
      item.show_in_public_directory !== false || item.show_in_directory === true ||
      item.compliance_approved === true || item.compliance_approved_at != null ||
      item.compliance_approved_by != null || item.archived_at != null ||
      item.publication_at != null || item.sales_open_at != null || item.sales_close_at != null ||
      item.draw_at != null || item.draw_completed_at != null ||
      item.results_publish_at != null || item.results_published_at != null ||
      item.public_results_published_at != null ||
      typeof item.title !== "string" || !item.title.trim() ||
      typeof item.slug !== "string" || !item.slug.trim();
    if (invalidResult) {
      // Response validation cannot undo a committed transaction. Do not report a
      // successful copy or try an unsafe compensating DELETE here.
      console.error(`[${requestId}] Duplication returned an invalid contract response.`);
      return fail("LOTTERY_DUPLICATE_OUTCOME_UNCONFIRMED", "Reload the lottery list to confirm the result.", 503);
    }
    return response({ ok: true, message: result.replayed
      ? "The existing duplicate was returned. No additional copy was created."
      : "Lottery and prize templates duplicated successfully.",
      item, copied_prize_count: result.copied_prize_count,
      replayed: result.replayed, idempotency_key: key, request_id: requestId,
    }, result.replayed ? 200 : 201);
  } catch (error) {
    console.error(`[${requestId}] Lottery duplication API error:`, error);
    return fail("LOTTERY_DUPLICATE_OUTCOME_UNCONFIRMED",
      "Unable to confirm duplication. Reload the list before starting another request.", 503);
  }
}
