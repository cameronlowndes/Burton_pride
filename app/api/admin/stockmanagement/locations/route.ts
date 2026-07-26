import { type NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  getCurrentAdmin,
  requireMainAdmin,
} from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";
import { writeStockAuditLog } from "@/lib/stockManagement/writeStockAuditLog";

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
  role?: string | null;
  is_main_admin?: boolean | null;
};

type StockLocationRow = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  is_active?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  updated_by_name?: string | null;
};

type StockItemTotalsRow = {
  id?: string | null;
  location_id?: string | null;
  location?: string | null;
  quantity?: number | string | null;
  unit_cost?: number | string | null;
  is_active?: boolean | null;
};

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function displayName(admin: AdminIdentity) {
  return (
    clean(admin.full_name) ||
    clean(admin.name) ||
    clean(admin.email) ||
    "Administrator"
  );
}

function normaliseAdmin(admin: AdminIdentity) {
  return {
    id: admin.id || null,
    name: displayName(admin),
    email: admin.email || null,
    role: admin.role || null,
  };
}

async function requireAdmin() {
  const admin =
    (await getCurrentAdmin()) as AdminIdentity | null;

  return admin?.id ? admin : null;
}

function locationSnapshot(location: StockLocationRow) {
  return {
    id: location.id,
    name: location.name,
    code: location.code || null,
    description: location.description || null,
    isActive: location.is_active !== false,
    updatedAt: location.updated_at || null,
    updatedByName: location.updated_by_name || null,
  };
}

function changedFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
) {
  return Array.from(
    new Set([
      ...Object.keys(before),
      ...Object.keys(after),
    ]),
  ).filter(
    (key) =>
      JSON.stringify(before[key]) !==
      JSON.stringify(after[key]),
  );
}

async function writeLocationAudit(params: {
  request: NextRequest;
  admin: AdminIdentity;
  actionKey: string;
  actionLabel: string;
  actionCategory: "create" | "update" | "delete";
  status?: "success" | "failed" | "blocked";
  riskLevel?: "low" | "medium" | "high";
  description: string;
  reason?: string | null;
  location?: StockLocationRow | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  responseStatus: number;
  error?: unknown;
  metadata?: Record<string, unknown>;
}) {
  const location = params.location || null;

  const result = await writeStockAuditLog({
    actionKey: params.actionKey,
    actionLabel: params.actionLabel,
    actionCategory: params.actionCategory,
    module: "locations",
    status: params.status || "success",
    riskLevel: params.riskLevel || "low",
    admin: normaliseAdmin(params.admin),

    description: params.description,
    reason: params.reason || null,

    recordType: "stock_location",
    recordId: location?.id || null,
    recordName: location?.name || null,
    recordReference: location?.code || null,

    locationId: location?.id || null,
    locationName: location?.name || null,

    oldValues: params.oldValues || null,
    newValues: params.newValues || null,
    changedFields:
      params.oldValues && params.newValues
        ? changedFields(params.oldValues, params.newValues)
        : params.newValues
          ? Object.keys(params.newValues)
          : params.oldValues
            ? Object.keys(params.oldValues)
            : [],

    request: params.request,
    responseStatus: params.responseStatus,
    apiEndpoint: params.request.nextUrl.pathname,
    error: params.error,
    metadata: {
      source: "stock_locations_api",
      ...(params.metadata || {}),
    },
  });

  if (!result.ok) {
    console.error(
      "Stock location audit logging failed:",
      result.error,
    );
  }

  return result;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const includeArchived =
    request.nextUrl.searchParams.get("includeArchived") ===
    "true";

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

  /*
   * location_id is the current relationship.
   * location is selected only as a legacy fallback for old records.
   */
  const { data: itemRows, error: itemError } =
    await supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .select(
        "id,location_id,location,quantity,unit_cost,is_active",
      )
      .eq("is_active", true);

  if (itemError) {
    return json(
      {
        ok: false,
        error:
          "Locations loaded, but inventory totals could not be calculated.",
        code: itemError.code,
        details: itemError.details,
        hint: itemError.hint,
      },
      500,
    );
  }

  const locationByName = new Map<string, string>();

  for (const location of (locationRows || []) as StockLocationRow[]) {
    locationByName.set(
      clean(location.name).toLowerCase(),
      location.id,
    );
  }

  const totals = new Map<
    string,
    {
      itemCount: number;
      totalUnits: number;
      totalValue: number;
    }
  >();

  for (const item of (itemRows || []) as StockItemTotalsRow[]) {
    let locationId = clean(item.location_id);

    /*
     * Legacy fallback:
     * Older stock items may still have only the location name
     * stored in stock_items.location.
     */
    if (!locationId) {
      const legacyLocation = clean(item.location);

      if (legacyLocation) {
        locationId =
          locationByName.get(
            legacyLocation.toLowerCase(),
          ) || "";
      }
    }

    if (!locationId) continue;

    const current = totals.get(locationId) || {
      itemCount: 0,
      totalUnits: 0,
      totalValue: 0,
    };

    const quantity = Number(item.quantity || 0);
    const unitCost = Number(item.unit_cost || 0);

    current.itemCount += 1;
    current.totalUnits += quantity;
    current.totalValue += quantity * unitCost;

    totals.set(locationId, current);
  }

  const locations = (
    (locationRows || []) as StockLocationRow[]
  ).map((location) => {
    const total = totals.get(location.id) || {
      itemCount: 0,
      totalUnits: 0,
      totalValue: 0,
    };

    return {
      id: location.id,
      name: location.name,
      code: location.code || null,
      description: location.description || null,
      isActive: location.is_active !== false,
      itemCount: total.itemCount,
      totalUnits: total.totalUnits,
      totalValue: Number(
        total.totalValue.toFixed(2),
      ),
      updatedAt: location.updated_at || null,
      updatedByName:
        location.updated_by_name || null,
    };
  });

  /*
   * Do not audit GET requests.
   * Viewing or refreshing the page does not change data.
   */
  return json({
    ok: true,
    locations,
  });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const body = await request.json().catch(() => null);
  const name = clean(body?.name);
  const code = clean(body?.code) || null;
  const description =
    clean(body?.description) || null;

  if (!name) {
    return json(
      {
        ok: false,
        error: "Location name is required.",
      },
      400,
    );
  }

  const now = new Date().toISOString();
  const adminDisplayName = displayName(admin);

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
      created_by_name: adminDisplayName,
      updated_by: admin.id,
      updated_by_name: adminDisplayName,
    })
    .select(
      "id,name,code,description,is_active,updated_at,updated_by_name",
    )
    .single();

  if (error) {
    await writeLocationAudit({
      request,
      admin,
      actionKey: "stock_location_create_failed",
      actionLabel: "Stock location creation failed",
      actionCategory: "create",
      status: "failed",
      riskLevel: "medium",
      description:
        "A stock location could not be created.",
      responseStatus:
        error.code === "23505" ? 409 : 500,
      error,
      metadata: {
        attemptedName: name,
        attemptedCode: code,
      },
    });

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

  const location = data as StockLocationRow;
  const snapshot = locationSnapshot(location);

  await writeLocationAudit({
    request,
    admin,
    actionKey: "stock_location_created",
    actionLabel: "Stock location created",
    actionCategory: "create",
    description:
      `${displayName(admin)} created ${location.name}.`,
    reason:
      "Location was created using the Stock Management locations page.",
    location,
    oldValues: null,
    newValues: snapshot,
    responseStatus: 201,
  });

  return json(
    {
      ok: true,
      location: {
        ...snapshot,
        itemCount: 0,
        totalUnits: 0,
        totalValue: 0,
      },
    },
    201,
  );
}

export async function PATCH(request: NextRequest) {
  const admin = await requireAdmin();

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised.",
      },
      401,
    );
  }

  const body = await request.json().catch(() => null);
  const id = clean(body?.id);
  const name = clean(body?.name);

  if (!id || !name) {
    return json(
      {
        ok: false,
        error:
          "Location ID and name are required.",
      },
      400,
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .select(
      "id,name,code,description,is_active,updated_at,updated_by_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (existingError) {
    return json(
      {
        ok: false,
        error:
          "The existing stock location could not be loaded.",
        code: existingError.code,
        details: existingError.details,
        hint: existingError.hint,
      },
      500,
    );
  }

  if (!existing) {
    return json(
      {
        ok: false,
        error: "Stock location not found.",
      },
      404,
    );
  }

  const before = locationSnapshot(
    existing as StockLocationRow,
  );

  const { data, error } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .update({
      name,
      code: clean(body?.code) || null,
      description:
        clean(body?.description) || null,
      is_active: body?.isActive !== false,
      updated_at: new Date().toISOString(),
      updated_by: admin.id,
      updated_by_name: displayName(admin),
    })
    .eq("id", id)
    .select(
      "id,name,code,description,is_active,updated_at,updated_by_name",
    )
    .single();

  if (error) {
    await writeLocationAudit({
      request,
      admin,
      actionKey: "stock_location_update_failed",
      actionLabel: "Stock location update failed",
      actionCategory: "update",
      status: "failed",
      riskLevel: "medium",
      description:
        `${existing.name} could not be updated.`,
      location: existing as StockLocationRow,
      oldValues: before,
      responseStatus:
        error.code === "23505" ? 409 : 500,
      error,
    });

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

  const location = data as StockLocationRow;
  const after = locationSnapshot(location);

  /*
   * location_id remains valid when the location is renamed,
   * so no stock_items update is needed.
   *
   * Keep legacy text values aligned only for old records that
   * do not yet have location_id populated.
   */
  if (existing.name !== name) {
    const { error: legacyUpdateError } =
      await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .update({
          location: name,
          updated_at: new Date().toISOString(),
          updated_by: admin.id,
          updated_by_name: displayName(admin),
        })
        .is("location_id", null)
        .eq("location", existing.name);

    if (legacyUpdateError) {
      console.warn(
        "Legacy stock location-name update failed:",
        legacyUpdateError,
      );
    }
  }

  await writeLocationAudit({
    request,
    admin,
    actionKey: "stock_location_updated",
    actionLabel: "Stock location updated",
    actionCategory: "update",
    description:
      `${displayName(admin)} updated ${location.name}.`,
    reason:
      "Location details were changed using the Stock Management locations page.",
    location,
    oldValues: before,
    newValues: after,
    responseStatus: 200,
  });

  const { count } = await supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("location_id", location.id)
    .eq("is_active", true);

  return json({
    ok: true,
    location: {
      ...after,
      itemCount: Number(count || 0),
      totalUnits: 0,
      totalValue: 0,
    },
  });
}

async function verifyMainAdminDeletePassword(
  password: string,
) {
  const cleanedPassword = clean(password);

  if (!cleanedPassword) {
    return {
      ok: false as const,
      status: 400,
      error:
        "Main administrator password is required.",
      field: "mainAdminPassword",
      likelyFix:
        "Enter the main admin delete password and try again.",
    };
  }

  const { data: setting, error } =
    await supabaseAdmin
      .from(DELETE_SETTINGS_TABLE)
      .select("password_hash")
      .eq(
        "action_key",
        MAIN_ADMIN_PASSWORD_ACTION_KEY,
      )
      .maybeSingle();

  if (error) {
    return {
      ok: false as const,
      status: 500,
      error:
        "Failed to read the main admin delete-password setting.",
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
      error:
        "The main administrator password is incorrect.",
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
      error instanceof Error
        ? error.message
        : "Main admin access required.";

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
        error:
          "Unable to identify the signed-in main administrator.",
        code: "ADMIN_IDENTITY_NOT_FOUND",
      },
      401,
    );
  }

  const body = await request.json().catch(() => null);
  const id = clean(body?.id);
  const mainAdminPassword = clean(
    body?.mainAdminPassword,
  );
  const permanentDelete =
    body?.permanentDelete === true;

  if (!id) {
    return json(
      {
        ok: false,
        error: "Location ID is required.",
      },
      400,
    );
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
    await verifyMainAdminDeletePassword(
      mainAdminPassword,
    );

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
        actionKey:
          MAIN_ADMIN_PASSWORD_ACTION_KEY,
      },
      passwordCheck.status,
    );
  }

  const {
    data: location,
    error: locationError,
  } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .select(
      "id,name,code,description,is_active,updated_at,updated_by_name",
    )
    .eq("id", id)
    .maybeSingle();

  if (locationError) {
    return json(
      {
        ok: false,
        error:
          "Unable to load the stock location.",
        code: locationError.code,
        details: locationError.details,
        hint: locationError.hint,
      },
      500,
    );
  }

  if (!location) {
    return json(
      {
        ok: false,
        error: "Stock location not found.",
      },
      404,
    );
  }

  /*
   * Count by location_id, not the old location name.
   * Also include legacy records which still use the text name.
   */
  const {
    count: linkedById,
    error: linkedByIdError,
  } = await supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("id", {
      count: "exact",
      head: true,
    })
    .eq("location_id", location.id)
    .eq("is_active", true);

  if (linkedByIdError) {
    return json(
      {
        ok: false,
        error:
          "Unable to check stock linked to this location.",
        code: linkedByIdError.code,
        details: linkedByIdError.details,
        hint: linkedByIdError.hint,
      },
      500,
    );
  }

  const {
    count: linkedLegacy,
    error: linkedLegacyError,
  } = await supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select("id", {
      count: "exact",
      head: true,
    })
    .is("location_id", null)
    .eq("location", location.name)
    .eq("is_active", true);

  if (linkedLegacyError) {
    return json(
      {
        ok: false,
        error:
          "Unable to check legacy stock linked to this location.",
        code: linkedLegacyError.code,
        details: linkedLegacyError.details,
        hint: linkedLegacyError.hint,
      },
      500,
    );
  }

  const linkedItemCount =
    Number(linkedById || 0) +
    Number(linkedLegacy || 0);

  if (linkedItemCount > 0) {
    await writeLocationAudit({
      request,
      admin,
      actionKey:
        "stock_location_delete_blocked",
      actionLabel:
        "Stock location deletion blocked",
      actionCategory: "delete",
      status: "blocked",
      riskLevel: "high",
      description:
        `${location.name} could not be deleted because stock items are still linked to it.`,
      location: location as StockLocationRow,
      oldValues: locationSnapshot(
        location as StockLocationRow,
      ),
      responseStatus: 409,
      metadata: {
        linkedItemCount,
      },
    });

    return json(
      {
        ok: false,
        error:
          "This location cannot be deleted because active inventory items are still linked to it. Move all linked items to another location first.",
        code: "LOCATION_HAS_LINKED_ITEMS",
        details: `${linkedItemCount} active stock item${
          linkedItemCount === 1
            ? " is"
            : "s are"
        } still assigned to ${location.name}.`,
        field: "location",
      },
      409,
    );
  }

  const before = locationSnapshot(
    location as StockLocationRow,
  );

  const { error } = await supabaseAdmin
    .from(LOCATIONS_TABLE)
    .delete()
    .eq("id", id);

  if (error) {
    await writeLocationAudit({
      request,
      admin,
      actionKey:
        "stock_location_delete_failed",
      actionLabel:
        "Stock location deletion failed",
      actionCategory: "delete",
      status: "failed",
      riskLevel: "high",
      description:
        `${location.name} could not be permanently deleted.`,
      location: location as StockLocationRow,
      oldValues: before,
      responseStatus: 500,
      error,
    });

    return json(
      {
        ok: false,
        error:
          "The stock location could not be permanently deleted.",
        code: error.code,
        details: error.details,
        hint: error.hint,
      },
      500,
    );
  }

  await writeLocationAudit({
    request,
    admin,
    actionKey:
      "stock_location_deleted",
    actionLabel:
      "Stock location permanently deleted",
    actionCategory: "delete",
    riskLevel: "high",
    description:
      `${displayName(admin)} permanently deleted ${location.name}.`,
    reason:
      "Permanent deletion was confirmed with the main administrator password.",
    location: location as StockLocationRow,
    oldValues: before,
    newValues: null,
    responseStatus: 200,
    metadata: {
      permanentDelete: true,
      linkedItemCount,
      passwordActionKey:
        MAIN_ADMIN_PASSWORD_ACTION_KEY,
    },
  });

  return json({
    ok: true,
    message:
      "Stock location permanently deleted.",
  });
}
