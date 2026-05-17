import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function clean(value: unknown) {
  return String(value || "").trim();
}

function normalizeHref(value: unknown) {
  const href = clean(value);

  if (!href) return "";

  if (
    href.startsWith("/") ||
    href.startsWith("http://") ||
    href.startsWith("https://") ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return href;
  }

  return `/${href}`;
}

function cleanBoolean(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const lowered = value.toLowerCase().trim();

    if (lowered === "true") return true;
    if (lowered === "false") return false;
  }

  return fallback;
}

function cleanNumber(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanIcon(value: unknown) {
  const icon = clean(value);
  return icon || "Mail";
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - Editing email sidebar links affects admin portal navigation.
    */
    await requireAdminPermission("site_pages:manage");

    const { id } = await context.params;
    const cleanId = String(id || "").trim();

    if (!cleanId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing email sidebar item ID.",
        },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const label = clean(body.label);
    const href = normalizeHref(body.href);
    const icon = cleanIcon(body.icon);
    const sortOrder = cleanNumber(body.sort_order, 0);
    const isEnabled = cleanBoolean(body.is_enabled, true);

    if (!label) {
      return NextResponse.json(
        {
          ok: false,
          error: "Label is required.",
        },
        { status: 400 }
      );
    }

    if (!href) {
      return NextResponse.json(
        {
          ok: false,
          error: "URL / href is required.",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_email_sidebar")
      .update({
        label,
        href,
        icon,
        sort_order: sortOrder,
        is_enabled: isEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", cleanId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update email sidebar item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/email-sidebar/[id] error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Forbidden",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    /*
      New permissions system:
      - Main admins automatically pass this check.
      - Other admins must have site_pages:manage enabled in Admin Users.
      - Deleting email sidebar links affects admin portal navigation.
    */
    await requireAdminPermission("site_pages:manage");

    const { id } = await context.params;
    const cleanId = String(id || "").trim();

    if (!cleanId) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing email sidebar item ID.",
        },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("admin_email_sidebar")
      .delete()
      .eq("id", cleanId);

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to delete email sidebar item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    console.error("DELETE /api/admin/email-sidebar/[id] error:", error);

    return NextResponse.json(
      {
        ok: false,
        error:
          error?.message === "Unauthorized"
            ? "Unauthorized"
            : error?.message || "Forbidden",
      },
      { status: error?.message === "Unauthorized" ? 401 : 403 }
    );
  }
}
