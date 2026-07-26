"use client";

import type { FormEvent } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import Link from "next/link";
import ExcelJS from "exceljs";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Boxes,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  Edit3,
  Eye,
  FlaskConical,
  Loader2,
  MapPin,
  Package,
  PackageMinus,
  PackageOpen,
  PackagePlus,
  Plus,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

import MoveStockModal, {
  EMPTY_MOVE_STOCK_FORM,
  type MoveStockFormState,
  type StockItemForMove,
  type StockLocationForMove,
} from "./AddStock/MoveStockModal";
import {
  createLowStockTestPayload,
  lowStockTestSuccessMessage,
} from "./Test/lowStockTestItem";
import AddItemModal, {
  EMPTY_ADD_ITEM_FORM,
  type AddItemFormState,
} from "./AddStock/AddStockModal";

type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "archived";
type Priority = "critical" | "high" | "low";

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

type LowStockItem = StockItem & {
  priority: Priority;
  desiredLevel: number;
  unitsNeeded: number;
  estimatedOrderCost: number;
};

type StockLocation = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

type InventoryResponse = {
  ok?: boolean;
  items?: StockItem[];
  message?: string;
  error?: string;
  reason?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
};

type LocationsResponse = {
  ok?: boolean;
  locations?: StockLocation[];
  error?: string;
  message?: string;
  reason?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
  technicalDetails?: string[];
};

type AdjustForm = {
  item: LowStockItem;
  quantity: string;
  reason: string;
  notes: string;
};

const INVENTORY_ENDPOINT = "/api/admin/stockmanagement/inventory";
const MOVEMENT_ENDPOINT = "/api/admin/stockmanagement/inventory/movements";
const LOCATIONS_ENDPOINT = "/api/admin/stockmanagement/locations";
const MOVE_STOCK_ENDPOINT =
  "/api/admin/stockmanagement/locations/movestock";
const AUDIT_ENDPOINT =
  "/api/admin/stockmanagement/audit-logs";

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

function normaliseItem(item: Partial<StockItem>): StockItem {
  const quantity = Number(item.quantity || 0);
  const reorderLevel = Number(item.reorderLevel || 0);
  const targetLevel =
    item.targetLevel === null || item.targetLevel === undefined
      ? null
      : Number(item.targetLevel);
  const unitCost =
    item.unitCost === null || item.unitCost === undefined
      ? null
      : Number(item.unitCost);

  let status: StockStatus = item.status || "in_stock";

  if (item.isActive === false) status = "archived";
  else if (quantity <= 0) status = "out_of_stock";
  else if (quantity <= reorderLevel) status = "low_stock";
  else status = "in_stock";

  return {
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
    targetLevel,
    unitCost,
    salePrice:
      item.salePrice === null || item.salePrice === undefined
        ? null
        : Number(item.salePrice),
    stockValue:
      item.stockValue === null || item.stockValue === undefined
        ? quantity * Number(unitCost || 0)
        : Number(item.stockValue),
    status,
    isActive: item.isActive !== false,
    updatedAt: item.updatedAt || null,
    updatedByName: item.updatedByName || null,
  };
}

function toLowStockItem(item: StockItem): LowStockItem {
  const desiredLevel =
    Number(item.targetLevel || 0) > item.reorderLevel
      ? Number(item.targetLevel)
      : Math.max(item.reorderLevel, 1);

  const unitsNeeded = Math.max(0, desiredLevel - item.quantity);

  const priority: Priority =
    item.quantity <= 0
      ? "critical"
      : item.quantity <= Math.max(1, item.reorderLevel / 2)
        ? "high"
        : "low";

  return {
    ...item,
    priority,
    desiredLevel,
    unitsNeeded,
    estimatedOrderCost: unitsNeeded * Number(item.unitCost || 0),
  };
}

async function readJson<T>(response: Response): Promise<{
  data: T | null;
  rawText: string;
}> {
  const rawText = await response.text();

  if (!rawText) return { data: null, rawText: "" };

  try {
    return { data: JSON.parse(rawText) as T, rawText };
  } catch {
    return { data: null, rawText };
  }
}

function errorNotice(params: {
  title: string;
  response?: Response;
  payload?: InventoryResponse | LocationsResponse | null;
  rawText?: string;
  endpoint: string;
  method: string;
}): Notice {
  const message =
    params.payload?.error ||
    params.payload?.message ||
    params.payload?.reason ||
    (params.response
      ? `The server returned HTTP ${params.response.status}.`
      : "The request could not be completed.");

  const technicalDetails = [
    `Request: ${params.method} ${params.endpoint}`,
    params.response
      ? `HTTP status: ${params.response.status} ${params.response.statusText}`
      : null,
    params.payload?.code ? `Error code: ${params.payload.code}` : null,
    params.payload?.details
      ? `Server details: ${params.payload.details}`
      : null,
    params.payload?.hint ? `Server hint: ${params.payload.hint}` : null,
    !params.payload && params.rawText
      ? `Non-JSON response: ${params.rawText.slice(0, 700)}`
      : null,
  ].filter((value): value is string => Boolean(value));

  return {
    tone: "error",
    title: params.title,
    message,
    technicalDetails,
  };
}


type AuditResponse = {
  ok?: boolean;
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  auditId?: string | null;
  requestId?: string | null;
};

type AuditPayload = {
  actionKey:
    | "stock_item_created"
    | "stock_item_updated"
    | "test_stock_item_created"
    | "stock_quantity_adjusted"
    | "stock_location_moved"
    | "inventory_report_exported";
  actionLabel: string;
  actionCategory:
    | "create"
    | "update"
    | "adjust"
    | "move"
    | "export";
  module: "inventory" | "movements" | "locations" | "reports";
  status: "success";
  riskLevel: "low" | "medium";
  description: string;
  reason?: string | null;
  notes?: string | null;
  recordType: "stock_item" | "stock_movement" | "inventory_report";
  recordId?: string | null;
  recordName?: string | null;
  recordReference?: string | null;
  stockItemId?: string | null;
  stockItemName?: string | null;
  stockItemSku?: string | null;
  locationId?: string | null;
  locationName?: string | null;
  fromLocationId?: string | null;
  fromLocationName?: string | null;
  toLocationId?: string | null;
  toLocationName?: string | null;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  quantityChanged?: number | null;
  beforeData?: Record<string, unknown> | null;
  afterData?: Record<string, unknown> | null;
  changedFields?: string[];
  responseStatus?: number;
  apiEndpoint?: string;
  metadata?: Record<string, unknown>;
};

async function reportAudit(payload: AuditPayload) {
  const response = await fetch(AUDIT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const { data, rawText } = await readJson<AuditResponse>(response);

  if (!response.ok || !data?.ok) {
    throw new Error(
      data?.error ||
        `Audit reporting failed with HTTP ${response.status}${
          rawText ? `: ${rawText.slice(0, 300)}` : ""
        }.`,
    );
  }

  return data;
}

function itemSnapshot(item: StockItem) {
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    barcode: item.barcode || null,
    description: item.description || null,
    category: item.category || null,
    location: item.location || null,
    supplier: item.supplier || null,
    quantity: item.quantity,
    reorderLevel: item.reorderLevel,
    targetLevel: item.targetLevel ?? null,
    unitCost: item.unitCost ?? null,
    salePrice: item.salePrice ?? null,
    stockValue: item.stockValue ?? null,
    status: item.status,
    isActive: item.isActive,
  };
}

export default function LowStockClient() {
  const [items, setItems] = useState<StockItem[]>([]);
  const [locations, setLocations] = useState<StockLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTestItem, setCreatingTestItem] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [query, setQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<"all" | Priority>("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [locationFilter, setLocationFilter] = useState("all");
  const [sortBy, setSortBy] = useState<
    "urgent" | "quantity" | "needed" | "cost" | "name" | "updated"
  >("urgent");
  const [sortDirection, setSortDirection] =
    useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustForm, setAdjustForm] = useState<AdjustForm | null>(null);

  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [addItemForm, setAddItemForm] =
    useState<AddItemFormState>(EMPTY_ADD_ITEM_FORM);

  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveForm, setMoveForm] =
    useState<MoveStockFormState>(EMPTY_MOVE_STOCK_FORM);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [detailsItem, setDetailsItem] = useState<LowStockItem | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [editItemForm, setEditItemForm] =
    useState<AddItemFormState>(EMPTY_ADD_ITEM_FORM);

  const loadData = useCallback(async () => {
    setLoading(true);
    setNotice(null);

    try {
      const [inventoryResponse, locationsResponse] = await Promise.all([
        fetch(INVENTORY_ENDPOINT, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
        fetch(LOCATIONS_ENDPOINT, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: { Accept: "application/json" },
        }),
      ]);

      const inventoryResult =
        await readJson<InventoryResponse>(inventoryResponse);
      const locationsResult =
        await readJson<LocationsResponse>(locationsResponse);

      if (!inventoryResponse.ok || !inventoryResult.data?.ok) {
        setNotice(
          errorNotice({
            title: "Low-stock items could not be loaded",
            response: inventoryResponse,
            payload: inventoryResult.data,
            rawText: inventoryResult.rawText,
            endpoint: INVENTORY_ENDPOINT,
            method: "GET",
          }),
        );
        setItems([]);
      } else {
        setItems(
          Array.isArray(inventoryResult.data.items)
            ? inventoryResult.data.items.map(normaliseItem)
            : [],
        );
      }

      if (!locationsResponse.ok || !locationsResult.data?.ok) {
        setLocations([]);
      } else {
        setLocations(
          Array.isArray(locationsResult.data.locations)
            ? locationsResult.data.locations.filter(
                (location) => location.isActive !== false,
              )
            : [],
        );
      }
    } catch (caught) {
      setItems([]);
      setLocations([]);
      setNotice({
        tone: "error",
        title: "Low-stock page could not be loaded",
        message:
          caught instanceof Error
            ? caught.message
            : "The browser could not connect to the Stock Management API.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const lowStockItems = useMemo(
    () =>
      items
        .filter(
          (item) =>
            item.isActive &&
            item.reorderLevel >= 0 &&
            item.quantity <= item.reorderLevel,
        )
        .map(toLowStockItem),
    [items],
  );

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          lowStockItems
            .map((item) => item.category?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [lowStockItems],
  );

  const suppliers = useMemo(
    () =>
      Array.from(
        new Set(
          lowStockItems
            .map((item) => item.supplier?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [lowStockItems],
  );

  const locationNames = useMemo(
    () =>
      Array.from(
        new Set(
          lowStockItems
            .map((item) => item.location?.trim())
            .filter((value): value is string => Boolean(value)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [lowStockItems],
  );

  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();

    const filtered = lowStockItems.filter((item) => {
      const matchesQuery =
        !cleanQuery ||
        [
          item.name,
          item.sku,
          item.barcode,
          item.category,
          item.supplier,
          item.location,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(cleanQuery),
          );

      return (
        matchesQuery &&
        (priorityFilter === "all" || item.priority === priorityFilter) &&
        (categoryFilter === "all" || item.category === categoryFilter) &&
        (supplierFilter === "all" ||
          (supplierFilter === "__none__"
            ? !item.supplier
            : item.supplier === supplierFilter)) &&
        (locationFilter === "all" || item.location === locationFilter)
      );
    });

    const priorityRank: Record<Priority, number> = {
      critical: 0,
      high: 1,
      low: 2,
    };

    filtered.sort((left, right) => {
      let result = 0;

      if (sortBy === "urgent") {
        result =
          priorityRank[left.priority] - priorityRank[right.priority] ||
          left.quantity - right.quantity ||
          right.unitsNeeded - left.unitsNeeded;
      } else if (sortBy === "quantity") {
        result = left.quantity - right.quantity;
      } else if (sortBy === "needed") {
        result = left.unitsNeeded - right.unitsNeeded;
      } else if (sortBy === "cost") {
        result =
          left.estimatedOrderCost - right.estimatedOrderCost;
      } else if (sortBy === "updated") {
        result =
          new Date(left.updatedAt || 0).getTime() -
          new Date(right.updatedAt || 0).getTime();
      } else {
        result = left.name.localeCompare(right.name);
      }

      return sortDirection === "asc" ? result : -result;
    });

    return filtered;
  }, [
    lowStockItems,
    query,
    priorityFilter,
    categoryFilter,
    supplierFilter,
    locationFilter,
    sortBy,
    sortDirection,
  ]);

  const summary = useMemo(
    () => ({
      lowStock: lowStockItems.filter((item) => item.quantity > 0).length,
      outOfStock: lowStockItems.filter((item) => item.quantity <= 0).length,
      unitsNeeded: lowStockItems.reduce(
        (total, item) => total + item.unitsNeeded,
        0,
      ),
      estimatedCost: lowStockItems.reduce(
        (total, item) => total + item.estimatedOrderCost,
        0,
      ),
      suppliers: new Set(
        lowStockItems.map((item) => item.supplier).filter(Boolean),
      ).size,
    }),
    [lowStockItems],
  );

  const warnings = useMemo(
    () => ({
      withoutSupplier: lowStockItems.filter((item) => !item.supplier).length,
      withoutTarget: lowStockItems.filter(
        (item) =>
          item.targetLevel === null ||
          item.targetLevel === undefined ||
          item.targetLevel <= item.reorderLevel,
      ).length,
      withoutCost: lowStockItems.filter(
        (item) => !item.unitCost || item.unitCost <= 0,
      ).length,
    }),
    [lowStockItems],
  );

  const allVisibleSelected =
    filteredItems.length > 0 &&
    filteredItems.every((item) => selectedIds.includes(item.id));

  function clearFilters() {
    setQuery("");
    setPriorityFilter("all");
    setCategoryFilter("all");
    setSupplierFilter("all");
    setLocationFilter("all");
    setSortBy("urgent");
    setSortDirection("asc");
  }

  function toggleVisibleSelection() {
    const visibleIds = filteredItems.map((item) => item.id);

    if (allVisibleSelected) {
      setSelectedIds((current) =>
        current.filter((id) => !visibleIds.includes(id)),
      );
      return;
    }

    setSelectedIds((current) =>
      Array.from(new Set([...current, ...visibleIds])),
    );
  }

  async function exportXlsx(selectedOnly = false) {
    const exportItems = selectedOnly
      ? filteredItems.filter((item) => selectedIds.includes(item.id))
      : filteredItems;

    if (exportItems.length === 0) {
      setNotice({
        tone: "warning",
        title: "Nothing to export",
        message:
          selectedOnly
            ? "Select at least one low-stock item before exporting."
            : "There are no matching low-stock items to export.",
      });
      return;
    }

    setNotice(null);

    try {
      const workbook = new ExcelJS.Workbook();

      workbook.creator = "Burton Pride Stock Management";
      workbook.lastModifiedBy = "Burton Pride Stock Management";
      workbook.created = new Date();
      workbook.modified = new Date();
      // ExcelJS Workbook has no 'company' property; keep company info in description instead
      // workbook.company = "Burton Pride";
      Object.assign(workbook.properties, {
        subject: "Low-stock report",
        title: selectedOnly
          ? "Selected Low Stock Report"
          : "Low Stock Report",
        description:
          "A styled Microsoft Excel report exported from Burton Pride Stock Management.",
      });

      const exportedAt = new Date();
      const fileDate = exportedAt.toISOString().slice(0, 10);

      const summarySheet = workbook.addWorksheet("Summary", {
        views: [{ state: "frozen", ySplit: 5 }],
        properties: {
          defaultRowHeight: 20,
        },
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.3,
            right: 0.3,
            top: 0.5,
            bottom: 0.5,
            header: 0.2,
            footer: 0.2,
          },
        },
      });

      const reportSheet = workbook.addWorksheet("Low Stock Report", {
        views: [{ state: "frozen", ySplit: 6 }],
        properties: {
          defaultRowHeight: 20,
        },
        pageSetup: {
          orientation: "landscape",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          paperSize: 9,
          margins: {
            left: 0.2,
            right: 0.2,
            top: 0.4,
            bottom: 0.4,
            header: 0.2,
            footer: 0.2,
          },
        },
      });

      const titleFill = "FF24163A";
      const headingFill = "FF4C1D95";
      const accentFill = "FFF59E0B";
      const lightFill = "FFF8FAFC";
      const borderColour = "FFD1D5DB";
      const textColour = "FF111827";
      const mutedColour = "FF6B7280";
      const white = "FFFFFFFF";
      const redFill = "FFFEE2E2";
      const redText = "FF991B1B";
      const orangeFill = "FFFFEDD5";
      const orangeText = "FF9A3412";
      const amberFill = "FFFEF3C7";
      const amberText = "FF92400E";
      const greenFill = "FFDCFCE7";
      const greenText = "FF166534";

      function applyThinBorder(cell: ExcelJS.Cell) {
        cell.border = {
          top: { style: "thin", color: { argb: borderColour } },
          left: { style: "thin", color: { argb: borderColour } },
          bottom: { style: "thin", color: { argb: borderColour } },
          right: { style: "thin", color: { argb: borderColour } },
        };
      }

      function styleSectionHeader(
        sheet: ExcelJS.Worksheet,
        range: string,
        textValue: string,
      ) {
        sheet.mergeCells(range);
        const firstCell = sheet.getCell(range.split(":")[0]);
        firstCell.value = textValue;
        firstCell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: headingFill },
        };
        firstCell.font = {
          bold: true,
          color: { argb: white },
          size: 12,
        };
        firstCell.alignment = {
          vertical: "middle",
          horizontal: "left",
        };
      }

      const totalUnitsNeeded = exportItems.reduce(
        (total, item) => total + item.unitsNeeded,
        0,
      );
      const totalEstimatedCost = exportItems.reduce(
        (total, item) => total + item.estimatedOrderCost,
        0,
      );
      const outOfStockCount = exportItems.filter(
        (item) => item.quantity <= 0,
      ).length;
      const lowStockCount = exportItems.filter(
        (item) => item.quantity > 0,
      ).length;
      const supplierCount = new Set(
        exportItems.map((item) => item.supplier).filter(Boolean),
      ).size;

      // Summary sheet title.
      summarySheet.mergeCells("A1:F2");
      const summaryTitle = summarySheet.getCell("A1");
      summaryTitle.value = selectedOnly
        ? "Burton Pride Selected Low Stock Report"
        : "Burton Pride Low Stock Report";
      summaryTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: titleFill },
      };
      summaryTitle.font = {
        bold: true,
        color: { argb: white },
        size: 20,
      };
      summaryTitle.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      summarySheet.getRow(1).height = 28;
      summarySheet.getRow(2).height = 28;

      summarySheet.mergeCells("A3:F3");
      const generatedCell = summarySheet.getCell("A3");
      generatedCell.value = `Generated ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
      }).format(exportedAt)}`;
      generatedCell.font = {
        italic: true,
        color: { argb: mutedColour },
      };
      generatedCell.alignment = {
        horizontal: "center",
      };

      summarySheet.mergeCells("A4:F4");
      const filterCell = summarySheet.getCell("A4");
      filterCell.value = [
        `Scope: ${selectedOnly ? "Selected items" : "All matching items"}`,
        `Search: ${query.trim() || "None"}`,
        `Priority: ${priorityFilter}`,
        `Category: ${categoryFilter}`,
        `Supplier: ${supplierFilter}`,
        `Location: ${locationFilter}`,
      ].join("  |  ");
      filterCell.font = {
        color: { argb: mutedColour },
        size: 10,
      };
      filterCell.alignment = {
        horizontal: "center",
        wrapText: true,
      };
      summarySheet.getRow(4).height = 32;

      styleSectionHeader(summarySheet, "A6:F6", "Low-stock overview");

      const summaryMetrics = [
        ["Items in report", exportItems.length],
        ["Low-stock items", lowStockCount],
        ["Out-of-stock items", outOfStockCount],
        ["Units needed", totalUnitsNeeded],
        ["Suppliers affected", supplierCount],
        ["Estimated restock cost", totalEstimatedCost],
      ];

      summaryMetrics.forEach(([label, value], index) => {
        const row = summarySheet.getRow(7 + index);
        row.getCell(1).value = label;
        row.getCell(1).font = {
          bold: true,
          color: { argb: textColour },
        };
        row.getCell(2).value = value;

        if (label === "Estimated restock cost") {
          row.getCell(2).numFmt = '£#,##0.00;[Red]-£#,##0.00';
        } else {
          row.getCell(2).numFmt = "0";
        }

        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: lightFill },
        };
        row.getCell(2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: white },
        };
        applyThinBorder(row.getCell(1));
        applyThinBorder(row.getCell(2));
      });

      styleSectionHeader(summarySheet, "A15:F15", "Important notes");

      const noteRows = [
        [
          "Supplier warning",
          `${warnings.withoutSupplier} low-stock item${
            warnings.withoutSupplier === 1 ? "" : "s"
          } without a supplier.`,
        ],
        [
          "Target-level warning",
          `${warnings.withoutTarget} item${
            warnings.withoutTarget === 1 ? "" : "s"
          } without a suitable target level.`,
        ],
        [
          "Unit-cost warning",
          `${warnings.withoutCost} item${
            warnings.withoutCost === 1 ? "" : "s"
          } without a usable unit cost.`,
        ],
      ];

      noteRows.forEach(([label, value], index) => {
        const row = summarySheet.getRow(16 + index);
        row.getCell(1).value = label;
        row.getCell(2).value = value;
        summarySheet.mergeCells(`B${16 + index}:F${16 + index}`);

        row.getCell(1).font = {
          bold: true,
          color: { argb: amberText },
        };
        row.getCell(1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: amberFill },
        };
        row.getCell(2).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: amberFill },
        };
        row.getCell(2).alignment = { wrapText: true };

        for (let column = 1; column <= 6; column += 1) {
          applyThinBorder(row.getCell(column));
        }
      });

      summarySheet.columns = [
        { width: 25 },
        { width: 22 },
        { width: 18 },
        { width: 18 },
        { width: 18 },
        { width: 24 },
      ];

      summarySheet.headerFooter.oddHeader =
        "&C&B Burton Pride Stock Management";
      summarySheet.headerFooter.oddFooter =
        "&L Low Stock Report&C Page &P of &N&R Generated &D";

      // Detailed report title and metadata.
      reportSheet.mergeCells("A1:N2");
      const reportTitle = reportSheet.getCell("A1");
      reportTitle.value = selectedOnly
        ? "Burton Pride Selected Low Stock Items"
        : "Burton Pride Low Stock Items";
      reportTitle.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: titleFill },
      };
      reportTitle.font = {
        bold: true,
        color: { argb: white },
        size: 20,
      };
      reportTitle.alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      reportSheet.getRow(1).height = 28;
      reportSheet.getRow(2).height = 28;

      reportSheet.mergeCells("A3:N3");
      const reportGenerated = reportSheet.getCell("A3");
      reportGenerated.value = `Generated: ${new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(exportedAt)} | Rows: ${exportItems.length}`;
      reportGenerated.font = {
        italic: true,
        color: { argb: mutedColour },
      };
      reportGenerated.alignment = {
        horizontal: "center",
      };

      reportSheet.mergeCells("A4:N4");
      const reportFilters = reportSheet.getCell("A4");
      reportFilters.value = `Filters — Search: ${
        query.trim() || "None"
      }; Priority: ${priorityFilter}; Category: ${categoryFilter}; Supplier: ${supplierFilter}; Location: ${locationFilter}; Sort: ${sortBy} ${sortDirection}`;
      reportFilters.font = {
        color: { argb: mutedColour },
        size: 10,
      };
      reportFilters.alignment = {
        horizontal: "center",
        wrapText: true,
      };

      const headers = [
        "Item",
        "SKU",
        "Category",
        "Location",
        "Current quantity",
        "Reorder level",
        "Target level",
        "Units needed",
        "Supplier",
        "Unit cost",
        "Estimated order cost",
        "Priority",
        "Last updated",
        "Updated by",
      ];

      const headerRowNumber = 6;
      const headerRow = reportSheet.getRow(headerRowNumber);
      headerRow.values = headers;
      headerRow.height = 30;

      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: headingFill },
        };
        cell.font = {
          bold: true,
          color: { argb: white },
          size: 10,
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
          wrapText: true,
        };
        applyThinBorder(cell);
      });

      exportItems.forEach((item, index) => {
        const rowNumber = headerRowNumber + 1 + index;
        const row = reportSheet.getRow(rowNumber);
        const locationName =
          locations.find((location) => location.id === item.location)?.name ||
          item.location ||
          "Not set";

        row.values = [
          item.name,
          item.sku,
          item.category || "Uncategorised",
          locationName,
          item.quantity,
          item.reorderLevel,
          item.targetLevel ?? item.desiredLevel,
          item.unitsNeeded,
          item.supplier || "Not assigned",
          item.unitCost ?? null,
          item.estimatedOrderCost,
          item.priority === "critical"
            ? "Critical"
            : item.priority === "high"
              ? "High priority"
              : "Low stock",
          item.updatedAt ? new Date(item.updatedAt) : null,
          item.updatedByName || "Not recorded",
        ];

        row.height = 24;

        row.eachCell((cell, columnNumber) => {
          cell.font = {
            color: { argb: textColour },
            size: 10,
          };
          cell.alignment = {
            vertical: "middle",
            horizontal:
              columnNumber >= 5 && columnNumber <= 8
                ? "center"
                : columnNumber === 10 || columnNumber === 11
                  ? "right"
                  : "left",
            wrapText: true,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: {
              argb: index % 2 === 0 ? white : lightFill,
            },
          };
          applyThinBorder(cell);
        });

        row.getCell(5).numFmt = "0";
        row.getCell(6).numFmt = "0";
        row.getCell(7).numFmt = "0";
        row.getCell(8).numFmt = "0";
        row.getCell(10).numFmt = '£#,##0.00;[Red]-£#,##0.00';
        row.getCell(11).numFmt = '£#,##0.00;[Red]-£#,##0.00';
        row.getCell(13).numFmt = "dd/mm/yyyy hh:mm";

        const priorityCell = row.getCell(12);
        if (item.priority === "critical") {
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: redFill },
          };
          priorityCell.font = {
            bold: true,
            color: { argb: redText },
          };
        } else if (item.priority === "high") {
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: orangeFill },
          };
          priorityCell.font = {
            bold: true,
            color: { argb: orangeText },
          };
        } else {
          priorityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: amberFill },
          };
          priorityCell.font = {
            bold: true,
            color: { argb: amberText },
          };
        }

        const quantityCell = row.getCell(5);
        if (item.quantity <= 0) {
          quantityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: redFill },
          };
          quantityCell.font = {
            bold: true,
            color: { argb: redText },
          };
        } else {
          quantityCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: amberFill },
          };
          quantityCell.font = {
            bold: true,
            color: { argb: amberText },
          };
        }

        const estimatedCostCell = row.getCell(11);
        if (item.estimatedOrderCost <= 0) {
          estimatedCostCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: greenFill },
          };
          estimatedCostCell.font = {
            color: { argb: greenText },
          };
        }
      });

      const finalDataRow = headerRowNumber + exportItems.length;

      reportSheet.autoFilter = {
        from: {
          row: headerRowNumber,
          column: 1,
        },
        to: {
          row: finalDataRow,
          column: headers.length,
        },
      };

      reportSheet.columns = [
        { key: "item", width: 30 },
        { key: "sku", width: 20 },
        { key: "category", width: 20 },
        { key: "location", width: 24 },
        { key: "currentQuantity", width: 14 },
        { key: "reorderLevel", width: 14 },
        { key: "targetLevel", width: 14 },
        { key: "unitsNeeded", width: 14 },
        { key: "supplier", width: 25 },
        { key: "unitCost", width: 14 },
        { key: "estimatedCost", width: 20 },
        { key: "priority", width: 16 },
        { key: "updatedAt", width: 20 },
        { key: "updatedBy", width: 24 },
      ];

      reportSheet.headerFooter.oddHeader =
        "&C&B Burton Pride Stock Management";
      reportSheet.headerFooter.oddFooter =
        "&L Low Stock Report&C Page &P of &N&R Generated &D";

      // Add a totals row below the report table.
      const totalsRowNumber = finalDataRow + 2;
      reportSheet.mergeCells(`A${totalsRowNumber}:G${totalsRowNumber}`);
      const totalsLabelCell = reportSheet.getCell(`A${totalsRowNumber}`);
      totalsLabelCell.value = "Report totals";
      totalsLabelCell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: accentFill },
      };
      totalsLabelCell.font = {
        bold: true,
        color: { argb: textColour },
      };

      reportSheet.getCell(`H${totalsRowNumber}`).value = totalUnitsNeeded;
      reportSheet.getCell(`H${totalsRowNumber}`).numFmt = "0";
      reportSheet.getCell(`J${totalsRowNumber}`).value = "Estimated total";
      reportSheet.getCell(`J${totalsRowNumber}`).font = { bold: true };
      reportSheet.getCell(`K${totalsRowNumber}`).value = totalEstimatedCost;
      reportSheet.getCell(`K${totalsRowNumber}`).numFmt =
        '£#,##0.00;[Red]-£#,##0.00';
      reportSheet.getCell(`K${totalsRowNumber}`).font = { bold: true };

      for (let column = 1; column <= headers.length; column += 1) {
        const cell = reportSheet.getRow(totalsRowNumber).getCell(column);
        if (!cell.fill || cell.fill.type !== "pattern") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: amberFill },
          };
        }
        applyThinBorder(cell);
      }

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");

      anchor.href = url;
      anchor.download = selectedOnly
        ? `burton-pride-selected-low-stock-${fileDate}.xlsx`
        : `burton-pride-low-stock-${fileDate}.xlsx`;

      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);

      await reportAudit({
        actionKey: "inventory_report_exported",
        actionLabel: selectedOnly
          ? "Selected low-stock Excel report exported"
          : "Low-stock Excel report exported",
        actionCategory: "export",
        module: "reports",
        status: "success",
        riskLevel: "low",
        description: selectedOnly
          ? `${exportItems.length} selected low-stock item${
              exportItems.length === 1 ? "" : "s"
            } were exported as a styled Excel workbook.`
          : `${exportItems.length} low-stock item${
              exportItems.length === 1 ? "" : "s"
            } were exported as a styled Excel workbook.`,
        reason:
          "Styled XLSX low-stock report downloaded from Stock Management.",
        recordType: "inventory_report",
        recordId: null,
        recordName: selectedOnly
          ? "Burton Pride selected low-stock Excel report"
          : "Burton Pride low-stock Excel report",
        responseStatus: 200,
        apiEndpoint: "client://stockmanagement/low-stock/export",
        metadata: {
          source: "low_stock_client",
          format: "xlsx",
          styledWorkbook: true,
          sheets: ["Summary", "Low Stock Report"],
          selectedOnly,
          exportedRows: exportItems.length,
          totalUnitsNeeded,
          totalEstimatedCost,
          filters: {
            search: query,
            priority: priorityFilter,
            category: categoryFilter,
            supplier: supplierFilter,
            location: locationFilter,
            sortBy,
            sortDirection,
          },
        },
      });

      setNotice({
        tone: "success",
        title: "Excel report exported",
        message: `${exportItems.length} low-stock item${
          exportItems.length === 1 ? "" : "s"
        } were exported as a styled XLSX workbook and reported to the audit logs.`,
      });
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Excel report could not be exported",
        message:
          caught instanceof Error
            ? caught.message
            : "The styled XLSX workbook could not be created.",
      });
    }
  }

  function openAdjust(item: LowStockItem) {
    setAdjustForm({
      item,
      quantity: String(Math.max(item.unitsNeeded, 1)),
      reason: "Restock low-stock item",
      notes: "",
    });
    setShowAdjustModal(true);
    setNotice(null);
  }

  function openDetails(item: LowStockItem) {
    setDetailsItem(item);
    setShowDetailsModal(true);
    setNotice(null);
  }

  function openEdit(item: LowStockItem) {
    const locationId =
      locations.find(
        (location) =>
          location.id === item.location ||
          location.name.trim().toLowerCase() ===
            String(item.location || "").trim().toLowerCase(),
      )?.id ||
      item.location ||
      "";

    setEditItemId(item.id);
    setEditItemForm({
      id: item.id,
      name: item.name,
      sku: item.sku,
      barcode: item.barcode || "",
      description: item.description || "",
      category: item.category || "",
      location: locationId,
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

    setShowEditModal(true);
    setNotice(null);
  }

  async function saveEditedItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editItemId || saving) return;

    const name = editItemForm.name.trim();
    const sku = editItemForm.sku.trim();

    if (!name || !sku) {
      setNotice({
        tone: "warning",
        title: "Name and SKU are required",
        message: "Enter an item name and a unique SKU before saving.",
      });
      return;
    }

    const numberValue = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    const quantity = numberValue(editItemForm.quantity);
    const reorderLevel = numberValue(editItemForm.reorderLevel);
    const targetLevel = editItemForm.targetLevel
      ? numberValue(editItemForm.targetLevel)
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

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: editItemId,
          name,
          sku,
          barcode: editItemForm.barcode.trim() || null,
          description: editItemForm.description.trim() || null,
          category: editItemForm.category.trim() || null,
          location: editItemForm.location.trim() || null,
          supplier: editItemForm.supplier.trim() || null,
          quantity,
          reorderLevel,
          targetLevel,
          unitCost: editItemForm.unitCost
            ? numberValue(editItemForm.unitCost)
            : null,
          salePrice: editItemForm.salePrice
            ? numberValue(editItemForm.salePrice)
            : null,
          isActive: editItemForm.isActive,
        }),
      });

      const result = await readJson<InventoryResponse>(response);

      if (!response.ok || !result.data?.ok) {
        setNotice(
          errorNotice({
            title: "Stock item could not be updated",
            response,
            payload: result.data,
            rawText: result.rawText,
            endpoint: INVENTORY_ENDPOINT,
            method: "PATCH",
          }),
        );
        return;
      }

      const beforeItem =
        items.find((item) => item.id === editItemId) || null;
      const returnedItem = result.data.items?.[0] || null;
      const afterItem = returnedItem
        ? normaliseItem(returnedItem)
        : normaliseItem({
            ...beforeItem,
            id: editItemId,
            name,
            sku,
            barcode: editItemForm.barcode.trim() || null,
            description: editItemForm.description.trim() || null,
            category: editItemForm.category.trim() || null,
            location: editItemForm.location.trim() || null,
            supplier: editItemForm.supplier.trim() || null,
            quantity,
            reorderLevel,
            targetLevel,
            unitCost: editItemForm.unitCost
              ? numberValue(editItemForm.unitCost)
              : null,
            salePrice: editItemForm.salePrice
              ? numberValue(editItemForm.salePrice)
              : null,
            isActive: editItemForm.isActive,
          });

      await reportAudit({
        actionKey: "stock_item_updated",
        actionLabel: "Low-stock item updated",
        actionCategory: "update",
        module: "inventory",
        status: "success",
        riskLevel: "low",
        description: `${name} was updated from the Low Stock page.`,
        reason: "Stock item details were changed using the Low Stock edit form.",
        recordType: "stock_item",
        recordId: editItemId,
        recordName: name,
        recordReference: sku,
        stockItemId: editItemId,
        stockItemName: name,
        stockItemSku: sku,
        locationId: editItemForm.location.trim() || null,
        quantityBefore: beforeItem?.quantity ?? null,
        quantityAfter: quantity,
        quantityChanged:
          beforeItem ? quantity - beforeItem.quantity : null,
        beforeData: beforeItem ? itemSnapshot(beforeItem) : null,
        afterData: itemSnapshot(afterItem),
        changedFields: beforeItem
          ? Object.keys(itemSnapshot(afterItem)).filter(
              (key) =>
                JSON.stringify(
                  itemSnapshot(beforeItem)[
                    key as keyof ReturnType<typeof itemSnapshot>
                  ],
                ) !==
                JSON.stringify(
                  itemSnapshot(afterItem)[
                    key as keyof ReturnType<typeof itemSnapshot>
                  ],
                ),
            )
          : Object.keys(itemSnapshot(afterItem)),
        responseStatus: 200,
        apiEndpoint: INVENTORY_ENDPOINT,
        metadata: {
          source: "low_stock_client",
        },
      });

      setShowEditModal(false);
      setEditItemId(null);
      setEditItemForm(EMPTY_ADD_ITEM_FORM);
      setNotice({
        tone: "success",
        title: "Stock item updated",
        message: `${name} has been updated and reported to the audit logs.`,
      });

      await loadData();
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Stock item could not be updated",
        message:
          caught instanceof Error
            ? caught.message
            : "The browser could not update the stock item.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function saveAdjustment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adjustForm || saving) return;

    const quantity = Number(adjustForm.quantity);

    if (!Number.isInteger(quantity) || quantity < 1) {
      setNotice({
        tone: "warning",
        title: "Enter a valid quantity",
        message: "The received quantity must be a whole number of at least 1.",
      });
      return;
    }

    if (!adjustForm.reason.trim()) {
      setNotice({
        tone: "warning",
        title: "A reason is required",
        message: "Enter a reason for adding this stock.",
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stockItemId: adjustForm.item.id,
          movementType: "add",
          quantity,
          reason: adjustForm.reason.trim(),
          notes: adjustForm.notes.trim() || null,
        }),
      });

      const result = await readJson<InventoryResponse>(response);

      if (!response.ok || !result.data?.ok) {
        setNotice(
          errorNotice({
            title: "Stock could not be added",
            response,
            payload: result.data,
            rawText: result.rawText,
            endpoint: MOVEMENT_ENDPOINT,
            method: "POST",
          }),
        );
        return;
      }

      const quantityBefore = adjustForm.item.quantity;
      const quantityAfter = quantityBefore + quantity;

      await reportAudit({
        actionKey: "stock_quantity_adjusted",
        actionLabel: "Low-stock item restocked",
        actionCategory: "adjust",
        module: "movements",
        status: "success",
        riskLevel: "medium",
        description: `${quantity} unit${
          quantity === 1 ? "" : "s"
        } were added to ${adjustForm.item.name}.`,
        reason: adjustForm.reason.trim(),
        notes: adjustForm.notes.trim() || null,
        recordType: "stock_movement",
        recordId: null,
        recordName: adjustForm.item.name,
        recordReference: adjustForm.item.sku,
        stockItemId: adjustForm.item.id,
        stockItemName: adjustForm.item.name,
        stockItemSku: adjustForm.item.sku,
        locationId: adjustForm.item.location || null,
        quantityBefore,
        quantityAfter,
        quantityChanged: quantity,
        beforeData: {
          ...itemSnapshot(adjustForm.item),
          quantity: quantityBefore,
        },
        afterData: {
          ...itemSnapshot(adjustForm.item),
          quantity: quantityAfter,
        },
        changedFields: ["quantity"],
        responseStatus: 200,
        apiEndpoint: MOVEMENT_ENDPOINT,
        metadata: {
          source: "low_stock_client",
          movementType: "add",
        },
      });

      setShowAdjustModal(false);
      setAdjustForm(null);
      setNotice({
        tone: "success",
        title: "Stock added",
        message: `${quantity} unit${
          quantity === 1 ? "" : "s"
        } were added to ${adjustForm.item.name} and reported to the audit logs.`,
      });
      await loadData();
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Stock could not be added",
        message:
          caught instanceof Error
            ? caught.message
            : "The stock movement request failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  function openMove(item: LowStockItem) {
    setMoveForm({
      ...EMPTY_MOVE_STOCK_FORM,
      stockItemId: item.id,
    });
    setShowMoveModal(true);
    setNotice(null);
  }

  async function saveMove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const selectedItem = items.find(
      (item) => item.id === moveForm.stockItemId,
    );

    if (!selectedItem) {
      setNotice({
        tone: "warning",
        title: "Select a stock item",
        message: "Choose the item that should be moved.",
      });
      return;
    }

    const currentLocationValue = String(selectedItem.location || "").trim();
    const currentLocation = locations.find(
      (location) =>
        location.id === currentLocationValue ||
        location.name.toLowerCase() === currentLocationValue.toLowerCase(),
    );
    const destination = locations.find(
      (location) => location.id === moveForm.destinationLocation,
    );

    if (!currentLocation || !destination) {
      setNotice({
        tone: "warning",
        title: "Choose valid locations",
        message:
          "The item must have a valid current location and an active destination.",
      });
      return;
    }

    const quantity = moveForm.moveAllStock
      ? selectedItem.quantity
      : Number(moveForm.quantity);

    if (
      !Number.isInteger(quantity) ||
      quantity < 1 ||
      quantity > selectedItem.quantity
    ) {
      setNotice({
        tone: "warning",
        title: "Enter a valid quantity",
        message: `Choose a quantity between 1 and ${selectedItem.quantity}.`,
      });
      return;
    }

    if (!moveForm.reason.trim()) {
      setNotice({
        tone: "warning",
        title: "A reason is required",
        message: "Explain why the stock is being moved.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const notes = [moveForm.reason.trim(), moveForm.notes.trim()]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch(MOVE_STOCK_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemId: selectedItem.id,
          fromLocationId: currentLocation.id,
          toLocationId: destination.id,
          quantity,
          notes: notes || null,
        }),
      });

      const result = await readJson<InventoryResponse>(response);

      if (!response.ok || !result.data?.ok) {
        setNotice(
          errorNotice({
            title: "Stock could not be moved",
            response,
            payload: result.data,
            rawText: result.rawText,
            endpoint: MOVE_STOCK_ENDPOINT,
            method: "POST",
          }),
        );
        return;
      }

      await reportAudit({
        actionKey: "stock_location_moved",
        actionLabel: "Low-stock item moved",
        actionCategory: "move",
        module: "locations",
        status: "success",
        riskLevel: "medium",
        description: `${quantity} unit${
          quantity === 1 ? "" : "s"
        } of ${selectedItem.name} ${
          quantity === 1 ? "was" : "were"
        } moved from ${currentLocation.name} to ${destination.name}.`,
        reason: moveForm.reason.trim(),
        notes: moveForm.notes.trim() || null,
        recordType: "stock_movement",
        recordId: null,
        recordName: selectedItem.name,
        recordReference: selectedItem.sku,
        stockItemId: selectedItem.id,
        stockItemName: selectedItem.name,
        stockItemSku: selectedItem.sku,
        locationId: destination.id,
        locationName: destination.name,
        fromLocationId: currentLocation.id,
        fromLocationName: currentLocation.name,
        toLocationId: destination.id,
        toLocationName: destination.name,
        quantityBefore: selectedItem.quantity,
        quantityAfter: Math.max(0, selectedItem.quantity - quantity),
        quantityChanged: -quantity,
        beforeData: {
          ...itemSnapshot(selectedItem),
          location: currentLocation.id,
          quantity: selectedItem.quantity,
        },
        afterData: {
          ...itemSnapshot(selectedItem),
          location: destination.id,
          quantity: Math.max(0, selectedItem.quantity - quantity),
          quantityMoved: quantity,
        },
        changedFields: ["location", "quantity"],
        responseStatus: 200,
        apiEndpoint: MOVE_STOCK_ENDPOINT,
        metadata: {
          source: "low_stock_client",
          moveAllStock: moveForm.moveAllStock,
        },
      });

      setShowMoveModal(false);
      setMoveForm(EMPTY_MOVE_STOCK_FORM);
      setNotice({
        tone: "success",
        title: "Stock moved",
        message:
          result.data.message ||
          `${quantity} unit${
            quantity === 1 ? "" : "s"
          } of ${selectedItem.name} ${
            quantity === 1 ? "has" : "have"
          } been moved to ${destination.name} and reported to the audit logs.`,
      });
      await loadData();
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Stock could not be moved",
        message:
          caught instanceof Error
            ? caught.message
            : "The move-stock request failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  function openAddItemModal() {
    setAddItemForm(EMPTY_ADD_ITEM_FORM);
    setShowAddItemModal(true);
    setNotice(null);
  }

  async function saveNewItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;

    const name = addItemForm.name.trim();
    const sku = addItemForm.sku.trim();

    if (!name || !sku) {
      setNotice({
        tone: "warning",
        title: "Name and SKU are required",
        message: "Enter an item name and a unique SKU before saving.",
      });
      return;
    }

    const numberValue = (value: string) => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(INVENTORY_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          sku,
          barcode: addItemForm.barcode.trim() || null,
          description: addItemForm.description.trim() || null,
          category: addItemForm.category.trim() || null,
          location: addItemForm.location.trim() || null,
          supplier: addItemForm.supplier.trim() || null,
          quantity: numberValue(addItemForm.quantity),
          reorderLevel: numberValue(addItemForm.reorderLevel),
          targetLevel: addItemForm.targetLevel
            ? numberValue(addItemForm.targetLevel)
            : null,
          unitCost: addItemForm.unitCost
            ? numberValue(addItemForm.unitCost)
            : null,
          salePrice: addItemForm.salePrice
            ? numberValue(addItemForm.salePrice)
            : null,
          isActive: addItemForm.isActive,
        }),
      });

      const result = await readJson<InventoryResponse>(response);

      if (!response.ok || !result.data?.ok) {
        setNotice(
          errorNotice({
            title: "Stock item could not be created",
            response,
            payload: result.data,
            rawText: result.rawText,
            endpoint: INVENTORY_ENDPOINT,
            method: "POST",
          }),
        );
        return;
      }

      const createdItem =
        result.data.items?.[0] ||
        normaliseItem({
          id: "",
          name,
          sku,
          barcode: addItemForm.barcode.trim() || null,
          description: addItemForm.description.trim() || null,
          category: addItemForm.category.trim() || null,
          location: addItemForm.location.trim() || null,
          supplier: addItemForm.supplier.trim() || null,
          quantity: numberValue(addItemForm.quantity),
          reorderLevel: numberValue(addItemForm.reorderLevel),
          targetLevel: addItemForm.targetLevel
            ? numberValue(addItemForm.targetLevel)
            : null,
          unitCost: addItemForm.unitCost
            ? numberValue(addItemForm.unitCost)
            : null,
          salePrice: addItemForm.salePrice
            ? numberValue(addItemForm.salePrice)
            : null,
          isActive: addItemForm.isActive,
        });

      await reportAudit({
        actionKey: "stock_item_created",
        actionLabel: "Stock item created from Low Stock",
        actionCategory: "create",
        module: "inventory",
        status: "success",
        riskLevel: "low",
        description: `${name} was created from the Low Stock page.`,
        reason: "Created using the Add stock item form on the Low Stock page.",
        recordType: "stock_item",
        recordId: createdItem.id || null,
        recordName: name,
        recordReference: sku,
        stockItemId: createdItem.id || null,
        stockItemName: name,
        stockItemSku: sku,
        locationId: addItemForm.location.trim() || null,
        quantityAfter: numberValue(addItemForm.quantity),
        beforeData: null,
        afterData: itemSnapshot(normaliseItem(createdItem)),
        changedFields: Object.keys(itemSnapshot(normaliseItem(createdItem))),
        responseStatus: 201,
        apiEndpoint: INVENTORY_ENDPOINT,
        metadata: {
          source: "low_stock_client",
        },
      });

      setShowAddItemModal(false);
      setAddItemForm(EMPTY_ADD_ITEM_FORM);
      setNotice({
        tone: "success",
        title: "Stock item created",
        message: `${name} has been added to inventory and reported to the audit logs.`,
      });

      await loadData();
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Stock item could not be created",
        message:
          caught instanceof Error
            ? caught.message
            : "The browser could not create the stock item.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function createTestLowStockItem() {
    if (creatingTestItem || saving) return;

    setCreatingTestItem(true);
    setNotice(null);

    try {
      const preferredLocation =
        locations.find((location) => location.isActive !== false) || null;

      const payload = createLowStockTestPayload({
        locationName: preferredLocation?.name || null,
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

      const result = await readJson<InventoryResponse>(response);

      if (!response.ok || !result.data?.ok) {
        setNotice(
          errorNotice({
            title: "Test low-stock item could not be created",
            response,
            payload: result.data,
            rawText: result.rawText,
            endpoint: INVENTORY_ENDPOINT,
            method: "POST",
          }),
        );
        return;
      }

      const createdTestItem =
        result.data.items?.[0] || null;

      await reportAudit({
        actionKey: "test_stock_item_created",
        actionLabel: "Test low-stock item created",
        actionCategory: "create",
        module: "inventory",
        status: "success",
        riskLevel: "low",
        description: `${payload.name} was created for Low Stock testing.`,
        reason: "Created using the Low Stock test-item button.",
        recordType: "stock_item",
        recordId: createdTestItem?.id || null,
        recordName: payload.name,
        recordReference: payload.sku,
        stockItemId: createdTestItem?.id || null,
        stockItemName: payload.name,
        stockItemSku: payload.sku,
        locationId: preferredLocation?.id || null,
        locationName: preferredLocation?.name || null,
        quantityAfter: Number(payload.quantity || 0),
        beforeData: null,
        afterData: {
          ...payload,
          id: createdTestItem?.id || null,
        },
        changedFields: Object.keys(payload),
        responseStatus: 201,
        apiEndpoint: INVENTORY_ENDPOINT,
        metadata: {
          source: "low_stock_client",
          isTestItem: true,
        },
      });

      setNotice({
        tone: "success",
        title: "Test low-stock item created",
        message: `${lowStockTestSuccessMessage(
          payload.name,
          preferredLocation?.name || null,
        )} The action was reported to the audit logs.`,
      });

      await loadData();
    } catch (caught) {
      setNotice({
        tone: "error",
        title: "Test low-stock item could not be created",
        message:
          caught instanceof Error
            ? caught.message
            : "The browser could not create the test item.",
      });
    } finally {
      setCreatingTestItem(false);
    }
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
              onClick={() => void createTestLowStockItem()}
              disabled={creatingTestItem || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-50"
              title="Create a clearly marked test item for the Low Stock page"
            >
              {creatingTestItem ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {creatingTestItem
                ? "Creating test item..."
                : "Create test low-stock item"}
            </button>

            <button
              type="button"
              onClick={() => void loadData()}
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
              onClick={() => void exportXlsx(false)}
              disabled={filteredItems.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-purple-700 transition hover:bg-white/90 disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Export Excel report
            </button>

            <button
              type="button"
              onClick={openAddItemModal}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-2xl bg-blue-400 px-4 py-2.5 text-sm font-black text-slate-950 transition hover:bg-blue-300 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add stock item
            </button>
          </div>
        </div>

        <header className="relative overflow-hidden rounded-[2rem] border border-amber-300/15 bg-[#2b2433] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.35)] sm:p-8 lg:p-9">
          <div className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 right-8 h-72 w-72 rounded-full bg-red-400/10 blur-3xl" />

          <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-4xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.2em] text-amber-100">
                <PackageMinus className="h-4 w-4" />
                Burton Pride Stock Control
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-5xl">
                Low Stock
              </h1>

              <p className="mt-4 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
                See which Burton Pride supplies are running low, what has run
                out, and how many units should be ordered to restore safe stock
                levels.
              </p>
            </div>

            <div className="rounded-3xl border border-amber-300/15 bg-black/15 p-5">
              <p className="text-xs font-black uppercase tracking-[0.13em] text-amber-100/60">
                Total estimated restock
              </p>
              <p className="mt-2 text-3xl font-black text-amber-50">
                {formatCurrency(summary.estimatedCost)}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Based on saved unit costs
              </p>
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
            label="Low stock"
            value={summary.lowStock}
            icon={PackageMinus}
            tone="amber"
          />
          <SummaryCard
            label="Out of stock"
            value={summary.outOfStock}
            icon={PackageOpen}
            tone="red"
          />
          <SummaryCard
            label="Units needed"
            value={summary.unitsNeeded}
            icon={Boxes}
            tone="blue"
          />
          <SummaryCard
            label="Estimated cost"
            value={formatCurrency(summary.estimatedCost)}
            icon={CircleDollarSign}
            tone="emerald"
          />
          <SummaryCard
            label="Suppliers affected"
            value={summary.suppliers}
            icon={Users}
            tone="purple"
          />
        </section>

        {(warnings.withoutSupplier > 0 ||
          warnings.withoutTarget > 0 ||
          warnings.withoutCost > 0) && (
          <section className="mt-6 grid gap-3 lg:grid-cols-3">
            {warnings.withoutSupplier > 0 ? (
              <WarningCard
                message={`${warnings.withoutSupplier} low-stock item${
                  warnings.withoutSupplier === 1 ? "" : "s"
                } do not have a supplier assigned.`}
              />
            ) : null}

            {warnings.withoutTarget > 0 ? (
              <WarningCard
                message={`${warnings.withoutTarget} item${
                  warnings.withoutTarget === 1 ? "" : "s"
                } do not have a target level above the reorder level.`}
              />
            ) : null}

            {warnings.withoutCost > 0 ? (
              <WarningCard
                message={`${warnings.withoutCost} item${
                  warnings.withoutCost === 1 ? "" : "s"
                } do not have a unit cost, so the estimate is incomplete.`}
              />
            ) : null}
          </section>
        )}

        <section className="mt-6 rounded-[2rem] border border-white/14 bg-white/[0.045] p-4 shadow-xl backdrop-blur-md sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search item, SKU, category, supplier or location..."
                className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm font-semibold text-white outline-none placeholder:text-white/30 focus:border-amber-300/50"
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
                      | "urgent"
                      | "quantity"
                      | "needed"
                      | "cost"
                      | "name"
                      | "updated",
                  )
                }
                className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-black text-white outline-none"
              >
                <option value="urgent">Most urgent</option>
                <option value="quantity">Lowest quantity</option>
                <option value="needed">Units needed</option>
                <option value="cost">Estimated cost</option>
                <option value="name">Item name</option>
                <option value="updated">Recently updated</option>
              </select>

              <button
                type="button"
                onClick={() =>
                  setSortDirection((current) =>
                    current === "asc" ? "desc" : "asc",
                  )
                }
                className="inline-flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
                aria-label="Change sort direction"
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
            <div className="mt-4 grid gap-3 border-t border-white/10 pt-4 sm:grid-cols-2 xl:grid-cols-5">
              <FilterSelect
                label="Priority"
                value={priorityFilter}
                onChange={(value) =>
                  setPriorityFilter(value as "all" | Priority)
                }
                options={[
                  ["all", "All priorities"],
                  ["critical", "Critical"],
                  ["high", "High priority"],
                  ["low", "Low stock"],
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
                label="Supplier"
                value={supplierFilter}
                onChange={setSupplierFilter}
                options={[
                  ["all", "All suppliers"],
                  ["__none__", "No supplier assigned"],
                  ...suppliers.map((value) => [value, value]),
                ]}
              />

              <FilterSelect
                label="Location"
                value={locationFilter}
                onChange={setLocationFilter}
                options={[
                  ["all", "All locations"],
                  ...locationNames.map((value) => [value, value]),
                ]}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={clearFilters}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-black"
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
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void exportXlsx(true)}
                className="rounded-xl bg-white px-4 py-2 text-xs font-black text-purple-700"
              >
                Export selected to Excel
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="rounded-xl border border-white/15 px-4 py-2 text-xs font-black"
              >
                Clear selection
              </button>
            </div>
          </div>
        ) : null}

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/14 bg-white/[0.045] shadow-xl backdrop-blur-md">
          {loading ? (
            <div className="flex min-h-80 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-9 w-9 animate-spin text-amber-200" />
                <p className="mt-4 font-black">Loading low-stock items...</p>
              </div>
            </div>
          ) : lowStockItems.length === 0 ? (
            <EmptyState />
          ) : filteredItems.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center p-8 text-center">
              <div>
                <Search className="mx-auto h-10 w-10 text-white/35" />
                <h2 className="mt-4 text-xl font-black">
                  No matching low-stock items
                </h2>
                <p className="mt-2 text-sm text-white/50">
                  Change the search or clear the active filters.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700"
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1450px] w-full border-collapse text-left">
                <thead className="border-b border-white/10 bg-black/20">
                  <tr className="text-xs font-black uppercase tracking-[0.12em] text-white/45">
                    <th className="px-5 py-4">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={toggleVisibleSelection}
                        aria-label="Select all visible items"
                      />
                    </th>
                    <th className="px-5 py-4">Item</th>
                    <th className="px-5 py-4">Category</th>
                    <th className="px-5 py-4">Location</th>
                    <th className="px-5 py-4">Current</th>
                    <th className="px-5 py-4">Reorder</th>
                    <th className="px-5 py-4">Target</th>
                    <th className="px-5 py-4">Needed</th>
                    <th className="px-5 py-4">Unit cost</th>
                    <th className="px-5 py-4">Estimated cost</th>
                    <th className="px-5 py-4">Supplier</th>
                    <th className="px-5 py-4">Priority</th>
                    <th className="px-5 py-4">Updated</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/8">
                  {filteredItems.map((item) => (
                    <LowStockRow
                      key={item.id}
                      item={item}
                      selected={selectedIds.includes(item.id)}
                      onToggle={() =>
                        setSelectedIds((current) =>
                          current.includes(item.id)
                            ? current.filter((id) => id !== item.id)
                            : [...current, item.id],
                        )
                      }
                      onView={() => openDetails(item)}
                      onAdd={() => openAdjust(item)}
                      onMove={() => openMove(item)}
                      onEdit={() => openEdit(item)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="mt-4 text-xs text-white/40">
          Showing {filteredItems.length} of {lowStockItems.length} low-stock
          items.
        </p>
      </div>

      {showAddItemModal ? (
        <AddItemModal
          form={addItemForm}
          locations={locations}
          saving={saving}
          onChange={setAddItemForm}
          onClose={() => {
            setShowAddItemModal(false);
            setAddItemForm(EMPTY_ADD_ITEM_FORM);
          }}
          onSubmit={saveNewItem}
        />
      ) : null}

      {showEditModal ? (
        <AddItemModal
          form={editItemForm}
          locations={locations}
          saving={saving}
          onChange={setEditItemForm}
          onClose={() => {
            if (saving) return;
            setShowEditModal(false);
            setEditItemId(null);
            setEditItemForm(EMPTY_ADD_ITEM_FORM);
          }}
          onSubmit={saveEditedItem}
        />
      ) : null}

      {showDetailsModal && detailsItem ? (
        <LowStockDetailsModal
          item={detailsItem}
          onClose={() => {
            setShowDetailsModal(false);
            setDetailsItem(null);
          }}
          onAdd={() => {
            setShowDetailsModal(false);
            openAdjust(detailsItem);
          }}
          onMove={() => {
            setShowDetailsModal(false);
            openMove(detailsItem);
          }}
          onEdit={() => {
            setShowDetailsModal(false);
            openEdit(detailsItem);
          }}
        />
      ) : null}

      {showAdjustModal && adjustForm ? (
        <AdjustStockModal
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

      {showMoveModal ? (
        <MoveStockModal
          form={moveForm}
          items={items
            .filter((item) => item.isActive && item.quantity > 0)
            .map(
              (item): StockItemForMove => ({
                id: item.id,
                name: item.name,
                sku: item.sku,
                location: item.location,
                quantity: item.quantity,
                isActive: item.isActive,
              }),
            )}
          locations={locations.map(
            (location): StockLocationForMove => ({
              id: location.id,
              name: location.name,
              code: location.code,
              isActive: location.isActive,
            }),
          )}
          saving={saving}
          onChange={setMoveForm}
          onClose={() => {
            setShowMoveModal(false);
            setMoveForm(EMPTY_MOVE_STOCK_FORM);
          }}
          onSubmit={saveMove}
        />
      ) : null}
    </main>
  );
}

function LowStockRow({
  item,
  selected,
  onToggle,
  onView,
  onAdd,
  onMove,
  onEdit,
}: {
  item: LowStockItem;
  selected: boolean;
  onToggle: () => void;
  onView: () => void;
  onAdd: () => void;
  onMove: () => void;
  onEdit: () => void;
}) {
  return (
    <tr className="transition hover:bg-white/[0.035]">
      <td className="px-5 py-4 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${item.name}`}
        />
      </td>

      <td className="px-5 py-4 align-top">
        <div className="min-w-56">
          <p className="font-black">{item.name}</p>
          <p className="mt-1 text-xs text-white/40">SKU: {item.sku}</p>
        </div>
      </td>

      <td className="px-5 py-4 align-top text-sm text-white/60">
        {item.category || "Uncategorised"}
      </td>

      <td className="px-5 py-4 align-top">
        <span className="inline-flex items-center gap-1.5 text-sm text-white/60">
          <MapPin className="h-3.5 w-3.5 text-white/35" />
          {item.location || "Not set"}
        </span>
      </td>

      <td className="px-5 py-4 align-top">
        <p className="text-lg font-black">{item.quantity}</p>
      </td>
      <td className="px-5 py-4 align-top text-sm font-bold text-white/65">
        {item.reorderLevel}
      </td>
      <td className="px-5 py-4 align-top text-sm font-bold text-white/65">
        {item.desiredLevel}
      </td>
      <td className="px-5 py-4 align-top">
        <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-100">
          {item.unitsNeeded}
        </span>
      </td>
      <td className="px-5 py-4 align-top text-sm font-bold text-white/65">
        {formatCurrency(item.unitCost)}
      </td>
      <td className="px-5 py-4 align-top font-black">
        {formatCurrency(item.estimatedOrderCost)}
      </td>
      <td className="px-5 py-4 align-top text-sm text-white/60">
        {item.supplier || "Not assigned"}
      </td>
      <td className="px-5 py-4 align-top">
        <PriorityBadge priority={item.priority} />
      </td>
      <td className="px-5 py-4 align-top">
        <p className="text-xs text-white/50">{formatDate(item.updatedAt)}</p>
        {item.updatedByName ? (
          <p className="mt-1 text-xs text-white/35">
            by {item.updatedByName}
          </p>
        ) : null}
      </td>
      <td className="px-5 py-4 align-top">
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.1]"
            aria-label={`View ${item.name}`}
            title="View item"
          >
            <Eye className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onAdd}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-300/15 bg-emerald-500/10 text-emerald-100"
            aria-label={`Add stock to ${item.name}`}
            title="Add stock"
          >
            <PackagePlus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onMove}
            disabled={item.quantity < 1}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-blue-300/15 bg-blue-500/10 text-blue-100 disabled:opacity-35"
            aria-label={`Move ${item.name}`}
            title="Move stock"
          >
            <ArrowRightLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.1]"
            aria-label={`Edit ${item.name}`}
            title="Edit item"
          >
            <Edit3 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}


function LowStockDetailsModal({
  item,
  onClose,
  onAdd,
  onMove,
  onEdit,
}: {
  item: LowStockItem;
  onClose: () => void;
  onAdd: () => void;
  onMove: () => void;
  onEdit: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="low-stock-details-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <h2 id="low-stock-details-title" className="text-2xl font-black">
              {item.name}
            </h2>
            <p className="mt-1 text-sm text-white/50">SKU: {item.sku}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
            aria-label="Close item details"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="space-y-5 p-6">
          <div className="grid gap-3 sm:grid-cols-4">
            <Metric label="Current" value={item.quantity} />
            <Metric label="Reorder" value={item.reorderLevel} />
            <Metric label="Target" value={item.desiredLevel} />
            <Metric label="Needed" value={item.unitsNeeded} />
          </div>

          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:grid-cols-2">
            <Detail label="Priority" value={
              item.priority === "critical"
                ? "Critical"
                : item.priority === "high"
                  ? "High priority"
                  : "Low stock"
            } />
            <Detail label="Category" value={item.category || "Uncategorised"} />
            <Detail label="Location" value={item.location || "Not set"} />
            <Detail label="Supplier" value={item.supplier || "Not assigned"} />
            <Detail label="Unit cost" value={formatCurrency(item.unitCost)} />
            <Detail
              label="Estimated restock"
              value={formatCurrency(item.estimatedOrderCost)}
            />
            <Detail label="Barcode" value={item.barcode || "Not set"} />
            <Detail label="Updated" value={formatDate(item.updatedAt)} />
          </div>

          {item.description ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
                Description
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                {item.description}
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 border-t border-white/10 pt-5 sm:grid-cols-3">
            <button
              type="button"
              onClick={onAdd}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950"
            >
              <PackagePlus className="h-4 w-4" />
              Add stock
            </button>

            <button
              type="button"
              onClick={onMove}
              disabled={item.quantity < 1}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-40"
            >
              <ArrowRightLeft className="h-4 w-4" />
              Move stock
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black"
            >
              <Edit3 className="h-4 w-4" />
              Edit item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div>
      <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white/75">{value}</p>
    </div>
  );
}

function AdjustStockModal({
  form,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  form: AdjustForm;
  saving: boolean;
  onChange: (form: AdjustForm) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-md">
      <div className="w-full max-w-xl overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 p-6">
          <div>
            <h2 className="text-2xl font-black">Receive stock</h2>
            <p className="mt-1 text-sm text-white/50">{form.item.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form onSubmit={onSubmit} className="space-y-5 p-6">
          <div className="grid gap-3 rounded-2xl border border-emerald-300/15 bg-emerald-500/10 p-4 sm:grid-cols-3">
            <Metric label="Current" value={form.item.quantity} />
            <Metric label="Target" value={form.item.desiredLevel} />
            <Metric label="Suggested" value={form.item.unitsNeeded} />
          </div>

          <Field
            label="Quantity received"
            type="number"
            min={1}
            value={form.quantity}
            onChange={(value) => onChange({ ...form, quantity: value })}
            required
          />

          <Field
            label="Reason"
            value={form.reason}
            onChange={(value) => onChange({ ...form, reason: value })}
            required
          />

          <label className="block">
            <span className="block text-sm font-black">Notes</span>
            <textarea
              value={form.notes}
              onChange={(event) =>
                onChange({ ...form, notes: event.target.value })
              }
              rows={4}
              maxLength={1000}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none"
              placeholder="Optional delivery, receipt or handling notes..."
            />
          </label>

          <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <PackagePlus className="h-4 w-4" />
              )}
              Add stock
            </button>
          </div>
        </form>
      </div>
    </div>
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
  icon: typeof PackageMinus;
  tone: "amber" | "red" | "blue" | "emerald" | "purple";
}) {
  const className =
    tone === "amber"
      ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
      : tone === "red"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : tone === "blue"
          ? "border-blue-300/20 bg-blue-500/10 text-blue-100"
          : tone === "emerald"
            ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
            : "border-fuchsia-300/20 bg-fuchsia-500/10 text-fuchsia-100";

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

function WarningCard({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-amber-50">
      <div className="flex gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <p className="text-sm font-bold leading-6">{message}</p>
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: Priority }) {
  const className =
    priority === "critical"
      ? "border-red-300/20 bg-red-500/10 text-red-100"
      : priority === "high"
        ? "border-orange-300/20 bg-orange-500/10 text-orange-100"
        : "border-amber-300/20 bg-amber-500/10 text-amber-100";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-black ${className}`}
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      {priority === "critical"
        ? "Critical"
        : priority === "high"
          ? "High priority"
          : "Low stock"}
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
    <label>
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

function EmptyState() {
  return (
    <div className="flex min-h-80 items-center justify-center p-8">
      <div className="max-w-md text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-500/10 text-emerald-100">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-xl font-black">
          All stock levels look healthy
        </h2>
        <p className="mt-2 text-sm leading-6 text-white/55">
          No active inventory items are currently at or below their reorder
          level.
        </p>
        <Link
          href="/Admin/StockManagement/Inventory"
          className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-purple-700"
        >
          <Package className="h-4 w-4" />
          View inventory
        </Link>
      </div>
    </div>
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

  return (
    <div className={`rounded-2xl border p-4 ${className}`}>
      <div className="flex gap-3">
        {notice.tone === "success" ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
        ) : (
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        )}

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
              <div className="mt-3 space-y-2 text-xs font-mono leading-5 opacity-80">
                {notice.technicalDetails.map((detail) => (
                  <p key={detail} className="break-words">
                    {detail}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <button type="button" onClick={onClose} aria-label="Close message">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3 text-center">
      <p className="text-[10px] font-black uppercase tracking-[0.12em] text-white/40">
        {label}
      </p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  type?: string;
  min?: number;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-black">{label}</span>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm outline-none"
      />
    </label>
  );
}
