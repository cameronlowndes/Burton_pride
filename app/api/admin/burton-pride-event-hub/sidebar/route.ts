import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE_NAME = "burton_pride_event_hub_sidebar_items";

type CurrentAdmin = Awaited<ReturnType<typeof getCurrentAdmin>>;

type CurrentAdminWithPermissions = NonNullable<CurrentAdmin> & {
  permissions?: string[] | Record<string, boolean> | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function makeId(label: string) {
  const base = label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base || "event-hub-link"}-${Date.now()}`;
}

function getAdminPermissions(admin: CurrentAdmin): string[] {
  if (!admin) return [];

  const adminWithPermissions = admin as CurrentAdminWithPermissions;
  const permissions = adminWithPermissions.permissions;

  if (Array.isArray(permissions)) {
    return permissions;
  }

  if (permissions && typeof permissions === "object") {
    return Object.entries(permissions)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key);
  }

  return [];
}

function hasEventHubViewAccess(admin: CurrentAdmin) {
  if (!admin) return false;
  if (!admin.is_active) return false;
  if (admin.role === "main_admin") return true;

  const permissions = getAdminPermissions(admin);

  return (
    permissions.includes("event_hub:view") ||
    permissions.includes("event_hub:manage") ||
    permissions.includes("money:view") ||
    permissions.includes("admin:dashboard:view")
  );
}

function hasEventHubManageAccess(admin: CurrentAdmin) {
  if (!admin) return false;
  if (!admin.is_active) return false;
  if (admin.role === "main_admin") return true;

  const permissions = getAdminPermissions(admin);

  return (
    permissions.includes("event_hub:manage") ||
    permissions.includes("admin:users:manage")
  );
}

function errorResponse({
  status,
  code,
  error,
  hint,
  details,
  technicalDetails,
}: {
  status: number;
  code: string;
  error: string;
  hint?: string;
  details?: unknown;
  technicalDetails?: unknown;
}) {
  return NextResponse.json(
    {
      ok: false,
      code,
      error,
      hint,
      details,
      technicalDetails:
        process.env.NODE_ENV === "development" ? technicalDetails : undefined,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

async function requireViewAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      ok: false as const,
      response: errorResponse({
        status: 401,
        code: "EVENT_HUB_SIDEBAR_NOT_LOGGED_IN",
        error: "You must be signed in to view the Burton Pride Event Hub sidebar.",
        hint: "Log into the Admin Portal again, then refresh the Event Hub page.",
      }),
    };
  }

  if (!hasEventHubViewAccess(admin)) {
    return {
      ok: false as const,
      response: errorResponse({
        status: 403,
        code: "EVENT_HUB_SIDEBAR_NO_VIEW_PERMISSION",
        error:
          "You do not have permission to view the Burton Pride Event Hub sidebar.",
        hint:
          "Add event_hub:view, event_hub:manage, money:view, admin:dashboard:view, or set the role to main_admin.",
        details: {
          email: admin.email,
          role: admin.role,
          is_active: admin.is_active,
        },
      }),
    };
  }

  return { ok: true as const, admin };
}

async function requireManageAdmin() {
  const admin = await getCurrentAdmin();

  if (!admin) {
    return {
      ok: false as const,
      response: errorResponse({
        status: 401,
        code: "EVENT_HUB_SIDEBAR_NOT_LOGGED_IN",
        error:
          "You must be signed in to manage the Burton Pride Event Hub sidebar.",
        hint: "Log into the Admin Portal again, then refresh the page.",
      }),
    };
  }

  if (!hasEventHubManageAccess(admin)) {
    return {
      ok: false as const,
      response: errorResponse({
        status: 403,
        code: "EVENT_HUB_SIDEBAR_NO_MANAGE_PERMISSION",
        error:
          "You do not have permission to manage the Burton Pride Event Hub sidebar.",
        hint:
          "Add event_hub:manage, admin:users:manage, or set the role to main_admin.",
        details: {
          email: admin.email,
          role: admin.role,
          is_active: admin.is_active,
        },
      }),
    };
  }

  return { ok: true as const, admin };
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const SELECT_COLUMNS =
  "id, label, href, icon, is_enabled, sort_order, created_at, updated_at";

export async function GET() {
  try {
    const auth = await requireViewAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .select(SELECT_COLUMNS)
      .order("sort_order", { ascending: true });

    if (error) {
      return errorResponse({
        status: 500,
        code: "EVENT_HUB_SIDEBAR_DATABASE_ERROR",
        error:
          "The Event Hub sidebar API connected, but Supabase could not load the sidebar items.",
        hint: `Check the table name is public.${TABLE_NAME}.`,
        details: error.message,
        technicalDetails: error,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        source: "database",
        api: "/api/admin/burton-pride-event-hub/sidebar",
        table: TABLE_NAME,
        count: Array.isArray(data) ? data.length : 0,
        items: Array.isArray(data) ? data : [],
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Event Hub sidebar GET crashed:", error);

    return errorResponse({
      status: 500,
      code: "EVENT_HUB_SIDEBAR_GET_CRASHED",
      error: "The Burton Pride Event Hub sidebar GET route crashed.",
      hint: "Check the Next.js terminal logs.",
      details: error instanceof Error ? error.message : String(error),
      technicalDetails: error,
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireManageAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const body = await readJsonBody(request);

    if (!body || typeof body !== "object") {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_INVALID_BODY",
        error: "Invalid request body.",
        hint: "Send JSON with label, href, icon, sort_order and is_enabled.",
      });
    }

    const label = clean((body as any).label);
    const href = clean((body as any).href);
    const icon = clean((body as any).icon) || "LayoutDashboard";
    const sortOrder = Number((body as any).sort_order ?? 0);
    const isEnabled = Boolean((body as any).is_enabled ?? true);
    const id = clean((body as any).id) || makeId(label);

    if (!label) {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_LABEL_REQUIRED",
        error: "Sidebar item label is required.",
      });
    }

    if (!href) {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_HREF_REQUIRED",
        error: "Sidebar item href is required.",
      });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .insert({
        id,
        label,
        href,
        icon,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : 0,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      })
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      return errorResponse({
        status: 500,
        code: "EVENT_HUB_SIDEBAR_CREATE_FAILED",
        error: "Failed to create the Event Hub sidebar item.",
        hint:
          "Check for duplicate id values and check the database table columns.",
        details: error.message,
        technicalDetails: error,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Sidebar item created.",
        item: data,
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Event Hub sidebar POST crashed:", error);

    return errorResponse({
      status: 500,
      code: "EVENT_HUB_SIDEBAR_POST_CRASHED",
      error: "The Burton Pride Event Hub sidebar POST route crashed.",
      hint: "Check the Next.js terminal logs.",
      details: error instanceof Error ? error.message : String(error),
      technicalDetails: error,
    });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireManageAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const id = clean(request.nextUrl.searchParams.get("id"));

    if (!id) {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_ID_REQUIRED",
        error: "Sidebar item id is required.",
        hint:
          "Call PATCH /api/admin/burton-pride-event-hub/sidebar?id=ITEM_ID",
      });
    }

    const body = await readJsonBody(request);

    if (!body || typeof body !== "object") {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_INVALID_BODY",
        error: "Invalid request body.",
      });
    }

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if ("label" in body) {
      const label = clean((body as any).label);

      if (!label) {
        return errorResponse({
          status: 400,
          code: "EVENT_HUB_SIDEBAR_LABEL_REQUIRED",
          error: "Sidebar item label cannot be empty.",
        });
      }

      updates.label = label;
    }

    if ("href" in body) {
      const href = clean((body as any).href);

      if (!href) {
        return errorResponse({
          status: 400,
          code: "EVENT_HUB_SIDEBAR_HREF_REQUIRED",
          error: "Sidebar item href cannot be empty.",
        });
      }

      updates.href = href;
    }

    if ("icon" in body) {
      updates.icon = clean((body as any).icon) || "LayoutDashboard";
    }

    if ("sort_order" in body) {
      const sortOrder = Number((body as any).sort_order ?? 0);
      updates.sort_order = Number.isFinite(sortOrder) ? sortOrder : 0;
    }

    if ("is_enabled" in body) {
      updates.is_enabled = Boolean((body as any).is_enabled);
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .update(updates)
      .eq("id", id)
      .select(SELECT_COLUMNS)
      .maybeSingle();

    if (error) {
      return errorResponse({
        status: 500,
        code: "EVENT_HUB_SIDEBAR_UPDATE_FAILED",
        error: "Failed to update the Event Hub sidebar item.",
        details: error.message,
        technicalDetails: error,
      });
    }

    if (!data) {
      return errorResponse({
        status: 404,
        code: "EVENT_HUB_SIDEBAR_ITEM_NOT_FOUND",
        error: "Sidebar item was not found.",
        hint: `No sidebar item exists with id: ${id}`,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Sidebar item updated.",
        item: data,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Event Hub sidebar PATCH crashed:", error);

    return errorResponse({
      status: 500,
      code: "EVENT_HUB_SIDEBAR_PATCH_CRASHED",
      error: "The Burton Pride Event Hub sidebar PATCH route crashed.",
      hint: "Check the Next.js terminal logs.",
      details: error instanceof Error ? error.message : String(error),
      technicalDetails: error,
    });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireManageAdmin();

    if (!auth.ok) {
      return auth.response;
    }

    const id = clean(request.nextUrl.searchParams.get("id"));

    if (!id) {
      return errorResponse({
        status: 400,
        code: "EVENT_HUB_SIDEBAR_ID_REQUIRED",
        error: "Sidebar item id is required.",
        hint:
          "Call DELETE /api/admin/burton-pride-event-hub/sidebar?id=ITEM_ID",
      });
    }

    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      return errorResponse({
        status: 500,
        code: "EVENT_HUB_SIDEBAR_DELETE_FAILED",
        error: "Failed to delete the Event Hub sidebar item.",
        details: error.message,
        technicalDetails: error,
      });
    }

    if (!data) {
      return errorResponse({
        status: 404,
        code: "EVENT_HUB_SIDEBAR_ITEM_NOT_FOUND",
        error: "Sidebar item was not found.",
        hint: `No sidebar item exists with id: ${id}`,
      });
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Sidebar item deleted.",
        deleted_id: id,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("Event Hub sidebar DELETE crashed:", error);

    return errorResponse({
      status: 500,
      code: "EVENT_HUB_SIDEBAR_DELETE_CRASHED",
      error: "The Burton Pride Event Hub sidebar DELETE route crashed.",
      hint: "Check the Next.js terminal logs.",
      details: error instanceof Error ? error.message : String(error),
      technicalDetails: error,
    });
  }
}