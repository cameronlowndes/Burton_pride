"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  CheckCircle2,
  CheckSquare,
  FlaskConical,
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
  onPreview?: () => void;
  onSync: (confirmedPayments: ImportPreviewItem[]) => void;
  DetailedErrorBox: ComponentType<{ title: string; error: unknown }>;
};

type PreviewApiResponse = {
  ok?: boolean;
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
  "w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60";

const actionButtonClass =
  "inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-semibold shadow-lg transition disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto";

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function cloneItems(items: ImportPreviewItem[]) {
  return items.map((item) => ({ ...item }));
}

function getSessionId(item: ImportPreviewItem) {
  return (
    cleanText(item.id) ||
    cleanText(item.stripe_session_id) ||
    cleanText(item.checkout_session_id)
  );
}

function penceFromAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const amount = Number(
    String(value || "")
      .replace(/£/g, "")
      .replace(/,/g, "")
      .trim(),
  );

  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

function formatMoney(item: Pick<ImportPreviewItem, "amount" | "amount_pence">) {
  if (item.amount !== undefined && item.amount !== null && item.amount !== "") {
    if (typeof item.amount === "number") return `£${item.amount.toFixed(2)}`;

    const text = String(item.amount).trim();
    if (text.startsWith("£")) return text;

    const amount = Number(text.replace(/,/g, ""));
    return Number.isFinite(amount) ? `£${amount.toFixed(2)}` : text;
  }

  const pence = Number(item.amount_pence || 0);
  return `£${(pence / 100).toFixed(2)}`;
}

function normalisePreviewItem(item: ImportPreviewItem): ImportPreviewItem {
  const sessionId = getSessionId(item);
  const date = cleanText(item.date) || cleanText(item.transaction_date);
  const amountPence = Number.isFinite(Number(item.amount_pence))
    ? Number(item.amount_pence)
    : penceFromAmount(item.amount);

  return {
    ...item,
    id: sessionId || item.id,
    stripe_session_id: sessionId || item.stripe_session_id || null,
    checkout_session_id: sessionId || item.checkout_session_id || null,
    title: cleanText(item.title) || cleanText(item.name) || "Website payment",
    name: cleanText(item.name) || "Website customer",
    type: cleanText(item.type) || "Website Payment",
    category:
      cleanText(item.category) || cleanText(item.type) || "Website Payment",
    description: cleanText(item.description) || null,
    amount: formatMoney({ amount: item.amount, amount_pence: amountPence }),
    amount_pence: amountPence,
    date: date || new Date().toISOString().slice(0, 10),
    transaction_date: date || new Date().toISOString().slice(0, 10),
    email: cleanText(item.email) || null,
    payment_method: cleanText(item.payment_method) || "Stripe",
    source: cleanText(item.source) || "website_payment",
    status: cleanText(item.status) || "Ready to import",
  };
}

function isAlreadyImported(item: ImportPreviewItem) {
  return cleanText(item.status).toLowerCase().includes("already imported");
}

function isSelectableLivePayment(item: ImportPreviewItem) {
  return Boolean(getSessionId(item)) && !isAlreadyImported(item);
}

async function readJsonResponse(
  response: Response,
): Promise<PreviewApiResponse> {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: text || "The API returned an invalid response.",
    };
  }
}

function getPreviewItems(data: PreviewApiResponse) {
  const items =
    data.previewItems || data.items || data.payments || data.transactions || [];
  return Array.isArray(items) ? items.map(normalisePreviewItem) : [];
}

function buildEditedPaymentForImport(
  item: ImportPreviewItem,
): ImportPreviewItem {
  const sessionId = getSessionId(item);
  const amountPence = penceFromAmount(item.amount);
  const date =
    cleanText(item.date) ||
    cleanText(item.transaction_date) ||
    new Date().toISOString().slice(0, 10);

  return {
    ...item,
    id: sessionId,
    stripe_session_id: sessionId,
    checkout_session_id: sessionId,
    title: cleanText(item.title) || "Website payment",
    name: cleanText(item.name) || "Website customer",
    type: cleanText(item.type) || "Website Payment",
    category:
      cleanText(item.category) || cleanText(item.type) || "Website Payment",
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
      className={`mt-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-medium ${styles}`}
    >
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
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
  onChange: (field: keyof ImportPreviewItem, value: string) => void;
}) {
  const value =
    field.key === "amount" ? formatMoney(item) : String(item[field.key] || "");

  if (field.type === "textarea") {
    return (
      <textarea
        rows={2}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(field.key, event.target.value)}
        className={`${inputClass} resize-y`}
      />
    );
  }

  return (
    <input
      type={field.type || "text"}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(field.key, event.target.value)}
      className={`${inputClass} ${field.key === "amount" ? "font-bold text-emerald-100" : ""}`}
    />
  );
}

export default function WebsitePaymentsSyncCard({
  syncing,
  previewing = false,
  message,
  error,
  previewItems = [],
  onSync,
  DetailedErrorBox,
}: WebsitePaymentsSyncCardProps) {
  const [showPreviewWindow, setShowPreviewWindow] = useState(false);
  const [localPreviewing, setLocalPreviewing] = useState(false);
  const [originalPreviewItems, setOriginalPreviewItems] = useState<
    ImportPreviewItem[]
  >(cloneItems(previewItems).map(normalisePreviewItem));
  const [localPreviewItems, setLocalPreviewItems] = useState<
    ImportPreviewItem[]
  >(cloneItems(previewItems).map(normalisePreviewItem));
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [testMode, setTestMode] = useState(false);
  const [testCompleteMessage, setTestCompleteMessage] = useState<string | null>(
    null,
  );
  const [apiTestRunning, setApiTestRunning] = useState(false);
  const [apiTestMessage, setApiTestMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const isLoadingPreview = previewing || localPreviewing;

  const visiblePreviewItems = useMemo(() => {
    return localPreviewItems.length > 0
      ? localPreviewItems
      : cloneItems(previewItems).map(normalisePreviewItem);
  }, [localPreviewItems, previewItems]);

  const selectableLiveIds = useMemo(() => {
    if (testMode) return [];

    return visiblePreviewItems
      .filter(isSelectableLivePayment)
      .map(getSessionId)
      .filter(Boolean);
  }, [testMode, visiblePreviewItems]);

  const allSelectableLivePaymentsSelected =
    selectableLiveIds.length > 0 &&
    selectableLiveIds.every((id) => selectedIds.includes(id));

  function updatePreviewItem(
    index: number,
    field: keyof ImportPreviewItem,
    value: string,
  ) {
    setLocalPreviewItems((items) =>
      items.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updated: ImportPreviewItem = { ...item, [field]: value };

        if (field === "amount") updated.amount_pence = penceFromAmount(value);
        if (field === "date") updated.transaction_date = value;
        if (field === "type" && !cleanText(item.category))
          updated.category = value;

        return updated;
      }),
    );
  }

  function resetMessages() {
    setLocalError(null);
    setApiTestMessage(null);
    setTestCompleteMessage(null);
  }

  function loadItemsIntoEditor(items: ImportPreviewItem[], testing: boolean) {
    const normalised = cloneItems(items).map(normalisePreviewItem);

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
    try {
      setApiTestRunning(true);
      resetMessages();

      const response = await fetch(
        `/api/admin/money/sync-stripe?preview=true&test=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = await readJsonResponse(response);

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ||
            `API connection test failed with status ${response.status}.`,
        );
      }

      setApiTestMessage(
        data.message ||
          "API connection test passed. No payments were imported.",
      );
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Something went wrong while testing the API connection.",
      );
    } finally {
      setApiTestRunning(false);
    }
  }

  function openEditableTestData() {
    resetMessages();
    loadItemsIntoEditor(TEST_PREVIEW_ITEMS, true);
  }

  async function openRealPreviewWindow() {
    try {
      setLocalPreviewing(true);
      resetMessages();
      setShowPreviewWindow(true);
      setTestMode(false);
      setOriginalPreviewItems([]);
      setLocalPreviewItems([]);
      setSelectedIds([]);

      const response = await fetch(
        `/api/admin/money/sync-stripe?preview=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );
      const data = await readJsonResponse(response);

      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error ||
            `Failed to preview website payments. API status: ${response.status}.`,
        );
      }

      loadItemsIntoEditor(getPreviewItems(data), false);
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "Something went wrong while previewing website payments.",
      );
      setOriginalPreviewItems([]);
      setLocalPreviewItems([]);
      setSelectedIds([]);
    } finally {
      setLocalPreviewing(false);
    }
  }

  function closePreviewWindow() {
    setShowPreviewWindow(false);
    setTestMode(false);
    setSelectedIds([]);
  }

  function resetTestData() {
    loadItemsIntoEditor(TEST_PREVIEW_ITEMS, true);
    setLocalError(null);
  }

  function resetLiveEdits() {
    setLocalPreviewItems(cloneItems(originalPreviewItems));
    setLocalError(null);
  }

  function toggleSelectedPayment(id: string) {
    setSelectedIds((ids) =>
      ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id],
    );
  }

  function toggleSelectAllLivePayments() {
    setSelectedIds((ids) => {
      if (selectableLiveIds.every((id) => ids.includes(id))) {
        return ids.filter((id) => !selectableLiveIds.includes(id));
      }

      return Array.from(new Set([...ids, ...selectableLiveIds]));
    });
  }

  function confirmImport() {
    if (testMode) {
      closePreviewWindow();
      setTestCompleteMessage(
        "Editable test completed successfully. No example payments were imported or saved.",
      );
      return;
    }

    const selectedPayments = visiblePreviewItems
      .filter((item) => selectedIds.includes(getSessionId(item)))
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
        !cleanText(item.date) ||
        !Number.isFinite(Number(item.amount_pence)) ||
        Number(item.amount_pence) <= 0
      );
    });

    if (invalidPayment) {
      setLocalError(
        "A selected payment has missing information. Check title, type, category, amount and date before importing.",
      );
      return;
    }

    setShowPreviewWindow(false);
    onSync(selectedPayments);
    setSelectedIds([]);
  }

  return (
    <>
      <section className="rounded-3xl border border-white/10 bg-white/[0.04] p-4 shadow-2xl shadow-black/20">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">Website payments</h2>
            <p className="max-w-3xl text-sm leading-6 text-white/65">
              Preview Stripe payments first. Nothing is imported until you
              select payments and confirm.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto xl:flex-row">
            <button
              type="button"
              onClick={openEditableTestData}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className={`${actionButtonClass} border-violet-400/30 bg-violet-500/10 text-violet-100 hover:bg-violet-500/20`}
            >
              <Pencil className="h-4 w-4" />
              Test editor
            </button>

            <button
              type="button"
              onClick={testApiConnection}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className={`${actionButtonClass} border-amber-400/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/20`}
            >
              {apiTestRunning ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}
              {apiTestRunning ? "Testing..." : "Test API"}
            </button>

            <button
              type="button"
              onClick={openRealPreviewWindow}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className={`${actionButtonClass} border-sky-400/30 bg-sky-500/10 text-sky-100 hover:bg-sky-500/20`}
            >
              <RefreshCcw
                className={`h-4 w-4 ${isLoadingPreview ? "animate-spin" : ""}`}
              />
              {isLoadingPreview ? "Loading..." : "Preview live payments"}
            </button>
          </div>
        </div>

        {testCompleteMessage ? (
          <StatusMessage message={testCompleteMessage} />
        ) : null}
        {apiTestMessage ? <StatusMessage message={apiTestMessage} /> : null}
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-3xl border border-sky-300/20 bg-[#0b1020] p-5 text-white shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div
                  className={`mb-2 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-black uppercase tracking-[0.18em] ${
                    testMode
                      ? "border-violet-300/20 bg-violet-500/10 text-violet-100"
                      : "border-sky-300/20 bg-sky-500/10 text-sky-100"
                  }`}
                >
                  {testMode ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Server className="h-4 w-4" />
                  )}
                  {testMode ? "Test mode" : "Stripe preview"}
                </div>

                <h2 className="text-2xl font-black text-white">
                  {testMode
                    ? "Test the payment editor"
                    : "Check payments before import"}
                </h2>
                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
                  {testMode
                    ? "Edit these example rows safely. They will not be imported."
                    : "Select the live Stripe payments you want to import. You can edit the details first."}
                </p>
              </div>

              <button
                type="button"
                onClick={closePreviewWindow}
                className="rounded-2xl border border-white/10 bg-white/5 p-2 text-white/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close preview window"
              >
                <X className="h-5 w-5" />
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
                title={`${selectedIds.length} live payment${selectedIds.length === 1 ? "" : "s"} selected`}
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
              <StatusBox text="Loading live website payments from Stripe..." />
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
                    const selected = selectedIds.includes(itemId);
                    const editable = testMode || selectable;

                    return (
                      <div
                        key={itemId || index}
                        className={`rounded-2xl border p-4 ${
                          selected && !testMode
                            ? "border-sky-300/30 bg-sky-500/10"
                            : "border-white/10 bg-white/[0.03]"
                        } ${alreadyImported ? "opacity-70" : ""}`}
                      >
                        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-black text-white">
                              {item.title || "Website payment"}
                            </p>
                            <p
                              className={`mt-1 text-xs font-semibold ${alreadyImported ? "text-amber-200" : "text-emerald-200"}`}
                            >
                              {item.status || "Ready to import"}
                            </p>
                            {itemId ? (
                              <p className="mt-1 text-[11px] text-white/35">
                                {itemId}
                              </p>
                            ) : null}
                          </div>

                          {!testMode ? (
                            <button
                              type="button"
                              disabled={!selectable}
                              onClick={() =>
                                itemId && toggleSelectedPayment(itemId)
                              }
                              className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {selected ? (
                                <CheckSquare className="h-4 w-4 text-sky-200" />
                              ) : (
                                <Square className="h-4 w-4" />
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
                                disabled={!editable}
                                onChange={(key, value) =>
                                  updatePreviewItem(index, key, value)
                                }
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closePreviewWindow}
                className="rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white transition hover:bg-white/10"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmImport}
                disabled={
                  syncing ||
                  isLoadingPreview ||
                  Boolean(localError && !testMode) ||
                  (!testMode && selectedIds.length === 0)
                }
                className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-black transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  testMode
                    ? "bg-violet-300 hover:bg-violet-200"
                    : "bg-sky-400 hover:bg-sky-300"
                }`}
              >
                {testMode ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <RefreshCcw
                    className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`}
                  />
                )}
                {testMode
                  ? "Complete safe test"
                  : syncing
                    ? "Importing..."
                    : `Confirm & import ${selectedIds.length} payment${selectedIds.length === 1 ? "" : "s"}`}
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
      <div>
        <p className="font-black">{title}</p>
        <p className="mt-1 text-sm opacity-75">{text}</p>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          type="button"
          onClick={onButtonClick}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15"
        >
          <RotateCcw className="h-4 w-4" />
          {buttonLabel}
        </button>

        {secondButtonLabel && onSecondButtonClick ? (
          <button
            type="button"
            onClick={onSecondButtonClick}
            disabled={secondButtonDisabled}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckSquare className="h-4 w-4" />
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
  tone?: "info" | "warning" | "error";
}) {
  const styles = {
    info: "border-sky-300/20 bg-sky-500/10 text-sky-100",
    warning: "border-amber-300/20 bg-amber-500/10 text-amber-100",
    error: "border-red-300/20 bg-red-500/10 text-red-100",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 text-sm font-bold ${styles}`}>
      {text}
    </div>
  );
}
