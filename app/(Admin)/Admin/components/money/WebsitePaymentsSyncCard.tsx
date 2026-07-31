"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  CheckCircle2,
  CheckSquare,
  FlaskConical,
  Loader2,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Server,
  Square,
  X,
} from "lucide-react";

type ImportPreviewItem = {
  id?: string;
  stripe_session_id?: string | null;
  checkout_session_id?: string | null;
  stripe_payment_id?: string | null;
  stripe_payment_intent_id?: string | null;
  stripe_customer_id?: string | null;
  title?: string;
  name?: string;
  type?: string;
  category?: string | null;
  description?: string | null;
  amount?: number | string;
  amount_pence?: number;
  date?: string;
  transaction_date?: string;
  email?: string | null;
  payment_method?: string | null;
  source?: string | null;
  status?: string;
};

type WebsitePaymentsSyncCardProps = {
  syncing: boolean;
  previewing?: boolean;
  message?: string | null;
  error?: unknown;
  previewItems?: ImportPreviewItem[];
  onPreview?: () => void | Promise<void>;
  onSync: (
    confirmedPayments: ImportPreviewItem[],
  ) => void | Promise<void>;
  DetailedErrorBox: ComponentType<{
    title: string;
    error: unknown;
  }>;
};

type PreviewApiResponse = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
  previewItems?: ImportPreviewItem[];
  items?: ImportPreviewItem[];
  payments?: ImportPreviewItem[];
  transactions?: ImportPreviewItem[];
};

type EditableField = {
  key: keyof ImportPreviewItem;
  label: string;
  type?: "text" | "email" | "date" | "textarea";
  className?: string;
};

type StatusTone = "success" | "warning" | "info" | "error";

const TEST_PREVIEW_ITEMS: ImportPreviewItem[] = [
  {
    id: "test-donation-001",
    stripe_session_id: "test-donation-001",
    checkout_session_id: "test-donation-001",
    title: "Website Donation - Example Supporter",
    name: "Example Supporter",
    type: "Website Donation",
    category: "Website Donation",
    description: "Safe test donation row.",
    amount: "£10.00",
    amount_pence: 1000,
    date: "2026-06-09",
    transaction_date: "2026-06-09",
    email: "supporter@example.com",
    payment_method: "Stripe",
    source: "website_donation",
    status: "Ready to import",
  },
  {
    id: "test-raffle-002",
    stripe_session_id: "test-raffle-002",
    checkout_session_id: "test-raffle-002",
    title: "Raffle Tickets - Example Customer",
    name: "Example Customer",
    type: "Raffle Tickets",
    category: "Raffle Tickets",
    description: "Safe test raffle row.",
    amount: "£5.00",
    amount_pence: 500,
    date: "2026-06-09",
    transaction_date: "2026-06-09",
    email: "raffle@example.com",
    payment_method: "Stripe",
    source: "raffle",
    status: "Ready to import",
  },
  {
    id: "test-vendor-003",
    stripe_session_id: "test-vendor-003",
    checkout_session_id: "test-vendor-003",
    title: "Vendor Pitch Fee - Example Food Vendor",
    name: "Example Food Vendor",
    type: "Vendor Pitch Fee",
    category: "Vendor Pitch Fee",
    description: "Safe test vendor row.",
    amount: "£47.50",
    amount_pence: 4750,
    date: "2026-06-09",
    transaction_date: "2026-06-09",
    email: "vendor@example.com",
    payment_method: "Stripe",
    source: "vendor_pitch",
    status: "Ready to import",
  },
  {
    id: "test-sponsor-004",
    stripe_session_id: "test-sponsor-004",
    checkout_session_id: "test-sponsor-004",
    title: "Sponsorship - Example Sponsor",
    name: "Example Sponsor",
    type: "Sponsorship",
    category: "Sponsorship",
    description: "Safe test sponsorship row.",
    amount: "£100.00",
    amount_pence: 10000,
    date: "2026-06-09",
    transaction_date: "2026-06-09",
    email: "sponsor@example.com",
    payment_method: "Stripe",
    source: "sponsorship",
    status: "Ready to import",
  },
];

const EDITABLE_FIELDS: EditableField[] = [
  { key: "title", label: "Title", className: "md:col-span-2" },
  { key: "name", label: "Name" },
  { key: "type", label: "Type" },
  { key: "category", label: "Category" },
  { key: "amount", label: "Amount" },
  { key: "date", label: "Date", type: "date" },
  { key: "email", label: "Email", type: "email" },
  { key: "payment_method", label: "Payment method" },
  { key: "source", label: "Source" },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    className: "md:col-span-2 xl:col-span-3",
  },
];

const inputClass =
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus-visible:border-sky-300/50 focus-visible:ring-2 focus-visible:ring-sky-300/30 disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeToday(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

function isValidDateInput(value: unknown): boolean {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}$/.test(text);
}

function cloneItems(items: ImportPreviewItem[]): ImportPreviewItem[] {
  return items.map((item) => ({ ...item }));
}

function getSessionId(item: ImportPreviewItem): string {
  return (
    cleanText(item.id) ||
    cleanText(item.stripe_session_id) ||
    cleanText(item.checkout_session_id) ||
    cleanText(item.stripe_payment_intent_id) ||
    cleanText(item.stripe_payment_id)
  );
}

function penceFromAmount(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0
      ? Math.round(value * 100)
      : 0;
  }

  const normalised = cleanText(value)
    .replace(/[£,\s]/g, "")
    .replace(/^\+/, "");

  if (!normalised) {
    return 0;
  }

  const amount = Number(normalised);

  return Number.isFinite(amount) && amount >= 0
    ? Math.round(amount * 100)
    : 0;
}

function safePence(value: unknown): number {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return Math.max(0, Math.round(parsed));
}

function formatMoney(
  item: Pick<ImportPreviewItem, "amount" | "amount_pence">,
): string {
  const amountPence =
    item.amount !== undefined &&
    item.amount !== null &&
    cleanText(item.amount) !== ""
      ? penceFromAmount(item.amount)
      : safePence(item.amount_pence);

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(amountPence / 100);
}

function normalisePreviewItem(
  item: ImportPreviewItem,
): ImportPreviewItem {
  const sessionId = getSessionId(item);
  const dateCandidate =
    cleanText(item.date) || cleanText(item.transaction_date);
  const date = isValidDateInput(dateCandidate)
    ? dateCandidate
    : safeToday();

  const amountPence =
    Number.isFinite(Number(item.amount_pence)) &&
    Number(item.amount_pence) >= 0
      ? safePence(item.amount_pence)
      : penceFromAmount(item.amount);

  return {
    ...item,
    id: sessionId || cleanText(item.id) || undefined,
    stripe_session_id:
      sessionId || cleanText(item.stripe_session_id) || null,
    checkout_session_id:
      sessionId || cleanText(item.checkout_session_id) || null,
    title:
      cleanText(item.title) ||
      cleanText(item.name) ||
      "Website payment",
    name: cleanText(item.name) || "Website customer",
    type: cleanText(item.type) || "Website Payment",
    category:
      cleanText(item.category) ||
      cleanText(item.type) ||
      "Website Payment",
    description: cleanText(item.description) || null,
    amount: formatMoney({
      amount: item.amount,
      amount_pence: amountPence,
    }),
    amount_pence: amountPence,
    date,
    transaction_date: date,
    email: cleanText(item.email) || null,
    payment_method: cleanText(item.payment_method) || "Stripe",
    source: cleanText(item.source) || "website_payment",
    status: cleanText(item.status) || "Ready to import",
  };
}

function normaliseItems(
  items: ImportPreviewItem[],
): ImportPreviewItem[] {
  const seen = new Set<string>();

  return cloneItems(items)
    .map(normalisePreviewItem)
    .filter((item, index) => {
      const id = getSessionId(item);

      if (!id) {
        return true;
      }

      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    })
    .map((item, index) => ({
      ...item,
      id: getSessionId(item) || `preview-row-${index + 1}`,
    }));
}

function isAlreadyImported(item: ImportPreviewItem): boolean {
  return cleanText(item.status)
    .toLowerCase()
    .includes("already imported");
}

function isSelectableLivePayment(item: ImportPreviewItem): boolean {
  return Boolean(getSessionId(item)) && !isAlreadyImported(item);
}

async function readJsonResponse(
  response: Response,
): Promise<PreviewApiResponse> {
  const text = await response.text();

  if (!text.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(text) as unknown;

    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Response body was not a JSON object.");
    }

    return parsed as PreviewApiResponse;
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "Invalid JSON response.";

    throw new Error(
      [
        "The website payment API returned an invalid response.",
        `HTTP status: ${response.status}`,
        `Reason: ${reason}`,
        `Raw response: ${text.slice(0, 2000)}`,
      ].join("\n\n"),
    );
  }
}

function getPreviewItems(
  data: PreviewApiResponse,
): ImportPreviewItem[] {
  const items =
    data.previewItems ??
    data.items ??
    data.payments ??
    data.transactions ??
    [];

  return Array.isArray(items) ? normaliseItems(items) : [];
}

function buildEditedPaymentForImport(
  item: ImportPreviewItem,
): ImportPreviewItem {
  const sessionId = getSessionId(item);
  const amountPence = penceFromAmount(item.amount);
  const dateCandidate =
    cleanText(item.date) || cleanText(item.transaction_date);
  const date = isValidDateInput(dateCandidate)
    ? dateCandidate
    : safeToday();

  return {
    ...item,
    id: sessionId || undefined,
    stripe_session_id: sessionId || null,
    checkout_session_id: sessionId || null,
    title: cleanText(item.title) || "Website payment",
    name: cleanText(item.name) || "Website customer",
    type: cleanText(item.type) || "Website Payment",
    category:
      cleanText(item.category) ||
      cleanText(item.type) ||
      "Website Payment",
    description: cleanText(item.description) || null,
    amount: formatMoney({ amount_pence: amountPence }),
    amount_pence: amountPence,
    date,
    transaction_date: date,
    email: cleanText(item.email) || null,
    payment_method: cleanText(item.payment_method) || "Stripe",
    source: cleanText(item.source) || "website_payment",
    status: cleanText(item.status) || "Ready to import",
  };
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])",
  ].join(",");

  return Array.from(
    container.querySelectorAll<HTMLElement>(selector),
  ).filter(
    (element) =>
      !element.hasAttribute("hidden") &&
      element.getAttribute("aria-hidden") !== "true",
  );
}

function StatusMessage({
  message,
  type = "success",
}: {
  message: string;
  type?: "success" | "warning";
}) {
  const styles =
    type === "success"
      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
      : "border-amber-400/30 bg-amber-500/10 text-amber-100";

  return (
    <div
      role={type === "success" ? "status" : "alert"}
      aria-live={type === "success" ? "polite" : "assertive"}
      className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${styles}`}
    >
      <CheckCircle2
        className="mt-0.5 h-4 w-4 shrink-0"
        aria-hidden="true"
      />
      <span className="break-words">{message}</span>
    </div>
  );
}

function EditableInput({
  item,
  field,
  disabled,
  onChange,
}: {
  item: ImportPreviewItem;
  field: EditableField;
  disabled: boolean;
  onChange: (
    field: keyof ImportPreviewItem,
    value: string,
  ) => void;
}) {
  const value =
    field.key === "amount"
      ? formatMoney(item)
      : cleanText(item[field.key]);

  if (field.type === "textarea") {
    return (
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(event) =>
          onChange(field.key, event.target.value)
        }
        className={`${inputClass} resize-y`}
      />
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={value}
      disabled={disabled}
      onChange={(event) =>
        onChange(field.key, event.target.value)
      }
      className={`${inputClass} ${
        field.key === "amount"
          ? "font-bold text-emerald-100"
          : ""
      }`}
      inputMode={field.key === "amount" ? "decimal" : undefined}
    />
  );
}

export default function WebsitePaymentsSyncCard({
  syncing,
  previewing = false,
  message,
  error,
  previewItems = [],
  onPreview,
  onSync,
  DetailedErrorBox,
}: WebsitePaymentsSyncCardProps) {
  const dialogTitleId = useId();
  const dialogDescriptionId = useId();
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previewAbortRef = useRef<AbortController | null>(null);
  const apiTestAbortRef = useRef<AbortController | null>(null);
  const syncSubmitRef = useRef(false);

  const [showPreviewWindow, setShowPreviewWindow] = useState(false);
  const [localPreviewing, setLocalPreviewing] = useState(false);
  const [originalPreviewItems, setOriginalPreviewItems] =
    useState<ImportPreviewItem[]>(() => normaliseItems(previewItems));
  const [localPreviewItems, setLocalPreviewItems] =
    useState<ImportPreviewItem[]>(() => normaliseItems(previewItems));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [testCompleteMessage, setTestCompleteMessage] =
    useState<string | null>(null);
  const [apiTestRunning, setApiTestRunning] = useState(false);
  const [apiTestMessage, setApiTestMessage] =
    useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmingImport, setConfirmingImport] = useState(false);

  const isLoadingPreview = previewing || localPreviewing;
  const busy =
    syncing ||
    isLoadingPreview ||
    apiTestRunning ||
    confirmingImport;

  useEffect(() => {
    if (showPreviewWindow || localPreviewItems.length > 0) {
      return;
    }

    const normalised = normaliseItems(previewItems);
    setOriginalPreviewItems(normalised);
    setLocalPreviewItems(normalised);
  }, [previewItems, showPreviewWindow, localPreviewItems.length]);

  useEffect(() => {
    if (!showPreviewWindow) {
      return;
    }

    previousFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const timer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (!busy) {
          event.preventDefault();
          closePreviewWindow();
        }
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = getFocusableElements(dialogRef.current);

      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus();
    };
  }, [showPreviewWindow, busy]);

  useEffect(() => {
    return () => {
      previewAbortRef.current?.abort();
      apiTestAbortRef.current?.abort();
    };
  }, []);

  const visiblePreviewItems = localPreviewItems;

  const selectableLiveIds = useMemo(() => {
    if (testMode) return [];

    return Array.from(
      new Set(
        visiblePreviewItems
          .filter(isSelectableLivePayment)
          .map(getSessionId)
          .filter(Boolean),
      ),
    );
  }, [testMode, visiblePreviewItems]);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => selectableLiveIds.includes(id)),
    );
  }, [selectableLiveIds]);

  const allSelectableLivePaymentsSelected =
    selectableLiveIds.length > 0 &&
    selectableLiveIds.every((id) => selectedIds.includes(id));

  function updatePreviewItem(
    index: number,
    field: keyof ImportPreviewItem,
    value: string,
  ) {
    setLocalError(null);

    setLocalPreviewItems((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated: ImportPreviewItem = {
          ...item,
          [field]: value,
        };

        if (field === "amount") {
          updated.amount_pence = penceFromAmount(value);
        }

        if (field === "date") {
          updated.transaction_date = value;
        }

        if (
          field === "type" &&
          !cleanText(item.category)
        ) {
          updated.category = value;
        }

        return updated;
      }),
    );
  }

  function resetMessages() {
    setLocalError(null);
    setApiTestMessage(null);
    setTestCompleteMessage(null);
  }

  function loadItemsIntoEditor(
    items: ImportPreviewItem[],
    testing: boolean,
  ) {
    const normalised = normaliseItems(items);

    setTestMode(testing);
    setOriginalPreviewItems(cloneItems(normalised));
    setLocalPreviewItems(cloneItems(normalised));
    setSelectedIds(
      testing
        ? []
        : normalised
            .filter(isSelectableLivePayment)
            .map(getSessionId)
            .filter(Boolean),
    );
    setShowPreviewWindow(true);
  }

  async function testApiConnection() {
    if (apiTestRunning) return;

    apiTestAbortRef.current?.abort();
    const controller = new AbortController();
    apiTestAbortRef.current = controller;

    try {
      setApiTestRunning(true);
      resetMessages();

      const response = await fetch(
        `/api/admin/money/sync-stripe?preview=true&test=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        data.ok === false ||
        data.success === false
      ) {
        throw new Error(
          cleanText(data.error) ||
            cleanText(data.message) ||
            `API connection test failed with status ${response.status}.`,
        );
      }

      setApiTestMessage(
        cleanText(data.message) ||
          "API connection test passed. No payments were imported.",
      );
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return;
      }

      setLocalError(
        err instanceof Error
          ? err.message
          : "Something went wrong while testing the API connection.",
      );
    } finally {
      if (apiTestAbortRef.current === controller) {
        setApiTestRunning(false);
        apiTestAbortRef.current = null;
      }
    }
  }

  function openEditableTestData() {
    resetMessages();
    loadItemsIntoEditor(TEST_PREVIEW_ITEMS, true);
  }

  async function openRealPreviewWindow() {
    if (localPreviewing) return;

    previewAbortRef.current?.abort();
    const controller = new AbortController();
    previewAbortRef.current = controller;

    try {
      setLocalPreviewing(true);
      resetMessages();
      setShowPreviewWindow(true);
      setTestMode(false);
      setOriginalPreviewItems([]);
      setLocalPreviewItems([]);
      setSelectedIds([]);

      await onPreview?.();

      const response = await fetch(
        `/api/admin/money/sync-stripe?preview=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data = await readJsonResponse(response);

      if (
        !response.ok ||
        data.ok === false ||
        data.success === false
      ) {
        throw new Error(
          cleanText(data.error) ||
            cleanText(data.message) ||
            `Failed to preview website payments. API status: ${response.status}.`,
        );
      }

      loadItemsIntoEditor(getPreviewItems(data), false);
    } catch (err) {
      if (
        err instanceof DOMException &&
        err.name === "AbortError"
      ) {
        return;
      }

      setLocalError(
        err instanceof Error
          ? err.message
          : "Something went wrong while previewing website payments.",
      );
      setOriginalPreviewItems([]);
      setLocalPreviewItems([]);
      setSelectedIds([]);
    } finally {
      if (previewAbortRef.current === controller) {
        setLocalPreviewing(false);
        previewAbortRef.current = null;
      }
    }
  }

  const closePreviewWindow = useCallback(() => {
    if (busy) {
      return;
    }

    previewAbortRef.current?.abort();
    setShowPreviewWindow(false);
    setTestMode(false);
    setSelectedIds([]);
    setLocalError(null);
  }, [busy]);

  function resetTestData() {
    loadItemsIntoEditor(TEST_PREVIEW_ITEMS, true);
    setLocalError(null);
  }

  function resetLiveEdits() {
    setLocalPreviewItems(cloneItems(originalPreviewItems));
    setLocalError(null);
  }

  function toggleSelectedPayment(id: string) {
    if (!id) return;

    setSelectedIds((ids) =>
      ids.includes(id)
        ? ids.filter((item) => item !== id)
        : [...ids, id],
    );
  }

  function toggleSelectAllLivePayments() {
    setSelectedIds((ids) => {
      if (
        selectableLiveIds.every((id) => ids.includes(id))
      ) {
        return ids.filter(
          (id) => !selectableLiveIds.includes(id),
        );
      }

      return Array.from(
        new Set([...ids, ...selectableLiveIds]),
      );
    });
  }

  async function confirmImport() {
    if (testMode) {
      closePreviewWindow();
      setTestCompleteMessage(
        "Editable test completed successfully. No example payments were imported or saved.",
      );
      return;
    }

    if (syncSubmitRef.current || confirmingImport || syncing) {
      return;
    }

    const selectedPayments = visiblePreviewItems
      .filter((item) =>
        selectedIds.includes(getSessionId(item)),
      )
      .filter(isSelectableLivePayment)
      .map(buildEditedPaymentForImport);

    if (selectedPayments.length === 0) {
      setLocalError(
        "Select at least one live website payment before importing.",
      );
      return;
    }

    const invalidPayment = selectedPayments.find((item) => {
      return (
        !getSessionId(item) ||
        !cleanText(item.title) ||
        !cleanText(item.type) ||
        !cleanText(item.category) ||
        !isValidDateInput(item.date) ||
        !Number.isFinite(Number(item.amount_pence)) ||
        Number(item.amount_pence) <= 0
      );
    });

    if (invalidPayment) {
      setLocalError(
        "A selected payment has missing or invalid information. Check title, type, category, amount and date before importing.",
      );
      return;
    }

    syncSubmitRef.current = true;
    setConfirmingImport(true);
    setLocalError(null);

    try {
      await onSync(selectedPayments);
      setShowPreviewWindow(false);
      setSelectedIds([]);
      setTestMode(false);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "The selected website payments could not be imported.",
      );
    } finally {
      syncSubmitRef.current = false;
      setConfirmingImport(false);
    }
  }

  function handleBackdropMouseDown(
    event: React.MouseEvent<HTMLDivElement>,
  ) {
    if (event.target === event.currentTarget) {
      closePreviewWindow();
    }
  }

  function handleDialogKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
  ) {
    if (
      event.key === "Enter" &&
      event.target === event.currentTarget
    ) {
      event.preventDefault();
    }
  }

  return (
    <>
      <section
        aria-labelledby="website-payments-title"
        className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2
              id="website-payments-title"
              className="text-lg font-black text-white"
            >
              Website payments
            </h2>
            <p className="max-w-3xl text-sm leading-6 text-white/65">
              Preview Stripe payments first. Nothing is imported until you
              select payments and confirm.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto xl:flex-row">
            <button
              type="button"
              onClick={openEditableTestData}
              disabled={busy}
              className={`${actionButtonClass} border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20`}
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Test editor
            </button>

            <button
              type="button"
              onClick={() => void testApiConnection()}
              disabled={busy}
              aria-busy={apiTestRunning}
              className={`${actionButtonClass} border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20`}
            >
              {apiTestRunning ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FlaskConical
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              )}
              {apiTestRunning ? "Testing..." : "Test API"}
            </button>

            <button
              type="button"
              onClick={() => void openRealPreviewWindow()}
              disabled={busy}
              aria-busy={isLoadingPreview}
              className={`${actionButtonClass} border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20`}
            >
              {isLoadingPreview ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCcw
                  className="h-4 w-4"
                  aria-hidden="true"
                />
              )}
              {isLoadingPreview
                ? "Loading..."
                : "Preview live payments"}
            </button>
          </div>
        </div>

        {testCompleteMessage ? (
          <StatusMessage message={testCompleteMessage} />
        ) : null}

        {apiTestMessage ? (
          <StatusMessage message={apiTestMessage} />
        ) : null}

        {message ? <StatusMessage message={message} /> : null}

        {localError ? (
          <div className="mt-4">
            <DetailedErrorBox
              title="Website payments API error"
              error={localError}
            />
          </div>
        ) : null}

        {error ? (
          <div className="mt-4">
            <DetailedErrorBox
              title="Website payments sync error"
              error={error}
            />
          </div>
        ) : null}
      </section>

      {showPreviewWindow ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/70 px-4 py-6 backdrop-blur-sm"
          onMouseDown={handleBackdropMouseDown}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={dialogTitleId}
            aria-describedby={dialogDescriptionId}
            tabIndex={-1}
            onKeyDown={handleDialogKeyDown}
            className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-sky-300/20 bg-[#0b1020] p-5 text-white shadow-2xl outline-none"
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div
                  className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                    testMode
                      ? "border-violet-300/20 bg-violet-500/10 text-violet-100"
                      : "border-sky-300/20 bg-sky-500/10 text-sky-100"
                  }`}
                >
                  {testMode ? (
                    <Pencil
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  ) : (
                    <Server
                      className="h-4 w-4"
                      aria-hidden="true"
                    />
                  )}
                  {testMode ? "Test mode" : "Stripe preview"}
                </div>

                <h2
                  id={dialogTitleId}
                  className="break-words text-2xl font-black text-white"
                >
                  {testMode
                    ? "Test the payment editor"
                    : "Check payments before import"}
                </h2>
                <p
                  id={dialogDescriptionId}
                  className="mt-2 max-w-4xl text-sm leading-6 text-white/65"
                >
                  {testMode
                    ? "Edit these example rows safely. They will not be imported."
                    : "Select the live Stripe payments you want to import. You can edit the details first."}
                </p>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={closePreviewWindow}
                disabled={busy}
                className="shrink-0 rounded-2xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close preview window"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {testMode ? (
              <PreviewToolbar
                title="Safe test mode"
                text="Change anything below. No data will be saved."
                buttonLabel="Reset test data"
                onButtonClick={resetTestData}
                colour="violet"
              />
            ) : null}

            {!testMode &&
            !isLoadingPreview &&
            visiblePreviewItems.length > 0 ? (
              <PreviewToolbar
                title={`${selectedIds.length} live payment${
                  selectedIds.length === 1 ? "" : "s"
                } selected`}
                text="Only selected payments will be imported. Already imported payments are disabled."
                buttonLabel="Reset edits"
                onButtonClick={resetLiveEdits}
                secondButtonLabel={
                  allSelectableLivePaymentsSelected
                    ? "Unselect all"
                    : "Select all new"
                }
                onSecondButtonClick={toggleSelectAllLivePayments}
                secondButtonDisabled={selectableLiveIds.length === 0}
                colour="sky"
              />
            ) : null}

            {isLoadingPreview && !testMode ? (
              <StatusBox
                text="Loading live website payments from Stripe..."
                tone="info"
              />
            ) : localError && !testMode ? (
              <StatusBox text={localError} tone="error" />
            ) : visiblePreviewItems.length === 0 ? (
              <StatusBox
                text="No website payments were returned."
                tone="warning"
              />
            ) : (
              <div className="space-y-3">
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75">
                  {visiblePreviewItems.length} payment
                  {visiblePreviewItems.length === 1 ? "" : "s"} shown.
                </div>

                <div className="grid gap-3">
                  {visiblePreviewItems.map((item, index) => {
                    const itemId = getSessionId(item);
                    const alreadyImported = isAlreadyImported(item);
                    const selectable = isSelectableLivePayment(item);
                    const selected =
                      itemId.length > 0 &&
                      selectedIds.includes(itemId);
                    const editable = testMode || selectable;

                    return (
                      <article
                        key={itemId || `preview-row-${index}`}
                        className={`rounded-2xl border p-4 ${
                          selected && !testMode
                            ? "border-sky-300/30 bg-sky-500/10"
                            : "border-white/10 bg-white/[0.03]"
                        } ${alreadyImported ? "opacity-70" : ""}`}
                      >
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="break-words text-sm font-black text-white">
                              {cleanText(item.title) ||
                                "Website payment"}
                            </p>
                            <p
                              className={`mt-1 text-xs font-semibold ${
                                alreadyImported
                                  ? "text-amber-200"
                                  : "text-emerald-200"
                              }`}
                            >
                              {cleanText(item.status) ||
                                "Ready to import"}
                            </p>
                            {itemId ? (
                              <p className="mt-1 break-all text-[11px] text-white/35">
                                {itemId}
                              </p>
                            ) : null}
                          </div>

                          {!testMode ? (
                            <button
                              type="button"
                              disabled={!selectable || busy}
                              onClick={() =>
                                itemId &&
                                toggleSelectedPayment(itemId)
                              }
                              aria-pressed={selected}
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selected ? (
                                <CheckSquare
                                  className="h-4 w-4 text-sky-200"
                                  aria-hidden="true"
                                />
                              ) : (
                                <Square
                                  className="h-4 w-4"
                                  aria-hidden="true"
                                />
                              )}
                              {alreadyImported
                                ? "Already imported"
                                : selected
                                  ? "Selected"
                                  : "Select"}
                            </button>
                          ) : null}
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          {EDITABLE_FIELDS.map((field) => (
                            <label
                              key={field.key}
                              className={field.className || ""}
                            >
                              <span className="mb-1 block text-xs font-black uppercase tracking-wide text-white/45">
                                {field.label}
                              </span>
                              <EditableInput
                                item={item}
                                field={field}
                                disabled={!editable || busy}
                                onChange={(key, value) =>
                                  updatePreviewItem(index, key, value)
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePreviewWindow}
                disabled={busy}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => void confirmImport()}
                disabled={
                  busy ||
                  Boolean(localError && !testMode) ||
                  (!testMode && selectedIds.length === 0)
                }
                aria-busy={confirmingImport || syncing}
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60 ${
                  testMode
                    ? "bg-violet-300 hover:bg-violet-200"
                    : "bg-sky-400 hover:bg-sky-300"
                }`}
              >
                {testMode ? (
                  <CheckCircle2
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                ) : confirmingImport || syncing ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <RefreshCcw
                    className="h-4 w-4"
                    aria-hidden="true"
                  />
                )}

                {testMode
                  ? "Complete safe test"
                  : confirmingImport || syncing
                    ? "Importing..."
                    : `Confirm & import ${selectedIds.length} payment${
                        selectedIds.length === 1 ? "" : "s"
                      }`}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function PreviewToolbar({
  title,
  text,
  buttonLabel,
  onButtonClick,
  secondButtonLabel,
  onSecondButtonClick,
  secondButtonDisabled = false,
  colour,
}: {
  title: string;
  text: string;
  buttonLabel: string;
  onButtonClick: () => void;
  secondButtonLabel?: string;
  onSecondButtonClick?: () => void;
  secondButtonDisabled?: boolean;
  colour: "sky" | "violet";
}) {
  const styles =
    colour === "sky"
      ? "border-sky-300/20 bg-sky-500/10 text-sky-100"
      : "border-violet-300/20 bg-violet-500/10 text-violet-100";

  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-2xl border p-4 lg:flex-row lg:items-center lg:justify-between ${styles}`}
    >
      <div className="min-w-0">
        <p className="break-words font-black">{title}</p>
        <p className="mt-1 break-words text-sm opacity-75">
          {text}
        </p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onButtonClick}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
        >
          <RotateCcw
            className="h-4 w-4"
            aria-hidden="true"
          />
          {buttonLabel}
        </button>

        {secondButtonLabel && onSecondButtonClick ? (
          <button
            type="button"
            onClick={onSecondButtonClick}
            disabled={secondButtonDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare
              className="h-4 w-4"
              aria-hidden="true"
            />
            {secondButtonLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function StatusBox({
  text,
  tone = "info",
}: {
  text: string;
  tone?: StatusTone;
}) {
  const styles: Record<StatusTone, string> = {
    info: "border-sky-300/20 bg-sky-500/10 text-sky-100",
    warning:
      "border-amber-300/20 bg-amber-500/10 text-amber-100",
    error: "border-red-300/20 bg-red-500/10 text-red-100",
    success:
      "border-emerald-300/20 bg-emerald-500/10 text-emerald-100",
  };

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={`rounded-2xl border p-4 text-sm font-bold ${styles[tone]}`}
    >
      {text}
    </div>
  );
}
