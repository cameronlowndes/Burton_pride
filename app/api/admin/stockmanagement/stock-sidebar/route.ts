import { NextResponse } from "next/server";

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
};

const FALLBACK_ITEMS: StockSidebarItem[] = [
  {
    id: "home",
    label: "Stock Dashboard",
    href: STOCK_ROOT,
    icon: "dashboard",
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
    icon: "boxes",
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
    icon: "package-plus",
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
    icon: "history",
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
    icon: "alert",
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
    icon: "suppliers",
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
    icon: "clipboard",
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
    icon: "reports",
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
    icon: "settings",
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

  return (
    lower === "/admin/stockmanagement" ||
    lower.startsWith("/admin/stockmanagement/")
  );
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
    icon: cleanNullableString(row.icon),
    is_enabled: cleanBoolean(row.is_enabled, true),
    sort_order: cleanSortOrder(row.sort_order),
    open_in_new_tab: cleanBoolean(row.open_in_new_tab),
    is_coming_soon: isComingSoon,
    disabled,
    disabled_reason:
      cleanNullableString(row.disabled_reason) ||
      (isComingSoon ? "Coming soon" : !href ? "Unavailable" : null),
    permission_key: cleanNullableString(row.permission_key),
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

function json(
  body: Record<string, unknown>,
  status = 200,
) {
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
  const admin = (await getCurrentAdmin()) as AdminIdentity | null;

  if (!admin) {
    return json(
      {
        ok: false,
        error: "Unauthorised",
        message: "You must be logged in as an admin to load Stock Management.",
      },
      401,
    );
  }

  if (admin.is_active === false) {
    return json(
      {
        ok: false,
        error: "Admin account inactive",
        message:
          "This admin account is inactive and cannot access Stock Management.",
      },
      403,
    );
  }

  if (!canViewStock(admin)) {
    return json(
      {
        ok: false,
        error: "Forbidden",
        message:
          "Your admin account does not have permission to view Stock Management.",
        hint:
          "Add stock:view or stock:manage to this admin account, or use a main_admin account.",
      },
      403,
    );
  }

  try {
    const { data, error } = await supabaseAdmin
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
        ].join(","),
      )
      .eq("is_enabled", true)
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true });

    if (error) {
      console.error("Stock sidebar database query failed:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });

      const fallback = sortItems(
        filterItemsByPermission(FALLBACK_ITEMS, admin),
      );

      return json({
        ok: true,
        items: fallback,
        source: "fallback",
        warning:
          "The stock_sidebar_items table could not be loaded, so built-in menu items are being used.",
        databaseError: {
          code: error.code,
          message: error.message,
          hint: error.hint,
        },
      });
    }

    const rows = Array.isArray(data) ? data : [];

    const databaseItems = rows
      .map((row, index) =>
        normaliseSidebarRow(row as DatabaseSidebarRow, index),
      )
      .filter((item): item is StockSidebarItem => Boolean(item));

    const permittedItems = sortItems(
      filterItemsByPermission(databaseItems, admin),
    );

    if (permittedItems.length === 0) {
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
    console.error("Unexpected stock sidebar API error:", error);

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
