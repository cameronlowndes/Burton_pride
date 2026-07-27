"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  Download,
  ExternalLink,
  FileSpreadsheet,
  History,
  Filter,
  Link2,
  Loader2,
  PackageCheck,
  PackagePlus,
  ReceiptText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  ShoppingCart,
  TriangleAlert,
  Truck,
  Unlink,
  Users,
  X,
} from "lucide-react";

const API = "/api/admin/stockmanagement/suppliers";

const MONEY_SUPPLIERS_API =
  "/api/admin/money/suppliers?includeInactive=true";

type SupplierUse =
  | "stock"
  | "service"
  | "event_trader"
  | "performer"
  | "venue"
  | "mixed";

type SupplierStatus =
  | "active"
  | "review"
  | "inactive"
  | "blocked";

type EventHubConnection = {
  connected: boolean;
  recordType: string | null;
  recordId: string | null;
  organisationName: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  lastEvent: string | null;
  eventRating: string | null;
  doNotInvite: boolean;
  requiresReview?: boolean;
};

type MoneyManagementConnection = {
  connected: boolean;
  supplierId: string | null;
  supplierName?: string | null;
  accountReference?: string | null;
  totalPaidPence: number;
  currentYearPaidPence: number;
  transactionCount: number;
  missingReceiptCount: number;
  unreconciledCount: number;
  doNotUse: boolean;
};

type StockManagementSummary = {
  itemCount: number;
  openOrderCount: number;
  overdueOrderCount: number;
  lastOrderDate: string | null;
  totalEstimatedSpendPence: number;
  totalActualSpendPence: number;
  averageDeliveryDays: number | null;
};

type StockSupplierView = {
  id: string;
  displayName: string;
  supplierUse: SupplierUse;

  isActive: boolean;
  needsReview: boolean;
  doNotUse: boolean;

  usualDeliveryDays?: number | null;
  minimumOrderValuePence?: number | null;
  usualDeliveryCostPence?: number | null;
  stockNotes?: string | null;

  createdAt?: string | null;
  updatedAt?: string | null;

  eventHub: EventHubConnection;
  moneyManagement: MoneyManagementConnection;
  stockManagement: StockManagementSummary;
};

type SupplierSummary = {
  activeSuppliers: number;
  connectedToEventHub: number;
  connectedToMoneyManagement: number;
  fullyConnected: number;
  openOrders: number;
  overdueDeliveries: number;
  blockedOrDoNotUse: number;
  missingConnections: number;
};


type EventHubContactOption = {
  id: string;
  recordType: string;
  organisationName: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  rating: string | null;
  doNotInvite: boolean;
  needsReview: boolean;
  linkedStockSupplierId: string | null;
  linkedStockSupplierName: string | null;
  eventName?: string | null;
  eventYear?: number | null;
  isActive?: boolean;
};


type MoneySupplierOption = {
  id: string;
  supplier_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  category?: string | null;
  is_active?: boolean | null;
};

type MoneySuppliersResponse = {
  ok?: boolean;
  suppliers?: MoneySupplierOption[];
  error?: string;
  details?: string;
  code?: string;
};

type SupplierListResponse = {
  ok?: boolean;
  error?: string;
  suppliers?: StockSupplierView[];
  eventContacts?: EventHubContactOption[];
  summary?: Partial<SupplierSummary>;
  permissions?: Partial<SupplierPermissions>;
};

type SupplierPermissions = {
  view: boolean;
  create: boolean;
  edit: boolean;
  linkEventHub: boolean;
  linkMoney: boolean;
  manageItemLinks: boolean;
  review: boolean;
  export: boolean;
};

type SupplierFormState = {
  displayName: string;
  supplierUse: SupplierUse;
  usualDeliveryDays: string;
  minimumOrderValue: string;
  usualDeliveryCost: string;
  stockNotes: string;
  eventRecordType: string;
  eventRecordId: string;
  moneySupplierId: string;
};


type ConnectionFilter =
  | "all"
  | "event_connected"
  | "money_connected"
  | "fully_connected"
  | "missing_event"
  | "missing_money"
  | "stock_only"
  | "main_event"
  | "do_not_invite"
  | "do_not_use"
  | "needs_review";

type DetailTab =
  | "overview"
  | "event"
  | "money"
  | "stock"
  | "orders"
  | "history"
  | "compliance"
  | "admin";


type SupplierItemLink = {
  id: string;
  stockItemId: string;
  stockItemName: string;
  sku: string | null;
  supplierRole: "preferred" | "alternative";
  supplierSku: string | null;
  unitCostPence: number | null;
  minimumOrderQuantity: number | null;
  leadTimeDays: number | null;
  isActive: boolean;
};

type SupplierOrder = {
  id: string;
  orderNumber: string;
  status: string;
  orderDate: string | null;
  expectedDeliveryDate: string | null;
  deliveredAt: string | null;
  estimatedTotalPence: number;
  actualTotalPence: number;
  receivedQuantity: number;
  missingQuantity: number;
  damagedQuantity: number;
  refundRequired: boolean;
  replacementRequired: boolean;
  notes: string | null;
};

type SupplierReview = {
  id: string;
  createdAt: string;
  adminName: string | null;
  eventName: string | null;
  rating: string;
  deliveryRating: number | null;
  qualityRating: number | null;
  communicationRating: number | null;
  valueRating: number | null;
  notes: string | null;
};

type SupplierAuditEntry = {
  id: string;
  createdAt: string;
  adminName: string | null;
  action: string;
  summary: string | null;
  status: string | null;
};

type SupplierHistoricEvent = {
  id: string;
  eventName: string;
  eventYear: number | null;
  eventDate: string | null;
  relationshipRating: string | null;
  notes: string | null;
};

type SupplierCompliance = {
  publicLiabilityStatus: string;
  publicLiabilityExpiry: string | null;
  insuranceDocumentUrl: string | null;
  foodHygieneStatus: string;
  foodHygieneRating: string | null;
  foodHygieneAuthority: string | null;
  foodHygieneCheckedAt: string | null;
};

type SupplierOrganisationLink = {
  organisationId: string | null;
  organisationName: string | null;
  migrationStatus: string;
};

type SupplierWorkspace = {
  itemLinks: SupplierItemLink[];
  orders: SupplierOrder[];
  reviews: SupplierReview[];
  auditLogs: SupplierAuditEntry[];
  historicEvents: SupplierHistoricEvent[];
  compliance: SupplierCompliance;
  organisation: SupplierOrganisationLink;
  duplicateCandidates: Array<{
    id: string;
    displayName: string;
    source: string;
    reason: string;
  }>;
  canMainAdminOverride: boolean;
  activeOverride: {
    enabled: boolean;
    reason: string | null;
    expiresAt: string | null;
  } | null;
};

type WorkspaceResponse = {
  ok?: boolean;
  workspace?: Partial<SupplierWorkspace>;
  error?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type ProfileEditState = {
  displayName: string;
  supplierUse: SupplierUse;
  usualDeliveryDays: string;
  minimumOrderValue: string;
  usualDeliveryCost: string;
  stockNotes: string;
  isActive: boolean;
  needsReview: boolean;
  doNotUse: boolean;
};

type OrderFormState = {
  orderId: string;
  orderNumber: string;
  status: string;
  orderDate: string;
  expectedDeliveryDate: string;
  estimatedTotal: string;
  actualTotal: string;
  receivedQuantity: string;
  missingQuantity: string;
  damagedQuantity: string;
  refundRequired: boolean;
  replacementRequired: boolean;
  notes: string;
};

type ReviewFormState = {
  rating: string;
  deliveryRating: string;
  qualityRating: string;
  communicationRating: string;
  valueRating: string;
  notes: string;
};

type ComplianceFormState = {
  publicLiabilityStatus: string;
  publicLiabilityExpiry: string;
  insuranceDocumentUrl: string;
  foodHygieneStatus: string;
  foodHygieneRating: string;
  foodHygieneAuthority: string;
  foodHygieneCheckedAt: string;
};

const EMPTY_PERMISSIONS: SupplierPermissions = {
  view: false,
  create: false,
  edit: false,
  linkEventHub: false,
  linkMoney: false,
  manageItemLinks: false,
  review: false,
  export: false,
};

const EMPTY_SUMMARY: SupplierSummary = {
  activeSuppliers: 0,
  connectedToEventHub: 0,
  connectedToMoneyManagement: 0,
  fullyConnected: 0,
  openOrders: 0,
  overdueDeliveries: 0,
  blockedOrDoNotUse: 0,
  missingConnections: 0,
};

const EMPTY_FORM: SupplierFormState = {
  displayName: "",
  supplierUse: "stock",
  usualDeliveryDays: "",
  minimumOrderValue: "",
  usualDeliveryCost: "",
  stockNotes: "",
  eventRecordType: "",
  eventRecordId: "",
  moneySupplierId: "",
};


const EMPTY_WORKSPACE: SupplierWorkspace = {
  itemLinks: [],
  orders: [],
  reviews: [],
  auditLogs: [],
  historicEvents: [],
  compliance: {
    publicLiabilityStatus: "not_recorded",
    publicLiabilityExpiry: null,
    insuranceDocumentUrl: null,
    foodHygieneStatus: "not_required",
    foodHygieneRating: null,
    foodHygieneAuthority: null,
    foodHygieneCheckedAt: null,
  },
  organisation: {
    organisationId: null,
    organisationName: null,
    migrationStatus: "not_started",
  },
  duplicateCandidates: [],
  canMainAdminOverride: false,
  activeOverride: null,
};

const EMPTY_ORDER_FORM: OrderFormState = {
  orderId: "",
  orderNumber: "",
  status: "draft",
  orderDate: "",
  expectedDeliveryDate: "",
  estimatedTotal: "",
  actualTotal: "",
  receivedQuantity: "0",
  missingQuantity: "0",
  damagedQuantity: "0",
  refundRequired: false,
  replacementRequired: false,
  notes: "",
};

const EMPTY_REVIEW_FORM: ReviewFormState = {
  rating: "good",
  deliveryRating: "",
  qualityRating: "",
  communicationRating: "",
  valueRating: "",
  notes: "",
};

const EMPTY_COMPLIANCE_FORM: ComplianceFormState = {
  publicLiabilityStatus: "not_recorded",
  publicLiabilityExpiry: "",
  insuranceDocumentUrl: "",
  foodHygieneStatus: "not_required",
  foodHygieneRating: "",
  foodHygieneAuthority: "",
  foodHygieneCheckedAt: "",
};

function formatMoney(pence: number | null | undefined) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence || 0) / 100);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function supplierStatus(supplier: StockSupplierView): SupplierStatus {
  if (supplier.doNotUse || supplier.moneyManagement.doNotUse) {
    return "blocked";
  }

  if (supplier.needsReview || supplier.eventHub.requiresReview) {
    return "review";
  }

  if (!supplier.isActive) {
    return "inactive";
  }

  return "active";
}

function statusClasses(status: SupplierStatus) {
  switch (status) {
    case "active":
      return "border-emerald-300/25 bg-emerald-500/10 text-emerald-100";
    case "review":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "blocked":
      return "border-red-300/25 bg-red-500/10 text-red-100";
    default:
      return "border-white/10 bg-white/[0.06] text-white/60";
  }
}

function connectionClasses(connected: boolean) {
  return connected
    ? "border-emerald-300/25 bg-emerald-500/10 text-emerald-100"
    : "border-amber-300/25 bg-amber-500/10 text-amber-100";
}

function parsePoundsToPence(value: string) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0) {
    return null;
  }

  return Math.round(numberValue * 100);
}

function buildSummary(suppliers: StockSupplierView[]): SupplierSummary {
  return suppliers.reduce<SupplierSummary>(
    (summary, supplier) => {
      const status = supplierStatus(supplier);

      if (supplier.isActive) summary.activeSuppliers += 1;
      if (supplier.eventHub.connected) summary.connectedToEventHub += 1;
      if (supplier.moneyManagement.connected) {
        summary.connectedToMoneyManagement += 1;
      }
      if (
        supplier.eventHub.connected &&
        supplier.moneyManagement.connected
      ) {
        summary.fullyConnected += 1;
      }

      summary.openOrders += supplier.stockManagement.openOrderCount;
      summary.overdueDeliveries +=
        supplier.stockManagement.overdueOrderCount;

      if (
        status === "blocked" ||
        supplier.eventHub.doNotInvite
      ) {
        summary.blockedOrDoNotUse += 1;
      }

      if (
        !supplier.eventHub.connected ||
        !supplier.moneyManagement.connected
      ) {
        summary.missingConnections += 1;
      }

      return summary;
    },
    { ...EMPTY_SUMMARY },
  );
}

function ConnectionBadge({
  connected,
  connectedText,
  missingText,
}: {
  connected: boolean;
  connectedText: string;
  missingText: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-black ${connectionClasses(
        connected,
      )}`}
    >
      {connected ? (
        <CheckCircle2 className="h-3.5 w-3.5" />
      ) : (
        <Unlink className="h-3.5 w-3.5" />
      )}
      {connected ? connectedText : missingText}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  classes,
}: {
  label: string;
  value: number;
  icon: typeof Boxes;
  classes: string;
}) {
  return (
    <div
      className={`rounded-3xl border p-4 shadow-lg ${classes}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-3xl font-black">
            {value.toLocaleString("en-GB")}
          </p>
          <p className="mt-2 text-[11px] font-black uppercase tracking-[0.13em] opacity-75">
            {label}
          </p>
        </div>
        <span className="rounded-2xl bg-black/15 p-2.5 ring-1 ring-white/10">
          <Icon className="h-5 w-5" />
        </span>
      </div>
    </div>
  );
}


type ApiErrorPayload = {
  ok?: boolean;
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
  field?: string;
  endpoint?: string;
  reason?: string;
  status?: number;
};

async function readApiError(
  response: Response,
  fallbackMessage: string,
) {
  const contentType =
    response.headers.get("content-type") || "";

  let payload: ApiErrorPayload = {};
  let rawBody = "";

  if (contentType.includes("application/json")) {
    payload = (await response
      .json()
      .catch(() => ({}))) as ApiErrorPayload;
  } else {
    rawBody = await response.text().catch(() => "");
  }

  const parts = [
    payload.error || payload.message || fallbackMessage,
    `HTTP ${response.status} ${response.statusText || ""}`.trim(),
    `Endpoint: ${payload.endpoint || response.url || "Unknown endpoint"}`,
    payload.code ? `Code: ${payload.code}` : "",
    payload.reason ? `Reason: ${payload.reason}` : "",
    payload.field ? `Field: ${payload.field}` : "",
    payload.details ? `Details: ${payload.details}` : "",
    payload.hint ? `Hint: ${payload.hint}` : "",
    rawBody
      ? `Non-JSON response: ${rawBody.slice(0, 500)}`
      : "",
  ].filter(Boolean);

  return new Error(parts.join("\n"));
}

function formatErrorForDisplay(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return "An unknown supplier error occurred.";
  }
}


function eventContactOptionLabel(
  contact: EventHubContactOption,
) {
  const parts = [
    contact.organisationName,
    contact.contactName,
    contact.email,
  ].filter(Boolean);

  return parts.join(" · ");
}

function moneySupplierOptionLabel(
  supplier: MoneySupplierOption,
) {
  const parts = [
    supplier.supplier_name,
    supplier.contact_name,
    supplier.email,
  ].filter(Boolean);

  return parts.join(" · ");
}


function connectionHealthLabel(
  supplier: StockSupplierView,
) {
  if (
    supplier.eventHub.connected &&
    supplier.moneyManagement.connected
  ) {
    return "Fully connected";
  }

  if (
    supplier.eventHub.connected ||
    supplier.moneyManagement.connected
  ) {
    return "Partly connected";
  }

  return "Stock only";
}

function overallRecommendation(
  supplier: StockSupplierView,
) {
  if (
    supplier.doNotUse ||
    supplier.moneyManagement.doNotUse
  ) {
    return "Do not use";
  }

  if (
    supplier.eventHub.doNotInvite ||
    supplier.needsReview ||
    supplier.eventHub.requiresReview ||
    supplier.stockManagement.overdueOrderCount > 0
  ) {
    return "Review before ordering";
  }

  return "Suitable to use";
}

function normaliseMatchValue(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9@.+]/g, "");
}

function calculatePossibleDuplicate(
  form: SupplierFormState,
  suppliers: StockSupplierView[],
  eventContacts: EventHubContactOption[],
  moneySuppliers: MoneySupplierOption[],
) {
  const name = normaliseMatchValue(form.displayName);

  if (!name) return null;

  const stockMatch = suppliers.find(
    (supplier) =>
      normaliseMatchValue(supplier.displayName) === name,
  );

  if (stockMatch) {
    return {
      source: "Stock Management",
      name: stockMatch.displayName,
      id: stockMatch.id,
    };
  }

  const eventMatch = eventContacts.find(
    (contact) =>
      normaliseMatchValue(contact.organisationName) ===
      name,
  );

  if (eventMatch) {
    return {
      source: "Event Hub",
      name: eventMatch.organisationName,
      id: eventMatch.id,
    };
  }

  const moneyMatch = moneySuppliers.find(
    (supplier) =>
      normaliseMatchValue(supplier.supplier_name) ===
      name,
  );

  if (moneyMatch) {
    return {
      source: "Money Management",
      name: moneyMatch.supplier_name,
      id: moneyMatch.id,
    };
  }

  return null;
}



async function requestJson<T>(
  endpoint: string,
  options: RequestInit,
  fallbackMessage: string,
): Promise<T> {
  const response = await fetch(endpoint, {
    credentials: "include",
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...(options.headers || {}),
    },
  });

  const raw = await response.text();
  let payload: Record<string, unknown> = {};

  if (raw) {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw new Error(
        [
          fallbackMessage,
          `HTTP ${response.status}`,
          `Endpoint: ${endpoint}`,
          `Non-JSON response: ${raw.slice(0, 800)}`,
        ].join("\n"),
      );
    }
  }

  if (!response.ok || payload.ok === false) {
    throw new Error(
      [
        String(payload.error || fallbackMessage),
        payload.code ? `Code: ${String(payload.code)}` : "",
        payload.details ? `Details: ${String(payload.details)}` : "",
        payload.hint ? `Hint: ${String(payload.hint)}` : "",
        `HTTP ${response.status}`,
        `Endpoint: ${endpoint}`,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return payload as T;
}

function DetailValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.13em] text-white/35">
        {label}
      </p>
      <div className="mt-2 break-words text-sm font-bold text-white/75">
        {children}
      </div>
    </div>
  );
}

export default function StockSuppliersPage() {
  const [suppliers, setSuppliers] = useState<
    StockSupplierView[]
  >([]);
  const [eventContacts, setEventContacts] = useState<
    EventHubContactOption[]
  >([]);
  const [moneySuppliers, setMoneySuppliers] = useState<
    MoneySupplierOption[]
  >([]);
  const [moneySuppliersLoading, setMoneySuppliersLoading] =
    useState(false);
  const [moneySuppliersError, setMoneySuppliersError] =
    useState("");
  const [eventContactSearch, setEventContactSearch] =
    useState("");
  const [showAllEventContacts, setShowAllEventContacts] =
    useState(false);
  const [summary, setSummary] =
    useState<SupplierSummary>(EMPTY_SUMMARY);
  const [permissions, setPermissions] =
    useState<SupplierPermissions>(EMPTY_PERMISSIONS);

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [search, setSearch] = useState("");
  const [connectionFilter, setConnectionFilter] =
    useState<ConnectionFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState("all");
  const [useFilter, setUseFilter] = useState("all");
  const [showFilters, setShowFilters] =
    useState(false);
  const [selectedSupplier, setSelectedSupplier] =
    useState<StockSupplierView | null>(null);
  const [detailTab, setDetailTab] =
    useState<DetailTab>("overview");
  const [workspace, setWorkspace] =
    useState<SupplierWorkspace>(EMPTY_WORKSPACE);
  const [workspaceLoading, setWorkspaceLoading] =
    useState(false);
  const [workspaceError, setWorkspaceError] =
    useState("");
  const [workspaceNotice, setWorkspaceNotice] =
    useState("");
  const [workspaceSaving, setWorkspaceSaving] =
    useState(false);

  const [profileEdit, setProfileEdit] =
    useState<ProfileEditState | null>(null);
  const [orderForm, setOrderForm] =
    useState<OrderFormState>(EMPTY_ORDER_FORM);
  const [reviewForm, setReviewForm] =
    useState<ReviewFormState>(EMPTY_REVIEW_FORM);
  const [complianceForm, setComplianceForm] =
    useState<ComplianceFormState>(EMPTY_COMPLIANCE_FORM);
  const [itemLinkForm, setItemLinkForm] = useState({
    stockItemId: "",
    stockItemName: "",
    supplierRole: "preferred" as "preferred" | "alternative",
    supplierSku: "",
    unitCost: "",
    minimumOrderQuantity: "",
    leadTimeDays: "",
  });
  const [mergeTargetId, setMergeTargetId] =
    useState("");
  const [overrideReason, setOverrideReason] =
    useState("");
  const [overrideExpiresAt, setOverrideExpiresAt] =
    useState("");

  const [showAllMoneySuppliers, setShowAllMoneySuppliers] =
    useState(false);
  const [moneySupplierSearch, setMoneySupplierSearch] =
    useState("");

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] =
    useState<SupplierFormState>(EMPTY_FORM);

  const loadMoneySuppliers = useCallback(async () => {
    setMoneySuppliersLoading(true);
    setMoneySuppliersError("");

    try {
      const response = await fetch(MONEY_SUPPLIERS_API, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const raw = await response.text();
      let payload: MoneySuppliersResponse = {};

      if (raw) {
        try {
          payload = JSON.parse(raw) as MoneySuppliersResponse;
        } catch {
          throw new Error(
            [
              "Money Management returned invalid JSON.",
              `HTTP ${response.status}`,
              `Endpoint: ${MONEY_SUPPLIERS_API}`,
              `Response: ${raw.slice(0, 500)}`,
            ].join("\n"),
          );
        }
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(
          [
            payload.error ||
              "Money Management suppliers could not be loaded.",
            payload.code ? `Code: ${payload.code}` : "",
            payload.details ? `Details: ${payload.details}` : "",
            `HTTP ${response.status}`,
            `Endpoint: ${MONEY_SUPPLIERS_API}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      setMoneySuppliers(
        Array.isArray(payload.suppliers)
          ? payload.suppliers
          : [],
      );
    } catch (loadError) {
      setMoneySuppliers([]);
      setMoneySuppliersError(
        formatErrorForDisplay(loadError),
      );
    } finally {
      setMoneySuppliersLoading(false);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(API, {
        cache: "no-store",
        credentials: "include",
      });

      const json =
        (await response
          .json()
          .catch(() => ({}))) as SupplierListResponse;

      if (!response.ok || !json.ok) {
        throw await readApiError(
          response,
          json.error || "Failed to load Stock Management suppliers.",
        );
      }

      const rows = Array.isArray(json.suppliers)
        ? json.suppliers
        : [];

      setSuppliers(rows);
      setEventContacts(
        Array.isArray(json.eventContacts)
          ? json.eventContacts
          : [],
      );
      setSummary({
        ...buildSummary(rows),
        ...(json.summary || {}),
      });
      setPermissions({
        ...EMPTY_PERMISSIONS,
        ...(json.permissions || {}),
      });
    } catch (loadError) {
      setError(formatErrorForDisplay(loadError));
      setSuppliers([]);
      setEventContacts([]);
      setSummary(EMPTY_SUMMARY);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.all([
      loadSuppliers(),
      loadMoneySuppliers(),
    ]);
  }, [loadMoneySuppliers, loadSuppliers]);

  const filteredEventContacts = useMemo(() => {
    const query = eventContactSearch.trim().toLowerCase();

    const matching = eventContacts.filter((contact) => {
      if (!query) return true;

      return [
        contact.organisationName,
        contact.contactName,
        contact.email,
        contact.phone,
        contact.website,
        contact.recordType,
        contact.rating,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return showAllEventContacts
      ? matching
      : matching.slice(0, 12);
  }, [
    eventContactSearch,
    eventContacts,
    showAllEventContacts,
  ]);

  const filteredMoneySuppliers = useMemo(() => {
    const query = moneySupplierSearch.trim().toLowerCase();

    const matching = moneySuppliers.filter((supplier) => {
      if (!query) return true;

      return [
        supplier.supplier_name,
        supplier.contact_name,
        supplier.email,
        supplier.phone,
        supplier.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

    return showAllMoneySuppliers
      ? matching
      : matching.slice(0, 12);
  }, [
    moneySupplierSearch,
    moneySuppliers,
    showAllMoneySuppliers,
  ]);

  const possibleDuplicate = useMemo(
    () =>
      calculatePossibleDuplicate(
        form,
        suppliers,
        eventContacts,
        moneySuppliers,
      ),
    [
      eventContacts,
      form,
      moneySuppliers,
      suppliers,
    ],
  );

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const searchable = [
        supplier.displayName,
        supplier.eventHub.contactName,
        supplier.eventHub.email,
        supplier.eventHub.phone,
        supplier.moneyManagement.supplierName,
        supplier.moneyManagement.accountReference,
        supplier.stockNotes,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (query && !searchable.includes(query)) {
        return false;
      }

      if (connectionFilter === "event_connected") {
        if (!supplier.eventHub.connected) return false;
      }

      if (connectionFilter === "money_connected") {
        if (!supplier.moneyManagement.connected) return false;
      }

      if (connectionFilter === "fully_connected") {
        if (
          !supplier.eventHub.connected ||
          !supplier.moneyManagement.connected
        ) {
          return false;
        }
      }

      if (connectionFilter === "missing_event") {
        if (supplier.eventHub.connected) return false;
      }

      if (connectionFilter === "missing_money") {
        if (supplier.moneyManagement.connected) return false;
      }

      if (connectionFilter === "stock_only") {
        if (
          supplier.eventHub.connected ||
          supplier.moneyManagement.connected
        ) {
          return false;
        }
      }

      if (connectionFilter === "main_event") {
        if (!supplier.eventHub.lastEvent) return false;
      }

      if (connectionFilter === "do_not_invite") {
        if (!supplier.eventHub.doNotInvite) return false;
      }

      if (connectionFilter === "do_not_use") {
        if (
          !supplier.doNotUse &&
          !supplier.moneyManagement.doNotUse
        ) {
          return false;
        }
      }

      if (connectionFilter === "needs_review") {
        if (
          !supplier.needsReview &&
          !supplier.eventHub.requiresReview
        ) {
          return false;
        }
      }

      if (
        statusFilter !== "all" &&
        supplierStatus(supplier) !== statusFilter
      ) {
        return false;
      }

      if (
        useFilter !== "all" &&
        supplier.supplierUse !== useFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    connectionFilter,
    search,
    statusFilter,
    suppliers,
    useFilter,
  ]);

  function useEventContactAsSupplier(
    contact: EventHubContactOption,
  ) {
    setForm({
      ...EMPTY_FORM,
      displayName: contact.organisationName,
      supplierUse: "mixed",
      eventRecordType: contact.recordType,
      eventRecordId: contact.id,
      stockNotes: contact.doNotInvite
        ? "Event Hub warning: this contact is marked Do not invite. Review before ordering."
        : contact.needsReview
          ? "Event Hub warning: this contact requires review."
          : "",
    });
    setAddOpen(true);
    setNotice("");
  }

  function useMoneySupplierAsStockSupplier(
    supplier: MoneySupplierOption,
  ) {
    setForm({
      ...EMPTY_FORM,
      displayName: supplier.supplier_name,
      supplierUse: "stock",
      moneySupplierId: supplier.id,
      stockNotes: supplier.category
        ? `Money Management category: ${supplier.category}`
        : "",
    });
    setAddOpen(true);
    setNotice("");
  }

  function selectEventContact(
    contactId: string,
  ) {
    if (!contactId) {
      setForm((current) => ({
        ...current,
        eventRecordId: "",
        eventRecordType: "",
      }));
      return;
    }

    const selected = eventContacts.find(
      (contact) => contact.id === contactId,
    );

    setForm((current) => ({
      ...current,
      eventRecordId: selected?.id || "",
      eventRecordType:
        selected?.recordType || "",
      displayName:
        current.displayName ||
        selected?.organisationName ||
        "",
      stockNotes:
        current.stockNotes ||
        (selected?.doNotInvite
          ? "Event Hub warning: this contact is marked Do not invite. Review before ordering."
          : selected?.needsReview
            ? "Event Hub warning: this contact requires review."
            : ""),
    }));
  }

  function selectMoneySupplier(
    supplierId: string,
  ) {
    const selected = moneySuppliers.find(
      (supplier) => supplier.id === supplierId,
    );

    setForm((current) => ({
      ...current,
      moneySupplierId: selected?.id || "",
      displayName:
        current.displayName ||
        selected?.supplier_name ||
        "",
    }));
  }

  const loadSupplierWorkspace = useCallback(
    async (supplier: StockSupplierView) => {
      setWorkspaceLoading(true);
      setWorkspaceError("");
      setWorkspaceNotice("");

      try {
        const payload = await requestJson<WorkspaceResponse>(
          `${API}/${supplier.id}/workspace`,
          {
            method: "GET",
            cache: "no-store",
          },
          "The supplier management workspace could not be loaded.",
        );

        const loaded: SupplierWorkspace = {
          ...EMPTY_WORKSPACE,
          ...(payload.workspace || {}),
          compliance: {
            ...EMPTY_WORKSPACE.compliance,
            ...(payload.workspace?.compliance || {}),
          },
          organisation: {
            ...EMPTY_WORKSPACE.organisation,
            ...(payload.workspace?.organisation || {}),
          },
        };

        setWorkspace(loaded);
        setProfileEdit({
          displayName: supplier.displayName,
          supplierUse: supplier.supplierUse,
          usualDeliveryDays: String(
            supplier.usualDeliveryDays ?? "",
          ),
          minimumOrderValue:
            supplier.minimumOrderValuePence === null ||
            supplier.minimumOrderValuePence === undefined
              ? ""
              : String(
                  supplier.minimumOrderValuePence / 100,
                ),
          usualDeliveryCost:
            supplier.usualDeliveryCostPence === null ||
            supplier.usualDeliveryCostPence === undefined
              ? ""
              : String(
                  supplier.usualDeliveryCostPence / 100,
                ),
          stockNotes: supplier.stockNotes || "",
          isActive: supplier.isActive,
          needsReview: supplier.needsReview,
          doNotUse: supplier.doNotUse,
        });
        setComplianceForm({
          publicLiabilityStatus:
            loaded.compliance.publicLiabilityStatus,
          publicLiabilityExpiry:
            loaded.compliance.publicLiabilityExpiry || "",
          insuranceDocumentUrl:
            loaded.compliance.insuranceDocumentUrl || "",
          foodHygieneStatus:
            loaded.compliance.foodHygieneStatus,
          foodHygieneRating:
            loaded.compliance.foodHygieneRating || "",
          foodHygieneAuthority:
            loaded.compliance.foodHygieneAuthority || "",
          foodHygieneCheckedAt:
            loaded.compliance.foodHygieneCheckedAt || "",
        });
      } catch (workspaceLoadError) {
        setWorkspace(EMPTY_WORKSPACE);
        setWorkspaceError(
          formatErrorForDisplay(workspaceLoadError),
        );
      } finally {
        setWorkspaceLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedSupplier) {
      void loadSupplierWorkspace(selectedSupplier);
    } else {
      setWorkspace(EMPTY_WORKSPACE);
      setWorkspaceError("");
      setWorkspaceNotice("");
      setProfileEdit(null);
    }
  }, [loadSupplierWorkspace, selectedSupplier]);

  async function runWorkspaceAction(
    endpoint: string,
    method: "POST" | "PATCH" | "DELETE",
    body: Record<string, unknown>,
    successMessage: string,
  ) {
    if (!selectedSupplier) return;

    setWorkspaceSaving(true);
    setWorkspaceError("");
    setWorkspaceNotice("");

    try {
      await requestJson<Record<string, unknown>>(
        endpoint,
        {
          method,
          body: JSON.stringify(body),
        },
        successMessage,
      );

      setWorkspaceNotice(successMessage);
      await Promise.all([
        loadSupplierWorkspace(selectedSupplier),
        loadSuppliers(),
        loadMoneySuppliers(),
      ]);
    } catch (actionError) {
      setWorkspaceError(
        formatErrorForDisplay(actionError),
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function saveProfileChanges() {
    if (!selectedSupplier || !profileEdit) return;

    await runWorkspaceAction(
      `${API}/${selectedSupplier.id}`,
      "PATCH",
      {
        display_name: profileEdit.displayName.trim(),
        supplier_use: profileEdit.supplierUse,
        usual_delivery_days:
          profileEdit.usualDeliveryDays
            ? Number(profileEdit.usualDeliveryDays)
            : null,
        minimum_order_value_pence:
          profileEdit.minimumOrderValue
            ? parsePoundsToPence(
                profileEdit.minimumOrderValue,
              )
            : null,
        usual_delivery_cost_pence:
          profileEdit.usualDeliveryCost
            ? parsePoundsToPence(
                profileEdit.usualDeliveryCost,
              )
            : null,
        stock_notes:
          profileEdit.stockNotes.trim() || null,
        is_active: profileEdit.isActive,
        needs_review: profileEdit.needsReview,
        do_not_use: profileEdit.doNotUse,
      },
      "The Stock Management supplier profile was updated.",
    );
  }

  async function saveOrder() {
    if (!selectedSupplier) return;

    const endpoint = orderForm.orderId
      ? `${API}/${selectedSupplier.id}/orders/${orderForm.orderId}`
      : `${API}/${selectedSupplier.id}/orders`;

    await runWorkspaceAction(
      endpoint,
      orderForm.orderId ? "PATCH" : "POST",
      {
        order_number:
          orderForm.orderNumber.trim() || null,
        status: orderForm.status,
        order_date: orderForm.orderDate || null,
        expected_delivery_date:
          orderForm.expectedDeliveryDate || null,
        estimated_total_pence:
          orderForm.estimatedTotal
            ? parsePoundsToPence(
                orderForm.estimatedTotal,
              )
            : 0,
        actual_total_pence:
          orderForm.actualTotal
            ? parsePoundsToPence(
                orderForm.actualTotal,
              )
            : 0,
        received_quantity: Number(
          orderForm.receivedQuantity || 0,
        ),
        missing_quantity: Number(
          orderForm.missingQuantity || 0,
        ),
        damaged_quantity: Number(
          orderForm.damagedQuantity || 0,
        ),
        refund_required:
          orderForm.refundRequired,
        replacement_required:
          orderForm.replacementRequired,
        notes: orderForm.notes.trim() || null,
      },
      orderForm.orderId
        ? "The purchase order was updated."
        : "The purchase order was created.",
    );

    setOrderForm(EMPTY_ORDER_FORM);
  }

  async function saveReview() {
    if (!selectedSupplier) return;

    await runWorkspaceAction(
      `${API}/${selectedSupplier.id}/reviews`,
      "POST",
      {
        rating: reviewForm.rating,
        delivery_rating:
          reviewForm.deliveryRating
            ? Number(reviewForm.deliveryRating)
            : null,
        quality_rating:
          reviewForm.qualityRating
            ? Number(reviewForm.qualityRating)
            : null,
        communication_rating:
          reviewForm.communicationRating
            ? Number(
                reviewForm.communicationRating,
              )
            : null,
        value_rating:
          reviewForm.valueRating
            ? Number(reviewForm.valueRating)
            : null,
        notes: reviewForm.notes.trim() || null,
      },
      "The supplier review was added.",
    );

    setReviewForm(EMPTY_REVIEW_FORM);
  }

  async function saveCompliance() {
    if (!selectedSupplier) return;

    await runWorkspaceAction(
      `${API}/${selectedSupplier.id}/compliance`,
      "PATCH",
      {
        public_liability_status:
          complianceForm.publicLiabilityStatus,
        public_liability_expiry:
          complianceForm.publicLiabilityExpiry || null,
        insurance_document_url:
          complianceForm.insuranceDocumentUrl.trim() ||
          null,
        food_hygiene_status:
          complianceForm.foodHygieneStatus,
        food_hygiene_rating:
          complianceForm.foodHygieneRating.trim() ||
          null,
        food_hygiene_authority:
          complianceForm.foodHygieneAuthority.trim() ||
          null,
        food_hygiene_checked_at:
          complianceForm.foodHygieneCheckedAt || null,
      },
      "Supplier insurance and food-hygiene details were updated.",
    );
  }

  async function exportFullSupplierWorkbook() {
    if (!selectedSupplier) return;

    setWorkspaceSaving(true);
    setWorkspaceError("");

    try {
      const response = await fetch(
        `${API}/${selectedSupplier.id}/export`,
        {
          method: "POST",
          credentials: "include",
        },
      );

      if (!response.ok) {
        throw await readApiError(
          response,
          "The full supplier workbook could not be created.",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `${selectedSupplier.displayName
        .replace(/[^a-z0-9]+/gi, "-")
        .toLowerCase()}-supplier-workbook.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setWorkspaceNotice(
        "The multi-sheet supplier workbook was downloaded.",
      );
    } catch (exportError) {
      setWorkspaceError(
        formatErrorForDisplay(exportError),
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  async function createSupplier(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (form.displayName.trim().length < 2) {
      setNotice(
        "Enter a supplier or organisation name of at least two characters.",
      );
      return;
    }

    const minimumOrderValuePence = form.minimumOrderValue
      ? parsePoundsToPence(form.minimumOrderValue)
      : null;

    const usualDeliveryCostPence = form.usualDeliveryCost
      ? parsePoundsToPence(form.usualDeliveryCost)
      : null;

    if (
      form.minimumOrderValue &&
      minimumOrderValuePence === null
    ) {
      setNotice(
        "The minimum order value must be a valid positive amount.",
      );
      return;
    }

    if (
      form.usualDeliveryCost &&
      usualDeliveryCostPence === null
    ) {
      setNotice(
        "The usual delivery cost must be a valid positive amount.",
      );
      return;
    }

    setCreating(true);
    setNotice("");

    try {
      const response = await fetch(API, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          display_name: form.displayName.trim(),
          supplier_use: form.supplierUse,
          usual_delivery_days: form.usualDeliveryDays
            ? Number(form.usualDeliveryDays)
            : null,
          minimum_order_value_pence:
            minimumOrderValuePence,
          usual_delivery_cost_pence:
            usualDeliveryCostPence,
          stock_notes: form.stockNotes.trim() || null,
          event_record_type:
            form.eventRecordType.trim() || null,
          event_record_id:
            form.eventRecordId.trim() || null,
          money_supplier_id:
            form.moneySupplierId.trim() || null,
        }),
      });

      const json = (await response
        .json()
        .catch(() => ({}))) as ApiErrorPayload;

      if (!response.ok || !json.ok) {
        throw await readApiError(
          response,
          json.error || "Supplier creation failed.",
        );
      }

      setAddOpen(false);
      setForm(EMPTY_FORM);
      setNotice(
        "The Stock Management supplier profile has been created.",
      );

      await loadSuppliers();
    } catch (createError) {
      setNotice(formatErrorForDisplay(createError));
    } finally {
      setCreating(false);
    }
  }

  async function exportSuppliers() {
    setExporting(true);
    setNotice("");

    try {
      const response = await fetch(`${API}/export`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          search,
          connection: connectionFilter,
          status: statusFilter,
          supplier_use: useFilter,
        }),
      });

      if (!response.ok) {
        throw await readApiError(
          response,
          "Supplier export failed.",
        );
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      link.href = url;
      link.download = `burton-pride-stock-suppliers-${new Date()
        .toISOString()
        .slice(0, 10)}.xlsx`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setNotice(
        "The connected supplier Excel workbook has been created.",
      );
    } catch (exportError) {
      setNotice(formatErrorForDisplay(exportError));
    } finally {
      setExporting(false);
    }
  }

  function printReport() {
    window.print();
  }

  return (
    <div className="min-h-full w-full bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.14),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.13),_transparent_28%),linear-gradient(180deg,#100918_0%,#1a1127_52%,#0f172a_100%)] p-3 text-white sm:p-5 lg:p-6">
      <div className="w-full max-w-none space-y-5">
        <header className="rounded-[30px] border border-white/10 bg-white/[0.065] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
          <div className="flex flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-300/20 bg-pink-500/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-pink-100">
                <Boxes className="h-4 w-4" />
                Burton Pride Stock Management
              </div>

              <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
                Stock Suppliers
              </h1>

              <p className="mt-2 max-w-5xl text-sm leading-6 text-white/60">
                View the businesses, organisations and people
                who supply Burton Pride with stock, equipment
                and event services. This page connects Event Hub
                contact records with Money Management supplier
                and payment records.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 print:hidden">
              {permissions.create ? (
                <button
                  type="button"
                  onClick={() => {
                    setForm(EMPTY_FORM);
                    setAddOpen(true);
                    void loadMoneySuppliers();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200"
                >
                  <Plus className="h-4 w-4" />
                  Add supplier
                </button>
              ) : null}

              <Link
                href="/Admin/BurtonPrideEventHub/Contacts"
                className="inline-flex items-center gap-2 rounded-xl border border-pink-300/20 bg-pink-500/10 px-4 py-2.5 text-sm font-black text-pink-100 hover:bg-pink-500/20"
              >
                <Users className="h-4 w-4" />
                Event Hub contacts
              </Link>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney/Suppliers"
                className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
              >
                <CircleDollarSign className="h-4 w-4" />
                Money suppliers
              </Link>

              <button
                type="button"
                onClick={() =>
                  void Promise.all([
                    loadSuppliers(),
                    loadMoneySuppliers(),
                  ])
                }
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white/75 hover:bg-white/10 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading ? "animate-spin" : ""
                  }`}
                />
                Refresh
              </button>

              {permissions.export ? (
                <button
                  type="button"
                  onClick={() => void exportSuppliers()}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 py-2.5 text-sm font-black text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                >
                  {exporting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileSpreadsheet className="h-4 w-4" />
                  )}
                  Export Excel
                </button>
              ) : null}

              <button
                type="button"
                onClick={printReport}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 py-2.5 text-sm font-black text-white/75 hover:bg-white/10"
              >
                <Printer className="h-4 w-4" />
                Print
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <div className="rounded-2xl border border-pink-300/20 bg-pink-500/10 p-4">
              <div className="flex items-center gap-2 font-black text-pink-100">
                <Users className="h-5 w-5" />
                Event Hub connection
              </div>
              <p className="mt-2 text-sm leading-6 text-pink-50/65">
                Event Hub owns the main event relationship,
                contact history, applications, event documents,
                ratings and do-not-invite warnings.
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4">
              <div className="flex items-center gap-2 font-black text-emerald-100">
                <CircleDollarSign className="h-5 w-5" />
                Money Management connection
              </div>
              <p className="mt-2 text-sm leading-6 text-emerald-50/65">
                Money Management owns supplier finances,
                payments, invoices, receipts, refunds and bank
                reconciliation.
              </p>
            </div>

            <div className="rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-4">
              <div className="flex items-center gap-2 font-black text-cyan-100">
                <Boxes className="h-5 w-5" />
                Stock Management connection
              </div>
              <p className="mt-2 text-sm leading-6 text-cyan-50/65">
                Stock Management owns inventory links, purchase
                orders, deliveries, lead times and supplier
                performance.
              </p>
            </div>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
          <SummaryCard
            label="Active suppliers"
            value={summary.activeSuppliers}
            icon={Building2}
            classes="border-violet-300/20 bg-violet-500/10 text-violet-100"
          />
          <SummaryCard
            label="Event Hub connected"
            value={summary.connectedToEventHub}
            icon={Users}
            classes="border-pink-300/20 bg-pink-500/10 text-pink-100"
          />
          <SummaryCard
            label="Money connected"
            value={summary.connectedToMoneyManagement}
            icon={CircleDollarSign}
            classes="border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
          />
          <SummaryCard
            label="Fully connected"
            value={summary.fullyConnected}
            icon={Link2}
            classes="border-cyan-300/20 bg-cyan-500/10 text-cyan-100"
          />
          <SummaryCard
            label="Open orders"
            value={summary.openOrders}
            icon={ShoppingCart}
            classes="border-sky-300/20 bg-sky-500/10 text-sky-100"
          />
          <SummaryCard
            label="Overdue deliveries"
            value={summary.overdueDeliveries}
            icon={TriangleAlert}
            classes="border-orange-300/20 bg-orange-500/10 text-orange-100"
          />
          <SummaryCard
            label="Blocked or warned"
            value={summary.blockedOrDoNotUse}
            icon={ShieldAlert}
            classes="border-red-300/20 bg-red-500/10 text-red-100"
          />
          <SummaryCard
            label="Missing connections"
            value={summary.missingConnections}
            icon={Unlink}
            classes="border-amber-300/20 bg-amber-500/10 text-amber-100"
          />
        </section>

        {notice ? (
          <div
            className="flex items-start justify-between gap-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50"
            aria-live="polite"
          >
            <span className="whitespace-pre-wrap break-words">{notice}</span>
            <button
              type="button"
              onClick={() => setNotice("")}
              aria-label="Close notice"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}

        <section className="rounded-[28px] border border-white/10 bg-white/[0.055] p-4 shadow-xl backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="flex min-h-12 min-w-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black/25 focus-within:border-cyan-300/40">
              <Search className="ml-3 mt-3.5 h-5 w-5 shrink-0 text-white/35" />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search supplier, contact, email, account reference or notes..."
                className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-white outline-none placeholder:text-white/30"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="p-3 text-white/40 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() =>
                setShowFilters((value) => !value)
              }
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white/75 hover:bg-white/10"
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>

            <Link
              href="/Admin/StockManagement/Orders/New"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
            >
              <PackagePlus className="h-4 w-4" />
              Create stock order
            </Link>
          </div>

          {showFilters ? (
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-3">
              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Connections
                </span>
                <select
                  value={connectionFilter}
                  onChange={(event) =>
                    setConnectionFilter(
                      event.target.value as ConnectionFilter,
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                >
                  <option value="all">All suppliers</option>
                  <option value="event_connected">
                    Event Hub connected
                  </option>
                  <option value="money_connected">
                    Money Management connected
                  </option>
                  <option value="fully_connected">
                    Fully connected
                  </option>
                  <option value="missing_event">
                    Missing Event Hub link
                  </option>
                  <option value="missing_money">
                    Missing Money link
                  </option>
                  <option value="stock_only">
                    Stock only
                  </option>
                  <option value="main_event">
                    Used for main event
                  </option>
                  <option value="do_not_invite">
                    Event Hub: do not invite
                  </option>
                  <option value="do_not_use">
                    Money/Stock: do not use
                  </option>
                  <option value="needs_review">
                    Needs review
                  </option>
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                >
                  <option value="all">All statuses</option>
                  <option value="active">Active</option>
                  <option value="review">Needs review</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Supplier use
                </span>
                <select
                  value={useFilter}
                  onChange={(event) =>
                    setUseFilter(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                >
                  <option value="all">All uses</option>
                  <option value="stock">Stock</option>
                  <option value="service">Service</option>
                  <option value="event_trader">
                    Event trader
                  </option>
                  <option value="performer">Performer</option>
                  <option value="venue">Venue</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>
            </div>
          ) : null}
        </section>

        <section className="overflow-hidden rounded-[28px] border border-pink-300/15 bg-white/[0.055] shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <ContactRound className="h-5 w-5 text-pink-200" />
                Event Hub contact list
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/45">
                These are the saved contacts from the Event Hub contact pages.
                Select a contact to create or connect a Stock Management supplier
                profile without typing the organisation details again.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row print:hidden">
              <div className="flex min-h-11 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 focus-within:border-pink-300/40 sm:min-w-[320px]">
                <Search className="ml-3 mt-3 h-4 w-4 shrink-0 text-white/35" />
                <input
                  value={eventContactSearch}
                  onChange={(event) =>
                    setEventContactSearch(event.target.value)
                  }
                  placeholder="Search Event Hub contacts..."
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-white outline-none placeholder:text-white/30"
                />
                {eventContactSearch ? (
                  <button
                    type="button"
                    onClick={() => setEventContactSearch("")}
                    className="p-3 text-white/40 hover:text-white"
                    aria-label="Clear Event Hub contact search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <Link
                href="/Admin/EventHub/Contacts"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-pink-300/20 bg-pink-500/10 px-4 text-sm font-black text-pink-100 hover:bg-pink-500/20"
              >
                Open full contact page
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-44 items-center justify-center gap-3 text-white/55">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Event Hub contacts...
            </div>
          ) : eventContacts.length === 0 ? (
            <div className="flex min-h-44 flex-col items-center justify-center p-6 text-center">
              <Users className="h-9 w-9 text-white/20" />
              <h3 className="mt-3 font-black">
                No Event Hub contacts were returned
              </h3>
              <p className="mt-1 max-w-2xl text-sm text-white/45">
                Add contacts in Event Hub first, or check the integration warning
                returned by the Stock Suppliers API.
              </p>
            </div>
          ) : filteredEventContacts.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center p-6 text-sm font-semibold text-white/45">
              No Event Hub contacts match this search.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredEventContacts.map((contact) => (
                  <article
                    key={`${contact.recordType}-${contact.id}`}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-black text-white">
                          {contact.organisationName}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-pink-100/70">
                          {formatLabel(contact.recordType)}
                        </p>
                      </div>

                      {contact.linkedStockSupplierId ? (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-emerald-300/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-black text-emerald-100">
                          <CheckCircle2 className="h-3 w-3" />
                          Linked
                        </span>
                      ) : (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-amber-300/20 bg-amber-500/10 px-2 py-1 text-[10px] font-black text-amber-100">
                          <Unlink className="h-3 w-3" />
                          Not linked
                        </span>
                      )}
                    </div>

                    <div className="mt-3 space-y-1.5 text-xs text-white/55">
                      <p>
                        <span className="font-black text-white/70">
                          Contact:
                        </span>{" "}
                        {contact.contactName || "Not recorded"}
                      </p>
                      <p className="break-all">
                        <span className="font-black text-white/70">
                          Email:
                        </span>{" "}
                        {contact.email || "Not recorded"}
                      </p>
                      <p>
                        <span className="font-black text-white/70">
                          Phone:
                        </span>{" "}
                        {contact.phone || "Not recorded"}
                      </p>
                    </div>

                    {contact.doNotInvite || contact.needsReview ? (
                      <div className="mt-3 rounded-xl border border-red-300/15 bg-red-500/10 p-2.5 text-xs font-bold text-red-100">
                        {contact.doNotInvite
                          ? "Warning: marked Do not invite in Event Hub."
                          : "Warning: this Event Hub relationship needs review."}
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                      {contact.linkedStockSupplierId ? (
                        <Link
                          href={`/Admin/StockManagement/Suppliers/${contact.linkedStockSupplierId}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
                        >
                          Open linked supplier
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                      ) : permissions.create ? (
                        <button
                          type="button"
                          onClick={() =>
                            useEventContactAsSupplier(contact)
                          }
                          className="inline-flex items-center gap-1.5 rounded-xl bg-pink-200 px-3 py-2 text-xs font-black text-pink-950 hover:bg-pink-100"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          Use as supplier
                        </button>
                      ) : null}

                      <Link
                        href={`/Admin/EventHub/Contacts?contact_id=${contact.id}`}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/65 hover:bg-white/10"
                      >
                        Event Hub record
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>

              {eventContacts.length > 12 ? (
                <div className="border-t border-white/10 px-5 py-3 text-center print:hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllEventContacts((value) => !value)
                    }
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-white/65 hover:bg-white/10"
                  >
                    {showAllEventContacts
                      ? "Show fewer contacts"
                      : `Show all ${eventContacts.length} contacts`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-[28px] border border-emerald-300/15 bg-white/[0.055] shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="flex items-center gap-2 text-lg font-black">
                <CircleDollarSign className="h-5 w-5 text-emerald-200" />
                Money Management supplier list
              </h2>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Choose an existing financial supplier to create a Stock
                Management profile without re-entering supplier details.
                Payments, invoices and reconciliation remain owned by Money
                Management.
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row print:hidden">
              <div className="flex min-h-11 min-w-0 overflow-hidden rounded-xl border border-white/10 bg-black/25 focus-within:border-emerald-300/40 sm:min-w-[320px]">
                <Search className="ml-3 mt-3 h-4 w-4 shrink-0 text-white/35" />
                <input
                  value={moneySupplierSearch}
                  onChange={(event) =>
                    setMoneySupplierSearch(event.target.value)
                  }
                  placeholder="Search Money suppliers..."
                  className="min-w-0 flex-1 bg-transparent px-3 text-sm font-semibold text-white outline-none placeholder:text-white/30"
                />
                {moneySupplierSearch ? (
                  <button
                    type="button"
                    onClick={() => setMoneySupplierSearch("")}
                    className="p-3 text-white/40 hover:text-white"
                    aria-label="Clear Money supplier search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                ) : null}
              </div>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney/Suppliers"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-4 text-sm font-black text-emerald-100 hover:bg-emerald-500/20"
              >
                Open full Money supplier page
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </div>

          {moneySuppliersLoading ? (
            <div className="flex min-h-44 items-center justify-center gap-3 text-white/55">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading Money Management suppliers...
            </div>
          ) : moneySuppliersError ? (
            <pre className="m-4 whitespace-pre-wrap break-words rounded-xl border border-amber-300/15 bg-amber-500/10 p-4 text-xs leading-5 text-amber-100">
              {moneySuppliersError}
            </pre>
          ) : filteredMoneySuppliers.length === 0 ? (
            <div className="flex min-h-40 items-center justify-center p-6 text-sm font-semibold text-white/45">
              No Money Management suppliers match this search.
            </div>
          ) : (
            <>
              <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filteredMoneySuppliers.map((supplier) => {
                  const linked = suppliers.some(
                    (item) =>
                      item.moneyManagement.supplierId ===
                      supplier.id,
                  );

                  return (
                    <article
                      key={supplier.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="truncate font-black text-white">
                            {supplier.supplier_name}
                          </h3>
                          <p className="mt-1 text-xs text-white/45">
                            {supplier.category || "No financial category"}
                          </p>
                        </div>

                        <span
                          className={`inline-flex shrink-0 rounded-full border px-2 py-1 text-[10px] font-black ${
                            linked
                              ? "border-emerald-300/20 bg-emerald-500/10 text-emerald-100"
                              : "border-amber-300/20 bg-amber-500/10 text-amber-100"
                          }`}
                        >
                          {linked ? "Linked" : "Not linked"}
                        </span>
                      </div>

                      <div className="mt-3 space-y-1 text-xs text-white/55">
                        <p>
                          Contact: {supplier.contact_name || "Not recorded"}
                        </p>
                        <p className="break-all">
                          Email: {supplier.email || "Not recorded"}
                        </p>
                        <p>
                          Phone: {supplier.phone || "Not recorded"}
                        </p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                        {!linked && permissions.create ? (
                          <button
                            type="button"
                            onClick={() =>
                              useMoneySupplierAsStockSupplier(
                                supplier,
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-200 px-3 py-2 text-xs font-black text-emerald-950 hover:bg-emerald-100"
                          >
                            <Link2 className="h-3.5 w-3.5" />
                            Use as Stock supplier
                          </button>
                        ) : null}

                        <Link
                          href={`/Admin/MoneyManagement/TrackingMoney/Suppliers?search=${encodeURIComponent(
                            supplier.supplier_name,
                          )}`}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/65 hover:bg-white/10"
                        >
                          Money record
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>

              {moneySuppliers.length > 12 ? (
                <div className="border-t border-white/10 px-5 py-3 text-center print:hidden">
                  <button
                    type="button"
                    onClick={() =>
                      setShowAllMoneySuppliers((value) => !value)
                    }
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm font-black text-white/65 hover:bg-white/10"
                  >
                    {showAllMoneySuppliers
                      ? "Show fewer Money suppliers"
                      : `Show all ${moneySuppliers.length} Money suppliers`}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>

        <section className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.055] shadow-2xl backdrop-blur-xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-lg font-black">
                Connected suppliers
              </h2>
              <p className="mt-1 text-xs text-white/45">
                Showing {filteredSuppliers.length} of{" "}
                {suppliers.length} suppliers.
              </p>
            </div>

            <Download className="h-5 w-5 text-white/30" />
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-white/60">
              <Loader2 className="h-6 w-6 animate-spin" />
              Loading suppliers from all three apps...
            </div>
          ) : error ? (
            <div className="m-5 rounded-2xl border border-red-300/20 bg-red-500/10 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-100" />
                <div>
                  <p className="font-black text-red-50">
                    Suppliers could not be loaded
                  </p>
                  <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-red-300/10 bg-black/20 p-3 text-xs leading-5 text-red-50/75">
                    {error}
                  </pre>
                  <button
                    type="button"
                    onClick={() => void loadSuppliers()}
                    className="mt-4 rounded-xl bg-red-100 px-4 py-2 text-sm font-black text-red-950"
                  >
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center p-6 text-center">
              <Building2 className="h-10 w-10 text-white/25" />
              <h3 className="mt-3 text-lg font-black">
                No suppliers match these filters
              </h3>
              <p className="mt-1 max-w-xl text-sm text-white/45">
                Clear the filters, connect an existing Event Hub
                or Money Management record, or add a new Stock
                Management supplier profile.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[1500px] w-full border-collapse text-left">
                <thead className="bg-black/20 text-[10px] font-black uppercase tracking-[0.14em] text-white/45">
                  <tr>
                    <th className="px-5 py-3">Organisation</th>
                    <th className="px-4 py-3">Event Hub</th>
                    <th className="px-4 py-3">
                      Money Management
                    </th>
                    <th className="px-4 py-3">Stock items</th>
                    <th className="px-4 py-3">Open orders</th>
                    <th className="px-4 py-3">Last event</th>
                    <th className="px-4 py-3">Last order</th>
                    <th className="px-4 py-3">Money spent</th>
                    <th className="px-4 py-3">Performance</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-5 py-3 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {filteredSuppliers.map((supplier) => {
                    const status = supplierStatus(supplier);
                    const warnings = [
                      supplier.eventHub.doNotInvite
                        ? "Do not invite"
                        : null,
                      supplier.moneyManagement.doNotUse
                        ? "Financial do not use"
                        : null,
                      supplier.needsReview
                        ? "Needs review"
                        : null,
                      supplier.stockManagement
                        .overdueOrderCount > 0
                        ? `${supplier.stockManagement.overdueOrderCount} overdue`
                        : null,
                      supplier.moneyManagement
                        .missingReceiptCount > 0
                        ? `${supplier.moneyManagement.missingReceiptCount} missing receipt`
                        : null,
                    ].filter(Boolean);

                    return (
                      <tr
                        key={supplier.id}
                        className="align-top hover:bg-white/[0.035]"
                      >
                        <td className="px-5 py-4">
                          <Link
                            href={`/Admin/StockManagement/Suppliers/${supplier.id}`}
                            className="font-black text-white hover:text-cyan-200"
                          >
                            {supplier.displayName}
                          </Link>
                          <div className="mt-1 text-xs text-white/40">
                            {formatLabel(
                              supplier.supplierUse,
                            )}
                            {" · "}
                            {connectionHealthLabel(supplier)}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <ConnectionBadge
                            connected={
                              supplier.eventHub.connected
                            }
                            connectedText="Connected"
                            missingText="Not connected"
                          />
                          <p className="mt-2 max-w-52 text-xs text-white/55">
                            {supplier.eventHub.contactName ||
                              supplier.eventHub
                                .organisationName ||
                              "No Event Hub contact"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <ConnectionBadge
                            connected={
                              supplier.moneyManagement
                                .connected
                            }
                            connectedText="Connected"
                            missingText="Not connected"
                          />
                          <p className="mt-2 max-w-52 text-xs text-white/55">
                            {supplier.moneyManagement
                              .accountReference ||
                              supplier.moneyManagement
                                .supplierName ||
                              "No financial supplier"}
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-lg font-black">
                            {
                              supplier.stockManagement
                                .itemCount
                            }
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span className="text-lg font-black">
                            {
                              supplier.stockManagement
                                .openOrderCount
                            }
                          </span>
                          {supplier.stockManagement
                            .overdueOrderCount > 0 ? (
                            <p className="mt-1 text-xs font-bold text-orange-200">
                              {
                                supplier.stockManagement
                                  .overdueOrderCount
                              }{" "}
                              overdue
                            </p>
                          ) : null}
                        </td>

                        <td className="px-4 py-4 text-sm text-white/65">
                          {supplier.eventHub.lastEvent ||
                            "No event history"}
                        </td>

                        <td className="px-4 py-4 text-sm text-white/65">
                          {formatDate(
                            supplier.stockManagement
                              .lastOrderDate,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <p className="font-black text-emerald-100">
                            {formatMoney(
                              supplier.moneyManagement
                                .totalPaidPence,
                            )}
                          </p>
                          <p className="mt-1 text-xs text-white/40">
                            {
                              supplier.moneyManagement
                                .transactionCount
                            }{" "}
                            transactions
                          </p>
                        </td>

                        <td className="px-4 py-4">
                          {warnings.length > 0 ? (
                            <div className="space-y-1">
                              {warnings
                                .slice(0, 3)
                                .map((warning) => (
                                  <p
                                    key={String(warning)}
                                    className="text-xs font-bold text-amber-100"
                                  >
                                    {warning}
                                  </p>
                                ))}
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-200">
                              <PackageCheck className="h-4 w-4" />
                              No current warning
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-black ${statusClasses(
                              status,
                            )}`}
                          >
                            {formatLabel(status)}
                          </span>
                        </td>

                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplier(supplier);
                                setDetailTab("overview");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-black text-white/70 hover:bg-white/10"
                            >
                              View details
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>

                            {supplier.eventHub.connected &&
                            supplier.eventHub.recordId ? (
                              <Link
                                href={`/Admin/EventHub/Contacts/${supplier.eventHub.recordId}`}
                                className="rounded-xl border border-pink-300/20 bg-pink-500/10 p-2 text-pink-100 hover:bg-pink-500/20"
                                aria-label="Open Event Hub record"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                            ) : null}

                            {supplier.moneyManagement
                              .connected &&
                            supplier.moneyManagement
                              .supplierId ? (
                              <Link
                                href={`/Admin/MoneyManagement/Suppliers/${supplier.moneyManagement.supplierId}`}
                                className="rounded-xl border border-emerald-300/20 bg-emerald-500/10 p-2 text-emerald-100 hover:bg-emerald-500/20"
                                aria-label="Open Money Management supplier"
                              >
                                <CircleDollarSign className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {selectedSupplier ? (
        <div
          className="fixed inset-0 z-[115] flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Supplier details"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setSelectedSupplier(null)}
            aria-label="Close supplier details"
          />

          <div className="relative max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-[30px] border border-white/10 bg-[#171020] shadow-2xl">
            <div className="sticky top-0 z-10 border-b border-white/10 bg-[#171020]/95 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-200/70">
                    Combined supplier record
                  </p>
                  <h2 className="mt-1 text-2xl font-black">
                    {selectedSupplier.displayName}
                  </h2>
                  <p className="mt-1 text-sm text-white/50">
                    {formatLabel(selectedSupplier.supplierUse)} ·{" "}
                    {connectionHealthLabel(selectedSupplier)}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedSupplier(null)}
                  className="rounded-xl border border-white/10 p-2 hover:bg-white/10"
                  aria-label="Close supplier details"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {(
                  [
                    ["overview", "Overview"],
                    ["event", "Event Hub"],
                    ["money", "Money Management"],
                    ["stock", "Stock & item links"],
                    ["orders", "Orders & deliveries"],
                    ["history", "History & reviews"],
                    ["compliance", "Insurance & hygiene"],
                    ["admin", "Admin tools"],
                  ] as Array<[DetailTab, string]>
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDetailTab(value)}
                    className={`rounded-xl px-3 py-2 text-xs font-black ${
                      detailTab === value
                        ? "bg-cyan-300 text-slate-950"
                        : "border border-white/10 text-white/60 hover:bg-white/10"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 sm:p-6">
              {workspaceLoading ? (
                <div className="mb-5 flex items-center gap-3 rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading the complete supplier workspace...
                </div>
              ) : null}

              {workspaceError ? (
                <pre className="mb-5 whitespace-pre-wrap break-words rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-xs leading-5 text-red-100">
                  {workspaceError}
                </pre>
              ) : null}

              {workspaceNotice ? (
                <div className="mb-5 rounded-2xl border border-emerald-300/20 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
                  {workspaceNotice}
                </div>
              ) : null}
              {detailTab === "overview" ? (
                <div className="grid gap-4 lg:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-white/40">
                      Overall recommendation
                    </p>
                    <p className="mt-2 text-xl font-black">
                      {overallRecommendation(selectedSupplier)}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/55">
                      Event, financial and delivery information are shown
                      separately so one warning does not hide the rest of the
                      supplier record.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-pink-300/15 bg-pink-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-pink-100/60">
                      Event relationship
                    </p>
                    <p className="mt-2 font-black">
                      {selectedSupplier.eventHub.eventRating ||
                        "Not rated"}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {selectedSupplier.eventHub.lastEvent ||
                        "No event history recorded"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-emerald-100/60">
                      Financial record
                    </p>
                    <p className="mt-2 font-black">
                      {formatMoney(
                        selectedSupplier.moneyManagement
                          .totalPaidPence,
                      )}
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {
                        selectedSupplier.moneyManagement
                          .transactionCount
                      }{" "}
                      transactions
                    </p>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/10 p-4">
                    <p className="text-xs font-black uppercase tracking-wide text-cyan-100/60">
                      Stock relationship
                    </p>
                    <p className="mt-2 font-black">
                      {
                        selectedSupplier.stockManagement
                          .itemCount
                      }{" "}
                      linked items
                    </p>
                    <p className="mt-1 text-sm text-white/55">
                      {
                        selectedSupplier.stockManagement
                          .openOrderCount
                      }{" "}
                      open orders
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4 lg:col-span-2">
                    <p className="text-xs font-black uppercase tracking-wide text-white/40">
                      Stock notes
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/60">
                      {selectedSupplier.stockNotes ||
                        "No Stock Management notes recorded."}
                    </p>
                  </div>
                </div>
              ) : null}

              {detailTab === "event" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <DetailValue label="Connection">
                    {selectedSupplier.eventHub.connected
                      ? "Connected"
                      : "Not connected"}
                  </DetailValue>
                  <DetailValue label="Record type">
                    {selectedSupplier.eventHub.recordType
                      ? formatLabel(
                          selectedSupplier.eventHub.recordType,
                        )
                      : "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Organisation">
                    {selectedSupplier.eventHub.organisationName ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Contact">
                    {selectedSupplier.eventHub.contactName ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Email">
                    {selectedSupplier.eventHub.email ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Phone">
                    {selectedSupplier.eventHub.phone ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Last event">
                    {selectedSupplier.eventHub.lastEvent ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Event rating">
                    {selectedSupplier.eventHub.eventRating ||
                      "Not recorded"}
                  </DetailValue>

                  {selectedSupplier.eventHub.doNotInvite ? (
                    <div className="md:col-span-2 rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-black text-red-100">
                      Event Hub warning: this organisation is marked Do not
                      invite.
                    </div>
                  ) : null}
                </div>
              ) : null}

              {detailTab === "money" ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <DetailValue label="Connection">
                    {selectedSupplier.moneyManagement.connected
                      ? "Connected"
                      : "Not connected"}
                  </DetailValue>
                  <DetailValue label="Supplier">
                    {selectedSupplier.moneyManagement.supplierName ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Account reference">
                    {selectedSupplier.moneyManagement.accountReference ||
                      "Not recorded"}
                  </DetailValue>
                  <DetailValue label="Total paid">
                    {formatMoney(
                      selectedSupplier.moneyManagement
                        .totalPaidPence,
                    )}
                  </DetailValue>
                  <DetailValue label="Paid this year">
                    {formatMoney(
                      selectedSupplier.moneyManagement
                        .currentYearPaidPence,
                    )}
                  </DetailValue>
                  <DetailValue label="Transactions">
                    {
                      selectedSupplier.moneyManagement
                        .transactionCount
                    }
                  </DetailValue>
                  <DetailValue label="Missing receipts">
                    {
                      selectedSupplier.moneyManagement
                        .missingReceiptCount
                    }
                  </DetailValue>
                  <DetailValue label="Unreconciled">
                    {
                      selectedSupplier.moneyManagement
                        .unreconciledCount
                    }
                  </DetailValue>
                  <DetailValue label="Financial status">
                    {selectedSupplier.moneyManagement.doNotUse
                      ? "Do not use"
                      : "Available"}
                  </DetailValue>
                </div>
              ) : null}

              {detailTab === "stock" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <DetailValue label="Linked inventory items">
                      {
                        selectedSupplier.stockManagement
                          .itemCount
                      }
                    </DetailValue>
                    <DetailValue label="Open orders">
                      {
                        selectedSupplier.stockManagement
                          .openOrderCount
                      }
                    </DetailValue>
                    <DetailValue label="Overdue orders">
                      {
                        selectedSupplier.stockManagement
                          .overdueOrderCount
                      }
                    </DetailValue>
                    <DetailValue label="Last order">
                      {formatDate(
                        selectedSupplier.stockManagement
                          .lastOrderDate,
                      )}
                    </DetailValue>
                    <DetailValue label="Estimated spend">
                      {formatMoney(
                        selectedSupplier.stockManagement
                          .totalEstimatedSpendPence,
                      )}
                    </DetailValue>
                    <DetailValue label="Actual spend">
                      {formatMoney(
                        selectedSupplier.stockManagement
                          .totalActualSpendPence,
                      )}
                    </DetailValue>
                    <DetailValue label="Average delivery days">
                      {selectedSupplier.stockManagement
                        .averageDeliveryDays ?? "Not recorded"}
                    </DetailValue>
                    <DetailValue label="Usual delivery days">
                      {selectedSupplier.usualDeliveryDays ??
                        "Not recorded"}
                    </DetailValue>
                    <DetailValue label="Minimum order value">
                      {formatMoney(
                        selectedSupplier.minimumOrderValuePence,
                      )}
                    </DetailValue>
                  </div>

                  <div className="rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
                    <h3 className="font-black text-cyan-100">
                      Add preferred or alternative item supplier
                    </h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        value={itemLinkForm.stockItemId}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            stockItemId: event.target.value,
                          }))
                        }
                        placeholder="Stock item ID"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        value={itemLinkForm.stockItemName}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            stockItemName: event.target.value,
                          }))
                        }
                        placeholder="Stock item name"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <select
                        value={itemLinkForm.supplierRole}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            supplierRole: event.target.value as
                              | "preferred"
                              | "alternative",
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                      >
                        <option value="preferred">
                          Preferred supplier
                        </option>
                        <option value="alternative">
                          Alternative supplier
                        </option>
                      </select>
                      <input
                        value={itemLinkForm.supplierSku}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            supplierSku: event.target.value,
                          }))
                        }
                        placeholder="Supplier SKU"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        value={itemLinkForm.unitCost}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            unitCost: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Unit cost (£)"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        value={itemLinkForm.minimumOrderQuantity}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            minimumOrderQuantity:
                              event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        placeholder="Minimum order quantity"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        value={itemLinkForm.leadTimeDays}
                        onChange={(event) =>
                          setItemLinkForm((current) => ({
                            ...current,
                            leadTimeDays: event.target.value,
                          }))
                        }
                        type="number"
                        min="0"
                        placeholder="Lead time days"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <button
                        type="button"
                        disabled={
                          workspaceSaving ||
                          !itemLinkForm.stockItemId.trim()
                        }
                        onClick={() =>
                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/item-links`,
                            "POST",
                            {
                              stock_item_id:
                                itemLinkForm.stockItemId.trim(),
                              stock_item_name:
                                itemLinkForm.stockItemName.trim() ||
                                null,
                              supplier_role:
                                itemLinkForm.supplierRole,
                              supplier_sku:
                                itemLinkForm.supplierSku.trim() ||
                                null,
                              unit_cost_pence:
                                itemLinkForm.unitCost
                                  ? parsePoundsToPence(
                                      itemLinkForm.unitCost,
                                    )
                                  : null,
                              minimum_order_quantity:
                                itemLinkForm.minimumOrderQuantity
                                  ? Number(
                                      itemLinkForm.minimumOrderQuantity,
                                    )
                                  : null,
                              lead_time_days:
                                itemLinkForm.leadTimeDays
                                  ? Number(
                                      itemLinkForm.leadTimeDays,
                                    )
                                  : null,
                            },
                            "The stock item supplier link was saved.",
                          )
                        }
                        className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        Save item link
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-[900px] w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase text-white/40">
                        <tr>
                          <th className="px-4 py-3">Item</th>
                          <th className="px-4 py-3">Role</th>
                          <th className="px-4 py-3">Supplier SKU</th>
                          <th className="px-4 py-3">Unit cost</th>
                          <th className="px-4 py-3">Minimum</th>
                          <th className="px-4 py-3">Lead time</th>
                          <th className="px-4 py-3">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {workspace.itemLinks.map((link) => (
                          <tr key={link.id}>
                            <td className="px-4 py-3">
                              <p className="font-black">{link.stockItemName}</p>
                              <p className="text-xs text-white/40">
                                {link.sku || link.stockItemId}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {formatLabel(link.supplierRole)}
                            </td>
                            <td className="px-4 py-3">
                              {link.supplierSku || "—"}
                            </td>
                            <td className="px-4 py-3">
                              {formatMoney(link.unitCostPence)}
                            </td>
                            <td className="px-4 py-3">
                              {link.minimumOrderQuantity ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              {link.leadTimeDays ?? "—"}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() =>
                                  void runWorkspaceAction(
                                    `${API}/${selectedSupplier.id}/item-links/${link.id}`,
                                    "DELETE",
                                    {},
                                    "The item supplier link was removed.",
                                  )
                                }
                                className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                        {workspace.itemLinks.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                              No preferred or alternative item links recorded.
                            </td>
                          </tr>
                        ) : null}

                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {detailTab === "orders" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-sky-300/15 bg-sky-500/[0.07] p-4">
                    <h3 className="flex items-center gap-2 font-black text-sky-100">
                      <ShoppingCart className="h-5 w-5" />
                      Create or edit purchase order
                    </h3>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <input
                        value={orderForm.orderNumber}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            orderNumber: event.target.value,
                          }))
                        }
                        placeholder="Order number"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <select
                        value={orderForm.status}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            status: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                      >
                        {[
                          "draft",
                          "pending",
                          "approved",
                          "ordered",
                          "partially_received",
                          "received",
                          "cancelled",
                          "refund_required",
                          "replacement_required",
                        ].map((status) => (
                          <option key={status} value={status}>
                            {formatLabel(status)}
                          </option>
                        ))}
                      </select>
                      <input
                        type="date"
                        value={orderForm.orderDate}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            orderDate: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="date"
                        value={orderForm.expectedDeliveryDate}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            expectedDeliveryDate:
                              event.target.value,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={orderForm.estimatedTotal}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            estimatedTotal: event.target.value,
                          }))
                        }
                        placeholder="Estimated total (£)"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={orderForm.actualTotal}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            actualTotal: event.target.value,
                          }))
                        }
                        placeholder="Actual total (£)"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={orderForm.receivedQuantity}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            receivedQuantity:
                              event.target.value,
                          }))
                        }
                        placeholder="Received quantity"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={orderForm.missingQuantity}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            missingQuantity:
                              event.target.value,
                          }))
                        }
                        placeholder="Missing quantity"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <input
                        type="number"
                        min="0"
                        value={orderForm.damagedQuantity}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            damagedQuantity:
                              event.target.value,
                          }))
                        }
                        placeholder="Damaged quantity"
                        className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                      />
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={orderForm.refundRequired}
                          onChange={(event) =>
                            setOrderForm((current) => ({
                              ...current,
                              refundRequired:
                                event.target.checked,
                            }))
                          }
                        />
                        Refund required
                      </label>
                      <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-3 text-sm">
                        <input
                          type="checkbox"
                          checked={orderForm.replacementRequired}
                          onChange={(event) =>
                            setOrderForm((current) => ({
                              ...current,
                              replacementRequired:
                                event.target.checked,
                            }))
                          }
                        />
                        Replacement required
                      </label>
                      <textarea
                        value={orderForm.notes}
                        onChange={(event) =>
                          setOrderForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Order, delivery, refund or replacement notes"
                        className="min-h-24 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none md:col-span-2 xl:col-span-3"
                      />
                      <button
                        type="button"
                        disabled={workspaceSaving}
                        onClick={() => void saveOrder()}
                        className="rounded-xl bg-sky-300 px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                      >
                        {orderForm.orderId
                          ? "Update order"
                          : "Create order"}
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-2xl border border-white/10">
                    <table className="min-w-[1200px] w-full text-left text-sm">
                      <thead className="bg-black/20 text-xs uppercase text-white/40">
                        <tr>
                          <th className="px-4 py-3">Order</th>
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Dates</th>
                          <th className="px-4 py-3">Spend</th>
                          <th className="px-4 py-3">Delivery result</th>
                          <th className="px-4 py-3">Flags</th>
                          <th className="px-4 py-3">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/10">
                        {workspace.orders.map((order) => (
                          <tr key={order.id}>
                            <td className="px-4 py-3">
                              <p className="font-black">
                                {order.orderNumber}
                              </p>
                              <p className="mt-1 max-w-72 text-xs text-white/40">
                                {order.notes || "No notes"}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {formatLabel(order.status)}
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <p>Ordered: {formatDate(order.orderDate)}</p>
                              <p>Expected: {formatDate(order.expectedDeliveryDate)}</p>
                              <p>Delivered: {formatDate(order.deliveredAt)}</p>
                            </td>
                            <td className="px-4 py-3">
                              <p>{formatMoney(order.estimatedTotalPence)}</p>
                              <p className="text-xs text-white/40">
                                Actual {formatMoney(order.actualTotalPence)}
                              </p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              <p>Received: {order.receivedQuantity}</p>
                              <p>Missing: {order.missingQuantity}</p>
                              <p>Damaged: {order.damagedQuantity}</p>
                            </td>
                            <td className="px-4 py-3 text-xs">
                              {order.refundRequired ? (
                                <p className="font-black text-red-100">
                                  Refund required
                                </p>
                              ) : null}
                              {order.replacementRequired ? (
                                <p className="font-black text-orange-100">
                                  Replacement required
                                </p>
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setOrderForm({
                                      orderId: order.id,
                                      orderNumber: order.orderNumber,
                                      status: order.status,
                                      orderDate:
                                        order.orderDate?.slice(0, 10) || "",
                                      expectedDeliveryDate:
                                        order.expectedDeliveryDate?.slice(0, 10) || "",
                                      estimatedTotal: String(
                                        order.estimatedTotalPence / 100,
                                      ),
                                      actualTotal: String(
                                        order.actualTotalPence / 100,
                                      ),
                                      receivedQuantity: String(
                                        order.receivedQuantity,
                                      ),
                                      missingQuantity: String(
                                        order.missingQuantity,
                                      ),
                                      damagedQuantity: String(
                                        order.damagedQuantity,
                                      ),
                                      refundRequired:
                                        order.refundRequired,
                                      replacementRequired:
                                        order.replacementRequired,
                                      notes: order.notes || "",
                                    })
                                  }
                                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-black"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void runWorkspaceAction(
                                      `${API}/${selectedSupplier.id}/orders/${order.id}`,
                                      "DELETE",
                                      {},
                                      "The purchase order was deleted.",
                                    )
                                  }
                                  className="rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {workspace.orders.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-4 py-8 text-center text-white/40">
                              No historic or current purchase orders found.
                            </td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : null}

              {detailTab === "history" ? (
                <div className="space-y-5">
                  <div className="rounded-2xl border border-fuchsia-300/15 bg-fuchsia-500/[0.07] p-4">
                    <h3 className="font-black text-fuchsia-100">
                      Add supplier review
                    </h3>
                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <select
                        value={reviewForm.rating}
                        onChange={(event) =>
                          setReviewForm((current) => ({
                            ...current,
                            rating: event.target.value,
                          }))
                        }
                        className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                      >
                        <option value="good">Good to work with</option>
                        <option value="ok">Okay</option>
                        <option value="do_not_invite">
                          Do not invite/use
                        </option>
                      </select>
                      {[
                        ["deliveryRating", "Delivery 1-5"],
                        ["qualityRating", "Quality 1-5"],
                        ["communicationRating", "Communication 1-5"],
                        ["valueRating", "Value 1-5"],
                      ].map(([field, label]) => (
                        <input
                          key={field}
                          type="number"
                          min="1"
                          max="5"
                          value={
                            reviewForm[
                              field as keyof ReviewFormState
                            ]
                          }
                          onChange={(event) =>
                            setReviewForm((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          placeholder={label}
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                      ))}
                      <textarea
                        value={reviewForm.notes}
                        onChange={(event) =>
                          setReviewForm((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        placeholder="Review notes"
                        className="min-h-24 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none md:col-span-2 xl:col-span-4"
                      />
                      <button
                        type="button"
                        disabled={workspaceSaving}
                        onClick={() => void saveReview()}
                        className="rounded-xl bg-fuchsia-300 px-4 py-3 text-sm font-black text-slate-950"
                      >
                        Add review
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <h3 className="flex items-center gap-2 font-black">
                        <Star className="h-5 w-5 text-fuchsia-200" />
                        Supplier review history
                      </h3>
                      <div className="mt-4 space-y-3">
                        {workspace.reviews.map((review) => (
                          <article
                            key={review.id}
                            className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                          >
                            <div className="flex justify-between gap-3">
                              <p className="font-black">
                                {formatLabel(review.rating)}
                              </p>
                              <p className="text-xs text-white/40">
                                {formatDate(review.createdAt)}
                              </p>
                            </div>
                            <p className="mt-1 text-xs text-white/50">
                              {review.adminName || "Admin"}
                              {review.eventName
                                ? ` · ${review.eventName}`
                                : ""}
                            </p>
                            <p className="mt-2 text-sm text-white/60">
                              {review.notes || "No review notes"}
                            </p>
                          </article>
                        ))}
                        {workspace.reviews.length === 0 ? (
                          <p className="text-sm text-white/40">
                            No supplier reviews recorded.
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <h3 className="flex items-center gap-2 font-black">
                        <History className="h-5 w-5 text-pink-200" />
                        Historic events
                      </h3>
                      <div className="mt-4 space-y-3">
                        {workspace.historicEvents.map((event) => (
                          <article
                            key={event.id}
                            className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                          >
                            <p className="font-black">
                              {event.eventName}
                              {event.eventYear
                                ? ` ${event.eventYear}`
                                : ""}
                            </p>
                            <p className="mt-1 text-xs text-white/45">
                              {formatDate(event.eventDate)} ·{" "}
                              {event.relationshipRating ||
                                "Not rated"}
                            </p>
                            <p className="mt-2 text-sm text-white/60">
                              {event.notes || "No event notes"}
                            </p>
                          </article>
                        ))}
                        {workspace.historicEvents.length === 0 ? (
                          <p className="text-sm text-white/40">
                            No historic event records found.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {detailTab === "compliance" ? (
                <div className="space-y-5">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-blue-300/15 bg-blue-500/[0.07] p-4">
                      <h3 className="font-black text-blue-100">
                        Public liability insurance
                      </h3>
                      <div className="mt-4 grid gap-3">
                        <select
                          value={complianceForm.publicLiabilityStatus}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              publicLiabilityStatus:
                                event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                        >
                          <option value="not_recorded">Not recorded</option>
                          <option value="valid">Valid</option>
                          <option value="expired">Expired</option>
                          <option value="missing">Missing</option>
                          <option value="not_required">Not required</option>
                        </select>
                        <input
                          type="date"
                          value={complianceForm.publicLiabilityExpiry}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              publicLiabilityExpiry:
                                event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <input
                          value={complianceForm.insuranceDocumentUrl}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              insuranceDocumentUrl:
                                event.target.value,
                            }))
                          }
                          placeholder="Insurance document URL"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-orange-300/15 bg-orange-500/[0.07] p-4">
                      <h3 className="font-black text-orange-100">
                        Food hygiene
                      </h3>
                      <div className="mt-4 grid gap-3">
                        <select
                          value={complianceForm.foodHygieneStatus}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              foodHygieneStatus:
                                event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                        >
                          <option value="not_required">Not required</option>
                          <option value="valid">Valid</option>
                          <option value="missing">Missing</option>
                          <option value="needs_check">Needs checking</option>
                        </select>
                        <input
                          value={complianceForm.foodHygieneRating}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              foodHygieneRating:
                                event.target.value,
                            }))
                          }
                          placeholder="Food hygiene rating"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <input
                          value={complianceForm.foodHygieneAuthority}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              foodHygieneAuthority:
                                event.target.value,
                            }))
                          }
                          placeholder="Local authority"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <input
                          type="date"
                          value={complianceForm.foodHygieneCheckedAt}
                          onChange={(event) =>
                            setComplianceForm((current) => ({
                              ...current,
                              foodHygieneCheckedAt:
                                event.target.value,
                            }))
                          }
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={workspaceSaving}
                    onClick={() => void saveCompliance()}
                    className="rounded-xl bg-blue-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    Save compliance details
                  </button>
                </div>
              ) : null}

              {detailTab === "admin" ? (
                <div className="space-y-5">
                  {profileEdit ? (
                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <h3 className="font-black">
                        Edit Stock supplier profile
                      </h3>
                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <input
                          value={profileEdit.displayName}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    displayName:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder="Supplier name"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <select
                          value={profileEdit.supplierUse}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    supplierUse:
                                      event.target.value as SupplierUse,
                                  }
                                : current,
                            )
                          }
                          className="rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                        >
                          {[
                            "stock",
                            "service",
                            "event_trader",
                            "performer",
                            "venue",
                            "mixed",
                          ].map((value) => (
                            <option key={value} value={value}>
                              {formatLabel(value)}
                            </option>
                          ))}
                        </select>
                        <input
                          value={profileEdit.usualDeliveryDays}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    usualDeliveryDays:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          type="number"
                          min="0"
                          placeholder="Usual delivery days"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <input
                          value={profileEdit.minimumOrderValue}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    minimumOrderValue:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Minimum order value (£)"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <input
                          value={profileEdit.usualDeliveryCost}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    usualDeliveryCost:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Usual delivery cost (£)"
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                        />
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={profileEdit.isActive}
                            onChange={(event) =>
                              setProfileEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      isActive:
                                        event.target.checked,
                                    }
                                  : current,
                              )
                            }
                          />
                          Active
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-3 text-sm">
                          <input
                            type="checkbox"
                            checked={profileEdit.needsReview}
                            onChange={(event) =>
                              setProfileEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      needsReview:
                                        event.target.checked,
                                    }
                                  : current,
                              )
                            }
                          />
                          Needs review
                        </label>
                        <label className="flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-3 text-sm text-red-100">
                          <input
                            type="checkbox"
                            checked={profileEdit.doNotUse}
                            onChange={(event) =>
                              setProfileEdit((current) =>
                                current
                                  ? {
                                      ...current,
                                      doNotUse:
                                        event.target.checked,
                                    }
                                  : current,
                              )
                            }
                          />
                          Do not use
                        </label>
                        <textarea
                          value={profileEdit.stockNotes}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    stockNotes:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder="Stock notes"
                          className="min-h-24 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none md:col-span-2 xl:col-span-3"
                        />
                        <button
                          type="button"
                          disabled={workspaceSaving}
                          onClick={() => void saveProfileChanges()}
                          className="rounded-xl bg-cyan-300 px-4 py-3 text-sm font-black text-slate-950"
                        >
                          Save profile
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-pink-300/15 bg-pink-500/[0.07] p-4">
                      <h3 className="font-black text-pink-100">
                        Event Hub connection
                      </h3>
                      <p className="mt-2 text-sm text-white/55">
                        Current record:{" "}
                        {selectedSupplier.eventHub.organisationName ||
                          "Not connected"}
                      </p>
                      <button
                        type="button"
                        disabled={
                          workspaceSaving ||
                          !selectedSupplier.eventHub.recordId
                        }
                        onClick={() =>
                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/connections/event-hub`,
                            "DELETE",
                            {},
                            "The Event Hub connection was removed.",
                          )
                        }
                        className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-100 disabled:opacity-50"
                      >
                        Unlink Event Hub record
                      </button>
                    </div>

                    <div className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] p-4">
                      <h3 className="font-black text-emerald-100">
                        Money Management connection
                      </h3>
                      <p className="mt-2 text-sm text-white/55">
                        Current record:{" "}
                        {selectedSupplier.moneyManagement.supplierName ||
                          "Not connected"}
                      </p>
                      <button
                        type="button"
                        disabled={
                          workspaceSaving ||
                          !selectedSupplier.moneyManagement.supplierId
                        }
                        onClick={() =>
                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/connections/money`,
                            "DELETE",
                            {},
                            "The Money Management connection was removed.",
                          )
                        }
                        className="mt-4 rounded-xl border border-red-300/20 bg-red-500/10 px-4 py-2.5 text-sm font-black text-red-100 disabled:opacity-50"
                      >
                        Unlink Money supplier
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-violet-300/15 bg-violet-500/[0.07] p-4">
                    <h3 className="font-black text-violet-100">
                      Central organisation migration
                    </h3>
                    <p className="mt-2 text-sm text-white/55">
                      Status:{" "}
                      {formatLabel(
                        workspace.organisation.migrationStatus,
                      )}
                      {workspace.organisation.organisationName
                        ? ` · ${workspace.organisation.organisationName}`
                        : ""}
                    </p>
                    <button
                      type="button"
                      disabled={workspaceSaving}
                      onClick={() =>
                        void runWorkspaceAction(
                          `${API}/${selectedSupplier.id}/organisation/migrate`,
                          "POST",
                          {},
                          "The supplier was migrated or linked to the central organisation record.",
                        )
                      }
                      className="mt-4 rounded-xl bg-violet-300 px-4 py-2.5 text-sm font-black text-slate-950"
                    >
                      Migrate to central organisation
                    </button>
                  </div>

                  <div className="rounded-2xl border border-amber-300/15 bg-amber-500/[0.07] p-4">
                    <h3 className="font-black text-amber-100">
                      Duplicate merge
                    </h3>
                    <select
                      value={mergeTargetId}
                      onChange={(event) =>
                        setMergeTargetId(event.target.value)
                      }
                      className="mt-3 w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm"
                    >
                      <option value="">Choose duplicate record</option>
                      {workspace.duplicateCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.displayName} · {candidate.source} ·{" "}
                          {candidate.reason}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={
                        workspaceSaving || !mergeTargetId
                      }
                      onClick={() =>
                        void runWorkspaceAction(
                          `${API}/${selectedSupplier.id}/merge`,
                          "POST",
                          {
                            duplicate_supplier_id:
                              mergeTargetId,
                          },
                          "The duplicate supplier records were merged.",
                        )
                      }
                      className="mt-3 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 disabled:opacity-50"
                    >
                      Merge selected duplicate
                    </button>
                  </div>

                  <div className="rounded-2xl border border-red-300/15 bg-red-500/[0.07] p-4">
                    <h3 className="font-black text-red-100">
                      Main-admin blocked-supplier override
                    </h3>
                    <textarea
                      value={overrideReason}
                      onChange={(event) =>
                        setOverrideReason(event.target.value)
                      }
                      placeholder="Required reason for temporary override"
                      className="mt-3 min-h-20 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                    />
                    <input
                      type="datetime-local"
                      value={overrideExpiresAt}
                      onChange={(event) =>
                        setOverrideExpiresAt(event.target.value)
                      }
                      className="mt-3 w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          workspaceSaving ||
                          !workspace.canMainAdminOverride ||
                          overrideReason.trim().length < 10
                        }
                        onClick={() =>
                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/override`,
                            "POST",
                            {
                              reason: overrideReason.trim(),
                              expires_at:
                                overrideExpiresAt || null,
                            },
                            "The temporary main-admin override was enabled.",
                          )
                        }
                        className="rounded-xl bg-red-300 px-4 py-2.5 text-sm font-black text-red-950 disabled:opacity-50"
                      >
                        Enable temporary override
                      </button>
                      {workspace.activeOverride?.enabled ? (
                        <button
                          type="button"
                          onClick={() =>
                            void runWorkspaceAction(
                              `${API}/${selectedSupplier.id}/override`,
                              "DELETE",
                              {},
                              "The main-admin override was removed.",
                            )
                          }
                          className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black"
                        >
                          Remove override
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={workspaceSaving}
                      onClick={() =>
                        void exportFullSupplierWorkbook()
                      }
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-black text-slate-950"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      Export full multi-sheet workbook
                    </button>

                    <Link
                      href={`/Admin/StockManagement/Suppliers/${selectedSupplier.id}`}
                      className="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-2.5 text-sm font-black text-cyan-100"
                    >
                      Open dedicated supplier page
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <h3 className="flex items-center gap-2 font-black">
                      <ReceiptText className="h-5 w-5 text-white/60" />
                      Supplier audit log
                    </h3>
                    <div className="mt-4 space-y-2">
                      {workspace.auditLogs.map((entry) => (
                        <article
                          key={entry.id}
                          className="rounded-xl border border-white/10 bg-white/[0.04] p-3"
                        >
                          <div className="flex justify-between gap-3">
                            <p className="font-black">
                              {formatLabel(entry.action)}
                            </p>
                            <p className="text-xs text-white/40">
                              {formatDate(entry.createdAt)}
                            </p>
                          </div>
                          <p className="mt-1 text-xs text-white/45">
                            {entry.adminName || "Admin"} ·{" "}
                            {entry.status || "Recorded"}
                          </p>
                          <p className="mt-2 text-sm text-white/60">
                            {entry.summary || "No summary"}
                          </p>
                        </article>
                      ))}
                      {workspace.auditLogs.length === 0 ? (
                        <p className="text-sm text-white/40">
                          No supplier audit events returned.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Add stock supplier"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={() => setAddOpen(false)}
            aria-label="Close add supplier"
          />

          <form
            onSubmit={createSupplier}
            className="relative max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/10 bg-[#171020] p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">
                  Add Stock Management supplier
                </h2>
                <p className="mt-1 text-sm leading-6 text-white/50">
                  Create the Stock Management supplier profile, then
                  choose existing Event Hub and Money Management records from
                  simple dropdown menus. No UUID codes need to be copied or
                  pasted, and the original records stay in their own apps.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setAddOpen(false)}
                className="rounded-xl border border-white/10 p-2 hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Supplier or organisation name
                </span>
                <input
                  required
                  value={form.displayName}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      displayName: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/40"
                  placeholder="For example: Event Supplies Ltd"
                />
              </label>

              {possibleDuplicate ? (
                <div className="sm:col-span-2 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-black">
                        Possible existing record found
                      </p>
                      <p className="mt-1 text-xs leading-5 text-amber-50/70">
                        {possibleDuplicate.name} already appears in{" "}
                        {possibleDuplicate.source}. Check and link the existing
                        record instead of creating a duplicate.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Supplier use
                </span>
                <select
                  value={form.supplierUse}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      supplierUse: event.target
                        .value as SupplierUse,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                >
                  <option value="stock">Stock</option>
                  <option value="service">Service</option>
                  <option value="event_trader">
                    Event trader
                  </option>
                  <option value="performer">
                    Performer
                  </option>
                  <option value="venue">Venue</option>
                  <option value="mixed">Mixed</option>
                </select>
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Usual delivery days
                </span>
                <input
                  type="number"
                  min="0"
                  value={form.usualDeliveryDays}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      usualDeliveryDays:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                  placeholder="For example: 5"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Minimum order value (£)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimumOrderValue}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      minimumOrderValue:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                  placeholder="0.00"
                />
              </label>

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Usual delivery cost (£)
                </span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.usualDeliveryCost}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      usualDeliveryCost:
                        event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                  placeholder="0.00"
                />
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-pink-300/15 bg-pink-500/[0.07] p-4">
              <h3 className="flex items-center gap-2 font-black text-pink-100">
                <Users className="h-4 w-4" />
                Connect an Event Hub contact
              </h3>

              <p className="mt-1 text-xs leading-5 text-pink-50/60">
                Choose an existing Event Hub contact from the list. You do not
                need to copy or paste an ID.
              </p>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Event Hub contact
                </span>

                <select
                  value={form.eventRecordId}
                  onChange={(event) =>
                    selectEventContact(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40"
                >
                  <option value="">
                    Do not connect an Event Hub contact
                  </option>

                  {eventContacts.map((contact) => (
                    <option
                      key={`${contact.recordType}-${contact.id}`}
                      value={contact.id}
                    >
                      {eventContactOptionLabel(contact)}
                      {contact.linkedStockSupplierId
                        ? " · Already linked"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {form.eventRecordId ? (
                <div className="mt-3 rounded-xl border border-pink-300/10 bg-black/20 p-3 text-xs leading-5 text-white/60">
                  <p>
                    <span className="font-black text-white/75">
                      Selected record type:
                    </span>{" "}
                    {formatLabel(form.eventRecordType)}
                  </p>
                </div>
              ) : null}
            </div>

            <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.07] p-4">
              <h3 className="flex items-center gap-2 font-black text-emerald-100">
                <CircleDollarSign className="h-4 w-4" />
                Connect a Money Management supplier
              </h3>

              <p className="mt-1 text-xs leading-5 text-emerald-50/60">
                Choose the financial supplier used for invoices, payments,
                receipts and transactions. You do not need to enter a UUID.
              </p>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Money Management supplier
                </span>

                <select
                  value={form.moneySupplierId}
                  onChange={(event) =>
                    selectMoneySupplier(event.target.value)
                  }
                  disabled={moneySuppliersLoading}
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-emerald-300/40 disabled:opacity-60"
                >
                  <option value="">
                    {moneySuppliersLoading
                      ? "Loading Money Management suppliers..."
                      : "Do not connect a Money Management supplier"}
                  </option>

                  {moneySuppliers.map((supplier) => (
                    <option
                      key={supplier.id}
                      value={supplier.id}
                    >
                      {moneySupplierOptionLabel(supplier)}
                      {supplier.is_active === false
                        ? " · Archived"
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {moneySuppliersError ? (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-amber-300/15 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                  {moneySuppliersError}
                </pre>
              ) : null}
            </div>

            <label className="mt-4 block">
              <span className="mb-1.5 block text-xs font-black text-white/55">
                Stock Management notes
              </span>
              <textarea
                rows={4}
                value={form.stockNotes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    stockNotes: event.target.value,
                  }))
                }
                className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/40"
                placeholder="Stock, ordering or delivery notes..."
              />
            </label>

            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setAddOpen(false)}
                disabled={creating}
                className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={creating}
                className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50"
              >
                {creating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Create supplier
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
