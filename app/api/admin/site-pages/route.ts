import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(value: unknown) {
  return String(value || "").trim();
}

function cleanNullable(value: unknown) {
  const v = String(value || "").trim();
  return v ? v : null;
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

function cleanNumber(value: unknown, fallback = 999) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanStatus(value: unknown) {
  const v = String(value || "").trim().toLowerCase();

  if (v === "live" || v === "hidden" || v === "coming_soon") {
    return v;
  }

  return "live";
}

async function requireSitePagesAccess() {
  /*
    New permissions system:
    - Main admins automatically pass this check.
    - Other admins must have site_pages:manage enabled in Admin Users.
    - This replaces the old hardcoded email-only admin check.
  */
  await requireAdminPermission("site_pages:manage");
}

const selectFields = `
  id,
  title,
  route,
  page_key,
  status,
  is_enabled,
  show_in_nav,
  nav_label,
  template,
  sort_order,
  hidden_title,
  hidden_message,
  coming_soon_title,
  coming_soon_message,
  locked_title,
  locked_message,
  password_protected,
  created_at,
  updated_at
`;

export async function GET() {
  try {
    await requireSitePagesAccess();

    const { data, error } = await supabaseAdmin
      .from("site_pages")
      .select(selectFields)
      .order("sort_order", { ascending: true })
      .order("title", { ascending: true });

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to load site pages",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      pages: data || [],
    });
  } catch (error: any) {
    console.error("GET /api/admin/site-pages error:", error);

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

export async function PATCH(req: Request) {
  try {
    await requireSitePagesAccess();

    const body = await req.json().catch(() => ({}));
    const id = clean(body?.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Page id is required",
        },
        { status: 400 }
      );
    }

    const passwordProtected = cleanBoolean(body?.password_protected, false);
    const rawPassword = clean(body?.page_password);

    let pagePasswordHash: string | null | undefined = undefined;

    if (passwordProtected) {
      if (rawPassword) {
        pagePasswordHash = await bcrypt.hash(rawPassword, 12);
      }
    } else {
      pagePasswordHash = null;
    }

    const updates: Record<string, unknown> = {
      title: clean(body?.title),
      status: cleanStatus(body?.status),
      is_enabled: cleanBoolean(body?.is_enabled, true),
      show_in_nav: cleanBoolean(body?.show_in_nav, false),
      nav_label: cleanNullable(body?.nav_label),
      template: cleanNullable(body?.template),
      sort_order: cleanNumber(body?.sort_order, 999),
      hidden_title: cleanNullable(body?.hidden_title),
      hidden_message: cleanNullable(body?.hidden_message),
      coming_soon_title: cleanNullable(body?.coming_soon_title),
      coming_soon_message: cleanNullable(body?.coming_soon_message),
      locked_title: cleanNullable(body?.locked_title),
      locked_message: cleanNullable(body?.locked_message),
      password_protected: passwordProtected,
      updated_at: new Date().toISOString(),
    };

    if (pagePasswordHash !== undefined) {
      updates.page_password_hash = pagePasswordHash;
    }

    const { data, error } = await supabaseAdmin
      .from("site_pages")
      .update(updates)
      .eq("id", id)
      .select(selectFields)
      .single();

    if (error) {
      return NextResponse.json(
        {
          ok: false,
          error: error.message || "Failed to update page",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      page: data,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/site-pages error:", error);

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
