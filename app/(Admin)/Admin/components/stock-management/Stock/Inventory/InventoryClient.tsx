"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  createTestInventoryPayload,
  getTestItemSuccessMessage,
} from "./inventoryTestItem";
import InventoryHeaderActions from "./InventoryHeaderActions";
import { exportInventoryWorkbook } from "./exportInventoryWorkbook";
import MoveStockModal, {
  EMPTY_MOVE_STOCK_FORM,
  type MoveStockFormState,
} from "../AddStock/MoveStockModal";
import AddStockModal from "../AddStock/AddStockModal";
import AddItemModal, {
  EMPTY_ADD_ITEM_FORM,
  type AddItemFormState,
} from "../AddStock/AddStockModal";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  Plus,
  Search,
  SlidersHorizontal,
  Tags,
  Trash2,
  Warehouse,
  X,
} from "lucide-react";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "archived";

type StockItem = {
  id: string;
  name: string;
  sku: string;
  barcode?: string | null;
  description?: string | null;
  category?: string | null;
  location?: string | null;
  supplier?: string | null;
  quantity: number;
  reorderLevel: number;
  targetLevel?: number | null;
  unitCost?: number | null;
  salePrice?: number | null;
  stockValue?: number | null;
  status: StockStatus;
  isActive: boolean;
  updatedAt?: string | null;
  updatedByName?: string | null;
};

type InventorySummary = {
  totalItems: number;
  totalUnits: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalValue: number;
};

type InventoryResponse = {
  ok?: boolean;
  items?: StockItem[];
  summary?: InventorySummary;
  item?: StockItem;
  movement?: unknown;
  message?: string;
  error?: string;
  code?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  status?: number;
};

type StockLocationOption = {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  isActive?: boolean;
};

type LocationsResponse = {
  ok?: boolean;
  locations?: StockLocationOption[];
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type StockAdjustmentFormState = {
  item: StockItem;
  movementType: "add" | "remove" | "set";
  quantity: string;
  reason: string;
  notes: string;
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  errorReference?: string;
  likelyCauses?: string[];
  suggestedFixes?: string[];
  technicalDetails?: string[];
};

const INVENTORY_ENDPOINT = "/api/admin/stockmanagement/inventory";
const MOVEMENT_ENDPOINT = "/api/admin/stockmanagement/inventory/movements";
const MOVE_STOCK_ENDPOINT =
  "/api/admin/stockmanagement/locations/movestock";
const LOCATIONS_ENDPOINT = "/api/admin/stockmanagement/locations";
const STOCK_AUDIT_ENDPOINT = "/api/admin/stockmanagement/audit-logs";

type StockAuditPayload = {
  action: string;
  actionLabel: string;
  summary: string;
  recordType: "stock_item" | "stock_movement" | "inventory_report";
  recordId?: string | null;
  recordTitle?: string | null;
  reason?: string | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  changedFields?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

async function reportStockAudit(payload: StockAuditPayload) {
  try {
    const response = await fetch(STOCK_AUDIT_ENDPOINT, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const json = (await response.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
    };

    if (!response.ok || !json.ok) {
      console.error("Stock audit log failed", {
        status: response.status,
        action: payload.action,
        error: json.error || "Unknown audit error",
      });
      return false;
    }

    return true;
  } catch (error) {
    console.error("Stock audit log request failed", {
      action: payload.action,
      error: error instanceof Error ? error.message : error,
    });
    return false;
  }
}

const EMPTY_SUMMARY: InventorySummary = {
  totalItems: 0,
  totalUnits: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
  totalValue: 0,
};

function formatCurrency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusFor(item: StockItem): StockStatus {
  if (!item.isActive) return "archived";
  if (item.quantity <= 0) return "out_of_stock";
  if (item.quantity <= item.reorderLevel) return "low_stock";
  return "in_stock";
}

function statusLabel(status: StockStatus) {
  if (status === "in_stock") return "In stock";
  if (status === "low_stock") return "Low stock";
  if (status === "out_of_stock") return "Out of stock";
  return "Archived";
}

function numberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

type ApiErrorPayload = InventoryResponse & Partial<LocationsResponse> & {
  requestId?: string;
  request_id?: string;
  correlationId?: string;
  correlation_id?: string;
  path?: string;
  timestamp?: string;
};

type DetailedApiError = Error & {
  title?: string;
  status?: number;
  statusText?: string;
  endpoint?: string;
  method?: string;
  code?: string;
  reason?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  responseBody?: string | null;
  requestId?: string | null;
  occurredAt?: string;
  isNetworkError?: boolean;
  likelyCauses?: string[];
  suggestedFixes?: string[];
};

function createErrorReference() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `STOCK-${Date.now().toString(36).toUpperCase()}-${randomPart}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueMessages(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.map(cleanText).filter(Boolean)));
}

function safeResponsePreview(rawText: string) {
  const compact = rawText.replace(/\s+/g, " ").trim();
  return compact.length > 800 ? `${compact.slice(0, 800)}…` : compact;
}

async function readApiResponse(
  response: Response,
): Promise<{
  json: ApiErrorPayload | null;
  rawText: string;
}> {
  let rawText = "";

  try {
    rawText = await response.text();
  } catch (caught) {
    rawText = caught instanceof Error
      ? `The response body could not be read: ${caught.message}`
      : "The response body could not be read.";
  }

  if (!rawText) {
    return { json: null, rawText: "" };
  }

  try {
    const parsed = JSON.parse(rawText) as unknown;

    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        json: parsed as ApiErrorPayload,
        rawText,
      };
    }

    return { json: null, rawText };
  } catch {
    return { json: null, rawText };
  }
}

function diagnoseApiFailure(params: {
  status?: number;
  code?: string;
  message: string;
  details?: string | null;
  hint?: string | null;
  endpoint: string;
}) {
  const combined = [
    params.code,
    params.message,
    params.details,
    params.hint,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const likelyCauses: string[] = [];
  const suggestedFixes: string[] = [];

  if (params.status === 401) {
    likelyCauses.push("The admin session cookie is missing, expired or no longer valid.");
    suggestedFixes.push("Sign out, sign back in, then retry the action.");
    suggestedFixes.push("Check that the API reads the same Supabase admin session cookies used by the admin portal.");
  }

  if (params.status === 403) {
    likelyCauses.push("The signed-in account does not have the required Stock Management permission or main-admin access.");
    suggestedFixes.push("Check the admin role and permission checks used by this API route.");
  }

  if (params.status === 404) {
    likelyCauses.push(`No API handler was found for ${params.endpoint}.`);
    suggestedFixes.push("Check the app/api folder spelling, route.ts filename and StockManagement path casing.");
    suggestedFixes.push("Restart the Next.js development server after creating or moving the route.");
  }

  if (params.status === 405) {
    likelyCauses.push("The route exists, but it does not export a handler for this HTTP method.");
    suggestedFixes.push("Add the matching GET, POST, PATCH or DELETE export to route.ts.");
  }

  if (params.status === 409 || combined.includes("duplicate") || combined.includes("23505")) {
    likelyCauses.push("A record already uses the same SKU, barcode, name or other unique value.");
    suggestedFixes.push("Use a unique SKU/barcode, or update the existing stock item instead.");
  }

  if (params.status === 422 || params.status === 400) {
    likelyCauses.push("One or more submitted values are missing, malformed or use the wrong field name/type.");
    suggestedFixes.push("Compare the client JSON body with the API validation schema and Supabase column names.");
  }

  if (combined.includes("pgrst205") || combined.includes("could not find the table")) {
    likelyCauses.push("Supabase cannot find the required table in its schema cache.");
    suggestedFixes.push("Create the missing public.stock_items, stock_locations or stock_movements table.");
    suggestedFixes.push("Confirm the table is in the public schema, then reload the Supabase schema cache.");
  }

  if (combined.includes("pgrst204") || combined.includes("could not find the") && combined.includes("column")) {
    likelyCauses.push("The API is sending or selecting a column that does not exist in Supabase.");
    suggestedFixes.push("Compare every select/insert/update field with the exact database column names.");
    suggestedFixes.push("Reload the Supabase schema cache after adding or renaming columns.");
  }

  if (combined.includes("23503") || combined.includes("foreign key")) {
    likelyCauses.push("The selected stock item or location references a record that does not exist.");
    suggestedFixes.push("Check the item ID, current location ID and destination location ID before saving.");
  }

  if (combined.includes("23502") || combined.includes("not-null") || combined.includes("null value")) {
    likelyCauses.push("A required database column received no value.");
    suggestedFixes.push("Send the missing required field or add a sensible database default.");
  }

  if (combined.includes("22p02") || combined.includes("invalid input syntax")) {
    likelyCauses.push("A value was sent using the wrong database type, commonly an invalid UUID or number.");
    suggestedFixes.push("Check that IDs are valid UUIDs and numeric fields are converted before the request is sent.");
  }

  if (combined.includes("row-level security") || combined.includes("rls")) {
    likelyCauses.push("Supabase Row Level Security blocked the database operation.");
    suggestedFixes.push("Use the server-side service-role client for protected admin routes, or add the correct RLS policy.");
  }

  if (combined.includes("fetch failed") || combined.includes("failed to fetch") || combined.includes("networkerror")) {
    likelyCauses.push("The browser could not reach the API route.");
    suggestedFixes.push("Check that the Next.js server is running and inspect the browser Network tab.");
  }

  if (params.status === 429) {
    likelyCauses.push("The server or upstream service rate-limited the request.");
    suggestedFixes.push("Wait briefly, then retry once rather than repeatedly clicking the action.");
  }

  if (params.status && params.status >= 500) {
    likelyCauses.push("The API route threw an unhandled server or Supabase error.");
    suggestedFixes.push("Check the terminal output and Supabase logs using the error reference and request time below.");
    suggestedFixes.push("Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set on the server.");
  }

  if (!likelyCauses.length) {
    likelyCauses.push("The API returned an unexpected response that the inventory page could not process.");
  }

  if (!suggestedFixes.length) {
    suggestedFixes.push("Refresh the page once, then inspect the technical details and server logs if it happens again.");
  }

  return {
    likelyCauses: uniqueMessages(likelyCauses),
    suggestedFixes: uniqueMessages(suggestedFixes),
  };
}

function createDetailedApiError(params: {
  response?: Response;
  json?: ApiErrorPayload | null;
  rawText?: string;
  endpoint: string;
  method: string;
  fallbackTitle: string;
  fallbackMessage: string;
}): DetailedApiError {
  const status = params.response?.status;
  const statusText = params.response?.statusText || "";
  const serverMessage = uniqueMessages([
    params.json?.error,
    params.json?.message,
    params.json?.reason,
  ])[0] || "";

  const message =
    serverMessage ||
    (status === 401
      ? "Your admin session is missing or has expired. Sign in again and retry."
      : status === 403
        ? "Your administrator account does not have permission to perform this action."
        : status === 404
          ? `The API route was not found: ${params.endpoint}.`
          : status === 405
            ? `The API route does not allow ${params.method} requests.`
            : status === 409
              ? "The request conflicts with an existing stock record."
              : status === 422 || status === 400
                ? "The server could not accept one or more submitted values."
                : status === 429
                  ? "Too many requests were made. Please retry shortly."
                  : status && status >= 500
                    ? "The server failed while processing the stock request."
                    : params.fallbackMessage);

  const diagnosis = diagnoseApiFailure({
    status,
    code: params.json?.code,
    message,
    details: params.json?.details,
    hint: params.json?.hint,
    endpoint: params.endpoint,
  });

  const error = new Error(message) as DetailedApiError;
  const headerRequestId =
    params.response?.headers.get("x-request-id") ||
    params.response?.headers.get("x-vercel-id") ||
    params.response?.headers.get("cf-ray");

  error.title = params.fallbackTitle;
  error.status = status;
  error.statusText = statusText;
  error.endpoint = params.endpoint;
  error.method = params.method;
  error.code = params.json?.code;
  error.reason = params.json?.reason;
  error.details = params.json?.details;
  error.hint = params.json?.hint;
  error.field = params.json?.field;
  error.requestId =
    params.json?.requestId ||
    params.json?.request_id ||
    params.json?.correlationId ||
    params.json?.correlation_id ||
    headerRequestId ||
    null;
  error.occurredAt = new Date().toISOString();
  error.responseBody = !params.json && params.rawText
    ? safeResponsePreview(params.rawText)
    : null;
  error.likelyCauses = diagnosis.likelyCauses;
  error.suggestedFixes = diagnosis.suggestedFixes;

  return error;
}

function createNetworkApiError(params: {
  caught: unknown;
  endpoint: string;
  method: string;
  title: string;
  fallbackMessage: string;
}): DetailedApiError {
  const originalMessage =
    params.caught instanceof Error ? params.caught.message : "Unknown network error";
  const error = new Error(
    originalMessage || params.fallbackMessage,
  ) as DetailedApiError;

  error.title = params.title;
  error.endpoint = params.endpoint;
  error.method = params.method;
  error.occurredAt = new Date().toISOString();
  error.isNetworkError = true;
  error.reason = originalMessage;
  error.likelyCauses = [
    "The browser could not connect to the Stock Management API.",
    "The Next.js server may be stopped, restarting, or blocked by a network problem.",
  ];
  error.suggestedFixes = [
    "Check that the development or production server is running.",
    "Open the browser Network tab and retry the request.",
    "Confirm the API endpoint path is correct and uses the same website origin.",
  ];

  return error;
}

function noticeFromError(
  caught: unknown,
  fallbackTitle: string,
  fallbackMessage: string,
): Notice {
  if (!(caught instanceof Error)) {
    return {
      tone: "error",
      title: fallbackTitle,
      message: fallbackMessage,
      errorReference: createErrorReference(),
      likelyCauses: ["An unknown non-standard error was thrown."],
      suggestedFixes: ["Check the browser console and server terminal for the original error."],
    };
  }

  const error = caught as DetailedApiError;
  const technicalDetails: string[] = [];
  const errorReference = createErrorReference();

  technicalDetails.push(`Error reference: ${errorReference}`);
  technicalDetails.push(`Time: ${error.occurredAt || new Date().toISOString()}`);
  technicalDetails.push(`Browser online: ${typeof navigator === "undefined" ? "Unknown" : navigator.onLine ? "Yes" : "No"}`);

  if (typeof error.status === "number") {
    technicalDetails.push(
      `HTTP status: ${error.status}${error.statusText ? ` ${error.statusText}` : ""}`,
    );
  } else if (error.isNetworkError) {
    technicalDetails.push("HTTP status: No response received");
  }

  if (error.method && error.endpoint) {
    technicalDetails.push(`Request: ${error.method} ${error.endpoint}`);
  }

  if (error.requestId) technicalDetails.push(`Server request ID: ${error.requestId}`);
  if (error.code) technicalDetails.push(`Error code: ${error.code}`);
  if (error.reason && error.reason !== error.message) technicalDetails.push(`Reason: ${error.reason}`);
  if (error.field) technicalDetails.push(`Affected field: ${error.field}`);
  if (error.details) technicalDetails.push(`Server details: ${error.details}`);
  if (error.hint) technicalDetails.push(`Server hint: ${error.hint}`);
  if (error.responseBody) technicalDetails.push(`Non-JSON response: ${error.responseBody}`);

  return {
    tone: "error",
    title: error.title || fallbackTitle,
    message: error.message || fallbackMessage,
    errorReference,
    likelyCauses: error.likelyCauses,
    suggestedFixes: error.suggestedFixes,
    technicalDetails: uniqueMessages(technicalDetails),
  };
}

function normaliseItem(item: Partial<StockItem>): StockItem {
  const quantity = Number(item.quantity || 0);
  const reorderLevel = Number(item.reorderLevel || 0);

  const normalised: StockItem = {
    id: String(item.id || ""),
    name: String(item.name || "Unnamed item"),
    sku: String(item.sku || ""),
    barcode: item.barcode || null,
    description: item.description || null,
    category: item.category || null,
    location: item.location || null,
    supplier: item.supplier || null,
    quantity,
    reorderLevel,
    targetLevel:
      item.targetLevel === null || item.targetLevel === undefined
        ? null
        : Number(item.targetLevel),
    unitCost:
      item.unitCost === null || item.unitCost === undefined
        ? null
        : Number(item.unitCost),
    salePrice:
      item.salePrice === null || item.salePrice === undefined
        ? null
        : Number(item.salePrice),
    stockValue:
      item.stockValue === null || item.stockValue === undefined
        ? Number(item.unitCost || 0) * quantity
        : Number(item.stockValue),
    status: item.status || "in_stock",
    isActive: item.isActive !== false,
    updatedAt: item.updatedAt || null,
    updatedByName: item.updatedByName || null,
  };

  normalised.status = statusFor(normalised);

  return normalised;
}

export default function InventoryClient() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<StockLocationOption[]>([]);
  const [summary, setSummary] = useState<InventorySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTestItem, setCreatingTestItem] = useState(false);
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StockStatus>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "name" | "quantity" | "value" | "updated"
  >("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [form, setForm] =
    useState<AddItemFormState>(EMPTY_ADD_ITEM_FORM);
  const [moveForm, setMoveForm] =
    useState<MoveStockFormState>(EMPTY_MOVE_STOCK_FORM);
  const [adjustForm, setAdjustForm] =
    useState<StockAdjustmentFormState | null>(null);
  const [activeItem, setActiveItem] = useState<StockItem | null>(null);

  const loadLocations = useCallback(async () => {
    try {
      const response = await fetch(LOCATIONS_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const rawText = await response.text();
      let json: LocationsResponse | null = null;

      if (rawText) {
        try {
          json = JSON.parse(rawText) as LocationsResponse;
        } catch {
          json = null;
        }
      }

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json: json as InventoryResponse | null,
          rawText,
          endpoint: LOCATIONS_ENDPOINT,
          method: "GET",
          fallbackTitle: "Stock locations could not be loaded",
          fallbackMessage:
            "The location list is unavailable. Create the locations table and API, then refresh this page.",
        });
      }

      setLocations(
        Array.isArray(json.locations)
          ? json.locations.filter((location) => location.isActive !== false)
          : [],
      );
    } catch (caught) {
      setLocations([]);
      setNotice(
        noticeFromError(
          caught,
          "Stock locations could not be loaded",
          "The item form can still open, but a storage location cannot be selected until the location API is available.",
        ),
      );
    }
  }, []);

  const loadInventory = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: INVENTORY_ENDPOINT,
          method: "GET",
          fallbackTitle: "Inventory could not be loaded",
          fallbackMessage:
            "The inventory API did not return a successful response.",
        });
      }

      const nextItems = Array.isArray(json.items)
        ? json.items.map(normaliseItem)
        : [];

      setItems(nextItems);
      setSummary(
        json.summary || {
          totalItems: nextItems.filter((item) => item.isActive).length,
          totalUnits: nextItems.reduce(
            (total, item) => total + item.quantity,
            0,
          ),
          lowStockItems: nextItems.filter(
            (item) => item.status === "low_stock",
          ).length,
          outOfStockItems: nextItems.filter(
            (item) => item.status === "out_of_stock",
          ).length,
          totalValue: nextItems.reduce(
            (total, item) => total + Number(item.stockValue || 0),
            0,
          ),
        },
      );
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setNotice(
        noticeFromError(
          caught,
          "Inventory could not be loaded",
          "Please refresh the page and try again.",
        ),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadInventory(), loadLocations()]);
  }, [loadInventory, loadLocations]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [items],
  );

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const nextItems = items.filter((item) => {
      const matchesSearch =
        !cleanQuery ||
        [
          item.name,
          item.sku,
          item.barcode,
          item.category,
          item.location,
          item.supplier,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(cleanQuery));

      const matchesStatus =
        statusFilter === "all" || item.status === statusFilter;

      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;

      const selectedLocation =
        locationFilter === "all"
          ? null
          : locations.find((location) => location.id === locationFilter) || null;

      const matchesLocation =
        locationFilter === "all" ||
        item.location === locationFilter ||
        Boolean(
          selectedLocation &&
            item.location?.trim().toLowerCase() ===
              selectedLocation.name.trim().toLowerCase(),
        );

      return (
        matchesSearch &&
        matchesStatus &&
        matchesCategory &&
        matchesLocation
      );
    });

    nextItems.sort((left, right) => {
      let result = 0;

      if (sortBy === "name") {
        result = left.name.localeCompare(right.name);
      } else if (sortBy === "quantity") {
        result = left.quantity - right.quantity;
      } else if (sortBy === "value") {
        result =
          Number(left.stockValue || 0) - Number(right.stockValue || 0);
      } else {
        result =
          new Date(left.updatedAt || 0).getTime() -
          new Date(right.updatedAt || 0).getTime();
      }

      return sortDirection === "asc" ? result : -result;
    });

    return nextItems;
  }, [
    items,
    query,
    statusFilter,
    categoryFilter,
    locationFilter,
    locations,
    sortBy,
    sortDirection,
  ]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  function openMoveModal(item?: StockItem) {
    const selectedItem =
      item ||
      (selectedIds.length === 1
        ? items.find((stockItem) => stockItem.id === selectedIds[0])
        : undefined);

    setMoveForm({
      ...EMPTY_MOVE_STOCK_FORM,
      stockItemId: selectedItem?.id || "",
    });
    setShowMoveModal(true);
    setNotice(null);
  }

  function openCreateModal() {
    setForm(EMPTY_ADD_ITEM_FORM);
    setShowItemModal(true);
    setNotice(null);
  }

  function openEditModal(item: StockItem) {
    setForm({
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode || "",
      description: item.description || "",
      category: item.category || "",
      location:
        locations.find(
          (location) =>
            location.id === item.location ||
            location.name.trim().toLowerCase() ===
              String(item.location || "").trim().toLowerCase(),
        )?.id ||
        item.location ||
        "",
      supplier: item.supplier || "",
      quantity: String(item.quantity),
      reorderLevel: String(item.reorderLevel),
      targetLevel:
        item.targetLevel === null || item.targetLevel === undefined
          ? ""
          : String(item.targetLevel),
      unitCost:
        item.unitCost === null || item.unitCost === undefined
          ? ""
          : String(item.unitCost),
      salePrice:
        item.salePrice === null || item.salePrice === undefined
          ? ""
          : String(item.salePrice),
      isActive: item.isActive,
    });
    setShowItemModal(true);
    setNotice(null);
  }

  function openAdjustModal(item: StockItem) {
    setAdjustForm({
      item,
      movementType: "add",
      quantity: "1",
      reason: "",
      notes: "",
    });
    setShowAdjustModal(true);
    setNotice(null);
  }

  function openDeleteModal(item: StockItem) {
    setActiveItem(item);
    setShowDeleteModal(true);
    setNotice(null);
  }

  function openDetailsModal(item: StockItem) {
    setActiveItem(item);
    setShowDetailsModal(true);
  }

  async function saveItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const name = form.name.trim();
    const sku = form.sku.trim();

    if (!name || !sku) {
      setNotice({
        tone: "warning",
        title: "Name and SKU are required",
        message: "Enter an item name and a unique SKU before saving.",
      });
      return;
    }

    const quantity = numberValue(form.quantity);
    const reorderLevel = numberValue(form.reorderLevel);
    const targetLevel = form.targetLevel
      ? numberValue(form.targetLevel)
      : null;

    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !Number.isInteger(reorderLevel) ||
      reorderLevel < 0 ||
      (targetLevel !== null &&
        (!Number.isInteger(targetLevel) || targetLevel < 0))
    ) {
      setNotice({
        tone: "warning",
        title: "Check the stock levels",
        message:
          "Current quantity, reorder level and target level must be whole numbers of zero or more.",
      });
      return;
    }

    const previousItem = form.id
      ? items.find((item) => item.id === form.id) || null
      : null;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: form.id ? "PATCH" : "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: form.id,
          name,
          sku,
          barcode: form.barcode.trim() || null,
          description: form.description.trim() || null,
          category: form.category.trim() || null,
          location: form.location.trim() || null,
          supplier: form.supplier.trim() || null,
          quantity,
          reorderLevel,
          targetLevel,
          unitCost: form.unitCost ? numberValue(form.unitCost) : null,
          salePrice: form.salePrice ? numberValue(form.salePrice) : null,
          isActive: form.isActive,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: INVENTORY_ENDPOINT,
          method: form.id ? "PATCH" : "POST",
          fallbackTitle: "Stock item could not be saved",
          fallbackMessage:
            "The inventory API rejected the stock item.",
        });
      }

      const savedItem = json.item ? normaliseItem(json.item) : null;
      const auditOk = await reportStockAudit({
        action: form.id ? "stock.item.updated" : "stock.item.created",
        actionLabel: form.id ? "Stock item updated" : "Stock item created",
        summary: form.id
          ? `${name} was updated in Stock Management.`
          : `${name} was added to Stock Management.`,
        recordType: "stock_item",
        recordId: savedItem?.id || form.id || null,
        recordTitle: name,
        reason: form.id ? "Stock item details were edited." : "New stock item created.",
        beforeData: previousItem ? { ...previousItem } : null,
        afterData: savedItem || {
          id: form.id || null, name, sku, barcode: form.barcode.trim() || null,
          description: form.description.trim() || null, category: form.category.trim() || null,
          location: form.location.trim() || null, supplier: form.supplier.trim() || null,
          quantity, reorderLevel, targetLevel,
          unitCost: form.unitCost ? numberValue(form.unitCost) : null,
          salePrice: form.salePrice ? numberValue(form.salePrice) : null,
          isActive: form.isActive,
        },
        metadata: { source: "stock_inventory_client", endpoint: INVENTORY_ENDPOINT },
      });

      setShowItemModal(false);
      setForm(EMPTY_ADD_ITEM_FORM);
      setNotice({
        tone: "success",
        title: form.id ? "Stock item updated" : "Stock item created",
        message: auditOk
          ? `${name} has been saved successfully and recorded in the audit log.`
          : `${name} was saved, but the audit entry could not be confirmed. Check the server logs.`,
      });
      await loadInventory();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock item could not be saved",
          "Please check the details and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (saving) return;

    const stockItem = items.find((item) => item.id === moveForm.stockItemId);

    if (!stockItem) {
      setNotice({
        tone: "warning",
        title: "Select a stock item",
        message: "Choose the stock item that you want to move.",
      });
      return;
    }

    const destinationLocationId = moveForm.destinationLocation.trim();
    const destination = locations.find(
      (location) => location.id === destinationLocationId,
    );

    if (!destinationLocationId || !destination) {
      setNotice({
        tone: "warning",
        title: "Select a new location",
        message: "Choose an active storage location.",
      });
      return;
    }

    const currentLocationValue = String(stockItem.location || "").trim();

    const currentLocation = locations.find(
      (location) =>
        location.id === currentLocationValue ||
        location.name.toLowerCase() === currentLocationValue.toLowerCase(),
    );

    if (!currentLocation) {
      setNotice({
        tone: "warning",
        title: "Current location could not be found",
        message:
          "This stock item does not have a valid current location. Edit the item and assign it to an active location before moving it.",
      });
      return;
    }

    if (currentLocation.id === destination.id) {
      setNotice({
        tone: "warning",
        title: "Choose a different location",
        message: `${stockItem.name} is already stored in ${destination.name}.`,
      });
      return;
    }

    if (!moveForm.reason.trim()) {
      setNotice({
        tone: "warning",
        title: "A reason is required",
        message: "Explain why the stock item is being moved.",
      });
      return;
    }

    if (!Number.isInteger(stockItem.quantity) || stockItem.quantity < 1) {
      setNotice({
        tone: "warning",
        title: "This item cannot be moved",
        message:
          "The stock item must have at least one available unit before it can be moved.",
      });
      return;
    }

    const moveQuantity = moveForm.moveAllStock
      ? stockItem.quantity
      : Number(moveForm.quantity);

    if (
      !Number.isInteger(moveQuantity) ||
      moveQuantity < 1 ||
      moveQuantity > stockItem.quantity
    ) {
      setNotice({
        tone: "warning",
        title: "Enter a valid move quantity",
        message: `Choose a whole number between 1 and ${stockItem.quantity}, or select Move all stock.`,
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const combinedNotes = [
        moveForm.reason.trim(),
        moveForm.notes.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch(MOVE_STOCK_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemId: stockItem.id,
          fromLocationId: currentLocation.id,
          toLocationId: destination.id,
          quantity: moveQuantity,
          notes: combinedNotes || null,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: MOVE_STOCK_ENDPOINT,
          method: "POST",
          fallbackTitle: "Stock item could not be moved",
          fallbackMessage:
            "The shared move-stock API rejected the location change.",
        });
      }

      const auditOk = await reportStockAudit({
        action: "stock.location.moved",
        actionLabel: "Stock moved between locations",
        summary: `${moveQuantity} unit${moveQuantity === 1 ? "" : "s"} of ${stockItem.name} moved from ${currentLocation.name} to ${destination.name}.`,
        recordType: "stock_movement",
        recordId: stockItem.id,
        recordTitle: stockItem.name,
        reason: moveForm.reason.trim(),
        beforeData: { locationId: currentLocation.id, locationName: currentLocation.name, quantity: stockItem.quantity },
        afterData: { locationId: destination.id, locationName: destination.name, quantityMoved: moveQuantity },
        changedFields: { location: { before: currentLocation.name, after: destination.name }, quantityMoved: moveQuantity },
        metadata: { notes: moveForm.notes.trim() || null, moveAllStock: moveForm.moveAllStock, endpoint: MOVE_STOCK_ENDPOINT },
      });

      setShowMoveModal(false);
      setMoveForm(EMPTY_MOVE_STOCK_FORM);
      setSelectedIds([]);

      setNotice({
        tone: "success",
        title: "Stock moved",
        message:
          json.message ||
          `${stockItem.name} has been moved to ${destination.name}.${auditOk ? " The change was recorded in the audit log." : " The audit entry could not be confirmed."}`,
      });

      await Promise.all([loadInventory(), loadLocations()]);
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock item could not be moved",
          "Check the item's current location and destination, then try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adjustForm || saving) return;

    const quantity = numberValue(adjustForm.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      (!quantity && adjustForm.movementType !== "set")
    ) {
      setNotice({
        tone: "warning",
        title: "Enter a valid quantity",
        message: "The stock adjustment quantity must be zero or more.",
      });
      return;
    }

    if (!adjustForm.reason.trim()) {
      setNotice({
        tone: "warning",
        title: "A reason is required",
        message: "Explain why the stock quantity is being changed.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(MOVEMENT_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          stockItemId: adjustForm.item.id,
          movementType: adjustForm.movementType,
          quantity,
          reason: adjustForm.reason.trim(),
          notes: adjustForm.notes.trim() || null,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: MOVEMENT_ENDPOINT,
          method: "POST",
          fallbackTitle: "Stock quantity could not be updated",
          fallbackMessage:
            "The stock movement API rejected the adjustment.",
        });
      }

      const oldQuantity = adjustForm.item.quantity;
      const newQuantity =
        adjustForm.movementType === "add"
          ? oldQuantity + quantity
          : adjustForm.movementType === "remove"
            ? Math.max(0, oldQuantity - quantity)
            : quantity;

      const auditOk = await reportStockAudit({
        action: "stock.quantity.adjusted",
        actionLabel: "Stock quantity adjusted",
        summary: `${adjustForm.item.name} quantity changed from ${oldQuantity} to ${newQuantity}.`,
        recordType: "stock_movement",
        recordId: adjustForm.item.id,
        recordTitle: adjustForm.item.name,
        reason: adjustForm.reason.trim(),
        beforeData: { quantity: oldQuantity },
        afterData: { quantity: newQuantity },
        changedFields: { quantity: { before: oldQuantity, after: newQuantity } },
        metadata: { movementType: adjustForm.movementType, enteredQuantity: quantity, notes: adjustForm.notes.trim() || null, endpoint: MOVEMENT_ENDPOINT },
      });

      setShowAdjustModal(false);
      setAdjustForm(null);
      setNotice({
        tone: "success",
        title: "Stock quantity updated",
        message: auditOk
          ? `${adjustForm.item.name} has been adjusted and recorded in the audit log.`
          : `${adjustForm.item.name} was adjusted, but the audit entry could not be confirmed.`,
      });
      await loadInventory();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock quantity could not be updated",
          "Please check the adjustment and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteItem(password: string) {
    if (!activeItem || saving) return;

    setSaving(true);
    setNotice(null);

    try {
      // 1. Verify the main admin password first
      const authResponse = await fetch("/api/admin/settings/delete-password", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const authData = await readApiResponse(authResponse);

      if (!authResponse.ok || !authData.json?.ok) {
        throw createDetailedApiError({
          response: authResponse,
          json: authData.json,
          rawText: authData.rawText,
          endpoint: "/api/admin/settings/delete-password",
          method: "POST",
          fallbackTitle: "Authorisation failed",
          fallbackMessage:
            "The main admin password was incorrect or could not be verified.",
        });
      }

      // 2. If the password is correct, permanently delete the item
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: activeItem.id,
          password,
          action: "delete",
          permanentDelete: true,
        }),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: INVENTORY_ENDPOINT,
          method: "DELETE",
          fallbackTitle: "Stock item could not be deleted",
          fallbackMessage:
            "The inventory API rejected the permanent delete request.",
        });
      }

      const deletedItem = activeItem;
      const auditOk = await reportStockAudit({
        action: "stock.item.deleted",
        actionLabel: "Stock item permanently deleted",
        summary: `${deletedItem.name} was permanently deleted from Stock Management.`,
        recordType: "stock_item",
        recordId: deletedItem.id,
        recordTitle: deletedItem.name,
        reason: "Permanent deletion authorised with the main-admin password.",
        beforeData: { ...deletedItem },
        afterData: null,
        metadata: { permanentDelete: true, endpoint: INVENTORY_ENDPOINT },
      });

      setShowDeleteModal(false);
      setActiveItem(null);
      setSelectedIds((current) =>
        current.filter((id) => id !== activeItem.id),
      );
      setNotice({
        tone: "success",
        title: "Stock item deleted",
        message: auditOk
          ? `${deletedItem.name} has been permanently deleted and recorded in the audit log.`
          : `${deletedItem.name} was deleted, but the audit entry could not be confirmed.`,
      });
      await loadInventory();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock item could not be deleted",
          "Please check the password and try again.",
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  async function createTestItem() {
    if (creatingTestItem || saving) return;

    setCreatingTestItem(true);
    setNotice(null);

    try {
      const preferredLocation =
        locations.find((location) => location.isActive !== false) || null;

      const payload = createTestInventoryPayload({
        locationId: preferredLocation?.id || null,
      });

      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const { json, rawText } = await readApiResponse(response);

      if (!response.ok || !json?.ok) {
        throw createDetailedApiError({
          response,
          json,
          rawText,
          endpoint: INVENTORY_ENDPOINT,
          method: "POST",
          fallbackTitle: "Test item could not be created",
          fallbackMessage:
            "The inventory API rejected the test stock item.",
        });
      }

      const createdTestItem = json.item ? normaliseItem(json.item) : null;
      const auditOk = await reportStockAudit({
        action: "stock.item.test_created",
        actionLabel: "Test stock item created",
        summary: `${payload.name} was created for Stock Management testing.`,
        recordType: "stock_item",
        recordId: createdTestItem?.id || null,
        recordTitle: payload.name,
        reason: "Test inventory item created from the inventory test button.",
        beforeData: null,
        afterData: createdTestItem || payload,
        metadata: { isTestItem: true, endpoint: INVENTORY_ENDPOINT },
      });

      setNotice({
        tone: "success",
        title: "Test item created",
        message: getTestItemSuccessMessage(
          payload.name,
          payload.sku,
          preferredLocation?.name || null,
        ) + (auditOk
          ? " The test item was recorded in the audit log."
          : " The audit entry could not be confirmed."),
      });

      await loadInventory();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Test item could not be created",
          "Check the inventory API and database columns, then try again.",
        ),
      );
    } finally {
      setCreatingTestItem(false);
    }
  }

  function toggleVisibleSelection() {
    if (allVisibleSelected) {
      const visibleIds = new Set(filteredItems.map((item) => item.id));
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.has(id)),
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(
        new Set([...current, ...filteredItems.map((item) => item.id)]),
      ),
    );
  }

  function toggleItemSelection(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((value) => value !== id)
        : [...current, id],
    );
  }

  async function exportXlsx() {
    if (filteredItems.length === 0 || exportingXlsx) return;

    setExportingXlsx(true);
    setNotice(null);

    try {
      await exportInventoryWorkbook({
        items: filteredItems,
        summary,
        reportTitle: "Burton Pride Inventory Report",
        generatedBy: null,
      });

      const auditOk = await reportStockAudit({
        action: "stock.report.exported",
        actionLabel: "Inventory Excel report exported",
        summary: `An inventory Excel report containing ${filteredItems.length} stock item${filteredItems.length === 1 ? "" : "s"} was exported.`,
        recordType: "inventory_report",
        recordId: null,
        recordTitle: "Burton Pride Inventory Report",
        reason: "Inventory report downloaded from Stock Management.",
        beforeData: null,
        afterData: null,
        metadata: {
          exportedRows: filteredItems.length,
          selectedRows: selectedIds.length,
          filters: { query, statusFilter, categoryFilter, locationFilter, sortBy, sortDirection },
          summary,
          format: "xlsx",
        },
      });

      setNotice({
        tone: "success",
        title: "Excel report created",
        message:
          auditOk
            ? "The styled inventory Excel report was downloaded and recorded in the audit log."
            : "The Excel report was downloaded, but the audit entry could not be confirmed.",
      });
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Excel report could not be created",
        message:
          caught instanceof Error
            ? caught.message
            : "The inventory report could not be exported.",
      });
    } finally {
      setExportingXlsx(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("all");
    setCategoryFilter("all");
    setLocationFilter("all");
    setSortBy("name");
    setSortDirection("asc");
  }

  return (
    <main className="min-h-screen w-full bg-transparent px-3 py-5 text-white sm:px-5 sm:py-7 lg:px-7">
      <div className="w-full max-w-none">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/Admin/StockManagement"
            className="inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Stock Control
          </Link>

          <InventoryHeaderActions
            loading={loading}
            creatingTestItem={creatingTestItem}
            exportingXlsx={exportingXlsx}
            hasExportRows={filteredItems.length > 0}
            onMoveStock={() => openMoveModal()}
            onRefresh={() => void loadInventory()}
            onCreateTestItem={() => void createTestItem()}
            onExportXlsx={() => void exportXlsx()}
          />
        </div>

        <header className="relative overflow-hidden rounded-[2rem] border border-blue-300/15 bg-[#1d2d4d] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-300/25 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-blue-100">
                <Warehouse className="h-4 w-4" />
                Burton Pride Stock Control
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Inventory
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
                View, search and manage every Burton Pride stock item. Track
                quantities, reorder levels, value, locations and the
                administrator who last updated each record.
              </p>
            </div>

            <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={() => openMoveModal()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/20 bg-white/[0.09] px-5 py-3 text-sm font-black text-white shadow-xl transition hover:bg-white/[0.16]"
              >
                <ArrowRightLeft className="h-5 w-5" />
                Move stock
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-blue-950/25 transition hover:scale-[1.01] hover:bg-blue-300"
              >
                <Plus className="h-5 w-5" />
                Add stock item
              </button>
            </div>
          </div>
        </header>

        {notice ? (
          <div className="mt-6">
            <NoticePanel notice={notice} onClose={() => setNotice(null)} />
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="Stock items"
            value={summary.totalItems}
            icon={Boxes}
            tone="purple"
          />
          <SummaryCard
            label="Total units"
            value={summary.totalUnits}
            icon={Package}
            tone="blue"
          />
          <SummaryCard
            label="Low stock"
            value={summary.lowStockItems}
            icon={PackageMinus}
            tone="amber"
          />
          <SummaryCard
            label="Out of stock"
            value={summary.outOfStockItems}
            icon={PackageOpen}
            tone="red"
          />
          <SummaryCard
            label="Stock value"
            value={formatCurrency(summary.totalValue)}
            icon={CircleDollarSign}
            tone="emerald"
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/14 bg-white/[0.045] p-4 shadow-xl backdrop-blur-md sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by item, SKU, barcode, category, location or supplier..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-fuchsia-300/50"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:bg-white/[0.1]"
              >
                <SlidersHorizontal className="h-4 w-4" />
                Filters
                <ChevronDown
                  className={`h-4 w-4 transition ${
                    showFilters ? "rotate-180" : ""
                  }`}
                />
              </button>

              <select
                value={sortBy}
                onChange={(event) =>
                  setSortBy(
                    event.target.value as
                      | "name"
                      | "quantity"
                      | "value"
                      | "updated",
                  )
                }
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none"
              >
                <option value="name">Sort by name</option>
                <option value="quantity">Sort by quantity</option>
                <option value="value">Sort by value</option>
                <option value="updated">Sort by updated</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortDirection((current) =>
                    current === "asc" ? "desc" : "asc",
                  )
                }
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.1]"
                aria-label={`Sort ${
                  sortDirection === "asc" ? "descending" : "ascending"
                }`}
              >
                {sortDirection === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : (
                  <ArrowDown className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <FilterSelect
                label="Stock status"
                value={statusFilter}
                onChange={(value) =>
                  setStatusFilter(value as "all" | StockStatus)
                }
                options={[
                  ["all", "All statuses"],
                  ["in_stock", "In stock"],
                  ["low_stock", "Low stock"],
                  ["out_of_stock", "Out of stock"],
                  ["archived", "Archived"],
                ]}
              />

              <FilterSelect
                label="Category"
                value={categoryFilter}
                onChange={setCategoryFilter}
                options={[
                  ["all", "All categories"],
                  ...categories.map((value) => [value, value]),
                ]}
              />

              <FilterSelect
                label="Location"
                value={locationFilter}
                onChange={setLocationFilter}
                options={[
                  ["all", "All locations"],
                  // Map StockLocationOption to [id, name]
                  ...locations.map((loc) => [loc.id, loc.name]),
                ]}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:bg-white/[0.1]"
                >
                  <X className="h-4 w-4" />
                  Clear filters
                </button>
              </div>
            </div>
          ) : null}
        </section>

        {selectedIds.length > 0 ? (
          <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-black text-fuchsia-50">
              {selectedIds.length} item
              {selectedIds.length === 1 ? "" : "s"} selected
            </p>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="text-sm font-black text-fuchsia-100 underline underline-offset-4"
            >
              Clear selection
            </button>
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/14 bg-white/[0.045] shadow-xl backdrop-blur-md">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-fuchsia-200" />
                <p className="mt-4 font-black">Loading inventory...</p>
              </div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-white/10 bg-white/[0.06]">
                  <PackageOpen className="h-8 w-8 text-fuchsia-100" />
                </div>
                <h2 className="mt-5 text-xl font-black">
                  No matching stock items
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Change the search or filters, or add the first stock item to
                  this inventory.
                </p>
                <button
                  type="button"
                  onClick={openCreateModal}
                  className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700"
                >
                  <Plus className="h-4 w-4" />
                  Add stock item
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1180px] w-full border-collapse text-left">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    <th className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        aria-label="Select all visible items"
                        className="h-4 w-4 rounded border-white/20 bg-white/10"
                      />
                    </th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Quantity</th>
                    <th className="px-5 py-4">Reorder</th>
                    <th className="px-5 py-4">Unit cost</th>
                    <th className="px-5 py-4">Stock value</th>
                    <th className="px-5 py-4">Status</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/8">
                  {filteredItems.map((item) => (
                    <InventoryRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(item.id)}
                      onToggle={() => toggleItemSelection(item.id)}
                      onView={() => openDetailsModal(item)}
                      onEdit={() => openEditModal(item)}
                      onAdjust={() => openAdjustModal(item)}
                      onMove={() => openMoveModal(item)}
                      onDelete={() => openDeleteModal(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <div className="mt-4 flex flex-col gap-2 text-xs text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <p>
            Showing {filteredItems.length} of {items.length} stock items.
          </p>
          <p>
            Stock changes should always include a reason and the administrator
            responsible.
          </p>
        </div>
      </div>

      {showMoveModal ? (
        <MoveStockModal
          form={moveForm}
          items={items.filter(
            (item) => item.isActive && item.quantity > 0,
          )}
          locations={locations}
          saving={saving}
          onChange={setMoveForm}
          onClose={() => {
            setShowMoveModal(false);
            setMoveForm(EMPTY_MOVE_STOCK_FORM);
          }}
          onSubmit={saveMove}
        />
      ) : null}

      {showItemModal ? (
        <AddItemModal
          form={form}
          locations={locations}
          saving={saving}
          onChange={setForm}
          onClose={() => {
            if (saving) return;
            setShowItemModal(false);
            setForm(EMPTY_ADD_ITEM_FORM);
          }}
          onSubmit={saveItem}
        />
      ) : null}

      {showAdjustModal && adjustForm?.item ? (
        <AddStockModal
          form={adjustForm as any}
          locations={locations}
          saving={saving}
          onChange={(value) => setAdjustForm(value as unknown as StockAdjustmentFormState)}
          onClose={() => {
            if (saving) return;
            setShowAdjustModal(false);
            setAdjustForm(null);
          }}
          onSubmit={saveAdjustment}
        />
      ) : null}

      {showDeleteModal && activeItem ? (
        <DeleteModal
          item={activeItem}
          saving={saving}
          onClose={() => {
            setShowDeleteModal(false);
            setActiveItem(null);
          }}
          onConfirm={(password) => void deleteItem(password)}
        />
      ) : null}

      {showDetailsModal && activeItem ? (
        <DetailsModal
          item={activeItem}
          onClose={() => {
            setShowDetailsModal(false);
            setActiveItem(null);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            openEditModal(activeItem);
          }}
          onAdjust={() => {
            setShowDetailsModal(false);
            openAdjustModal(activeItem);
          }}
        />
      ) : null}
    </main>
  );
}

function InventoryRow({
  item,
  selected,
  onToggle,
  onView,
  onEdit,
  onAdjust,
  onMove,
  onDelete,
}: {
  item: StockItem;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onMove: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="transition hover:bg-white/[0.035]">
      <td className="px-5 py-4 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.name}`}
          className="h-4 w-4 rounded border-white/20 bg-white/10"
        />
      </td>

      <td className="px-5 py-4 align-top">
        <div className="flex min-w-64 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-fuchsia-100">
            <Package className="h-5 w-5" />
          </div>

          <div>
            <button
              type="button"
              onClick={onView}
              className="text-left font-black text-white hover:text-fuchsia-100"
            >
              {item.name}
            </button>
            <p className="mt-1 text-xs text-white/45">SKU: {item.sku}</p>
            {item.barcode ? (
              <p className="mt-1 flex items-center gap-1 text-xs text-white/35">
                <Barcode className="h-3 w-3" />
                {item.barcode}
              </p>
            ) : null}
          </div>
        </div>
      </td>

      <td className="px-5 py-4 align-top text-sm text-white/65">
        {item.category || "Uncategorised"}
      </td>

      <td className="px-5 py-4 align-top">
        <span className="inline-flex items-center gap-1.5 text-sm text-white/65">
          <MapPin className="h-3.5 w-3.5 text-white/35" />
          {item.location || "Not set"}
        </span>
      </td>

      <td className="px-5 py-4 align-top">
        <p className="text-lg font-black text-white">{item.quantity}</p>
        <p className="text-xs text-white/35">units</p>
      </td>

      <td className="px-5 py-4 align-top text-sm font-bold text-white/65">
        {item.reorderLevel}
      </td>

      <td className="px-5 py-4 align-top text-sm font-bold text-white/65">
        {formatCurrency(item.unitCost)}
      </td>

      <td className="px-5 py-4 align-top text-sm font-black text-white">
        {formatCurrency(item.stockValue)}
      </td>

      <td className="px-5 py-4 align-top">
        <StatusBadge status={item.status} />
      </td>

      <td className="px-5 py-4 align-top">
        <p className="text-xs text-white/55">{formatDate(item.updatedAt)}</p>
        {item.updatedByName ? (
          <p className="mt-1 text-xs text-white/35">
            by {item.updatedByName}
          </p>
        ) : null}
      </td>

      <td className="px-5 py-4 align-top">
        <div className="flex justify-end gap-2">
          <IconButton label="View item" onClick={onView}>
            <Eye className="h-4 w-4" />
          </IconButton>
          <IconButton label="Adjust stock" onClick={onAdjust}>
            <PackagePlus className="h-4 w-4" />
          </IconButton>
          <IconButton
            label="Move stock"
            onClick={onMove}
            disabled={!item.isActive || item.quantity < 1}
          >
            <ArrowRightLeft className="h-4 w-4" />
          </IconButton>
          <IconButton label="Edit item" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Delete item permanently" onClick={onDelete} danger>
            <Trash2 className="h-4 w-4" />
          </IconButton>
        </div>
      </td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string | number;
  icon: typeof Boxes;
  tone: "purple" | "blue" | "amber" | "red" | "emerald";
}) {
  const className =
    tone === "purple"
      ? "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100"
      : tone === "blue"
        ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
        : tone === "amber"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : tone === "red"
            ? "border-red-300/20 bg-red-500/10 text-red-100"
            : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100";

  return (
    <article className={`rounded-[1.75rem] border p-5 shadow-lg ${className}`}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.13em] opacity-65">
            {label}
          </p>
          <p className="mt-2 text-3xl font-black">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-black/15">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: StockStatus }) {
  const className =
    status === "in_stock"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : status === "low_stock"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
        : status === "out_of_stock"
          ? "border-red-300/20 bg-red-500/10 text-red-100"
          : "border-white/10 bg-white/[0.06] text-white/55";

  const Icon =
    status === "in_stock"
      ? PackageCheck
      : status === "low_stock"
        ? AlertTriangle
        : status === "out_of_stock"
          ? PackageOpen
          : PackageMinus;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {statusLabel(status)}
    </span>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[][];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/40">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none"
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function NoticePanel({
  notice,
  onClose,
}: {
  notice: Notice;
  onClose: () => void;
}) {
  const className =
    notice.tone === "success"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
      : notice.tone === "warning"
        ? "border-amber-300/20 bg-amber-500/10 text-amber-50"
        : "border-red-300/25 bg-red-500/10 text-red-50 shadow-[0_18px_60px_rgba(127,29,29,0.18)]";

  const Icon = notice.tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`rounded-2xl border p-4 sm:p-5 ${className}`} role="alert">
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="font-black">{notice.title}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{notice.message}</p>
            </div>

            {notice.errorReference ? (
              <span className="rounded-lg border border-current/15 bg-black/15 px-2.5 py-1 font-mono text-[10px] font-black tracking-wide opacity-80">
                {notice.errorReference}
              </span>
            ) : null}
          </div>

          {notice.likelyCauses?.length ? (
            <div className="mt-4 rounded-xl border border-current/15 bg-black/10 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em]">Likely cause</p>
              <ul className="mt-2 space-y-1.5 text-xs leading-5 opacity-85">
                {notice.likelyCauses.map((cause) => (
                  <li key={cause} className="flex gap-2">
                    <span aria-hidden="true">•</span>
                    <span>{cause}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {notice.suggestedFixes?.length ? (
            <div className="mt-3 rounded-xl border border-current/15 bg-black/10 p-3">
              <p className="text-xs font-black uppercase tracking-[0.12em]">What to check</p>
              <ol className="mt-2 space-y-1.5 text-xs leading-5 opacity-85">
                {notice.suggestedFixes.map((fix, index) => (
                  <li key={fix} className="flex gap-2">
                    <span className="font-black">{index + 1}.</span>
                    <span>{fix}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {notice.technicalDetails?.length ? (
            <details className="mt-3 rounded-xl border border-current/15 bg-black/15 p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em]">
                Show full technical details
              </summary>

              <div className="mt-3 space-y-2 rounded-lg bg-black/15 p-3 text-xs leading-5 opacity-85">
                {notice.technicalDetails.map((detail) => (
                  <p key={detail} className="break-words font-mono select-text">
                    {detail}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="h-8 w-8 shrink-0 rounded-xl p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
          aria-label="Close message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  danger,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
        disabled
          ? "border-white/5 bg-white/[0.02] text-white/30 cursor-not-allowed"
          : danger
          ? "border-red-300/15 bg-red-500/10 text-red-100 hover:bg-red-500/20"
          : "border-white/10 bg-white/[0.05] text-white/65 hover:bg-white/[0.1] hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[calc(100vh-4rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/15 bg-[#111827] shadow-[0_32px_120px_rgba(0,0,0,0.65)]">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#111827]/95 p-6 backdrop-blur-xl">
          <div>
            <h2 className="text-2xl font-black">{title}</h2>
            {subtitle ? (
              <p className="mt-1 text-sm leading-6 text-white/50">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06] text-white/60 transition hover:bg-white/[0.1] hover:text-white"
            aria-label="Close dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function DeleteModal({
  item,
  saving,
  onClose,
  onConfirm,
}: {
  item: StockItem;
  saving: boolean;
  onClose: () => void;
  onConfirm: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password) {
      onConfirm(password);
    }
  }

  return (
    <ModalShell
      title="Delete stock item permanently?"
      subtitle="This permanently removes the item from the inventory database. This action cannot be undone."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-6">
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-5">
          <div className="flex gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />
            <div>
              <p className="font-black text-red-50">{item.name}</p>
              <p className="mt-1 text-sm leading-6 text-red-50/75">
                SKU {item.sku} currently has {item.quantity} units recorded.
                This item will be permanently removed and cannot be restored.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5">
          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Main Admin Password
            </span>
            <div className="relative flex items-center">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password to confirm deletion"
                required
                autoFocus
                className="w-full rounded-2xl border border-white/10 bg-white/[0.06] pl-4 pr-12 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/25 focus:border-red-400/50 focus:bg-red-500/10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 p-1 text-white/40 hover:text-white/80 transition"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </label>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1]"
          >
            Keep item
          </button>
          <button
            type="submit"
            disabled={saving || !password}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete item permanently
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function DetailsModal({
  item,
  onClose,
  onEdit,
  onAdjust,
}: {
  item: StockItem;
  onClose: () => void;
  onEdit: () => void;
  onAdjust: () => void;
}) {
  return (
    <ModalShell
      title={item.name}
      subtitle={`SKU ${item.sku}`}
      onClose={onClose}
    >
      <div className="space-y-6 p-6">
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={item.status} />
          {item.category ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs font-black text-white/65">
              <Tags className="h-3.5 w-3.5" />
              {item.category}
            </span>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <DetailCard label="Quantity" value={`${item.quantity} units`} />
          <DetailCard
            label="Reorder level"
            value={`${item.reorderLevel} units`}
          />
          <DetailCard
            label="Target level"
            value={
              item.targetLevel === null || item.targetLevel === undefined
                ? "Not set"
                : `${item.targetLevel} units`
            }
          />
          <DetailCard label="Unit cost" value={formatCurrency(item.unitCost)} />
          <DetailCard
            label="Sale price"
            value={formatCurrency(item.salePrice)}
          />
          <DetailCard
            label="Stock value"
            value={formatCurrency(item.stockValue)}
          />
          <DetailCard label="Location" value={item.location || "Not set"} />
          <DetailCard label="Supplier" value={item.supplier || "Not set"} />
          <DetailCard label="Barcode" value={item.barcode || "Not set"} />
        </div>

        {item.description ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
              Description
            </p>
            <p className="mt-2 text-sm leading-7 text-white/65">
              {item.description}
            </p>
          </div>
        ) : null}

        <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <p className="text-xs font-black uppercase tracking-[0.14em] text-white/40">
            Last updated
          </p>
          <p className="mt-2 text-sm font-black text-white">
            {formatDate(item.updatedAt)}
          </p>
          <p className="mt-1 text-xs text-white/45">
            {item.updatedByName
              ? `Updated by ${item.updatedByName}`
              : "Administrator not recorded"}
          </p>
        </div>

        <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onAdjust}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1]"
          >
            <PackagePlus className="h-4 w-4" />
            Adjust stock
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 transition hover:bg-white/90"
          >
            <Edit3 className="h-4 w-4" />
            Edit item
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-2 font-black text-white">{value}</p>
    </div>
  );
}

function LocationSelect({
  label,
  helpText,
  value,
  locations,
  onChange,
}: {
  label: string;
  helpText?: string;
  value: string;
  locations: StockLocationOption[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black text-white/85">
        {label}
      </span>

      {helpText ? (
        <span className="mt-1 block min-h-10 text-xs leading-5 text-white/40">
          {helpText}
        </span>
      ) : null}

      <div className="mt-2 rounded-2xl border border-white/10 bg-white/[0.06] transition focus-within:border-blue-300/50 focus-within:bg-white/[0.08]">
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-2xl bg-slate-800 px-4 py-3.5 text-sm font-semibold text-white outline-none"
        >
          <option value="">Choose a storage location</option>
          {locations.map((location) => (
            <option key={location.id} value={location.name}>
              {location.code
                ? `${location.name} (${location.code})`
                : location.name}
            </option>
          ))}
        </select>
      </div>

      {locations.length === 0 ? (
        <span className="mt-2 block text-xs leading-5 text-amber-200">
          No active locations are available yet. Use “Manage locations” to add
          the first one.
        </span>
      ) : null}
    </label>
  );
}

function FormInput({
  label,
  helpText,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  min,
  step,
  prefix,
}: {
  label: string;
  helpText?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black text-white/85">
        {label}
        {required ? (
          <span className="ml-1 text-blue-200" aria-hidden="true">
            *
          </span>
        ) : null}
      </span>

      {helpText ? (
        <span className="mt-1 block min-h-10 text-xs leading-5 text-white/40">
          {helpText}
        </span>
      ) : null}

      <div className="mt-2 flex items-center rounded-2xl border border-white/10 bg-white/[0.06] transition focus-within:border-blue-300/50 focus-within:bg-white/[0.08]">
        {prefix ? (
          <span className="pl-4 text-sm font-black text-white/45">
            {prefix}
          </span>
        ) : null}

        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
          className="w-full bg-transparent px-4 py-3.5 text-sm font-semibold text-white outline-none placeholder:text-white/25"
        />
      </div>
    </label>
  );
}