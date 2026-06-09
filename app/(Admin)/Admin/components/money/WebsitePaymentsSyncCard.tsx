"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Pencil,
  RefreshCcw,
  RotateCcw,
  Server,
  X,
} from "lucide-react";

type ImportPreviewItem = {
  id?: string;
  title?: string;
  name?: string;
  type?: string;
  amount?: number | string;
  amount_pence?: number;
  date?: string;
  email?: string;
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
   * This component loads the real preview directly from the API.
   */
  onPreview?: () => void;

  /**
   * Runs your existing POST import function after a real preview is confirmed.
   */
  onSync: () => void;

  DetailedErrorBox: React.ComponentType<{
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
    title: "Website Donation - Example Supporter",
    name: "Example Supporter",
    type: "Website Donation",
    amount: "£10.00",
    amount_pence: 1000,
    date: "2026-06-09",
    email: "supporter@example.com",
    status: "Ready to import",
  },
  {
    id: "test-raffle-002",
    title: "Raffle Tickets - Example Customer",
    name: "Example Customer",
    type: "Raffle Tickets",
    amount: "£5.00",
    amount_pence: 500,
    date: "2026-06-09",
    email: "raffle@example.com",
    status: "Ready to import",
  },
  {
    id: "test-vendor-003",
    title: "Vendor Pitch Fee - Example Food Vendor",
    name: "Example Food Vendor",
    type: "Vendor Pitch Fee",
    amount: "£47.50",
    amount_pence: 4750,
    date: "2026-06-09",
    email: "vendor@example.com",
    status: "Ready to import",
  },
  {
    id: "test-sponsor-004",
    title: "Sponsorship - Example Sponsor",
    name: "Example Sponsor",
    type: "Sponsorship",
    amount: "£100.00",
    amount_pence: 10000,
    date: "2026-06-09",
    email: "sponsor@example.com",
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

function cloneTestItems(): ImportPreviewItem[] {
  return TEST_PREVIEW_ITEMS.map((item) => ({ ...item }));
}

function formatMoney(item: ImportPreviewItem) {
  if (item.amount !== undefined && item.amount !== null && item.amount !== "") {
    if (typeof item.amount === "number") {
      return `£${item.amount.toFixed(2)}`;
    }

    return String(item.amount);
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
  const [localPreviewItems, setLocalPreviewItems] =
    useState<ImportPreviewItem[]>(previewItems);

  const [testMode, setTestMode] = useState(false);
  const [testCompleteMessage, setTestCompleteMessage] = useState<string | null>(
    null,
  );

  const [apiTestRunning, setApiTestRunning] = useState(false);
  const [apiTestMessage, setApiTestMessage] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const isLoadingPreview = previewing || localPreviewing;

  const visiblePreviewItems = useMemo(() => {
    return localPreviewItems.length > 0 ? localPreviewItems : previewItems;
  }, [localPreviewItems, previewItems]);

  function getPreviewItems(data: PreviewApiResponse) {
    const items =
      data.previewItems ||
      data.items ||
      data.payments ||
      data.transactions ||
      [];

    return Array.isArray(items) ? items : [];
  }

  function updateTestItem(
    index: number,
    field: keyof ImportPreviewItem,
    value: string,
  ) {
    if (!testMode) return;

    setLocalPreviewItems((currentItems) =>
      currentItems.map((item, itemIndex) => {
        if (itemIndex !== index) return item;

        return {
          ...item,
          [field]: value,
        };
      }),
    );
  }

  function resetTestData() {
    setLocalPreviewItems(cloneTestItems());
    setLocalError(null);
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
    setTestMode(true);
    setLocalPreviewItems(cloneTestItems());
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
      setLocalPreviewItems([]);
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

      setLocalPreviewItems(getPreviewItems(data));
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Something went wrong while previewing website payments.";

      setLocalError(errorMessage);
      setLocalPreviewItems([]);
    } finally {
      setLocalPreviewing(false);
    }
  }

  function closePreviewWindow() {
    setShowPreviewWindow(false);
    setTestMode(false);
  }

  function confirmImport() {
    if (visiblePreviewItems.length === 0) return;

    if (testMode) {
      setShowPreviewWindow(false);
      setTestMode(false);

      setTestCompleteMessage(
        "Editable test completed successfully. No example payments were imported or saved.",
      );

      return;
    }

    setShowPreviewWindow(false);
    onSync();
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
              tracker. Use the editable test data first to check that the
              preview window works correctly.
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

                  {testMode ? "Editable test data" : "Loaded from Stripe API"}
                </div>

                <h2 className="text-2xl font-black text-white">
                  {testMode
                    ? "Test the editable payment preview"
                    : "Confirm live website payments import"}
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-white/65">
                  {testMode
                    ? "Change the example fields below to test the editor. These rows are fake and will never be imported into your money tracker."
                    : "Check every live payment returned by Stripe. Only click confirm when the data looks correct."}
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
                    Edit anything below. No request will be sent to your import
                    API when you complete the test.
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
                  <table className="w-full min-w-[1100px] text-left text-sm">
                    <thead className="bg-white/10 text-xs uppercase tracking-[0.14em] text-white/55">
                      <tr>
                        <th className="px-3 py-3">Title</th>
                        <th className="px-3 py-3">Type</th>
                        <th className="px-3 py-3">Amount</th>
                        <th className="px-3 py-3">Date</th>
                        <th className="px-3 py-3">Email</th>
                        <th className="px-3 py-3">Status</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-white/10">
                      {visiblePreviewItems.map((item, index) => (
                        <tr
                          key={item.id || index}
                          className="bg-white/[0.03]"
                        >
                          {testMode ? (
                            <>
                              <td className="min-w-[280px] px-3 py-3">
                                <input
                                  value={item.title || ""}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "title",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300/50"
                                />
                              </td>

                              <td className="min-w-[180px] px-3 py-3">
                                <input
                                  value={item.type || ""}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "type",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300/50"
                                />
                              </td>

                              <td className="min-w-[120px] px-3 py-3">
                                <input
                                  value={formatMoney(item)}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "amount",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm font-bold text-emerald-100 outline-none transition focus:border-violet-300/50"
                                />
                              </td>

                              <td className="min-w-[150px] px-3 py-3">
                                <input
                                  type="date"
                                  value={item.date || ""}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "date",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300/50"
                                />
                              </td>

                              <td className="min-w-[230px] px-3 py-3">
                                <input
                                  type="email"
                                  value={item.email || ""}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "email",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300/50"
                                />
                              </td>

                              <td className="min-w-[180px] px-3 py-3">
                                <input
                                  value={item.status || ""}
                                  onChange={(event) =>
                                    updateTestItem(
                                      index,
                                      "status",
                                      event.target.value,
                                    )
                                  }
                                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-violet-300/50"
                                />
                              </td>
                            </>
                          ) : (
                            <>
                              <td className="px-4 py-3 font-bold text-white">
                                {item.title || item.name || "Untitled payment"}
                              </td>

                              <td className="px-4 py-3 text-white/70">
                                {item.type || "Website payment"}
                              </td>

                              <td className="px-4 py-3 font-bold text-emerald-100">
                                {formatMoney(item)}
                              </td>

                              <td className="px-4 py-3 text-white/70">
                                {item.date || "No date"}
                              </td>

                              <td className="px-4 py-3 text-white/70">
                                {item.email || "No email"}
                              </td>

                              <td className="px-4 py-3 text-white/70">
                                {item.status || "Ready to import"}
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
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
                  visiblePreviewItems.length === 0 ||
                  Boolean(localError && !testMode)
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
                    : "Confirm & Import"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}