"use client";

import ExcelJS from "exceljs";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileClock,
  FlaskConical,
  Landmark,
  Link2,
  LockKeyhole,
  PiggyBank,
  Loader2,
  PackageCheck,
  PackagePlus,
  Pencil,
  Plus,
  ReceiptText,
  Save,
  WalletCards,
  RefreshCcw,
  Search,
  ShoppingCart,
  Truck,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import type {
  StockOrder,
  StockOrderListResponse,
  StockOrderStatus,
} from "@/lib/stockManagement/orders/types";

type InventoryItem = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel: number;
  targetLevel?: number | null;
  unitCost?: number | null;
  location?: string | null;
  isActive: boolean;
};

type LocationOption = {
  id: string;
  name: string;
  code?: string | null;
  isActive?: boolean;
};

type MoneyBudgetOption = {
  id: string;
  year: string;
  categoryKey: string;
  categoryLabel: string;
  plannedAmountPence: number;
  actualAmountPence: number;
  remainingAmountPence: number;
  notes?: string | null;
  updatedAt?: string | null;
};

type MoneyTransactionOption = {
  id: string;
  date: string | null;
  description: string;
  amountPence: number;
  supplierName?: string | null;
  reference?: string | null;
  category?: string | null;
  transactionType?: string | null;
  paymentMethod?: string | null;
  source?: string | null;
  isReconciled?: boolean;
  bankReconciliationStatus?: string | null;
  isPersonalFunds?: boolean;
  personalFundsName?: string | null;
};

type MoneyTransactionsResponse = {
  ok?: boolean;
  transactions?: MoneyTransactionOption[];
  transactionOptions?: MoneyTransactionOption[];
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  requestId?: string | null;
  request_id?: string | null;
};

type MoneyBudgetsResponse = {
  ok?: boolean;
  budgets?: MoneyBudgetOption[];
  budgetOptions?: MoneyBudgetOption[];
  sourceTable?: string;
  table?: string;
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  requestId?: string | null;
  request_id?: string | null;
  attemptedTables?: string[];
};

type DetailedApiPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
  field?: string | null;
  requestId?: string | null;
  request_id?: string | null;
  endpoint?: string | null;
  method?: string | null;
  status?: number | null;
  [key: string]: unknown;
};

type ApiFailureContext = {
  label: string;
  method: string;
  endpoint: string;
  response: Response;
  payload: DetailedApiPayload | null;
  rawText: string;
};

type DraftLine = {
  id: string;
  itemMode: "inventory" | "manual";
  stockItemId: string;
  itemName: string;
  sku: string;
  quantityOrdered: string;
  estimatedUnitCost: string;
  destinationLocationId: string;
  notes: string;
};

type CreateForm = {
  title: string;
  supplierName: string;
  supplierReference: string;
  moneyBudgetId: string;
  expectedDeliveryDate: string;
  reason: string;
  notes: string;
  estimatedDelivery: string;
  estimatedVat: string;
  estimatedDiscount: string;
  lines: DraftLine[];
};

type Notice = {
  tone: "success" | "error" | "warning";
  title: string;
  message: string;
};

type MoneyActionMode =
  | "approve"
  | "link_transaction"
  | "place"
  | "cancel"
  | null;

type MoneyActionState = {
  mode: MoneyActionMode;
  order: StockOrder | null;
  moneyBudgetId: string;
  moneyTransactionId: string;
  approvalNotes: string;
  supplierOrderNumber: string;
  invoiceNumber: string;
  expectedDeliveryDate: string;
  cancellationReason: string;
};

const EMPTY_MONEY_ACTION: MoneyActionState = {
  mode: null,
  order: null,
  moneyBudgetId: "",
  moneyTransactionId: "",
  approvalNotes: "",
  supplierOrderNumber: "",
  invoiceNumber: "",
  expectedDeliveryDate: "",
  cancellationReason: "",
};

const ORDERS_ENDPOINT =
  "/api/admin/stockmanagement/orders";
const INVENTORY_ENDPOINT =
  "/api/admin/stockmanagement/inventory";
const LOCATIONS_ENDPOINT =
  "/api/admin/stockmanagement/locations";
const MONEY_BUDGETS_ENDPOINT =
  "/api/admin/money/budget?mode=options";
const MONEY_TRANSACTIONS_ENDPOINT =
  "/api/admin/money/transactions?mode=options";

/*
 * Money Management remains the owner of budgets, transactions,
 * bank reconciliation, refunds and personal-funds records.
 *
 * Stock Orders stores the linked Money Management record IDs so
 * each purchase can be followed from approval to payment.
 */
const MONEY_MANAGER_URL = "/Admin/MoneyManagement";
const MONEY_BUDGETS_URL = "/Admin/MoneyManagement/TrackingMoney/BudgetPlanning";
const MONEY_TRANSACTIONS_URL =
  "/Admin/MoneyManagement/TrackingMoney";
const MONEY_REFUNDS_URL =
  "/Admin/MoneyManagement/TrackingMoney/Refunds";
const MONEY_PERSONAL_FUNDS_URL =
  "/Admin/MoneyManagement/TrackingMoney/PersonalFunds";

const EMPTY_FORM: CreateForm = {
  title: "",
  supplierName: "",
  supplierReference: "",
  moneyBudgetId: "",
  expectedDeliveryDate: "",
  reason: "",
  notes: "",
  estimatedDelivery: "0",
  estimatedVat: "0",
  estimatedDiscount: "0",
  lines: [],
};

function currency(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function currencyFromPence(value: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0) / 100);
}

function date(value?: string | null) {
  if (!value) return "Not set";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
  }).format(parsed);
}

function statusLabel(status: StockOrderStatus) {
  return status
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function readJson<T>(response: Response) {
  const text = await response.text();

  if (!text) {
    return { data: null as T | null, text: "" };
  }

  try {
    return {
      data: JSON.parse(text) as T,
      text,
    };
  } catch {
    return {
      data: null as T | null,
      text,
    };
  }
}


function truncate(value: string, max = 1200) {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…`;
}

function likelyFixes({
  response,
  payload,
  endpoint,
}: Pick<
  ApiFailureContext,
  "response" | "payload" | "endpoint"
>) {
  const fixes: string[] = [];
  const status = response.status;
  const code = String(payload?.code || "").toUpperCase();
  const combined = [
    payload?.error,
    payload?.message,
    payload?.details,
    payload?.hint,
    code,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (status === 400) {
    fixes.push(
      "Check that every required field has been completed and that numbers, dates and UUID values use the expected format.",
    );
  }

  if (status === 401) {
    fixes.push(
      "Sign in again and confirm the admin session cookie is being sent with credentials: include.",
    );
  }

  if (status === 403) {
    fixes.push(
      "Check the signed-in administrator's Stock Management and Money Management permissions.",
    );
  }

  if (status === 404) {
    fixes.push(
      `Make sure the route file for ${endpoint} exists and the folder spelling and capitalisation match the request URL.`,
    );
  }

  if (status === 405) {
    fixes.push(
      "The route exists, but the requested HTTP method is missing. Add the matching GET, POST, PATCH or DELETE export.",
    );
  }

  if (status === 409) {
    fixes.push(
      "The request conflicts with the current record state. Refresh the page and check the order status, linked budget, stock location or quantity before trying again.",
    );
  }

  if (status === 422) {
    fixes.push(
      "The server understood the request but rejected one or more values. Check the field and details shown below.",
    );
  }

  if (status >= 500) {
    fixes.push(
      "Check the terminal, Vercel logs and Supabase logs for the matching request time and request ID.",
    );
  }

  if (code === "PGRST205" || combined.includes("could not find the table")) {
    fixes.push(
      "The Supabase table is missing or not visible in the schema cache. Create the table, confirm its name, then reload the PostgREST schema cache.",
    );
  }

  if (code === "PGRST204" || combined.includes("schema cache")) {
    fixes.push(
      "A selected or written column is missing from Supabase. Compare the API fields with the live table columns and reload the schema cache.",
    );
  }

  if (code === "22P02" || combined.includes("invalid input syntax")) {
    fixes.push(
      "A value has the wrong database type, commonly text being sent to a UUID, integer or date column.",
    );
  }

  if (code === "23503" || combined.includes("foreign key")) {
    fixes.push(
      "A linked record does not exist. Check the selected budget, transaction, stock item or location ID.",
    );
  }

  if (code === "23505" || combined.includes("duplicate key")) {
    fixes.push(
      "A unique value already exists. Check the order number, SKU or year/category budget combination.",
    );
  }

  if (
    endpoint.includes("money-budgets") ||
    endpoint.includes("budget")
  ) {
    fixes.push(
      "Confirm the Orders page is using the real Money Management budget API with ?mode=options and that the response includes a budgets array.",
    );
  }

  return [...new Set(fixes)];
}

function buildDetailedApiError({
  label,
  method,
  endpoint,
  response,
  payload,
  rawText,
}: ApiFailureContext) {
  const mainError =
    payload?.error ||
    payload?.message ||
    `${label} failed.`;

  const requestId =
    payload?.requestId ||
    payload?.request_id ||
    response.headers.get("x-request-id") ||
    response.headers.get("x-vercel-id") ||
    null;

  const lines = [
    `${label} failed`,
    "",
    `Main error: ${mainError}`,
    `HTTP: ${response.status} ${response.statusText || "Request failed"}`,
    `Method: ${method}`,
    `Endpoint: ${endpoint}`,
  ];

  if (payload?.code) {
    lines.push(`Error code: ${payload.code}`);
  }

  if (payload?.field) {
    lines.push(`Field: ${payload.field}`);
  }

  if (payload?.details) {
    lines.push(`Details: ${payload.details}`);
  }

  if (payload?.hint) {
    lines.push(`Hint: ${payload.hint}`);
  }

  if (requestId) {
    lines.push(`Request ID: ${requestId}`);
  }

  if (rawText && !payload) {
    lines.push(`Raw response: ${truncate(rawText)}`);
  }

  const fixes = likelyFixes({
    response,
    payload,
    endpoint,
  });

  if (fixes.length > 0) {
    lines.push("", "What to check:");
    fixes.forEach((fix) => lines.push(`• ${fix}`));
  }

  return new Error(lines.join("\n"));
}

async function expectApiSuccess<T extends DetailedApiPayload>({
  response,
  label,
  method,
  endpoint,
}: {
  response: Response;
  label: string;
  method: string;
  endpoint: string;
}) {
  const result = await readJson<T>(response);
  const payload =
    result.data as T | null;

  if (!response.ok || !payload?.ok) {
    throw buildDetailedApiError({
      label,
      method,
      endpoint,
      response,
      payload,
      rawText: result.text,
    });
  }

  return payload;
}

function makeDraftLine(item?: InventoryItem): DraftLine {
  const target = Number(item?.targetLevel || 0);
  const suggested = item
    ? Math.max(
        target > item.reorderLevel
          ? target - item.quantity
          : item.reorderLevel - item.quantity,
        1,
      )
    : 1;

  return {
    id: crypto.randomUUID(),
    itemMode: item ? "inventory" : "inventory",
    stockItemId: item?.id || "",
    itemName: item?.name || "",
    sku: item?.sku || "",
    quantityOrdered: String(suggested),
    estimatedUnitCost:
      item?.unitCost === null ||
      item?.unitCost === undefined
        ? ""
        : String(item.unitCost),
    destinationLocationId: item?.location || "",
    notes: "",
  };
}

export default function StockOrdersClient() {
  const [orders, setOrders] = useState<StockOrder[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<LocationOption[]>([]);
  const [moneyBudgets, setMoneyBudgets] =
    useState<MoneyBudgetOption[]>([]);
  const [moneyBudgetsLoading, setMoneyBudgetsLoading] =
    useState(true);
  const [moneyBudgetsError, setMoneyBudgetsError] =
    useState<string | null>(null);

  const [moneyTransactions, setMoneyTransactions] =
    useState<MoneyTransactionOption[]>([]);
  const [
    moneyTransactionsLoading,
    setMoneyTransactionsLoading,
  ] = useState(true);
  const [
    moneyTransactionsError,
    setMoneyTransactionsError,
  ] = useState<string | null>(null);
  const [summary, setSummary] =
    useState<StockOrderListResponse["summary"]>({
      draft: 0,
      awaitingApproval: 0,
      approved: 0,
      ordered: 0,
      partiallyReceived: 0,
      overdue: 0,
      outstandingEstimatedCost: 0,
    });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creatingTestOrder, setCreatingTestOrder] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");

  const [showCreate, setShowCreate] = useState(false);
  const [editingOrder, setEditingOrder] =
    useState<StockOrder | null>(null);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);
  const [moneyAction, setMoneyAction] =
    useState<MoneyActionState>(EMPTY_MONEY_ACTION);

  const loadData = useCallback(async () => {
    setLoading(true);

    try {
      const orderQuery = new URLSearchParams();

      if (query.trim()) {
        orderQuery.set("search", query.trim());
      }

      if (status !== "all") {
        orderQuery.set("status", status);
      }

      setMoneyBudgetsLoading(true);
      setMoneyBudgetsError(null);
      setMoneyTransactionsLoading(true);
      setMoneyTransactionsError(null);

      const [
        ordersResponse,
        inventoryResponse,
        locationsResponse,
        moneyBudgetsResponse,
        moneyTransactionsResponse,
      ] = await Promise.all([
          fetch(
            `${ORDERS_ENDPOINT}?${orderQuery.toString()}`,
            {
              method: "GET",
              cache: "no-store",
              credentials: "include",
            },
          ),
          fetch(INVENTORY_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }),
          fetch(LOCATIONS_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
          }),
          fetch(MONEY_BUDGETS_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }),
          fetch(MONEY_TRANSACTIONS_ENDPOINT, {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }),
        ]);

      const orderPayload =
        await expectApiSuccess<
          StockOrderListResponse & DetailedApiPayload
        >({
          response: ordersResponse,
          label: "Stock orders could not be loaded",
          method: "GET",
          endpoint: `${ORDERS_ENDPOINT}?${orderQuery.toString()}`,
        });

      setOrders(orderPayload.orders || []);
      setSummary(orderPayload.summary);

      const inventoryResult =
        await readJson<
          DetailedApiPayload & {
            items?: InventoryItem[];
          }
        >(inventoryResponse);

      if (!inventoryResponse.ok || !inventoryResult.data?.ok) {
        throw buildDetailedApiError({
          label: "Inventory could not be loaded",
          method: "GET",
          endpoint: INVENTORY_ENDPOINT,
          response: inventoryResponse,
          payload: inventoryResult.data,
          rawText: inventoryResult.text,
        });
      }

      setInventory(
        Array.isArray(inventoryResult.data.items)
          ? inventoryResult.data.items
          : [],
      );

      const locationResult =
        await readJson<
          DetailedApiPayload & {
            locations?: LocationOption[];
          }
        >(locationsResponse);

      if (!locationsResponse.ok || !locationResult.data?.ok) {
        throw buildDetailedApiError({
          label: "Stock locations could not be loaded",
          method: "GET",
          endpoint: LOCATIONS_ENDPOINT,
          response: locationsResponse,
          payload: locationResult.data,
          rawText: locationResult.text,
        });
      }

      setLocations(
        Array.isArray(locationResult.data.locations)
          ? locationResult.data.locations.filter(
              (location) => location.isActive !== false,
            )
          : [],
      );

      const moneyBudgetResult =
        await readJson<MoneyBudgetsResponse>(
          moneyBudgetsResponse,
        );

      if (
        moneyBudgetsResponse.ok &&
        moneyBudgetResult.data?.ok
      ) {
        const budgets =
          moneyBudgetResult.data.budgets ||
          moneyBudgetResult.data.budgetOptions ||
          [];

        setMoneyBudgets(
          Array.isArray(budgets) ? budgets : [],
        );
        setMoneyBudgetsError(null);
      } else {
        const detailedError =
          buildDetailedApiError({
            label:
              "Money Management budgets could not be loaded",
            method: "GET",
            endpoint: MONEY_BUDGETS_ENDPOINT,
            response: moneyBudgetsResponse,
            payload:
              moneyBudgetResult.data as DetailedApiPayload | null,
            rawText: moneyBudgetResult.text,
          });

        setMoneyBudgets([]);
        setMoneyBudgetsError(detailedError.message);
      }

      const moneyTransactionResult =
        await readJson<MoneyTransactionsResponse>(
          moneyTransactionsResponse,
        );

      if (
        moneyTransactionsResponse.ok &&
        moneyTransactionResult.data?.ok
      ) {
        const transactions =
          moneyTransactionResult.data.transactions ||
          moneyTransactionResult.data.transactionOptions ||
          [];

        setMoneyTransactions(
          Array.isArray(transactions)
            ? transactions
            : [],
        );
        setMoneyTransactionsError(null);
      } else {
        const detailedError =
          buildDetailedApiError({
            label:
              "Money Management transactions could not be loaded",
            method: "GET",
            endpoint: MONEY_TRANSACTIONS_ENDPOINT,
            response: moneyTransactionsResponse,
            payload:
              moneyTransactionResult.data as DetailedApiPayload | null,
            rawText: moneyTransactionResult.text,
          });

        setMoneyTransactions([]);
        setMoneyTransactionsError(
          detailedError.message,
        );
      }
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Orders could not be loaded",
        message:
          error instanceof Error
            ? error.message
            : [
                "Stock Orders loading failed",
                "",
                "Main error: The browser could not complete the request.",
                "Check your network connection and confirm the API routes are running.",
              ].join("\n"),
      });
    } finally {
      setLoading(false);
      setMoneyBudgetsLoading(false);
      setMoneyTransactionsLoading(false);
    }
  }, [query, status]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [loadData]);

  const lowStockItems = useMemo(
    () =>
      inventory.filter(
        (item) =>
          item.isActive &&
          item.quantity <= item.reorderLevel,
      ),
    [inventory],
  );

  const moneyConnection = useMemo(() => {
    const budgetLinked = orders.filter(
      (order) => Boolean(order.moneyBudgetId),
    ).length;

    const transactionLinked = orders.filter(
      (order) => Boolean(order.moneyTransactionId),
    ).length;

    const awaitingMoneyLink = orders.filter(
      (order) =>
        !["draft", "cancelled"].includes(order.status) &&
        (!order.moneyBudgetId || !order.moneyTransactionId),
    ).length;

    return {
      budgetLinked,
      transactionLinked,
      awaitingMoneyLink,
      allOrders: orders.length,
    };
  }, [orders]);

  const formTotals = useMemo(() => {
    const subtotal = form.lines.reduce(
      (total, line) =>
        total +
        Number(line.quantityOrdered || 0) *
          Number(line.estimatedUnitCost || 0),
      0,
    );

    const total =
      subtotal +
      Number(form.estimatedDelivery || 0) +
      Number(form.estimatedVat || 0) -
      Number(form.estimatedDiscount || 0);

    return {
      subtotal,
      total: Math.max(total, 0),
    };
  }, [form]);

  async function createTestOrder() {
    if (creatingTestOrder || saving) return;

    const availableItems = inventory.filter(
      (item) => item.isActive,
    );

    const preferredLocation =
      locations.find(
        (location) => location.isActive !== false,
      ) || null;

    if (availableItems.length === 0) {
      setNotice({
        tone: "warning",
        title: "No inventory available",
        message:
          "Create at least one active inventory item before creating a test order.",
      });
      return;
    }

    if (!preferredLocation) {
      setNotice({
        tone: "warning",
        title: "No active location available",
        message:
          "Create at least one active stock location before creating a test order.",
      });
      return;
    }

    setCreatingTestOrder(true);
    setNotice(null);

    try {
      const timestamp = new Date()
        .toISOString()
        .replaceAll("-", "")
        .replaceAll(":", "")
        .replace("T", "-")
        .slice(0, 15);

      const selectedItems = availableItems.slice(0, 2);

      const testLines = selectedItems.map(
        (item, index) => ({
          stockItemId: item.id,
          itemName: item.name,
          sku: item.sku,
          quantityOrdered: Math.max(
            1,
            index === 0 ? 3 : 2,
          ),
          estimatedUnitCost:
            item.unitCost === null ||
            item.unitCost === undefined
              ? index === 0
                ? 4.5
                : 7.25
              : Number(item.unitCost),
          destinationLocationId:
            locations.some(
              (location) =>
                location.id === item.location &&
                location.isActive !== false,
            )
              ? item.location
              : preferredLocation.id,
          notes:
            "TEST ORDER LINE — created only to test the Stock Orders workflow.",
        }),
      );

      const response = await fetch(
        ORDERS_ENDPOINT,
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            title: `TEST ORDER — Stock workflow ${timestamp}`,
            supplierName:
              "TEST SUPPLIER — Do not purchase",
            supplierReference:
              `TEST-${timestamp}`,
            moneyBudgetId: null,
            expectedDeliveryDate:
              new Date(
                Date.now() +
                  7 * 24 * 60 * 60 * 1000,
              )
                .toISOString()
                .slice(0, 10),
            reason:
              "TEST ONLY — created to test draft, approval, Money Management linking, supplier ordering and delivery receiving.",
            notes:
              "This is a clearly marked test order. Do not place this order with a real supplier and do not link it to a real payment unless you are testing in a development environment.",
            estimatedDelivery: 5,
            estimatedVat: 0,
            estimatedDiscount: 0,
            lines: testLines,
          }),
        },
      );

      const result =
        await expectApiSuccess<
          DetailedApiPayload & {
            message?: string;
            order?: {
              orderNumber?: string;
            };
          }
        >({
          response,
          label: "Test order could not be created",
          method: "POST",
          endpoint: ORDERS_ENDPOINT,
        });

      setNotice({
        tone: "success",
        title: "Test order created",
        message: `${
          result.order?.orderNumber ||
          "The test order"
        } was created as a draft. It is clearly marked TEST and can now be used to test submit, approval, Money Management linking, ordering and cancellation.`,
      });

      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Test order could not be created",
        message:
          error instanceof Error
            ? error.message
            : "The browser could not create the test order.",
      });
    } finally {
      setCreatingTestOrder(false);
    }
  }

  function openCreateFromLowStock() {
    setEditingOrder(null);
    setForm({
      ...EMPTY_FORM,
      title: "Low-stock restock order",
      reason:
        "Restocking Burton Pride supplies which are at or below their reorder level.",
      lines: lowStockItems.map((item) =>
        makeDraftLine(item),
      ),
    });
    setShowCreate(true);
  }

  function addLine(item?: InventoryItem) {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, makeDraftLine(item)],
    }));
  }

  function updateLine(
    lineId: string,
    patch: Partial<DraftLine>,
  ) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line) =>
        line.id === lineId
          ? { ...line, ...patch }
          : line,
      ),
    }));
  }

  function chooseItem(
    lineId: string,
    itemId: string,
  ) {
    const item = inventory.find(
      (candidate) => candidate.id === itemId,
    );

    if (!item) {
      updateLine(lineId, {
        itemMode: "inventory",
        stockItemId: "",
        itemName: "",
        sku: "",
      });
      return;
    }

    const next = makeDraftLine(item);

    updateLine(lineId, {
      itemMode: "inventory",
      stockItemId: item.id,
      itemName: item.name,
      sku: item.sku,
      quantityOrdered: next.quantityOrdered,
      estimatedUnitCost: next.estimatedUnitCost,
      destinationLocationId:
        next.destinationLocationId,
    });
  }

  function setLineMode(
    lineId: string,
    mode: "inventory" | "manual",
  ) {
    if (mode === "manual") {
      updateLine(lineId, {
        itemMode: "manual",
        stockItemId: "",
        itemName: "",
        sku: "",
        estimatedUnitCost: "",
      });
      return;
    }

    updateLine(lineId, {
      itemMode: "inventory",
      stockItemId: "",
      itemName: "",
      sku: "",
      estimatedUnitCost: "",
    });
  }

  function openEditOrder(order: StockOrder) {
    setEditingOrder(order);
    setForm({
      title: order.title || "",
      supplierName: order.supplierName || "",
      supplierReference:
        order.supplierReference || "",
      moneyBudgetId:
        order.moneyBudgetId || "",
      expectedDeliveryDate:
        order.expectedDeliveryDate || "",
      reason: order.reason || "",
      notes: order.notes || "",
      estimatedDelivery: String(
        order.estimatedDelivery || 0,
      ),
      estimatedVat: String(
        order.estimatedVat || 0,
      ),
      estimatedDiscount: String(
        order.estimatedDiscount || 0,
      ),
      lines: order.lines.map((line) => ({
        id: line.id || crypto.randomUUID(),
        itemMode: line.stockItemId
          ? "inventory"
          : "manual",
        stockItemId:
          line.stockItemId || "",
        itemName:
          line.itemName || "",
        sku:
          line.sku || "",
        quantityOrdered: String(
          line.quantityOrdered || 1,
        ),
        estimatedUnitCost:
          line.estimatedUnitCost === null ||
          line.estimatedUnitCost === undefined
            ? ""
            : String(line.estimatedUnitCost),
        destinationLocationId:
          line.destinationLocationId || "",
        notes:
          line.notes || "",
      })),
    });
    setShowCreate(true);
  }

  function closeOrderEditor() {
    if (saving) return;

    setShowCreate(false);
    setEditingOrder(null);
    setForm(EMPTY_FORM);
  }

  function normalisedOrderPayload() {
    return {
      ...form,
      lines: form.lines.map((line) => ({
        id:
          line.id || null,
        stockItemId:
          line.itemMode === "inventory"
            ? line.stockItemId || null
            : null,
        itemName:
          line.itemName.trim(),
        sku:
          line.sku.trim() || null,
        quantityOrdered:
          Number(line.quantityOrdered),
        estimatedUnitCost:
          line.estimatedUnitCost
            ? Number(line.estimatedUnitCost)
            : null,
        destinationLocationId:
          line.destinationLocationId || null,
        notes:
          line.notes.trim() || null,
      })),
    };
  }

  async function saveOrder() {
    if (editingOrder) {
      await updateOrder(editingOrder);
      return;
    }

    await createOrder();
  }

  async function updateOrder(order: StockOrder) {
    if (saving) return;

    if (
      !form.title.trim() ||
      !form.supplierName.trim() ||
      form.lines.length === 0
    ) {
      setNotice({
        tone: "warning",
        title: "Complete the order",
        message:
          "Add an order title, supplier and at least one order item.",
      });
      return;
    }

    const invalidLine = form.lines.find(
      (line) =>
        !line.itemName.trim() ||
        (line.itemMode === "inventory" &&
          !line.stockItemId.trim()) ||
        !Number.isInteger(
          Number(line.quantityOrdered),
        ) ||
        Number(line.quantityOrdered) < 1,
    );

    if (invalidLine) {
      setNotice({
        tone: "warning",
        title: "Check the order items",
        message:
          "Every order item needs either a selected inventory item or a manual item name, plus a whole quantity of at least 1.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    const endpoint =
      `${ORDERS_ENDPOINT}/${order.id}`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          normalisedOrderPayload(),
        ),
      });

      const result =
        await expectApiSuccess<
          DetailedApiPayload & {
            message?: string;
          }
        >({
          response,
          label: "Stock order could not be updated",
          method: "PATCH",
          endpoint,
        });

      closeOrderEditor();
      setNotice({
        tone: "success",
        title: "Order updated",
        message:
          result.message ||
          `${order.orderNumber} was updated successfully.`,
      });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Order could not be updated",
        message:
          error instanceof Error
            ? error.message
            : "The order update request failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function createOrder() {
    if (saving) return;

    if (
      !form.title.trim() ||
      !form.supplierName.trim() ||
      form.lines.length === 0
    ) {
      setNotice({
        tone: "warning",
        title: "Complete the order",
        message:
          "Add an order title, supplier and at least one order item.",
      });
      return;
    }

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(ORDERS_ENDPOINT, {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(
          normalisedOrderPayload(),
        ),
      });

      const result =
        await expectApiSuccess<
          DetailedApiPayload & {
            message?: string;
          }
        >({
          response,
          label: "Stock order could not be created",
          method: "POST",
          endpoint: ORDERS_ENDPOINT,
        });

      closeOrderEditor();
      setNotice({
        tone: "success",
        title: "Order created",
        message:
          result.message ||
          "The draft order was created.",
      });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Order could not be created",
        message:
          error instanceof Error
            ? error.message
            : "The request failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  function openMoneyAction(
    order: StockOrder,
    mode: Exclude<MoneyActionMode, null>,
  ) {
    setMoneyAction({
      mode,
      order,
      moneyBudgetId: order.moneyBudgetId || "",
      moneyTransactionId:
        order.moneyTransactionId || "",
      approvalNotes: "",
      supplierOrderNumber:
        order.supplierOrderNumber || "",
      invoiceNumber: order.invoiceNumber || "",
      expectedDeliveryDate:
        order.expectedDeliveryDate || "",
      cancellationReason: "",
    });
  }

  function closeMoneyAction() {
    if (saving) return;
    setMoneyAction(EMPTY_MONEY_ACTION);
  }

  async function runAction(
    order: StockOrder,
    action: string,
    extra: Record<string, unknown> = {},
  ) {
    if (saving) return;

    setSaving(true);
    setNotice(null);

    try {
      const response = await fetch(
        `${ORDERS_ENDPOINT}/${order.id}/action`,
        {
          method: "POST",
          cache: "no-store",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action,
            ...extra,
          }),
        },
      );

      const endpoint =
        `${ORDERS_ENDPOINT}/${order.id}/action`;

      const result =
        await expectApiSuccess<
          DetailedApiPayload & {
            message?: string;
          }
        >({
          response,
          label: `Order action "${action}" could not be completed`,
          method: "POST",
          endpoint,
        });

      setMoneyAction(EMPTY_MONEY_ACTION);
      setNotice({
        tone: "success",
        title: "Order updated",
        message:
          result.message ||
          "The order action was completed.",
      });
      await loadData();
    } catch (error) {
      setNotice({
        tone: "error",
        title: "Order action failed",
        message:
          error instanceof Error
            ? error.message
            : "The request failed.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function submitMoneyAction() {
    const order = moneyAction.order;
    const mode = moneyAction.mode;

    if (!order || !mode || saving) return;

    if (mode === "approve") {
      if (!moneyAction.moneyBudgetId.trim()) {
        setNotice({
          tone: "warning",
          title: "Choose a Money Management budget",
          message:
            "Choose a budget from the Money Management dropdown before approving the order.",
        });
        return;
      }

      await runAction(order, "approve", {
        moneyBudgetId:
          moneyAction.moneyBudgetId.trim(),
        approvalNotes:
          moneyAction.approvalNotes.trim() || null,
      });
      return;
    }

    if (mode === "link_transaction") {
      if (!moneyAction.moneyTransactionId.trim()) {
        setNotice({
          tone: "warning",
          title: "Choose a Money Management transaction",
          message:
            "Choose the matching payment from the Money Management transaction dropdown.",
        });
        return;
      }

      await runAction(order, "link_transaction", {
        moneyTransactionId:
          moneyAction.moneyTransactionId.trim(),
      });
      return;
    }

    if (mode === "place") {
      await runAction(order, "place", {
        supplierOrderNumber:
          moneyAction.supplierOrderNumber.trim() ||
          null,
        invoiceNumber:
          moneyAction.invoiceNumber.trim() || null,
        expectedDeliveryDate:
          moneyAction.expectedDeliveryDate || null,
        orderDate:
          new Date().toISOString().slice(0, 10),
      });
      return;
    }

    if (mode === "cancel") {
      if (!moneyAction.cancellationReason.trim()) {
        setNotice({
          tone: "warning",
          title: "Cancellation reason required",
          message:
            "Explain why the order is being cancelled before continuing.",
        });
        return;
      }

      await runAction(order, "cancel", {
        cancellationReason:
          moneyAction.cancellationReason.trim(),
      });
    }
  }

  async function exportXlsx() {
    if (orders.length === 0) return;

    const workbook = new ExcelJS.Workbook();
    workbook.creator =
      "Burton Pride Stock Management";
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(
      "Stock Orders",
      {
        views: [
          {
            state: "frozen",
            ySplit: 5,
          },
        ],
      },
    );

    sheet.mergeCells("A1:L2");
    const titleCell = sheet.getCell("A1");
    titleCell.value =
      "Burton Pride Stock Orders";
    titleCell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF24163A" },
    };
    titleCell.font = {
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 20,
    };
    titleCell.alignment = {
      horizontal: "center",
      vertical: "middle",
    };

    sheet.mergeCells("A3:L3");
    sheet.getCell("A3").value =
      `Generated ${new Intl.DateTimeFormat(
        "en-GB",
        {
          dateStyle: "full",
          timeStyle: "short",
        },
      ).format(new Date())}`;
    sheet.getCell("A3").alignment = {
      horizontal: "center",
    };

    const headers = [
      "Order number",
      "Title",
      "Supplier",
      "Status",
      "Item lines",
      "Total units",
      "Estimated total",
      "Actual total",
      "Budget linked",
      "Transaction linked",
      "Expected delivery",
      "Updated",
    ];

    const headerRow = sheet.getRow(5);
    headerRow.values = headers;

    headerRow.eachCell((cell) => {
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4C1D95" },
      };
      cell.font = {
        bold: true,
        color: { argb: "FFFFFFFF" },
      };
      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    });

    orders.forEach((order, index) => {
      const row = sheet.getRow(6 + index);

      row.values = [
        order.orderNumber,
        order.title,
        order.supplierName || "",
        statusLabel(order.status),
        order.lines.length,
        order.lines.reduce(
          (total, line) =>
            total + line.quantityOrdered,
          0,
        ),
        order.estimatedTotal,
        order.actualTotal,
        order.moneyBudgetId ? "Yes" : "No",
        order.moneyTransactionId ? "Yes" : "No",
        order.expectedDeliveryDate
          ? new Date(order.expectedDeliveryDate)
          : null,
        order.updatedAt
          ? new Date(order.updatedAt)
          : null,
      ];

      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb:
              index % 2 === 0
                ? "FFFFFFFF"
                : "FFF8FAFC",
          },
        };
        cell.alignment = {
          vertical: "middle",
          wrapText: true,
        };
        cell.border = {
          top: {
            style: "thin",
            color: { argb: "FFD1D5DB" },
          },
          left: {
            style: "thin",
            color: { argb: "FFD1D5DB" },
          },
          bottom: {
            style: "thin",
            color: { argb: "FFD1D5DB" },
          },
          right: {
            style: "thin",
            color: { argb: "FFD1D5DB" },
          },
        };
      });

      row.getCell(7).numFmt =
        '£#,##0.00;[Red]-£#,##0.00';
      row.getCell(8).numFmt =
        '£#,##0.00;[Red]-£#,##0.00';
      row.getCell(11).numFmt =
        "dd/mm/yyyy";
      row.getCell(12).numFmt =
        "dd/mm/yyyy hh:mm";
    });

    sheet.columns = [
      { width: 21 },
      { width: 30 },
      { width: 26 },
      { width: 20 },
      { width: 12 },
      { width: 12 },
      { width: 18 },
      { width: 18 },
      { width: 14 },
      { width: 17 },
      { width: 20 },
      { width: 20 },
    ];

    sheet.autoFilter = {
      from: {
        row: 5,
        column: 1,
      },
      to: {
        row: 5 + orders.length,
        column: headers.length,
      },
    };

    const buffer =
      await workbook.xlsx.writeBuffer();

    const blob = new Blob([buffer], {
      type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    const url =
      URL.createObjectURL(blob);
    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download =
      `burton-pride-stock-orders-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen bg-transparent px-3 py-5 text-white sm:px-5 lg:px-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/Admin/StockManagement"
          className="inline-flex items-center gap-2 text-sm font-bold text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Stock Control
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={MONEY_MANAGER_URL}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/20"
          >
            <Landmark className="h-4 w-4" />
            Open Money Management
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>

          <button
            type="button"
            onClick={() => void loadData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black"
          >
            <RefreshCcw
              className={`h-4 w-4 ${
                loading ? "animate-spin" : ""
              }`}
            />
            Refresh
          </button>

          <button
            type="button"
            onClick={() => void exportXlsx()}
            disabled={orders.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-purple-700 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </button>

          <button
            type="button"
            onClick={() => void createTestOrder()}
            disabled={
              creatingTestOrder ||
              saving ||
              loading ||
              inventory.length === 0 ||
              locations.length === 0
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 px-4 py-2.5 text-sm font-black text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            title="Create a clearly marked test order using live inventory and location data"
          >
            {creatingTestOrder ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FlaskConical className="h-4 w-4" />
            )}
            {creatingTestOrder
              ? "Creating test order..."
              : "Create test order"}
          </button>

          <button
            type="button"
            onClick={openCreateFromLowStock}
            disabled={lowStockItems.length === 0}
            className="inline-flex items-center gap-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-100 disabled:opacity-50"
          >
            <PackagePlus className="h-4 w-4" />
            Create from low stock
          </button>

          <button
            type="button"
            onClick={() => {
              setEditingOrder(null);
              setForm({
                ...EMPTY_FORM,
                lines: [makeDraftLine()],
              });
              setShowCreate(true);
            }}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-400 px-4 py-2.5 text-sm font-black text-slate-950"
          >
            <Plus className="h-4 w-4" />
            Create order
          </button>
        </div>
      </div>

      <header className="relative overflow-hidden rounded-[2rem] border border-blue-300/15 bg-[#17223a] p-6 shadow-2xl sm:p-8">
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/20 bg-blue-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-blue-100">
            <ShoppingCart className="h-4 w-4" />
            Burton Pride Stock Management
          </div>

          <h1 className="mt-4 text-3xl font-black sm:text-5xl">
            Stock Orders
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
            Create orders from low-stock warnings, approve spending,
            track supplier deliveries and update inventory when goods arrive.
            Every order can be linked to the budget, supplier and payment
            transaction held in the Burton Pride Money Management app.
          </p>

          <div className="mt-5 inline-flex flex-wrap items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-50">
            <Link2 className="h-4 w-4" />
            This page is connected to the Burton Pride Money Management app
          </div>
        </div>
      </header>

      <section className="mt-5 overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-gradient-to-r from-emerald-500/10 via-cyan-500/10 to-blue-500/10 shadow-xl">
        <div className="grid gap-0 xl:grid-cols-[1.35fr_1fr]">
          <div className="p-5 sm:p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-300/20 bg-emerald-500/15">
                <Landmark className="h-6 w-6 text-emerald-100" />
              </div>

              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-emerald-100/60">
                  Connected financial system
                </p>
                <h2 className="mt-1 text-xl font-black">
                  Stock Orders works with Money Management
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
                  Stock Management controls what is ordered, how many units
                  are expected, where deliveries are stored and when inventory
                  increases. Money Management controls the approved budget,
                  committed spending, supplier payment, bank transaction,
                  refunds and reconciliation. The shared IDs keep both records
                  connected without duplicating financial data.
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center gap-2 text-sm font-black">
                  <PackageCheck className="h-4 w-4 text-blue-200" />
                  Stock Management owns
                </div>
                <p className="mt-2 text-xs leading-5 text-white/50">
                  Order items, quantities, order status, expected delivery,
                  received units, storage locations and inventory changes.
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-black/15 p-4">
                <div className="flex items-center gap-2 text-sm font-black">
                  <PiggyBank className="h-4 w-4 text-emerald-200" />
                  Money Management owns
                </div>
                <p className="mt-2 text-xs leading-5 text-white/50">
                  Budgets, committed spending, payments, transactions,
                  personal funds, refunds and bank reconciliation.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-black/15 p-5 sm:p-6 xl:border-l xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.15em] text-white/45">
              Money Management connection
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <MoneyConnectionMetric
                label="Budget linked"
                value={`${moneyConnection.budgetLinked} of ${moneyConnection.allOrders}`}
                icon={PiggyBank}
              />
              <MoneyConnectionMetric
                label="Transaction linked"
                value={`${moneyConnection.transactionLinked} of ${moneyConnection.allOrders}`}
                icon={Link2}
              />
              <MoneyConnectionMetric
                label="Needs money link"
                value={moneyConnection.awaitingMoneyLink}
                icon={AlertTriangle}
                warning={moneyConnection.awaitingMoneyLink > 0}
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
              <Link
                href={MONEY_BUDGETS_URL}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/20"
              >
                <PiggyBank className="h-4 w-4" />
                View Money Management budgets
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              <Link
                href={MONEY_TRANSACTIONS_URL}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-100 transition hover:bg-blue-500/20"
              >
                <Link2 className="h-4 w-4" />
                View Money Management transactions
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>

              <div className="grid grid-cols-2 gap-2">
                <Link
                  href={MONEY_REFUNDS_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-2.5 text-[11px] font-black text-violet-100"
                >
                  Refunds
                  <ExternalLink className="h-3 w-3" />
                </Link>
                <Link
                  href={MONEY_PERSONAL_FUNDS_URL}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2.5 text-[11px] font-black text-amber-100"
                >
                  Personal funds
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-[2rem] border border-white/10 bg-white/[0.04] p-5 sm:p-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-blue-100/55">
              Easy order workflow
            </p>
            <h2 className="mt-1 text-xl font-black">
              Follow these steps for every purchase
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
              The page now guides the order from a draft through approval,
              supplier ordering, delivery and the final Money Management payment link.
            </p>
          </div>

          <Link
            href={MONEY_TRANSACTIONS_URL}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100"
          >
            <WalletCards className="h-4 w-4" />
            Open financial records
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <WorkflowStep
            number="1"
            title="Create draft"
            description="Choose the supplier, stock items, quantities and destination locations."
          />
          <WorkflowStep
            number="2"
            title="Submit"
            description="Send the completed draft for approval."
          />
          <WorkflowStep
            number="3"
            title="Approve budget"
            description="Link the approved Money Management budget before committing the spend."
          />
          <WorkflowStep
            number="4"
            title="Order and receive"
            description="Record the supplier reference and only increase stock when delivery arrives."
          />
          <WorkflowStep
            number="5"
            title="Link payment"
            description="Connect the final Money Management transaction to close the financial trail."
          />
        </div>

        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-4">
          <FlaskConical className="mt-0.5 h-5 w-5 shrink-0 text-fuchsia-100" />
          <div>
            <p className="font-black text-fuchsia-50">
              Safe test mode
            </p>
            <p className="mt-1 text-xs leading-5 text-fuchsia-50/65">
              The Create test order button uses real inventory and locations,
              but creates a supplier and order title clearly marked TEST.
              Do not send the test order to a real supplier or connect it to
              a real payment.
            </p>
          </div>
        </div>
      </section>

      {notice ? (
        <div
          className={`mt-5 rounded-2xl border p-4 ${
            notice.tone === "success"
              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-50"
              : notice.tone === "warning"
                ? "border-amber-300/20 bg-amber-500/10 text-amber-50"
                : "border-red-300/20 bg-red-500/10 text-red-50"
          }`}
        >
          <div className="flex gap-3">
            {notice.tone === "success" ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5" />
            ) : (
              <AlertTriangle className="mt-0.5 h-5 w-5" />
            )}

            <div className="flex-1">
              <p className="font-black">
                {notice.title}
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words font-mono text-xs leading-6 sm:text-sm">
                {notice.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Close notice"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Summary
          label="Draft"
          value={summary.draft}
          icon={FileClock}
        />
        <Summary
          label="Awaiting approval"
          value={summary.awaitingApproval}
          icon={ClipboardCheck}
        />
        <Summary
          label="Approved"
          value={summary.approved}
          icon={CheckCircle2}
        />
        <Summary
          label="Ordered"
          value={summary.ordered}
          icon={Truck}
        />
        <Summary
          label="Overdue"
          value={summary.overdue}
          icon={AlertTriangle}
        />
        <Summary
          label="Outstanding"
          value={currency(
            summary.outstandingEstimatedCost,
          )}
          icon={ShoppingCart}
        />
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/10 bg-white/[0.04] p-4">
        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input
              type="search"
              value={query}
              onChange={(event) =>
                setQuery(event.target.value)
              }
              placeholder="Search order number, title, supplier, invoice or reference..."
              className="w-full rounded-2xl border border-white/10 bg-slate-950/40 py-3 pl-11 pr-4 text-sm outline-none"
            />
          </div>

          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value)
            }
            className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold"
          >
            <option value="all">
              All statuses
            </option>
            <option value="draft">
              Draft
            </option>
            <option value="awaiting_approval">
              Awaiting approval
            </option>
            <option value="approved">
              Approved
            </option>
            <option value="ordered">
              Ordered
            </option>
            <option value="partially_received">
              Partially received
            </option>
            <option value="received">
              Received
            </option>
            <option value="cancelled">
              Cancelled
            </option>
          </select>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.04]">
        {loading ? (
          <div className="flex min-h-80 items-center justify-center">
            <Loader2 className="h-9 w-9 animate-spin text-blue-200" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex min-h-80 items-center justify-center p-8 text-center">
            <div>
              <ShoppingCart className="mx-auto h-12 w-12 text-white/30" />
              <h2 className="mt-4 text-xl font-black">
                No stock orders found
              </h2>
              <p className="mt-2 text-sm text-white/50">
                Create a draft order or build one from the Low Stock page.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-[1200px] w-full text-left">
              <thead className="border-b border-white/10 bg-black/20 text-xs font-black uppercase tracking-[0.1em] text-white/40">
                <tr>
                  <th className="px-5 py-4">
                    Order
                  </th>
                  <th className="px-5 py-4">
                    Supplier
                  </th>
                  <th className="px-5 py-4">
                    Items
                  </th>
                  <th className="px-5 py-4">
                    Estimated
                  </th>
                  <th className="px-5 py-4">
                    Status
                  </th>
                  <th className="px-5 py-4">
                    Delivery
                  </th>
                  <th className="px-5 py-4">
                    Money
                  </th>
                  <th className="px-5 py-4 text-right">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-white/8">
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-white/[0.03]"
                  >
                    <td className="px-5 py-4">
                      <p className="font-black">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-sm text-white/55">
                        {order.title}
                      </p>
                    </td>

                    <td className="px-5 py-4 text-sm">
                      {order.supplierName ||
                        "Not assigned"}
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-black">
                        {order.lines.length}
                      </p>
                      <p className="text-xs text-white/45">
                        {order.lines.reduce(
                          (total, line) =>
                            total +
                            line.quantityOrdered,
                          0,
                        )}{" "}
                        units
                      </p>
                    </td>

                    <td className="px-5 py-4 font-black">
                      {currency(
                        order.estimatedTotal,
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <StatusBadge
                        status={order.status}
                      />
                    </td>

                    <td className="px-5 py-4 text-sm text-white/60">
                      {date(
                        order.expectedDeliveryDate,
                      )}
                    </td>

                    <td className="px-5 py-4 text-xs">
                      <div className="space-y-2">
                        <MoneyLinkStatus
                          label="Budget"
                          linked={Boolean(order.moneyBudgetId)}
                        />
                        <MoneyLinkStatus
                          label="Transaction"
                          linked={Boolean(order.moneyTransactionId)}
                        />
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-wrap justify-end gap-2">
                        {["draft", "awaiting_approval"].includes(
                          order.status,
                        ) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openEditOrder(order)
                            }
                            disabled={saving}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300/20 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-100 transition hover:bg-blue-500/20 disabled:opacity-50"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Edit order
                          </button>
                        ) : null}

                        {order.status === "draft" ? (
                          <button
                            type="button"
                            onClick={() =>
                              void runAction(order, "submit")
                            }
                            disabled={saving}
                            className="rounded-xl bg-amber-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                          >
                            Submit for approval
                          </button>
                        ) : null}

                        {order.status === "awaiting_approval" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMoneyAction(order, "approve")
                            }
                            disabled={saving}
                            className="rounded-xl bg-emerald-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                          >
                            Approve and link budget
                          </button>
                        ) : null}

                        {order.status === "approved" ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMoneyAction(order, "place")
                            }
                            disabled={saving}
                            className="rounded-xl bg-blue-400 px-3 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                          >
                            Mark as ordered
                          </button>
                        ) : null}

                        {!["draft", "cancelled"].includes(order.status) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMoneyAction(
                                order,
                                "link_transaction",
                              )
                            }
                            disabled={saving}
                            className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 disabled:opacity-50"
                          >
                            {order.moneyTransactionId
                              ? "Change payment link"
                              : "Link payment"}
                          </button>
                        ) : null}

                        {["draft", "awaiting_approval", "approved", "ordered", "partially_received"].includes(
                          order.status,
                        ) ? (
                          <button
                            type="button"
                            onClick={() =>
                              openMoneyAction(order, "cancel")
                            }
                            disabled={saving}
                            className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {showCreate ? (
        <CreateOrderModal
          form={form}
          editingOrder={editingOrder}
          inventory={inventory}
          locations={locations}
          moneyBudgets={moneyBudgets}
          moneyBudgetsLoading={moneyBudgetsLoading}
          moneyBudgetsError={moneyBudgetsError}
          subtotal={formTotals.subtotal}
          total={formTotals.total}
          saving={saving}
          onChange={setForm}
          onAddLine={() => addLine()}
          onChooseItem={chooseItem}
          onSetLineMode={setLineMode}
          onUpdateLine={updateLine}
          onRemoveLine={(lineId) =>
            setForm((current) => ({
              ...current,
              lines: current.lines.filter(
                (line) => line.id !== lineId,
              ),
            }))
          }
          onClose={closeOrderEditor}
          onSave={() => void saveOrder()}
        />
      ) : null}

      {moneyAction.mode && moneyAction.order ? (
        <MoneyActionModal
          state={moneyAction}
          moneyBudgets={moneyBudgets}
          moneyBudgetsLoading={moneyBudgetsLoading}
          moneyBudgetsError={moneyBudgetsError}
          moneyTransactions={moneyTransactions}
          moneyTransactionsLoading={moneyTransactionsLoading}
          moneyTransactionsError={moneyTransactionsError}
          saving={saving}
          onChange={setMoneyAction}
          onClose={closeMoneyAction}
          onSubmit={() => void submitMoneyAction()}
        />
      ) : null}

    </main>
  );
}

function WorkflowStep({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/15 p-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-400 text-sm font-black text-slate-950">
        {number}
      </div>
      <h3 className="mt-3 font-black">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-white/45">
        {description}
      </p>
    </article>
  );
}

function MoneyActionModal({
  state,
  moneyBudgets,
  moneyBudgetsLoading,
  moneyBudgetsError,
  moneyTransactions,
  moneyTransactionsLoading,
  moneyTransactionsError,
  saving,
  onChange,
  onClose,
  onSubmit,
}: {
  state: MoneyActionState;
  moneyBudgets: MoneyBudgetOption[];
  moneyBudgetsLoading: boolean;
  moneyBudgetsError: string | null;
  moneyTransactions: MoneyTransactionOption[];
  moneyTransactionsLoading: boolean;
  moneyTransactionsError: string | null;
  saving: boolean;
  onChange: (state: MoneyActionState) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const order = state.order;
  if (!order || !state.mode) return null;

  const title =
    state.mode === "approve"
      ? "Approve order and link budget"
      : state.mode === "link_transaction"
        ? "Link Money Management payment"
        : state.mode === "place"
          ? "Mark order as ordered"
          : "Cancel stock order";

  const submitLabel =
    state.mode === "approve"
      ? "Approve order"
      : state.mode === "link_transaction"
        ? "Save payment link"
        : state.mode === "place"
          ? "Mark as ordered"
          : "Cancel order";

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md">
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.12em] text-white/40">
              {order.orderNumber}
            </p>
            <h2 className="mt-1 text-2xl font-black">{title}</h2>
            <p className="mt-1 text-sm text-white/50">{order.title}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {state.mode === "approve" ? (
            <>
              <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
                <p className="font-black text-emerald-50">
                  Money Management budget required
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/60">
                  Approving the order commits Burton Pride to the estimated
                  spend of {currency(order.estimatedTotal)}. Link the budget
                  used to approve that spending.
                </p>
              </div>

              <BudgetSelect
                label="Money Management budget"
                value={state.moneyBudgetId}
                budgets={moneyBudgets}
                loading={moneyBudgetsLoading}
                error={moneyBudgetsError}
                required
                onChange={(value) =>
                  onChange({
                    ...state,
                    moneyBudgetId: value,
                  })
                }
              />

              <label className="block">
                <span className="text-sm font-black">Approval notes</span>
                <textarea
                  rows={3}
                  value={state.approvalNotes}
                  onChange={(event) =>
                    onChange({
                      ...state,
                      approvalNotes: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 outline-none"
                />
              </label>

              <Link
                href={MONEY_BUDGETS_URL}
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100"
              >
                <PiggyBank className="h-4 w-4" />
                Open Budget Planning
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : null}

          {state.mode === "link_transaction" ? (
            <>
              <div className="rounded-2xl border border-blue-300/20 bg-blue-500/10 p-4">
                <p className="font-black text-blue-50">
                  Link the final payment
                </p>
                <p className="mt-1 text-xs leading-5 text-blue-50/60">
                  Use the Money Management transaction that paid this supplier.
                  This creates a two-way financial trail without copying the
                  transaction into Stock Management.
                </p>
              </div>

              <TransactionSelect
                label="Money Management transaction"
                value={state.moneyTransactionId}
                transactions={moneyTransactions}
                loading={moneyTransactionsLoading}
                error={moneyTransactionsError}
                expectedAmountPence={Math.round(
                  Number(
                    order.actualTotal ??
                      order.estimatedTotal ??
                      0,
                  ) * 100,
                )}
                supplierName={order.supplierName}
                required
                onChange={(value) =>
                  onChange({
                    ...state,
                    moneyTransactionId: value,
                  })
                }
              />

              <Link
                href={MONEY_TRANSACTIONS_URL}
                className="inline-flex items-center gap-2 rounded-xl border border-blue-300/20 bg-blue-500/10 px-4 py-3 text-sm font-black text-blue-100"
              >
                <ReceiptText className="h-4 w-4" />
                Open Money Management transactions
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : null}

          {state.mode === "place" ? (
            <>
              <Field
                label="Supplier order number"
                value={state.supplierOrderNumber}
                onChange={(value) =>
                  onChange({
                    ...state,
                    supplierOrderNumber: value,
                  })
                }
                placeholder="Order confirmation or supplier reference"
              />
              <Field
                label="Invoice number"
                value={state.invoiceNumber}
                onChange={(value) =>
                  onChange({
                    ...state,
                    invoiceNumber: value,
                  })
                }
                placeholder="Optional invoice number"
              />
              <Field
                label="Expected delivery date"
                type="date"
                value={state.expectedDeliveryDate}
                onChange={(value) =>
                  onChange({
                    ...state,
                    expectedDeliveryDate: value,
                  })
                }
              />
            </>
          ) : null}

          {state.mode === "cancel" ? (
            <>
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                <p className="font-black text-red-50">
                  This keeps the order for audit history
                </p>
                <p className="mt-1 text-xs leading-5 text-red-50/60">
                  Cancelling does not delete the order or any linked Money
                  Management transaction. Paid orders may also need a refund
                  record in Money Management.
                </p>
              </div>

              <label className="block">
                <span className="text-sm font-black">
                  Cancellation reason
                </span>
                <textarea
                  rows={4}
                  value={state.cancellationReason}
                  onChange={(event) =>
                    onChange({
                      ...state,
                      cancellationReason: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 outline-none"
                />
              </label>

              <Link
                href={MONEY_REFUNDS_URL}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-4 py-3 text-sm font-black text-violet-100"
              >
                Open Refund Tracker
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : null}
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-black disabled:opacity-50 ${
              state.mode === "cancel"
                ? "bg-red-400 text-slate-950"
                : "bg-emerald-400 text-slate-950"
            }`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

function MoneyConnectionMetric({
  label,
  value,
  icon: Icon,
  warning = false,
}: {
  label: string;
  value: string | number;
  icon: typeof ShoppingCart;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3 ${
        warning
          ? "border-amber-300/20 bg-amber-500/10"
          : "border-white/10 bg-white/[0.04]"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.1em] text-white/45">
            {label}
          </p>
          <p className="mt-1 text-lg font-black">{value}</p>
        </div>
        <Icon
          className={`h-5 w-5 ${
            warning ? "text-amber-200" : "text-emerald-200"
          }`}
        />
      </div>
    </div>
  );
}

function MoneyLinkStatus({
  label,
  linked,
}: {
  label: string;
  linked: boolean;
}) {
  return (
    <div
      className={`inline-flex w-full items-center gap-2 rounded-lg border px-2.5 py-1.5 font-bold ${
        linked
          ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          : "border-amber-300/20 bg-amber-500/10 text-amber-100"
      }`}
    >
      {linked ? (
        <Link2 className="h-3.5 w-3.5" />
      ) : (
        <LockKeyhole className="h-3.5 w-3.5" />
      )}
      {label}: {linked ? "Linked" : "Not linked"}
    </div>
  );
}

function Summary({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof ShoppingCart;
}) {
  return (
    <article className="rounded-[1.5rem] border border-blue-300/15 bg-blue-500/10 p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-blue-100/55">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black">
            {value}
          </p>
        </div>
        <Icon className="h-6 w-6 text-blue-100" />
      </div>
    </article>
  );
}

function StatusBadge({
  status,
}: {
  status: StockOrderStatus;
}) {
  const className =
    status === "received"
      ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
      : status === "cancelled"
        ? "border-red-300/20 bg-red-500/10 text-red-100"
        : status === "awaiting_approval"
          ? "border-amber-300/20 bg-amber-500/10 text-amber-100"
          : "border-blue-300/20 bg-blue-500/10 text-blue-100";

  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-xs font-black ${className}`}
    >
      {statusLabel(status)}
    </span>
  );
}

function CreateOrderModal({
  form,
  editingOrder,
  inventory,
  locations,
  moneyBudgets,
  moneyBudgetsLoading,
  moneyBudgetsError,
  subtotal,
  total,
  saving,
  onChange,
  onAddLine,
  onChooseItem,
  onSetLineMode,
  onUpdateLine,
  onRemoveLine,
  onClose,
  onSave,
}: {
  form: CreateForm;
  editingOrder: StockOrder | null;
  inventory: InventoryItem[];
  locations: LocationOption[];
  moneyBudgets: MoneyBudgetOption[];
  moneyBudgetsLoading: boolean;
  moneyBudgetsError: string | null;
  subtotal: number;
  total: number;
  saving: boolean;
  onChange: (form: CreateForm) => void;
  onAddLine: () => void;
  onChooseItem: (
    lineId: string,
    itemId: string,
  ) => void;
  onSetLineMode: (
    lineId: string,
    mode: "inventory" | "manual",
  ) => void;
  onUpdateLine: (
    lineId: string,
    patch: Partial<DraftLine>,
  ) => void;
  onRemoveLine: (lineId: string) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-md">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/15 bg-[#111827] shadow-2xl">
        <header className="flex items-start justify-between border-b border-white/10 p-5">
          <div>
            <h2 className="text-2xl font-black">
              {editingOrder
                ? `Edit ${editingOrder.orderNumber}`
                : "Create stock order"}
            </h2>
            <p className="mt-1 text-sm text-white/50">
              {editingOrder
                ? "Change order details, add more items, remove items or update quantities."
                : "Build a draft order, then submit it for approval."}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.06]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="overflow-y-auto p-5">
          <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
            <div className="flex items-start gap-3">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-emerald-100" />
              <div>
                <p className="font-black text-emerald-50">
                  Connected to Money Management
                </p>
                <p className="mt-1 text-xs leading-5 text-emerald-50/65">
                  The order is saved in Stock Management. You can update its
                  items and costs here, while the selected Money Management budget
                  and final transaction stay linked to the same purchase.
                </p>
              </div>
            </div>
          </div>

          {editingOrder?.status === "awaiting_approval" ? (
            <div className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
              <p className="font-black text-amber-50">
                This order is awaiting approval
              </p>
              <p className="mt-1 text-xs leading-5 text-amber-50/65">
                Any changes will update the order before approval. The approver
                should review the new items, quantities and total again.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <Field
              label="Order title"
              value={form.title}
              onChange={(value) =>
                onChange({
                  ...form,
                  title: value,
                })
              }
            />

            <Field
              label="Supplier"
              value={form.supplierName}
              onChange={(value) =>
                onChange({
                  ...form,
                  supplierName: value,
                })
              }
            />

            <Field
              label="Supplier reference"
              value={form.supplierReference}
              onChange={(value) =>
                onChange({
                  ...form,
                  supplierReference: value,
                })
              }
            />

            <BudgetSelect
              label="Money Management budget"
              value={form.moneyBudgetId}
              budgets={moneyBudgets}
              loading={moneyBudgetsLoading}
              error={moneyBudgetsError}
              onChange={(value) =>
                onChange({
                  ...form,
                  moneyBudgetId: value,
                })
              }
            />

            <Field
              label="Expected delivery date"
              type="date"
              value={form.expectedDeliveryDate}
              onChange={(value) =>
                onChange({
                  ...form,
                  expectedDeliveryDate: value,
                })
              }
            />
          </div>

          <label className="mt-4 block">
            <span className="text-sm font-black">
              Reason
            </span>
            <textarea
              value={form.reason}
              onChange={(event) =>
                onChange({
                  ...form,
                  reason: event.target.value,
                })
              }
              rows={3}
              className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 outline-none"
            />
          </label>

          <div className="mt-6 flex items-center justify-between">
            <h3 className="text-lg font-black">
              Order items
            </h3>

            <button
              type="button"
              onClick={onAddLine}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-xs font-black"
            >
              <Plus className="h-4 w-4" />
              Add line
            </button>
          </div>

          <div className="mt-3 space-y-4">
            {form.lines.map((line, lineIndex) => (
              <div
                key={line.id}
                className="rounded-2xl border border-white/10 bg-white/[0.04] p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-black">
                      Order item {lineIndex + 1}
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Choose an existing inventory item or enter something manually.
                    </p>
                  </div>

                  <div className="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
                    <button
                      type="button"
                      onClick={() =>
                        onSetLineMode(line.id, "inventory")
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                        line.itemMode === "inventory"
                          ? "bg-blue-400 text-slate-950"
                          : "text-white/55 hover:bg-white/[0.06]"
                      }`}
                    >
                      Existing inventory
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onSetLineMode(line.id, "manual")
                      }
                      className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                        line.itemMode === "manual"
                          ? "bg-amber-300 text-slate-950"
                          : "text-white/55 hover:bg-white/[0.06]"
                      }`}
                    >
                      Manual item
                    </button>
                  </div>
                </div>

                {line.itemMode === "inventory" ? (
                  <div className="mt-4">
                    <label className="block">
                      <span className="text-xs font-black text-white/60">
                        Inventory item
                      </span>
                      <select
                        value={line.stockItemId}
                        onChange={(event) =>
                          onChooseItem(
                            line.id,
                            event.target.value,
                          )
                        }
                        className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                      >
                        <option value="">
                          Choose inventory item
                        </option>
                        {inventory.map((item) => (
                          <option
                            key={item.id}
                            value={item.id}
                          >
                            {item.name} — {item.sku}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-xs font-black text-white/60">
                        Manual item name
                      </span>
                      <input
                        type="text"
                        value={line.itemName}
                        onChange={(event) =>
                          onUpdateLine(line.id, {
                            itemName: event.target.value,
                          })
                        }
                        placeholder="Example: Folding storage box"
                        className="mt-2 w-full rounded-xl border border-amber-300/20 bg-amber-500/5 px-3 py-3 text-sm outline-none placeholder:text-white/25"
                      />
                    </label>

                    <label className="block">
                      <span className="text-xs font-black text-white/60">
                        SKU or product code
                      </span>
                      <input
                        type="text"
                        value={line.sku}
                        onChange={(event) =>
                          onUpdateLine(line.id, {
                            sku: event.target.value,
                          })
                        }
                        placeholder="Optional"
                        className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm outline-none placeholder:text-white/25"
                      />
                    </label>
                  </div>
                )}

                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-[120px_150px_1fr_44px]">
                  <label className="block">
                    <span className="text-xs font-black text-white/60">
                      Quantity
                    </span>
                    <input
                      type="number"
                      min={1}
                      value={line.quantityOrdered}
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          quantityOrdered:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black text-white/60">
                      Unit cost
                    </span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.estimatedUnitCost}
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          estimatedUnitCost:
                            event.target.value,
                        })
                      }
                      placeholder="£0.00"
                      className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3"
                    />
                  </label>

                  <label className="block">
                    <span className="text-xs font-black text-white/60">
                      Destination location
                    </span>
                    <select
                      value={line.destinationLocationId}
                      onChange={(event) =>
                        onUpdateLine(line.id, {
                          destinationLocationId:
                            event.target.value,
                        })
                      }
                      className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-3 text-sm"
                    >
                      <option value="">
                        Choose destination location
                      </option>
                      {locations.map((location) => (
                        <option
                          key={location.id}
                          value={location.id}
                        >
                          {location.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() =>
                        onRemoveLine(line.id)
                      }
                      className="flex h-11 w-11 items-center justify-center rounded-xl border border-red-300/20 bg-red-500/10 text-red-100"
                      aria-label={`Remove order item ${lineIndex + 1}`}
                      title="Remove this order item"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <label className="mt-3 block">
                  <span className="text-xs font-black text-white/60">
                    Item notes
                  </span>
                  <textarea
                    rows={2}
                    value={line.notes}
                    onChange={(event) =>
                      onUpdateLine(line.id, {
                        notes: event.target.value,
                      })
                    }
                    placeholder={
                      line.itemMode === "manual"
                        ? "Optional details, website link, colour, size or supplier product code"
                        : "Optional notes about this order item"
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-sm outline-none placeholder:text-white/25"
                  />
                </label>

                {line.itemMode === "manual" ? (
                  <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs leading-5 text-amber-100">
                    This item will be saved on the order without linking it to an existing inventory record.
                    It will not automatically create a new stock item.
                  </div>
                ) : null}
              </div>
            ))}
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Field
              label="Delivery"
              type="number"
              value={form.estimatedDelivery}
              onChange={(value) =>
                onChange({
                  ...form,
                  estimatedDelivery: value,
                })
              }
            />
            <Field
              label="VAT"
              type="number"
              value={form.estimatedVat}
              onChange={(value) =>
                onChange({
                  ...form,
                  estimatedVat: value,
                })
              }
            />
            <Field
              label="Discount"
              type="number"
              value={form.estimatedDiscount}
              onChange={(value) =>
                onChange({
                  ...form,
                  estimatedDiscount: value,
                })
              }
            />
          </div>

          <div className="mt-6 rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4">
            <div className="flex justify-between">
              <span className="font-bold">
                Subtotal
              </span>
              <span className="font-black">
                {currency(subtotal)}
              </span>
            </div>

            <div className="mt-2 flex justify-between text-lg">
              <span className="font-black">
                Estimated total
              </span>
              <span className="font-black">
                {currency(total)}
              </span>
            </div>
          </div>
        </div>

        <footer className="flex justify-end gap-3 border-t border-white/10 p-5">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/10 bg-white/[0.06] px-5 py-3 text-sm font-black"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-2xl bg-blue-400 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PackageCheck className="h-4 w-4" />
            )}
            {editingOrder
              ? "Save order changes"
              : "Create draft order"}
          </button>
        </footer>
      </div>
    </div>
  );
}

function TransactionSelect({
  label,
  value,
  transactions,
  loading,
  error,
  expectedAmountPence,
  supplierName,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  transactions: MoneyTransactionOption[];
  loading: boolean;
  error: string | null;
  expectedAmountPence: number;
  supplierName?: string | null;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [manualValue, setManualValue] = useState("");

  const normalisedSupplier =
    String(supplierName || "")
      .trim()
      .toLowerCase();

  const scoredTransactions = useMemo(() => {
    const search = searchText
      .trim()
      .toLowerCase();

    return [...transactions]
      .map((transaction) => {
        let score = 0;

        const amountDifference = Math.abs(
          Number(transaction.amountPence || 0) -
            expectedAmountPence,
        );

        if (amountDifference === 0) {
          score += 100;
        } else if (amountDifference <= 100) {
          score += 70;
        } else if (amountDifference <= 500) {
          score += 35;
        }

        const searchable = [
          transaction.id,
          transaction.reference,
          transaction.description,
          transaction.supplierName,
          transaction.category,
          transaction.paymentMethod,
          transaction.transactionType,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (
          normalisedSupplier &&
          searchable.includes(normalisedSupplier)
        ) {
          score += 60;
        }

        if (transaction.isReconciled) {
          score += 5;
        }

        return {
          ...transaction,
          matchScore: score,
          searchable,
        };
      })
      .filter((transaction) =>
        search
          ? transaction.searchable.includes(search)
          : true,
      )
      .sort((left, right) => {
        if (right.matchScore !== left.matchScore) {
          return right.matchScore - left.matchScore;
        }

        const leftDate = left.date
          ? new Date(left.date).getTime()
          : 0;
        const rightDate = right.date
          ? new Date(right.date).getTime()
          : 0;

        return rightDate - leftDate;
      });
  }, [
    transactions,
    expectedAmountPence,
    normalisedSupplier,
    searchText,
  ]);

  const likelyMatches = scoredTransactions.filter(
    (transaction) => transaction.matchScore >= 60,
  );

  const otherTransactions = scoredTransactions.filter(
    (transaction) => transaction.matchScore < 60,
  );

  const selected =
    transactions.find(
      (transaction) => transaction.id === value,
    ) || null;

  function formatTransactionDate(value: string | null) {
    if (!value) return "No date recorded";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
    }).format(parsed);
  }

  function chooseTransaction(
    transaction: MoneyTransactionOption,
  ) {
    onChange(transaction.id);
    setOpen(false);
    setManualMode(false);
    setManualValue("");
  }

  function useManualReference() {
    const typed = manualValue.trim();

    if (!typed) return;

    const normalisedTyped = typed.toLowerCase();

    const match = transactions.find(
      (transaction) =>
        transaction.id.toLowerCase() === normalisedTyped ||
        String(transaction.reference || "")
          .trim()
          .toLowerCase() === normalisedTyped,
    );

    /*
     * When the administrator enters a Money Management reference such as
     * BP-2026-041, convert it to the real transaction UUID automatically.
     * A UUID can also be pasted directly.
     */
    onChange(match?.id || typed);
    setOpen(false);
  }

  function transactionCard(
    transaction: MoneyTransactionOption & {
      matchScore?: number;
    },
    likely = false,
  ) {
    const isSelected =
      transaction.id === value;

    return (
      <button
        key={transaction.id}
        type="button"
        onClick={() =>
          chooseTransaction(transaction)
        }
        className={`w-full rounded-2xl border p-4 text-left transition ${
          isSelected
            ? "border-emerald-300/40 bg-emerald-500/15 ring-2 ring-emerald-300/15"
            : likely
              ? "border-blue-300/20 bg-blue-500/10 hover:bg-blue-500/15"
              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {transaction.reference ? (
                <span className="rounded-full border border-violet-300/20 bg-violet-500/10 px-2.5 py-1 text-[11px] font-black text-violet-100">
                  {transaction.reference}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[11px] font-black text-white/45">
                  No reference
                </span>
              )}

              <span className="text-xs font-bold text-white/45">
                {formatTransactionDate(
                  transaction.date,
                )}
              </span>

              {likely ? (
                <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-blue-100">
                  Likely match
                </span>
              ) : null}

              {transaction.isReconciled ? (
                <span className="rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-emerald-100">
                  Reconciled
                </span>
              ) : null}
            </div>

            <p className="mt-3 line-clamp-2 text-sm font-black leading-5 text-white">
              {transaction.description ||
                "Unnamed transaction"}
            </p>

            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-white/45">
              <span>
                Supplier:{" "}
                <strong className="text-white/65">
                  {transaction.supplierName ||
                    "Not recorded"}
                </strong>
              </span>
              <span>
                Category:{" "}
                <strong className="text-white/65">
                  {transaction.category ||
                    "Not recorded"}
                </strong>
              </span>
              <span>
                Type:{" "}
                <strong className="text-white/65">
                  {transaction.transactionType ||
                    "Not recorded"}
                </strong>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 sm:block sm:text-right">
            <p className="text-lg font-black text-white">
              {currencyFromPence(
                transaction.amountPence,
              )}
            </p>

            {isSelected ? (
              <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-400 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-950">
                <Check className="h-3 w-3" />
                Selected
              </span>
            ) : null}
          </div>
        </div>
      </button>
    );
  }

  return (
    <div className="block">
      <span className="text-sm font-black">
        {label}
        {required ? (
          <span className="ml-1 text-red-300">*</span>
        ) : null}
      </span>

      <button
        type="button"
        disabled={loading}
        onClick={() => setOpen((current) => !current)}
        className="mt-2 flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-left outline-none transition hover:border-blue-300/25 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <div className="min-w-0 flex-1">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-black text-white">
                  {selected.reference ||
                    "Transaction selected"}
                </span>
                <span className="text-xs text-white/45">
                  {formatTransactionDate(
                    selected.date,
                  )}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-white/50">
                {selected.description}
              </p>
              <p className="mt-1 font-black text-emerald-100">
                {currencyFromPence(
                  selected.amountPence,
                )}
              </p>
            </>
          ) : value ? (
            <>
              <p className="font-black text-amber-100">
                Manually entered transaction
              </p>
              <p className="mt-1 truncate font-mono text-xs text-white/45">
                {value}
              </p>
            </>
          ) : (
            <>
              <p className="font-black text-white/80">
                {loading
                  ? "Loading Money Management transactions..."
                  : "Choose a payment transaction"}
              </p>
              <p className="mt-1 text-xs text-white/40">
                Search by BP reference, title, supplier or amount.
              </p>
            </>
          )}
        </div>

        <ChevronDown
          className={`h-5 w-5 shrink-0 text-white/45 transition ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open ? (
        <div className="mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#0b1220] shadow-2xl">
          <div className="border-b border-white/10 p-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                type="search"
                value={searchText}
                onChange={(event) =>
                  setSearchText(event.target.value)
                }
                placeholder="Search BP reference, supplier, title, category or amount..."
                className="w-full rounded-xl border border-white/10 bg-white/[0.05] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/25"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-white/40">
                {scoredTransactions.length} matching transaction
                {scoredTransactions.length === 1
                  ? ""
                  : "s"}
              </p>

              <button
                type="button"
                onClick={() =>
                  setManualMode((current) => !current)
                }
                className="rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-xs font-black text-amber-100"
              >
                {manualMode
                  ? "Hide manual entry"
                  : "Enter an ID or BP reference"}
              </button>
            </div>

            {manualMode ? (
              <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                <p className="font-black text-amber-50">
                  Enter a transaction manually
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-50/65">
                  In Money Management, the easy-to-read transaction
                  reference looks like{" "}
                  <strong>BP-2026-041</strong>. The database ID is a
                  longer UUID such as{" "}
                  <strong className="break-all font-mono">
                    7b0e7c0f-2d8d-4b9d-9f73-8b5d12e58c41
                  </strong>
                  . You can enter either one. A BP reference is changed
                  to the real UUID automatically when it is found in the
                  loaded transactions.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={manualValue}
                    onChange={(event) =>
                      setManualValue(
                        event.target.value,
                      )
                    }
                    placeholder="Example: BP-2026-041 or a UUID"
                    className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 font-mono text-sm text-white outline-none placeholder:text-white/25"
                  />
                  <button
                    type="button"
                    disabled={!manualValue.trim()}
                    onClick={useManualReference}
                    className="rounded-xl bg-amber-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    Use this transaction
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="max-h-[420px] space-y-5 overflow-y-auto p-4">
            {likelyMatches.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-black text-blue-100">
                      Likely matches
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      Closest supplier and payment amount matches.
                    </p>
                  </div>
                  <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-black text-blue-100">
                    {likelyMatches.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {likelyMatches.map(
                    (transaction) =>
                      transactionCard(
                        transaction,
                        true,
                      ),
                  )}
                </div>
              </section>
            ) : null}

            {otherTransactions.length > 0 ? (
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <p className="font-black text-white">
                      Other transactions
                    </p>
                    <p className="mt-1 text-xs text-white/40">
                      All other active Money Management records.
                    </p>
                  </div>
                  <span className="rounded-full bg-white/[0.06] px-2.5 py-1 text-xs font-black text-white/60">
                    {otherTransactions.length}
                  </span>
                </div>

                <div className="space-y-2">
                  {otherTransactions.map(
                    (transaction) =>
                      transactionCard(
                        transaction,
                        false,
                      ),
                  )}
                </div>
              </section>
            ) : null}

            {!loading &&
            scoredTransactions.length === 0 ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-5 text-center">
                <Search className="mx-auto h-7 w-7 text-amber-100" />
                <p className="mt-3 font-black text-amber-50">
                  No matching Money Management transactions
                </p>
                <p className="mt-1 text-xs text-amber-50/60">
                  Change the search or use manual entry with a BP
                  reference or UUID.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="mt-3 rounded-2xl border border-blue-300/15 bg-blue-500/10 p-4 text-xs text-blue-50/75">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-black text-blue-50">
                {selected.reference ||
                  "Selected transaction"}
              </p>
              <p className="mt-1 text-blue-50/55">
                {selected.description ||
                  selected.supplierName ||
                  "Selected payment"}
              </p>
            </div>

            <span className="rounded-full border border-blue-300/20 bg-blue-500/10 px-2.5 py-1 font-black text-blue-50">
              {currencyFromPence(
                selected.amountPence,
              )}
            </span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <p>
              Date:{" "}
              <strong className="text-blue-50">
                {formatTransactionDate(
                  selected.date,
                )}
              </strong>
            </p>
            <p>
              Supplier:{" "}
              <strong className="text-blue-50">
                {selected.supplierName ||
                  "Not recorded"}
              </strong>
            </p>
            <p>
              Category:{" "}
              <strong className="text-blue-50">
                {selected.category ||
                  "Not recorded"}
              </strong>
            </p>
            <p>
              Reconciled:{" "}
              <strong className="text-blue-50">
                {selected.isReconciled
                  ? "Yes"
                  : "No"}
              </strong>
            </p>
          </div>

          {selected.amountPence !==
          expectedAmountPence ? (
            <p className="mt-3 rounded-xl border border-amber-300/20 bg-amber-500/10 px-3 py-2 text-amber-100">
              Warning: this transaction amount does not exactly
              match the expected order payment of{" "}
              {currencyFromPence(
                expectedAmountPence,
              )}.
            </p>
          ) : (
            <p className="mt-3 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 font-black text-emerald-100">
              The transaction amount matches the expected order payment.
            </p>
          )}
        </div>
      ) : value ? (
        <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
          <p className="font-black text-amber-50">
            Manually entered transaction value
          </p>
          <code className="mt-2 block break-all rounded-xl bg-black/20 px-3 py-2 text-xs text-amber-50/75">
            {value}
          </code>
          <p className="mt-2 text-xs leading-5 text-amber-50/60">
            This value was not found in the loaded transaction list.
            Confirm it is the correct Money Management UUID before saving.
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 font-mono text-xs leading-5 text-red-100">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-white/40">
          Choose a readable Money Management payment. The real
          transaction UUID is saved automatically in Stock Management.
        </p>
      )}
    </div>
  );
}

function BudgetSelect({
  label,
  value,
  budgets,
  loading,
  error,
  required = false,
  onChange,
}: {
  label: string;
  value: string;
  budgets: MoneyBudgetOption[];
  loading: boolean;
  error: string | null;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  const selected =
    budgets.find((budget) => budget.id === value) ||
    null;

  const grouped = budgets.reduce<
    Record<string, MoneyBudgetOption[]>
  >((groups, budget) => {
    const year = budget.year || "Other";
    groups[year] = groups[year] || [];
    groups[year].push(budget);
    return groups;
  }, {});

  const years = Object.keys(grouped).sort(
    (left, right) =>
      Number(right || 0) - Number(left || 0),
  );

  return (
    <label className="block">
      <span className="text-sm font-black">
        {label}
        {required ? (
          <span className="ml-1 text-red-300">*</span>
        ) : null}
      </span>

      <select
        value={value}
        disabled={loading || budgets.length === 0}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-sm font-bold text-white outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="">
          {loading
            ? "Loading Money Management budgets..."
            : budgets.length === 0
              ? "No saved budgets available"
              : "Choose a budget"}
        </option>

        {years.map((year) => (
          <optgroup key={year} label={`${year} budgets`}>
            {grouped[year].map((budget) => (
              <option key={budget.id} value={budget.id}>
                {budget.categoryLabel} — planned{" "}
                {currencyFromPence(
                  budget.plannedAmountPence,
                )} — remaining{" "}
                {currencyFromPence(
                  budget.remainingAmountPence,
                )}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      {selected ? (
        <div className="mt-2 rounded-xl border border-emerald-300/15 bg-emerald-500/10 p-3 text-xs text-emerald-50/75">
          <p className="font-black text-emerald-50">
            {selected.categoryLabel} ({selected.year})
          </p>
          <p className="mt-1">
            Planned:{" "}
            {currencyFromPence(
              selected.plannedAmountPence,
            )}{" "}
            · Used:{" "}
            {currencyFromPence(
              selected.actualAmountPence,
            )}{" "}
            · Remaining:{" "}
            {currencyFromPence(
              selected.remainingAmountPence,
            )}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 font-mono text-xs leading-5 text-red-100">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-xs leading-5 text-white/40">
          Budgets are loaded automatically from Money Management.
          You do not need to copy or type an ID.
        </p>
      )}
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  helpText,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  helpText?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-black">
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="mt-2 w-full rounded-2xl border border-white/10 bg-white/[0.05] px-4 py-3 outline-none placeholder:text-white/25"
      />
      {helpText ? (
        <span className="mt-2 block text-xs leading-5 text-white/40">
          {helpText}
        </span>
      ) : null}
    </label>
  );
}
