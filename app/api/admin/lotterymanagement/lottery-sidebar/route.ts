import { requireLotteryPermission } from "@/lib/lottery/adminAuth";
import { deleteSidebarItem } from "./delete-item";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      `Missing Supabase environment variables. NEXT_PUBLIC_SUPABASE_URL=${Boolean(
        url,
      )}, SUPABASE_SERVICE_ROLE_KEY=${Boolean(serviceRoleKey)}`,
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function errorResponse(message: string, error: unknown, status = 500) {
  return NextResponse.json(
    {
      ok: false,
      error: message,

    },
    {
      status: error && typeof error === "object" && "status" in error && [401,403,503].includes(Number(error.status)) ? Number(error.status) : status,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanOptionalText(value: unknown) {
  const text = cleanText(value);
  return text || null;
}

function validAdminHref(value: string) {
  return (
    value.startsWith("/Admin/") ||
    value === "/Admin/LotteryManagement"
  );
}

async function loadItems() {
  const supabase = getSupabaseAdmin();

  const result = await supabase
    .from("lottery_sidebar_items")
    .select(
      "id,label,href,icon,sort_order,is_enabled,open_in_new_tab,is_coming_soon,disabled,disabled_reason,permission_key,created_at,updated_at",
    )
    .order("sort_order", { ascending: true })
    .order("label", { ascending: true });

  if (result.error) {
    throw result.error;
  }

  return result.data ?? [];
}

export async function GET() {
  try {
    await requireLotteryPermission("lottery:view");
    const items = await loadItems();

    return NextResponse.json(
      {
        ok: true,
        items,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/lottery-sidebar][GET]", error);
    return errorResponse(
      "Unable to load Lottery Management sidebar.",
      error,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireLotteryPermission("lottery:settings:manage");
    const body = await request.json();

    const label = cleanText(body?.label);
    const href = cleanText(body?.href);
    const icon = cleanText(body?.icon) || "ticket";

    if (!label) {
      return errorResponse(
        "Sidebar label is required.",
        "label was empty",
        400,
      );
    }

    if (!href || !validAdminHref(href)) {
      return errorResponse(
        "A valid Admin Portal path is required.",
        "href must start with /Admin/ and remain inside the Admin Portal.",
        400,
      );
    }

    const supabase = getSupabaseAdmin();

    const insert = await supabase
      .from("lottery_sidebar_items")
      .insert({
        label,
        href,
        icon,
        sort_order: Number.isFinite(Number(body?.sort_order))
          ? Number(body.sort_order)
          : 0,
        is_enabled: body?.is_enabled !== false,
        open_in_new_tab: body?.open_in_new_tab === true,
        is_coming_soon: body?.is_coming_soon === true,
        disabled: body?.disabled === true,
        disabled_reason: cleanOptionalText(body?.disabled_reason),
        permission_key: cleanOptionalText(body?.permission_key),
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (insert.error) {
      return errorResponse(
        "Unable to create Lottery sidebar item.",
        insert.error,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        item: insert.data,
        items: await loadItems(),
      },
      {
        status: 201,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/lottery-sidebar][POST]", error);
    return errorResponse(
      "Unable to create Lottery sidebar item.",
      error,
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireLotteryPermission("lottery:settings:manage");
    const body = await request.json();
    const id = cleanText(body?.id);

    if (!id) {
      return errorResponse(
        "Sidebar item ID is required.",
        "PATCH body did not include id",
        400,
      );
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body?.label !== undefined) {
      const label = cleanText(body.label);

      if (!label) {
        return errorResponse(
          "Sidebar label cannot be empty.",
          "label was empty",
          400,
        );
      }

      patch.label = label;
    }

    if (body?.href !== undefined) {
      const href = cleanText(body.href);

      if (!href || !validAdminHref(href)) {
        return errorResponse(
          "A valid Admin Portal path is required.",
          "href must start with /Admin/ and remain inside the Admin Portal.",
          400,
        );
      }

      patch.href = href;
    }

    if (body?.icon !== undefined) {
      patch.icon = cleanText(body.icon) || "ticket";
    }

    if (body?.sort_order !== undefined) {
      const sortOrder = Number(body.sort_order);

      if (!Number.isFinite(sortOrder)) {
        return errorResponse(
          "sort_order must be a number.",
          `Received ${String(body.sort_order)}`,
          400,
        );
      }

      patch.sort_order = sortOrder;
    }

    if (typeof body?.is_enabled === "boolean") {
      patch.is_enabled = body.is_enabled;
    }

    if (typeof body?.open_in_new_tab === "boolean") {
      patch.open_in_new_tab = body.open_in_new_tab;
    }

    if (typeof body?.is_coming_soon === "boolean") {
      patch.is_coming_soon = body.is_coming_soon;
    }

    if (typeof body?.disabled === "boolean") {
      patch.disabled = body.disabled;
    }

    if (body?.disabled_reason !== undefined) {
      patch.disabled_reason = cleanOptionalText(body.disabled_reason);
    }

    if (body?.permission_key !== undefined) {
      patch.permission_key = cleanOptionalText(body.permission_key);
    }

    const supabase = getSupabaseAdmin();

    const update = await supabase
      .from("lottery_sidebar_items")
      .update(patch)
      .eq("id", id)
      .select("*")
      .single();

    if (update.error) {
      return errorResponse(
        "Unable to update Lottery sidebar item.",
        update.error,
      );
    }

    return NextResponse.json(
      {
        ok: true,
        item: update.data,
        items: await loadItems(),
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[api/admin/lottery-sidebar][PATCH]", error);
    return errorResponse(
      "Unable to update Lottery sidebar item.",
      error,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  return deleteSidebarItem(request, cleanText(body?.id), body);
}
