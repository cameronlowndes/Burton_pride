import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME = "/api/admin/money-sidebar";
const TABLE_NAME = "money_sidebar_items";
const SELECT_COLUMNS = "id, label, href, icon, sort_order, is_enabled";

type SidebarPayload = {
  id?: string;
  label?: string;
  href?: string;
  icon?: string;
  sort_order?: number | string;
  is_enabled?: boolean;
};

function isDevelopment() {
  return process.env.NODE_ENV !== "production";
}

function errorToMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown error";
  }
}

function errorToStack(error: unknown) {
  if (!isDevelopment()) return undefined;
  if (error instanceof Error) return error.stack;
  return undefined;
}

function buildDebugResponse(args: {
  method: string;
  status: number;
  error: unknown;
  operation?: string;
  query?: string;
  payload?: unknown;
  extra?: Record<string, unknown>;
}) {
  const { method, status, error, operation, query, payload, extra } = args;

  const message = errorToMessage(error);

  return NextResponse.json(
    {
      ok: false,
      error: message,
      message,
      route: ROUTE_NAME,
      method,
      status,
      table: TABLE_NAME,
      operation,
      query,
      payload: isDevelopment() ? payload : undefined,
      stack: errorToStack(error),
      details: isDevelopment() ? error : undefined,
      likelyFixes: [
        `Check this API file: app/api/admin/money-sidebar/route.ts`,
        `Check Supabase table exists: ${TABLE_NAME}`,
        `Check these columns exist: ${SELECT_COLUMNS}`,
        "Check Supabase service role key is set correctly.",
        "Check the route no longer imports Clerk.",
        "Check Vercel or terminal logs for the full server error.",
      ],
      ...extra,
    },
    { status }
  );
}

function normalisePayload(body: SidebarPayload) {
  const sortOrder =
    typeof body.sort_order === "number"
      ? body.sort_order
      : body.sort_order !== undefined
        ? Number(body.sort_order)
        : undefined;

  return {
    label: typeof body.label === "string" ? body.label.trim() : undefined,
    href: typeof body.href === "string" ? body.href.trim() : undefined,
    icon: typeof body.icon === "string" ? body.icon.trim() : undefined,
    sort_order: Number.isFinite(sortOrder) ? sortOrder : undefined,
    is_enabled:
      typeof body.is_enabled === "boolean" ? body.is_enabled : undefined,
  };
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .order("sort_order", { ascending: true });

    if (error) {
      return buildDebugResponse({
        method: "GET",
        status: 500,
        error: new Error(
          `Supabase GET failed. Table=${TABLE_NAME}. Message=${error.message}`
        ),
        operation: "select sidebar items",
        query: `from(${TABLE_NAME}).select(${SELECT_COLUMNS}).order(sort_order)`,
        extra: {
          supabaseError: error,
          supabaseCode: error.code,
          supabaseHint: error.hint,
          supabaseDetails: error.details,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      route: ROUTE_NAME,
      table: TABLE_NAME,
      count: data?.length ?? 0,
      items: data ?? [],
    });
  } catch (error) {
    return buildDebugResponse({
      method: "GET",
      status: 500,
      error,
      operation: "unexpected GET crash",
    });
  }
}

export async function POST(req: NextRequest) {
  let body: SidebarPayload | null = null;

  try {
    try {
      body = (await req.json()) as SidebarPayload;
    } catch (error) {
      return buildDebugResponse({
        method: "POST",
        status: 400,
        error: "Invalid JSON body.",
        operation: "parse request body",
        extra: {
          parseError: errorToMessage(error),
        },
      });
    }

    const payload = normalisePayload(body);

    if (!payload.label) {
      return buildDebugResponse({
        method: "POST",
        status: 400,
        error: "Label is required.",
        operation: "validate payload",
        payload,
      });
    }

    if (!payload.href) {
      return buildDebugResponse({
        method: "POST",
        status: 400,
        error: "Href is required.",
        operation: "validate payload",
        payload,
      });
    }

    const insertData = {
      label: payload.label,
      href: payload.href,
      icon: payload.icon || "Wallet",
      sort_order: payload.sort_order ?? 0,
      is_enabled: payload.is_enabled ?? true,
    };

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .insert(insertData)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return buildDebugResponse({
        method: "POST",
        status: 500,
        error: new Error(
          `Supabase POST failed. Table=${TABLE_NAME}. Message=${error.message}`
        ),
        operation: "insert sidebar item",
        query: `from(${TABLE_NAME}).insert(...).select(${SELECT_COLUMNS}).single()`,
        payload: insertData,
        extra: {
          supabaseError: error,
          supabaseCode: error.code,
          supabaseHint: error.hint,
          supabaseDetails: error.details,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      route: ROUTE_NAME,
      table: TABLE_NAME,
      item: data,
    });
  } catch (error) {
    return buildDebugResponse({
      method: "POST",
      status: 500,
      error,
      operation: "unexpected POST crash",
      payload: body,
    });
  }
}

export async function PATCH(req: NextRequest) {
  let body: SidebarPayload | null = null;

  try {
    try {
      body = (await req.json()) as SidebarPayload;
    } catch (error) {
      return buildDebugResponse({
        method: "PATCH",
        status: 400,
        error: "Invalid JSON body.",
        operation: "parse request body",
        extra: {
          parseError: errorToMessage(error),
        },
      });
    }

    const id = typeof body.id === "string" ? body.id.trim() : "";

    if (!id) {
      return buildDebugResponse({
        method: "PATCH",
        status: 400,
        error: "Item id is required.",
        operation: "validate id",
        payload: body,
      });
    }

    const payload = normalisePayload(body);
    const updates: Record<string, unknown> = {};

    if (payload.label !== undefined) updates.label = payload.label;
    if (payload.href !== undefined) updates.href = payload.href;
    if (payload.icon !== undefined) updates.icon = payload.icon;
    if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;
    if (payload.is_enabled !== undefined) {
      updates.is_enabled = payload.is_enabled;
    }

    if (Object.keys(updates).length === 0) {
      return buildDebugResponse({
        method: "PATCH",
        status: 400,
        error: "No updates provided.",
        operation: "validate updates",
        payload: body,
      });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return buildDebugResponse({
        method: "PATCH",
        status: 500,
        error: new Error(
          `Supabase PATCH failed. Table=${TABLE_NAME}. ItemId=${id}. Message=${error.message}`
        ),
        operation: "update sidebar item",
        query: `from(${TABLE_NAME}).update(...).eq(id, ${id}).select(${SELECT_COLUMNS}).single()`,
        payload: updates,
        extra: {
          itemId: id,
          supabaseError: error,
          supabaseCode: error.code,
          supabaseHint: error.hint,
          supabaseDetails: error.details,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      route: ROUTE_NAME,
      table: TABLE_NAME,
      item: data,
    });
  } catch (error) {
    return buildDebugResponse({
      method: "PATCH",
      status: 500,
      error,
      operation: "unexpected PATCH crash",
      payload: body,
    });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return buildDebugResponse({
        method: "DELETE",
        status: 400,
        error: "Item id is required.",
        operation: "validate id",
        extra: {
          expectedUrl: `${ROUTE_NAME}?id=SIDEBAR_ITEM_ID`,
        },
      });
    }

    const { error } = await supabaseAdmin
      .from(TABLE_NAME)
      .delete()
      .eq("id", id);

    if (error) {
      return buildDebugResponse({
        method: "DELETE",
        status: 500,
        error: new Error(
          `Supabase DELETE failed. Table=${TABLE_NAME}. ItemId=${id}. Message=${error.message}`
        ),
        operation: "delete sidebar item",
        query: `from(${TABLE_NAME}).delete().eq(id, ${id})`,
        extra: {
          itemId: id,
          supabaseError: error,
          supabaseCode: error.code,
          supabaseHint: error.hint,
          supabaseDetails: error.details,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      route: ROUTE_NAME,
      table: TABLE_NAME,
      deletedId: id,
    });
  } catch (error) {
    return buildDebugResponse({
      method: "DELETE",
      status: 500,
      error,
      operation: "unexpected DELETE crash",
    });
  }
}