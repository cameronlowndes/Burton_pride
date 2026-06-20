import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { requireAdminPermission } from "@/lib/adminPermissions";
import bcrypt from "bcryptjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SitePageStatus = "live" | "hidden" | "coming_soon";

type SitePageUpdateBody = {
  id?: unknown;
  title?: unknown;
  status?: unknown;
  is_enabled?: unknown;
  show_in_nav?: unknown;
  nav_label?: unknown;
  template?: unknown;
  sort_order?: unknown;
  hidden_title?: unknown;
  hidden_message?: unknown;
  coming_soon_title?: unknown;
  coming_soon_message?: unknown;
  locked_title?: unknown;
  locked_message?: unknown;
  password_protected?: unknown;
  page_password?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function cleanNullable(value: unknown) {
  const v = String(value ?? "").trim();
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

function cleanStatus(value: unknown): SitePageStatus {
  const v = String(value ?? "").trim().toLowerCase();

  if (v === "live" || v === "hidden" || v === "coming_soon") {
    return v;
  }

  return "live";
}

async function requireSitePagesAccess() {
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

function getErrorStatus(error: unknown) {
  if (error instanceof Error && error.message === "Unauthorized") {
    return 401;
  }

  return 403;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message === "Unauthorized" ? "Unauthorized" : error.message;
  }

  return "Forbidden";
}

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
  } catch (error) {
    console.error("GET /api/admin/settings/site-pages error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: getErrorStatus(error) }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    await requireSitePagesAccess();

    const body = (await req.json().catch(() => ({}))) as SitePageUpdateBody;
    const id = clean(body.id);

    if (!id) {
      return NextResponse.json(
        {
          ok: false,
          error: "Page id is required",
        },
        { status: 400 }
      );
    }

    const passwordProtected = cleanBoolean(body.password_protected, false);
    const rawPassword = clean(body.page_password);

    let pagePasswordHash: string | null | undefined;

    if (passwordProtected) {
      if (rawPassword) {
        pagePasswordHash = await bcrypt.hash(rawPassword, 12);
      }
    } else {
      pagePasswordHash = null;
    }

    const updates: Record<string, unknown> = {
      title: clean(body.title),
      status: cleanStatus(body.status),
      is_enabled: cleanBoolean(body.is_enabled, true),
      show_in_nav: cleanBoolean(body.show_in_nav, false),
      nav_label: cleanNullable(body.nav_label),
      template: cleanNullable(body.template),
      sort_order: cleanNumber(body.sort_order, 999),
      hidden_title: cleanNullable(body.hidden_title),
      hidden_message: cleanNullable(body.hidden_message),
      coming_soon_title: cleanNullable(body.coming_soon_title),
      coming_soon_message: cleanNullable(body.coming_soon_message),
      locked_title: cleanNullable(body.locked_title),
      locked_message: cleanNullable(body.locked_message),
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
  } catch (error) {
    console.error("PATCH /api/admin/settings/site-pages error:", error);

    return NextResponse.json(
      {
        ok: false,
        error: getErrorMessage(error),
      },
      { status: getErrorStatus(error) }
    );
  }
}