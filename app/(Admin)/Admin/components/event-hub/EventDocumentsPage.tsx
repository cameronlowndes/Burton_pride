"use client";

import {
  AlertTriangle,
  Activity,
  Archive,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Download,
  Eye,
  EyeOff,
  FileCheck2,
  FileClock,
  FileText,
  Filter,
  FolderArchive,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";

type DocumentStatus =
  | "draft"
  | "uploaded"
  | "awaiting_review"
  | "approved"
  | "rejected"
  | "expired"
  | "replaced"
  | "archived";

type ExpiryState =
  | "no_expiry"
  | "valid"
  | "expiring_soon"
  | "expired";

type EventDocument = {
  id: string;
  event_id: string;
  event_name?: string | null;
  title: string;
  description?: string | null;
  category: string;
  organisation_name?: string | null;
  document_reference?: string | null;
  original_file_name: string;
  mime_type: string;
  file_size_bytes: number;
  issue_date?: string | null;
  expiry_date?: string | null;
  status: DocumentStatus;
  is_required: boolean;
  is_confidential: boolean;
  is_current_version: boolean;
  is_archived: boolean;
  version_number: number;
  uploaded_by_name?: string | null;
  uploaded_by_email?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

type EventOption = {
  id: string;
  event_name: string;
  event_year?: number | null;
  event_date?: string | null;
  is_active?: boolean | null;
};

type ApiErrorPayload = {
  error?: unknown;
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
  requestId?: string | null;
  request_id?: string | null;
  supabase_code?: unknown;
  supabase_message?: unknown;
  supabase_details?: unknown;
  supabase_hint?: unknown;
};

type DetailedError = {
  title: string;
  action: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  requestId?: string;
  httpStatus?: number;
  endpoint?: string;
  timestamp: string;
};

type ApiResponse = ApiErrorPayload & {
  documents?: EventDocument[];
  events?: EventOption[];
};

type UploadForm = {
  eventId: string;
  title: string;
  category: string;
  organisationName: string;
  documentReference: string;
  description: string;
  issueDate: string;
  expiryDate: string;
  isRequired: boolean;
  isConfidential: boolean;
  notes: string;
  file: File | null;
};

type ReviewDecision = "approved" | "rejected";

type ReviewForm = {
  decision: ReviewDecision;
  reviewNotes: string;
  rejectionReason: string;
  issueDate: string;
  expiryDate: string;
  organisationName: string;
};

type DeleteDocumentForm = {
  mainAdminPassword: string;
  confirmation: string;
};

type EditDocumentForm = {
  eventId: string;
  title: string;
  category: string;
  organisationName: string;
  documentReference: string;
  description: string;
  issueDate: string;
  expiryDate: string;
  status: DocumentStatus;
  versionNumber: string;
  isRequired: boolean;
  isConfidential: boolean;
  isCurrentVersion: boolean;
  isArchived: boolean;
  notes: string;
};

type ApiTestCheck = {
  label: string;
  passed: boolean;
  message: string;
};

type ApiTestResult = {
  endpoint: string;
  method: "GET";
  startedAt: string;
  completedAt: string;
  durationMs: number;
  httpStatus: number | null;
  statusText: string;
  ok: boolean;
  requestId?: string;
  contentType?: string;
  checks: ApiTestCheck[];
  responseBody: unknown;
  networkError?: string;
};

const CATEGORY_OPTIONS = [
  ["public_liability_insurance", "Public Liability Insurance"],
  ["event_insurance", "Event Insurance"],
  ["employers_liability_insurance", "Employers’ Liability Insurance"],
  ["risk_assessment", "Risk Assessment"],
  ["fire_risk_assessment", "Fire Risk Assessment"],
  ["event_management_plan", "Event Management Plan"],
  ["emergency_plan", "Emergency Plan"],
  ["security_plan", "Security Plan"],
  ["medical_plan", "Medical and First Aid Plan"],
  ["safeguarding_policy", "Safeguarding Policy"],
  ["lost_child_policy", "Lost Child Policy"],
  ["accessibility_plan", "Accessibility Plan"],
  ["noise_management_plan", "Noise Management Plan"],
  ["waste_management_plan", "Waste Management Plan"],
  ["traffic_management_plan", "Traffic Management Plan"],
  ["site_plan", "Site Plan"],
  ["premises_licence", "Premises Licence"],
  ["temporary_event_notice", "Temporary Event Notice"],
  ["music_licence", "Music Licence"],
  ["food_hygiene_document", "Food Hygiene Document"],
  ["gas_safety_certificate", "Gas Safety Certificate"],
  ["electrical_safety_certificate", "Electrical Safety Certificate"],
  ["equipment_safety_certificate", "Equipment Safety Certificate"],
  ["supplier_insurance", "Supplier Insurance"],
  ["contract", "Contract"],
  ["invoice", "Invoice"],
  ["council_document", "Council Document"],
  ["police_document", "Police Document"],
  ["security_document", "Security Document"],
  ["first_aid_document", "First Aid Document"],
  ["volunteer_document", "Volunteer Document"],
  ["other", "Other"],
] as const;

const STATUS_OPTIONS: Array<[DocumentStatus | "all", string]> = [
  ["all", "All statuses"],
  ["awaiting_review", "Awaiting review"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
  ["uploaded", "Uploaded"],
  ["draft", "Draft"],
  ["expired", "Expired"],
  ["replaced", "Replaced"],
  ["archived", "Archived"],
];

const EMPTY_UPLOAD_FORM: UploadForm = {
  eventId: "",
  title: "",
  category: "public_liability_insurance",
  organisationName: "",
  documentReference: "",
  description: "",
  issueDate: "",
  expiryDate: "",
  isRequired: false,
  isConfidential: true,
  notes: "",
  file: null,
};

function formatCategory(value: string) {
  const match = CATEGORY_OPTIONS.find(([key]) => key === value);
  if (match) return match[1];

  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value?: string | null) {
  if (!value) return "Not set";

  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Not set";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return "Unknown";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";

  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );

  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

function getExpiryState(expiryDate?: string | null): ExpiryState {
  if (!expiryDate) return "no_expiry";

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(`${expiryDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return "no_expiry";

  const warningDate = new Date(today);
  warningDate.setDate(warningDate.getDate() + 30);

  if (expiry < today) return "expired";
  if (expiry <= warningDate) return "expiring_soon";

  return "valid";
}


function apiValueToText(
  value: unknown,
): string | undefined {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return undefined;
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (value instanceof Error) {
    return value.message;
  }

  try {
    return JSON.stringify(
      value,
      null,
      2,
    );
  } catch {
    return String(value);
  }
}

function readApiError(
  payload: ApiErrorPayload,
  fallbackMessage: string,
): {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  requestId?: string;
} {
  return {
    message:
      apiValueToText(
        payload.message,
      ) ||
      apiValueToText(
        payload.error,
      ) ||
      apiValueToText(
        payload.supabase_message,
      ) ||
      fallbackMessage,

    code:
      apiValueToText(
        payload.code,
      ) ||
      apiValueToText(
        payload.supabase_code,
      ),

    details:
      apiValueToText(
        payload.details,
      ) ||
      apiValueToText(
        payload.supabase_details,
      ),

    hint:
      apiValueToText(
        payload.hint,
      ) ||
      apiValueToText(
        payload.supabase_hint,
      ),

    requestId:
      payload.requestId ||
      payload.request_id ||
      undefined,
  };
}

function createDetailedError({
  title,
  action,
  fallbackMessage,
  payload = {},
  response,
  endpoint,
  cause,
}: {
  title: string;
  action: string;
  fallbackMessage: string;
  payload?: ApiErrorPayload;
  response?: Response;
  endpoint?: string;
  cause?: unknown;
}): DetailedError {
  const parsed = readApiError(payload, fallbackMessage);

  return {
    title,
    action,
    message:
      cause instanceof Error && cause.message
        ? cause.message
        : parsed.message,
    code: parsed.code,
    details: parsed.details,
    hint: parsed.hint,
    requestId:
      parsed.requestId ||
      response?.headers.get("x-request-id") ||
      response?.headers.get("x-vercel-id") ||
      undefined,
    httpStatus: response?.status,
    endpoint,
    timestamp: new Date().toISOString(),
  };
}

function DetailedErrorPanel({
  error,
  onClose,
}: {
  error: DetailedError;
  onClose: () => void;
}) {
  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-red-400/25 bg-red-500/10 shadow-xl shadow-red-950/20">
      <div className="flex items-start gap-3 border-b border-red-400/15 p-4">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-200" />

        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-red-100">{error.title}</p>
          <p className="mt-1 text-sm leading-6 text-red-100/80">
            {error.message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close error"
          className="rounded-lg p-1 text-red-100/70 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid gap-3 p-4 text-xs sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-red-300/10 bg-black/20 p-3">
          <p className="font-black uppercase tracking-wider text-red-100/45">
            Action
          </p>
          <p className="mt-1 break-words font-semibold text-red-50/85">
            {error.action}
          </p>
        </div>

        <div className="rounded-xl border border-red-300/10 bg-black/20 p-3">
          <p className="font-black uppercase tracking-wider text-red-100/45">
            HTTP status
          </p>
          <p className="mt-1 font-semibold text-red-50/85">
            {error.httpStatus ?? "No response"}
          </p>
        </div>

        <div className="rounded-xl border border-red-300/10 bg-black/20 p-3">
          <p className="font-black uppercase tracking-wider text-red-100/45">
            Error code
          </p>
          <p className="mt-1 break-all font-mono font-semibold text-red-50/85">
            {error.code || "Not supplied"}
          </p>
        </div>

        <div className="rounded-xl border border-red-300/10 bg-black/20 p-3">
          <p className="font-black uppercase tracking-wider text-red-100/45">
            Request ID
          </p>
          <p className="mt-1 break-all font-mono font-semibold text-red-50/85">
            {error.requestId || "Not supplied"}
          </p>
        </div>
      </div>

      {(error.details || error.hint || error.endpoint) ? (
        <div className="space-y-3 border-t border-red-400/15 p-4">
          {error.details ? (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-100/45">
                Technical details
              </p>
              <pre className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-red-300/10 bg-black/25 p-3 text-xs leading-5 text-red-50/80">
                {error.details}
              </pre>
            </div>
          ) : null}

          {error.hint ? (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-100/45">
                Suggested fix
              </p>
              <p className="mt-2 rounded-xl border border-amber-300/10 bg-amber-400/10 p-3 text-xs leading-5 text-amber-100">
                {error.hint}
              </p>
            </div>
          ) : null}

          {error.endpoint ? (
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-red-100/45">
                Endpoint
              </p>
              <code className="mt-2 block break-all rounded-xl border border-red-300/10 bg-black/25 p-3 text-xs text-red-50/75">
                {error.endpoint}
              </code>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="border-t border-red-400/15 px-4 py-3 text-[11px] text-red-100/35">
        Recorded at {formatDateTime(error.timestamp)}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const styles: Record<DocumentStatus, string> = {
    draft: "border-slate-400/20 bg-slate-400/10 text-slate-200",
    uploaded: "border-sky-400/20 bg-sky-400/10 text-sky-200",
    awaiting_review:
      "border-amber-400/20 bg-amber-400/10 text-amber-200",
    approved:
      "border-emerald-400/20 bg-emerald-400/10 text-emerald-200",
    rejected: "border-red-400/20 bg-red-400/10 text-red-200",
    expired: "border-orange-400/20 bg-orange-400/10 text-orange-200",
    replaced: "border-purple-400/20 bg-purple-400/10 text-purple-200",
    archived: "border-zinc-400/20 bg-zinc-400/10 text-zinc-300",
  };

  const labels: Record<DocumentStatus, string> = {
    draft: "Draft",
    uploaded: "Uploaded",
    awaiting_review: "Awaiting review",
    approved: "Approved",
    rejected: "Rejected",
    expired: "Expired",
    replaced: "Replaced",
    archived: "Archived",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function ExpiryBadge({ expiryDate }: { expiryDate?: string | null }) {
  const state = getExpiryState(expiryDate);

  if (state === "no_expiry") {
    return (
      <span className="text-xs font-medium text-white/45">No expiry</span>
    );
  }

  if (state === "expired") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-red-400/20 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-200">
        <XCircle className="h-3.5 w-3.5" />
        Expired
      </span>
    );
  }

  if (state === "expiring_soon") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
        <Clock3 className="h-3.5 w-3.5" />
        Expiring soon
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
      <CheckCircle2 className="h-3.5 w-3.5" />
      Valid
    </span>
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
  description,
}: {
  label: string;
  value: number;
  icon: typeof FileText;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-xl shadow-black/10 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-white/55">{label}</p>
          <p className="mt-2 text-3xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-white/40">{description}</p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.05] p-3">
          <Icon className="h-5 w-5 text-pink-200" />
        </div>
      </div>
    </div>
  );
}

export default function EventDocumentsPage() {
  const [documents, setDocuments] = useState<EventDocument[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [selectedEventId, setSelectedEventId] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<DocumentStatus | "all">("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [expiryFilter, setExpiryFilter] = useState<ExpiryState | "all">("all");
  const [showArchived, setShowArchived] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] =
    useState<UploadForm>(EMPTY_UPLOAD_FORM);
  const [selectedDocument, setSelectedDocument] =
    useState<EventDocument | null>(null);
  const [reviewDocument, setReviewDocument] =
    useState<EventDocument | null>(null);
  const [reviewForm, setReviewForm] = useState<ReviewForm>({
    decision: "approved",
    reviewNotes: "",
    rejectionReason: "",
    issueDate: "",
    expiryDate: "",
    organisationName: "",
  });
  const [isReviewing, setIsReviewing] = useState(false);
  const [editDocument, setEditDocument] =
    useState<EventDocument | null>(null);
  const [editForm, setEditForm] = useState<EditDocumentForm>({
    eventId: "",
    title: "",
    category: "other",
    organisationName: "",
    documentReference: "",
    description: "",
    issueDate: "",
    expiryDate: "",
    status: "uploaded",
    versionNumber: "1",
    isRequired: false,
    isConfidential: true,
    isCurrentVersion: true,
    isArchived: false,
    notes: "",
  });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteDocument, setDeleteDocument] =
    useState<EventDocument | null>(null);
  const [deleteForm, setDeleteForm] = useState<DeleteDocumentForm>({
    mainAdminPassword: "",
    confirmation: "",
  });
  const [showDeletePassword, setShowDeletePassword] = useState(false);
  const [isDeletingDocument, setIsDeletingDocument] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isTestingApi, setIsTestingApi] = useState(false);
  const [apiTestResult, setApiTestResult] =
    useState<ApiTestResult | null>(null);
  const [showApiTestModal, setShowApiTestModal] = useState(false);
  const [error, setError] = useState<DetailedError | null>(null);
  const [successMessage, setSuccessMessage] = useState("");

  async function loadDocuments(eventId = selectedEventId) {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();

      if (eventId) params.set("eventId", eventId);
      params.set("includeArchived", showArchived ? "true" : "false");

      const response = await fetch(
        `/api/admin/burton-pride-event-hub/documents?${params.toString()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = (await response.json().catch(() => ({}))) as ApiResponse;

      if (!response.ok) {
        setError(
          createDetailedError({
            title: "Event documents could not be loaded",
            action: "Load event documents",
            fallbackMessage: "Unable to load event documents.",
            payload,
            response,
            endpoint: `/api/admin/burton-pride-event-hub/documents?${params.toString()}`,
          }),
        );
        setDocuments([]);
        return;
      }

      const nextEvents = Array.isArray(payload.events) ? payload.events : [];
      const nextDocuments = Array.isArray(payload.documents)
        ? payload.documents
        : [];

      setEvents(nextEvents);
      setDocuments(nextDocuments);

      if (!eventId && nextEvents.length > 0) {
        const activeEvent =
          nextEvents.find((event) => event.is_active) || nextEvents[0];

        setSelectedEventId(activeEvent.id);
        setUploadForm((current) => ({
          ...current,
          eventId: activeEvent.id,
        }));
      }
    } catch (loadError) {
      setError(
        createDetailedError({
          title: "Event documents request failed",
          action: "Load event documents",
          fallbackMessage:
            "The browser could not complete the request. Check the network connection and API route.",
          endpoint: "/api/admin/burton-pride-event-hub/documents",
          cause: loadError,
        }),
      );
      setDocuments([]);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDocuments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showArchived]);

  useEffect(() => {
    if (!selectedEventId) return;

    setUploadForm((current) => ({
      ...current,
      eventId: selectedEventId,
    }));

    void loadDocuments(selectedEventId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEventId]);

  useEffect(() => {
    if (!successMessage) return;

    const timeout = window.setTimeout(() => {
      setSuccessMessage("");
    }, 5000);

    return () => window.clearTimeout(timeout);
  }, [successMessage]);

  const filteredDocuments = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return documents.filter((document) => {
      if (!showArchived && document.is_archived) return false;
      if (statusFilter !== "all" && document.status !== statusFilter) {
        return false;
      }
      if (
        categoryFilter !== "all" &&
        document.category !== categoryFilter
      ) {
        return false;
      }
      if (
        expiryFilter !== "all" &&
        getExpiryState(document.expiry_date) !== expiryFilter
      ) {
        return false;
      }

      if (!query) return true;

      return [
        document.title,
        document.description,
        document.organisation_name,
        document.document_reference,
        document.original_file_name,
        formatCategory(document.category),
        document.uploaded_by_name,
        document.uploaded_by_email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query));
    });
  }, [
    categoryFilter,
    documents,
    expiryFilter,
    searchQuery,
    showArchived,
    statusFilter,
  ]);

  const summary = useMemo(() => {
    const activeDocuments = documents.filter(
      (document) => !document.is_archived && document.is_current_version,
    );

    return {
      total: activeDocuments.length,
      approved: activeDocuments.filter(
        (document) =>
          document.status === "approved" &&
          getExpiryState(document.expiry_date) !== "expired",
      ).length,
      awaitingReview: activeDocuments.filter(
        (document) => document.status === "awaiting_review",
      ).length,
      expiringSoon: activeDocuments.filter(
        (document) =>
          getExpiryState(document.expiry_date) === "expiring_soon",
      ).length,
      expired: activeDocuments.filter(
        (document) =>
          document.status === "expired" ||
          getExpiryState(document.expiry_date) === "expired",
      ).length,
      requiredProblems: activeDocuments.filter(
        (document) =>
          document.is_required &&
          (document.status !== "approved" ||
            getExpiryState(document.expiry_date) === "expired"),
      ).length,
    };
  }, [documents]);

  function updateUploadField<K extends keyof UploadForm>(
    key: K,
    value: UploadForm[K],
  ) {
    setUploadForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function resetUploadModal() {
    setUploadForm({
      ...EMPTY_UPLOAD_FORM,
      eventId: selectedEventId,
    });
    setShowUploadModal(false);
    setIsUploading(false);
  }

  async function submitUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccessMessage("");

    if (!uploadForm.eventId) {
      setError({
        title: "Event is required",
        action: "Validate document upload",
        message: "Select the event this document belongs to before uploading.",
        code: "DOCUMENT_EVENT_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!uploadForm.title.trim()) {
      setError({
        title: "Document title is required",
        action: "Validate document upload",
        message: "Enter a clear title so admins can identify this document.",
        code: "DOCUMENT_TITLE_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!uploadForm.file) {
      setError({
        title: "Document file is required",
        action: "Validate document upload",
        message: "Choose a PDF, Word, Excel or supported image file to upload.",
        code: "DOCUMENT_FILE_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (uploadForm.file.size > 25 * 1024 * 1024) {
      setError({
        title: "Document is too large",
        action: "Validate document upload",
        message: "The selected file is larger than the 25MB upload limit.",
        code: "DOCUMENT_FILE_TOO_LARGE",
        details: `Selected file size: ${formatFileSize(uploadForm.file.size)}. Maximum allowed size: 25MB.`,
        hint: "Compress the document or split it into smaller files before uploading.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      uploadForm.issueDate &&
      uploadForm.expiryDate &&
      uploadForm.expiryDate < uploadForm.issueDate
    ) {
      setError({
        title: "Document dates are invalid",
        action: "Validate document upload",
        message: "The expiry date cannot be earlier than the issue date.",
        code: "DOCUMENT_DATE_RANGE_INVALID",
        details: `Issue date: ${uploadForm.issueDate}. Expiry date: ${uploadForm.expiryDate}.`,
        hint: "Correct one of the dates and submit the document again.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();

      formData.set("eventId", uploadForm.eventId);
      formData.set("title", uploadForm.title.trim());
      formData.set("category", uploadForm.category);
      formData.set(
        "organisationName",
        uploadForm.organisationName.trim(),
      );
      formData.set(
        "documentReference",
        uploadForm.documentReference.trim(),
      );
      formData.set("description", uploadForm.description.trim());
      formData.set("issueDate", uploadForm.issueDate);
      formData.set("expiryDate", uploadForm.expiryDate);
      formData.set("isRequired", String(uploadForm.isRequired));
      formData.set(
        "isConfidential",
        String(uploadForm.isConfidential),
      );
      formData.set("notes", uploadForm.notes.trim());
      formData.set("file", uploadForm.file);

      const response = await fetch("/api/admin/burton-pride-event-hub/documents", {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      const payload = (await response.json().catch(() => ({}))) as ApiErrorPayload;

      if (!response.ok) {
        setError(
          createDetailedError({
            title: "Document upload failed",
            action: "Upload event document",
            fallbackMessage: "Unable to upload the document.",
            payload,
            response,
            endpoint: "/api/admin/burton-pride-event-hub/documents",
          }),
        );
        setIsUploading(false);
        return;
      }

      resetUploadModal();
      setSuccessMessage(
        "Document uploaded successfully and is now awaiting review.",
      );
      await loadDocuments(uploadForm.eventId);
    } catch (uploadError) {
      setError(
        createDetailedError({
          title: "Document upload request failed",
          action: "Upload event document",
          fallbackMessage:
            "The browser could not complete the upload request.",
          endpoint: "/api/admin/burton-pride-event-hub/documents",
          cause: uploadError,
        }),
      );
      setIsUploading(false);
    }
  }

  async function downloadDocument(document: EventDocument) {
    setError(null);

    try {
      const response = await fetch(
        `/api/admin/burton-pride-event-hub/documents/${document.id}/download`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload = (await response.json().catch(() => ({}))) as
        ApiErrorPayload & { url?: string };

      if (!response.ok || !payload.url) {
        setError(
          createDetailedError({
            title: "Document download failed",
            action: `Download ${document.title}`,
            fallbackMessage: "Unable to create a secure download link.",
            payload,
            response,
            endpoint: `/api/admin/burton-pride-event-hub/documents/${document.id}/download`,
          }),
        );
        return;
      }

      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (downloadError) {
      setError(
        createDetailedError({
          title: "Document download request failed",
          action: `Download ${document.title}`,
          fallbackMessage:
            "The browser could not complete the download request.",
          endpoint: `/api/admin/burton-pride-event-hub/documents/${document.id}/download`,
          cause: downloadError,
        }),
      );
    }
  }


  function openReviewModal(document: EventDocument) {
    setError(null);
    setReviewDocument(document);
    setReviewForm({
      decision: "approved",
      reviewNotes: "",
      rejectionReason: "",
      issueDate: document.issue_date || "",
      expiryDate: document.expiry_date || "",
      organisationName: document.organisation_name || "",
    });
  }

  function closeReviewModal() {
    if (isReviewing) return;

    setReviewDocument(null);
    setReviewForm({
      decision: "approved",
      reviewNotes: "",
      rejectionReason: "",
      issueDate: "",
      expiryDate: "",
      organisationName: "",
    });
  }

  async function submitDocumentReview(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!reviewDocument) return;

    setError(null);
    setSuccessMessage("");

    if (
      reviewForm.issueDate &&
      reviewForm.expiryDate &&
      reviewForm.expiryDate < reviewForm.issueDate
    ) {
      setError({
        title: "Review dates are invalid",
        action: "Review event document",
        message: "The expiry date cannot be earlier than the issue date.",
        code: "DOCUMENT_REVIEW_DATE_RANGE_INVALID",
        details: `Issue date: ${reviewForm.issueDate}. Expiry date: ${reviewForm.expiryDate}.`,
        hint: "Correct one of the dates before submitting the review.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      reviewForm.decision === "rejected" &&
      !reviewForm.rejectionReason.trim()
    ) {
      setError({
        title: "Rejection reason is required",
        action: "Reject event document",
        message:
          "Enter a clear reason explaining why this document has been rejected.",
        code: "DOCUMENT_REJECTION_REASON_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setIsReviewing(true);

    const endpoint = `/api/admin/burton-pride-event-hub/documents/${reviewDocument.id}/review`;

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          decision: reviewForm.decision,
          reviewNotes: reviewForm.reviewNotes.trim(),
          rejectionReason:
            reviewForm.decision === "rejected"
              ? reviewForm.rejectionReason.trim()
              : "",
          issueDate: reviewForm.issueDate || null,
          expiryDate: reviewForm.expiryDate || null,
          organisationName: reviewForm.organisationName.trim() || null,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        ApiErrorPayload & { document?: EventDocument };

      if (!response.ok) {
        setError(
          createDetailedError({
            title: "Document review failed",
            action:
              reviewForm.decision === "approved"
                ? "Approve event document"
                : "Reject event document",
            fallbackMessage: "Unable to save the document review.",
            payload,
            response,
            endpoint,
          }),
        );
        return;
      }

      const updatedDocument = payload.document;

      if (updatedDocument) {
        setDocuments((current) =>
          current.map((document) =>
            document.id === updatedDocument.id
              ? { ...document, ...updatedDocument }
              : document,
          ),
        );

        setSelectedDocument((current) =>
          current?.id === updatedDocument.id
            ? { ...current, ...updatedDocument }
            : current,
        );
      }

      setSuccessMessage(
        reviewForm.decision === "approved"
          ? `"${reviewDocument.title}" has been approved.`
          : `"${reviewDocument.title}" has been rejected.`,
      );

      closeReviewModal();
      setSelectedDocument(null);
      await loadDocuments(reviewDocument.event_id);
    } catch (reviewError) {
      setError(
        createDetailedError({
          title: "Document review request failed",
          action:
            reviewForm.decision === "approved"
              ? "Approve event document"
              : "Reject event document",
          fallbackMessage:
            "The browser could not complete the document review request.",
          endpoint,
          cause: reviewError,
        }),
      );
    } finally {
      setIsReviewing(false);
    }
  }



  function openEditDocumentModal(document: EventDocument) {
    setError(null);
    setSuccessMessage("");
    setOpenMenuId(null);
    setEditDocument(document);
    setEditForm({
      eventId: document.event_id,
      title: document.title || "",
      category: document.category || "other",
      organisationName: document.organisation_name || "",
      documentReference: document.document_reference || "",
      description: document.description || "",
      issueDate: document.issue_date || "",
      expiryDate: document.expiry_date || "",
      status: document.status,
      versionNumber: String(document.version_number || 1),
      isRequired: Boolean(document.is_required),
      isConfidential: Boolean(document.is_confidential),
      isCurrentVersion: Boolean(document.is_current_version),
      isArchived: Boolean(document.is_archived),
      notes: document.notes || "",
    });
  }

  function closeEditDocumentModal() {
    if (isSavingEdit) return;

    setEditDocument(null);
    setEditForm({
      eventId: "",
      title: "",
      category: "other",
      organisationName: "",
      documentReference: "",
      description: "",
      issueDate: "",
      expiryDate: "",
      status: "uploaded",
      versionNumber: "1",
      isRequired: false,
      isConfidential: true,
      isCurrentVersion: true,
      isArchived: false,
      notes: "",
    });
  }

  function updateEditField<K extends keyof EditDocumentForm>(
    key: K,
    value: EditDocumentForm[K],
  ) {
    setEditForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  async function submitEditDocument(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editDocument) return;

    setError(null);
    setSuccessMessage("");

    const cleanTitle = editForm.title.trim();
    const versionNumber = Number(editForm.versionNumber);

    if (!editForm.eventId) {
      setError({
        title: "Event is required",
        action: "Edit event document",
        message:
          "Select the event this document belongs to.",
        code: "DOCUMENT_EVENT_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!cleanTitle) {
      setError({
        title: "Document title is required",
        action: "Edit event document",
        message:
          "Enter a clear title for the document.",
        code: "DOCUMENT_TITLE_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (cleanTitle.length > 180) {
      setError({
        title: "Document title is too long",
        action: "Edit event document",
        message:
          "The document title must be 180 characters or fewer.",
        code: "DOCUMENT_TITLE_TOO_LONG",
        details: `Current title length: ${cleanTitle.length}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      !Number.isInteger(versionNumber) ||
      versionNumber < 1 ||
      versionNumber > 999
    ) {
      setError({
        title: "Version number is invalid",
        action: "Edit event document",
        message:
          "Enter a whole version number between 1 and 999.",
        code: "DOCUMENT_VERSION_INVALID",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (
      editForm.issueDate &&
      editForm.expiryDate &&
      editForm.expiryDate < editForm.issueDate
    ) {
      setError({
        title: "Document dates are invalid",
        action: "Edit event document",
        message:
          "The expiry date cannot be earlier than the issue date.",
        code: "DOCUMENT_DATE_RANGE_INVALID",
        details: `Issue date: ${editForm.issueDate}. Expiry date: ${editForm.expiryDate}.`,
        hint:
          "Correct one of the dates and save the document again.",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    setIsSavingEdit(true);

    const endpoint =
      `/api/admin/burton-pride-event-hub/documents/${editDocument.id}`;

    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_id: editForm.eventId,
          title: cleanTitle,
          category: editForm.category,
          organisation_name:
            editForm.organisationName.trim() || null,
          document_reference:
            editForm.documentReference.trim() || null,
          description:
            editForm.description.trim() || null,
          issue_date: editForm.issueDate || null,
          expiry_date: editForm.expiryDate || null,
          status: editForm.status,
          version_number: versionNumber,
          is_required: editForm.isRequired,
          is_confidential: editForm.isConfidential,
          is_current_version: editForm.isCurrentVersion,
          is_archived: editForm.isArchived,
          notes: editForm.notes.trim() || null,
        }),
      });

      const payload = (await response
        .json()
        .catch(() => ({}))) as ApiErrorPayload & {
          document?: EventDocument;
        };

      if (!response.ok) {
        setError(
          createDetailedError({
            title: "Document update failed",
            action: `Edit ${editDocument.title}`,
            fallbackMessage:
              "Unable to save the document changes.",
            payload,
            response,
            endpoint,
          }),
        );
        return;
      }

      const updatedDocument = payload.document;

      if (updatedDocument) {
        setDocuments((current) =>
          current.map((document) =>
            document.id === updatedDocument.id
              ? { ...document, ...updatedDocument }
              : document,
          ),
        );

        setSelectedDocument((current) =>
          current?.id === updatedDocument.id
            ? { ...current, ...updatedDocument }
            : current,
        );
      }

      const eventId = editForm.eventId;
      const updatedTitle =
        updatedDocument?.title || cleanTitle;

      closeEditDocumentModal();
      setSuccessMessage(
        `"${updatedTitle}" was updated successfully.`,
      );

      if (eventId !== selectedEventId) {
        setSelectedEventId(eventId);
      } else {
        await loadDocuments(eventId);
      }
    } catch (editError) {
      setError(
        createDetailedError({
          title: "Document update request failed",
          action: `Edit ${editDocument.title}`,
          fallbackMessage:
            "The browser could not complete the document update request.",
          endpoint,
          cause: editError,
        }),
      );
    } finally {
      setIsSavingEdit(false);
    }
  }

  function openDeleteDocumentModal(document: EventDocument) {
    setError(null);
    setOpenMenuId(null);
    setDeleteDocument(document);
    setDeleteForm({
      mainAdminPassword: "",
      confirmation: "",
    });
    setShowDeletePassword(false);
  }

  function closeDeleteDocumentModal() {
    if (isDeletingDocument) return;

    setDeleteDocument(null);
    setDeleteForm({
      mainAdminPassword: "",
      confirmation: "",
    });
    setShowDeletePassword(false);
  }

  async function submitDeleteDocument(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!deleteDocument) return;

    setError(null);
    setSuccessMessage("");

    /*
     * Read directly from the submitted form. Password managers can visually
     * autofill an input without immediately firing React's onChange event,
     * which can leave deleteForm.mainAdminPassword empty even though dots are
     * visible in the field.
     */
    const submittedForm = new FormData(event.currentTarget);
    const submittedPassword = String(
      submittedForm.get("mainAdminPassword") || "",
    );
    const submittedConfirmation = String(
      submittedForm.get("confirmation") || "",
    ).trim();

    if (!submittedPassword) {
      setError({
        title: "Main-admin password is required",
        action: "Permanently delete event document",
        message:
          "Enter the main-admin deletion password before continuing.",
        code: "MAIN_ADMIN_PASSWORD_REQUIRED",
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (submittedConfirmation !== "DELETE") {
      setError({
        title: "Delete confirmation is incorrect",
        action: "Permanently delete event document",
        message:
          'Type the word "DELETE" exactly in capital letters to confirm permanent deletion.',
        code: "DELETE_CONFIRMATION_INVALID",
        details: `Received confirmation: ${submittedConfirmation || "empty"}`,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const endpoint = `/api/admin/burton-pride-event-hub/documents/${deleteDocument.id}`;

    setIsDeletingDocument(true);

    try {
      const response = await fetch(endpoint, {
        method: "DELETE",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mainAdminPassword: submittedPassword,
          confirmation: submittedConfirmation,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as
        ApiErrorPayload & { deletedDocumentId?: string };

      if (!response.ok) {
        setError(
          createDetailedError({
            title: "Document deletion failed",
            action: "Permanently delete event document",
            fallbackMessage: "Unable to permanently delete the document.",
            payload,
            response,
            endpoint,
          }),
        );
        return;
      }

      const deletedId =
        payload.deletedDocumentId || deleteDocument.id;
      const eventId = deleteDocument.event_id;
      const title = deleteDocument.title;

      setDocuments((current) =>
        current.filter((document) => document.id !== deletedId),
      );

      if (selectedDocument?.id === deletedId) {
        setSelectedDocument(null);
      }

      closeDeleteDocumentModal();

      const auditWarning =
        apiValueToText(
          (
            payload as ApiErrorPayload & {
              auditWarning?: unknown;
            }
          ).auditWarning,
        );

      setSuccessMessage(
        auditWarning
          ? `"${title}" and its stored file were permanently deleted. The audit log returned a warning, but the deletion completed successfully.`
          : `"${title}" and its stored file were permanently deleted.`,
      );

      await loadDocuments(eventId);
    } catch (deleteError) {
      setError(
        createDetailedError({
          title: "Document deletion request failed",
          action: "Permanently delete event document",
          fallbackMessage:
            "The browser could not complete the permanent deletion request.",
          endpoint,
          cause: deleteError,
        }),
      );
    } finally {
      setIsDeletingDocument(false);
    }
  }

  async function testDocumentsApi() {
    const endpoint =
      "/api/admin/burton-pride-event-hub/documents?includeArchived=false";

    setIsTestingApi(true);
    setApiTestResult(null);
    setShowApiTestModal(true);

    const startedAt = new Date();
    const startTime = performance.now();

    try {
      const response = await fetch(endpoint, {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
          "x-event-documents-test": "true",
        },
      });

      const durationMs = Math.round(performance.now() - startTime);
      const contentType = response.headers.get("content-type") || "";
      const requestId =
        response.headers.get("x-request-id") ||
        response.headers.get("x-vercel-id") ||
        undefined;

      let responseBody: unknown = null;
      let jsonParsed = false;

      try {
        responseBody = await response.json();
        jsonParsed = true;
      } catch {
        responseBody = await response.text().catch(() => "");
      }

      const payload =
        responseBody && typeof responseBody === "object"
          ? (responseBody as ApiResponse)
          : {};

      const returnedEvents = Array.isArray(payload.events);
      const returnedDocuments = Array.isArray(payload.documents);

      const checks: ApiTestCheck[] = [
        {
          label: "Route exists",
          passed: response.status !== 404,
          message:
            response.status === 404
              ? "The Next.js API route was not found."
              : `The route returned HTTP ${response.status}.`,
        },
        {
          label: "Server responded",
          passed: response.status > 0,
          message: `Response received in ${durationMs}ms.`,
        },
        {
          label: "JSON response",
          passed: jsonParsed && contentType.includes("application/json"),
          message: jsonParsed
            ? `Content-Type: ${contentType || "not supplied"}`
            : "The route did not return valid JSON.",
        },
        {
          label: "Authentication accepted",
          passed: response.status !== 401 && response.status !== 403,
          message:
            response.status === 401
              ? "The admin session was not recognised."
              : response.status === 403
                ? "The signed-in admin does not have permission."
                : "The request was not rejected for authentication.",
        },
        {
          label: "Events returned",
          passed: returnedEvents,
          message: returnedEvents
            ? `${payload.events?.length || 0} event record(s) returned.`
            : "The response did not contain an events array.",
        },
        {
          label: "Documents returned",
          passed: returnedDocuments,
          message: returnedDocuments
            ? `${payload.documents?.length || 0} document record(s) returned.`
            : "The response did not contain a documents array.",
        },
        {
          label: "Request ID available",
          passed: Boolean(
            requestId || payload.requestId || payload.request_id,
          ),
          message:
            requestId || payload.requestId || payload.request_id
              ? `Request ID: ${
                  requestId || payload.requestId || payload.request_id
                }`
              : "No request ID was returned.",
        },
        {
          label: "API request successful",
          passed: response.ok,
          message: response.ok
            ? "The Event Documents API is working."
            : apiValueToText(
                payload.message,
              ) ||
              apiValueToText(
                payload.error,
              ) ||
              `The API returned ${response.status} ${response.statusText}.`,
        },
      ];

      setApiTestResult({
        endpoint,
        method: "GET",
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        httpStatus: response.status,
        statusText: response.statusText,
        ok: response.ok,
        requestId:
          requestId ||
          payload.requestId ||
          payload.request_id ||
          undefined,
        contentType,
        checks,
        responseBody,
      });
    } catch (testError) {
      const durationMs = Math.round(performance.now() - startTime);
      const message =
        testError instanceof Error
          ? testError.message
          : "Unknown network error.";

      setApiTestResult({
        endpoint,
        method: "GET",
        startedAt: startedAt.toISOString(),
        completedAt: new Date().toISOString(),
        durationMs,
        httpStatus: null,
        statusText: "No response",
        ok: false,
        checks: [
          {
            label: "Route request",
            passed: false,
            message:
              "The browser could not connect to the Event Documents API.",
          },
          {
            label: "Network error",
            passed: false,
            message,
          },
        ],
        responseBody: null,
        networkError: message,
      });
    } finally {
      setIsTestingApi(false);
    }
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-[#07070b] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[-15%] top-[-20%] h-[560px] w-[560px] rounded-full bg-purple-700/20 blur-[140px]" />
        <div className="absolute right-[-10%] top-[10%] h-[480px] w-[480px] rounded-full bg-pink-600/15 blur-[140px]" />
        <div className="absolute bottom-[-25%] left-[35%] h-[520px] w-[520px] rounded-full bg-sky-700/10 blur-[150px]" />
      </div>

      <div className="relative w-full max-w-none px-3 py-5 sm:px-4 lg:px-5 xl:px-6">
        <header className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="border-b border-white/10 p-5 sm:p-7">
            <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-pink-300/20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-3 shadow-lg shadow-purple-950/40">
                  <FolderArchive className="h-7 w-7 text-pink-100" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-pink-200/70">
                    Burton Pride Event Hub
                  </p>
                  <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                    Event Documents
                  </h1>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                    Upload, review and safely manage insurance, licences,
                    event plans, risk assessments and other documents needed
                    for the main event.
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={() => void testDocumentsApi()}
                  disabled={isTestingApi}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-sky-300/20 bg-sky-500/10 px-4 text-sm font-black text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isTestingApi ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Activity className="h-4 w-4" />
                  )}
                  {isTestingApi ? "Testing API…" : "Test API"}
                </button>

                <button
                  type="button"
                  onClick={() => void loadDocuments()}
                  disabled={isLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-4 text-sm font-bold text-white transition hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RefreshCw
                    className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setUploadForm((current) => ({
                      ...current,
                      eventId: selectedEventId,
                    }));
                    setShowUploadModal(true);
                  }}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 text-sm font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110"
                >
                  <Upload className="h-4 w-4" />
                  Upload document
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-7 xl:grid-cols-6">
            <SummaryCard
              label="Total documents"
              value={summary.total}
              icon={FileText}
              description="Current, non-archived document versions."
            />
            <SummaryCard
              label="Approved"
              value={summary.approved}
              icon={FileCheck2}
              description="Approved documents that have not expired."
            />
            <SummaryCard
              label="Awaiting review"
              value={summary.awaitingReview}
              icon={FileClock}
              description="Uploaded documents needing an admin decision."
            />
            <SummaryCard
              label="Expiring soon"
              value={summary.expiringSoon}
              icon={Clock3}
              description="Documents expiring within the next 30 days."
            />
            <SummaryCard
              label="Expired"
              value={summary.expired}
              icon={XCircle}
              description="Documents that need replacement or renewal."
            />
            <SummaryCard
              label="Required issues"
              value={summary.requiredProblems}
              icon={AlertTriangle}
              description="Required documents not currently valid and approved."
            />
          </div>
        </header>

        {error ? (
          <DetailedErrorPanel
            error={error}
            onClose={() => setError(null)}
          />
        ) : null}

        {successMessage ? (
          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1">{successMessage}</div>
          </div>
        ) : null}

        <section className="mt-6 rounded-3xl border border-white/10 bg-white/[0.04] shadow-2xl shadow-black/20 backdrop-blur-2xl">
          <div className="border-b border-white/10 p-5 sm:p-6">
            <div className="grid gap-3 lg:grid-cols-[minmax(220px,0.75fr)_minmax(280px,1.5fr)_repeat(3,minmax(170px,0.65fr))]">
              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  Event
                </span>
                <select
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none transition focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                >
                  {events.length === 0 ? (
                    <option value="">No events found</option>
                  ) : null}
                  {events.map((event) => (
                    <option key={event.id} value={event.id}>
                      {event.event_name}
                      {event.event_year ? ` (${event.event_year})` : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  Search
                </span>
                <span className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search title, provider, reference or filename"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </span>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  Status
                </span>
                <select
                  value={statusFilter}
                  onChange={(event) =>
                    setStatusFilter(
                      event.target.value as DocumentStatus | "all",
                    )
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                >
                  {STATUS_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  Category
                </span>
                <select
                  value={categoryFilter}
                  onChange={(event) =>
                    setCategoryFilter(event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="all">All categories</option>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-white/45">
                  Expiry
                </span>
                <select
                  value={expiryFilter}
                  onChange={(event) =>
                    setExpiryFilter(
                      event.target.value as ExpiryState | "all",
                    )
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="all">All expiry states</option>
                  <option value="valid">Valid</option>
                  <option value="expiring_soon">Expiring soon</option>
                  <option value="expired">Expired</option>
                  <option value="no_expiry">No expiry date</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex cursor-pointer items-center gap-3 text-sm font-semibold text-white/65">
                <input
                  type="checkbox"
                  checked={showArchived}
                  onChange={(event) => setShowArchived(event.target.checked)}
                  className="h-4 w-4 rounded border-white/20 bg-black/30 accent-pink-500"
                />
                Show archived documents
              </label>

              <div className="inline-flex items-center gap-2 text-xs font-medium text-white/40">
                <Filter className="h-4 w-4" />
                Showing {filteredDocuments.length} of {documents.length}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1450px] w-full border-collapse">
              <thead>
                <tr className="border-b border-white/10 text-left">
                  {[
                    "Document",
                    "Category",
                    "Organisation",
                    "Version",
                    "Issue date",
                    "Expiry",
                    "Review status",
                    "Required",
                    "Uploaded",
                    "Actions",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="px-5 py-4 text-xs font-black uppercase tracking-wider text-white/40"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center">
                      <RefreshCw className="mx-auto h-7 w-7 animate-spin text-pink-200" />
                      <p className="mt-3 text-sm font-semibold text-white/55">
                        Loading event documents…
                      </p>
                    </td>
                  </tr>
                ) : filteredDocuments.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-16 text-center">
                      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                        <FileText className="h-7 w-7 text-white/35" />
                      </div>
                      <h2 className="mt-4 text-lg font-black text-white">
                        No documents found
                      </h2>
                      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/45">
                        Upload the first event document or change the filters
                        to view other records.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowUploadModal(true)}
                        className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-4 text-sm font-black text-white"
                      >
                        <Plus className="h-4 w-4" />
                        Upload document
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredDocuments.map((document) => (
                    <tr
                      key={document.id}
                      className="border-b border-white/[0.07] align-top transition last:border-0 hover:bg-white/[0.025]"
                    >
                      <td className="px-5 py-5">
                        <div className="flex min-w-[280px] items-start gap-3">
                          <div className="rounded-xl border border-white/10 bg-white/[0.05] p-2.5">
                            <FileText className="h-5 w-5 text-pink-200" />
                          </div>
                          <div>
                            <button
                              type="button"
                              onClick={() => setSelectedDocument(document)}
                              className="text-left text-sm font-black text-white transition hover:text-pink-200"
                            >
                              {document.title}
                            </button>
                            <p className="mt-1 max-w-[320px] truncate text-xs text-white/40">
                              {document.original_file_name}
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {document.is_confidential ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/20 bg-purple-400/10 px-2 py-0.5 text-[11px] font-bold text-purple-200">
                                  <ShieldCheck className="h-3 w-3" />
                                  Confidential
                                </span>
                              ) : null}
                              {document.is_archived ? (
                                <span className="inline-flex items-center gap-1 rounded-full border border-zinc-400/20 bg-zinc-400/10 px-2 py-0.5 text-[11px] font-bold text-zinc-300">
                                  <Archive className="h-3 w-3" />
                                  Archived
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-5 text-sm font-semibold text-white/65">
                        {formatCategory(document.category)}
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-sm font-semibold text-white/70">
                          {document.organisation_name || "Not recorded"}
                        </p>
                        {document.document_reference ? (
                          <p className="mt-1 text-xs text-white/35">
                            Ref: {document.document_reference}
                          </p>
                        ) : null}
                      </td>

                      <td className="px-5 py-5 text-sm font-bold text-white/60">
                        v{document.version_number}
                      </td>

                      <td className="px-5 py-5 text-sm font-medium text-white/60">
                        {formatDate(document.issue_date)}
                      </td>

                      <td className="px-5 py-5">
                        <p className="mb-2 text-sm font-medium text-white/60">
                          {formatDate(document.expiry_date)}
                        </p>
                        <ExpiryBadge expiryDate={document.expiry_date} />
                      </td>

                      <td className="px-5 py-5">
                        <StatusBadge status={document.status} />
                      </td>

                      <td className="px-5 py-5">
                        {document.is_required ? (
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-amber-200">
                            <AlertTriangle className="h-4 w-4" />
                            Required
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-white/35">
                            Optional
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-5">
                        <p className="text-sm font-semibold text-white/65">
                          {document.uploaded_by_name || "Unknown admin"}
                        </p>
                        <p className="mt-1 text-xs text-white/35">
                          {formatDateTime(document.created_at)}
                        </p>
                        <p className="mt-1 text-xs text-white/30">
                          {formatFileSize(document.file_size_bytes)}
                        </p>
                      </td>

                      <td className="relative px-5 py-5">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedDocument(document)}
                            className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white/70 transition hover:bg-white/[0.09] hover:text-white"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </button>

                          <button
                            type="button"
                            onClick={() => void downloadDocument(document)}
                            className="inline-flex h-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                            aria-label={`Download ${document.title}`}
                          >
                            <Download className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === document.id ? null : document.id,
                              )
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/65 transition hover:bg-white/[0.09] hover:text-white"
                            aria-label={`More actions for ${document.title}`}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </div>

                        {openMenuId === document.id ? (
                          <div className="absolute right-5 top-14 z-30 w-52 overflow-hidden rounded-xl border border-white/10 bg-[#111119] p-1.5 shadow-2xl shadow-black/60">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                openReviewModal(document);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              Review document
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              Replace document
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                openEditDocumentModal(document)
                              }
                              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              Edit details
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              View history
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                              }}
                              className="flex w-full items-center rounded-lg px-3 py-2.5 text-left text-xs font-bold text-white/65 transition hover:bg-white/[0.07] hover:text-white"
                            >
                              {document.is_archived
                                ? "Restore document"
                                : "Archive document"}
                            </button>

                            <div className="my-1 border-t border-white/10" />

                            <button
                              type="button"
                              onClick={() =>
                                openDeleteDocumentModal(document)
                              }
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-black text-red-300 transition hover:bg-red-500/10 hover:text-red-200"
                            >
                              <Trash2 className="h-4 w-4" />
                              Permanently delete
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {showApiTestModal ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[94vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101017] shadow-2xl shadow-black/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101017]/95 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-sky-200/65">
                  Event Documents Diagnostics
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  API test results
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  Tests the route, authentication, response format and returned
                  Event Hub data.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setShowApiTestModal(false)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close API test results"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-5 p-5 sm:p-6">
              {isTestingApi ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center rounded-2xl border border-sky-300/15 bg-sky-500/5 p-8 text-center">
                  <RefreshCw className="h-9 w-9 animate-spin text-sky-200" />
                  <p className="mt-4 text-lg font-black text-white">
                    Testing Event Documents API
                  </p>
                  <p className="mt-2 text-sm text-white/45">
                    Waiting for the route to respond…
                  </p>
                </div>
              ) : apiTestResult ? (
                <>
                  <div
                    className={`rounded-2xl border p-5 ${
                      apiTestResult.ok
                        ? "border-emerald-400/20 bg-emerald-500/10"
                        : "border-red-400/20 bg-red-500/10"
                    }`}
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex items-start gap-3">
                        {apiTestResult.ok ? (
                          <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-200" />
                        ) : (
                          <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-red-200" />
                        )}

                        <div>
                          <h3 className="text-lg font-black text-white">
                            {apiTestResult.ok
                              ? "API test passed"
                              : "API test failed"}
                          </h3>
                          <p className="mt-1 text-sm text-white/55">
                            HTTP {apiTestResult.httpStatus ?? "No response"}{" "}
                            {apiTestResult.statusText} in{" "}
                            {apiTestResult.durationMs}ms
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => void testDocumentsApi()}
                        disabled={isTestingApi}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-4 text-sm font-black text-white transition hover:bg-white/[0.1] disabled:opacity-50"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Run test again
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {[
                      ["Method", apiTestResult.method],
                      [
                        "HTTP status",
                        apiTestResult.httpStatus?.toString() || "No response",
                      ],
                      ["Response time", `${apiTestResult.durationMs}ms`],
                      ["Request ID", apiTestResult.requestId || "Not supplied"],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                      >
                        <p className="text-xs font-black uppercase tracking-wider text-white/35">
                          {label}
                        </p>
                        <p className="mt-2 break-all font-mono text-sm font-bold text-white/75">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-white/10">
                    <div className="border-b border-white/10 bg-white/[0.035] px-4 py-3">
                      <h3 className="text-sm font-black text-white">
                        Test checks
                      </h3>
                    </div>

                    <div className="divide-y divide-white/[0.07]">
                      {apiTestResult.checks.map((check) => (
                        <div
                          key={check.label}
                          className="flex items-start gap-3 p-4"
                        >
                          {check.passed ? (
                            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                          ) : (
                            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />
                          )}
                          <div>
                            <p className="text-sm font-black text-white/80">
                              {check.label}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/45">
                              {check.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-white/35">
                      Endpoint tested
                    </p>
                    <code className="mt-2 block break-all rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-sky-100/80">
                      {apiTestResult.endpoint}
                    </code>
                  </div>

                  <details className="overflow-hidden rounded-2xl border border-white/10 bg-black/20">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-black text-white/70 transition hover:bg-white/[0.04]">
                      View complete API response
                    </summary>
                    <pre className="max-h-[420px] overflow-auto border-t border-white/10 p-4 text-xs leading-5 text-white/60">
                      {JSON.stringify(apiTestResult.responseBody, null, 2)}
                    </pre>
                  </details>

                  <div className="grid gap-3 text-xs sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="font-black uppercase tracking-wider text-white/35">
                        Started
                      </p>
                      <p className="mt-1 text-white/65">
                        {formatDateTime(apiTestResult.startedAt)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                      <p className="font-black uppercase tracking-wider text-white/35">
                        Completed
                      </p>
                      <p className="mt-1 text-white/65">
                        {formatDateTime(apiTestResult.completedAt)}
                      </p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-8 text-center">
                  <Activity className="mx-auto h-8 w-8 text-sky-200" />
                  <p className="mt-3 text-sm font-bold text-white/65">
                    No test has been run yet.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {showUploadModal ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101017] shadow-2xl shadow-black/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101017]/95 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200/65">
                  Event Hub
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Upload event document
                </h2>
                <p className="mt-2 text-sm text-white/45">
                  The document will be private and marked as awaiting review.
                </p>
              </div>

              <button
                type="button"
                onClick={resetUploadModal}
                disabled={isUploading}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                aria-label="Close upload form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={submitUpload} className="space-y-6 p-5 sm:p-6">
              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Event <span className="text-pink-300">*</span>
                  </span>
                  <select
                    required
                    value={uploadForm.eventId}
                    onChange={(event) =>
                      updateUploadField("eventId", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">Select an event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.event_name}
                        {event.event_year ? ` (${event.event_year})` : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Document category <span className="text-pink-300">*</span>
                  </span>
                  <select
                    required
                    value={uploadForm.category}
                    onChange={(event) =>
                      updateUploadField("category", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  >
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-white/75">
                  Document title <span className="text-pink-300">*</span>
                </span>
                <input
                  required
                  maxLength={180}
                  value={uploadForm.title}
                  onChange={(event) =>
                    updateUploadField("title", event.target.value)
                  }
                  placeholder="Example: Burton Pride Public Liability Insurance 2027"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Organisation or provider
                  </span>
                  <input
                    maxLength={180}
                    value={uploadForm.organisationName}
                    onChange={(event) =>
                      updateUploadField(
                        "organisationName",
                        event.target.value,
                      )
                    }
                    placeholder="Insurance company, council or supplier"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Document reference
                  </span>
                  <input
                    maxLength={120}
                    value={uploadForm.documentReference}
                    onChange={(event) =>
                      updateUploadField(
                        "documentReference",
                        event.target.value,
                      )
                    }
                    placeholder="Policy, licence or reference number"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-white/75">
                  Description
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={uploadForm.description}
                  onChange={(event) =>
                    updateUploadField("description", event.target.value)
                  }
                  placeholder="Explain what this document covers."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-white/75">
                    <CalendarDays className="h-4 w-4 text-white/40" />
                    Issue date
                  </span>
                  <input
                    type="date"
                    value={uploadForm.issueDate}
                    onChange={(event) =>
                      updateUploadField("issueDate", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="flex items-center gap-2 text-sm font-bold text-white/75">
                    <Clock3 className="h-4 w-4 text-white/40" />
                    Expiry date
                  </span>
                  <input
                    type="date"
                    min={uploadForm.issueDate || undefined}
                    value={uploadForm.expiryDate}
                    onChange={(event) =>
                      updateUploadField("expiryDate", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <input
                    type="checkbox"
                    checked={uploadForm.isRequired}
                    onChange={(event) =>
                      updateUploadField("isRequired", event.target.checked)
                    }
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-pink-500"
                  />
                  <span>
                    <span className="block text-sm font-black text-white/80">
                      Required for this event
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Show warnings if this document is rejected or expires.
                    </span>
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <input
                    type="checkbox"
                    checked={uploadForm.isConfidential}
                    onChange={(event) =>
                      updateUploadField(
                        "isConfidential",
                        event.target.checked,
                      )
                    }
                    className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 accent-pink-500"
                  />
                  <span>
                    <span className="block text-sm font-black text-white/80">
                      Confidential document
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-white/40">
                      Restrict viewing and downloading to authorised admins.
                    </span>
                  </span>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-white/75">
                  Internal notes
                </span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={uploadForm.notes}
                  onChange={(event) =>
                    updateUploadField("notes", event.target.value)
                  }
                  placeholder="Private notes for Event Hub admins."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-bold text-white/75">
                  Document file <span className="text-pink-300">*</span>
                </span>

                <span className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-black/20 px-5 py-8 text-center transition hover:border-pink-300/35 hover:bg-white/[0.035]">
                  <Upload className="h-7 w-7 text-pink-200" />
                  <span className="mt-3 text-sm font-black text-white/80">
                    {uploadForm.file
                      ? uploadForm.file.name
                      : "Choose a document"}
                  </span>
                  <span className="mt-1 text-xs leading-5 text-white/40">
                    PDF, Word, Excel, JPG, PNG or WEBP. Maximum file size
                    25MB.
                  </span>
                  {uploadForm.file ? (
                    <span className="mt-2 text-xs font-bold text-pink-200">
                      {formatFileSize(uploadForm.file.size)}
                    </span>
                  ) : null}

                  <input
                    required
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                    onChange={(event) =>
                      updateUploadField(
                        "file",
                        event.target.files?.[0] || null,
                      )
                    }
                    className="sr-only"
                  />
                </span>
              </label>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetUploadModal}
                  disabled={isUploading}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isUploading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-sm font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isUploading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {isUploading ? "Uploading…" : "Upload document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {reviewDocument ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[94vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101017] shadow-2xl shadow-black/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101017]/95 p-5 backdrop-blur-xl sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-pink-300/20 bg-gradient-to-br from-purple-500/20 to-pink-500/20 p-3">
                  <FileCheck2 className="h-6 w-6 text-pink-100" />
                </div>

                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200/65">
                    Event document review
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    {reviewDocument.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/40">
                    {reviewDocument.original_file_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeReviewModal}
                disabled={isReviewing}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                aria-label="Close document review"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={submitDocumentReview}
              className="space-y-6 p-5 sm:p-6"
            >
              <div>
                <p className="mb-3 text-sm font-black text-white/75">
                  Review decision
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() =>
                      setReviewForm((current) => ({
                        ...current,
                        decision: "approved",
                        rejectionReason: "",
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      reviewForm.decision === "approved"
                        ? "border-emerald-300/40 bg-emerald-500/15 ring-2 ring-emerald-500/15"
                        : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-emerald-100">
                      <CheckCircle2 className="h-5 w-5" />
                      Approve document
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-white/40">
                      Confirm that this document is valid and acceptable for
                      the event.
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setReviewForm((current) => ({
                        ...current,
                        decision: "rejected",
                      }))
                    }
                    className={`rounded-2xl border p-4 text-left transition ${
                      reviewForm.decision === "rejected"
                        ? "border-red-300/40 bg-red-500/15 ring-2 ring-red-500/15"
                        : "border-white/10 bg-white/[0.035] hover:bg-white/[0.06]"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm font-black text-red-100">
                      <XCircle className="h-5 w-5" />
                      Reject document
                    </span>
                    <span className="mt-2 block text-xs leading-5 text-white/40">
                      Mark the document as unsuitable and record why it must be
                      replaced or corrected.
                    </span>
                  </button>
                </div>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Confirm issue date
                  </span>
                  <input
                    type="date"
                    value={reviewForm.issueDate}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        issueDate: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-bold text-white/75">
                    Confirm expiry date
                  </span>
                  <input
                    type="date"
                    min={reviewForm.issueDate || undefined}
                    value={reviewForm.expiryDate}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        expiryDate: event.target.value,
                      }))
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-white/75">
                  Confirm organisation or provider
                </span>
                <input
                  maxLength={180}
                  value={reviewForm.organisationName}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      organisationName: event.target.value,
                    }))
                  }
                  placeholder="Insurance company, council or supplier"
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-bold text-white/75">
                  Review notes
                </span>
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={reviewForm.reviewNotes}
                  onChange={(event) =>
                    setReviewForm((current) => ({
                      ...current,
                      reviewNotes: event.target.value,
                    }))
                  }
                  placeholder="Record what was checked and any important review notes."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              {reviewForm.decision === "rejected" ? (
                <label className="block space-y-2">
                  <span className="text-sm font-bold text-red-100">
                    Rejection reason <span className="text-red-300">*</span>
                  </span>
                  <textarea
                    required
                    rows={4}
                    maxLength={3000}
                    value={reviewForm.rejectionReason}
                    onChange={(event) =>
                      setReviewForm((current) => ({
                        ...current,
                        rejectionReason: event.target.value,
                      }))
                    }
                    placeholder="Explain exactly why the document was rejected and what needs correcting."
                    className="w-full resize-y rounded-xl border border-red-300/20 bg-red-500/5 px-3 py-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-300/40 focus:ring-2 focus:ring-red-500/20"
                  />
                </label>
              ) : null}

              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <p className="text-xs font-black uppercase tracking-wider text-white/35">
                  Current status
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusBadge status={reviewDocument.status} />
                  <ExpiryBadge expiryDate={reviewForm.expiryDate || null} />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeReviewModal}
                  disabled={isReviewing}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isReviewing}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-6 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50 ${
                    reviewForm.decision === "approved"
                      ? "bg-gradient-to-r from-emerald-500 to-green-500 shadow-emerald-950/40"
                      : "bg-gradient-to-r from-red-500 to-rose-500 shadow-red-950/40"
                  }`}
                >
                  {isReviewing ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : reviewForm.decision === "approved" ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    <XCircle className="h-4 w-4" />
                  )}

                  {isReviewing
                    ? "Saving review…"
                    : reviewForm.decision === "approved"
                      ? "Approve document"
                      : "Reject document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {editDocument ? (
        <div className="fixed inset-0 z-[135] flex items-center justify-center bg-black/85 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[95vh] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101017] shadow-2xl shadow-black/70">
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-white/10 bg-[#101017]/95 p-5 backdrop-blur-xl sm:p-6">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-200/65">
                  Event Hub document
                </p>
                <h2 className="mt-1 text-2xl font-black text-white">
                  Edit document details
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-white/45">
                  Update all document record details. This does not replace
                  the stored file; use Replace document when the actual file
                  needs changing.
                </p>
              </div>

              <button
                type="button"
                onClick={closeEditDocumentModal}
                disabled={isSavingEdit}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                aria-label="Close edit document form"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={submitEditDocument}
              className="space-y-6 p-5 sm:p-6"
            >
              <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                <div className="grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <p className="font-black uppercase tracking-wider text-white/35">
                      Document ID
                    </p>
                    <p className="mt-1 break-all font-mono text-white/65">
                      {editDocument.id}
                    </p>
                  </div>

                  <div>
                    <p className="font-black uppercase tracking-wider text-white/35">
                      Original file
                    </p>
                    <p className="mt-1 break-all text-white/65">
                      {editDocument.original_file_name}
                    </p>
                  </div>

                  <div>
                    <p className="font-black uppercase tracking-wider text-white/35">
                      File type
                    </p>
                    <p className="mt-1 break-all text-white/65">
                      {editDocument.mime_type}
                    </p>
                  </div>

                  <div>
                    <p className="font-black uppercase tracking-wider text-white/35">
                      File size
                    </p>
                    <p className="mt-1 text-white/65">
                      {formatFileSize(editDocument.file_size_bytes)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Event <span className="text-pink-300">*</span>
                  </span>
                  <select
                    required
                    value={editForm.eventId}
                    onChange={(event) =>
                      updateEditField("eventId", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  >
                    <option value="">Select an event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.event_name}
                        {event.event_year
                          ? ` (${event.event_year})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Category <span className="text-pink-300">*</span>
                  </span>
                  <select
                    required
                    value={editForm.category}
                    onChange={(event) =>
                      updateEditField("category", event.target.value)
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  >
                    {CATEGORY_OPTIONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-black text-white/75">
                  Document title <span className="text-pink-300">*</span>
                </span>
                <input
                  required
                  maxLength={180}
                  value={editForm.title}
                  onChange={(event) =>
                    updateEditField("title", event.target.value)
                  }
                  className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
                <span className="block text-right text-xs text-white/30">
                  {editForm.title.length}/180
                </span>
              </label>

              <div className="grid gap-5 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Organisation or provider
                  </span>
                  <input
                    maxLength={180}
                    value={editForm.organisationName}
                    onChange={(event) =>
                      updateEditField(
                        "organisationName",
                        event.target.value,
                      )
                    }
                    placeholder="Insurance company, council or supplier"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Document reference
                  </span>
                  <input
                    maxLength={180}
                    value={editForm.documentReference}
                    onChange={(event) =>
                      updateEditField(
                        "documentReference",
                        event.target.value,
                      )
                    }
                    placeholder="Policy, licence or certificate number"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-black text-white/75">
                  Description
                </span>
                <textarea
                  rows={4}
                  maxLength={3000}
                  value={editForm.description}
                  onChange={(event) =>
                    updateEditField(
                      "description",
                      event.target.value,
                    )
                  }
                  placeholder="Explain what this document covers."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Issue date
                  </span>
                  <input
                    type="date"
                    value={editForm.issueDate}
                    onChange={(event) =>
                      updateEditField(
                        "issueDate",
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Expiry date
                  </span>
                  <input
                    type="date"
                    value={editForm.expiryDate}
                    onChange={(event) =>
                      updateEditField(
                        "expiryDate",
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Status
                  </span>
                  <select
                    value={editForm.status}
                    onChange={(event) =>
                      updateEditField(
                        "status",
                        event.target.value as DocumentStatus,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/70 px-3 text-sm font-semibold text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  >
                    {STATUS_OPTIONS.filter(
                      ([value]) => value !== "all",
                    ).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="space-y-2">
                  <span className="text-sm font-black text-white/75">
                    Version number
                  </span>
                  <input
                    required
                    type="number"
                    min={1}
                    max={999}
                    step={1}
                    value={editForm.versionNumber}
                    onChange={(event) =>
                      updateEditField(
                        "versionNumber",
                        event.target.value,
                      )
                    }
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                  />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    key: "isRequired" as const,
                    label: "Required document",
                    description:
                      "Mark this as required for event readiness.",
                  },
                  {
                    key: "isConfidential" as const,
                    label: "Confidential",
                    description:
                      "Restrict and audit document access.",
                  },
                  {
                    key: "isCurrentVersion" as const,
                    label: "Current version",
                    description:
                      "Use this version as the active document.",
                  },
                  {
                    key: "isArchived" as const,
                    label: "Archived",
                    description:
                      "Hide this document from normal active views.",
                  },
                ].map((option) => (
                  <label
                    key={option.key}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.055]"
                  >
                    <input
                      type="checkbox"
                      checked={editForm[option.key]}
                      onChange={(event) =>
                        updateEditField(
                          option.key,
                          event.target.checked,
                        )
                      }
                      className="mt-1 h-4 w-4 rounded border-white/20 bg-black/30 accent-pink-500"
                    />
                    <span>
                      <span className="block text-sm font-black text-white/75">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-white/35">
                        {option.description}
                      </span>
                    </span>
                  </label>
                ))}
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-black text-white/75">
                  Internal notes
                </span>
                <textarea
                  rows={4}
                  maxLength={5000}
                  value={editForm.notes}
                  onChange={(event) =>
                    updateEditField("notes", event.target.value)
                  }
                  placeholder="Private notes for Event Hub admins."
                  className="w-full resize-y rounded-xl border border-white/10 bg-black/35 px-3 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/25 focus:border-pink-300/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </label>

              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                  <p className="text-xs leading-5 text-amber-100/75">
                    Changing approval status manually can affect Event Hub
                    compliance reporting. Use the Review document workflow
                    when recording a formal approval or rejection.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeEditDocumentModal}
                  disabled={isSavingEdit}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-6 text-sm font-black text-white shadow-lg shadow-purple-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <FileCheck2 className="h-4 w-4" />
                  )}
                  {isSavingEdit
                    ? "Saving changes…"
                    : "Save all changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteDocument ? (
        <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/90 p-3 backdrop-blur-md sm:p-6">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-red-400/20 bg-[#101017] shadow-2xl shadow-red-950/30">
            <div className="flex items-start justify-between gap-4 border-b border-red-400/15 bg-red-500/5 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-3">
                  <Trash2 className="h-6 w-6 text-red-200" />
                </div>

                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200/65">
                    Main admin only
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    Permanently delete document
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-white/45">
                    This removes the database record and the private stored
                    file. This action cannot be undone.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={closeDeleteDocumentModal}
                disabled={isDeletingDocument}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                aria-label="Close permanent delete dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={submitDeleteDocument}
              className="space-y-5 p-5 sm:p-6"
            >
              <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-4">
                <p className="text-xs font-black uppercase tracking-wider text-red-100/45">
                  Document being deleted
                </p>
                <p className="mt-2 text-lg font-black text-white">
                  {deleteDocument.title}
                </p>
                <p className="mt-1 break-all text-xs text-white/40">
                  {deleteDocument.original_file_name}
                </p>
                <p className="mt-2 break-all font-mono text-[11px] text-white/30">
                  ID: {deleteDocument.id}
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-sm font-black text-white/75">
                  Main-admin deletion password
                </span>

                <span className="relative block">
                  <input
                    required
                    name="mainAdminPassword"
                    type={showDeletePassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={deleteForm.mainAdminPassword}
                    onChange={(event) =>
                      setDeleteForm((current) => ({
                        ...current,
                        mainAdminPassword: event.target.value,
                      }))
                    }
                    placeholder="Enter the main-admin password"
                    className="h-11 w-full rounded-xl border border-white/10 bg-black/40 px-3 pr-12 text-sm text-white outline-none placeholder:text-white/25 focus:border-red-300/40 focus:ring-2 focus:ring-red-500/20"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowDeletePassword((current) => !current)
                    }
                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                    aria-label={
                      showDeletePassword
                        ? "Hide main-admin password"
                        : "Show main-admin password"
                    }
                    title={
                      showDeletePassword
                        ? "Hide password"
                        : "Show password"
                    }
                  >
                    {showDeletePassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </span>

                <span className="block text-xs leading-5 text-white/35">
                  The server also checks that the signed-in account has the
                  main_admin role. The password is read directly from the form,
                  including values inserted by a browser password manager.
                </span>
              </label>

              <label className="block space-y-2">
                <span className="text-sm font-black text-white/75">
                  Type <span className="font-mono text-red-300">DELETE</span>{" "}
                  to confirm
                </span>
                <input
                  required
                  name="confirmation"
                  value={deleteForm.confirmation}
                  onChange={(event) =>
                    setDeleteForm((current) => ({
                      ...current,
                      confirmation: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="DELETE"
                  autoComplete="off"
                  className="h-11 w-full rounded-xl border border-red-300/20 bg-red-500/5 px-3 font-mono text-sm font-black uppercase text-white outline-none placeholder:text-red-100/20 focus:border-red-300/40 focus:ring-2 focus:ring-red-500/20"
                />
              </label>

              <div className="rounded-2xl border border-amber-400/15 bg-amber-500/5 p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" />
                  <p className="text-xs leading-5 text-amber-100/75">
                    Use archive for normal removal. Permanent deletion should
                    only be used for duplicate, incorrect or test documents.
                  </p>
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeDeleteDocumentModal}
                  disabled={isDeletingDocument}
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] px-5 text-sm font-black text-white/65 transition hover:bg-white/[0.08] hover:text-white disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={
                    isDeletingDocument ||
                    deleteForm.confirmation.trim() !== "DELETE"
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 px-6 text-sm font-black text-white shadow-lg shadow-red-950/40 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isDeletingDocument ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  {isDeletingDocument
                    ? "Deleting permanently…"
                    : "Permanently delete"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {selectedDocument ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-3 backdrop-blur-md sm:p-6">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-white/10 bg-[#101017] shadow-2xl shadow-black/70">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl border border-white/10 bg-white/[0.05] p-3">
                  <FileText className="h-6 w-6 text-pink-200" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-pink-200/60">
                    Document details
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-white">
                    {selectedDocument.title}
                  </h2>
                  <p className="mt-1 text-sm text-white/40">
                    {selectedDocument.original_file_name}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedDocument(null)}
                className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-white/55 transition hover:bg-white/[0.08] hover:text-white"
                aria-label="Close document details"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div className="flex flex-wrap gap-2">
                <StatusBadge status={selectedDocument.status} />
                <ExpiryBadge expiryDate={selectedDocument.expiry_date} />
                {selectedDocument.is_required ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/20 bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-200">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Required
                  </span>
                ) : null}
                {selectedDocument.is_confidential ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-purple-400/20 bg-purple-400/10 px-2.5 py-1 text-xs font-semibold text-purple-200">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Confidential
                  </span>
                ) : null}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {[
                  ["Category", formatCategory(selectedDocument.category)],
                  [
                    "Organisation",
                    selectedDocument.organisation_name || "Not recorded",
                  ],
                  [
                    "Reference",
                    selectedDocument.document_reference || "Not recorded",
                  ],
                  ["Version", `Version ${selectedDocument.version_number}`],
                  ["Issue date", formatDate(selectedDocument.issue_date)],
                  ["Expiry date", formatDate(selectedDocument.expiry_date)],
                  [
                    "Uploaded by",
                    selectedDocument.uploaded_by_name || "Unknown admin",
                  ],
                  [
                    "Uploaded",
                    formatDateTime(selectedDocument.created_at),
                  ],
                  [
                    "File size",
                    formatFileSize(selectedDocument.file_size_bytes),
                  ],
                  ["File type", selectedDocument.mime_type || "Unknown"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"
                  >
                    <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                      {label}
                    </p>
                    <p className="mt-2 break-words text-sm font-bold text-white/75">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              {selectedDocument.description ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-white/35">
                    Description
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/65">
                    {selectedDocument.description}
                  </p>
                </div>
              ) : null}

              <div className="flex flex-col gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() =>
                    openDeleteDocumentModal(selectedDocument)
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-5 text-sm font-black text-red-200 transition hover:bg-red-500/20"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>

                <button
                  type="button"
                  onClick={() => void downloadDocument(selectedDocument)}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white/75 transition hover:bg-white/[0.09] hover:text-white"
                >
                  <Download className="h-4 w-4" />
                  Download
                </button>

                <button
                  type="button"
                  onClick={() => openReviewModal(selectedDocument)}
                  disabled={
                    selectedDocument.is_archived ||
                    selectedDocument.status === "replaced"
                  }
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 px-5 text-sm font-black text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Review document
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
