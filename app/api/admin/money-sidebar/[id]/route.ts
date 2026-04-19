import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SidebarPayload = {
  label?: string;
  href?: string;
  icon?: string;
  sort_order?: number;
  is_enabled?: boolean;
};

async function requireAdmin() {
  const { userId } = await auth();

  if (!userId) {
    return {
      ok: false as const,
      error: "Unauthorized",
      status: 401,
    };
  }

  return {
    ok: true as const,
    adminUser: {
      clerk_user_id: userId,
      role: "authenticated",
    },
  };
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

function getIdFromRequest(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  return parts[parts.length - 1]?.trim() || "";
}

export async function PATCH(req: NextRequest) {
  try {
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const id = getIdFromRequest(req);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Item id is required" },
        { status: 400 }
      );
    }

    const body = (await req.json()) as SidebarPayload;
    const payload = normalisePayload(body);

    const updates: Record<string, unknown> = {};

    if (payload.label !== undefined) updates.label = payload.label;
    if (payload.href !== undefined) updates.href = payload.href;
    if (payload.icon !== undefined) updates.icon = payload.icon;
    if (payload.sort_order !== undefined) updates.sort_order = payload.sort_order;
    if (payload.is_enabled !== undefined) updates.is_enabled = payload.is_enabled;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { ok: false, error: "No updates provided" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .update(updates)
      .eq("id", id)
      .select("id, label, href, icon, sort_order, is_enabled")
      .single();

    if (error) {
      console.error("PATCH money sidebar [id] error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to update item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error) {
    console.error("Unexpected PATCH money sidebar [id] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const id = getIdFromRequest(req);

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Item id is required" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("money_sidebar_items")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("DELETE money sidebar [id] error:", error);
      return NextResponse.json(
        { ok: false, error: error.message || "Failed to delete item" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error("Unexpected DELETE money sidebar [id] error:", error);
    return NextResponse.json(
      { ok: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}