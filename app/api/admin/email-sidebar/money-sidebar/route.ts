import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SidebarPayload = {
  id?: string;
  label?: string;
  href?: string;
  icon?: string;
  sort_order?: number;
  is_enabled?: boolean;
};

type AdminUser = {
  id: string;
  email: string | null;
  role: string | null;
  is_active: boolean | null;
  permissions: unknown;
};

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

async function requireSupabaseAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
      admin: null,
    };
  }

  const { data, error } = await supabaseAdmin
    .from("admin_users")
    .select("id,email,role,is_active,permissions")
    .eq("supabase_user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) {
    console.error("Money sidebar admin lookup error:", error);

    return {
      ok: false as const,
      error: error.message || "Failed to verify admin access.",
      status: 500,
      admin: null,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      error: "Forbidden",
      status: 403,
      admin: null,
    };
  }

  return {
    ok: true as const,
    admin: data as AdminUser,
  };
}

function normalisePayload(body: SidebarPayload) {
  return {
    id: typeof body.id === "string" ? body.id.trim() : undefined,
    label: typeof body.label === "string" ? body.label.trim() : undefined,
    href: typeof body.href === "string" ? body.href.trim() : undefined,
    icon: typeof body.icon === "string" ? body.icon.trim() : undefined,
    sort_order:
      typeof body.sort_order === "number"
        ? body.sort_order
        : body.sort_order !== undefined
        ? Number(body.sort_order)
        : undefined,
    is_enabled:
      typeof body.is_enabled === "boolean" ? body.is_enabled : undefined,
  };
}

export async function GET() {
  try {
    const access = await requireSupabaseAdmin();

    if (!access.ok) {
      return jsonResponse(
        {
          ok: false,
          error: access.error,
        },
        access.status
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to load money sidebar items.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      items: data || [],
    });
  } catch (error: unknown) {
    console.error("GET /api/admin/money-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to load money sidebar items.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireSupabaseAdmin();

    if (!access.ok) {
      return jsonResponse(
        {
          ok: false,
          error: access.error,
        },
        access.status
      );
    }

    if (!hasPermission(access.admin, "site_pages:manage")) {
      return jsonResponse(
        {
          ok: false,
          error: "Forbidden",
          message: "You do not have permission to manage money sidebar items.",
        },
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    const payload = normalisePayload(body);

    if (!payload.label) {
      return jsonResponse(
        {
          ok: false,
          error: "Label is required.",
        },
        400
      );
    }

    if (!payload.href) {
      return jsonResponse(
        {
          ok: false,
          error: "Href is required.",
        },
        400
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .insert({
        label: payload.label,
        href: payload.href,
        icon: payload.icon || "Wallet",
        sort_order: Number.isFinite(payload.sort_order)
          ? payload.sort_order
          : 0,
        is_enabled: payload.is_enabled ?? true,
      })
      .select()
      .single();

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to create money sidebar item.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      item: data,
    });
  } catch (error: unknown) {
    console.error("POST /api/admin/money-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to create money sidebar item.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireSupabaseAdmin();

    if (!access.ok) {
      return jsonResponse(
        {
          ok: false,
          error: access.error,
        },
        access.status
      );
    }

    if (!hasPermission(access.admin, "site_pages:manage")) {
      return jsonResponse(
        {
          ok: false,
          error: "Forbidden",
          message: "You do not have permission to manage money sidebar items.",
        },
        403
      );
    }

    const body = await req.json().catch(() => ({}));
    const payload = normalisePayload(body);

    if (!payload.id) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing id",
        },
        400
      );
    }

    const updatePayload: Record<string, unknown> = {};

    if (payload.label !== undefined) updatePayload.label = payload.label;
    if (payload.href !== undefined) updatePayload.href = payload.href;
    if (payload.icon !== undefined) updatePayload.icon = payload.icon;
    if (payload.sort_order !== undefined) {
      updatePayload.sort_order = Number.isFinite(payload.sort_order)
        ? payload.sort_order
        : 0;
    }
    if (payload.is_enabled !== undefined) {
      updatePayload.is_enabled = payload.is_enabled;
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .update(updatePayload)
      .eq("id", payload.id)
      .select()
      .single();

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to update money sidebar item.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      item: data,
    });
  } catch (error: unknown) {
    console.error("PATCH /api/admin/money-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to update money sidebar item.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const access = await requireSupabaseAdmin();

    if (!access.ok) {
      return jsonResponse(
        {
          ok: false,
          error: access.error,
        },
        access.status
      );
    }

    if (!hasPermission(access.admin, "site_pages:manage")) {
      return jsonResponse(
        {
          ok: false,
          error: "Forbidden",
          message: "You do not have permission to manage money sidebar items.",
        },
        403
      );
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return jsonResponse(
        {
          ok: false,
          error: "Missing id",
        },
        400
      );
    }

    const { error } = await supabaseAdmin
      .from("money_sidebar_items")
      .delete()
      .eq("id", id);

    if (error) {
      return jsonResponse(
        {
          ok: false,
          error: error.message || "Failed to delete money sidebar item.",
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
    });
  } catch (error: unknown) {
    console.error("DELETE /api/admin/money-sidebar error:", error);

    const message =
      error instanceof Error
        ? error.message
        : "Failed to delete money sidebar item.";

    return jsonResponse(
      {
        ok: false,
        error: message,
      },
      500
    );
  }
}