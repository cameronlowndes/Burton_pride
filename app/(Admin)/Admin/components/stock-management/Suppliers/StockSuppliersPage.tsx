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
  Ban,
  Boxes,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  ContactRound,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  ExternalLink,
  FileSpreadsheet,
  History,
  Filter,
  Link2,
  Loader2,
  LockKeyhole,
  PackageCheck,
  PackagePlus,
  Pencil,
  ReceiptText,
  Plus,
  Printer,
  RefreshCw,
  Search,
  ShieldAlert,
  Star,
  ShoppingCart,
  Trash2,
  TriangleAlert,
  Truck,
  Unlink,
  Users,
  X,
} from "lucide-react";

const API = "/api/admin/stockmanagement/suppliers";
const INVENTORY_API = "/api/admin/stockmanagement/inventory";
const EVENT_HUB_CONTACTS_API =
  "/api/admin/burton-pride-event-hub/contacts";
const STOCK_AUDIT_API = "/api/admin/stockmanagement/audit-logs";
const STOCK_SUPPLIERS_ROUTE = "/Admin/StockManagement/Suppliers";

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

type StockSupplierRating =
  | "not_recorded"
  | "excellent"
  | "good"
  | "ok"
  | "poor"
  | "do_not_use";

type SupplierAuditStatus =
  | "success"
  | "failed"
  | "warning"
  | "blocked";

type SupplierAuditRisk =
  | "low"
  | "medium"
  | "high"
  | "critical";

type SupplierAuditInput = {
  action: string;
  status?: SupplierAuditStatus;
  risk?: SupplierAuditRisk;
  supplierId?: string | null;
  recordType?: string;
  metadata?: Record<string, unknown>;
  error?: unknown;
};

type WorkspaceAuditDescriptor = {
  action: string;
  failureAction?: string;
  risk?: SupplierAuditRisk;
  recordType?: string;
  metadata?: Record<string, unknown>;
};

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
  stockRating: StockSupplierRating;
  stockRatingScore: number | null;
  stockRatingNotes: string | null;
  stockRatingUpdatedAt: string | null;
  stockRatingUpdatedByName: string | null;

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

type RawEventHubContact = Partial<EventHubContactOption> & {
  id?: unknown;
  record_type?: unknown;
  contact_type?: unknown;

  organisation_name?: unknown;
  business_name?: unknown;
  company_name?: unknown;
  name?: unknown;

  contact_name?: unknown;
  email_address?: unknown;
  telephone?: unknown;
  mobile?: unknown;
  website_url?: unknown;

  do_not_use?: unknown;
  do_not_invite?: unknown;
  is_do_not_use?: unknown;
  is_blocked?: unknown;
  blocked?: unknown;
  blocked_status?: unknown;
  warning_status?: unknown;
  status?: unknown;
  working_rating?: unknown;

  needs_review?: unknown;
  requires_review?: unknown;
  is_review_required?: unknown;

  linked_stock_supplier_id?: unknown;
  linked_stock_supplier_name?: unknown;

  event_name?: unknown;
  event_year?: unknown;
  is_active?: unknown;
};


type DirectEventHubContact = {
  id: string;
  business_name: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  website?: string | null;
  service_type?: string | null;
  working_rating?:
    | "good"
    | "ok"
    | "do_not_invite"
    | null;
  is_active?: boolean | null;
};

type DirectEventHubContactsResponse = {
  ok?: boolean;
  contacts?: DirectEventHubContact[];
  error?: string;
  code?: string;
  details?: string | null;
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
  eventContacts?: RawEventHubContact[];
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

type InventoryOption = {
  id: string;
  name: string;
  sku: string;
  quantity: number;
  reorderLevel?: number | null;
  targetLevel?: number | null;
  unitCost?: number | null;
  category?: string | null;
  location?: string | null;
  isActive: boolean;
};

type InventoryResponse = {
  ok?: boolean;
  items?: InventoryOption[];
  inventory?: InventoryOption[];
  error?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
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
  eventDoNotUse: boolean;
  eventNeedsReview: boolean;
  eventWarningAccepted: boolean;
  moneySupplierId: string;

  stockRating: StockSupplierRating;
  stockRatingScore: string;
  stockRatingNotes: string;
  stockNeedsReview: boolean;
  ratingWarningAccepted: boolean;
  createInitialReview: boolean;
  reviewDeliveryRating: string;
  reviewQualityRating: string;
  reviewCommunicationRating: string;
  reviewValueRating: string;

  stockItemId: string;
  stockItemRole: "preferred" | "alternative";
  stockItemSupplierSku: string;
  stockItemUnitCost: string;
  stockItemMinimumOrderQuantity: string;
  stockItemLeadTimeDays: string;
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
  stockRating: StockSupplierRating;
  stockRatingScore: string;
  stockRatingNotes: string;
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
  eventDoNotUse: false,
  eventNeedsReview: false,
  eventWarningAccepted: false,
  moneySupplierId: "",

  stockRating: "not_recorded",
  stockRatingScore: "",
  stockRatingNotes: "",
  stockNeedsReview: false,
  ratingWarningAccepted: false,
  createInitialReview: false,
  reviewDeliveryRating: "",
  reviewQualityRating: "",
  reviewCommunicationRating: "",
  reviewValueRating: "",

  stockItemId: "",
  stockItemRole: "preferred",
  stockItemSupplierSku: "",
  stockItemUnitCost: "",
  stockItemMinimumOrderQuantity: "",
  stockItemLeadTimeDays: "",
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

function eventBoolean(value: unknown) {
  if (value === true || value === 1) {
    return true;
  }

  const normalised = String(value ?? "")
    .trim()
    .toLowerCase();

  return [
    "true",
    "1",
    "yes",
    "y",
    "blocked",
    "do_not_use",
    "do not use",
    "do-not-use",
    "do_not_invite",
    "do not invite",
    "do-not-invite",
    "review",
    "needs_review",
    "needs review",
  ].includes(normalised);
}

function normaliseEventRating(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("-", "_")
    .replace(/\s+/g, "_");
}

function eventContactDoNotUse(
  contact: RawEventHubContact,
) {
  /*
   * Exact Event Hub Contacts-page rule:
   * working_rating === "do_not_invite"
   */
  if (
    normaliseEventRating(
      contact.working_rating,
    ) === "do_not_invite"
  ) {
    return true;
  }

  return [
    contact.doNotInvite,
    contact.do_not_use,
    contact.do_not_invite,
    contact.is_do_not_use,
    contact.is_blocked,
    contact.blocked,
    contact.status,
    contact.blocked_status,
    contact.warning_status,
    contact.rating,
  ].some((value) => {
    if (value === true || value === 1) {
      return true;
    }

    return [
      "blocked",
      "do_not_use",
      "do_not_invite",
      "not_invited",
      "never_use",
    ].includes(
      normaliseEventRating(value),
    );
  });
}

function eventContactNeedsReview(
  contact: RawEventHubContact,
) {
  return (
    eventContactDoNotUse(contact) ||
    normaliseEventRating(
      contact.working_rating,
    ) === "ok" ||
    eventBoolean(contact.needsReview) ||
    eventBoolean(contact.needs_review) ||
    eventBoolean(contact.requires_review) ||
    eventBoolean(contact.is_review_required)
  );
}

function normaliseEventContact(
  contact: RawEventHubContact,
): EventHubContactOption {
  return {
    id: String(contact.id ?? ""),
    recordType: String(
      contact.recordType ??
        contact.record_type ??
        contact.contact_type ??
        "business_contact",
    ),
    organisationName: String(
      contact.organisationName ??
        contact.organisation_name ??
        contact.business_name ??
        contact.company_name ??
        contact.name ??
        "Unnamed Event Hub contact",
    ),
    contactName:
      contact.contactName !== undefined
        ? String(contact.contactName || "") || null
        : contact.contact_name !== undefined
          ? String(contact.contact_name || "") || null
          : null,
    email:
      contact.email !== undefined
        ? String(contact.email || "") || null
        : contact.email_address !== undefined
          ? String(contact.email_address || "") || null
          : null,
    phone:
      contact.phone !== undefined
        ? String(contact.phone || "") || null
        : contact.telephone !== undefined
          ? String(contact.telephone || "") || null
          : contact.mobile !== undefined
            ? String(contact.mobile || "") || null
            : null,
    website:
      contact.website !== undefined
        ? String(contact.website || "") || null
        : contact.website_url !== undefined
          ? String(contact.website_url || "") || null
          : null,
    rating:
      contact.working_rating !== undefined
        ? String(
            contact.working_rating || "",
          ) || null
        : contact.rating !== undefined
          ? String(contact.rating || "") || null
          : null,
    doNotInvite:
      eventContactDoNotUse(contact),
    needsReview:
      eventContactNeedsReview(contact),
    linkedStockSupplierId:
      contact.linkedStockSupplierId !== undefined
        ? String(contact.linkedStockSupplierId || "") || null
        : contact.linked_stock_supplier_id !== undefined
          ? String(contact.linked_stock_supplier_id || "") || null
          : null,
    linkedStockSupplierName:
      contact.linkedStockSupplierName !== undefined
        ? String(contact.linkedStockSupplierName || "") || null
        : contact.linked_stock_supplier_name !== undefined
          ? String(contact.linked_stock_supplier_name || "") || null
          : null,
    eventName:
      contact.eventName !== undefined
        ? String(contact.eventName || "") || null
        : contact.event_name !== undefined
          ? String(contact.event_name || "") || null
          : null,
    eventYear:
      contact.eventYear !== undefined &&
      Number.isFinite(Number(contact.eventYear))
        ? Number(contact.eventYear)
        : contact.event_year !== undefined &&
            Number.isFinite(Number(contact.event_year))
          ? Number(contact.event_year)
          : null,
    isActive:
      contact.isActive !== undefined
        ? contact.isActive !== false
        : contact.is_active !== undefined
          ? !["false", "0", "no"].includes(
              String(contact.is_active)
                .trim()
                .toLowerCase(),
            )
          : true,
  };
}

function supplierStatus(supplier: StockSupplierView): SupplierStatus {
  if (
    supplier.doNotUse ||
    supplier.moneyManagement.doNotUse ||
    supplier.stockRating === "do_not_use"
  ) {
    return "blocked";
  }

  if (
    supplier.needsReview ||
    supplier.eventHub.requiresReview ||
    supplier.stockRating === "poor" ||
    supplier.stockRating === "ok"
  ) {
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

function stockRatingClasses(rating: StockSupplierRating) {
  switch (rating) {
    case "excellent":
      return "border-emerald-300/30 bg-emerald-500/15 text-emerald-50";
    case "good":
      return "border-green-300/25 bg-green-500/10 text-green-100";
    case "ok":
      return "border-amber-300/25 bg-amber-500/10 text-amber-100";
    case "poor":
      return "border-orange-300/30 bg-orange-500/15 text-orange-100";
    case "do_not_use":
      return "border-red-300/35 bg-red-500/20 text-red-50";
    default:
      return "border-white/10 bg-white/[0.06] text-white/55";
  }
}

function stockRatingLabel(rating: StockSupplierRating) {
  switch (rating) {
    case "excellent":
      return "Excellent";
    case "good":
      return "Good";
    case "ok":
      return "Okay";
    case "poor":
      return "Poor";
    case "do_not_use":
      return "Do not use";
    default:
      return "Not rated";
  }
}

function ratingScoreFromValue(
  rating: StockSupplierRating,
  score: number | null | undefined,
) {
  const hasSavedScore =
    score !== null &&
    score !== undefined &&
    Number.isFinite(Number(score));

  if (hasSavedScore) {
    return Math.min(
      5,
      Math.max(1, Math.round(Number(score))),
    );
  }

  return {
    excellent: 5,
    good: 4,
    ok: 3,
    poor: 2,
    do_not_use: 1,
    not_recorded: 0,
  }[rating];
}

function StockRatingBadge({
  rating,
  score,
  compact = false,
}: {
  rating: StockSupplierRating;
  score?: number | null;
  compact?: boolean;
}) {
  const starCount = ratingScoreFromValue(rating, score);

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-black ${stockRatingClasses(
        rating,
      )}`}
    >
      <span className="inline-flex" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => (
          <Star
            key={index}
            className={`h-3.5 w-3.5 ${
              index < starCount
                ? "fill-current"
                : "opacity-25"
            }`}
          />
        ))}
      </span>
      {!compact ? stockRatingLabel(rating) : null}
    </span>
  );
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


function serialiseSupplierAuditError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message.slice(0, 2000),
    };
  }

  if (typeof error === "string") {
    return {
      name: "Error",
      message: error.slice(0, 2000),
    };
  }

  return error
    ? {
        name: "Error",
        message: "An unknown supplier action error occurred.",
      }
    : null;
}

async function reportSupplierAudit({
  action,
  status = "success",
  risk = "low",
  supplierId = null,
  recordType = "stock_supplier",
  metadata = {},
  error,
}: SupplierAuditInput) {
  try {
    const response = await fetch(STOCK_AUDIT_API, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      keepalive: true,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action,
        module: "stock_suppliers",
        route: STOCK_SUPPLIERS_ROUTE,
        source: "CLIENT",
        status,
        risk,
        record_type: recordType,
        record_id: supplierId,
        metadata: {
          app: "stock_control",
          page: "suppliers",
          ...metadata,
          ...(error
            ? {
                client_error:
                  serialiseSupplierAuditError(error),
              }
            : {}),
        },
      }),
    });

    if (!response.ok) {
      const raw = await response.text().catch(() => "");

      console.error("Stock supplier audit report failed", {
        action,
        status,
        httpStatus: response.status,
        response: raw.slice(0, 1000),
      });
    }
  } catch (auditError) {
    /*
     * Audit reporting must never stop the supplier action itself.
     * The protected API routes remain the authoritative audit source.
     */
    console.error("Stock supplier audit request failed", {
      action,
      status,
      auditError,
    });
  }
}

function workspaceAuditForAction(
  endpoint: string,
  method: "POST" | "PATCH" | "DELETE",
  body: Record<string, unknown>,
): WorkspaceAuditDescriptor {
  const path = endpoint.toLowerCase();

  if (path.includes("/connections/event-hub")) {
    return {
      action:
        method === "DELETE"
          ? "stock.supplier.event_hub_unlinked"
          : body.event_record_id
            ? "stock.supplier.event_hub_linked"
            : "stock.supplier.event_hub_link_changed",
      failureAction:
        method === "DELETE"
          ? "stock.supplier.event_hub_unlink_failed"
          : "stock.supplier.event_hub_link_failed",
      risk: method === "DELETE" ? "high" : "medium",
      metadata: {
        integration: "event_hub",
        event_record_type:
          body.event_record_type || null,
        event_record_id:
          body.event_record_id || null,
        reason: body.reason || null,
      },
    };
  }

  if (path.includes("/connections/money-management")) {
    return {
      action:
        method === "DELETE"
          ? "stock.supplier.money_management_unlinked"
          : body.money_supplier_id
            ? "stock.supplier.money_management_linked"
            : "stock.supplier.money_management_link_changed",
      failureAction:
        method === "DELETE"
          ? "stock.supplier.money_management_unlink_failed"
          : "stock.supplier.money_management_link_failed",
      risk: method === "DELETE" ? "high" : "medium",
      metadata: {
        integration: "money_management",
        money_supplier_id:
          body.money_supplier_id || null,
        reason: body.reason || null,
      },
    };
  }

  if (path.includes("/orders")) {
    const hasDeliveryProblem =
      Number(body.missing_quantity || 0) > 0 ||
      Number(body.damaged_quantity || 0) > 0 ||
      body.refund_required === true ||
      body.replacement_required === true;

    return {
      action:
        method === "POST"
          ? "stock.supplier.order_created"
          : method === "DELETE"
            ? "stock.supplier.order_cancelled"
            : hasDeliveryProblem
              ? "stock.supplier.delivery_problem_recorded"
              : "stock.supplier.order_updated",
      failureAction:
        method === "POST"
          ? "stock.supplier.order_create_failed"
          : "stock.supplier.order_update_failed",
      risk: hasDeliveryProblem ? "high" : "medium",
      recordType: "stock_supplier_order",
      metadata: {
        order_id:
          path.split("/orders/")[1] || null,
        order_number: body.order_number || null,
        order_status: body.status || null,
        received_quantity:
          body.received_quantity ?? null,
        missing_quantity:
          body.missing_quantity ?? null,
        damaged_quantity:
          body.damaged_quantity ?? null,
        refund_required:
          body.refund_required ?? false,
        replacement_required:
          body.replacement_required ?? false,
        expected_delivery_date:
          body.expected_delivery_date || null,
      },
    };
  }

  if (path.includes("/reviews")) {
    return {
      action:
        method === "DELETE"
          ? "stock.supplier.review_deleted"
          : method === "PATCH"
            ? "stock.supplier.review_updated"
            : "stock.supplier.review_created",
      failureAction:
        "stock.supplier.review_action_failed",
      risk: "medium",
      recordType: "stock_supplier_review",
      metadata: {
        rating: body.rating || null,
        delivery_rating:
          body.delivery_rating ?? null,
        quality_rating:
          body.quality_rating ?? null,
        communication_rating:
          body.communication_rating ?? null,
        value_rating:
          body.value_rating ?? null,
      },
    };
  }

  if (path.includes("/compliance")) {
    return {
      action:
        "stock.supplier.compliance_updated",
      failureAction:
        "stock.supplier.compliance_update_failed",
      risk: "high",
      recordType: "stock_supplier_compliance",
      metadata: {
        public_liability_status:
          body.public_liability_status || null,
        public_liability_expiry:
          body.public_liability_expiry || null,
        food_hygiene_status:
          body.food_hygiene_status || null,
        food_hygiene_rating:
          body.food_hygiene_rating || null,
      },
    };
  }

  if (path.includes("/item-links")) {
    return {
      action:
        method === "DELETE"
          ? "stock.supplier.item_link_removed"
          : method === "PATCH"
            ? "stock.supplier.item_link_updated"
            : "stock.supplier.item_link_created",
      failureAction:
        "stock.supplier.item_link_action_failed",
      risk: "medium",
      recordType: "stock_supplier_item_link",
      metadata: {
        stock_item_id:
          body.stock_item_id || null,
        supplier_role:
          body.supplier_role || null,
        supplier_sku:
          body.supplier_sku || null,
      },
    };
  }

  if (path.includes("/organisation/migrate")) {
    return {
      action:
        "stock.supplier.organisation_migrated",
      failureAction:
        "stock.supplier.organisation_migration_failed",
      risk: "high",
      metadata: {
        organisation_name:
          body.organisation_name || null,
        reason: body.reason || null,
      },
    };
  }

  if (path.includes("/merge")) {
    return {
      action:
        "stock.supplier.duplicate_merged",
      failureAction:
        "stock.supplier.duplicate_merge_failed",
      risk: "high",
      metadata: {
        target_supplier_id:
          body.target_supplier_id || null,
        reason: body.reason || null,
      },
    };
  }

  if (path.includes("/override")) {
    return {
      action:
        method === "DELETE"
          ? "stock.supplier.override_removed"
          : "stock.supplier.money_management_override_used",
      failureAction:
        "stock.supplier.override_action_failed",
      risk: "critical",
      metadata: {
        reason: body.reason || null,
        expires_at: body.expires_at || null,
      },
    };
  }

  return {
    action:
      method === "PATCH"
        ? "stock.supplier.updated"
        : method === "DELETE"
          ? "stock.supplier.deleted"
          : "stock.supplier.action_completed",
    failureAction:
      method === "PATCH"
        ? "stock.supplier.update_failed"
        : method === "DELETE"
          ? "stock.supplier.delete_failed"
          : "stock.supplier.action_failed",
    risk: method === "DELETE" ? "critical" : "medium",
    metadata: {
      reason: body.reason || null,
    },
  };
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

function mergeWorkingRatings(
  stockContacts: EventHubContactOption[],
  directContacts: DirectEventHubContact[],
) {
  return stockContacts.map((stockContact) => {
    const directContact =
      directContacts.find(
        (contact) =>
          contact.id === stockContact.id,
      ) ||
      directContacts.find((contact) => {
        const stockEmail =
          normaliseMatchValue(
            stockContact.email,
          );
        const directEmail =
          normaliseMatchValue(
            contact.email,
          );

        return (
          Boolean(stockEmail) &&
          stockEmail === directEmail
        );
      }) ||
      directContacts.find((contact) => {
        const stockName =
          normaliseMatchValue(
            stockContact.organisationName,
          );
        const directName =
          normaliseMatchValue(
            contact.business_name,
          );

        return (
          Boolean(stockName) &&
          stockName === directName
        );
      });

    if (!directContact) {
      return stockContact;
    }

    const workingRating =
      directContact.working_rating || null;

    return {
      ...stockContact,
      rating:
        workingRating ||
        stockContact.rating,
      doNotInvite:
        workingRating ===
          "do_not_invite" ||
        stockContact.doNotInvite,
      needsReview:
        workingRating ===
          "do_not_invite" ||
        workingRating === "ok" ||
        stockContact.needsReview,
      isActive:
        directContact.is_active !== false,
      recordType:
        directContact.service_type ||
        stockContact.recordType,
    };
  });
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
  const [inventoryItems, setInventoryItems] =
    useState<InventoryOption[]>([]);
  const [inventoryLoading, setInventoryLoading] =
    useState(false);
  const [inventoryError, setInventoryError] =
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
  const [ratingFilter, setRatingFilter] = useState("all");
  const [showFilters, setShowFilters] =
    useState(false);
  const [selectedSupplier, setSelectedSupplier] =
    useState<StockSupplierView | null>(null);
  const [detailTab, setDetailTab] =
    useState<DetailTab>("overview");

  const [deleteSupplier, setDeleteSupplier] =
    useState<StockSupplierView | null>(null);
  const [deletePassword, setDeletePassword] =
    useState("");
  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");
  const [deleteReason, setDeleteReason] =
    useState("");
  const [showDeletePassword, setShowDeletePassword] =
    useState(false);
  const [deletingSupplier, setDeletingSupplier] =
    useState(false);
  const [deleteError, setDeleteError] =
    useState("");
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

  const loadInventory = useCallback(async () => {
    setInventoryLoading(true);
    setInventoryError("");

    try {
      const response = await fetch(INVENTORY_API, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: {
          Accept: "application/json",
        },
      });

      const raw = await response.text();
      let payload: InventoryResponse = {};

      if (raw) {
        try {
          payload = JSON.parse(raw) as InventoryResponse;
        } catch {
          throw new Error(
            [
              "Stock Management inventory returned invalid JSON.",
              `HTTP ${response.status}`,
              `Endpoint: ${INVENTORY_API}`,
              `Response: ${raw.slice(0, 500)}`,
            ].join("\n"),
          );
        }
      }

      if (!response.ok || payload.ok === false) {
        throw new Error(
          [
            payload.error ||
              "Inventory items could not be loaded.",
            payload.code
              ? `Code: ${payload.code}`
              : "",
            payload.details
              ? `Details: ${payload.details}`
              : "",
            payload.hint
              ? `Hint: ${payload.hint}`
              : "",
            `HTTP ${response.status}`,
            `Endpoint: ${INVENTORY_API}`,
          ]
            .filter(Boolean)
            .join("\n"),
        );
      }

      const rows =
        payload.items ||
        payload.inventory ||
        [];

      setInventoryItems(
        Array.isArray(rows)
          ? rows.filter(
              (item) => item.isActive !== false,
            )
          : [],
      );
    } catch (loadError) {
      setInventoryItems([]);
      setInventoryError(
        formatErrorForDisplay(loadError),
      );
    } finally {
      setInventoryLoading(false);
    }
  }, []);

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

  const loadDirectEventContacts =
    useCallback(async () => {
      try {
        const response = await fetch(
          EVENT_HUB_CONTACTS_API,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const raw = await response.text();
        let payload:
          DirectEventHubContactsResponse = {};

        if (raw) {
          payload = JSON.parse(
            raw,
          ) as DirectEventHubContactsResponse;
        }

        if (!response.ok || payload.ok === false) {
          throw new Error(
            [
              payload.error ||
                "Event Hub contacts could not be loaded.",
              payload.code
                ? `Code: ${payload.code}`
                : "",
              payload.details
                ? `Details: ${payload.details}`
                : "",
              `HTTP ${response.status}`,
              `Endpoint: ${EVENT_HUB_CONTACTS_API}`,
            ]
              .filter(Boolean)
              .join("\n"),
          );
        }

        const rows =
          Array.isArray(payload.contacts)
            ? payload.contacts
            : [];

        return rows;
      } catch (error) {
        console.error(
          "Direct Event Hub working_rating lookup failed",
          error,
        );
        return [];
      }
    }, []);

  const loadSuppliers = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const json = await requestJson<SupplierListResponse>(
        API,
        {
          method: "GET",
          cache: "no-store",
        },
        "Failed to load Stock Management suppliers.",
      );

      const rows = Array.isArray(json.suppliers)
        ? json.suppliers.map((supplier) => ({
            ...supplier,
            stockRating:
              supplier.stockRating || "not_recorded",
            stockRatingScore:
              supplier.stockRatingScore ?? null,
            stockRatingNotes:
              supplier.stockRatingNotes ?? null,
            stockRatingUpdatedAt:
              supplier.stockRatingUpdatedAt ?? null,
            stockRatingUpdatedByName:
              supplier.stockRatingUpdatedByName ?? null,
          }))
        : [];

      setSuppliers(rows);
      setSelectedSupplier((current) =>
        current
          ? rows.find((row) => row.id === current.id) || null
          : null,
      );
      const normalisedEventContacts =
        Array.isArray(json.eventContacts)
          ? json.eventContacts
              .map((contact) =>
                normaliseEventContact(
                  contact as RawEventHubContact,
                ),
              )
              .filter((contact) =>
                Boolean(contact.id),
              )
          : [];

      const directRows =
        await loadDirectEventContacts();

      const mergedEventContacts =
        mergeWorkingRatings(
          normalisedEventContacts,
          directRows,
        );

      setEventContacts(
        mergedEventContacts,
      );

      if (process.env.NODE_ENV !== "production") {
        console.table(
          mergedEventContacts.map(
            (contact) => ({
              id: contact.id,
              organisation:
                contact.organisationName,
              doNotInvite:
                contact.doNotInvite,
              needsReview:
                contact.needsReview,
            }),
          ),
        );
      }
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
      setPermissions(EMPTY_PERMISSIONS);
    } finally {
      setLoading(false);
    }
  }, [
    loadDirectEventContacts,
  ]);

  useEffect(() => {
    void Promise.all([
      loadSuppliers(),
      loadMoneySuppliers(),
      loadInventory(),
    ]);
  }, [
    loadInventory,
    loadMoneySuppliers,
    loadSuppliers,
  ]);

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
        contact.doNotInvite
          ? "do not use do not invite blocked"
          : "",
        contact.needsReview
          ? "needs review"
          : "",
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
        supplier.stockRating,
        supplier.stockRatingNotes,
        supplier.stockRatingUpdatedByName,
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

      if (
        ratingFilter !== "all" &&
        supplier.stockRating !== ratingFilter
      ) {
        return false;
      }

      return true;
    });
  }, [
    connectionFilter,
    search,
    ratingFilter,
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
      eventDoNotUse: contact.doNotInvite,
      eventNeedsReview:
        contact.needsReview || contact.doNotInvite,
      eventWarningAccepted: false,
      stockRating: contact.doNotInvite
        ? "do_not_use"
        : contact.needsReview
          ? "ok"
          : "not_recorded",
      stockRatingScore: contact.doNotInvite
        ? "1"
        : contact.needsReview
          ? "3"
          : "",
      stockNeedsReview:
        contact.needsReview || contact.doNotInvite,
      ratingWarningAccepted: false,
      stockRatingNotes: contact.doNotInvite
        ? "Event Hub marks this contact Do not use / Do not invite."
        : contact.needsReview
          ? "Event Hub marks this contact as requiring review."
          : "",
      stockNotes: contact.doNotInvite
        ? "Do not invite this contact. Review the saved Event Hub notes before using this supplier. Invitation email and checklist actions are blocked. Stock Control status: Do not use."
        : contact.needsReview
          ? "Event Hub warning: this contact requires review. This warning was carried into Stock Management."
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
        eventDoNotUse: false,
        eventNeedsReview: false,
        eventWarningAccepted: false,
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
      eventDoNotUse:
        selected?.doNotInvite || false,
      eventNeedsReview:
        Boolean(
          selected?.needsReview ||
          selected?.doNotInvite,
        ),
      eventWarningAccepted: false,
      stockRating: selected?.doNotInvite
        ? "do_not_use"
        : selected?.needsReview
          ? "ok"
          : current.stockRating,
      stockRatingScore: selected?.doNotInvite
        ? "1"
        : selected?.needsReview
          ? "3"
          : current.stockRatingScore,
      stockNeedsReview: Boolean(
        selected?.needsReview ||
        selected?.doNotInvite ||
        current.stockNeedsReview,
      ),
      ratingWarningAccepted: false,
      stockRatingNotes: selected?.doNotInvite
        ? "Event Hub marks this contact Do not use / Do not invite."
        : selected?.needsReview
          ? "Event Hub marks this contact as requiring review."
          : current.stockRatingNotes,
      displayName:
        current.displayName ||
        selected?.organisationName ||
        "",
      stockNotes:
        selected?.doNotInvite
          ? "Do not invite this contact. Review the saved Event Hub notes before using this supplier. Invitation email and checklist actions are blocked. Stock Control status: Do not use."
          : selected?.needsReview
            ? "Event Hub warning: this contact requires review. This warning was carried into Stock Management."
            : current.stockNotes,
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

  function selectInventoryItem(
    stockItemId: string,
  ) {
    const selected = inventoryItems.find(
      (item) => item.id === stockItemId,
    );

    setForm((current) => ({
      ...current,
      stockItemId: selected?.id || "",
      stockItemUnitCost:
        selected?.unitCost === null ||
        selected?.unitCost === undefined
          ? current.stockItemUnitCost
          : String(selected.unitCost),
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
          stockRating:
            supplier.stockRating || "not_recorded",
          stockRatingScore:
            supplier.stockRatingScore === null ||
            supplier.stockRatingScore === undefined
              ? ""
              : String(supplier.stockRatingScore),
          stockRatingNotes:
            supplier.stockRatingNotes || "",
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
    auditOverride?: WorkspaceAuditDescriptor,
  ) {
    if (!selectedSupplier) return;

    const audit =
      auditOverride ||
      workspaceAuditForAction(
        endpoint,
        method,
        body,
      );

    setWorkspaceSaving(true);
    setWorkspaceError("");
    setWorkspaceNotice("");

    try {
      const result =
        await requestJson<Record<string, unknown>>(
          endpoint,
          {
            method,
            body: JSON.stringify(body),
          },
          successMessage,
        );

      await reportSupplierAudit({
        action: audit.action,
        status: "success",
        risk: audit.risk || "medium",
        supplierId: selectedSupplier.id,
        recordType:
          audit.recordType || "stock_supplier",
        metadata: {
          supplier_name:
            selectedSupplier.displayName,
          endpoint,
          method,
          integration_event_hub:
            selectedSupplier.eventHub.connected,
          integration_money_management:
            selectedSupplier.moneyManagement.connected,
          ...audit.metadata,
          response_record_id:
            result.id ||
            result.record_id ||
            result.order_id ||
            result.review_id ||
            null,
        },
      });

      setWorkspaceNotice(successMessage);

      const refreshedSupplier = suppliers.find(
        (supplier) =>
          supplier.id === selectedSupplier.id,
      );

      await Promise.all([
        refreshedSupplier
          ? loadSupplierWorkspace(
              refreshedSupplier,
            )
          : Promise.resolve(),
        loadSuppliers(),
        loadMoneySuppliers(),
      ]);
    } catch (actionError) {
      await reportSupplierAudit({
        action:
          audit.failureAction ||
          `${audit.action}_failed`,
        status: "failed",
        risk: audit.risk || "medium",
        supplierId: selectedSupplier.id,
        recordType:
          audit.recordType || "stock_supplier",
        metadata: {
          supplier_name:
            selectedSupplier.displayName,
          endpoint,
          method,
          ...audit.metadata,
        },
        error: actionError,
      });

      setWorkspaceError(
        formatErrorForDisplay(actionError),
      );
    } finally {
      setWorkspaceSaving(false);
    }
  }

  function askActionReason(
    actionLabel: string,
    minimumLength = 10,
  ) {
    const reason = window.prompt(
      `${actionLabel}\n\nEnter a reason of at least ${minimumLength} characters:`,
      "",
    );

    if (reason === null) return null;

    const cleaned = reason.trim();

    if (cleaned.length < minimumLength) {
      setWorkspaceError(
        `A reason of at least ${minimumLength} characters is required.`,
      );
      return null;
    }

    return cleaned;
  }

  function confirmHighRiskAction(message: string) {
    return window.confirm(message);
  }

  async function saveProfileChanges() {
    if (!selectedSupplier || !profileEdit) return;

    const minimumOrderValuePence = profileEdit.minimumOrderValue
      ? parsePoundsToPence(profileEdit.minimumOrderValue)
      : null;
    const usualDeliveryCostPence = profileEdit.usualDeliveryCost
      ? parsePoundsToPence(profileEdit.usualDeliveryCost)
      : null;

    if (
      profileEdit.minimumOrderValue &&
      minimumOrderValuePence === null
    ) {
      setWorkspaceError(
        "Minimum order value must be a valid non-negative amount.",
      );
      return;
    }

    if (
      profileEdit.usualDeliveryCost &&
      usualDeliveryCostPence === null
    ) {
      setWorkspaceError(
        "Usual delivery cost must be a valid non-negative amount.",
      );
      return;
    }

    if (
      profileEdit.stockRatingScore &&
      (Number(profileEdit.stockRatingScore) < 1 ||
        Number(profileEdit.stockRatingScore) > 5)
    ) {
      setWorkspaceError(
        "Stock rating score must be between 1 and 5.",
      );
      return;
    }

    let reason: string | null = null;

    if (
      (profileEdit.doNotUse &&
        !selectedSupplier.doNotUse) ||
      (profileEdit.stockRating === "do_not_use" &&
        selectedSupplier.stockRating !== "do_not_use")
    ) {
      reason = askActionReason(
        "Mark this supplier as do not use?",
      );

      if (!reason) return;
    }

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
          minimumOrderValuePence,
        usual_delivery_cost_pence:
          usualDeliveryCostPence,
        stock_notes:
          profileEdit.stockNotes.trim() || null,
        is_active: profileEdit.isActive,
        needs_review: profileEdit.needsReview,
        do_not_use: profileEdit.doNotUse,
        stock_rating: profileEdit.stockRating,
        stock_rating_score:
          profileEdit.stockRating === "not_recorded"
            ? null
            : profileEdit.stockRatingScore
              ? Number(profileEdit.stockRatingScore)
              : ratingScoreFromValue(
                  profileEdit.stockRating,
                  null,
                ),
        stock_rating_notes:
          profileEdit.stockRatingNotes.trim() || null,
        reason,
      },
      "The Stock Management supplier profile was updated.",
      {
        action:
          profileEdit.doNotUse &&
          !selectedSupplier.doNotUse
            ? "stock.supplier.blocked"
            : !profileEdit.isActive &&
                selectedSupplier.isActive
              ? "stock.supplier.archived"
              : profileEdit.isActive &&
                  !selectedSupplier.isActive
                ? "stock.supplier.reactivated"
                : "stock.supplier.updated",
        failureAction:
          "stock.supplier.update_failed",
        risk:
          profileEdit.doNotUse ||
          !profileEdit.isActive
            ? "high"
            : "medium",
        metadata: {
          previous_name:
            selectedSupplier.displayName,
          new_name:
            profileEdit.displayName.trim(),
          supplier_use:
            profileEdit.supplierUse,
          is_active:
            profileEdit.isActive,
          needs_review:
            profileEdit.needsReview,
          do_not_use:
            profileEdit.doNotUse,
          stock_rating:
            profileEdit.stockRating,
          stock_rating_score:
            profileEdit.stockRatingScore || null,
          reason,
        },
      },
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

      await reportSupplierAudit({
        action:
          "stock.supplier.workspace_exported",
        status: "success",
        risk: "low",
        supplierId: selectedSupplier.id,
        recordType: "stock_supplier_report",
        metadata: {
          supplier_name:
            selectedSupplier.displayName,
          export_format: "xlsx",
          file_name: link.download,
          item_link_count:
            workspace.itemLinks.length,
          order_count:
            workspace.orders.length,
          review_count:
            workspace.reviews.length,
          historic_event_count:
            workspace.historicEvents.length,
          audit_history_count:
            workspace.auditLogs.length,
          includes_compliance: true,
          includes_event_hub:
            selectedSupplier.eventHub.connected,
          includes_money_management:
            selectedSupplier.moneyManagement.connected,
        },
      });

      setWorkspaceNotice(
        "The multi-sheet supplier workbook was downloaded.",
      );
    } catch (exportError) {
      await reportSupplierAudit({
        action:
          "stock.supplier.workspace_export_failed",
        status: "failed",
        risk: "medium",
        supplierId: selectedSupplier.id,
        recordType: "stock_supplier_report",
        metadata: {
          supplier_name:
            selectedSupplier.displayName,
          export_format: "xlsx",
        },
        error: exportError,
      });

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

    if (
      form.eventDoNotUse &&
      !form.eventWarningAccepted
    ) {
      setNotice(
        "This Event Hub contact is marked Do not use / Do not invite. Tick the warning confirmation before creating the Stock Management supplier.",
      );
      return;
    }

    const stockItemUnitCostPence =
      form.stockItemUnitCost
        ? parsePoundsToPence(
            form.stockItemUnitCost,
          )
        : null;

    if (
      form.stockItemUnitCost &&
      stockItemUnitCostPence === null
    ) {
      setNotice(
        "The inventory item unit cost must be a valid non-negative amount.",
      );
      return;
    }

    if (
      form.stockItemMinimumOrderQuantity &&
      (!Number.isInteger(
        Number(
          form.stockItemMinimumOrderQuantity,
        ),
      ) ||
        Number(
          form.stockItemMinimumOrderQuantity,
        ) < 0)
    ) {
      setNotice(
        "The inventory minimum order quantity must be a whole number of zero or more.",
      );
      return;
    }

    if (
      form.stockItemLeadTimeDays &&
      (!Number.isInteger(
        Number(form.stockItemLeadTimeDays),
      ) ||
        Number(form.stockItemLeadTimeDays) < 0)
    ) {
      setNotice(
        "The inventory lead time must be a whole number of zero or more.",
      );
      return;
    }

    if (
      form.stockRating !== "not_recorded" &&
      (
        !Number.isInteger(Number(form.stockRatingScore)) ||
        Number(form.stockRatingScore) < 1 ||
        Number(form.stockRatingScore) > 5
      )
    ) {
      setNotice(
        "Choose a Stock Control rating score between 1 and 5.",
      );
      return;
    }

    if (
      (form.stockRating === "poor" ||
        form.stockRating === "do_not_use") &&
      form.stockRatingNotes.trim().length < 10
    ) {
      setNotice(
        "Add review notes of at least 10 characters when the rating is Poor or Do not use.",
      );
      return;
    }

    if (
      form.stockRating === "do_not_use" &&
      !form.ratingWarningAccepted
    ) {
      setNotice(
        "Tick the Stock Control Do not use confirmation before creating this supplier.",
      );
      return;
    }

    const detailedReviewScores = [
      form.reviewDeliveryRating,
      form.reviewQualityRating,
      form.reviewCommunicationRating,
      form.reviewValueRating,
    ].filter(Boolean);

    if (
      form.createInitialReview &&
      detailedReviewScores.some(
        (value) =>
          !Number.isInteger(Number(value)) ||
          Number(value) < 1 ||
          Number(value) > 5,
      )
    ) {
      setNotice(
        "Every detailed review score must be a whole number between 1 and 5.",
      );
      return;
    }

    setCreating(true);
    setNotice("");

    try {
      const createPayload = {
        display_name: form.displayName.trim(),
        supplier_use: form.supplierUse,
        usual_delivery_days:
          form.usualDeliveryDays
            ? Number(form.usualDeliveryDays)
            : null,
        minimum_order_value_pence:
          minimumOrderValuePence,
        usual_delivery_cost_pence:
          usualDeliveryCostPence,
        stock_notes:
          form.stockNotes.trim() || null,
        stock_rating: form.stockRating,
        stock_rating_score:
          form.stockRating === "not_recorded"
            ? null
            : Number(form.stockRatingScore),
        stock_rating_notes:
          form.stockRatingNotes.trim() || null,
        event_record_type:
          form.eventRecordType.trim() || null,
        event_record_id:
          form.eventRecordId.trim() || null,
        do_not_use:
          form.eventDoNotUse ||
          form.stockRating === "do_not_use",
        needs_review:
          form.eventNeedsReview ||
          form.stockNeedsReview ||
          form.stockRating === "ok" ||
          form.stockRating === "poor" ||
          form.stockRating === "do_not_use",
        money_supplier_id:
          form.moneySupplierId.trim() || null,
      };

      const result =
        await requestJson<Record<string, unknown>>(
          API,
          {
            method: "POST",
            body: JSON.stringify(createPayload),
          },
          "Supplier creation failed.",
        );

      const createdSupplier =
        result.supplier &&
        typeof result.supplier === "object"
          ? (result.supplier as Record<
              string,
              unknown
            >)
          : null;

      const createdSupplierId = String(
        createdSupplier?.id ||
          result.supplier_id ||
          result.id ||
          "",
      ) || null;

      const creationSource =
        createPayload.event_record_id &&
        createPayload.money_supplier_id
          ? "event_hub_and_money_management"
          : createPayload.event_record_id
            ? "event_hub"
            : createPayload.money_supplier_id
              ? "money_management"
              : "manual";

      await reportSupplierAudit({
        action:
          creationSource === "event_hub"
            ? "stock.supplier.created_from_event_hub"
            : creationSource ===
                "money_management"
              ? "stock.supplier.created_from_money_management"
              : creationSource ===
                  "event_hub_and_money_management"
                ? "stock.supplier.created_fully_connected"
                : "stock.supplier.created",
        status: "success",
        risk: "medium",
        supplierId: createdSupplierId,
        metadata: {
          supplier_name:
            createPayload.display_name,
          supplier_use:
            createPayload.supplier_use,
          creation_source: creationSource,
          event_record_type:
            createPayload.event_record_type,
          event_record_id:
            createPayload.event_record_id,
          money_supplier_id:
            createPayload.money_supplier_id,
          connected_to_event_hub:
            Boolean(
              createPayload.event_record_id,
            ),
          event_do_not_use:
            createPayload.do_not_use,
          event_needs_review:
            createPayload.needs_review,
          event_warning_accepted:
            form.eventWarningAccepted,
          connected_to_money_management:
            Boolean(
              createPayload.money_supplier_id,
            ),
          usual_delivery_days:
            createPayload.usual_delivery_days,
          minimum_order_value_pence:
            createPayload.minimum_order_value_pence,
          usual_delivery_cost_pence:
            createPayload.usual_delivery_cost_pence,
          inventory_item_id:
            form.stockItemId || null,
          stock_rating: form.stockRating,
          stock_rating_score:
            form.stockRatingScore || null,
          stock_needs_review:
            form.stockNeedsReview,
          create_initial_review:
            form.createInitialReview,
          inventory_supplier_role:
            form.stockItemId
              ? form.stockItemRole
              : null,
          inventory_supplier_sku:
            form.stockItemSupplierSku.trim() ||
            null,
        },
      });

      if (
        form.eventDoNotUse &&
        createdSupplierId
      ) {
        await reportSupplierAudit({
          action:
            "stock.supplier.event_hub_warning_accepted",
          status: "warning",
          risk: "high",
          supplierId:
            createdSupplierId,
          metadata: {
            supplier_name:
              createPayload.display_name,
            event_record_id:
              createPayload.event_record_id,
            event_record_type:
              createPayload.event_record_type,
            event_do_not_use: true,
            event_needs_review:
              createPayload.needs_review,
            warning_carried_into_stock_management:
              true,
          },
        });
      }

      let inventoryLinkWarning = "";

      if (
        form.stockItemId &&
        createdSupplierId
      ) {
        const selectedInventoryItem =
          inventoryItems.find(
            (item) =>
              item.id === form.stockItemId,
          );

        const itemLinkPayload = {
          stock_item_id:
            form.stockItemId,
          stock_item_name:
            selectedInventoryItem?.name ||
            null,
          supplier_role:
            form.stockItemRole,
          supplier_sku:
            form.stockItemSupplierSku.trim() ||
            null,
          unit_cost_pence:
            stockItemUnitCostPence,
          minimum_order_quantity:
            form.stockItemMinimumOrderQuantity
              ? Number(
                  form.stockItemMinimumOrderQuantity,
                )
              : null,
          lead_time_days:
            form.stockItemLeadTimeDays
              ? Number(
                  form.stockItemLeadTimeDays,
                )
              : null,
        };

        try {
          await requestJson<Record<string, unknown>>(
            `${API}/${createdSupplierId}/item-links`,
            {
              method: "POST",
              body: JSON.stringify(
                itemLinkPayload,
              ),
            },
            "The supplier was created, but the inventory item could not be linked.",
          );

          await reportSupplierAudit({
            action:
              "stock.supplier.item_link_created",
            status: "success",
            risk: "medium",
            supplierId:
              createdSupplierId,
            recordType:
              "stock_supplier_item_link",
            metadata: {
              supplier_name:
                createPayload.display_name,
              stock_item_id:
                itemLinkPayload.stock_item_id,
              stock_item_name:
                itemLinkPayload.stock_item_name,
              supplier_role:
                itemLinkPayload.supplier_role,
              supplier_sku:
                itemLinkPayload.supplier_sku,
              unit_cost_pence:
                itemLinkPayload.unit_cost_pence,
              minimum_order_quantity:
                itemLinkPayload.minimum_order_quantity,
              lead_time_days:
                itemLinkPayload.lead_time_days,
              created_during_supplier_setup:
                true,
            },
          });
        } catch (linkError) {
          inventoryLinkWarning =
            "\n\nThe supplier was created, but the selected inventory item could not be connected. Open the supplier details and add the item from the Stock Items tab.\n\n" +
            formatErrorForDisplay(linkError);

          await reportSupplierAudit({
            action:
              "stock.supplier.item_link_action_failed",
            status: "failed",
            risk: "medium",
            supplierId:
              createdSupplierId,
            recordType:
              "stock_supplier_item_link",
            metadata: {
              supplier_name:
                createPayload.display_name,
              stock_item_id:
                itemLinkPayload.stock_item_id,
              stock_item_name:
                itemLinkPayload.stock_item_name,
              supplier_role:
                itemLinkPayload.supplier_role,
              created_during_supplier_setup:
                true,
            },
            error: linkError,
          });
        }
      }

      let initialReviewWarning = "";

      if (
        form.createInitialReview &&
        createdSupplierId
      ) {
        try {
          await requestJson<Record<string, unknown>>(
            `${API}/${createdSupplierId}/reviews`,
            {
              method: "POST",
              body: JSON.stringify({
                rating: form.stockRating,
                delivery_rating:
                  form.reviewDeliveryRating
                    ? Number(form.reviewDeliveryRating)
                    : null,
                quality_rating:
                  form.reviewQualityRating
                    ? Number(form.reviewQualityRating)
                    : null,
                communication_rating:
                  form.reviewCommunicationRating
                    ? Number(form.reviewCommunicationRating)
                    : null,
                value_rating:
                  form.reviewValueRating
                    ? Number(form.reviewValueRating)
                    : null,
                notes:
                  form.stockRatingNotes.trim() || null,
              }),
            },
            "The supplier was created, but the first review could not be saved.",
          );

          await reportSupplierAudit({
            action: "stock.supplier.review_created",
            status: "success",
            risk:
              form.stockRating === "do_not_use"
                ? "high"
                : form.stockRating === "poor"
                  ? "medium"
                  : "low",
            supplierId: createdSupplierId,
            recordType: "stock_supplier_review",
            metadata: {
              supplier_name:
                createPayload.display_name,
              rating: form.stockRating,
              rating_score:
                createPayload.stock_rating_score,
              created_during_supplier_setup: true,
            },
          });
        } catch (reviewError) {
          initialReviewWarning =
            "\n\nThe supplier was created, but the first detailed review could not be saved. Open the supplier Review History tab and add it again.\n\n" +
            formatErrorForDisplay(reviewError);
        }
      }

      setAddOpen(false);
      setForm(EMPTY_FORM);
      setNotice(
        `The Stock Management supplier profile has been created.${
          form.eventDoNotUse
            ? " The Event Hub Do not use warning was carried into Stock Management."
            : form.eventNeedsReview
              ? " The Event Hub Needs review warning was carried into Stock Management."
              : ""
        }${
          form.stockItemId && !inventoryLinkWarning
            ? " The selected inventory item was connected to this supplier."
            : ""
        }${
          form.createInitialReview && !initialReviewWarning
            ? " The first Stock Control review was saved."
            : ""
        }${inventoryLinkWarning}${initialReviewWarning}`,
      );

      await Promise.all([
        loadSuppliers(),
        loadInventory(),
      ]);
    } catch (createError) {
      await reportSupplierAudit({
        action:
          "stock.supplier.create_failed",
        status: "failed",
        risk: "medium",
        metadata: {
          supplier_name:
            form.displayName.trim() || null,
          supplier_use: form.supplierUse,
          event_record_type:
            form.eventRecordType.trim() || null,
          event_record_id:
            form.eventRecordId.trim() || null,
          money_supplier_id:
            form.moneySupplierId.trim() || null,
          connected_to_event_hub:
            Boolean(form.eventRecordId.trim()),
          event_do_not_use:
            form.eventDoNotUse,
          event_needs_review:
            form.eventNeedsReview,
          event_warning_accepted:
            form.eventWarningAccepted,
          connected_to_money_management:
            Boolean(form.moneySupplierId.trim()),
          inventory_item_id:
            form.stockItemId || null,
          inventory_supplier_role:
            form.stockItemId
              ? form.stockItemRole
              : null,
        },
        error: createError,
      });

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

      await reportSupplierAudit({
        action: "stock.supplier.exported",
        status: "success",
        risk: "low",
        recordType: "stock_supplier_report",
        metadata: {
          export_format: "xlsx",
          file_name: link.download,
          row_count:
            filteredSuppliers.length,
          total_supplier_count:
            suppliers.length,
          search: search.trim() || null,
          connection_filter:
            connectionFilter,
          status_filter: statusFilter,
          supplier_use_filter: useFilter,
          stock_rating_filter: ratingFilter,
          event_hub_connected_count:
            summary.connectedToEventHub,
          money_management_connected_count:
            summary.connectedToMoneyManagement,
          fully_connected_count:
            summary.fullyConnected,
          open_order_count:
            summary.openOrders,
          overdue_delivery_count:
            summary.overdueDeliveries,
        },
      });

      setNotice(
        "The connected supplier Excel workbook has been created.",
      );
    } catch (exportError) {
      await reportSupplierAudit({
        action:
          "stock.supplier.export_failed",
        status: "failed",
        risk: "medium",
        recordType: "stock_supplier_report",
        metadata: {
          export_format: "xlsx",
          row_count:
            filteredSuppliers.length,
          search: search.trim() || null,
          connection_filter:
            connectionFilter,
          status_filter: statusFilter,
          supplier_use_filter: useFilter,
          stock_rating_filter: ratingFilter,
        },
        error: exportError,
      });

      setNotice(formatErrorForDisplay(exportError));
    } finally {
      setExporting(false);
    }
  }

  function printReport() {
    window.print();
  }

  function openSupplierEditor(
    supplier: StockSupplierView,
  ) {
    setSelectedSupplier(supplier);
    setDetailTab("admin");
    setWorkspaceError("");
    setWorkspaceNotice("");
  }

  function openSupplierDelete(
    supplier: StockSupplierView,
  ) {
    setDeleteSupplier(supplier);
    setDeletePassword("");
    setDeleteConfirmation("");
    setDeleteReason("");
    setShowDeletePassword(false);
    setDeleteError("");
  }

  function closeSupplierDelete() {
    if (deletingSupplier) return;

    setDeleteSupplier(null);
    setDeletePassword("");
    setDeleteConfirmation("");
    setDeleteReason("");
    setShowDeletePassword(false);
    setDeleteError("");
  }

  async function permanentlyDeleteSupplier() {
    if (!deleteSupplier || deletingSupplier) return;

    const supplierName =
      deleteSupplier.displayName.trim();

    if (deleteReason.trim().length < 10) {
      setDeleteError(
        "Enter a deletion reason of at least 10 characters.",
      );
      return;
    }

    if (deleteConfirmation !== supplierName) {
      setDeleteError(
        `Type the supplier name exactly: ${supplierName}`,
      );
      return;
    }

    if (!deletePassword.trim()) {
      setDeleteError(
        "Enter the signed-in main admin password.",
      );
      return;
    }

    setDeletingSupplier(true);
    setDeleteError("");
    setNotice("");

    try {
      const response = await fetch(
        `${API}/${deleteSupplier.id}`,
        {
          method: "DELETE",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            permanent: true,
            reason: deleteReason.trim(),
            confirmation: deleteConfirmation,
            password: deletePassword,
          }),
        },
      );

      if (!response.ok) {
        throw await readApiError(
          response,
          "The supplier could not be permanently deleted.",
        );
      }

      const payload = (await response
        .json()
        .catch(() => ({}))) as {
        ok?: boolean;
        message?: string;
        error?: string;
        deletedSupplierId?: string;
      };

      if (payload.ok === false) {
        throw new Error(
          payload.error ||
            "The supplier could not be permanently deleted.",
        );
      }

      const deletedName =
        deleteSupplier.displayName;
      const deletedId =
        deleteSupplier.id;

      await reportSupplierAudit({
        action: "stock.supplier.deleted",
        status: "success",
        risk: "critical",
        supplierId: deletedId,
        metadata: {
          supplier_name: deletedName,
          deletion_reason:
            deleteReason.trim(),
          had_event_hub_connection:
            deleteSupplier.eventHub.connected,
          event_record_id:
            deleteSupplier.eventHub.recordId,
          had_money_management_connection:
            deleteSupplier.moneyManagement.connected,
          money_supplier_id:
            deleteSupplier.moneyManagement.supplierId,
          open_order_count:
            deleteSupplier.stockManagement.openOrderCount,
          source_records_deleted: false,
        },
      });

      setDeleteSupplier(null);
      setDeletePassword("");
      setDeleteConfirmation("");
      setDeleteReason("");
      setShowDeletePassword(false);

      if (selectedSupplier?.id === deletedId) {
        setSelectedSupplier(null);
        setWorkspace(EMPTY_WORKSPACE);
        setProfileEdit(null);
      }

      setNotice(
        payload.message ||
          `${deletedName} was permanently deleted from Stock Management.`,
      );

      await Promise.all([
        loadSuppliers(),
        loadMoneySuppliers(),
      ]);
    } catch (deleteRequestError) {
      await reportSupplierAudit({
        action: "stock.supplier.delete_failed",
        status: "failed",
        risk: "critical",
        supplierId: deleteSupplier.id,
        metadata: {
          supplier_name:
            deleteSupplier.displayName,
          deletion_reason:
            deleteReason.trim() || null,
          confirmation_entered:
            Boolean(deleteConfirmation),
          password_entered:
            Boolean(deletePassword),
        },
        error: deleteRequestError,
      });

      setDeleteError(
        formatErrorForDisplay(
          deleteRequestError,
        ),
      );
    } finally {
      setDeletingSupplier(false);
    }
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
                    void Promise.all([
                      loadMoneySuppliers(),
                      loadInventory(),
                    ]);
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
                    loadInventory(),
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
            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4 md:grid-cols-2 xl:grid-cols-4">
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

              <label>
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Stock rating
                </span>
                <select
                  value={ratingFilter}
                  onChange={(event) =>
                    setRatingFilter(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                >
                  <option value="all">All ratings</option>
                  <option value="excellent">Excellent</option>
                  <option value="good">Good</option>
                  <option value="ok">Okay</option>
                  <option value="poor">Poor</option>
                  <option value="do_not_use">Do not use</option>
                  <option value="not_recorded">Not rated</option>
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
              <div className="grid gap-5 p-5 sm:grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
                {filteredEventContacts.map((contact) => (
                  <article
                    key={`${contact.recordType}-${contact.id}`}
                    className={`rounded-3xl border p-5 sm:p-6 ${
                      contact.doNotInvite
                        ? "border-red-300/35 bg-red-500/10 shadow-[0_18px_50px_rgba(127,29,29,0.18)]"
                        : contact.needsReview
                          ? "border-amber-300/25 bg-amber-500/10"
                          : contact.linkedStockSupplierId
                            ? "border-emerald-300/20 bg-emerald-500/10"
                            : "border-violet-300/15 bg-black/25"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="break-words text-xl font-black text-white">
                          {contact.organisationName ||
                            contact.contactName ||
                            "Unnamed Event Hub contact"}
                        </h3>

                        {contact.contactName &&
                        contact.contactName !==
                          contact.organisationName ? (
                          <p className="mt-1 text-sm text-white/60">
                            {contact.contactName}
                          </p>
                        ) : null}
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-black ring-1 ${
                          contact.doNotInvite
                            ? "bg-red-500/20 text-red-100 ring-red-300/30"
                            : contact.linkedStockSupplierId
                              ? "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20"
                              : "bg-white/10 text-white/50 ring-white/10"
                        }`}
                      >
                        {contact.doNotInvite
                          ? "Do not use"
                          : contact.linkedStockSupplierId
                            ? "Connected"
                            : "Not connected"}
                      </span>
                    </div>

                    <div className="mt-4 space-y-2 text-sm">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="block break-all rounded-xl bg-white/[0.05] p-3 text-cyan-100 hover:bg-white/[0.09]"
                        >
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-white/35">
                            Email
                          </span>
                          {contact.email}
                        </a>
                      ) : (
                        <div className="rounded-xl bg-white/[0.05] p-3">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-white/35">
                            Email
                          </span>
                          <span className="text-white/45">
                            Not recorded
                          </span>
                        </div>
                      )}

                      {contact.phone ? (
                        <a
                          href={`tel:${contact.phone}`}
                          className="block rounded-xl bg-white/[0.05] p-3 text-cyan-100 hover:bg-white/[0.09]"
                        >
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-white/35">
                            Phone
                          </span>
                          {contact.phone}
                        </a>
                      ) : (
                        <div className="rounded-xl bg-white/[0.05] p-3">
                          <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-white/35">
                            Phone
                          </span>
                          <span className="text-white/45">
                            Not recorded
                          </span>
                        </div>
                      )}

                      <div className="grid gap-2 sm:grid-cols-2">
                        <div className="rounded-xl bg-white/[0.05] p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-white/35">
                            Event
                          </p>
                          <p className="mt-1 text-white/75">
                            {[
                              contact.eventName,
                              contact.eventYear,
                            ]
                              .filter(Boolean)
                              .join(" ") ||
                              "Not recorded"}
                          </p>
                        </div>

                        <div className="rounded-xl bg-white/[0.05] p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-white/35">
                            Rating
                          </p>
                          <p
                            className={`mt-1 font-bold ${
                              contact.doNotInvite
                                ? "text-red-100"
                                : contact.needsReview
                                  ? "text-amber-100"
                                  : "text-white/75"
                            }`}
                          >
                            {contact.rating ===
                            "do_not_invite"
                              ? "Do not invite"
                              : contact.rating === "ok"
                                ? "Okay"
                                : contact.rating === "good"
                                  ? "Good to work with"
                                  : "Not recorded"}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full bg-violet-500/10 px-3 py-1 text-xs font-black text-violet-100 ring-1 ring-violet-300/20">
                        {formatLabel(contact.recordType)}
                      </span>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${
                          contact.isActive === false
                            ? "bg-white/10 text-white/45 ring-white/10"
                            : "bg-emerald-500/10 text-emerald-100 ring-emerald-300/20"
                        }`}
                      >
                        {contact.isActive === false
                          ? "Inactive Event contact"
                          : "Active Event contact"}
                      </span>

                      {contact.needsReview &&
                      !contact.doNotInvite ? (
                        <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-black text-amber-100 ring-1 ring-amber-300/20">
                          Needs review
                        </span>
                      ) : null}
                    </div>

                    {contact.doNotInvite ? (
                      <div className="mt-3 rounded-xl border border-red-300/30 bg-red-500/15 p-3 text-xs font-black text-red-100">
                        Event Hub warning: Do not invite
                      </div>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2 print:hidden">
                      <Link
                        href={`/Admin/EventHub/Contacts?contact_id=${contact.id}`}
                        className="inline-flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-500/10 px-3 py-2 text-xs font-black text-violet-100 hover:bg-violet-500/20"
                      >
                        Open Event contact
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>

                      {contact.linkedStockSupplierId ? (
                        <Link
                          href={`/Admin/StockManagement/Suppliers/${contact.linkedStockSupplierId}`}
                          className="inline-flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 hover:bg-emerald-500/20"
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
                          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black ${
                            contact.doNotInvite
                              ? "border-red-300/30 bg-red-500/15 text-red-100 hover:bg-red-500/25"
                              : "border-cyan-300/20 bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20"
                          }`}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          {contact.doNotInvite
                            ? "Review and create supplier"
                            : "Find matching supplier"}
                        </button>
                      ) : null}
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
                    <th className="px-4 py-3">Stock rating</th>
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
                      supplier.stockRating === "poor"
                        ? "Poor Stock rating"
                        : null,
                      supplier.stockRating === "do_not_use"
                        ? "Stock rating: do not use"
                        : null,
                    ].filter(Boolean);

                    return (
                      <tr
                        key={supplier.id}
                        className={`align-top hover:bg-white/[0.035] ${
                          supplier.stockRating === "do_not_use" ||
                          supplier.stockRating === "poor"
                            ? "bg-red-500/[0.06]"
                            : ""
                        }`}
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
                          <StockRatingBadge
                            rating={supplier.stockRating || "not_recorded"}
                            score={supplier.stockRatingScore}
                          />
                          {supplier.stockRatingNotes ? (
                            <p className="mt-2 max-w-56 line-clamp-2 text-xs text-white/45">
                              {supplier.stockRatingNotes}
                            </p>
                          ) : null}
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
                          <div className="flex flex-wrap justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSupplier(supplier);
                                setDetailTab("overview");
                              }}
                              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-white/70 hover:bg-white/10"
                            >
                              View details
                              <ArrowRight className="h-3.5 w-3.5" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openSupplierEditor(supplier)
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300/20 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-100 hover:bg-blue-500/20"
                              title={
                                permissions.edit
                                  ? "Edit this supplier"
                                  : "The API will check your permission before saving"
                              }
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openSupplierDelete(supplier)
                              }
                              className="inline-flex items-center gap-1.5 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/20"
                              title="Permanent deletion requires a main admin password"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
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

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setDetailTab("admin")
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-blue-300/20 bg-blue-500/10 px-3 py-2 text-xs font-black text-blue-100 hover:bg-blue-500/20"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit supplier
                </button>

                <button
                  type="button"
                  onClick={() =>
                    openSupplierDelete(
                      selectedSupplier,
                    )
                  }
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-300/20 bg-red-500/10 px-3 py-2 text-xs font-black text-red-100 hover:bg-red-500/20"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete supplier
                </button>

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

                  <div className={`rounded-2xl border p-4 lg:col-span-2 ${stockRatingClasses(
                    selectedSupplier.stockRating || "not_recorded",
                  )}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wide opacity-70">
                          Stock Control rating
                        </p>
                        <p className="mt-2 text-lg font-black">
                          {stockRatingLabel(
                            selectedSupplier.stockRating || "not_recorded",
                          )}
                        </p>
                      </div>
                      <StockRatingBadge
                        rating={selectedSupplier.stockRating || "not_recorded"}
                        score={selectedSupplier.stockRatingScore}
                        compact
                      />
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-6 opacity-80">
                      {selectedSupplier.stockRatingNotes ||
                        "No Stock Control rating notes recorded."}
                    </p>
                    <p className="mt-3 text-xs opacity-55">
                      Last updated: {formatDate(
                        selectedSupplier.stockRatingUpdatedAt,
                      )}
                      {selectedSupplier.stockRatingUpdatedByName
                        ? ` by ${selectedSupplier.stockRatingUpdatedByName}`
                        : ""}
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
                                onClick={() => {
                                  const reason = askActionReason(
                                    `Remove ${link.stockItemName} from this supplier?`,
                                  );
                                  if (!reason) return;

                                  void runWorkspaceAction(
                                    `${API}/${selectedSupplier.id}/item-links/${link.id}`,
                                    "DELETE",
                                    { reason },
                                    "The item supplier link was removed.",
                                  );
                                }}
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
                                  onClick={() => {
                                    if (
                                      !confirmHighRiskAction(
                                        `Delete purchase order ${order.orderNumber}? This cannot be undone.`,
                                      )
                                    ) {
                                      return;
                                    }

                                    const reason = askActionReason(
                                      `Delete purchase order ${order.orderNumber}?`,
                                    );
                                    if (!reason) return;

                                    void runWorkspaceAction(
                                      `${API}/${selectedSupplier.id}/orders/${order.id}`,
                                      "DELETE",
                                      { reason },
                                      "The purchase order was deleted.",
                                    );
                                  }}
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
                        <select
                          value={profileEdit.stockRating}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    stockRating:
                                      event.target.value as StockSupplierRating,
                                    stockRatingScore:
                                      String(
                                        ratingScoreFromValue(
                                          event.target.value as StockSupplierRating,
                                          null,
                                        ) || "",
                                      ),
                                  }
                                : current,
                            )
                          }
                          className={`rounded-xl border px-3 py-3 text-sm font-black ${stockRatingClasses(
                            profileEdit.stockRating,
                          )}`}
                        >
                          <option value="not_recorded">Not rated</option>
                          <option value="excellent">Excellent</option>
                          <option value="good">Good</option>
                          <option value="ok">Okay</option>
                          <option value="poor">Poor</option>
                          <option value="do_not_use">Do not use</option>
                        </select>
                        <input
                          value={profileEdit.stockRatingScore}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    stockRatingScore:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          type="number"
                          min="1"
                          max="5"
                          placeholder="Stock rating score 1-5"
                          disabled={profileEdit.stockRating === "not_recorded"}
                          className="rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none disabled:opacity-40"
                        />
                        <textarea
                          value={profileEdit.stockRatingNotes}
                          onChange={(event) =>
                            setProfileEdit((current) =>
                              current
                                ? {
                                    ...current,
                                    stockRatingNotes:
                                      event.target.value,
                                  }
                                : current,
                            )
                          }
                          placeholder="Why this Stock Control rating was given"
                          className="min-h-24 rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm outline-none md:col-span-2"
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
                        onClick={() => {
                          const reason = askActionReason(
                            "Unlink this Event Hub record? The Event Hub contact will not be deleted.",
                          );
                          if (!reason) return;

                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/connections/event-hub`,
                            "DELETE",
                            { reason },
                            "The Event Hub connection was removed.",
                          );
                        }}
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
                        onClick={() => {
                          const reason = askActionReason(
                            "Unlink this Money Management supplier? The financial supplier will not be deleted.",
                          );
                          if (!reason) return;

                          void runWorkspaceAction(
                            `${API}/${selectedSupplier.id}/connections/money-management`,
                            "DELETE",
                            { reason },
                            "The Money Management connection was removed.",
                          );
                        }}
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
                      onClick={() => {
                        const reason = askActionReason(
                          "Migrate this supplier to the central organisation model?",
                        );
                        if (!reason) return;

                        void runWorkspaceAction(
                          `${API}/${selectedSupplier.id}/organisation/migrate`,
                          "POST",
                          {
                            organisation_name:
                              selectedSupplier.displayName,
                            reason,
                          },
                          "The supplier was migrated or linked to the central organisation record.",
                        );
                      }}
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
                      onClick={() => {
                        const target = workspace.duplicateCandidates.find(
                          (candidate) => candidate.id === mergeTargetId,
                        );

                        if (
                          !confirmHighRiskAction(
                            `Merge ${selectedSupplier.displayName} into ${
                              target?.displayName || "the selected supplier"
                            }? The current supplier profile will be permanently removed.`,
                          )
                        ) {
                          return;
                        }

                        const reason = askActionReason(
                          "Why are these supplier profiles being merged?",
                        );
                        if (!reason) return;

                        void runWorkspaceAction(
                          `${API}/${selectedSupplier.id}/merge`,
                          "POST",
                          {
                            target_supplier_id:
                              mergeTargetId,
                            reason,
                          },
                          "The duplicate supplier records were merged.",
                        );
                      }}
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
                          onClick={() => {
                            const reason = askActionReason(
                              "Why is the main-admin override being removed?",
                            );
                            if (!reason) return;

                            void runWorkspaceAction(
                              `${API}/${selectedSupplier.id}/override`,
                              "DELETE",
                              { reason },
                              "The main-admin override was removed.",
                            );
                          }}
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

      {deleteSupplier ? (
        <div
          className="fixed inset-0 z-[170] flex items-center justify-center p-3 print:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Permanently delete supplier"
        >
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            onClick={closeSupplierDelete}
            aria-label="Close delete supplier window"
          />

          <div className="relative flex max-h-[94vh] w-full max-w-2xl flex-col overflow-hidden rounded-[30px] border border-red-300/20 bg-[#171020] shadow-2xl">
            <header className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-red-300/20 bg-red-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-red-100">
                  <LockKeyhole className="h-3.5 w-3.5" />
                  Main admin confirmation
                </div>

                <h2 className="mt-3 text-2xl font-black">
                  Delete {deleteSupplier.displayName}
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/55">
                  This permanently removes the Stock
                  Management supplier profile. The original
                  Event Hub contact and Money Management
                  supplier are not deleted.
                </p>
              </div>

              <button
                type="button"
                onClick={closeSupplierDelete}
                disabled={deletingSupplier}
                className="rounded-xl border border-white/10 p-2 text-white/60 hover:bg-white/10 disabled:opacity-50"
                aria-label="Close delete supplier window"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-red-100" />
                  <div>
                    <p className="font-black text-red-50">
                      Permanent and audited action
                    </p>
                    <p className="mt-1 text-sm leading-6 text-red-50/65">
                      The server checks the signed-in main
                      admin password. The password is never
                      stored in the supplier profile or audit
                      metadata.
                    </p>
                  </div>
                </div>
              </div>

              {deleteSupplier.stockManagement
                .openOrderCount > 0 ? (
                <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
                  This supplier currently has{" "}
                  {
                    deleteSupplier.stockManagement
                      .openOrderCount
                  }{" "}
                  open order
                  {deleteSupplier.stockManagement
                    .openOrderCount === 1
                    ? ""
                    : "s"}
                  . The API may block permanent deletion to
                  protect the purchasing and financial audit
                  trail. You can edit the supplier and turn
                  Active off instead.
                </div>
              ) : null}

              {deleteError ? (
                <pre className="whitespace-pre-wrap break-words rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-xs leading-6 text-red-100">
                  {deleteError}
                </pre>
              ) : null}

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/45">
                  Deletion reason
                </span>
                <textarea
                  value={deleteReason}
                  onChange={(event) =>
                    setDeleteReason(
                      event.target.value,
                    )
                  }
                  placeholder="Explain why this supplier must be permanently deleted..."
                  className="min-h-28 w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-red-300/40"
                  maxLength={2000}
                />
                <span className="mt-1 block text-xs text-white/35">
                  At least 10 characters.
                </span>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/45">
                  Type the supplier name exactly
                </span>

                <div className="mb-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-black text-white/80">
                  {deleteSupplier.displayName}
                </div>

                <input
                  value={deleteConfirmation}
                  onChange={(event) =>
                    setDeleteConfirmation(
                      event.target.value,
                    )
                  }
                  autoComplete="off"
                  className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm text-white outline-none focus:border-red-300/40"
                  placeholder={
                    deleteSupplier.displayName
                  }
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-black uppercase tracking-[0.12em] text-white/45">
                  Main admin password
                </span>

                <div className="relative">
                  <input
                    type={
                      showDeletePassword
                        ? "text"
                        : "password"
                    }
                    value={deletePassword}
                    onChange={(event) =>
                      setDeletePassword(
                        event.target.value,
                      )
                    }
                    autoComplete="current-password"
                    className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 pr-12 text-sm text-white outline-none focus:border-red-300/40"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowDeletePassword(
                        (current) => !current,
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-white/45 hover:bg-white/10 hover:text-white"
                    aria-label={
                      showDeletePassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showDeletePassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </label>
            </div>

            <footer className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end sm:p-6">
              <button
                type="button"
                onClick={closeSupplierDelete}
                disabled={deletingSupplier}
                className="rounded-xl border border-white/10 px-5 py-3 text-sm font-black text-white/65 hover:bg-white/10 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void permanentlyDeleteSupplier()
                }
                disabled={
                  deletingSupplier ||
                  deleteReason.trim().length < 10 ||
                  deleteConfirmation !==
                    deleteSupplier.displayName ||
                  !deletePassword.trim()
                }
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-500 px-5 py-3 text-sm font-black text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deletingSupplier ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                {deletingSupplier
                  ? "Deleting supplier..."
                  : "Permanently delete supplier"}
              </button>
            </footer>
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
                  connect it to an existing inventory item, Event Hub contact
                  and Money Management supplier using simple dropdown menus.
                  No UUID codes need to be copied or pasted, and the original
                  records stay in their own apps.
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

            <div className="mt-5 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.07] p-4">
              <h3 className="flex items-center gap-2 font-black text-cyan-100">
                <Boxes className="h-4 w-4" />
                Connect an inventory item
              </h3>

              <p className="mt-1 text-xs leading-5 text-cyan-50/60">
                Choose an item already saved in Stock Management.
                When the supplier is created, the item will be
                connected automatically as a preferred or
                alternative supplier.
              </p>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Inventory item
                </span>

                <select
                  value={form.stockItemId}
                  onChange={(event) =>
                    selectInventoryItem(
                      event.target.value,
                    )
                  }
                  disabled={inventoryLoading}
                  className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-cyan-300/40 disabled:opacity-60"
                >
                  <option value="">
                    {inventoryLoading
                      ? "Loading inventory items..."
                      : "Do not connect an inventory item"}
                  </option>

                  {inventoryItems.map((item) => (
                    <option
                      key={item.id}
                      value={item.id}
                    >
                      {item.name} · SKU {item.sku}
                      {" · "}
                      {item.quantity} in stock
                      {item.category
                        ? ` · ${item.category}`
                        : ""}
                    </option>
                  ))}
                </select>
              </label>

              {inventoryError ? (
                <pre className="mt-3 whitespace-pre-wrap break-words rounded-xl border border-amber-300/15 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
                  {inventoryError}
                </pre>
              ) : null}

              {form.stockItemId ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-xs font-black text-white/55">
                      Supplier role
                    </span>
                    <select
                      value={form.stockItemRole}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stockItemRole:
                            event.target
                              .value as
                              | "preferred"
                              | "alternative",
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none"
                    >
                      <option value="preferred">
                        Preferred supplier
                      </option>
                      <option value="alternative">
                        Alternative supplier
                      </option>
                    </select>
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-black text-white/55">
                      Supplier SKU or product code
                    </span>
                    <input
                      value={
                        form.stockItemSupplierSku
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stockItemSupplierSku:
                            event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                      placeholder="Optional supplier code"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-black text-white/55">
                      Unit cost from this supplier (£)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        form.stockItemUnitCost
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stockItemUnitCost:
                            event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                      placeholder="0.00"
                    />
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-black text-white/55">
                      Minimum order quantity
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.stockItemMinimumOrderQuantity
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stockItemMinimumOrderQuantity:
                            event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                      placeholder="Optional"
                    />
                  </label>

                  <label className="sm:col-span-2">
                    <span className="mb-1.5 block text-xs font-black text-white/55">
                      Lead time for this item (days)
                    </span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={
                        form.stockItemLeadTimeDays
                      }
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          stockItemLeadTimeDays:
                            event.target.value,
                        }))
                      }
                      className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none"
                      placeholder={
                        form.usualDeliveryDays ||
                        "Optional"
                      }
                    />
                  </label>

                  <div className="sm:col-span-2 rounded-xl border border-cyan-300/10 bg-black/20 p-3 text-xs leading-5 text-white/60">
                    {(() => {
                      const selected =
                        inventoryItems.find(
                          (item) =>
                            item.id ===
                            form.stockItemId,
                        );

                      return selected ? (
                        <>
                          <p>
                            <span className="font-black text-white/75">
                              Selected item:
                            </span>{" "}
                            {selected.name}
                          </p>
                          <p>
                            <span className="font-black text-white/75">
                              SKU:
                            </span>{" "}
                            {selected.sku}
                          </p>
                          <p>
                            <span className="font-black text-white/75">
                              Current quantity:
                            </span>{" "}
                            {selected.quantity}
                          </p>
                        </>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : null}
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

              {form.eventRecordId &&
              (form.eventDoNotUse ||
                form.eventNeedsReview) ? (
                <div
                  className={`mt-4 rounded-2xl border p-4 ${
                    form.eventDoNotUse
                      ? "border-red-300/25 bg-red-500/15"
                      : "border-amber-300/20 bg-amber-500/10"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <ShieldAlert
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        form.eventDoNotUse
                          ? "text-red-100"
                          : "text-amber-100"
                      }`}
                    />

                    <div className="min-w-0 flex-1">
                      <p
                        className={`font-black ${
                          form.eventDoNotUse
                            ? "text-red-50"
                            : "text-amber-50"
                        }`}
                      >
                        {form.eventDoNotUse
                          ? "Event Hub says: Do not use / Do not invite"
                          : "Event Hub says: Needs review"}
                      </p>

                      <p className="mt-1 text-xs leading-5 text-white/65">
                        {form.eventDoNotUse
                          ? "This warning will be copied into Stock Management. The supplier will be marked Do not use and Needs review."
                          : "This supplier will be marked Needs review in Stock Management."}
                      </p>

                      {form.eventDoNotUse ? (
                        <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-xl border border-red-300/15 bg-black/20 p-3">
                          <input
                            type="checkbox"
                            checked={
                              form.eventWarningAccepted
                            }
                            onChange={(event) =>
                              setForm((current) => ({
                                ...current,
                                eventWarningAccepted:
                                  event.target.checked,
                              }))
                            }
                            className="mt-0.5 h-4 w-4 accent-red-400"
                          />

                          <span className="text-xs font-bold leading-5 text-red-50/80">
                            I understand this contact is
                            marked Do not use / Do not
                            invite in Event Hub. Create the
                            Stock Management supplier with
                            the warning carried over.
                          </span>
                        </label>
                      ) : null}
                    </div>
                  </div>
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

            <div
              className={`mt-4 rounded-2xl border p-4 ${
                form.stockRating === "do_not_use"
                  ? "border-red-300/25 bg-red-500/[0.12]"
                  : form.stockRating === "poor"
                    ? "border-orange-300/25 bg-orange-500/[0.10]"
                    : "border-amber-300/20 bg-amber-500/[0.07]"
              }`}
            >
              <h3 className="flex items-center gap-2 font-black text-amber-50">
                <Star className="h-4 w-4" />
                Set up Stock Control review
              </h3>

              <p className="mt-1 text-xs leading-5 text-white/60">
                Set the supplier rating now so the supplier card, filters and
                ordering warnings are correct from the moment it is created.
              </p>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1.5 block text-xs font-black text-white/55">
                    Overall Stock Control rating
                  </span>
                  <select
                    value={form.stockRating}
                    onChange={(event) => {
                      const rating =
                        event.target.value as StockSupplierRating;
                      const score = ratingScoreFromValue(rating, null);

                      setForm((current) => ({
                        ...current,
                        stockRating: rating,
                        stockRatingScore:
                          rating === "not_recorded"
                            ? ""
                            : String(score),
                        stockNeedsReview:
                          rating === "ok" ||
                          rating === "poor" ||
                          rating === "do_not_use"
                            ? true
                            : current.stockNeedsReview,
                        ratingWarningAccepted:
                          rating === "do_not_use"
                            ? false
                            : current.ratingWarningAccepted,
                      }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300/40"
                  >
                    <option value="not_recorded">Not rated yet</option>
                    <option value="excellent">Excellent — 5 stars</option>
                    <option value="good">Good — 4 stars</option>
                    <option value="ok">Okay — 3 stars</option>
                    <option value="poor">Poor — 2 stars</option>
                    <option value="do_not_use">Do not use — 1 star</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1.5 block text-xs font-black text-white/55">
                    Star score — updates automatically
                  </span>
                  <select
                    value={form.stockRatingScore}
                    disabled={
                      form.stockRating === "not_recorded"
                    }
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stockRatingScore:
                          event.target.value,
                      }))
                    }
                    className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300/40 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <option value="">Choose score</option>
                    <option value="5">★★★★★ — 5</option>
                    <option value="4">★★★★☆ — 4</option>
                    <option value="3">★★★☆☆ — 3</option>
                    <option value="2">★★☆☆☆ — 2</option>
                    <option value="1">★☆☆☆☆ — 1</option>
                  </select>
                </label>
              </div>

              {form.stockRating !== "not_recorded" ? (
                <div className="mt-3">
                  <StockRatingBadge
                    rating={form.stockRating}
                    score={Number(form.stockRatingScore) || null}
                  />
                </div>
              ) : null}

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-black text-white/55">
                  Review notes
                </span>
                <textarea
                  rows={3}
                  value={form.stockRatingNotes}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      stockRatingNotes: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-3 text-sm font-semibold text-white outline-none focus:border-amber-300/40"
                  placeholder="Explain delivery, quality, communication, value or why this supplier needs review..."
                />
              </label>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <input
                    type="checkbox"
                    checked={form.stockNeedsReview}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        stockNeedsReview:
                          event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-amber-400"
                  />
                  <span>
                    <span className="block text-sm font-black text-white/80">
                      Mark as Needs review
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">
                      Shows an amber warning before ordering.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3">
                  <input
                    type="checkbox"
                    checked={form.createInitialReview}
                    disabled={form.stockRating === "not_recorded"}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        createInitialReview:
                          event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-cyan-400"
                  />
                  <span>
                    <span className="block text-sm font-black text-white/80">
                      Save first review in history
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/45">
                      Creates a dated review entry after the supplier is saved.
                    </span>
                  </span>
                </label>
              </div>

              {form.createInitialReview ? (
                <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-500/[0.06] p-4">
                  <p className="text-sm font-black text-cyan-100">
                    Detailed first review scores
                  </p>
                  <p className="mt-1 text-xs leading-5 text-white/45">
                    Optional. Leave a score blank when it has not been checked yet.
                  </p>

                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["Delivery", "reviewDeliveryRating"],
                      ["Quality", "reviewQualityRating"],
                      ["Communication", "reviewCommunicationRating"],
                      ["Value for money", "reviewValueRating"],
                    ].map(([label, field]) => (
                      <label key={field}>
                        <span className="mb-1.5 block text-xs font-black text-white/55">
                          {label}
                        </span>
                        <select
                          value={
                            form[
                              field as
                                | "reviewDeliveryRating"
                                | "reviewQualityRating"
                                | "reviewCommunicationRating"
                                | "reviewValueRating"
                            ]
                          }
                          onChange={(event) =>
                            setForm((current) => ({
                              ...current,
                              [field]: event.target.value,
                            }))
                          }
                          className="w-full rounded-xl border border-white/10 bg-[#171020] px-3 py-2.5 text-sm font-semibold text-white outline-none"
                        >
                          <option value="">Not checked</option>
                          <option value="5">5 — Excellent</option>
                          <option value="4">4 — Good</option>
                          <option value="3">3 — Okay</option>
                          <option value="2">2 — Poor</option>
                          <option value="1">1 — Very poor</option>
                        </select>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}

              {form.stockRating === "do_not_use" ? (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-red-300/20 bg-red-500/10 p-4">
                  <input
                    type="checkbox"
                    checked={form.ratingWarningAccepted}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        ratingWarningAccepted:
                          event.target.checked,
                      }))
                    }
                    className="mt-0.5 h-4 w-4 accent-red-400"
                  />
                  <span className="text-xs font-bold leading-5 text-red-50/80">
                    I understand this rating will mark the supplier Do not use,
                    Needs review and show a red warning across Stock Control.
                  </span>
                </label>
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
                disabled={
                    creating ||
                    (form.eventDoNotUse &&
                      !form.eventWarningAccepted) ||
                    (form.stockRating === "do_not_use" &&
                      !form.ratingWarningAccepted)
                  }
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
