import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { getCurrentAdmin, requireMainAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LOCATIONS_TABLE = "stock_locations";
const STOCK_ITEMS_TABLE = "stock_items";
const DELETE_SETTINGS_TABLE = "admin_delete_settings";
const MAIN_ADMIN_PASSWORD_ACTION_KEY = "delete_all_donations";

type AdminIdentity = {
  id: string;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function displayName(admin: AdminIdentity) {
  return clean(admin.full_name) || clean(admin.name) || clean(admin.email) || "Administrator";
}

async function requireAdmin() {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;
  return admin?.id ? admin : null;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") === "true";

  let query = supabaseAdmin
    .from(LOCATIONS_TABLE)
    .select(
      "id,name,code,description,is_active,created_at,updated_at,updated_by_name",
    )
    .order("name", { ascending: true });

  if (!includeArchived) {
    query = query.eq("is_active", true);
  }

  const { data: locationRows, error } = await query;

  if (error) {
    return json(
      {
        ok: false,
        error: "Unable to load stock locations.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  const { data: itemRows, error: itemError } = await supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("location,quantity,unit_cost,is_active")
    .eq("is_active", true);

  if (itemError) {
    return json(
      {
        ok: false,
        error: "Locations loaded, but inventory totals could not be calculated.",
        code: itemError.code,
        details: itemError.details,
        hint: itemError.hint,
      },
      500,
    );
  }

  const totals = new Map<
    string,
    { itemCount: number; totalUnits: number; totalValue: number }
  >();

  for (const item of itemRows || []) {
    const location = clean(item.location);

    if (!location) continue;

    const current = totals.get(location) || {
      itemCount: 0,
      totalUnits: 0,
      totalValue: 0,
    };

    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unit_cost || 0);

    current.itemCount += 1;
    current.totalUnits += quantity;
    current.totalValue += quantity * unitCost;

    totals.set(location, current);
  }

  const locations = (locationRows || []).map((location) => {
    const total = totals.get(location.name) || {
      itemCount: 0,
      totalUnits: 0,
      totalValue: 0,
    };

    return {
      id: location.id,
      name: location.name,
      code: location.code,
      description: location.description,
      isActive: location.is_active !== false,
      itemCount: total.itemCount,
      totalUnits: total.totalUnits,
      totalValue: total.totalValue,
      updatedAt: location.updated_at,
      updatedByName: location.updated_by_name,
    };
  });

  return json({ ok: true, locations });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const body = await request.json().catch(() => null);
  const name = clean(body?.name);
  const code = clean(body?.code) || null;
  const description = clean(body?.description) || null;

  if (!name) {
    return json({ ok: false, error: "Location name is required." }, 400);
  }

  const now = new Date().toISOString();
  const adminName = displayName(admin);

  const { data, error } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .insert({
      name,
      code,
      description,
      is_active: body?.isActive !== false,
      created_at: now,
      updated_at: now,
      created_by: admin.id,
      created_by_name: adminName,
      updated_by: admin.id,
      updated_by_name: adminName,
    })
    .select("id,name,code,description,is_active,updated_at,updated_by_name")
    .single();

  if (error) {
    return json(
      {
        ok: false,
        error:
          error.code === "23505"
            ? "A stock location with this name or code already exists."
            : "The stock location could not be created.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      error.code === "23505" ? 409 : 500,
    );
  }

  return json({ ok: true, location: data }, 201);
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json({ ok: false, error: "Unauthorised." }, 401);
  }

  const body = await request.json().catch(() => null);
  const id = clean(body?.id);
  const name = clean(body?.name);

  if (!id || !name) {
    return json(
      { ok: false, error: "Location ID and name are required." },
      400,
    );
  }

  const { data: existing } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .select("name")
    .eq("id", id)
    .maybeSingle();

  if (!existing) {
    return json({ ok: false, error: "Stock location not found." }, 404);
  }

  const { data, error } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .update({
      name,
      code: clean(body?.code) || null,
      description: clean(body?.description) || null,
      is_active: body?.isActive !== false,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
      updated_by_name: displayName(admin),
    })
    .eq("id", id)
    .select("id,name,code,description,is_active,updated_at,updated_by_name")
    .single();

  if (error) {
    return json(
      {
        ok: false,
        error:
          error.code === "23505"
            ? "Another location already uses this name or code."
            : "The stock location could not be updated.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      error.code === "23505" ? 409 : 500,
    );
  }

  if (existing.name !== name) {
    await supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .update({
        location: name,
        updated_at: new Date().toISOString(),
        updated_by: admin.id,
        updated_by_name: displayName(admin),
      })
      .eq("location", existing.name);
  }

  return json({ ok: true, location: data });
}

async function verifyMainAdminDeletePassword(password: string) {
  const cleanedPassword = clean(password);

  if (!cleanedPassword) {
    return {
      ok: false as const,
      status: 400,
      error: "Main administrator password is required.",
      field: "mainAdminPassword",
      likelyFix: "Enter the main admin delete password and try again.",
    };
  }

  const { data: setting, error } = await supabaseAdmin
    .from(DELETE_SETTINGS_TABLE)
    .select("password_hash")
    .eq("action_key", MAIN_ADMIN_PASSWORD_ACTION_KEY)
    .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error: "Failed to read the main admin delete-password setting.",
      code: error.code,
      details: error.details,
      hint: error.hint,
      likelyFix:
        "Check admin_delete_settings exists and contains action_key and password_hash columns.",
    };
  }

  if (!setting?.password_hash) {
    return {
      ok: false as const,
      status: 400,
      error:
        "No main admin delete password has been set yet. Set one in Main Admin Delete Password first.",
      code: "DELETE_PASSWORD_NOT_SET",
      likelyFix:
        "Open the Main Admin Delete Password page and create the password before deleting a stock location.",
    };
  }

  const passwordMatches = await bcrypt.compare(
    cleanedPassword,
    setting.password_hash,
  );

  if (!passwordMatches) {
    return {
      ok: false as const,
      status: 403,
      error: "The main administrator password is incorrect.",
      field: "mainAdminPassword",
      code: "INVALID_MAIN_ADMIN_PASSWORD",
      likelyFix:
        "Use the same main admin delete password configured in admin_delete_settings.",
    };
  }

  return {
    ok: true as const,
    status: 200,
  };
}

export async function DELETE(request: NextRequest) {
  try {
    await requireMainAdmin();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Main admin access required.";

    return json(
      {
        ok: false,
        error: message,
        code: "MAIN_ADMIN_REQUIRED",
        likelyFix:
          "Sign in with an admin_users account whose role is main_admin.",
      },
      message.toLowerCase().includes("sign in") ||
        message.toLowerCase().includes("session")
        ? 401
        : 403,
    );
  }

  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unable to identify the signed-in main administrator.",
        code: "ADMIN_IDENTITY_NOT_FOUND",
      },
      401,
    );
  }

  const body = await request.json().catch(() => null);
  const id = clean(body?.id);
  const mainAdminPassword = clean(body?.mainAdminPassword);
  const permanentDelete = body?.permanentDelete === true;

  if (!id) {
    return json({ ok: false, error: "Location ID is required." }, 400);
  }

  if (!permanentDelete) {
    return json(
      {
        ok: false,
        error:
          "Permanent delete confirmation was not supplied.",
      },
      400,
    );
  }

  const passwordCheck =
    await verifyMainAdminDeletePassword(mainAdminPassword);

  if (!passwordCheck.ok) {
    return json(
      {
        ok: false,
        error: passwordCheck.error,
        code: passwordCheck.code,
        details: passwordCheck.details,
        hint: passwordCheck.hint,
        field: passwordCheck.field,
        likelyFix: passwordCheck.likelyFix,
        actionKey: MAIN_ADMIN_PASSWORD_ACTION_KEY,
      },
      passwordCheck.status,
    );
  }

  const { data: location, error: locationError } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .select("id,name,code")
    .eq("id", id)
    .maybeSingle();

  if (locationError) {
    return json(
      {
        ok: false,
        error: "Unable to load the stock location.",
        code: locationError.code,
        details: locationError.details,
        hint: locationError.hint,
      },
      500,
    );
  }

  if (!location) {
    return json({ ok: false, error: "Stock location not found." }, 404);
  }

  const { count, error: countError } = await supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("id", { count: "exact", head: true })
    .eq("location", location.name)
    .eq("is_active", true);

  if (countError) {
    return json(
      {
        ok: false,
        error:
          "Unable to check whether this location still contains stock.",
        code: countError.code,
        details: countError.details,
        hint: countError.hint,
      },
      500,
    );
  }

  const linkedItemCount = Number(count || 0);

  if (linkedItemCount > 0) {
    return json(
      {
        ok: false,
        error:
          "This location cannot be deleted because active inventory items are still linked to it. Move all linked items to another location first.",
        code: "LOCATION_HAS_LINKED_ITEMS",
        details: `${linkedItemCount} active stock item${
          linkedItemCount === 1 ? " is" : "s are"
        } still assigned to ${location.name}.`,
        field: "location",
      },
      409,
    );
  }

  const { error } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    return json(
      {
        ok: false,
        error: "The stock location could not be permanently deleted.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  try {
    await supabaseAdmin.from("admin_audit_logs").insert({
      admin_id: admin.id,
      admin_name: displayName(admin),
      admin_email: admin.email || null,
      action: "stock_location_permanently_deleted",
      area: "stock_control",
      route: "/api/admin/stock-management/locations",
      method: "DELETE",
      status: "success",
      risk_level: "high",
      target_type: "stock_location",
      target_id: location.id,
      target_label: location.name,
      metadata: {
        location_code: location.code,
        permanent_delete: true,
        linked_item_count: linkedItemCount,
        password_action_key: MAIN_ADMIN_PASSWORD_ACTION_KEY,
      },
      created_at: new Date().toISOString(),
    });
  } catch (auditError) {
    console.warn(
      "Stock location permanent delete audit failed:",
      auditError,
    );
  }

  return json({
    ok: true,
    message: "Stock location permanently deleted.",
  });
}
