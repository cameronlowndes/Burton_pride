import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_LIMIT = 200;
const MAX_OFFSET = 100000;

type Acceptance = {
  id: string;
  lottery_id: string;
  order_id: string | null;
  acceptance_type: string;
  version: string | null;
  accepted: boolean;
  accepted_at: string | null;
  created_at: string;
};
type LinkedOrder = {
  id: string;
  lottery_id: string;
  order_reference: string | null;
  purchaser_name?: string | null;
  purchaser_email?: string | null;
};
type LinkedLottery = { id: string; title: string; slug: string };
class RouteError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
function json(body: Record<string, unknown>, requestId: string, status = 200) {
  return NextResponse.json(
    { ...body, request_id: requestId },
    {
      status,
      headers: {
        "Cache-Control":
          "private, no-store, no-cache, must-revalidate, max-age=0",
        "X-Content-Type-Options": "nosniff",
        "X-Request-ID": requestId,
        Vary: "Cookie, Authorization",
      },
    },
  );
}
function single(params: URLSearchParams, name: string): string | null {
  if (params.getAll(name).length > 1)
    throw new RouteError(400, `Provide ${name} only once.`);
  return params.get(name);
}
function optionalId(params: URLSearchParams, name: string): string | null {
  const value = single(params, name);
  if (value === null) return null;
  if (!UUID.test(value)) throw new RouteError(400, `Provide a valid ${name}.`);
  return value.toLowerCase();
}
function integer(
  params: URLSearchParams,
  name: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const value = single(params, name);
  if (value === null) return fallback;
  if (!/^\d{1,6}$/.test(value))
    throw new RouteError(400, `Provide a whole number for ${name}.`);
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < min || result > max)
    throw new RouteError(400, `${name} must be between ${min} and ${max}.`);
  return result;
}
function boolean(params: URLSearchParams, name: string): boolean | null {
  const value = single(params, name);
  if (value === null) return null;
  if (value !== "true" && value !== "false")
    throw new RouteError(400, `${name} must be true or false.`);
  return value === "true";
}
// getUser has no per-call AbortSignal option. Bound our wait as well as DB queries.
function withSignal<T>(
  promise: PromiseLike<T>,
  signal: AbortSignal,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () =>
      reject(
        new RouteError(503, "Declaration records are temporarily unavailable."),
      );
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    Promise.resolve(promise)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function GET(request: NextRequest) {
  const requestId = randomUUID();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const cancelled = () => controller.abort();
  request.signal.addEventListener("abort", cancelled, { once: true });
  if (request.signal.aborted) controller.abort();
  let stage = "session";
  try {
    const client = await withSignal(createClient(), controller.signal);
    const { data, error: authError } = await withSignal(
      client.auth.getUser(),
      controller.signal,
    );
    if (authError || !data.user?.id || data.user.is_anonymous === true)
      throw new RouteError(401, "Authentication required.");

    // Load the privileged client only after a verified Auth identity exists.
    const { supabaseAdmin } = await import("@/lib/supabase/supabaseAdmin");
    stage = "authorization";
    const adminResult = await withSignal(
      supabaseAdmin
        .from("admin_users")
        .select("id,supabase_user_id,role,is_active")
        .eq("supabase_user_id", data.user.id)
        .eq("is_active", true)
        .abortSignal(controller.signal)
        .maybeSingle(),
      controller.signal,
    );
    if (adminResult.error)
      throw new RouteError(
        503,
        "Declaration records are temporarily unavailable.",
      );
    const admin = adminResult.data;
    // Conservative role restriction using the supplied schema. Do not call the
    // reviewed cookie-trusting helper or infer permission from an email match.
    // Replace this role check with the verified central lottery:orders:view
    // guard when its implementation and permission storage are supplied.
    if (
      !admin ||
      admin.supabase_user_id !== data.user.id ||
      admin.is_active !== true ||
      admin.role !== "main_admin"
    ) {
      throw new RouteError(
        403,
        "You do not have permission to read declaration records.",
      );
    }

    stage = "validation";
    const params = request.nextUrl.searchParams;
    const lotteryId = optionalId(params, "lottery_id");
    const orderId = optionalId(params, "order_id");
    const limit = integer(params, "limit", 100, 1, MAX_LIMIT);
    const offset = integer(params, "offset", 0, 0, MAX_OFFSET);
    const includePii = boolean(params, "include_pii") === true;
    const accepted = boolean(params, "accepted");
    const acceptanceType = single(params, "acceptance_type");
    if (
      acceptanceType !== null &&
      !/^[a-z][a-z0-9_]{0,79}$/.test(acceptanceType)
    )
      throw new RouteError(400, "Provide a valid acceptance_type.");

    stage = "declarations";
    let query = supabaseAdmin
      .from("lottery_acceptances")
      .select(
        "id,lottery_id,order_id,acceptance_type,version,accepted,accepted_at,created_at",
      )
      .order("accepted_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false })
      // range is inclusive; fetch one extra row to establish whether more exist.
      .range(offset, offset + limit)
      .abortSignal(controller.signal);
    if (lotteryId) query = query.eq("lottery_id", lotteryId);
    if (orderId) query = query.eq("order_id", orderId);
    if (acceptanceType) query = query.eq("acceptance_type", acceptanceType);
    if (accepted !== null) query = query.eq("accepted", accepted);
    const result = await withSignal(query, controller.signal);
    if (result.error || !Array.isArray(result.data))
      throw new RouteError(503, "Unable to load declaration records.");
    const hasMore = result.data.length > limit;
    const acceptances = result.data.slice(0, limit) as Acceptance[];
    const orderIds = [
      ...new Set(
        acceptances.flatMap((row) => (row.order_id ? [row.order_id] : [])),
      ),
    ];
    const lotteryIds = [...new Set(acceptances.map((row) => row.lottery_id))];

    stage = "relationships";
    // Query identity/contact fields only when explicitly requested by an
    // authorized main administrator. IP addresses are never read or returned.
    const ordersQuery = orderIds.length
      ? withSignal(
          supabaseAdmin
            .from("lottery_orders")
            .select(
              includePii
                ? "id,lottery_id,order_reference,purchaser_name,purchaser_email"
                : "id,lottery_id,order_reference",
            )
            .in("id", orderIds)
            .abortSignal(controller.signal),
          controller.signal,
        )
      : Promise.resolve({ data: [], error: null });
    const lotteriesQuery = lotteryIds.length
      ? withSignal(
          supabaseAdmin
            .from("lotteries")
            .select("id,title,slug")
            .in("id", lotteryIds)
            .abortSignal(controller.signal),
          controller.signal,
        )
      : Promise.resolve({ data: [], error: null });
    const [ordersResult, lotteriesResult] = await Promise.all([
      ordersQuery,
      lotteriesQuery,
    ]);
    if (
      ordersResult.error ||
      lotteriesResult.error ||
      !Array.isArray(ordersResult.data) ||
      !Array.isArray(lotteriesResult.data)
    )
      throw new RouteError(503, "Unable to load linked declaration details.");
    const orders = new Map(
      (ordersResult.data as unknown as LinkedOrder[]).map((row) => [
        row.id,
        row,
      ]),
    );
    const lotteries = new Map(
      (lotteriesResult.data as LinkedLottery[]).map((row) => [row.id, row]),
    );
    const items = acceptances.map((row) => {
      const order = row.order_id ? orders.get(row.order_id) : undefined;
      if (order && order.lottery_id !== row.lottery_id)
        throw new RouteError(503, "Unable to load linked declaration details.");
      // Explicit response projection prevents accidental disclosure if selects change.
      return {
        id: row.id,
        lottery_id: row.lottery_id,
        order_id: row.order_id,
        acceptance_type: row.acceptance_type,
        version: row.version,
        accepted: row.accepted,
        accepted_at: row.accepted_at,
        created_at: row.created_at,
        ip_address: null,
        order: order
          ? {
              id: order.id,
              order_reference: order.order_reference,
              purchaser_name: includePii
                ? (order.purchaser_name ?? null)
                : null,
              purchaser_email: includePii
                ? (order.purchaser_email ?? null)
                : null,
            }
          : null,
        lottery: lotteries.has(row.lottery_id)
          ? {
              id: lotteries.get(row.lottery_id)!.id,
              title: lotteries.get(row.lottery_id)!.title,
              slug: lotteries.get(row.lottery_id)!.slug,
            }
          : null,
      };
    });
    const nextOffset =
      hasMore && offset + limit <= MAX_OFFSET ? offset + limit : null;
    return json(
      {
        ok: true,
        items,
        count: items.length,
        pii_included: includePii,
        pagination: {
          offset,
          limit,
          has_more: hasMore,
          next_offset: nextOffset,
          offset_limit_reached: hasMore && nextOffset === null,
        },
        generated_at: new Date().toISOString(),
      },
      requestId,
    );
  } catch (error) {
    const status = error instanceof RouteError ? error.status : 500;
    // No identities, declarations, raw provider messages or database payloads in logs.
    if (status >= 500)
      console.error("Lottery declarations request failed", {
        request_id: requestId,
        stage,
        status,
      });
    return json(
      {
        ok: false,
        error:
          error instanceof RouteError
            ? error.message
            : "Unable to load declaration records.",
      },
      requestId,
      status,
    );
  } finally {
    clearTimeout(timeout);
    request.signal.removeEventListener("abort", cancelled);
  }
}
