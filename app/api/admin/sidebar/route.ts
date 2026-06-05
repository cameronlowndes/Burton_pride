import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_ID_COOKIE = "burton_admin_id";
const ADMIN_EMAIL_COOKIE = "burton_admin_email";
const SESSION_COOKIE = "burton_admin_session";

type AdminUser = {
  id: string;
  email: string | null;
  role: "main_admin" | "admin" | "editor" | string | null;
  is_active: boolean | null;
  permissions: unknown;
};

function normalizeHref(value: unknown) {
  if (!value) return null;

  const href = String(value).trim();
  if (!href) return null;

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

function objectPermissionsToKeys(permissions: unknown): string[] {
  if (!permissions) return [];

  if (Array.isArray(permissions)) {
    return permissions.filter(
      (item): item is string => typeof item === "string"
    );
  }

  if (typeof permissions !== "object") return [];

  return Object.entries(permissions)
    .filter(([, allowed]) => allowed === true)
    .map(([key]) => key);
}

function hasPermission(admin: AdminUser, permission: string) {
  if (admin.role === "main_admin") return true;

  const permissions = objectPermissionsToKeys(admin.permissions);
  return permissions.includes(permission);
}

async function getCurrentCustomAdmin(): Promise<AdminUser | null> {
  const cookieStore = await cookies();

  const adminId = cookieStore.get(ADMIN_ID_COOKIE)?.value || "";
  const adminEmail = cookieStore.get(ADMIN_EMAIL_COOKIE)?.value || "";
  const sessionToken = cookieStore.get(SESSION_COOKIE)?.value || "";

  if (!adminId || !adminEmail || !sessionToken) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active,permissions")
    .eq("id", adminId)
    .eq("email", adminEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load admin user.");
  }

  return (data as AdminUser | null) ?? null;
}

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

export async function GET() {
  try {
    const admin = await getCurrentCustomAdmin();

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          message:
            "No active Burton Pride admin session was found. Please log in again.",
        },
        401
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .select("*")
      .order("parent_id", { ascending: true, nullsFirst: true })
      .order("sort_order", { ascending: true });

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to load sidebar items",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      items: data || [],
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/sidebar error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load sidebar items.",
      },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentCustomAdmin();

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          message:
            "No active Burton Pride admin session was found. Please log in again.",
        },
        401
      );
    }

    if (!hasPermission(admin, "site_pages:manage")) {
      return jsonResponse(
        {
          ok: false,
          error: "Forbidden",
          message: "You do not have permission to manage admin sidebar items.",
        },
        403
      );
    }

    const body = await req.json().catch(() => ({}));

    const label = String(body.label || "").trim();
    const href = normalizeHref(body.href);
    const item_type = body.item_type === "group" ? "group" : "link";
    const parent_id =
      body.parent_id && String(body.parent_id).trim().length > 0
        ? String(body.parent_id)
        : null;

    const sort_order = cleanNumber(body.sort_order, 0);
    const is_enabled = cleanBoolean(body.is_enabled, true);
    const open_in_new_tab = cleanBoolean(body.open_in_new_tab, false);
    const icon = body.icon ? String(body.icon).trim() : null;

    if (!label) {
      return jsonResponse({ ok: false, error: "Label is required" }, 400);
    }

    if (item_type === "link" && !href) {
      return jsonResponse({ ok: false, error: "Link must have a URL" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("admin_sidebar_items")
      .insert({
        label,
        href,
        item_type,
        parent_id,
        sort_order,
        is_enabled,
        open_in_new_tab,
        icon,
      })
      .select()
      .single();

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to create sidebar item",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      item: data,
    });
  } catch (error: unknown) {
    console.error("POST /api/admin/sidebar error:", error);

    return jsonResponse(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to create sidebar item.",
      },
      500
    );
  }
}