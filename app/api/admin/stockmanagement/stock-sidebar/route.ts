import { NextRequest, NextResponse } from "next/server";

import { getCurrentAdmin } from "@/lib/adminPermissions";
import { supabaseAdmin } from "@/lib/supabase/supabaseAdmin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOCK_ROOT = "/Admin/StockManagement";
const TABLE_NAME = "stock_sidebar_items";

type AdminIdentity = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
  permissions?: unknown;
  is_active?: boolean | null;
};

type StockSidebarItem = {
  id: string;
  label: string;
  href: string | null;
  icon: string | null;
  is_enabled: boolean;
  sort_order: number;
  open_in_new_tab: boolean;
  is_coming_soon: boolean;
  disabled: boolean;
  disabled_reason: string | null;
  permission_key: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DatabaseSidebarRow = {
  id?: unknown;
  label?: unknown;
  href?: unknown;
  icon?: unknown;
  is_enabled?: unknown;
  sort_order?: unknown;
  open_in_new_tab?: unknown;
  is_coming_soon?: unknown;
  coming_soon?: unknown;
  disabled?: unknown;
  disabled_reason?: unknown;
  permission_key?: unknown;
  created_at?: unknown;
  updated_at?: unknown;
};

type SidebarInput = {
  label?: unknown;
  href?: unknown;
  icon?: unknown;
  is_enabled?: unknown;
  sort_order?: unknown;
  open_in_new_tab?: unknown;
  is_coming_soon?: unknown;
  coming_soon?: unknown;
  disabled?: unknown;
  disabled_reason?: unknown;
  permission_key?: unknown;
};

const FALLBACK_ITEMS: StockSidebarItem[] = [
  {
    id: "home",
    label: "Stock Dashboard",
    href: STOCK_ROOT,
    icon: "LayoutDashboard",
    is_enabled: true,
    sort_order: 0,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "inventory",
    label: "All Stock",
    href: `${STOCK_ROOT}/Inventory`,
    icon: "Boxes",
    is_enabled: true,
    sort_order: 10,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "add-stock",
    label: "Add Stock",
    href: `${STOCK_ROOT}/AddStock`,
    icon: "Package",
    is_enabled: true,
    sort_order: 20,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:manage",
  },
  {
    id: "stock-movements",
    label: "Stock Movements",
    href: `${STOCK_ROOT}/Movements`,
    icon: "Package",
    is_enabled: true,
    sort_order: 30,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "low-stock",
    label: "Low Stock Alerts",
    href: `${STOCK_ROOT}/LowStock`,
    icon: "AlertTriangle",
    is_enabled: true,
    sort_order: 40,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "suppliers",
    label: "Suppliers",
    href: `${STOCK_ROOT}/Suppliers`,
    icon: "Truck",
    is_enabled: true,
    sort_order: 50,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "orders",
    label: "Purchase Orders",
    href: `${STOCK_ROOT}/Orders`,
    icon: "ShoppingCart",
    is_enabled: true,
    sort_order: 60,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "reports",
    label: "Stock Reports",
    href: `${STOCK_ROOT}/Reports`,
    icon: "BarChart3",
    is_enabled: true,
    sort_order: 70,
    open_in_new_tab: false,
    is_coming_soon: false,
    disabled: false,
    disabled_reason: null,
    permission_key: "stock:view",
  },
  {
    id: "settings",
    label: "Settings",
    href: `${STOCK_ROOT}/Settings`,
    icon: "Settings",
    is_enabled: true,
    sort_order: 80,
    open_in_new_tab: false,
    is_coming_soon: true,
    disabled: true,
    disabled_reason: "Coming soon",
    permission_key: "stock:manage",
  },
];

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanNullableString(value: unknown) {
  const cleaned = cleanString(value);
  return cleaned || null;
}

function cleanBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanSortOrder(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
}

function isSafeStockHref(value: unknown) {
  const href = cleanString(value);

  if (!href) return false;
  if (!href.startsWith("/")) return false;
  if (href.startsWith("//")) return false;
  if (href.includes("\\")) return false;

  const lower = href.toLowerCase();
  const root = STOCK_ROOT.toLowerCase();

  return lower === root || lower.startsWith(`${root}/`);
}

function inferIconName(labelValue: unknown, hrefValue: unknown) {
  const value = `${cleanString(labelValue)} ${cleanString(hrefValue)}`
    .toLowerCase()
    .trim();

  const rules: Array<{ keywords: string[]; icon: string }> = [
    {
      keywords: ["dashboard", "home", "overview", "summary"],
      icon: "LayoutDashboard",
    },
    {
      keywords: ["low stock", "reorder", "restock", "stock alert", "alerts"],
      icon: "AlertTriangle",
    },
    {
      keywords: ["inventory", "all stock", "stock list", "products", "items"],
      icon: "Boxes",
    },
    {
      keywords: ["warehouse", "storage", "storeroom", "location"],
      icon: "Warehouse",
    },
    {
      keywords: ["supplier", "delivery", "deliveries", "shipping"],
      icon: "Truck",
    },
    {
      keywords: ["purchase order", "orders", "ordering"],
      icon: "ShoppingCart",
    },
    {
      keywords: ["barcode", "scanner", "scan"],
      icon: "ScanBarcode",
    },
    {
      keywords: ["search", "lookup", "find stock"],
      icon: "PackageSearch",
    },
    {
      keywords: ["movement", "movements", "transfer", "add stock"],
      icon: "Package",
    },
    {
      keywords: ["category", "categories", "tag", "tags"],
      icon: "Tags",
    },
    {
      keywords: ["report", "analytics", "statistics"],
      icon: "BarChart3",
    },
    {
      keywords: ["audit", "activity log", "logs", "history"],
      icon: "Logs",
    },
    {
      keywords: ["setting", "configuration", "preferences"],
      icon: "Settings",
    },
    {
      keywords: ["permission", "security", "admin"],
      icon: "ShieldCheck",
    },
    {
      keywords: ["user", "staff", "team", "volunteer"],
      icon: "Users",
    },
    {
      keywords: ["calendar", "schedule", "date"],
      icon: "CalendarDays",
    },
    {
      keywords: ["document", "file"],
      icon: "FileText",
    },
    {
      keywords: ["checklist", "task"],
      icon: "ClipboardList",
    },
    {
      keywords: ["shop", "store"],
      icon: "Store",
    },
    {
      keywords: ["building", "business", "organisation", "organization"],
      icon: "Building2",
    },
    {
      keywords: ["money", "finance", "cost", "budget"],
      icon: "Wallet",
    },
    {
      keywords: ["payment", "card"],
      icon: "CreditCard",
    },
    {
      keywords: ["cash", "banknote"],
      icon: "Banknote",
    },
    {
      keywords: ["receipt", "invoice"],
      icon: "Receipt",
    },
    {
      keywords: ["gift", "donation"],
      icon: "Gift",
    },
    {
      keywords: ["award", "trophy"],
      icon: "Trophy",
    },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => value.includes(keyword))) {
      return rule.icon;
    }
  }

  return "Package";
}

function normaliseSidebarRow(
  row: DatabaseSidebarRow,
  index: number,
): StockSidebarItem | null {
  const label = cleanString(row.label);

  if (!label) return null;

  const rawHref = cleanString(row.href);
  const href = isSafeStockHref(rawHref) ? rawHref : null;
  const isComingSoon = cleanBoolean(
    row.is_coming_soon,
    cleanBoolean(row.coming_soon),
  );
  const disabled = cleanBoolean(row.disabled) || isComingSoon || !href;

  return {
    id: cleanString(row.id) || `stock-sidebar-${index + 1}`,
    label,
    href,
    icon:
      cleanNullableString(row.icon) ||
      inferIconName(label, href),
    is_enabled: cleanBoolean(row.is_enabled, true),
    sort_order: cleanSortOrder(row.sort_order),
    open_in_new_tab: cleanBoolean(row.open_in_new_tab),
    is_coming_soon: isComingSoon,
    disabled,
    disabled_reason:
      cleanNullableString(row.disabled_reason) ||
      (isComingSoon ? "Coming soon" : !href ? "Unavailable" : null),
    permission_key: cleanNullableString(row.permission_key),
    created_at: cleanNullableString(row.created_at),
    updated_at: cleanNullableString(row.updated_at),
  };
}

function getPermissionKeys(admin: AdminIdentity) {
  const permissions = admin.permissions;

  if (Array.isArray(permissions)) {
    return permissions
      .map((permission) => cleanString(permission))
      .filter(Boolean);
  }

  if (permissions && typeof permissions === "object") {
    return Object.entries(permissions as Record<string, unknown>)
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key);
  }

  return [];
}

function isMainAdmin(admin: AdminIdentity) {
  return cleanString(admin.role).toLowerCase() === "main_admin";
}

function canViewStock(admin: AdminIdentity) {
  if (isMainAdmin(admin)) return true;

  const permissions = getPermissionKeys(admin);

  return (
    permissions.includes("stock:view") ||
    permissions.includes("stock:manage") ||
    permissions.includes("admin:dashboard:view")
  );
}

function canManageStockSidebar(admin: AdminIdentity) {
  if (isMainAdmin(admin)) return true;

  const permissions = getPermissionKeys(admin);

  return (
    permissions.includes("stock:manage") ||
    permissions.includes("site_pages:manage")
  );
}

function filterItemsByPermission(
  items: StockSidebarItem[],
  admin: AdminIdentity,
) {
  if (isMainAdmin(admin)) return items;

  const permissions = getPermissionKeys(admin);

  return items.filter((item) => {
    if (!item.permission_key) return true;

    if (item.permission_key === "stock:view") {
      return (
        permissions.includes("stock:view") ||
        permissions.includes("stock:manage")
      );
    }

    return permissions.includes(item.permission_key);
  });
}

function sortItems(items: StockSidebarItem[]) {
  return [...items].sort((a, b) => {
    if (a.sort_order !== b.sort_order) {
      return a.sort_order - b.sort_order;
    }

    return a.label.localeCompare(b.label);
  });
}

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
      Allow: "GET, POST, PATCH, DELETE, OPTIONS",
    },
  });
}

function databaseErrorDetails(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}) {
  return {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  };
}

async function requireStockAdmin(manage = false) {
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    return {
      admin: null,
      response: json(
        {
          ok: false,
          error: "Unauthorised",
          message: "You must be logged in as an admin.",
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
          error: "Admin account inactive",
          message: "This admin account is inactive.",
        },
        403,
      ),
    };
  }

  const hasPermission = manage
    ? canManageStockSidebar(admin)
    : canViewStock(admin);

  if (!hasPermission) {
    return {
      admin: null,
      response: json(
        {
          ok: false,
          error: "Forbidden",
          message: manage
            ? "You do not have permission to manage the Stock Control sidebar."
            : "You do not have permission to view Stock Management.",
          hint: manage
            ? "Add stock:manage or site_pages:manage to this admin account."
            : "Add stock:view or stock:manage to this admin account.",
        },
        403,
      ),
    };
  }

  return { admin, response: null };
}

async function readJsonBody(request: NextRequest) {
  try {
    const body = (await request.json()) as SidebarInput;

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return {
        body: null,
        response: json(
          {
            ok: false,
            error: "Invalid request body",
            message: "The request body must be a JSON object.",
          },
          400,
        ),
      };
    }

    return { body, response: null };
  } catch {
    return {
      body: null,
      response: json(
        {
          ok: false,
          error: "Invalid JSON",
          message: "The request body contains invalid JSON.",
        },
        400,
      ),
    };
  }
}

function getItemId(request: NextRequest) {
  return cleanString(request.nextUrl.searchParams.get("id"));
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, PATCH, DELETE, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

export async function GET() {
  const auth = await requireStockAdmin(false);

  if (auth.response || !auth.admin) {
    return auth.response;
  }

  const admin = auth.admin;
  const managingSidebar = canManageStockSidebar(admin);

  try {
    let query = supabaseAdmin
      .from(TABLE_NAME)
      .select(
        [
          "id",
          "label",
          "href",
          "icon",
          "is_enabled",
          "sort_order",
          "open_in_new_tab",
          "is_coming_soon",
          "disabled",
          "disabled_reason",
          "permission_key",
          "created_at",
          "updated_at",
        ].join(","),
      );

    /*
      Sidebar managers must see disabled records so they can edit and
      re-enable them. Normal Stock Control users only receive enabled records.
    */
    if (!managingSidebar) {
      query = query.eq("is_enabled", true);
    }

    const { data, error } = await query
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("Stock sidebar database query failed:", error);

      const fallback = sortItems(
        filterItemsByPermission(FALLBACK_ITEMS, admin),
      );

      return json({
        ok: true,
        items: fallback,
        source: "fallback",
        warning:
          "The stock_sidebar_items table could not be loaded, so built-in menu items are being used.",
        databaseError: databaseErrorDetails(error),
      });
    }

    const rows = Array.isArray(data) ? data : [];

    const databaseItems = rows
      .map((row, index) =>
        normaliseSidebarRow(row as DatabaseSidebarRow, index),
      )
      .filter((item): item is StockSidebarItem => Boolean(item));

    const permittedItems = sortItems(
      managingSidebar
        ? databaseItems
        : filterItemsByPermission(databaseItems, admin),
    );

    if (permittedItems.length === 0 && !managingSidebar) {
      const fallback = sortItems(
        filterItemsByPermission(FALLBACK_ITEMS, admin),
      );

      return json({
        ok: true,
        items: fallback,
        source: "fallback",
        warning:
          "No enabled stock sidebar records were found, so built-in menu items are being used.",
      });
    }

    return json({
      ok: true,
      items: permittedItems,
      source: "database",
      count: permittedItems.length,
    });
  } catch (error) {
    console.error("Unexpected stock sidebar GET error:", error);

    const fallback = sortItems(
      filterItemsByPermission(FALLBACK_ITEMS, admin),
    );

    return json({
      ok: true,
      items: fallback,
      source: "fallback",
      warning:
        "An unexpected error occurred while loading the stock sidebar, so built-in menu items are being used.",
      technicalDetails:
        process.env.NODE_ENV === "development"
          ? error instanceof Error
            ? error.message
            : String(error)
          : undefined,
    });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireStockAdmin(true);

  if (auth.response || !auth.admin) {
    return auth.response;
  }

  const parsed = await readJsonBody(request);

  if (parsed.response || !parsed.body) {
    return parsed.response;
  }

  const body = parsed.body;
  const label = cleanString(body.label);
  const href = cleanString(body.href);

  if (!label) {
    return json(
      {
        ok: false,
        error: "Label required",
        message: "Please enter a sidebar label.",
      },
      400,
    );
  }

  if (!isSafeStockHref(href)) {
    return json(
      {
        ok: false,
        error: "Invalid Stock Control URL",
        message:
          `The URL must be ${STOCK_ROOT} or start with ${STOCK_ROOT}/.`,
      },
      400,
    );
  }

  const isComingSoon = cleanBoolean(
    body.is_coming_soon,
    cleanBoolean(body.coming_soon),
  );

  const insertData = {
    label,
    href,
    icon:
      cleanNullableString(body.icon) ||
      inferIconName(label, href),
    is_enabled: cleanBoolean(body.is_enabled, true),
    sort_order: cleanSortOrder(body.sort_order),
    open_in_new_tab: cleanBoolean(body.open_in_new_tab),
    is_coming_soon: isComingSoon,
    disabled: cleanBoolean(body.disabled) || isComingSoon,
    disabled_reason:
      cleanNullableString(body.disabled_reason) ||
      (isComingSoon ? "Coming soon" : null),
    permission_key:
      cleanNullableString(body.permission_key) || "stock:view",
  };

  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .insert(insertData)
      .select("*")
      .single();

    if (error) {
      console.error("Stock sidebar POST failed:", error);

      return json(
        {
          ok: false,
          error: "Failed to create sidebar item",
          message: error.message,
          hint: error.hint,
          details: databaseErrorDetails(error),
        },
        500,
      );
    }

    const item = normaliseSidebarRow(data as DatabaseSidebarRow, 0);

    return json(
      {
        ok: true,
        item,
        message: "Stock Control sidebar item created.",
      },
      201,
    );
  } catch (error) {
    console.error("Unexpected stock sidebar POST error:", error);

    return json(
      {
        ok: false,
        error: "Unexpected server error",
        message:
          error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireStockAdmin(true);

  if (auth.response || !auth.admin) {
    return auth.response;
  }

  const id = getItemId(request);

  if (!id) {
    return json(
      {
        ok: false,
        error: "Sidebar item ID required",
        message: "Add ?id=<sidebar-item-id> to the PATCH request.",
      },
      400,
    );
  }

  const parsed = await readJsonBody(request);

  if (parsed.response || !parsed.body) {
    return parsed.response;
  }

  const body = parsed.body;
  const updateData: Record<string, unknown> = {};

  if ("label" in body) {
    const label = cleanString(body.label);

    if (!label) {
      return json(
        {
          ok: false,
          error: "Invalid label",
          message: "The sidebar label cannot be empty.",
        },
        400,
      );
    }

    updateData.label = label;
  }

  if ("href" in body) {
    const href = cleanString(body.href);

    if (!isSafeStockHref(href)) {
      return json(
        {
          ok: false,
          error: "Invalid Stock Control URL",
          message:
            `The URL must be ${STOCK_ROOT} or start with ${STOCK_ROOT}/.`,
        },
        400,
      );
    }

    updateData.href = href;
  }

  if ("icon" in body) {
    updateData.icon = cleanNullableString(body.icon);
  }

  if ("is_enabled" in body) {
    updateData.is_enabled = cleanBoolean(body.is_enabled);
  }

  if ("sort_order" in body) {
    updateData.sort_order = cleanSortOrder(body.sort_order);
  }

  if ("open_in_new_tab" in body) {
    updateData.open_in_new_tab = cleanBoolean(body.open_in_new_tab);
  }

  if ("is_coming_soon" in body || "coming_soon" in body) {
    const isComingSoon = cleanBoolean(
      body.is_coming_soon,
      cleanBoolean(body.coming_soon),
    );

    updateData.is_coming_soon = isComingSoon;

    if (isComingSoon) {
      updateData.disabled = true;

      if (!("disabled_reason" in body)) {
        updateData.disabled_reason = "Coming soon";
      }
    }
  }

  if ("disabled" in body) {
    updateData.disabled = cleanBoolean(body.disabled);
  }

  if ("disabled_reason" in body) {
    updateData.disabled_reason = cleanNullableString(body.disabled_reason);
  }

  if ("permission_key" in body) {
    updateData.permission_key = cleanNullableString(body.permission_key);
  }

  if (Object.keys(updateData).length === 0) {
    return json(
      {
        ok: false,
        error: "No update fields supplied",
        message: "Send at least one supported field to update.",
      },
      400,
    );
  }

  /*
    If the label or href changed and the request did not explicitly send an
    icon, read the current record and recalculate the automatic icon.
  */
  if (
    !("icon" in body) &&
    ("label" in updateData || "href" in updateData)
  ) {
    const { data: current, error: currentError } = await supabaseAdmin
      .from(TABLE_NAME)
      .select("label,href")
      .eq("id", id)
      .maybeSingle();

    if (currentError) {
      return json(
        {
          ok: false,
          error: "Failed to read sidebar item",
          message: currentError.message,
          details: databaseErrorDetails(currentError),
        },
        500,
      );
    }

    if (!current) {
      return json(
        {
          ok: false,
          error: "Sidebar item not found",
          message: `No stock sidebar item exists with ID ${id}.`,
        },
        404,
      );
    }

    const nextLabel =
      typeof updateData.label === "string"
        ? updateData.label
        : cleanString(current.label);

    const nextHref =
      typeof updateData.href === "string"
        ? updateData.href
        : cleanString(current.href);

    updateData.icon = inferIconName(nextLabel, nextHref);
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .update(updateData)
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("Stock sidebar PATCH failed:", error);

      return json(
        {
          ok: false,
          error: "Failed to update sidebar item",
          message: error.message,
          hint: error.hint,
          details: databaseErrorDetails(error),
        },
        500,
      );
    }

    if (!data) {
      return json(
        {
          ok: false,
          error: "Sidebar item not found",
          message: `No stock sidebar item exists with ID ${id}.`,
        },
        404,
      );
    }

    const item = normaliseSidebarRow(data as DatabaseSidebarRow, 0);

    return json({
      ok: true,
      item,
      message: "Stock Control sidebar item updated.",
    });
  } catch (error) {
    console.error("Unexpected stock sidebar PATCH error:", error);

    return json(
      {
        ok: false,
        error: "Unexpected server error",
        message:
          error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireStockAdmin(true);

  if (auth.response || !auth.admin) {
    return auth.response;
  }

  const id = getItemId(request);

  if (!id) {
    return json(
      {
        ok: false,
        error: "Sidebar item ID required",
        message: "Add ?id=<sidebar-item-id> to the DELETE request.",
      },
      400,
    );
  }

  try {
    const { data, error } = await supabaseAdmin
      .from(TABLE_NAME)
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      console.error("Stock sidebar DELETE failed:", error);

      return json(
        {
          ok: false,
          error: "Failed to delete sidebar item",
          message: error.message,
          hint: error.hint,
          details: databaseErrorDetails(error),
        },
        500,
      );
    }

    if (!data) {
      return json(
        {
          ok: false,
          error: "Sidebar item not found",
          message: `No stock sidebar item exists with ID ${id}.`,
        },
        404,
      );
    }

    return json({
      ok: true,
      deleted_id: id,
      message: "Stock Control sidebar item deleted.",
    });
  } catch (error) {
    console.error("Unexpected stock sidebar DELETE error:", error);

    return json(
      {
        ok: false,
        error: "Unexpected server error",
        message:
          error instanceof Error ? error.message : String(error),
      },
      500,
    );
  }
}
