import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdmin, requireAdminPermission } from "@/lib/adminPermissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

/**
 * GET email sidebar items.
 *
 * Any active admin can load the email sidebar list.
 * Changes are protected separately by site_pages:manage.
 */
export async function GET() {
  try {
    await requireAdmin();

    const { data, error } = await supabaseAdmin
      .from("admin_email_sidebar")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load email sidebar items.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      items: data || [],
    });
  } catch (error: any) {
    console.error("GET /api/admin/email-sidebar error:", error);

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

/**
 * CREATE email sidebar item.
 *
 * Main admins pass automatically.
 * Other admins need Manage Site Pages permission.
 */
export async function POST(req: Request) {
  try {
    await requireAdminPermission("site_pages:manage");

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
      .insert({
        label,
        href,
        icon,
        sort_order: sortOrder,
        is_enabled: isEnabled,
      })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to create email sidebar item.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    console.error("POST /api/admin/email-sidebar error:", error);

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
