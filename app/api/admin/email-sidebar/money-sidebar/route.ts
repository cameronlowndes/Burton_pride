import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type SidebarPayload = {
  id?: string;
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

  // 🔥 CHANGED: now checks admin_sidebar_items instead of admin_users
  const { data, error } = await supabaseAdmin
    .from("admin_sidebar_items")
    .select("id")
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Admin lookup error:", error);

    return {
      ok: false as const,
      error: "Failed to verify admin access",
      status: 500,
    };
  }

  if (!data) {
    return {
      ok: false as const,
      error: "Forbidden",
      status: 403,
    };
  }

  return {
    ok: true as const,
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
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      items: data || [],
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const access = await requireAdmin();

    if (!access.ok) {
      return NextResponse.json(
        { ok: false, error: access.error },
        { status: access.status }
      );
    }

    const body = await req.json();
    const payload = normalisePayload(body);

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .insert({
        label: payload.label,
        href: payload.href,
        icon: payload.icon || "Wallet",
        sort_order: payload.sort_order || 0,
        is_enabled: payload.is_enabled ?? true,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
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

    const body = await req.json();
    const payload = normalisePayload(body);

    if (!payload.id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin
      .from("money_sidebar_items")
      .update({
        label: payload.label,
        href: payload.href,
        icon: payload.icon,
        sort_order: payload.sort_order,
        is_enabled: payload.is_enabled,
      })
      .eq("id", payload.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      ok: true,
      item: data,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
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

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { ok: false, error: "Missing id" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin
      .from("money_sidebar_items")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({
      ok: true,
    });
  } catch (error: any) {
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}