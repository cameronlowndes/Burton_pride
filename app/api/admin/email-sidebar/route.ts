import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AdminUser = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  permissions: unknown;
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

function permissionsToKeys(value: unknown): string[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .map((item) => String(item || "").trim())
      .filter(Boolean);
  }

  if (typeof value !== "object") return [];

  return Object.entries(value)
    .filter(([, allowed]) => allowed === true)
    .map(([key]) => key);
}

function hasPermission(admin: AdminUser, permission: string) {
  if (admin.role === "main_admin") return true;

  const permissions = permissionsToKeys(admin.permissions);

  return permissions.includes(permission);
}

async function getCurrentAdmin(): Promise<AdminUser | null> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active,permissions")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load admin user.");
  }

  return (data as AdminUser | null) ?? null;
}

export async function GET() {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          message:
            "No active Supabase admin user was found for this login session.",
        },
        401
      );
    }

    const { data, error } = await supabaseAdmin
      .from("admin_email_sidebar")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to load email sidebar items.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      items: data || [],
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/email-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load email sidebar items.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}

export async function POST(req: Request) {
  try {
    const admin = await getCurrentAdmin();

    if (!admin) {
      return jsonResponse(
        {
          ok: false,
          error: "Unauthorized",
          message:
            "No active Supabase admin user was found for this login session.",
        },
        401
      );
    }

    if (!hasPermission(admin, "site_pages:manage")) {
      return jsonResponse(
        {
          ok: false,
          error: "Forbidden",
          message:
            "You do not have permission to manage email sidebar settings.",
        },
        403
      );
    }

    const body = await req.json().catch(() => ({}));

    const label = clean(body.label);
    const href = normalizeHref(body.href);
    const icon = cleanIcon(body.icon);
    const sortOrder = cleanNumber(body.sort_order, 0);
    const isEnabled = cleanBoolean(body.is_enabled, true);

    if (!label) {
      return jsonResponse(
        {
          ok: false,
          error: "Label is required.",
        },
        400
      );
    }

    if (!href) {
      return jsonResponse(
        {
          ok: false,
          error: "URL / href is required.",
        },
        400
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
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to create email sidebar item.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      item: data,
    });
  } catch (error: unknown) {
    console.error("POST /api/admin/email-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create email sidebar item.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}