"use client";

import { useMemo, useState } from "react";
import type { ComponentType } from "react";
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

  /**
   * Kept optional so your current page does not break.
   * The component loads the real preview directly from the API.
   */
  onPreview?: () => void;

  /**
   * Selected edited payments are sent for import.
   * Each row still includes the Stripe Checkout Session ID so the backend can
   * safely import only the chosen Stripe payment.
   */
  onSync: (confirmedPayments: ImportPreviewItem[]) => void;

  DetailedErrorBox: ComponentType<{
    title: string;
    error: unknown;
  }>;
};

type PreviewApiResponse = {
  ok?: boolean;
  error?: string;
  message?: string;
  previewItems?: ImportPreviewItem[];
  items?: ImportPreviewItem[];
  payments?: ImportPreviewItem[];
  transactions?: ImportPreviewItem[];
  connected?: boolean;
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

async function readJsonResponse(res: Response): Promise<PreviewApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {
      ok: false,
      error: text || "The API returned an invalid response.",
    };
  }
}

function cloneItems(items: ImportPreviewItem[]): ImportPreviewItem[] {
  return items.map((item) => ({ ...item }));
}

function cloneTestItems(): ImportPreviewItem[] {
  return cloneItems(TEST_PREVIEW_ITEMS);
}

function cleanText(value: unknown) {
  if (typeof value !== "string") return "";

  return value.trim();
}

function getSessionId(item: ImportPreviewItem) {
  return cleanText(item.id) || cleanText(item.stripe_session_id) || cleanText(item.checkout_session_id);
}

function penceFromAmount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.round(value * 100);
  }

  const cleaned = String(value || "")
    .replace(/£/g, "")
    .replace(/,/g, "")
    .trim();

  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) return 0;

  return Math.round(amount * 100);
}

function formatMoney(item: ImportPreviewItem) {
  if (item.amount !== undefined && item.amount !== null && item.amount !== "") {
    if (typeof item.amount === "number") {
      return `£${item.amount.toFixed(2)}`;
    }

    const amountString = String(item.amount).trim();

    if (amountString.startsWith("£")) return amountString;

    const amountNumber = Number(amountString.replace(/,/g, ""));

    if (Number.isFinite(amountNumber)) {
      return `£${amountNumber.toFixed(2)}`;
    }

    return amountString;
  }

  if (
    item.amount_pence !== undefined &&
    item.amount_pence !== null &&
    Number.isFinite(Number(item.amount_pence))
  ) {
    return `£${(Number(item.amount_pence) / 100).toFixed(2)}`;
  }

  return "£0.00";
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
    category: cleanText(item.category) || cleanText(item.type) || "Website Payment",
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
  return String(item.status || "")
    .toLowerCase()
    .includes("already imported");
}

function isSelectableLivePayment(item: ImportPreviewItem) {
  return Boolean(getSessionId(item)) && !isAlreadyImported(item);
}

function buildEditedPaymentForImport(item: ImportPreviewItem): ImportPreviewItem {
  const sessionId = getSessionId(item);
  const amountPence = penceFromAmount(item.amount);
  const date = cleanText(item.date) || cleanText(item.transaction_date) || new Date().toISOString().slice(0, 10);

  return {
    ...item,
    id: sessionId,
    stripe_session_id: sessionId,
    checkout_session_id: sessionId,
    title: cleanText(item.title) || "Website payment",
    name: cleanText(item.name) || "Website customer",
    type: cleanText(item.type) || "Website Payment",
    category: cleanText(item.category) || cleanText(item.type) || "Website Payment",
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
  const [originalPreviewItems, setOriginalPreviewItems] = useState<ImportPreviewItem[]>(
    cloneItems(previewItems).map(normalisePreviewItem),
  );
  const [localPreviewItems, setLocalPreviewItems] = useState<ImportPreviewItem[]>(
    cloneItems(previewItems).map(normalisePreviewItem),
  );

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
      .map((item) => getSessionId(item))
      .filter(Boolean);
  }, [testMode, visiblePreviewItems]);

  const allSelectableLivePaymentsSelected = useMemo(() => {
    return (
      selectableLiveIds.length > 0 &&
      selectableLiveIds.every((id) => selectedIds.includes(id))
    );
  }, [selectableLiveIds, selectedIds]);

  function getPreviewItems(data: PreviewApiResponse) {
    const items =
      data.previewItems ||
      data.items ||
      data.payments ||
      data.transactions ||
      [];

    return Array.isArray(items) ? items.map(normalisePreviewItem) : [];
  }

  function updatePreviewItem(
    index: number,
    field: keyof ImportPreviewItem,
    value: string,
  ) {
    setLocalPreviewItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        const updatedItem: ImportPreviewItem = {
          ...item,
          [field]: value,
        };

        if (field === "amount") {
          updatedItem.amount_pence = penceFromAmount(value);
        }

        if (field === "date") {
          updatedItem.transaction_date = value;
        }

        if (field === "type" && !cleanText(item.category)) {
          updatedItem.category = value;
        }

        return updatedItem;
      }),
    );
  }

  function resetTestData() {
    const items = cloneTestItems().map(normalisePreviewItem);

    setOriginalPreviewItems(items);
    setLocalPreviewItems(items);
    setSelectedIds([]);
    setLocalError(null);
  }

  function resetLiveEdits() {
    setLocalPreviewItems(cloneItems(originalPreviewItems));
    setLocalError(null);
  }

  function toggleSelectedPayment(id: string) {
    setSelectedIds((currentIds) => {
      if (currentIds.includes(id)) {
        return currentIds.filter((currentId) => currentId !== id);
      }

      return [...currentIds, id];
    });
  }

  function toggleSelectAllLivePayments() {
    setSelectedIds((currentIds) => {
      const allSelected = selectableLiveIds.every((id) =>
        currentIds.includes(id),
      );

      if (allSelected) {
        return currentIds.filter((id) => !selectableLiveIds.includes(id));
      }

      return Array.from(new Set([...currentIds, ...selectableLiveIds]));
    });
  }

  async function testApiConnection() {
    try {
      setApiTestRunning(true);
      setApiTestMessage(null);
      setTestCompleteMessage(null);
      setLocalError(null);

      const res = await fetch(
        `/api/admin/money/sync-stripe?preview=true&test=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await readJsonResponse(res);

      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            `API connection test failed with status ${res.status}.`,
        );
      }

      setApiTestMessage(
        data.message ||
          "API connection test passed. Stripe responded successfully. No payments were imported.",
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Something went wrong while testing the API connection.";

      setLocalError(errorMessage);
    } finally {
      setApiTestRunning(false);
    }
  }

  function openEditableTestData() {
    const items = cloneTestItems().map(normalisePreviewItem);

    setTestMode(true);
    setOriginalPreviewItems(items);
    setLocalPreviewItems(items);
    setSelectedIds([]);
    setLocalError(null);
    setApiTestMessage(null);
    setTestCompleteMessage(null);
    setShowPreviewWindow(true);
  }

  async function openRealPreviewWindow() {
    try {
      setTestMode(false);
      setShowPreviewWindow(true);
      setLocalPreviewing(true);
      setOriginalPreviewItems([]);
      setLocalPreviewItems([]);
      setSelectedIds([]);
      setLocalError(null);
      setApiTestMessage(null);
      setTestCompleteMessage(null);

      const res = await fetch(
        `/api/admin/money/sync-stripe?preview=true&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
        },
      );

      const data = await readJsonResponse(res);

      if (!res.ok || data.ok === false) {
        throw new Error(
          data.error ||
            `Failed to preview website payments. API status: ${res.status}.`,
        );
      }

      const loadedItems = getPreviewItems(data);

      setOriginalPreviewItems(cloneItems(loadedItems));
      setLocalPreviewItems(cloneItems(loadedItems));

      /**
       * Select new payments automatically.
       * Existing imported payments stay unselected and disabled.
       */
      setSelectedIds(
        loadedItems
          .filter(isSelectableLivePayment)
          .map((item) => getSessionId(item))
          .filter(Boolean),
      );
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Something went wrong while previewing website payments.";

      setLocalError(errorMessage);
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

  function confirmImport() {
    if (testMode) {
      setShowPreviewWindow(false);
      setTestMode(false);
      setSelectedIds([]);

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
      setLocalError("Select at least one live website payment before importing.");
      return;
    }

    const invalidPayments = selectedPayments.filter((item) => {
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

    if (invalidPayments.length > 0) {
      setLocalError(
        "One or more selected payments has missing information. Please check title, type, category, amount and date before importing.",
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
            <h2 className="text-base font-bold text-white">
              Website payments sync
            </h2>

            <p className="max-w-3xl text-sm text-white/65">
              Preview live website payments before importing them into the money
              tracker. Nothing is imported automatically. Selected payments can
              be edited before the final import.
            </p>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto xl:flex-row">
            <button
              type="button"
              onClick={openEditableTestData}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-violet-400/30 bg-violet-500/10 px-4 py-2.5 text-sm font-semibold text-violet-100 shadow-lg shadow-violet-950/20 transition hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <Pencil className="h-4 w-4" />
              Editable Test Data
            </button>

            <button
              type="button"
              onClick={testApiConnection}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-100 shadow-lg shadow-amber-950/20 transition hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {apiTestRunning ? (
                <RefreshCcw className="h-4 w-4 animate-spin" />
              ) : (
                <FlaskConical className="h-4 w-4" />
              )}

              {apiTestRunning ? "Testing API..." : "Test API Connection"}
            </button>

            <button
              type="button"
              onClick={openRealPreviewWindow}
              disabled={syncing || isLoadingPreview || apiTestRunning}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-2.5 text-sm font-semibold text-sky-100 shadow-lg shadow-sky-950/20 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <RefreshCcw
                className={`h-4 w-4 ${
                  isLoadingPreview ? "animate-spin" : ""
                }`}
              />

              {isLoadingPreview
                ? "Loading preview..."
                : "Preview Live Website Payments"}
            </button>
          </div>
        </div>

        {testCompleteMessage ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {testCompleteMessage}
          </div>
        ) : null}

        {apiTestMessage ? (
          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            {apiTestMessage}
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100">
            {message}
          </div>
        ) : null}

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
          <div className="max-h-[92vh] w-full max-w-[96rem] overflow-y-auto rounded-3xl border border-sky-300/20 bg-[#0b1020] p-5 text-white shadow-2xl">
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

                  {testMode ? "Editable test data" : "Loaded from Stripe API"}
                </div>

                <h2 className="text-2xl font-black text-white">
                  {testMode
                    ? "Test the editable payment preview"
                    : "Select and edit live website payments to import"}
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
                  {testMode
                    ? "Change the example fields below to test the editor. These rows are fake and will never be imported into your money tracker."
                    : "Tick only the payments you want to import. You can change the title, name, type, category, amount, date, email, payment method, source and description before import. Existing imported payments stay disabled."}
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
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-violet-300/20 bg-violet-500/10 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-black text-violet-100">
                    Safe testing mode is active
                  </p>

                  <p className="mt-1 text-sm text-violet-100/75">
                    Edit anything below. Completing the safe test does not call
                    your import API.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={resetTestData}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-violet-300/20 bg-violet-500/20 px-4 py-2.5 text-sm font-black text-violet-100 transition hover:bg-violet-500/30"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset Test Data
                </button>
              </div>
            ) : null}

            {!testMode && !isLoadingPreview && visiblePreviewItems.length > 0 ? (
              <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-black text-sky-100">
                    {selectedIds.length} live payment
                    {selectedIds.length === 1 ? "" : "s"} selected
                  </p>

                  <p className="mt-1 text-sm text-sky-100/75">
                    Only the selected Stripe payments will be imported. Edited
                    fields are sent with the selected payments.
                  </p>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={resetLiveEdits}
                    disabled={originalPreviewItems.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset Edits
                  </button>

                  <button
                    type="button"
                    onClick={toggleSelectAllLivePayments}
                    disabled={selectableLiveIds.length === 0}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-sky-300/20 bg-sky-500/20 px-4 py-2.5 text-sm font-black text-sky-100 transition hover:bg-sky-500/30 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {allSelectableLivePaymentsSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}

                    {allSelectableLivePaymentsSelected
                      ? "Unselect All New Payments"
                      : "Select All New Payments"}
                  </button>
                </div>
              </div>
            ) : null}

            {isLoadingPreview && !testMode ? (
              <div className="flex items-center gap-3 rounded-2xl border border-sky-300/20 bg-sky-500/10 p-4 text-sm font-bold text-sky-100">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Loading live website payments preview from the Stripe API...
              </div>
            ) : localError && !testMode ? (
              <div className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4 text-sm font-bold text-red-100">
                {localError}
              </div>
            ) : visiblePreviewItems.length === 0 ? (
              <div className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm font-bold text-amber-100">
                No website payments were returned.
              </div>
            ) : (
              <>
                <div className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75">
                  {visiblePreviewItems.length} payment
                  {visiblePreviewItems.length === 1 ? "" : "s"} shown below.
                </div>

                <div className="overflow-x-auto rounded-2xl border border-white/10">
                  <table className="w-full min-w-[1800px] text-left text-sm">
                    <thead className="bg-white/10 text-xs uppercase tracking-[0.14em] text-white/55">
                      <tr>
                        {!testMode ? (
                          <th className="px-3 py-3">Import</th>
                        ) : null}

                        <th className="px-3 py-3">Title</th>
                        <th className="px-3 py-3">Name</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Category</th>
                        <th className="px-3 py-3">Amount</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Email</th>
                        <th className="px-3 py-3">Payment Method</th>
                        <th className="px-3 py-3">Source</th>
                        <th className="px-3 py-3">Description</th>
                        <th className="px-3 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10">
                      {visiblePreviewItems.map((item, index) => {
                        const itemId = getSessionId(item);
                        const alreadyImported = isAlreadyImported(item);
                        const selectable = isSelectableLivePayment(item);
                        const selected = selectedIds.includes(itemId);
                        const editable = testMode || selectable;

                        return (
                          <tr
                            key={itemId || index}
                            className={`bg-white/[0.03] ${
                              selected && !testMode ? "bg-sky-500/10" : ""
                            } ${alreadyImported ? "opacity-70" : ""}`}
                          >
                            {!testMode ? (
                              <td className="px-3 py-3 align-top">
                                <button
                                  type="button"
                                  disabled={!selectable}
                                  onClick={() => {
                                    if (!itemId) return;

                                    toggleSelectedPayment(itemId);
                                  }}
                                  className="inline-flex rounded-lg p-1 text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                                  title={
                                    alreadyImported
                                      ? "This payment is already imported"
                                      : selected
                                        ? "Unselect this payment"
                                        : "Select this payment"
                                  }
                                >
                                  {selected ? (
                                    <CheckSquare className="h-5 w-5 text-sky-200" />
                                  ) : (
                                    <Square className="h-5 w-5" />
                                  )}
                                </button>
                              </td>
                            ) : null}

                            <td className="min-w-[300px] px-3 py-3 align-top">
                              <input
                                value={item.title || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "title",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[220px] px-3 py-3 align-top">
                              <input
                                value={item.name || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "name",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[190px] px-3 py-3 align-top">
                              <input
                                value={item.type || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "type",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[190px] px-3 py-3 align-top">
                              <input
                                value={item.category || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "category",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[140px] px-3 py-3 align-top">
                              <input
                                value={formatMoney(item)}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "amount",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-emerald-100 outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[160px] px-3 py-3 align-top">
                              <input
                                type="date"
                                value={item.date || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "date",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[260px] px-3 py-3 align-top">
                              <input
                                type="email"
                                value={item.email || ""}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "email",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[190px] px-3 py-3 align-top">
                              <input
                                value={item.payment_method || "Stripe"}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "payment_method",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[200px] px-3 py-3 align-top">
                              <input
                                value={item.source || "website_payment"}
                                disabled={!editable}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "source",
                                    event.target.value,
                                  )
                                }
                                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td className="min-w-[360px] px-3 py-3 align-top">
                              <textarea
                                value={item.description || ""}
                                disabled={!editable}
                                rows={2}
                                onChange={(event) =>
                                  updatePreviewItem(
                                    index,
                                    "description",
                                    event.target.value,
                                  )
                                }
                                className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-sky-300/50 disabled:cursor-not-allowed disabled:opacity-60"
                              />
                            </td>

                            <td
                              className={`min-w-[170px] px-4 py-3 align-top font-semibold ${
                                alreadyImported
                                  ? "text-amber-200"
                                  : "text-emerald-200"
                              }`}
                            >
                              {item.status || "Ready to import"}
                              {itemId ? (
                                <div className="mt-1 text-[10px] font-medium text-white/35">
                                  {itemId}
                                </div>
                              ) : null}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
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
                    className={`h-4 w-4 ${
                      syncing ? "animate-spin" : ""
                    }`}
                  />
                )}

                {testMode
                  ? "Complete Safe Test"
                  : syncing
                    ? "Importing..."
                    : `Confirm & Import ${selectedIds.length} Payment${
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
