import {
  NextRequest,
  NextResponse,
} from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import {
  getAuthenticatedAdmin,
  getAuditServiceClient,
  hasLotteryPermission,
  writeLotteryAuditSafe,
} from "@/lib/lottery/audit-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Publishing and deletion need verified compliance/MFA and database transactions.
// Do not restore the old direct writes for these actions.
const MAX_BODY_BYTES = 64 * 1024;
const QUERY_TIMEOUT_MS = 15_000;

type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "paused"
  | "cancelled"
  | "under_review";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function response(
  body: unknown,
  status = 200,
) {
  if (status >= 500 && body && typeof body === "object") {
    const { details: _details, ...safeBody } = body as Record<string, unknown>;
    body = safeBody;
  }
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control":
        "private, no-store, no-cache, must-revalidate, max-age=0",
      "X-Content-Type-Options":
        "nosniff",
    },
  });
}

function createRequestId() {
  return `LOT-${Date.now()}-${crypto
    .randomUUID()
    .slice(0, 8)
    .toUpperCase()}`;
}

function isValidUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isValidLotteryStatus(
  value: unknown,
): value is LotteryStatus {
  return (
    value === "draft" ||
    value ===
      "compliance_review" ||
    value === "scheduled" ||
    value === "live" ||
    value === "sales_closed" ||
    value === "draw_ready" ||
    value === "completed" ||
    value === "archived" ||
    value === "paused" ||
    value === "cancelled" ||
    value === "under_review"
  );
}

function safeDetails(
  value: unknown,
) {
  if (
    value === null ||
    value === undefined
  ) {
    return undefined;
  }

  return value;
}

function getMainAdminRole(
  admin: unknown,
) {
  if (!admin || typeof admin !== "object") {
    return null;
  }

  const candidate = admin as {
    role?: unknown;
  };

  return typeof candidate.role === "string"
    ? candidate.role
    : null;
}

async function getVerifiedAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase authentication is not configured.");
  const cookieStore = await cookies();
  const auth = createServerClient(url, key, {
    global: {
      fetch: (input, init) => fetch(input, {
        ...init, signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      }),
    },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (values) => {
        for (const { name, value, options } of values) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });
  const { data: { user }, error } = await auth.auth.getUser();
  if (error || !user?.email || !user.email_confirmed_at || user.is_anonymous) return null;
  const admin = await getAuthenticatedAdmin();
  if (!admin || typeof admin.email !== "string" ||
      admin.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) return null;
  // Match the main-admin restriction already adopted by the reviewed admin routes.
  if (getMainAdminRole(admin) !== "main_admin") return null;
  return admin;
}

function mutationOriginAllowed(request: NextRequest) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  const origin = request.headers.get("origin");
  if (!configured || !origin) return false;
  try {
    const allowed = new URL(configured);
    return ["https:", "http:"].includes(allowed.protocol) &&
      new URL(origin).origin === allowed.origin &&
      request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
}

async function readObjectBody(request: NextRequest) {
  // Bound streamed bytes; do not trust Content-Length alone.
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BODY_BYTES) {
        await reader.cancel();
        throw new Error("Request body is too large.");
      }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("The request body must be an object.");
  }
  return body as Record<string, unknown>;
}

/*
 * =========================================================
 * GET ONE LOTTERY BY ID
 *
 * GET
 * /api/admin/lotterymanagement/lottery/[id]
 * =========================================================
 */
export async function GET(
  _request: NextRequest,
  context: RouteContext,
) {
  const requestId =
    createRequestId();

  try {
    /*
     * =====================================================
     * AUTHENTICATION
     * =====================================================
     */
    const admin =
      await getVerifiedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_AUTH_REQUIRED",
          error:
            "You must be signed in to view this lottery.",
          request_id:
            requestId,
        },
        401,
      );
    }

    /*
     * =====================================================
     * PERMISSION
     * =====================================================
     */
    if (
      !hasLotteryPermission(
        admin,
        "lottery:view",
      )
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_PERMISSION_DENIED",
          error:
            "You do not have permission to view lottery records.",
          request_id:
            requestId,
        },
        403,
      );
    }
    const {
      id: rawId,
    } =
      await context.params;

    const id =
      rawId.trim();

    if (
      !id ||
      !isValidUuid(id)
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_INVALID_ID",
          error:
            "The lottery ID is invalid.",
          request_id:
            requestId,
          details: {
            received_id:
              id || null,
          },
        },
        400,
      );
    }

    const db =
      getAuditServiceClient();

    /*
     * =====================================================
     * LOAD LOTTERY
     * =====================================================
     */
    const {
      data: lottery,
      error,
    } = await db
      .from("lotteries")
      .select("*")
      .eq(
        "id",
        id,
      )
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .maybeSingle();

    if (error) {
      console.error(
        `[${requestId}] Lottery ID lookup error:`,
        error,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_DATABASE_READ_FAILED",
          error:
            "Unable to load the lottery.",
          request_id:
            requestId,
          details: {
            database_code:
              error.code ?? null,
            database_message:
              error.message ?? null,
            database_hint:
              error.hint ?? null,
          },
        },
        500,
      );
    }

    if (!lottery) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NOT_FOUND",
          error:
            "Lottery not found.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
          },
        },
        404,
      );
    }
    const tables = ["lottery_orders", "lottery_tickets", "lottery_prizes", "lottery_winners"] as const;
    const [orders, tickets, prizes, winners, paidOrders] = await Promise.all([
      ...tables.map((table) => db.from(table)
        .select("id", { count: "exact", head: true }).eq("lottery_id", id)
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))),
      db.from("lottery_orders").select("id", { count: "exact", head: true })
        .eq("lottery_id", id).eq("status", "paid")
        .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS)),
    ]);
    if ([orders, tickets, prizes, winners, paidOrders].some((result) =>
      result.error || result.count === null || result.count === undefined)) {
      console.error(`[${requestId}] Lottery summary failed`,
        [orders, tickets, prizes, winners, paidOrders].map((result) => result.error));
      return response({ ok: false, code: "LOTTERY_SUMMARY_UNAVAILABLE",
        error: "Unable to load complete lottery summary figures.", request_id: requestId }, 503);
    }
    return response({
      ok: true, request_id: requestId,
      item: { ...lottery, order_count: orders.count, ticket_count: tickets.count,
        prize_count: prizes.count, winner_count: winners.count,
        paid_order_count: paidOrders.count,
        revenue: null, refund_total: null,
      },
    });
  } catch (error) {
    console.error(
      `[${requestId}] Lottery GET API error:`,
      error,
    );

    return response(
      {
        ok: false,
        code:
          "LOTTERY_GET_UNEXPECTED_ERROR",
        error:
          "Unable to load the lottery.",
        request_id:
          requestId,
        details: {
          error_name:
            error instanceof Error
              ? error.name
              : "UnknownError",
          error_message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        },
      },
      500,
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
) {
  const requestId =
    createRequestId();

  try {
    const admin =
      await getVerifiedAdmin();

    if (!admin) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_AUTH_REQUIRED",
          error:
            "You must be signed in to update this lottery.",
          request_id:
            requestId,
        },
        401,
      );
    }

    /*
     * =====================================================
     * PERMISSION
     * =====================================================
     */
    if (
      !hasLotteryPermission(
        admin,
        "lottery:edit",
      )
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_PERMISSION_DENIED",
          error:
            "You do not have permission to update lottery records.",
          request_id:
            requestId,
        },
        403,
      );
    }

    if (!mutationOriginAllowed(request)) {
      return response({ ok: false, code: "LOTTERY_ORIGIN_DENIED",
        error: "The request origin is not allowed.", request_id: requestId }, 403);
    }

    /*
     * =====================================================
     * ID
     * =====================================================
     */
    const {
      id: rawId,
    } =
      await context.params;

    const id =
      rawId.trim();

    if (
      !id ||
      !isValidUuid(id)
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_INVALID_ID",
          error:
            "The lottery ID is invalid.",
          request_id:
            requestId,
          details: {
            received_id:
              id || null,
          },
        },
        400,
      );
    }

    /*
     * =====================================================
     * BODY
     * =====================================================
     */
    let body: Record<
      string,
      unknown
    >;

    try {
      body =
        await readObjectBody(request);
    } catch {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_INVALID_JSON_BODY",
          error:
            "The request body is not valid JSON.",
          request_id:
            requestId,
        },
        400,
      );
    }

    const allowedFields = new Set([
      "status", "is_active", "show_in_public_directory", "is_featured", "title",
      "short_summary", "description", "fundraising_purpose", "hero_image_url",
      "ticket_price", "ticket_price_pence", "currency", "max_tickets",
      "allow_page_before_sales", "show_ticket_count", "show_amount_raised",
      "show_remaining_tickets", "show_prize_values", "countdown_enabled",
      "geographic_eligibility", "terms_version", "privacy_notice_version",
      "responsible_gambling_info", "winner_display_mode", "publication_at",
      "sales_open_at", "sales_close_at", "draw_at", "results_publish_at",
    ]);
    const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
    if (unknownFields.length) return response({ ok: false, code: "LOTTERY_UNSUPPORTED_FIELDS",
      error: "The request contains unsupported lottery fields.", request_id: requestId }, 400);
    for (const field of ["is_active", "show_in_public_directory", "is_featured",
      "allow_page_before_sales", "show_ticket_count", "show_amount_raised",
      "show_remaining_tickets", "show_prize_values", "countdown_enabled"]) {
      if (body[field] !== undefined && typeof body[field] !== "boolean") {
        return response({ ok: false, code: "LOTTERY_INVALID_BOOLEAN",
          error: `${field} must be true or false.`, request_id: requestId }, 400);
      }
    }
    for (const field of ["title", "short_summary", "description", "fundraising_purpose",
      "hero_image_url", "currency"]) {
      if (body[field] !== undefined && body[field] !== null && typeof body[field] !== "string") {
        return response({ ok: false, code: "LOTTERY_INVALID_TEXT",
          error: `${field} must be text.`, request_id: requestId }, 400);
      }
      if (typeof body[field] === "string" && body[field].length > (field === "description" ? 20000 : 2000)) {
        return response({ ok: false, code: "LOTTERY_TEXT_TOO_LONG",
          error: `${field} is too long.`, request_id: requestId }, 400);
      }
    }
    if (body.title === null || body.currency === null) return response({ ok: false,
      code: "LOTTERY_REQUIRED_TEXT", error: "Title and currency cannot be null.", request_id: requestId }, 400);
    if (body.is_active === true || body.show_in_public_directory === true || body.publication_at != null) {
      return response({ ok: false, code: "LOTTERY_PUBLICATION_BLOCKED",
        error: "Publication requires the verified compliance and recent two-factor approval workflow.",
        request_id: requestId }, 409);
    }
    if (body.show_in_public_directory !== undefined && !hasLotteryPermission(admin, "lottery:publish")) {
      return response({ ok: false, code: "LOTTERY_PUBLISH_PERMISSION_REQUIRED",
        error: "You do not have permission to change public visibility.", request_id: requestId }, 403);
    }

    const db =
      getAuditServiceClient();

    /*
     * =====================================================
     * FIND CURRENT LOTTERY
     * =====================================================
     */
    const {
      data: existing,
      error:
        existingError,
    } = await db
      .from("lotteries")
      .select("*")
      .eq(
        "id",
        id,
      )
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .maybeSingle();

    if (existingError) {
      console.error(
        `[${requestId}] Lottery lookup before PATCH failed:`,
        existingError,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_LOOKUP_FAILED",
          error:
            "Unable to load the lottery before updating it.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
            database_code:
              existingError.code ??
              null,
            database_message:
              existingError.message ??
              null,
            database_hint:
              existingError.hint ??
              null,
          },
        },
        500,
      );
    }

    if (!existing) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NOT_FOUND",
          error:
            "Lottery not found.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
          },
        },
        404,
      );
    }

    if (!["draft", "compliance_review", "completed", "cancelled"].includes(existing.status) &&
        (body.is_active !== undefined || body.show_in_public_directory !== undefined || body.status !== undefined)) {
      return response({ ok: false, code: "LOTTERY_CONTROLLED_ACTION_REQUIRED",
        error: "Use the dedicated controlled workflow for this lottery state.", request_id: requestId }, 409);
    }
    if (["completed", "cancelled"].includes(existing.status) &&
        Object.keys(body).some((field) => field !== "status")) {
      return response({ ok: false, code: "LOTTERY_HISTORY_LOCKED",
        error: "Historic lottery records can only be archived through this route.", request_id: requestId }, 409);
    }
    const ordinaryFields = Object.keys(body).filter((field) =>
      !["status", "is_active", "show_in_public_directory"].includes(field));
    if (ordinaryFields.length && !["draft", "compliance_review"].includes(existing.status)) {
      return response({ ok: false, code: "LOTTERY_EDIT_LOCKED",
        error: "Lottery content and financial terms can only be edited before publication.",
        request_id: requestId }, 409);
    }
    if (ordinaryFields.length && existing.status === "compliance_review" && body.status !== "draft") {
      return response({ ok: false, code: "LOTTERY_REAPPROVAL_REQUIRED",
        error: "Return this lottery to draft before editing fields under compliance review.",
        request_id: requestId }, 409);
    }

    /*
     * =====================================================
     * BUILD UPDATE OBJECT
     * =====================================================
     */
    const update: Record<
      string,
      unknown
    > = {};

    /*
     * =====================================================
     * STATUS
     * =====================================================
     */
    const allowedTransitions: Record<LotteryStatus, readonly LotteryStatus[]> = {
      draft: ["compliance_review", "cancelled"],
      compliance_review: ["draft", "cancelled"],
      scheduled: [],
      live: [], sales_closed: [], draw_ready: [],
      completed: ["archived"], cancelled: ["archived"],
      archived: [], paused: [], under_review: [],
    };
    if (body.status !== undefined) {
      if (!isValidLotteryStatus(body.status)) {
        return response({ ok: false, code: "LOTTERY_INVALID_STATUS",
          error: "Select a valid lottery status.", request_id: requestId }, 400);
      }
      if (body.status !== existing.status) {
        const currentStatus = existing.status as LotteryStatus;
        if (!isValidLotteryStatus(currentStatus) ||
            !allowedTransitions[currentStatus].includes(body.status)) {
          return response({ ok: false, code: "LOTTERY_TRANSITION_BLOCKED",
            error: "This status change requires its dedicated controlled workflow.",
            request_id: requestId }, 409);
        }
        update.status = body.status;
        if (["archived", "cancelled", "compliance_review", "draft"].includes(body.status)) {
          update.is_active = false;
          update.show_in_public_directory = false;
        }
        if (body.status === "archived") update.archived_at = new Date().toISOString();
      }
    }
    if (
      body.is_active !==
      undefined
    ) {
      update.is_active =
        Boolean(
          body.is_active,
        );
    }

    /*
     * =====================================================
     * PUBLIC DIRECTORY
     * =====================================================
     */
    if (
      body.show_in_public_directory !==
      undefined
    ) {
      update.show_in_public_directory =
        Boolean(
          body.show_in_public_directory,
        );
    }

    /*
     * =====================================================
     * FEATURED
     * =====================================================
     */
    if (
      body.is_featured !==
      undefined
    ) {
      update.is_featured =
        Boolean(
          body.is_featured,
        );
    }

    /*
     * =====================================================
     * TITLE
     * =====================================================
     */
    if (
      body.title !==
      undefined
    ) {
      const title =
        String(
          body.title,
        ).trim();

      if (!title) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_TITLE_REQUIRED",
            error:
              "Lottery title cannot be empty.",
            request_id:
              requestId,
          },
          400,
        );
      }

      update.title =
        title;
    }

    /*
     * =====================================================
     * SHORT SUMMARY
     * =====================================================
     */
    if (
      body.short_summary !==
      undefined
    ) {
      const value =
        String(
          body.short_summary ??
            "",
        ).trim();

      update.short_summary =
        value || null;
    }

    /*
     * =====================================================
     * DESCRIPTION
     * =====================================================
     */
    if (
      body.description !==
      undefined
    ) {
      const value =
        String(
          body.description ??
            "",
        ).trim();

      update.description =
        value || null;
    }

    /*
     * =====================================================
     * FUNDRAISING PURPOSE
     * =====================================================
     */
    if (
      body.fundraising_purpose !==
      undefined
    ) {
      const value =
        String(
          body.fundraising_purpose ??
            "",
        ).trim();

      update.fundraising_purpose =
        value || null;
    }

    /*
     * =====================================================
     * HERO IMAGE
     * =====================================================
     */
    if (
      body.hero_image_url !==
      undefined
    ) {
      const value =
        String(
          body.hero_image_url ??
            "",
        ).trim();

      update.hero_image_url =
        value || null;
    }

    for (const field of ["ticket_price", "ticket_price_pence", "max_tickets"]) {
      const value = body[field];
      if (value === undefined || (field === "max_tickets" && (value === null || value === ""))) continue;
      if ((typeof value !== "number" && typeof value !== "string") ||
          (typeof value === "string" && !/^\d+(?:\.\d+)?$/.test(value)) || !Number.isFinite(Number(value))) {
        return response({ ok: false, code: "LOTTERY_INVALID_NUMBER",
          error: `${field} must be a valid number.`, request_id: requestId }, 400);
      }
    }
    if (body.ticket_price !== undefined) {
      const pence = Number(body.ticket_price) * 100;
      if (!Number.isSafeInteger(Math.round(pence)) || Math.abs(pence - Math.round(pence)) > 0.000001 || pence < 1) {
        return response({ ok: false, code: "LOTTERY_INVALID_PRICE_PRECISION",
          error: "Ticket price must be positive with no fractions of a penny.", request_id: requestId }, 400);
      }
    }
    if (body.currency !== undefined && String(body.currency).trim().toUpperCase() !== "GBP") {
      return response({ ok: false, code: "LOTTERY_INVALID_CURRENCY",
        error: "This lottery uses GBP.", request_id: requestId }, 400);
    }
    if (body.hero_image_url) {
      try {
        const url = new URL(String(body.hero_image_url));
        if (url.protocol !== "https:" || url.username || url.password) throw new Error("Invalid URL");
      } catch {
        return response({ ok: false, code: "LOTTERY_INVALID_IMAGE_URL",
          error: "The image must use a valid HTTPS URL.", request_id: requestId }, 400);
      }
    }

    /*
     * =====================================================
     * TICKET PRICE
     * =====================================================
     */
    if (
      body.ticket_price !==
      undefined
    ) {
      const price =
        Number(
          body.ticket_price,
        );

      if (
        !Number.isFinite(
          price,
        ) ||
        price <= 0
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_TICKET_PRICE",
            error:
              "Ticket price must be greater than £0.",
            request_id:
              requestId,
            details: {
              supplied_value:
                body.ticket_price,
            },
          },
          400,
        );
      }

      update.ticket_price =
        price;

      /*
       * Keep public pence field in sync.
       */
      update.ticket_price_pence =
        Math.round(
          price * 100,
        );
    }

    /*
     * =====================================================
     * DIRECT PENCE UPDATE
     * =====================================================
     */
    if (
      body.ticket_price_pence !==
      undefined
    ) {
      const pence =
        Number(
          body.ticket_price_pence,
        );

      if (
        !Number.isSafeInteger(pence) ||
        pence <= 0
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_TICKET_PRICE_PENCE",
            error:
              "Ticket price in pence is invalid.",
            request_id:
              requestId,
            details: {
              supplied_value:
                body.ticket_price_pence,
            },
          },
          400,
        );
      }

      if (body.ticket_price !== undefined && Math.round(Number(body.ticket_price) * 100) !== pence) {
        return response({ ok: false, code: "LOTTERY_PRICE_CONFLICT",
          error: "The pound and pence prices must match.", request_id: requestId }, 400);
      }
      const rounded = pence;

      update.ticket_price_pence =
        rounded;

      update.ticket_price =
        rounded / 100;
    }

    /*
     * =====================================================
     * CURRENCY
     * =====================================================
     */
    if (
      body.currency !==
      undefined
    ) {
      const currency =
        String(
          body.currency,
        )
          .trim()
          .toUpperCase();

      if (!currency) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_CURRENCY_REQUIRED",
            error:
              "Currency cannot be empty.",
            request_id:
              requestId,
          },
          400,
        );
      }

      update.currency =
        currency;
    }

    /*
     * =====================================================
     * MAX TICKETS
     * =====================================================
     */
    if (
      body.max_tickets !==
      undefined
    ) {
      if (
        body.max_tickets ===
          null ||
        body.max_tickets ===
          ""
      ) {
        update.max_tickets =
          null;
      } else {
        const maxTickets =
          Number(
            body.max_tickets,
          );

        if (
          !Number.isSafeInteger(maxTickets) ||
          maxTickets <= 0
        ) {
          return response(
            {
              ok: false,
              code:
                "LOTTERY_INVALID_MAX_TICKETS",
              error:
                "Maximum tickets must be a positive whole number.",
              request_id:
                requestId,
              details: {
                supplied_value:
                  body.max_tickets,
              },
            },
            400,
          );
        }

        update.max_tickets =
          maxTickets;
      }
    }

    /*
     * =====================================================
     * BOOLEAN PUBLIC SETTINGS
     * =====================================================
     */
    const booleanFields = [
      "allow_page_before_sales",
      "show_ticket_count",
      "show_amount_raised",
      "show_remaining_tickets",
      "show_prize_values",
      "countdown_enabled",
    ] as const;

    for (
      const field of
        booleanFields
    ) {
      if (
        body[field] !==
        undefined
      ) {
        update[field] =
          Boolean(
            body[field],
          );
      }
    }

    /*
     * Eligibility and legal text fields on the lottery edit page.
     * A blank value clears the field; an omitted field is left unchanged.
     */
    const optionalTextFields = [
      "geographic_eligibility",
      "terms_version",
      "privacy_notice_version",
      "responsible_gambling_info",
    ] as const;

    for (const field of optionalTextFields) {
      if (body[field] === undefined) continue;
      if (body[field] !== null && typeof body[field] !== "string") {
        return response(
          {
            ok: false,
            code: "LOTTERY_INVALID_TEXT_FIELD",
            error: `${field} must be text or null.`,
            request_id: requestId,
            details: { field },
          },
          400,
        );
      }
      update[field] = (body[field] as string | null)?.trim() || null;
    }

    if (body.winner_display_mode !== undefined) {
      const mode = body.winner_display_mode;
      if (
        mode !== "full_name" &&
        mode !== "first_name" &&
        mode !== "ticket_number" &&
        mode !== "none"
      ) {
        return response(
          {
            ok: false,
            code: "LOTTERY_INVALID_WINNER_DISPLAY_MODE",
            error: "Select a valid winner display mode.",
            request_id: requestId,
          },
          400,
        );
      }
      update.winner_display_mode = mode;
    }

    /*
     * =====================================================
     * DATE FIELDS
     * =====================================================
     */
    const dateFields = [
      "publication_at",
      "sales_open_at",
      "sales_close_at",
      "draw_at",
      "results_publish_at",
    ] as const;

    for (
      const field of
        dateFields
    ) {
      if (
        body[field] ===
        undefined
      ) {
        continue;
      }

      if (
        body[field] ===
          null ||
        body[field] ===
          ""
      ) {
        update[field] =
          null;

        continue;
      }

      if (typeof body[field] !== "string" ||
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(body[field] as string)) {
        return response({ ok: false, code: "LOTTERY_INVALID_DATE",
          error: `${field} must include a date, time and timezone.`, request_id: requestId }, 400);
      }
      const parsedDate =
        new Date(
          String(
            body[field],
          ),
        );

      const [year, month, day] = String(body[field]).slice(0, 10).split("-").map(Number);
      const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
      if (Number.isNaN(parsedDate.getTime()) || month < 1 || month > 12 || day < 1 || day > lastDay) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_DATE",
            error: `${field} is not a valid date.`,
            request_id:
              requestId,
            details: {
              field,
              supplied_value:
                body[field],
            },
          },
          400,
        );
      }

      update[field] =
        parsedDate
          .toISOString();
    }

    /*
     * =====================================================
     * VALIDATE DATE ORDER
     * =====================================================
     */
    const finalOpen =
      update.sales_open_at !==
      undefined
        ? update.sales_open_at
        : existing.sales_open_at;

    const finalClose =
      update.sales_close_at !==
      undefined
        ? update.sales_close_at
        : existing.sales_close_at;

    const finalDraw =
      update.draw_at !==
      undefined
        ? update.draw_at
        : existing.draw_at;

    if (
      finalOpen &&
      finalClose
    ) {
      const openTime =
        new Date(
          String(finalOpen),
        ).getTime();

      const closeTime =
        new Date(
          String(finalClose),
        ).getTime();

      if (
        closeTime <=
        openTime
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_SALES_DATE_ORDER",
            error:
              "Sales closing time must be after the sales opening time.",
            request_id:
              requestId,
            details: {
              sales_open_at:
                finalOpen,
              sales_close_at:
                finalClose,
            },
          },
          422,
        );
      }
    }

    if (
      finalClose &&
      finalDraw
    ) {
      const closeTime =
        new Date(
          String(finalClose),
        ).getTime();

      const drawTime =
        new Date(
          String(finalDraw),
        ).getTime();

      if (
        drawTime <
        closeTime
      ) {
        return response(
          {
            ok: false,
            code:
              "LOTTERY_INVALID_DRAW_DATE",
            error:
              "The draw must take place on or after ticket sales close.",
            request_id:
              requestId,
            details: {
              sales_close_at:
                finalClose,
              draw_at:
                finalDraw,
            },
          },
          422,
        );
      }
    }

    const finalResults = update.results_publish_at !== undefined ? update.results_publish_at : existing.results_publish_at;
    if (finalResults && finalDraw && new Date(String(finalResults)).getTime() < new Date(String(finalDraw)).getTime()) {
      return response({ ok: false, code: "LOTTERY_INVALID_RESULTS_DATE",
        error: "Results publication cannot be before the draw.", request_id: requestId }, 422);
    }
    if (update.status === "archived" || update.status === "cancelled") {
      update.is_active = false;
      update.show_in_public_directory = false;
    }
    for (const field of Object.keys(update)) {
      if (update[field] === existing[field]) delete update[field];
    }
    /*
     * =====================================================
     * NOTHING TO UPDATE
     * =====================================================
     */
    if (
      Object.keys(
        update,
      ).length === 0
    ) {
      return response(
        {
          ok: false,
          code:
            "LOTTERY_NO_CHANGES",
          error:
            "No valid lottery changes were provided.",
          request_id:
            requestId,
        },
        400,
      );
    }

    if (typeof existing.updated_at !== "string") {
      return response({ ok: false, code: "LOTTERY_VERSION_UNAVAILABLE",
        error: "The lottery version could not be verified. No changes were made.", request_id: requestId }, 409);
    }
    update.updated_at =
      new Date()
        .toISOString();

    /*
     * =====================================================
     * DATABASE UPDATE
     * =====================================================
     */
    const {
      data: updated,
      error:
        updateError,
    } = await db
      .from("lotteries")
      .update(update)
      .eq(
        "id",
        id,
      )
      .eq("updated_at", existing.updated_at)
      .eq("status", existing.status)
      .select("*")
      .abortSignal(AbortSignal.timeout(QUERY_TIMEOUT_MS))
      .maybeSingle();

    if (updateError) {
      console.error(
        `[${requestId}] Lottery PATCH database error:`,
        updateError,
      );

      return response(
        {
          ok: false,
          code:
            "LOTTERY_DATABASE_UPDATE_FAILED",
          error:
            "The lottery could not be updated in the database.",
          request_id:
            requestId,
          details: {
            lottery_id:
              id,
            current_status:
              existing.status,
            requested_status:
              body.status ??
              null,

            database_code:
              updateError.code ??
              null,

            database_message:
              updateError.message ??
              null,

            database_details:
              updateError.details ??
              null,

            database_hint:
              updateError.hint ??
              null,
          },
        },
        500,
      );
    }

    if (!updated) {
      return response({ ok: false, code: "LOTTERY_CONCURRENT_CHANGE",
        error: "The lottery changed during your save. Reload it before trying again.", request_id: requestId }, 409);
    }
    // Ordinary edits retain the existing audit helper. Atomic audit + mutation
    // still requires the actual database transaction/RPC; do not claim otherwise.
    /*
     * =====================================================
     * AUDIT
     * =====================================================
     */
    const oldStatus =
      existing.status;

    const newStatus =
      updated.status;

    const statusChanged =
      oldStatus !==
      newStatus;

    await writeLotteryAuditSafe({
      admin,

      actionCode:
        statusChanged
          ? `lottery.status.${newStatus}`
          : "lottery.updated",

      actionLabel:
        statusChanged
          ? `Lottery status changed to ${newStatus}`
          : "Lottery updated",

      actionGroup:
        statusChanged
          ? "lottery"
          : "lottery",

      riskLevel:
        newStatus === "live"
          ? "high"
          : "medium",

      entityType:
        "lottery",

      entityId:
        updated.id,

      reason:
        statusChanged
          ? `Lottery "${updated.title}" changed from ${oldStatus} to ${newStatus}.`
          : `Lottery "${updated.title}" was updated.`,
    });

    /*
     * =====================================================
     * SUCCESS MESSAGE
     * =====================================================
     */
    let message =
      "Lottery updated successfully.";

    if (
      statusChanged &&
      newStatus ===
        "live"
    ) {
      message =
        "Lottery is now live.";
    }

    if (
      statusChanged &&
      newStatus ===
        "archived"
    ) {
      message =
        "Lottery archived successfully.";
    }

    if (
      statusChanged &&
      newStatus ===
        "paused"
    ) {
      message =
        "Lottery has been paused.";
    }

    if (
      statusChanged &&
      newStatus ===
        "sales_closed"
    ) {
      message =
        "Lottery ticket sales are now closed.";
    }

    return response({
      ok: true,

      request_id:
        requestId,

      message,

      item:
        updated,

      changes: {
        previous_status:
          oldStatus,

        current_status:
          newStatus,
      },
    });
  } catch (error) {
    console.error(
      `[${requestId}] Lottery PATCH API error:`,
      error,
    );

    return response(
      {
        ok: false,

        code:
          "LOTTERY_PATCH_UNEXPECTED_ERROR",

        error:
          "An unexpected error occurred while updating the lottery.",

        request_id:
          requestId,

        details: safeDetails({
          error_name:
            error instanceof Error
              ? error.name
              : "UnknownError",

          error_message:
            error instanceof Error
              ? error.message
              : "Unknown error",
        }),
      },
      500,
    );
  }
}
export async function DELETE(request: NextRequest, _context: RouteContext) {
  const requestId = createRequestId();
  try {
    const admin = await getVerifiedAdmin();
    if (!admin) return response({ ok: false, code: "LOTTERY_AUTH_REQUIRED",
      error: "A verified main administrator session is required.", request_id: requestId }, 401);
    if (!mutationOriginAllowed(request)) return response({ ok: false,
      code: "LOTTERY_ORIGIN_DENIED", error: "The request origin is not allowed.", request_id: requestId }, 403);
    return response({ ok: false, code: "LOTTERY_DELETE_WORKFLOW_UNAVAILABLE",
      error: "Permanent deletion is unavailable until the secure deletion workflow is configured.",
      request_id: requestId }, 503);
  } catch (error) {
    console.error(`[${requestId}] Lottery DELETE API error:`, error);
    return response({ ok: false, code: "LOTTERY_DELETE_UNEXPECTED_ERROR",
      error: "Unable to process lottery deletion.", request_id: requestId }, 500);
  }
}
