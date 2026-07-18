"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Barcode,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  Edit3,
  Eye,
  Loader2,
  MapPin,
  Package,
  PackageCheck,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  Plus,
  RefreshCcw,
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

type StockFormState = {
  id?: string;
  name: string;
  sku: string;
  barcode: string;
  description: string;
  category: string;
  location: string;
  supplier: string;
  quantity: string;
  reorderLevel: string;
  targetLevel: string;
  unitCost: string;
  salePrice: string;
  isActive: boolean;
};

type AdjustFormState = {
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
  technicalDetails?: string[];
};

const INVENTORY_ENDPOINT = "/api/admin/stockmanagement/inventory";
const MOVEMENT_ENDPOINT = "/api/admin/stockmanagement/inventory/movements";
const LOCATIONS_ENDPOINT = "/api/admin/stockmanagement/locations";

const EMPTY_SUMMARY: InventorySummary = {
  totalItems: 0,
  totalUnits: 0,
  lowStockItems: 0,
  outOfStockItems: 0,
  totalValue: 0,
};

const EMPTY_FORM: StockFormState = {
  name: "",
  sku: "",
  barcode: "",
  description: "",
  category: "",
  location: "",
  supplier: "",
  quantity: "0",
  reorderLevel: "0",
  targetLevel: "",
  unitCost: "",
  salePrice: "",
  isActive: true,
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
};

async function readApiResponse(
  response: Response,
): Promise<{
  json: InventoryResponse | null;
  rawText: string;
}> {
  const rawText = await response.text();

  if (!rawText) {
    return {
      json: null,
      rawText: "",
    };
  }

  try {
    return {
      json: JSON.parse(rawText) as InventoryResponse,
      rawText,
    };
  } catch {
    return {
      json: null,
      rawText,
    };
  }
}

function createDetailedApiError(params: {
  response?: Response;
  json?: InventoryResponse | null;
  rawText?: string;
  endpoint: string;
  method: string;
  fallbackTitle: string;
  fallbackMessage: string;
}): DetailedApiError {
  const status = params.response?.status;
  const statusText = params.response?.statusText || "";
  const serverMessage =
    params.json?.error ||
    params.json?.message ||
    params.json?.reason ||
    "";

  const message =
    serverMessage ||
    (status === 401
      ? "Your admin session is missing or has expired. Sign in again and retry."
      : status === 403
        ? "Your administrator account does not have permission to perform this action."
        : status === 404
          ? `The API route was not found: ${params.endpoint}. Check the route folder and file name.`
          : status === 409
            ? "The request conflicts with the current stock record. Refresh the page and try again."
            : status === 422
              ? "The server could not accept one or more submitted values."
              : status === 429
                ? "Too many requests were made. Wait a moment and try again."
                : status && status >= 500
                  ? "The server failed while processing the inventory request. Check the terminal and Supabase logs."
                  : params.fallbackMessage);

  const error = new Error(message) as DetailedApiError;

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
  error.responseBody =
    !params.json && params.rawText
      ? params.rawText.slice(0, 500)
      : null;

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
    };
  }

  const error = caught as DetailedApiError;
  const technicalDetails: string[] = [];

  if (typeof error.status === "number") {
    technicalDetails.push(
      `HTTP status: ${error.status}${
        error.statusText ? ` ${error.statusText}` : ""
      }`,
    );
  }

  if (error.method && error.endpoint) {
    technicalDetails.push(
      `Request: ${error.method} ${error.endpoint}`,
    );
  }

  if (error.code) {
    technicalDetails.push(`Error code: ${error.code}`);
  }

  if (error.reason && error.reason !== error.message) {
    technicalDetails.push(`Reason: ${error.reason}`);
  }

  if (error.field) {
    technicalDetails.push(`Field: ${error.field}`);
  }

  if (error.details) {
    technicalDetails.push(`Server details: ${error.details}`);
  }

  if (error.hint) {
    technicalDetails.push(`Server hint: ${error.hint}`);
  }

  if (error.responseBody) {
    technicalDetails.push(
      `Non-JSON response: ${error.responseBody}`,
    );
  }

  return {
    tone: "error",
    title: error.title || fallbackTitle,
    message: error.message || fallbackMessage,
    technicalDetails:
      technicalDetails.length > 0 ? technicalDetails : undefined,
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

export default function InventoryPage() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<StockLocationOption[]>([]);
  const [summary, setSummary] = useState<InventorySummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const [form, setForm] = useState<StockFormState>(EMPTY_FORM);
  const [adjustForm, setAdjustForm] = useState<AdjustFormState | null>(null);
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

  const uniqueLocations = useMemo(
    () =>
      Array.from(
        new Set(
          items
            .map((item) => item.location?.trim())
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

      const matchesLocation =
        locationFilter === "all" || item.location === locationFilter;

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
    sortBy,
    sortDirection,
  ]);

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  function openCreateModal() {
    setForm(EMPTY_FORM);
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
      location: item.location || "",
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
      quantity: "",
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
          quantity: numberValue(form.quantity),
          reorderLevel: numberValue(form.reorderLevel),
          targetLevel: form.targetLevel
            ? numberValue(form.targetLevel)
            : null,
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

      setShowItemModal(false);
      setNotice({
        tone: "success",
        title: form.id ? "Stock item updated" : "Stock item created",
        message: `${name} has been saved successfully.`,
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

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!adjustForm || saving) return;

    const quantity = numberValue(adjustForm.quantity);

    if (quantity < 0 || (!quantity && adjustForm.movementType !== "set")) {
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

      setShowAdjustModal(false);
      setAdjustForm(null);
      setNotice({
        tone: "success",
        title: "Stock quantity updated",
        message: `${adjustForm.item.name} has been adjusted successfully.`,
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

  async function archiveItem() {
    if (!activeItem || saving) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "DELETE",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: activeItem.id,
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
          fallbackTitle: "Stock item could not be archived",
          fallbackMessage:
            "The inventory API rejected the archive request.",
        });
      }

      setShowDeleteModal(false);
      setActiveItem(null);
      setSelectedIds((current) =>
        current.filter((id) => id !== activeItem.id),
      );
      setNotice({
        tone: "success",
        title: "Stock item archived",
        message: `${activeItem.name} has been removed from active inventory.`,
      });
      await loadInventory();
    } catch (caught) {
      setNotice(
        noticeFromError(
          caught,
          "Stock item could not be archived",
          "Please try again.",
        ),
      );
    } finally {
      setSaving(false);
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

  function exportCsv() {
    const rows = filteredItems.map((item) => ({
      Name: item.name,
      SKU: item.sku,
      Barcode: item.barcode || "",
      Category: item.category || "",
      Location: item.location || "",
      Supplier: item.supplier || "",
      Quantity: item.quantity,
      "Reorder level": item.reorderLevel,
      "Target level": item.targetLevel ?? "",
      "Unit cost": item.unitCost ?? "",
      "Sale price": item.salePrice ?? "",
      "Stock value": item.stockValue ?? 0,
      Status: statusLabel(item.status),
      "Last updated": item.updatedAt || "",
      "Updated by": item.updatedByName || "",
    }));

    const headers = Object.keys(rows[0] || {
      Name: "",
      SKU: "",
      Quantity: "",
    });

    const escape = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;

    const csv = [
      headers.map(escape).join(","),
      ...rows.map((row) =>
        headers
          .map((header) =>
            escape((row as Record<string, unknown>)[header]),
          )
          .join(","),
      ),
    ].join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = `burton-pride-inventory-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
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

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void loadInventory()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black transition hover:bg-white/[0.1] disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={exportCsv}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-purple-700 shadow-lg transition hover:bg-white/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
          </div>
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

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-xl shadow-blue-950/25 transition hover:scale-[1.01] hover:bg-blue-300"
            >
              <Plus className="h-5 w-5" />
              Add stock item
            </button>
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
                      onArchive={() => openDeleteModal(item)}
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

      {showItemModal ? (
        <StockItemModal
          form={form}
          locations={locations}
          saving={saving}
          onChange={setForm}
          onClose={() => setShowItemModal(false)}
          onSubmit={saveItem}
        />
      ) : null}

      {showAdjustModal && adjustForm ? (
        <StockAdjustModal
          form={adjustForm}
          saving={saving}
          onChange={setAdjustForm}
          onClose={() => {
            setShowAdjustModal(false);
            setAdjustForm(null);
          }}
          onSubmit={saveAdjustment}
        />
      ) : null}

      {showDeleteModal && activeItem ? (
        <ArchiveModal
          item={activeItem}
          saving={saving}
          onClose={() => {
            setShowDeleteModal(false);
            setActiveItem(null);
          }}
          onConfirm={() => void archiveItem()}
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
  onArchive,
}: {
  item: StockItem;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  onArchive: () => void;
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
          <IconButton label="Edit item" onClick={onEdit}>
            <Edit3 className="h-4 w-4" />
          </IconButton>
          <IconButton label="Archive item" onClick={onArchive} danger>
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
        : "border-red-300/20 bg-red-500/10 text-red-50";

  const Icon =
    notice.tone === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-black">{notice.title}</p>
          <p className="mt-1 text-sm leading-6 opacity-85">
            {notice.message}
          </p>

          {notice.technicalDetails?.length ? (
            <details className="mt-3 rounded-xl border border-current/15 bg-black/15 p-3">
              <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.12em]">
                Show technical details
              </summary>

              <div className="mt-3 space-y-2 text-xs leading-5 opacity-80">
                {notice.technicalDetails.map((detail) => (
                  <p key={detail} className="break-words font-mono">
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
          className="h-8 w-8 rounded-xl p-1 opacity-60 transition hover:bg-white/10 hover:opacity-100"
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
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition ${
        danger
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

function StockItemModal({
  form,
  locations,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: StockFormState;
  locations: StockLocationOption[];
  saving: boolean;
  onChange: (value: StockFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  function setField<K extends keyof StockFormState>(
    key: K,
    value: StockFormState[K],
  ) {
    onChange({
      ...form,
      [key]: value,
    });
  }

  return (
    <ModalShell
      title={form.id ? "Edit stock item" : "Add stock item"}
      subtitle="Complete the sections below. Only the item name and SKU are required."
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-6 p-5 sm:p-6">
        <FormSection
          number="1"
          title="Basic item details"
          description="Give the item a clear name and a unique reference so it is easy to find."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Item name"
              helpText="The name people will recognise, for example: Folding table."
              value={form.name}
              onChange={(value) => setField("name", value)}
              placeholder="Example: Folding table"
              required
            />

            <FormInput
              label="SKU"
              helpText="A short unique code used to identify this item."
              value={form.sku}
              onChange={(value) => setField("sku", value)}
              placeholder="Example: TABLE-001"
              required
            />

            <FormInput
              label="Barcode"
              helpText="Optional. Enter the barcode number if the item has one."
              value={form.barcode}
              onChange={(value) => setField("barcode", value)}
              placeholder="Example: 5012345678900"
            />

            <FormInput
              label="Category"
              helpText="Group similar items together."
              value={form.category}
              onChange={(value) => setField("category", value)}
              placeholder="Example: Event equipment"
            />
          </div>
        </FormSection>

        <FormSection
          number="2"
          title="Where it is kept and who supplies it"
          description="These details help administrators find and reorder the item."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <LocationSelect
              label="Storage location"
              helpText="Choose where this item is physically stored."
              value={form.location}
              locations={locations}
              onChange={(value) => setField("location", value)}
            />

            <FormInput
              label="Supplier"
              helpText="The business or person the item is normally bought from."
              value={form.supplier}
              onChange={(value) => setField("supplier", value)}
              placeholder="Example: Burton Event Supplies"
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4">
            <div>
              <p className="text-sm font-black text-blue-50">
                Need another storage location?
              </p>
              <p className="mt-1 text-xs leading-5 text-blue-50/65">
                Add and manage warehouses, cupboards, rooms and shelf locations
                from the Stock Locations page.
              </p>
            </div>

            <Link
              href="/Admin/StockManagement/Locations"
              target="_blank"
              className="inline-flex items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-400 px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-blue-300"
            >
              <MapPin className="h-4 w-4" />
              Manage locations
            </Link>
          </div>
        </FormSection>

        <FormSection
          number="3"
          title="Stock levels"
          description="Set the current amount and when the system should warn you to order more."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            <FormInput
              label="Current quantity"
              helpText="How many are available right now."
              value={form.quantity}
              onChange={(value) => setField("quantity", value)}
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />

            <FormInput
              label="Low-stock warning level"
              helpText="You will be warned when stock reaches this number."
              value={form.reorderLevel}
              onChange={(value) => setField("reorderLevel", value)}
              type="number"
              min="0"
              step="1"
              placeholder="0"
            />

            <FormInput
              label="Preferred stock level"
              helpText="The amount you would ideally like to keep in stock."
              value={form.targetLevel}
              onChange={(value) => setField("targetLevel", value)}
              type="number"
              min="0"
              step="1"
              placeholder="Optional"
            />
          </div>

          <div className="mt-4 rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4">
            <div className="flex gap-3">
              <PackageMinus className="mt-0.5 h-5 w-5 shrink-0 text-blue-100" />
              <div>
                <p className="text-sm font-black text-blue-50">
                  Example
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-50/70">
                  If the current quantity is 20 and the low-stock warning is 5,
                  the item will show as low stock when only 5 remain.
                </p>
              </div>
            </div>
          </div>
        </FormSection>

        <FormSection
          number="4"
          title="Cost and selling price"
          description="Optional financial details used to calculate stock value."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <FormInput
              label="Cost per item"
              helpText="How much Burton Pride pays for one item."
              value={form.unitCost}
              onChange={(value) => setField("unitCost", value)}
              type="number"
              min="0"
              step="0.01"
              prefix="£"
              placeholder="0.00"
            />

            <FormInput
              label="Selling price per item"
              helpText="How much one item is sold for, if applicable."
              value={form.salePrice}
              onChange={(value) => setField("salePrice", value)}
              type="number"
              min="0"
              step="0.01"
              prefix="£"
              placeholder="0.00"
            />
          </div>
        </FormSection>

        <FormSection
          number="5"
          title="Extra information"
          description="Add anything administrators should know about this item."
        >
          <label className="block">
            <span className="mb-2 block text-sm font-black text-white/85">
              Description or notes
            </span>
            <p className="mb-3 text-xs leading-5 text-white/45">
              Optional. Include size, colour, condition, usage instructions or
              anything else that helps identify the item.
            </p>
            <textarea
              value={form.description}
              onChange={(event) =>
                setField("description", event.target.value)
              }
              rows={4}
              className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-blue-300/50"
              placeholder="Example: Six-foot folding table used for event stalls..."
            />
          </label>

          <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 transition hover:bg-white/[0.07]">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(event) =>
                setField("isActive", event.target.checked)
              }
              className="mt-1 h-4 w-4 rounded border-white/20 bg-white/10"
            />
            <span>
              <span className="block text-sm font-black">
                Keep this item active
              </span>
              <span className="mt-1 block text-xs leading-5 text-white/45">
                Active items appear in the main inventory and can trigger
                stock alerts. Turn this off only when the item is no longer
                being used.
              </span>
            </span>
          </label>
        </FormSection>

        <div className="sticky bottom-0 -mx-5 -mb-5 flex flex-col-reverse gap-3 border-t border-white/10 bg-[#111827]/95 px-5 py-4 backdrop-blur-xl sm:-mx-6 sm:-mb-6 sm:flex-row sm:justify-end sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1] disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 shadow-lg transition hover:bg-blue-300 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="h-4 w-4" />
            )}
            {form.id ? "Save item changes" : "Add item to inventory"}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function FormSection({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-white/10 bg-white/[0.035] p-4 sm:p-5">
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-blue-300/20 bg-blue-500/15 text-sm font-black text-blue-100">
          {number}
        </div>

        <div>
          <h3 className="text-base font-black text-white sm:text-lg">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-white/45 sm:text-sm">
            {description}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function StockAdjustModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: AdjustFormState;
  saving: boolean;
  onChange: (value: AdjustFormState) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <ModalShell
      title="Adjust stock quantity"
      subtitle={`${form.item.name} currently has ${form.item.quantity} units.`}
      onClose={onClose}
    >
      <form onSubmit={onSubmit} className="space-y-5 p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ["add", "Add stock", PackagePlus],
            ["remove", "Remove stock", PackageMinus],
            ["set", "Set quantity", SlidersHorizontal],
          ].map(([value, label, Icon]) => (
            <button
              key={String(value)}
              type="button"
              onClick={() =>
                onChange({
                  ...form,
                  movementType: value as "add" | "remove" | "set",
                })
              }
              className={`rounded-2xl border p-4 text-left transition ${
                form.movementType === value
                  ? "border-fuchsia-300/40 bg-fuchsia-500/15"
                  : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
              }`}
            >
              <Icon className="h-5 w-5 text-fuchsia-100" />
              <p className="mt-3 text-sm font-black">{String(label)}</p>
            </button>
          ))}
        </div>

        <FormInput
          label={
            form.movementType === "set"
              ? "New total quantity"
              : "Quantity to change"
          }
          value={form.quantity}
          onChange={(value) =>
            onChange({
              ...form,
              quantity: value,
            })
          }
          type="number"
          min="0"
          required
        />

        <FormInput
          label="Reason"
          value={form.reason}
          onChange={(value) =>
            onChange({
              ...form,
              reason: value,
            })
          }
          placeholder="For example: delivery received, event use, damaged item..."
          required
        />

        <label className="block">
          <span className="mb-2 block text-sm font-black text-white/80">
            Additional notes
          </span>
          <textarea
            value={form.notes}
            onChange={(event) =>
              onChange({
                ...form,
                notes: event.target.value,
              })
            }
            rows={4}
            className="w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-fuchsia-300/50"
            placeholder="Optional extra information..."
          />
        </label>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black transition hover:bg-white/[0.1]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700 shadow-lg transition hover:bg-white/90 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCcw className="h-4 w-4" />
            )}
            Save stock adjustment
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

function ArchiveModal({
  item,
  saving,
  onClose,
  onConfirm,
}: {
  item: StockItem;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalShell
      title="Archive stock item?"
      subtitle="The item will be removed from active inventory but kept for audit history."
      onClose={onClose}
    >
      <div className="p-6">
        <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-5">
          <div className="flex gap-3">
            <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />
            <div>
              <p className="font-black text-red-50">{item.name}</p>
              <p className="mt-1 text-sm leading-6 text-red-50/75">
                SKU {item.sku} currently has {item.quantity} units recorded.
              </p>
            </div>
          </div>
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
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Archive item
          </button>
        </div>
      </div>
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

