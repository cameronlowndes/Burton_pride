"use client";

import {
  AlertTriangle,
  BadgePoundSterling,
  Building2,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Filter,
  HeartHandshake,
  Loader2,
  Mail,
  Phone,
  Percent,
  RefreshCw,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  Upload,
  Utensils,
  X,
  XCircle,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ApplicationType =
  | "stallholder"
  | "food_vendor"
  | "charity"
  | "cic";

type ApplicationStatus =
  | "pending"
  | "under_review"
  | "approved"
  | "rejected"
  | "withdrawn";

type PaymentStatus =
  | "not_required"
  | "awaiting_payment"
  | "paid"
  | "refunded";

type PaymentMethod =
  | "bank_transfer"
  | "card"
  | "cash"
  | "online"
  | "other";

type PaymentFormState = {
  status: PaymentStatus;
  originalAmount: string;
  discountEnabled: boolean;
  discountPercent: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  paymentReference: string;
  notes: string;
  receipt: File | null;
};


type EventHubEvent = {
  id: string;
  event_name: string;
  event_year: number | null;
  event_date: string | null;
  is_active: boolean;
  is_archived?: boolean | null;
};

type EventsApiResponse = {
  ok?: boolean;
  event?: EventHubEvent | null;
  currentEvent?: EventHubEvent | null;
  events?: EventHubEvent[];
  error?: string;
};

type EventVendorApplication = {
  id: string;
  application_reference: string;
  event_id: string;

  application_type: ApplicationType;
  pitch_type: "standard" | "double" | null;

  organisation_name: string;
  trading_name: string | null;

  contact_name: string;
  contact_email: string;
  contact_phone: string;

  address_line1: string;
  address_line2: string | null;
  town_city: string;
  county: string | null;
  postcode: string;

  website: string | null;
  social_media: string | null;

  description: string;
  products_services: string;

  gazebo_width_metres: number | null;
  gazebo_depth_metres: number | null;

  electricity_required: boolean;
  electricity_details: string | null;

  public_liability_insurance: boolean;
  public_liability_expiry_date: string | null;
  public_liability_document_url: string | null;

  food_hygiene_rating: string | null;
  food_registration_authority: string | null;
  food_hygiene_document_url: string | null;

  uses_gas: boolean;
  gas_safety_document_url: string | null;

  uses_generator: boolean;
  generator_details: string | null;

  charity_number: string | null;
  company_number: string | null;
  charity_or_cic_proof_url: string | null;

  accessibility_requirements: string | null;
  additional_information: string | null;

  terms_accepted: boolean;
  data_processing_accepted: boolean;

  fee_pence: number;
  payment_status: PaymentStatus;
  application_status: ApplicationStatus;

  admin_notes: string | null;
  rejection_reason: string | null;

  submitted_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok?: boolean;
  success?: boolean;
  valid?: boolean;
  verified?: boolean;
  isValid?: boolean;
  applications?: EventVendorApplication[];
  application?: EventVendorApplication;
  deletedApplicationId?: string;
  event?: EventHubEvent | null;
  currentEvent?: EventHubEvent | null;
  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
  hint?: string;
};

type LocalNotice = {
  id: number;
  tone: "success" | "error" | "info";
  message: string;
};

const API =
  "/api/admin/burton-pride-event-hub/stalls-vendors";

const PAYMENT_API =
  "/api/admin/burton-pride-event-hub/stalls-vendors/payment";

const EVENT_AUDIT_API =
  "/api/admin/burton-pride-event-hub/audit-log";

const MONEY_AUDIT_API =
  "/api/admin/money/audit-logs";


const EVENTS_API =
  "/api/admin/burton-pride-event-hub/events";


const statusOptions: Array<{
  value: ApplicationStatus | "";
  label: string;
}> = [
  { value: "", label: "All statuses" },
  { value: "pending", label: "Pending" },
  {
    value: "under_review",
    label: "Under review",
  },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

const typeOptions: Array<{
  value: ApplicationType | "";
  label: string;
}> = [
  { value: "", label: "All application types" },
  { value: "stallholder", label: "Stallholder" },
  { value: "food_vendor", label: "Food vendor" },
  { value: "charity", label: "Charity" },
  { value: "cic", label: "C.I.C." },
];

function formatMoney(pence: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format((pence || 0) / 100);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatEventDate(value: string | null) {
  if (!value) {
    return "Date not recorded";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function getEventLabel(event: EventHubEvent) {
  const year = event.event_year ? ` ${event.event_year}` : "";
  return `${event.event_name}${year}`.trim();
}

function getStoredEventId() {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.localStorage.getItem("burton-pride-current-event-id") ||
    window.localStorage.getItem("burton_pride_current_event_id") ||
    ""
  );
}

function storeEventId(eventId: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(
      "burton-pride-current-event-id",
      eventId,
    );
  } catch {
    // The page still works if browser storage is unavailable.
  }
}

function applicationTypeLabel(
  value: ApplicationType,
) {
  if (value === "food_vendor") {
    return "Food vendor";
  }

  if (value === "charity") {
    return "Registered charity";
  }

  if (value === "cic") {
    return "Community Interest Company";
  }

  return "Stallholder";
}

function statusLabel(
  value: ApplicationStatus,
) {
  return (
    statusOptions.find(
      (option) => option.value === value,
    )?.label || value
  );
}

function statusClass(
  value: ApplicationStatus,
) {
  if (value === "approved") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
  }

  if (value === "rejected") {
    return "border-red-400/25 bg-red-500/10 text-red-200";
  }

  if (value === "under_review") {
    return "border-blue-400/25 bg-blue-500/10 text-blue-200";
  }

  if (value === "withdrawn") {
    return "border-slate-400/25 bg-slate-500/10 text-slate-300";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-200";
}

function typeIcon(type: ApplicationType) {
  if (type === "food_vendor") {
    return <Utensils className="h-5 w-5" />;
  }

  if (
    type === "charity" ||
    type === "cic"
  ) {
    return (
      <HeartHandshake className="h-5 w-5" />
    );
  }

  return <Store className="h-5 w-5" />;
}

async function readJson(
  response: Response,
): Promise<ApiResponse> {
  const text = await response.text();

  try {
    return text
      ? (JSON.parse(text) as ApiResponse)
      : {};
  } catch {
    return {
      ok: false,
      error:
        "The server returned an invalid response.",
    };
  }
}

type AuditTarget = "event" | "money";

type AuditEntry = {
  action: string;
  actionLabel: string;
  description: string;
  status?: "success" | "warning" | "failed";
  application: EventVendorApplication;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: Record<string, unknown>;
  event?: EventHubEvent | null;
};

async function reportAudit(
  target: AuditTarget,
  entry: AuditEntry,
): Promise<boolean> {
  const endpoint =
    target === "money"
      ? MONEY_AUDIT_API
      : EVENT_AUDIT_API;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      cache: "no-store",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "x-audit-source": "event-hub",
      },
      body: JSON.stringify({
        action: entry.action,
        action_label: entry.actionLabel,
        description: entry.description,
        status: entry.status || "success",
        source: "event_hub",
        module:
          target === "money"
            ? "money_management"
            : "event_hub",
        audit_area:
          target === "money"
            ? "money_management"
            : "event_hub",
        entity_type:
          "event_vendor_application",
        entity_id: entry.application.id,
        event_id: entry.application.event_id,
        event_name:
          entry.event?.event_name || null,
        event_year:
          entry.event?.event_year || null,
        event_date:
          entry.event?.event_date || null,
        application_id: entry.application.id,
        application_reference:
          entry.application.application_reference,
        organisation_name:
          entry.application.organisation_name,
        before_data:
          entry.beforeData ?? null,
        after_data:
          entry.afterData ?? null,
        metadata: {
          application_type:
            entry.application.application_type,
          request_source:
            "EventHubVendorApplicationsPage",
          ...(entry.metadata || {}),
        },
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();

      console.error(
        `${target} audit log failed`,
        {
          status: response.status,
          response: responseText,
          action: entry.action,
        },
      );

      return false;
    }

    return true;
  } catch (auditError) {
    console.error(
      `${target} audit log failed`,
      {
        action: entry.action,
        error: auditError,
      },
    );

    return false;
  }
}

function getApplicationAuditAction(
  before: EventVendorApplication,
  after: EventVendorApplication,
) {
  if (
    before.application_status !==
    after.application_status
  ) {
    return {
      action: `event_hub_vendor_application_${after.application_status}`,
      actionLabel:
        `Vendor application ${statusLabel(after.application_status)}`,
      description:
        `${after.organisation_name} was moved from ` +
        `${statusLabel(before.application_status)} to ` +
        `${statusLabel(after.application_status)}.`,
    };
  }

  return {
    action:
      "event_hub_vendor_application_updated",
    actionLabel:
      "Vendor application updated",
    description:
      `${after.organisation_name}'s Event Hub application was updated.`,
  };
}

export default function EventHubVendorApplicationsPage() {
  const [events, setEvents] =
    useState<EventHubEvent[]>([]);

  const [currentEvent, setCurrentEvent] =
    useState<EventHubEvent | null>(null);

  const [eventLoading, setEventLoading] =
    useState(true);

  const [eventError, setEventError] =
    useState("");

  const [applications, setApplications] =
    useState<EventVendorApplication[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [notice, setNotice] =
    useState<LocalNotice | null>(null);

  const [paymentModalOpen, setPaymentModalOpen] =
    useState(false);

  const [paymentSaving, setPaymentSaving] =
    useState(false);

  const [paymentError, setPaymentError] =
    useState("");

  const [duplicatePaymentConfirmOpen, setDuplicatePaymentConfirmOpen] =
    useState(false);

  const [paymentForm, setPaymentForm] =
    useState<PaymentFormState>({
      status: "not_required",
      originalAmount: "0.00",
      discountEnabled: false,
      discountPercent: "0",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "bank_transfer",
      paymentReference: "",
      notes: "",
      receipt: null,
    });

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<ApplicationStatus | "">("");

  const [typeFilter, setTypeFilter] =
    useState<ApplicationType | "">("");

  const [selected, setSelected] =
    useState<EventVendorApplication | null>(
      null,
    );

  const [adminNotes, setAdminNotes] =
    useState("");

  const [rejectionReason, setRejectionReason] =
    useState("");

  const [rejectionError, setRejectionError] =
    useState("");

  const [rejectConfirmOpen, setRejectConfirmOpen] =
    useState(false);


  const [deleteConfirmOpen, setDeleteConfirmOpen] =
    useState(false);

  const [deletePassword, setDeletePassword] =
    useState("");


  const [showDeletePassword, setShowDeletePassword] =
    useState(false);

  const [deleteConfirmation, setDeleteConfirmation] =
    useState("");

  const [deleteError, setDeleteError] =
    useState("");

  const [deleting, setDeleting] =
    useState(false);

  const loadEvents =
    useCallback(async () => {
      setEventLoading(true);
      setEventError("");

      try {
        const response = await fetch(EVENTS_API, {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const textResponse = await response.text();
        let payload: EventsApiResponse = {};

        try {
          payload = textResponse
            ? (JSON.parse(textResponse) as EventsApiResponse)
            : {};
        } catch {
          throw new Error(
            "The Event Hub events API returned an invalid response.",
          );
        }

        if (!response.ok || payload.ok === false) {
          throw new Error(
            payload.error || "The current Event Hub event could not be loaded.",
          );
        }

        const availableEvents = Array.isArray(payload.events)
          ? payload.events.filter(
              (event) =>
                event &&
                typeof event.id === "string" &&
                event.id.trim() &&
                event.is_archived !== true,
            )
          : [];

        const storedEventId = getStoredEventId();

        const selectedEvent =
          payload.currentEvent ||
          payload.event ||
          availableEvents.find(
            (event) => event.id === storedEventId,
          ) ||
          availableEvents.find(
            (event) => event.is_active,
          ) ||
          availableEvents[0] ||
          null;

        setEvents(availableEvents);
        setCurrentEvent(selectedEvent);

        if (selectedEvent) {
          storeEventId(selectedEvent.id);
        }
      } catch (loadEventError) {
        setEvents([]);
        setCurrentEvent(null);
        setEventError(
          loadEventError instanceof Error
            ? loadEventError.message
            : "The current Event Hub event could not be loaded.",
        );
      } finally {
        setEventLoading(false);
      }
    }, []);

  const loadApplications =
    useCallback(async () => {
      setLoading(true);
      setError("");

      try {
        const requestUrl = new URL(
          API,
          window.location.origin,
        );

        if (currentEvent?.id) {
          requestUrl.searchParams.set(
            "event_id",
            currentEvent.id,
          );
        }

        const response = await fetch(requestUrl.toString(), {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const payload =
          await readJson(response);

        if (
          !response.ok ||
          payload.ok === false
        ) {
          throw new Error(
            payload.error ||
              "Applications could not be loaded.",
          );
        }

        const responseEvent =
          payload.currentEvent || payload.event || null;

        if (responseEvent && !currentEvent) {
          setCurrentEvent(responseEvent);
          storeEventId(responseEvent.id);
        }

        const loadedApplications =
          Array.isArray(payload.applications)
            ? payload.applications
            : [];

        setApplications(
          currentEvent?.id
            ? loadedApplications.filter(
                (application) =>
                  application.event_id === currentEvent.id,
              )
            : loadedApplications,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Applications could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, [currentEvent]);

  useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  useEffect(() => {
    if (eventLoading) {
      return;
    }

    void loadApplications();
  }, [eventLoading, loadApplications]);

  useEffect(() => {
    if (!selected) {
      return;
    }

    setAdminNotes(
      selected.admin_notes || "",
    );

    setRejectionReason(
      selected.rejection_reason || "",
    );

    setRejectionError("");
    setRejectConfirmOpen(false);
    setDeleteConfirmOpen(false);
    setDeletePassword("");
    setShowDeletePassword(false);
    setDeleteConfirmation("");
    setDeleteError("");
  }, [selected]);

  function changeCurrentEvent(eventId: string) {
    const nextEvent =
      events.find((event) => event.id === eventId) || null;

    setCurrentEvent(nextEvent);
    setSelected(null);
    setApplications([]);
    setCurrentPageSafeReset();

    if (nextEvent) {
      storeEventId(nextEvent.id);
    }
  }

  function setCurrentPageSafeReset() {
    setSearch("");
    setStatusFilter("");
    setTypeFilter("");
  }

  const filteredApplications =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return applications.filter(
        (application) => {
          const matchesEvent =
            !currentEvent?.id ||
            application.event_id === currentEvent.id;

          const matchesSearch =
            !query ||
            application.organisation_name
              .toLowerCase()
              .includes(query) ||
            application.contact_name
              .toLowerCase()
              .includes(query) ||
            application.contact_email
              .toLowerCase()
              .includes(query) ||
            application.application_reference
              .toLowerCase()
              .includes(query);

          const matchesStatus =
            !statusFilter ||
            application.application_status ===
              statusFilter;

          const matchesType =
            !typeFilter ||
            application.application_type ===
              typeFilter;

          return (
            matchesEvent &&
            matchesSearch &&
            matchesStatus &&
            matchesType
          );
        },
      );
    }, [
      applications,
      currentEvent,
      search,
      statusFilter,
      typeFilter,
    ]);

  const stats = useMemo(() => {
    const total = applications.length;

    const countStatus = (
      status: ApplicationStatus,
    ) =>
      applications.filter(
        (application) =>
          application.application_status ===
          status,
      ).length;

    const awaitingPayment =
      applications.filter(
        (application) =>
          application.payment_status ===
          "awaiting_payment",
      ).length;

    const totalFeesPence =
      applications.reduce(
        (totalValue, application) =>
          totalValue +
          (application.fee_pence || 0),
        0,
      );

    return {
      total,
      pending: countStatus("pending"),
      underReview:
        countStatus("under_review"),
      approved: countStatus("approved"),
      rejected: countStatus("rejected"),
      awaitingPayment,
      totalFeesPence,
    };
  }, [applications]);

  const showNotice = useCallback((
    tone: LocalNotice["tone"],
    message: string,
  ) => {
    const id = Date.now();

    setNotice({ id, tone, message });

    window.setTimeout(() => {
      setNotice((current) =>
        current?.id === id ? null : current,
      );
    }, 3500);
  }, []);

  async function updateApplication(
    changes: Partial<
      Pick<
        EventVendorApplication,
        | "application_status"
        | "payment_status"
        | "admin_notes"
        | "rejection_reason"
      >
    >,
    successMessage = "Application updated successfully.",
  ) {
    if (!selected) {
      return;
    }

    const entries = Object.entries(changes) as Array<[
      keyof typeof changes,
      unknown,
    ]>;

    const alreadySubmitted =
      entries.length > 0 &&
      entries.every(([key, value]) =>
        selected[key] === value,
      );

    if (alreadySubmitted) {
      showNotice(
        "info",
        "You submitted it already.",
      );
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(API, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type":
            "application/json",
        },
        body: JSON.stringify({
          id: selected.id,
          ...changes,
        }),
      });

      const payload =
        await readJson(response);

      if (
        !response.ok ||
        payload.ok === false ||
        !payload.application
      ) {
        throw new Error(
          payload.error ||
            "The application could not be updated.",
        );
      }

      const previousApplication = selected;
      const updatedApplication =
        payload.application;

      setApplications((current) =>
        current.map((application) =>
          application.id === selected.id
            ? updatedApplication
            : application,
        ),
      );

      setSelected(updatedApplication);

      const auditAction =
        getApplicationAuditAction(
          previousApplication,
          updatedApplication,
        );

      const eventAuditSaved =
        await reportAudit("event", {
          ...auditAction,
          application: updatedApplication,
          event: currentEvent,
          beforeData: previousApplication,
          afterData: updatedApplication,
          metadata: {
            changed_fields:
              Object.keys(changes),
          },
        });

      showNotice(
        eventAuditSaved ? "success" : "error",
        eventAuditSaved
          ? successMessage
          : `${successMessage} The Event Hub audit log could not be updated.`,
      );
    } catch (updateError) {
      const message =
        updateError instanceof Error
          ? updateError.message
          : "The application could not be updated.";

      setError(message);
      showNotice("error", message);
    } finally {
      setSaving(false);
    }
  }

  function openPaymentModal(status: PaymentStatus) {
    if (!selected) {
      return;
    }

    setPaymentError("");
    setDuplicatePaymentConfirmOpen(false);
    setPaymentForm({
      status,
      originalAmount: (selected.fee_pence / 100).toFixed(2),
      discountEnabled: false,
      discountPercent: "0",
      paymentDate: new Date().toISOString().slice(0, 10),
      paymentMethod: "bank_transfer",
      paymentReference: selected.application_reference,
      notes: `Event Hub application payment for ${selected.organisation_name}`,
      receipt: null,
    });
    setPaymentModalOpen(true);
  }

  const paymentOriginalPence = Math.max(
    0,
    Math.round((Number(paymentForm.originalAmount) || 0) * 100),
  );

  const paymentDiscountPercent = paymentForm.discountEnabled
    ? Math.min(100, Math.max(0, Number(paymentForm.discountPercent) || 0))
    : 0;

  const paymentDiscountPence = Math.round(
    paymentOriginalPence * (paymentDiscountPercent / 100),
  );

  const paymentFinalPence = Math.max(
    0,
    paymentOriginalPence - paymentDiscountPence,
  );

  async function submitPaymentDetails(allowPossibleDuplicate = false) {
    if (!selected) {
      return;
    }

    const applicationAlreadyHasPayment =
      selected.payment_status !== "not_required";

    if (applicationAlreadyHasPayment && !allowPossibleDuplicate) {
      setDuplicatePaymentConfirmOpen(true);
      return;
    }

    if (!paymentForm.paymentDate) {
      setPaymentError("Enter the payment date.");
      return;
    }

    if (paymentForm.status === "paid" && paymentFinalPence > 0 && !paymentForm.paymentReference.trim()) {
      setPaymentError("Enter a payment reference before marking this as paid.");
      return;
    }

    setPaymentSaving(true);
    setPaymentError("");

    try {
      const formData = new FormData();
      formData.set("applicationId", selected.id);
      formData.set("eventId", selected.event_id);
      formData.set(
        "eventName",
        currentEvent?.event_name || "",
      );
      formData.set(
        "eventYear",
        currentEvent?.event_year
          ? String(currentEvent.event_year)
          : "",
      );
      formData.set("paymentStatus", paymentForm.status);
      formData.set("originalAmountPence", String(paymentOriginalPence));
      formData.set("discountPercent", String(paymentDiscountPercent));
      formData.set("discountAmountPence", String(paymentDiscountPence));
      formData.set("finalAmountPence", String(paymentFinalPence));
      formData.set("paymentDate", paymentForm.paymentDate);
      formData.set("paymentMethod", paymentForm.paymentMethod);
      formData.set("paymentReference", paymentForm.paymentReference.trim());
      formData.set("notes", paymentForm.notes.trim());
      formData.set(
        "allowPossibleDuplicate",
        allowPossibleDuplicate ? "true" : "false",
      );

      if (allowPossibleDuplicate) {
        formData.set(
          "duplicateWarning",
          "This payment was sent again after a previous Event Hub payment. It could be a duplicate and must be checked in Money Management.",
        );
      }

      if (paymentForm.receipt) {
        formData.set("receipt", paymentForm.receipt);
      }

      const response = await fetch(PAYMENT_API, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = await readJson(response);

      if (!response.ok || payload.ok === false || !payload.application) {
        throw new Error(payload.error || "The payment could not be saved.");
      }

      const previousApplication = selected;
      const updatedApplication =
        payload.application;

      setApplications((current) =>
        current.map((application) =>
          application.id === selected.id
            ? updatedApplication
            : application,
        ),
      );

      setSelected(updatedApplication);
      setPaymentModalOpen(false);
      setDuplicatePaymentConfirmOpen(false);

      const auditEntry: AuditEntry = {
        action: allowPossibleDuplicate
          ? "event_hub_vendor_payment_duplicate_created"
          : "event_hub_vendor_payment_created",
        actionLabel: allowPossibleDuplicate
          ? "Possible duplicate Event Hub payment sent"
          : "Event Hub payment sent to Money Management",
        description: allowPossibleDuplicate
          ? `A further payment for ${updatedApplication.organisation_name} was sent to Money Management and marked as a possible duplicate.`
          : `A payment for ${updatedApplication.organisation_name} was sent from Event Hub to Money Management.`,
        status: allowPossibleDuplicate
          ? "warning"
          : "success",
        application: updatedApplication,
        event: currentEvent,
        beforeData: previousApplication,
        afterData: updatedApplication,
        metadata: {
          payment_status:
            paymentForm.status,
          original_amount_pence:
            paymentOriginalPence,
          discount_percent:
            paymentDiscountPercent,
          discount_amount_pence:
            paymentDiscountPence,
          final_amount_pence:
            paymentFinalPence,
          payment_date:
            paymentForm.paymentDate,
          payment_method:
            paymentForm.paymentMethod,
          payment_reference:
            paymentForm.paymentReference.trim(),
          receipt_name:
            paymentForm.receipt?.name || null,
          possible_duplicate:
            allowPossibleDuplicate,
        },
      };

      const [
        eventAuditSaved,
        moneyAuditSaved,
      ] = await Promise.all([
        reportAudit("event", auditEntry),
        reportAudit("money", auditEntry),
      ]);

      const paymentMessage =
        allowPossibleDuplicate
          ? "Payment sent again. It has been marked as a possible duplicate in Money Management."
          : "Payment details saved and sent to Money Management.";

      showNotice(
        eventAuditSaved && moneyAuditSaved
          ? "success"
          : "error",
        eventAuditSaved && moneyAuditSaved
          ? paymentMessage
          : `${paymentMessage} One or more audit logs could not be updated.`,
      );
    } catch (paymentUpdateError) {
      const message =
        paymentUpdateError instanceof Error
          ? paymentUpdateError.message
          : "The payment could not be saved.";
      setPaymentError(message);
      showNotice("error", message);
    } finally {
      setPaymentSaving(false);
    }
  }

  function requestDeleteApplication() {
    if (!selected) {
      return;
    }

    setDeletePassword("");
    setShowDeletePassword(false);
    setDeleteConfirmation("");
    setDeleteError("");
    setDeleteConfirmOpen(true);
  }

  async function confirmDeleteApplication() {
    if (!selected || deleting) {
      return;
    }

    if (deleteConfirmation.trim() !== "DELETE") {
      setDeleteError(
        'Type DELETE exactly in the confirmation box.',
      );
      return;
    }

    if (!deletePassword.trim()) {
      setDeleteError(
        "Enter the main admin deletion password.",
      );
      return;
    }

    setDeleting(true);
    setDeleteError("");

    const applicationToDelete = selected;

    try {
      /*
       * The DELETE API checks the bcrypt hash stored by
       * /api/admin/settings/delete-password directly in
       * admin_delete_settings. This avoids the blocked
       * server-to-server request.
       */
      const response = await fetch(API, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          id: applicationToDelete.id,
          eventId: applicationToDelete.event_id,
          password: deletePassword,
          mainAdminPassword: deletePassword,
          deletePassword,
          confirmation: deleteConfirmation.trim(),
        }),
      });

      const payload = await readJson(response);

      if (!response.ok || payload.ok === false) {
        throw new Error(
          payload.error ||
            payload.message ||
            "The application could not be deleted.",
        );
      }

      setApplications((current) =>
        current.filter(
          (application) =>
            application.id !== applicationToDelete.id,
        ),
      );

      setSelected(null);
      setDeleteConfirmOpen(false);
      setDeletePassword("");
      setShowDeletePassword(false);
      setDeleteConfirmation("");

      const eventAuditSaved =
        await reportAudit("event", {
          action:
            "event_hub_vendor_application_deleted",
          actionLabel:
            "Vendor application permanently deleted",
          description:
            `${applicationToDelete.organisation_name}'s application was permanently deleted from the Applications Hub.`,
          status: "warning",
          application: applicationToDelete,
          event: currentEvent,
          beforeData: applicationToDelete,
          afterData: null,
          metadata: {
            deletion_type: "permanent",
            confirmation_entered: true,
            password_source:
              "admin_delete_settings",
            password_action_key:
              "delete_all_donations",
            required_main_admin_password: true,
          },
        });

      showNotice(
        eventAuditSaved ? "success" : "error",
        eventAuditSaved
          ? "Application permanently deleted."
          : "Application deleted, but the Event Hub audit log could not be updated.",
      );
    } catch (deleteApplicationError) {
      const message =
        deleteApplicationError instanceof Error
          ? deleteApplicationError.message
          : "The application could not be deleted.";

      setDeleteError(message);
      showNotice("error", message);
    } finally {
      setDeleting(false);
    }
  }

  function requestRejection() {
    const reason =
      rejectionReason.trim();

    if (!reason) {
      setRejectionError(
        "Enter a rejection reason before rejecting this application.",
      );

      window.setTimeout(() => {
        document
          .getElementById(
            "vendor-rejection-reason",
          )
          ?.focus();
      }, 50);

      return;
    }

    setRejectionError("");
    setRejectConfirmOpen(true);
  }

  async function confirmRejection() {
    if (!selected) {
      return;
    }

    const reason =
      rejectionReason.trim();

    if (!reason) {
      setRejectConfirmOpen(false);
      setRejectionError(
        "Enter a rejection reason before rejecting this application.",
      );
      return;
    }

    await updateApplication(
      {
        application_status: "rejected",
        admin_notes: adminNotes.trim(),
        rejection_reason: reason,
      },
      "Application rejected successfully.",
    );

    setRejectConfirmOpen(false);
  }

  async function exportApplications() {
    const headers = [
      "reference",
      "organisation",
      "application_type",
      "pitch_type",
      "contact_name",
      "contact_email",
      "contact_phone",
      "fee",
      "payment_status",
      "application_status",
      "submitted_at",
    ];

    const rows =
      filteredApplications.map(
        (application) => [
          application.application_reference,
          application.organisation_name,
          application.application_type,
          application.pitch_type || "",
          application.contact_name,
          application.contact_email,
          application.contact_phone,
          (
            application.fee_pence / 100
          ).toFixed(2),
          application.payment_status,
          application.application_status,
          application.submitted_at,
        ],
      );

    const csv = [headers, ...rows]
      .map((row) =>
        row
          .map((value) =>
            `"${String(value ?? "").replaceAll(
              '"',
              '""',
            )}"`,
          )
          .join(","),
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8",
    });

    const url =
      URL.createObjectURL(blob);

    const link =
      document.createElement("a");

    link.href = url;
    link.download =
      "burton-pride-vendor-applications.csv";
    link.click();

    URL.revokeObjectURL(url);

    const applicationForAudit =
      selected ||
      filteredApplications[0] ||
      applications[0] ||
      null;

    if (applicationForAudit) {
      const eventAuditSaved =
        await reportAudit("event", {
          action:
            "event_hub_vendor_applications_exported",
          actionLabel:
            "Vendor applications exported",
          description:
            `${filteredApplications.length} Event Hub vendor application records were exported.`,
          application:
            applicationForAudit,
          event: currentEvent,
          metadata: {
            exported_count:
              filteredApplications.length,
            status_filter:
              statusFilter || "all",
            type_filter:
              typeFilter || "all",
            search:
              search.trim() || null,
          },
        });

      if (!eventAuditSaved) {
        showNotice(
          "error",
          "The export completed, but the Event Hub audit log could not be updated.",
        );
      }
    }
  }

  return (
    <main className="min-h-screen w-full bg-[radial-gradient(circle_at_top_left,_rgba(236,72,153,0.16),_transparent_30%),linear-gradient(180deg,#100719_0%,#1e1031_45%,#0f172a_100%)] px-3 py-6 text-white sm:px-4 lg:px-5">
      {notice ? (
        <div
          role="status"
          aria-live="polite"
          className={`fixed right-4 top-4 z-[300000] flex w-[min(92vw,26rem)] items-start gap-3 rounded-2xl border p-4 shadow-2xl backdrop-blur-xl transition sm:right-6 sm:top-6 ${
            notice.tone === "success"
              ? "border-emerald-400/30 bg-emerald-950/95 text-emerald-50"
              : notice.tone === "info"
                ? "border-amber-400/30 bg-amber-950/95 text-amber-50"
                : "border-red-400/30 bg-red-950/95 text-red-50"
          }`}
        >
          <div
            className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
              notice.tone === "success"
                ? "bg-emerald-500/20 text-emerald-200"
                : notice.tone === "info"
                  ? "bg-amber-500/20 text-amber-200"
                  : "bg-red-500/20 text-red-200"
            }`}
          >
            {notice.tone === "success" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : notice.tone === "info" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">
              {notice.tone === "success"
                ? "Action completed"
                : notice.tone === "info"
                  ? "Already submitted"
                  : "Action failed"}
            </p>
            <p className="mt-1 text-sm leading-5 opacity-85">
              {notice.message}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setNotice(null)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 transition hover:bg-white/10"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="w-full max-w-none">
        <header className="w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-pink-400/25 bg-pink-500/10 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-pink-100">
                <Store className="h-4 w-4" />
                Event Hub applications
              </div>

              <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">
                Application Hub
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/65">
                {currentEvent
                  ? `Review applications for ${getEventLabel(currentEvent)}. Approve, reject, manage payments and check documents from one place.`
                  : "Select the Event Hub event you want to manage."}
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() =>
                  void exportApplications()
                }
                disabled={
                  !currentEvent ||
                  filteredApplications.length === 0
                }
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-2 text-sm font-black text-emerald-100 transition hover:bg-emerald-500/20 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                Export
              </button>

              <button
                type="button"
                onClick={() =>
                  void loadApplications()
                }
                disabled={loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-black transition hover:bg-white/15 disabled:opacity-50"
              >
                <RefreshCw
                  className={`h-4 w-4 ${
                    loading
                      ? "animate-spin"
                      : ""
                  }`}
                />
                Refresh
              </button>
            </div>
          </div>
        </header>

        <section className="mt-5 rounded-[2rem] border border-cyan-400/20 bg-cyan-500/10 p-4 shadow-xl backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/15 text-cyan-100">
                <CalendarRange className="h-5 w-5" />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-cyan-100/70">
                  Current Event Hub event
                </p>

                {eventLoading ? (
                  <p className="mt-1 flex items-center gap-2 text-sm font-bold text-white/70">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Loading current event
                  </p>
                ) : currentEvent ? (
                  <>
                    <h2 className="mt-1 truncate text-xl font-black text-white">
                      {getEventLabel(currentEvent)}
                    </h2>
                    <p className="mt-1 text-sm text-white/60">
                      {formatEventDate(currentEvent.event_date)}
                      <span className="mx-2 text-white/25">•</span>
                      Event ID: {currentEvent.id}
                    </p>
                  </>
                ) : (
                  <p className="mt-1 text-sm font-bold text-amber-100">
                    No current Event Hub event is selected.
                  </p>
                )}
              </div>
            </div>

            {events.length > 0 ? (
              <label className="block w-full xl:w-[24rem]">
                <span className="mb-2 block text-xs font-black uppercase tracking-wide text-white/50">
                  Work on event
                </span>
                <select
                  value={currentEvent?.id || ""}
                  onChange={(event) =>
                    changeCurrentEvent(event.target.value)
                  }
                  className="h-12 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 text-sm font-bold text-white outline-none focus:border-cyan-300/50"
                >
                  {events.map((event) => (
                    <option
                      key={event.id}
                      value={event.id}
                      className="bg-slate-950 text-white"
                    >
                      {getEventLabel(event)}
                      {event.is_active ? " — Active" : ""}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          {eventError ? (
            <p className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3 text-sm font-semibold text-amber-100">
              {eventError}
            </p>
          ) : null}
        </section>

        {error ? (
          <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-semibold text-red-100">
            {error}
          </div>
        ) : null}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
          <StatCard
            label="Total"
            value={stats.total}
            icon={
              <FileText className="h-5 w-5" />
            }
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={
              <AlertTriangle className="h-5 w-5" />
            }
          />
          <StatCard
            label="Under review"
            value={stats.underReview}
            icon={
              <Eye className="h-5 w-5" />
            }
          />
          <StatCard
            label="Approved"
            value={stats.approved}
            icon={
              <CheckCircle2 className="h-5 w-5" />
            }
          />
          <StatCard
            label="Rejected"
            value={stats.rejected}
            icon={
              <XCircle className="h-5 w-5" />
            }
          />
          <StatCard
            label="Awaiting payment"
            value={stats.awaitingPayment}
            icon={
              <CircleDollarSign className="h-5 w-5" />
            }
          />
          <StatCard
            label="Application fees"
            value={formatMoney(
              stats.totalFeesPence,
            )}
            icon={
              <BadgePoundSterling className="h-5 w-5" />
            }
          />
        </section>

        <section className="mt-6 w-full rounded-[2rem] border border-white/10 bg-white/[0.07] p-4 shadow-xl backdrop-blur-xl sm:p-5">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value,
                  )
                }
                placeholder="Search organisation, contact, email or reference"
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm font-semibold outline-none transition placeholder:text-white/35 focus:border-pink-300/40 focus:ring-4 focus:ring-pink-500/10"
              />
            </label>

            <label className="relative block">
              <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(
                    event.target
                      .value as
                      | ApplicationStatus
                      | "",
                  )
                }
                className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm font-semibold outline-none focus:border-purple-300/40"
              >
                {statusOptions.map(
                  (option) => (
                    <option
                      key={option.value}
                      value={option.value}
                      className="bg-slate-950"
                    >
                      {option.label}
                    </option>
                  ),
                )}
              </select>
            </label>

            <select
              value={typeFilter}
              onChange={(event) =>
                setTypeFilter(
                  event.target.value as
                    | ApplicationType
                    | "",
                )
              }
              className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm font-semibold outline-none focus:border-purple-300/40"
            >
              {typeOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    className="bg-slate-950"
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>
        </section>

        <section className="mt-6">
          {loading ? (
            <div className="flex min-h-56 items-center justify-center rounded-[2rem] border border-white/10 bg-white/[0.06]">
              <Loader2 className="h-7 w-7 animate-spin text-purple-200" />
            </div>
          ) : filteredApplications.length ===
            0 ? (
            <div className="rounded-[2rem] border border-dashed border-white/15 bg-white/[0.04] p-12 text-center">
              <Store className="mx-auto h-10 w-10 text-white/35" />
              <h2 className="mt-4 text-xl font-black">
                No applications found
              </h2>
              <p className="mt-2 text-sm text-white/55">
                {currentEvent
                  ? `New applications for ${getEventLabel(currentEvent)} will appear here.`
                  : "Select an Event Hub event before viewing applications."}
              </p>
            </div>
          ) : (
            <div className="grid w-full gap-4 xl:grid-cols-2 2xl:grid-cols-3">
              {filteredApplications.map(
                (application) => (
                  <ApplicationCard
                    key={application.id}
                    application={
                      application
                    }
                    onOpen={() =>
                      setSelected(
                        application,
                      )
                    }
                  />
                ),
              )}
            </div>
          )}
        </section>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center bg-slate-950/80 p-2 backdrop-blur-md sm:p-4">
          <div className="flex h-[calc(100dvh-1rem)] w-full max-w-none flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#080d1b] shadow-2xl sm:h-[calc(100dvh-2rem)]">
            <div className="border-b border-white/10 bg-[#080d1b]/95 px-5 py-4 backdrop-blur-xl sm:px-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                      selected.application_status,
                    )}`}
                  >
                    {statusLabel(
                      selected.application_status,
                    )}
                  </span>

                  <h2 className="mt-3 text-2xl font-black sm:text-3xl">
                    {
                      selected.organisation_name
                    }
                  </h2>

                  <p className="mt-1 text-sm font-bold text-purple-200">
                    {
                      selected.application_reference
                    }
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelected(null)
                  }
                  className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] transition hover:bg-white/[0.12]"
                  aria-label="Close application"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-7 sm:pt-7">
              <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
                <div className="space-y-5">
                  <DetailSection
                    title="Application"
                    icon={typeIcon(
                      selected.application_type,
                    )}
                  >
                    <DetailGrid>
                      <DetailItem
                        label="Type"
                        value={applicationTypeLabel(
                          selected.application_type,
                        )}
                      />
                      <DetailItem
                        label="Pitch"
                        value={
                          selected.pitch_type ||
                          "Not applicable"
                        }
                      />
                      <DetailItem
                        label="Fee"
                        value={formatMoney(
                          selected.fee_pence,
                        )}
                      />
                      <DetailItem
                        label="Payment"
                        value={
                          selected.payment_status
                        }
                      />
                      <DetailItem
                        label="Submitted"
                        value={formatDate(
                          selected.submitted_at,
                        )}
                      />
                    </DetailGrid>
                  </DetailSection>

                  <DetailSection
                    title="Contact"
                    icon={
                      <Building2 className="h-5 w-5" />
                    }
                  >
                    <DetailGrid>
                      <DetailItem
                        label="Contact name"
                        value={
                          selected.contact_name
                        }
                      />
                      <DetailItem
                        label="Email"
                        value={
                          selected.contact_email
                        }
                      />
                      <DetailItem
                        label="Telephone"
                        value={
                          selected.contact_phone
                        }
                      />
                      <DetailItem
                        label="Trading name"
                        value={
                          selected.trading_name ||
                          "Not recorded"
                        }
                      />
                    </DetailGrid>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <a
                        href={`mailto:${selected.contact_email}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-purple-500/15 px-4 py-2 text-sm font-black text-purple-100 hover:bg-purple-500/25"
                      >
                        <Mail className="h-4 w-4" />
                        Email applicant
                      </a>

                      <a
                        href={`tel:${selected.contact_phone}`}
                        className="inline-flex items-center gap-2 rounded-xl bg-cyan-500/15 px-4 py-2 text-sm font-black text-cyan-100 hover:bg-cyan-500/25"
                      >
                        <Phone className="h-4 w-4" />
                        Call applicant
                      </a>
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="What they are bringing"
                    icon={
                      <Store className="h-5 w-5" />
                    }
                  >
                    <p className="text-sm leading-7 text-white/75">
                      {selected.description}
                    </p>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                      <p className="text-xs font-black uppercase tracking-wide text-white/45">
                        Products or services
                      </p>
                      <p className="mt-2 text-sm leading-7 text-white/75">
                        {
                          selected.products_services
                        }
                      </p>
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Documents and safety"
                    icon={
                      <ShieldCheck className="h-5 w-5" />
                    }
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <DocumentLink
                        label="Public liability"
                        url={
                          selected.public_liability_document_url
                        }
                      />
                      <DocumentLink
                        label="Food hygiene"
                        url={
                          selected.food_hygiene_document_url
                        }
                      />
                      <DocumentLink
                        label="Gas safety"
                        url={
                          selected.gas_safety_document_url
                        }
                      />
                      <DocumentLink
                        label="Charity or C.I.C. proof"
                        url={
                          selected.charity_or_cic_proof_url
                        }
                      />
                    </div>
                  </DetailSection>
                </div>

                <aside className="space-y-5">
                  <DetailSection
                    title="Review application"
                    icon={
                      <FileCheck2 className="h-5 w-5" />
                    }
                  >
                    <label className="block text-sm font-bold text-white/75">
                      Admin notes
                      <textarea
                        value={adminNotes}
                        onChange={(event) =>
                          setAdminNotes(
                            event.target.value,
                          )
                        }
                        className="mt-2 min-h-32 w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-sm outline-none focus:border-purple-300/40"
                      />
                    </label>

                    <label className="mt-4 block text-sm font-bold text-white/75">
                      Rejection reason
                      <textarea
                        id="vendor-rejection-reason"
                        value={rejectionReason}
                        aria-invalid={
                          rejectionError
                            ? true
                            : undefined
                        }
                        aria-describedby={
                          rejectionError
                            ? "vendor-rejection-error"
                            : undefined
                        }
                        onChange={(event) => {
                          setRejectionReason(
                            event.target.value,
                          );

                          if (
                            rejectionError &&
                            event.target.value.trim()
                          ) {
                            setRejectionError("");
                          }
                        }}
                        placeholder="Explain clearly why this application is being rejected."
                        className={`mt-2 min-h-24 w-full rounded-2xl border bg-black/20 p-4 text-sm outline-none transition ${
                          rejectionError
                            ? "border-red-400/70 focus:border-red-300 focus:ring-4 focus:ring-red-500/15"
                            : "border-white/10 focus:border-red-300/40"
                        }`}
                      />

                      {rejectionError ? (
                        <p
                          id="vendor-rejection-error"
                          role="alert"
                          className="mt-2 flex items-start gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs font-bold leading-5 text-red-100"
                        >
                          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                          {rejectionError}
                        </p>
                      ) : null}
                    </label>

                    <button
                      type="button"
                      onClick={() =>
                        void updateApplication(
                          {
                            admin_notes: adminNotes,
                            rejection_reason: rejectionReason,
                          },
                          "Review notes saved successfully.",
                        )
                      }
                      disabled={saving}
                      className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/20 bg-purple-500/15 px-4 py-2 text-sm font-black text-purple-100 hover:bg-purple-500/25 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileCheck2 className="h-4 w-4" />
                      )}
                      Save review notes
                    </button>
                  </DetailSection>

                  <DetailSection
                    title="Status actions"
                    icon={
                      <CalendarDays className="h-5 w-5" />
                    }
                  >
                    <div className="space-y-2">
                      <StatusButton
                        label="Move to under review"
                        disabled={
                          saving ||
                          selected.application_status ===
                            "under_review"
                        }
                        alreadySubmitted={
                          selected.application_status ===
                          "under_review"
                        }
                        alreadyMessage="Application is already under review."
                        onClick={() =>
                          void updateApplication(
                            {
                              application_status: "under_review",
                              admin_notes: adminNotes,
                            },
                            "Application moved to under review.",
                          )
                        }
                      />

                      <StatusButton
                        label="Approve application"
                        good
                        disabled={
                          saving ||
                          selected.application_status ===
                            "approved"
                        }
                        alreadySubmitted={
                          selected.application_status ===
                          "approved"
                        }
                        alreadyMessage="Application is already approved."
                        onClick={() =>
                          void updateApplication(
                            {
                              application_status: "approved",
                              admin_notes: adminNotes,
                              rejection_reason: null,
                            },
                            "Application approved successfully.",
                          )
                        }
                      />

                      <StatusButton
                        label={
                          saving
                            ? "Updating application"
                            : "Reject application"
                        }
                        danger
                        disabled={
                          saving ||
                          selected.application_status ===
                            "rejected"
                        }
                        alreadySubmitted={
                          selected.application_status ===
                          "rejected"
                        }
                        alreadyMessage="Application is already rejected."
                        onClick={
                          requestRejection
                        }
                      />
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Danger zone"
                    icon={
                      <Trash2 className="h-5 w-5" />
                    }
                  >
                    <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-4">
                      <p className="text-sm font-black text-red-100">
                        Permanently delete application
                      </p>
                      <p className="mt-2 text-xs leading-5 text-red-100/70">
                        This permanently removes the application. You must enter the main admin password and type DELETE to continue.
                      </p>

                      <button
                        type="button"
                        onClick={requestDeleteApplication}
                        disabled={saving || paymentSaving || deleting}
                        className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/20 px-4 py-2 text-sm font-black text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete application
                      </button>
                    </div>
                  </DetailSection>

                  <DetailSection
                    title="Payment"
                    icon={
                      <CircleDollarSign className="h-5 w-5" />
                    }
                  >
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-cyan-200" />
                        <div>
                          <p className="text-sm font-black text-cyan-100">
                            Connected to Money Management
                          </p>
                          <p className="mt-1 text-xs leading-5 text-cyan-50/70">
                            Payment details, discounts and uploaded receipts are sent to the Money Management tracker when saved.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => openPaymentModal(selected.payment_status)}
                      disabled={saving || paymentSaving}
                      className="mt-4 flex min-h-12 w-full items-center justify-between rounded-2xl border border-white/10 bg-black/20 px-4 text-left text-sm font-bold transition hover:border-purple-300/30 hover:bg-white/[0.06] disabled:opacity-50"
                    >
                      <span>{paymentStatusLabel(selected.payment_status)}</span>
                      <span className="text-xs text-purple-200">Open payment details</span>
                    </button>
                  </DetailSection>
                </aside>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && selected ? (
        <div className="fixed inset-0 z-[210000] flex items-center justify-center bg-slate-950/90 p-3 backdrop-blur-md sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-application-title"
            className="w-full max-w-xl rounded-[2rem] border border-red-400/25 bg-[#160b12] p-5 text-white shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-500/20 text-red-100">
                  <Trash2 className="h-6 w-6" />
                </div>
                <h2
                  id="delete-application-title"
                  className="mt-4 text-2xl font-black"
                >
                  Delete application permanently
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/65">
                  You are deleting{" "}
                  <strong className="text-white">
                    {selected.organisation_name}
                  </strong>
                  . This cannot be undone.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setDeleteConfirmOpen(false);
                  setDeletePassword("");
                  setShowDeletePassword(false);
                  setDeleteConfirmation("");
                  setDeleteError("");
                }}
                disabled={deleting}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-50"
                aria-label="Close delete confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-red-400/20 bg-red-500/10 p-4">
              <p className="text-sm font-black text-red-100">
                Main admin verification required
              </p>
              <p className="mt-1 text-xs leading-5 text-red-100/70">
                Enter the main admin password and type DELETE exactly.
              </p>
            </div>

            <label className="mt-5 block text-sm font-bold text-white/75">
              Main admin password
              <div className="relative mt-2">
                <input
                  type={showDeletePassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={deletePassword}
                  onChange={(event) => {
                    setDeletePassword(event.target.value);
                    if (deleteError) setDeleteError("");
                  }}
                  placeholder="Enter main admin password"
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 pr-12 font-semibold text-white outline-none focus:border-red-300/50"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowDeletePassword((current) => !current)
                  }
                  className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-xl text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label={
                    showDeletePassword
                      ? "Hide main admin password"
                      : "Show main admin password"
                  }
                  aria-pressed={showDeletePassword}
                >
                  {showDeletePassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </label>

            <label className="mt-4 block text-sm font-bold text-white/75">
              Type DELETE to confirm
              <input
                value={deleteConfirmation}
                onChange={(event) => {
                  setDeleteConfirmation(event.target.value);
                  if (deleteError) setDeleteError("");
                }}
                placeholder="DELETE"
                autoComplete="off"
                spellCheck={false}
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-black tracking-[0.2em] text-white outline-none focus:border-red-300/50"
              />
            </label>

            {deleteError ? (
              <p
                role="alert"
                className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm font-bold text-red-100"
              >
                {deleteError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  if (deleting) return;
                  setDeleteConfirmOpen(false);
                  setDeletePassword("");
                  setShowDeletePassword(false);
                  setDeleteConfirmation("");
                  setDeleteError("");
                }}
                disabled={deleting}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black hover:bg-white/[0.12] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void confirmDeleteApplication()
                }
                disabled={
                  deleting ||
                  deleteConfirmation.trim() !== "DELETE" ||
                  !deletePassword.trim()
                }
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/30 bg-red-500/25 px-4 text-sm font-black text-red-100 hover:bg-red-500/35 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                {deleting
                  ? "Deleting application"
                  : "Delete permanently"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {paymentModalOpen && selected ? (
        <div className="fixed inset-0 z-[190000] flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-md sm:p-5">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="payment-details-title"
            className="max-h-[calc(100dvh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0b1020] p-5 text-white shadow-2xl sm:p-8"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-200">
                  <CircleDollarSign className="h-6 w-6" />
                </div>
                <h2 id="payment-details-title" className="mt-4 text-2xl font-black">
                  Payment details
                </h2>
                <p className="mt-2 text-sm leading-6 text-white/60">
                  Check and correct the payment information before it is sent to Money Management.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setDuplicatePaymentConfirmOpen(false);
                }}
                disabled={paymentSaving}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-50"
                aria-label="Close payment details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-cyan-400/20 bg-cyan-500/10 p-4 text-sm text-cyan-50">
              This page is connected to the Money Management tracker. Saving this form creates or updates the linked money transaction.
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-white/75">
                Payment status
                <select
                  value={paymentForm.status}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value as PaymentStatus }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-semibold outline-none focus:border-purple-300/40"
                >
                  <option value="not_required" className="bg-slate-950">Not required</option>
                  <option value="awaiting_payment" className="bg-slate-950">Awaiting payment</option>
                  <option value="paid" className="bg-slate-950">Paid</option>
                  <option value="refunded" className="bg-slate-950">Refunded</option>
                </select>
              </label>

              <label className="block text-sm font-bold text-white/75">
                Original application cost
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-white/45">£</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={paymentForm.originalAmount}
                    onChange={(event) => setPaymentForm((current) => ({ ...current, originalAmount: event.target.value }))}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/30 pl-8 pr-4 font-semibold outline-none focus:border-purple-300/40"
                  />
                </div>
              </label>

              <label className="block text-sm font-bold text-white/75">
                Payment date
                <input
                  type="date"
                  value={paymentForm.paymentDate}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentDate: event.target.value }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-semibold outline-none focus:border-purple-300/40"
                />
              </label>

              <label className="block text-sm font-bold text-white/75">
                Payment method
                <select
                  value={paymentForm.paymentMethod}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentMethod: event.target.value as PaymentMethod }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-semibold outline-none focus:border-purple-300/40"
                >
                  <option value="bank_transfer" className="bg-slate-950">Bank transfer</option>
                  <option value="card" className="bg-slate-950">Card</option>
                  <option value="cash" className="bg-slate-950">Cash</option>
                  <option value="online" className="bg-slate-950">Online payment</option>
                  <option value="other" className="bg-slate-950">Other</option>
                </select>
              </label>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
              <button
                type="button"
                onClick={() => setPaymentForm((current) => ({ ...current, discountEnabled: !current.discountEnabled }))}
                className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-black transition ${paymentForm.discountEnabled ? "border-amber-400/30 bg-amber-500/15 text-amber-100" : "border-white/10 bg-black/20 text-white/75 hover:bg-white/[0.06]"}`}
              >
                <Percent className="h-4 w-4" />
                {paymentForm.discountEnabled ? "Discount enabled" : "Add percentage discount"}
              </button>

              {paymentForm.discountEnabled ? (
                <label className="mt-4 block text-sm font-bold text-white/75">
                  Discount percentage
                  <div className="relative mt-2">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={paymentForm.discountPercent}
                      onChange={(event) => setPaymentForm((current) => ({ ...current, discountPercent: event.target.value }))}
                      className="h-12 w-full rounded-2xl border border-amber-400/20 bg-black/30 px-4 pr-10 font-semibold outline-none focus:border-amber-300/50"
                    />
                    <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-amber-200">%</span>
                  </div>
                </label>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <PaymentSummary label="Original cost" value={formatMoney(paymentOriginalPence)} />
                <PaymentSummary label="Discount" value={`-${formatMoney(paymentDiscountPence)}`} />
                <PaymentSummary label="Amount due" value={formatMoney(paymentFinalPence)} strong />
              </div>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block text-sm font-bold text-white/75">
                Payment reference
                <input
                  value={paymentForm.paymentReference}
                  onChange={(event) => setPaymentForm((current) => ({ ...current, paymentReference: event.target.value }))}
                  placeholder="Bank, Stripe or cash reference"
                  className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-black/30 px-4 font-semibold outline-none focus:border-purple-300/40"
                />
              </label>

              <label className="block text-sm font-bold text-white/75">
                Upload receipt
                <span className="mt-2 flex min-h-12 cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-black/30 px-4 hover:border-purple-300/30">
                  <Upload className="h-4 w-4 text-purple-200" />
                  <span className="min-w-0 truncate text-sm text-white/65">
                    {paymentForm.receipt?.name || "Choose receipt file"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    className="sr-only"
                    onChange={(event) => setPaymentForm((current) => ({ ...current, receipt: event.target.files?.[0] || null }))}
                  />
                </span>
              </label>
            </div>

            <label className="mt-5 block text-sm font-bold text-white/75">
              Payment notes
              <textarea
                value={paymentForm.notes}
                onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))}
                className="mt-2 min-h-24 w-full rounded-2xl border border-white/10 bg-black/30 p-4 text-sm outline-none focus:border-purple-300/40"
              />
            </label>

            {selected.payment_status !== "not_required" ? (
              <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm text-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                  <div>
                    <p className="font-black">A payment has already been sent</p>
                    <p className="mt-1 leading-6 text-amber-50/75">
                      You can send another payment, but you will be asked to confirm it. The new Money Management transaction will be marked as a possible duplicate.
                    </p>
                  </div>
                </div>
              </div>
            ) : null}

            {paymentError ? (
              <p role="alert" className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {paymentError}
              </p>
            ) : null}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setPaymentModalOpen(false);
                  setDuplicatePaymentConfirmOpen(false);
                }}
                disabled={paymentSaving}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black hover:bg-white/[0.12] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void submitPaymentDetails()}
                disabled={paymentSaving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-400/25 bg-emerald-500/20 px-4 text-sm font-black text-emerald-100 hover:bg-emerald-500/30 disabled:opacity-50"
              >
                {paymentSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CircleDollarSign className="h-4 w-4" />}
                {paymentSaving ? "Saving payment" : "Save and send to Money Management"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {duplicatePaymentConfirmOpen && selected ? (
        <div className="fixed inset-0 z-[210000] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-payment-title"
            className="w-full max-w-lg rounded-[2rem] border border-amber-400/25 bg-[#0b1020] p-6 text-white shadow-2xl sm:p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-200">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <h2 id="duplicate-payment-title" className="mt-5 text-2xl font-black">
              Payment already sent
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              A payment for <strong className="text-white">{selected.organisation_name}</strong> has already been sent to Money Management. Sending it again will create a new transaction.
            </p>

            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-sm font-black text-amber-100">Possible duplicate warning</p>
              <p className="mt-2 text-sm leading-6 text-amber-50/75">
                The new transaction will include a comment saying it could be a duplicate and needs checking.
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setDuplicatePaymentConfirmOpen(false)}
                disabled={paymentSaving}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.06] px-4 text-sm font-black transition hover:bg-white/[0.12] disabled:opacity-50"
              >
                Go back
              </button>

              <button
                type="button"
                onClick={() => void submitPaymentDetails(true)}
                disabled={paymentSaving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/20 px-4 text-sm font-black text-amber-100 transition hover:bg-amber-500/30 disabled:opacity-50"
              >
                {paymentSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="h-4 w-4" />
                )}
                {paymentSaving ? "Sending again" : "Send again anyway"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejectConfirmOpen &&
      selected ? (
        <div className="fixed inset-0 z-[200000] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="reject-confirm-title"
            className="w-full max-w-lg rounded-[2rem] border border-red-400/20 bg-[#0b1020] p-6 text-white shadow-2xl sm:p-8"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/15 text-red-200">
              <XCircle className="h-7 w-7" />
            </div>

            <h2
              id="reject-confirm-title"
              className="mt-5 text-2xl font-black"
            >
              Reject this application?
            </h2>

            <p className="mt-3 text-sm leading-6 text-white/65">
              You are about to reject the application from{" "}
              <strong className="text-white">
                {selected.organisation_name}
              </strong>
              . The rejection reason will be saved with the application.
            </p>

            <div className="mt-5 rounded-2xl border border-red-400/15 bg-red-500/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-red-200/70">
                Rejection reason
              </p>

              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-red-50">
                {rejectionReason.trim()}
              </p>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setRejectConfirmOpen(false)
                }
                disabled={saving}
                className="min-h-12 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-3 text-sm font-black transition hover:bg-white/[0.12] disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() =>
                  void confirmRejection()
                }
                disabled={saving}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-red-400/25 bg-red-500/20 px-4 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Rejecting
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4" />
                    Confirm rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4 shadow-lg backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-black uppercase tracking-[0.13em] text-white/45">
          {label}
        </p>
        <span className="text-purple-200">
          {icon}
        </span>
      </div>
      <p className="mt-3 text-2xl font-black">
        {value}
      </p>
    </div>
  );
}

function ApplicationCard({
  application,
  onOpen,
}: {
  application: EventVendorApplication;
  onOpen: () => void;
}) {
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/[0.07] p-5 shadow-xl backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.09]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200">
            {typeIcon(
              application.application_type,
            )}
          </div>

          <div>
            <h2 className="text-lg font-black">
              {
                application.organisation_name
              }
            </h2>
            <p className="mt-1 text-sm text-white/55">
              {
                application.application_reference
              }
            </p>
          </div>
        </div>

        <span
          className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
            application.application_status,
          )}`}
        >
          {statusLabel(
            application.application_status,
          )}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <MiniDetail
          label="Type"
          value={applicationTypeLabel(
            application.application_type,
          )}
        />
        <MiniDetail
          label="Fee"
          value={formatMoney(
            application.fee_pence,
          )}
        />
        <MiniDetail
          label="Contact"
          value={application.contact_name}
        />
        <MiniDetail
          label="Submitted"
          value={formatDate(
            application.submitted_at,
          )}
        />
      </div>

      <button
        type="button"
        onClick={onOpen}
        className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 px-4 py-2 text-sm font-black shadow-lg transition hover:brightness-110"
      >
        Review application
        <ChevronRight className="h-4 w-4" />
      </button>
    </article>
  );
}

function MiniDetail({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-[11px] font-black uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-1 text-sm font-bold text-white/80">
        {value}
      </p>
    </div>
  );
}

function DetailSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.75rem] border border-white/10 bg-white/[0.055] p-5">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/15 text-purple-200">
          {icon}
        </div>
        <h3 className="text-lg font-black">
          {title}
        </h3>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function DetailGrid({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {children}
    </div>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/15 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-white/40">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-bold text-white/80">
        {value}
      </p>
    </div>
  );
}

function DocumentLink({
  label,
  url,
}: {
  label: string;
  url: string | null;
}) {
  if (!url) {
    return (
      <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4">
        <p className="text-sm font-black">
          {label}
        </p>
        <p className="mt-1 text-xs text-red-200/70">
          Not uploaded
        </p>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 transition hover:bg-emerald-500/15"
    >
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-emerald-200" />
        <p className="text-sm font-black">
          {label}
        </p>
      </div>
      <p className="mt-1 text-xs text-emerald-100/70">
        View document
      </p>
    </a>
  );
}

function paymentStatusLabel(status: PaymentStatus) {
  if (status === "awaiting_payment") return "Awaiting payment";
  if (status === "paid") return "Paid";
  if (status === "refunded") return "Refunded";
  return "Not required";
}

function PaymentSummary({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-emerald-400/25 bg-emerald-500/10" : "border-white/10 bg-black/20"}`}>
      <p className="text-[11px] font-black uppercase tracking-wide text-white/40">{label}</p>
      <p className={`mt-1 text-base font-black ${strong ? "text-emerald-100" : "text-white/80"}`}>{value}</p>
    </div>
  );
}

function StatusButton({
  label,
  onClick,
  disabled,
  good = false,
  danger = false,
  alreadySubmitted = false,
  alreadyMessage = "You submitted it already.",
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
  good?: boolean;
  danger?: boolean;
  alreadySubmitted?: boolean;
  alreadyMessage?: string;
}) {
  const classes = danger
    ? "border-red-400/20 bg-red-500/10 text-red-100 hover:bg-red-500/20"
    : good
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/20"
      : "border-blue-400/20 bg-blue-500/10 text-blue-100 hover:bg-blue-500/20";

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-describedby={
          alreadySubmitted
            ? `${label.replaceAll(" ", "-").toLowerCase()}-submitted`
            : undefined
        }
        className={`min-h-11 w-full rounded-2xl border px-4 py-2 text-sm font-black transition disabled:cursor-not-allowed disabled:opacity-60 ${classes}`}
      >
        {label}
      </button>

      {alreadySubmitted ? (
        <p
          id={`${label.replaceAll(" ", "-").toLowerCase()}-submitted`}
          className="mt-1.5 px-2 text-xs font-bold text-amber-200"
        >
          {alreadyMessage}
        </p>
      ) : null}
    </div>
  );
}
