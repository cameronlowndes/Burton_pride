import { randomUUID } from "crypto";
import { type NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROUTE_NAME =
  "/api/admin/stockmanagement/locations/movestock";

const STOCK_ITEMS_TABLE = "stock_items";
const STOCK_LOCATIONS_TABLE = "stock_locations";
const STOCK_MOVEMENTS_TABLE = "stock_movements";

type AdminIdentity = {
  id: string;
  email?: string | null;
  name?: string | null;
  full_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  is_active?: boolean | null;
};

type StockItemRow = {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  description: string | null;
  category: string | null;
  location: string | null;
  supplier: string | null;
  quantity: number | string | null;
  reorder_level: number | string | null;
  target_level: number | string | null;
  unit_cost: number | string | null;
  sale_price: number | string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  created_by_name: string | null;
  updated_by: string | null;
  updated_by_name: string | null;
};

type StockLocationRow = {
  id: string;
  name: string;
  code: string | null;
  is_active: boolean | null;
};

type MoveBody = {
  itemId?: unknown;
  stockItemId?: unknown;
  fromLocationId?: unknown;
  toLocationId?: unknown;
  destinationLocationId?: unknown;
  quantity?: unknown;
  notes?: unknown;
  reason?: unknown;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

function json(
  body: Record<string, unknown>,
  status = 200,
  headers?: HeadersInit,
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      ...headers,
    },
  });
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullable(value: unknown) {
  const cleaned = clean(value);
  return cleaned || null;
}

function baseSku(value: unknown) {
  return clean(value).replace(/-MOVE-[A-Z0-9]{8}$/i, "");
}

function wholeNumber(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : Number(typeof value === "string" ? value.trim() : value);

  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function adminName(admin: AdminIdentity) {
  const explicit = clean(admin.full_name) || clean(admin.name);

  if (explicit) return explicit;

  const combined = [
    clean(admin.first_name),
    clean(admin.last_name),
  ]
    .filter(Boolean)
    .join(" ");

  return combined || clean(admin.email) || "Administrator";
}

function errorPayload(error: SupabaseErrorLike) {
  return {
    code: error.code ?? null,
    details: error.details ?? null,
    hint: error.hint ?? null,
  };
}

type AdminResult =
  | {
      admin: AdminIdentity;
      response: null;
    }
  | {
      admin: null;
      response: NextResponse;
    };

async function requireAdmin(): Promise<AdminResult> {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin?.id) {
    return {
      admin: null,
      response: json(
        {
          ok: false,
          error: "Your administrator session is missing or has expired.",
        },
        401,
      ),
    };
  }

  if (admin.is_active === false) {
    return {
      admin: null,
      response: json(
        {
          ok: false,
          error: "This administrator account is inactive.",
        },
        403,
      ),
    };
  }

  return {
    admin,
    response: null,
  };
}

async function getLocationById(id: string) {
  return supabaseAdmin
    .from(STOCK_LOCATIONS_TABLE)
    .select("id,name,code,is_active")
    .eq("id", id)
    .maybeSingle();
}

function mapItem(
  item: StockItemRow,
  locationIdByName: Map<string, string>,
) {
  const locationName = clean(item.location);
  const quantity = Math.max(0, Number(item.quantity || 0));
  const unitValue = Number(item.unit_cost || 0);

  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    quantity,
    locationId: locationName
      ? locationIdByName.get(locationName.toLowerCase()) || null
      : null,
    locationName: locationName || null,
    unitValue: Number.isFinite(unitValue) ? unitValue : 0,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  const locationId = clean(
    request.nextUrl.searchParams.get("locationId"),
  );

  let requestedLocation: StockLocationRow | null = null;

  if (locationId) {
    const { data, error } = await getLocationById(locationId);

    if (error) {
      return json(
        {
          ok: false,
          error: "The selected stock location could not be loaded.",
          ...errorPayload(error),
        },
        500,
      );
    }

    if (!data) {
      return json(
        {
          ok: false,
          error: "The selected stock location could not be found.",
        },
        404,
      );
    }

    requestedLocation = data as StockLocationRow;
  }

  const { data: locationRows, error: locationError } =
    await supabaseAdmin
      .from(STOCK_LOCATIONS_TABLE)
      .select("id,name,code,is_active")
      .eq("is_active", true)
      .order("name", { ascending: true });

  if (locationError) {
    return json(
      {
        ok: false,
        error: "Active stock locations could not be loaded.",
        ...errorPayload(locationError),
      },
      500,
    );
  }

  const locationIdByName = new Map<string, string>();

  for (const location of (locationRows || []) as StockLocationRow[]) {
    locationIdByName.set(location.name.toLowerCase(), location.id);
  }

  let itemQuery = supabaseAdmin
    .from(STOCK_ITEMS_TABLE)
    .select(
      [
        "id",
        "name",
        "sku",
        "barcode",
        "description",
        "category",
        "location",
        "supplier",
        "quantity",
        "reorder_level",
        "target_level",
        "unit_cost",
        "sale_price",
        "is_active",
        "created_at",
        "updated_at",
        "created_by",
        "created_by_name",
        "updated_by",
        "updated_by_name",
      ].join(","),
    )
    .eq("is_active", true)
    .gt("quantity", 0)
    .order("name", { ascending: true });

  if (requestedLocation) {
    itemQuery = itemQuery.eq("location", requestedLocation.name);
  }

  const { data: itemRows, error: itemError } = await itemQuery;

  if (itemError) {
    return json(
      {
        ok: false,
        error: "Stock items could not be loaded.",
        ...errorPayload(itemError),
      },
      500,
    );
  }

  const typedItemRows = (itemRows ?? []) as unknown as StockItemRow[];

  return json({
    ok: true,
    items: typedItemRows.map((item) =>
      mapItem(item, locationIdByName),
    ),
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();

  if (auth.response) {
    return auth.response;
  }

  const admin = auth.admin;

  let body: MoveBody;

  try {
    body = (await request.json()) as MoveBody;
  } catch {
    return json(
      {
        ok: false,
        error: "The request body must contain valid JSON.",
      },
      400,
    );
  }

  const itemId = clean(body.itemId ?? body.stockItemId);
  const fromLocationId = clean(body.fromLocationId);
  const toLocationId = clean(
    body.toLocationId ?? body.destinationLocationId,
  );
  const quantity = wholeNumber(body.quantity);
  const notes = nullable(body.notes ?? body.reason);

  if (!itemId) {
    return json(
      {
        ok: false,
        error: "Choose the stock item that you want to move.",
        field: "itemId",
      },
      400,
    );
  }

  if (!fromLocationId) {
    return json(
      {
        ok: false,
        error: "Choose the current stock location.",
        field: "fromLocationId",
      },
      400,
    );
  }

  if (!toLocationId) {
    return json(
      {
        ok: false,
        error: "Choose the destination stock location.",
        field: "toLocationId",
      },
      400,
    );
  }

  if (fromLocationId === toLocationId) {
    return json(
      {
        ok: false,
        error:
          "The destination location must be different from the current location.",
        field: "toLocationId",
      },
      409,
    );
  }

  if (quantity === null || quantity < 1) {
    return json(
      {
        ok: false,
        error:
          "The movement quantity must be a whole number of at least 1.",
        field: "quantity",
      },
      400,
    );
  }

  if (notes && notes.length > 1000) {
    return json(
      {
        ok: false,
        error: "Movement notes must be 1,000 characters or fewer.",
        field: "notes",
      },
      400,
    );
  }

  const [
    fromLocationResult,
    toLocationResult,
    itemResult,
  ] = await Promise.all([
    getLocationById(fromLocationId),
    getLocationById(toLocationId),
    supabaseAdmin
      .from(STOCK_ITEMS_TABLE)
      .select(
        [
          "id",
          "name",
          "sku",
          "barcode",
          "description",
          "category",
          "location",
          "supplier",
          "quantity",
          "reorder_level",
          "target_level",
          "unit_cost",
          "sale_price",
          "is_active",
          "created_at",
          "updated_at",
          "created_by",
          "created_by_name",
          "updated_by",
          "updated_by_name",
        ].join(","),
      )
      .eq("id", itemId)
      .maybeSingle(),
  ]);

  if (fromLocationResult.error) {
    return json(
      {
        ok: false,
        error: "The current stock location could not be loaded.",
        ...errorPayload(fromLocationResult.error),
      },
      500,
    );
  }

  if (toLocationResult.error) {
    return json(
      {
        ok: false,
        error: "The destination stock location could not be loaded.",
        ...errorPayload(toLocationResult.error),
      },
      500,
    );
  }

  if (itemResult.error) {
    return json(
      {
        ok: false,
        error: "The selected stock item could not be loaded.",
        ...errorPayload(itemResult.error),
      },
      500,
    );
  }

  if (!fromLocationResult.data) {
    return json(
      {
        ok: false,
        error: "The current stock location could not be found.",
      },
      404,
    );
  }

  if (!toLocationResult.data) {
    return json(
      {
        ok: false,
        error: "The destination stock location could not be found.",
      },
      404,
    );
  }

  if (!itemResult.data) {
    return json(
      {
        ok: false,
        error: "The selected stock item could not be found.",
      },
      404,
    );
  }

  const fromLocation =
    fromLocationResult.data as StockLocationRow;
  const toLocation = toLocationResult.data as StockLocationRow;
  const sourceItem =
    itemResult.data as unknown as StockItemRow;

  if (fromLocation.is_active === false) {
    return json(
      {
        ok: false,
        error: "The current stock location is inactive.",
      },
      409,
    );
  }

  if (toLocation.is_active === false) {
    return json(
      {
        ok: false,
        error: "The destination stock location is inactive.",
      },
      409,
    );
  }

  if (!sourceItem.is_active) {
    return json(
      {
        ok: false,
        error: "The selected stock item is archived or inactive.",
      },
      409,
    );
  }

  const sourceLocationName = clean(sourceItem.location);

  if (
    sourceLocationName.toLowerCase() !==
    fromLocation.name.toLowerCase()
  ) {
    return json(
      {
        ok: false,
        error:
          "The stock item is no longer stored at the selected current location. Refresh the page and try again.",
        field: "fromLocationId",
      },
      409,
    );
  }

  const parsedAvailableQuantity = Number(sourceItem.quantity ?? 0);
  const availableQuantity = Number.isFinite(parsedAvailableQuantity)
    ? Math.max(0, Math.floor(parsedAvailableQuantity))
    : 0;

  if (quantity > availableQuantity) {
    return json(
      {
        ok: false,
        error: `Only ${availableQuantity} unit${
          availableQuantity === 1 ? "" : "s"
        } are available at the current location.`,
        field: "quantity",
        availableQuantity,
      },
      409,
    );
  }

  const movedAt = new Date().toISOString();
  const movedByName = adminName(admin);
  const remainingQuantity = availableQuantity - quantity;

  let destinationItemId = sourceItem.id;
  let destinationItem: StockItemRow | null = null;

  try {
    /*
     * Keep one inventory row for the same product at each location.
     * Old split rows use SKUs ending in -MOVE-XXXXXXXX, so compare the
     * base SKU as well as the item name.
     */
    const { data: destinationCandidates, error: destinationLookupError } =
      await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .select("*")
        .eq("location", toLocation.name)
        .eq("is_active", true)
        .neq("id", sourceItem.id);

    if (destinationLookupError) {
      throw Object.assign(
        new Error("The destination stock records could not be checked."),
        { databaseError: destinationLookupError },
      );
    }

    const sourceBaseSku = baseSku(sourceItem.sku).toLowerCase();
    const matchingDestination = (
      (destinationCandidates ?? []) as unknown as StockItemRow[]
    ).find((candidate) => {
      return (
        clean(candidate.name).toLowerCase() ===
          clean(sourceItem.name).toLowerCase() &&
        baseSku(candidate.sku).toLowerCase() === sourceBaseSku
      );
    });

    if (matchingDestination) {
      const destinationQuantity = Math.max(
        0,
        Math.floor(Number(matchingDestination.quantity ?? 0) || 0),
      );

      const { data: mergedDestination, error: mergeError } =
        await supabaseAdmin
          .from(STOCK_ITEMS_TABLE)
          .update({
            quantity: destinationQuantity + quantity,
            updated_at: movedAt,
            updated_by: admin.id,
            updated_by_name: movedByName,
          })
          .eq("id", matchingDestination.id)
          .select("*")
          .maybeSingle();

      if (mergeError || !mergedDestination) {
        throw Object.assign(
          new Error("The moved stock could not be merged at the destination."),
          { databaseError: mergeError },
        );
      }

      destinationItem = mergedDestination as unknown as StockItemRow;
      destinationItemId = destinationItem.id;

      if (quantity === availableQuantity) {
        const { error: deleteSourceError } = await supabaseAdmin
          .from(STOCK_ITEMS_TABLE)
          .delete()
          .eq("id", sourceItem.id);

        if (deleteSourceError) {
          await supabaseAdmin
            .from(STOCK_ITEMS_TABLE)
            .update({ quantity: destinationQuantity })
            .eq("id", matchingDestination.id);

          throw Object.assign(
            new Error("The old source stock row could not be removed."),
            { databaseError: deleteSourceError },
          );
        }
      } else {
        const { error: sourceUpdateError } = await supabaseAdmin
          .from(STOCK_ITEMS_TABLE)
          .update({
            quantity: remainingQuantity,
            updated_at: movedAt,
            updated_by: admin.id,
            updated_by_name: movedByName,
          })
          .eq("id", sourceItem.id);

        if (sourceUpdateError) {
          await supabaseAdmin
            .from(STOCK_ITEMS_TABLE)
            .update({ quantity: destinationQuantity })
            .eq("id", matchingDestination.id);

          throw Object.assign(
            new Error("The source stock quantity could not be updated."),
            { databaseError: sourceUpdateError },
          );
        }
      }
    } else if (quantity === availableQuantity) {
      const { data, error } = await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .update({
          location: toLocation.name,
          updated_at: movedAt,
          updated_by: admin.id,
          updated_by_name: movedByName,
        })
        .eq("id", sourceItem.id)
        .select("*")
        .maybeSingle();

      if (error || !data) {
        throw Object.assign(
          new Error("The stock item's location could not be updated."),
          { databaseError: error },
        );
      }

      destinationItem = data as unknown as StockItemRow;
    } else {
      const splitSku = `${baseSku(sourceItem.sku)}-MOVE-${randomUUID()
        .replaceAll("-", "")
        .slice(0, 8)
        .toUpperCase()}`;

      const { error: sourceUpdateError } = await supabaseAdmin
        .from(STOCK_ITEMS_TABLE)
        .update({
          quantity: remainingQuantity,
          updated_at: movedAt,
          updated_by: admin.id,
          updated_by_name: movedByName,
        })
        .eq("id", sourceItem.id);

      if (sourceUpdateError) {
        throw Object.assign(
          new Error("The source stock quantity could not be updated."),
          { databaseError: sourceUpdateError },
        );
      }

      const { data: createdDestination, error: createError } =
        await supabaseAdmin
          .from(STOCK_ITEMS_TABLE)
          .insert({
            name: sourceItem.name,
            sku: splitSku,
            barcode: null,
            description: sourceItem.description,
            category: sourceItem.category,
            location: toLocation.name,
            supplier: sourceItem.supplier,
            quantity,
            reorder_level: sourceItem.reorder_level,
            target_level: sourceItem.target_level,
            unit_cost: sourceItem.unit_cost,
            sale_price: sourceItem.sale_price,
            is_active: true,
            created_at: movedAt,
            updated_at: movedAt,
            created_by: admin.id,
            created_by_name: movedByName,
            updated_by: admin.id,
            updated_by_name: movedByName,
          })
          .select("*")
          .maybeSingle();

      if (createError || !createdDestination) {
        await supabaseAdmin
          .from(STOCK_ITEMS_TABLE)
          .update({ quantity: availableQuantity })
          .eq("id", sourceItem.id);

        throw Object.assign(
          new Error("The destination stock record could not be created."),
          { databaseError: createError },
        );
      }

      destinationItem = createdDestination as unknown as StockItemRow;
      destinationItemId = destinationItem.id;
    }

    const { data: movement, error: movementError } =
      await supabaseAdmin
        .from(STOCK_MOVEMENTS_TABLE)
        .insert({
          // Always point item_id at the surviving destination row. This means
          // a merged move can safely remove the old source inventory row.
          item_id: destinationItemId,

          // Preserve the original source details even when that source row is
          // deleted after all of its units have been merged elsewhere.
          source_item_id: sourceItem.id,
          item_name: sourceItem.name,
          sku: sourceItem.sku,

          movement_type: "transfer",
          quantity,
          from_location_id: fromLocation.id,
          to_location_id: toLocation.id,
          reason: notes ?? "Stock moved between locations",
          notes: notes ?? null,
          admin_id: admin.id,
          admin_name: movedByName,
          admin_email: clean(admin.email) || null,
          quantity_before: availableQuantity,
          quantity_after: remainingQuantity,
          created_at: movedAt,
        })
        .select("*")
        .maybeSingle();

    if (movementError) {
      console.warn("Stock move completed without an audit record:", {
        route: ROUTE_NAME,
        itemId: sourceItem.id,
        code: movementError.code ?? null,
        message: movementError.message ?? null,
      });
    }

    const finalQuantity = Math.max(
      0,
      Math.floor(Number(destinationItem?.quantity ?? quantity) || quantity),
    );

    return json({
      ok: true,
      message: `${quantity} unit${quantity === 1 ? "" : "s"} of ${
        sourceItem.name
      } ${quantity === 1 ? "has" : "have"} been moved to ${
        toLocation.name
      }. Stock for this product is now kept in one row at that location.`,
      auditRecorded: !movementError && Boolean(movement),
      warning: movementError
        ? "The stock move succeeded, but its audit record could not be saved."
        : null,
      item: destinationItem,
      items: [
        {
          id: destinationItemId,
          name: destinationItem?.name || sourceItem.name,
          sku: destinationItem?.sku || sourceItem.sku,
          quantity: finalQuantity,
          locationId: toLocation.id,
          locationName: toLocation.name,
          unitValue: Number(sourceItem.unit_cost || 0),
        },
      ],
      movement: {
        id: movement?.id ?? randomUUID(),
        itemId: sourceItem.id,
        fromLocationId: fromLocation.id,
        toLocationId: toLocation.id,
        quantity,
      },
    });
  } catch (caught) {
    const databaseError =
      caught &&
      typeof caught === "object" &&
      "databaseError" in caught
        ? (caught as { databaseError?: SupabaseErrorLike })
            .databaseError
        : null;

    console.error(`${ROUTE_NAME} failed:`, {
      caught,
      itemId,
      fromLocationId,
      toLocationId,
      quantity,
      adminId: admin.id,
    });

    return json(
      {
        ok: false,
        error:
          caught instanceof Error
            ? caught.message
            : "An unexpected error occurred while moving stock.",
        ...(databaseError ? errorPayload(databaseError) : {}),
      },
      500,
    );
  }
}
