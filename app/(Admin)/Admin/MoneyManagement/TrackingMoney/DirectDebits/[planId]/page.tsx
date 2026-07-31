"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  FileText,
  HandCoins,
  Loader2,
  RefreshCcw,
  Repeat2,
  UserRound,
  WalletCards,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Occurrence = {
  id: string;
  plan_id?: string | null;
  due_date?: string | null;
  period_month?: string | null;
  payment_number?: number | null;
  amount_pence?: number | null;
  status?: string | null;
  transaction_id?: string | null;
  failure_reason?: string | null;
  posted_at?: string | null;
  paid_at?: string | null;
  reimbursement_status?: string | null;
  reimbursement_transaction_id?: string | null;
  reimbursement_amount_pence?: number | null;
  reimbursement_payment_method?: string | null;
  reimbursed_at?: string | null;
  invoice_url?: string | null;
  invoice_file_name?: string | null;
  invoice_uploaded_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type DirectDebitPlan = {
  id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  amount_pence?: number | null;
  status?: string | null;
  account_source?: string | null;
  account_holder?: string | null;
  supplier_name?: string | null;
  budget_category_key?: string | null;
  budget_category_label?: string | null;
  mandate_reference?: string | null;
  notes?: string | null;
  first_collection_date?: string | null;
  next_collection_date?: string | null;
  collection_day?: number | null;
  total_payments?: number | null;
  is_open_ended?: boolean | null;
  payments_paid?: number | null;
  payments_posted?: number | null;
  payments_failed?: number | null;
  auto_reimburse_person?: boolean | null;
  reimbursement_payment_method?: string | null;
  repayment_image_url?: string | null;
  repayment_image_name?: string | null;
  repayment_image_alt_text?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  money_direct_debit_occurrences?: Occurrence[] | null;
};

type PlanResponse = {
  success?: boolean;
  plan?: DirectDebitPlan;
  error?: string;
  message?: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
};

type ReceiptAttachment = {
  id?: string;
  file_name?: string | null;
  file_url?: string | null;
  signed_url?: string | null;
  created_at?: string | null;
};

type ReceiptResponse = PlanResponse & {
  transaction_id?: string | null;
  attachments?: ReceiptAttachment[];
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function money(pence: number | null | undefined): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(pence || 0) / 100);
}

function dateLabel(value: string | null | undefined): string {
  const text = cleanText(value);
  if (!text) return "Not recorded";

  const normalised =
    text.length === 10 ? `${text}T00:00:00` : text;
  const date = new Date(normalised);

  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTimeLabel(
  value: string | null | undefined,
): string {
  const text = cleanText(value);
  if (!text) return "Not recorded";

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) return text;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dateTimeValue(
  value: string | null | undefined,
): number {
  const text = cleanText(value);
  if (!text) return 0;

  const normalised =
    text.length === 10 ? `${text}T00:00:00` : text;
  const timestamp = new Date(normalised).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function todayDateKey(): string {
  const now = new Date();
  const localTime =
    now.getTime() - now.getTimezoneOffset() * 60_000;

  return new Date(localTime).toISOString().slice(0, 10);
}

function dateKey(
  value: string | null | undefined,
): string {
  const text = cleanText(value);
  if (!text) return "";

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const timestamp = dateTimeValue(text);
  if (!timestamp) return "";

  const date = new Date(timestamp);
  const localTime =
    date.getTime() - date.getTimezoneOffset() * 60_000;

  return new Date(localTime).toISOString().slice(0, 10);
}

function normaliseStatus(value: unknown): string {
  const text = cleanText(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ");

  return text
    ? text.replace(/\b\w/g, (character) =>
        character.toUpperCase(),
      )
    : "Unknown";
}

function statusClasses(value: unknown): string {
  const status = cleanText(value).toLowerCase();

  if (
    status === "paid" ||
    status === "completed" ||
    status === "reimbursed" ||
    status === "active"
  ) {
    return "bg-emerald-500/15 text-emerald-100 ring-emerald-300/20";
  }

  if (
    status === "posted" ||
    status === "scheduled"
  ) {
    return "bg-sky-500/15 text-sky-100 ring-sky-300/20";
  }

  if (
    status === "awaiting_reimbursement" ||
    status === "partially_reimbursed" ||
    status === "paused"
  ) {
    return "bg-amber-500/15 text-amber-100 ring-amber-300/20";
  }

  if (
    status === "failed" ||
    status === "cancelled"
  ) {
    return "bg-red-500/15 text-red-100 ring-red-300/20";
  }

  return "bg-white/10 text-white/60 ring-white/10";
}

async function readJson<T>(
  response: Response,
): Promise<T> {
  const text = await response.text();

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    return {
      error: "The server returned an invalid response.",
      details: text.slice(0, 1000),
    } as T;
  }
}

function errorMessage(
  payload: PlanResponse,
  response?: Response,
): string {
  return [
    payload.error ||
      payload.message ||
      "The Direct Debit plan could not be loaded.",
    payload.code ? `Code: ${payload.code}` : "",
    payload.details
      ? `Details: ${payload.details}`
      : "",
    payload.hint ? `Hint: ${payload.hint}` : "",
    response ? `HTTP: ${response.status}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function InfoCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-white/45">
        {icon}
        <p className="text-[11px] font-black uppercase tracking-wide">
          {label}
        </p>
      </div>
      <p className="mt-2 break-words text-base font-black text-white">
        {value}
      </p>
    </div>
  );
}

export default function DirectDebitPlanPage() {
  const params = useParams<{ planId: string }>();
  const router = useRouter();

  const planId = cleanText(params?.planId);

  const [plan, setPlan] =
    useState<DirectDebitPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [receiptBusyId, setReceiptBusyId] =
    useState<string | null>(null);

  const requestSequence = useRef(0);
  const mountedRef = useRef(true);

  const loadPlan = useCallback(
    async (background = false) => {
      if (!isUuid(planId)) {
        setPlan(null);
        setError(
          "The Direct Debit plan ID in the page address is invalid.",
        );
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;

      if (background) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const response = await fetch(
          `/api/admin/money/direct-debits/${encodeURIComponent(
            planId,
          )}?t=${Date.now()}`,
          {
            method: "GET",
            cache: "no-store",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          },
        );

        const payload =
          await readJson<PlanResponse>(response);

        if (!response.ok || !payload.plan) {
          throw new Error(
            errorMessage(payload, response),
          );
        }

        if (
          mountedRef.current &&
          sequence === requestSequence.current
        ) {
          setPlan(payload.plan);
          setActionError("");
        }
      } catch (loadError) {
        if (
          mountedRef.current &&
          sequence === requestSequence.current
        ) {
          if (!background) {
            setPlan(null);
          }

          setError(
            loadError instanceof Error
              ? loadError.message
              : "The Direct Debit plan could not be loaded.",
          );
        }
      } finally {
        if (
          mountedRef.current &&
          sequence === requestSequence.current
        ) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [planId],
  );

  useEffect(() => {
    mountedRef.current = true;
    void loadPlan();

    return () => {
      mountedRef.current = false;
      requestSequence.current += 1;
    };
  }, [loadPlan]);

  useEffect(() => {
    function handleChanged() {
      void loadPlan(true);
    }

    function handleFocus() {
      void loadPlan(true);
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void loadPlan(true);
      }
    }

    window.addEventListener(
      "money:transactions-changed",
      handleChanged,
    );
    window.addEventListener(
      "money:direct-debit-reimbursed",
      handleChanged,
    );
    window.addEventListener(
      "money:direct-debit-reimbursement-undone",
      handleChanged,
    );
    window.addEventListener("focus", handleFocus);
    document.addEventListener(
      "visibilitychange",
      handleVisibilityChange,
    );

    return () => {
      window.removeEventListener(
        "money:transactions-changed",
        handleChanged,
      );
      window.removeEventListener(
        "money:direct-debit-reimbursed",
        handleChanged,
      );
      window.removeEventListener(
        "money:direct-debit-reimbursement-undone",
        handleChanged,
      );
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener(
        "visibilitychange",
        handleVisibilityChange,
      );
    };
  }, [loadPlan]);

  const occurrences = useMemo(() => {
    return Array.isArray(
      plan?.money_direct_debit_occurrences,
    )
      ? [
          ...plan.money_direct_debit_occurrences,
        ].sort(
          (a, b) =>
            dateTimeValue(b.due_date) -
            dateTimeValue(a.due_date),
        )
      : [];
  }, [plan]);

  const totals = useMemo(() => {
    return occurrences.reduce(
      (summary, occurrence) => {
        const status = cleanText(
          occurrence.status,
        ).toLowerCase();

        const reimbursementStatus = cleanText(
          occurrence.reimbursement_status,
        ).toLowerCase();

        const amountPence = Math.max(
          0,
          Number(occurrence.amount_pence || 0),
        );

        if (status === "scheduled") {
          summary.scheduled += 1;
        } else if (status === "posted") {
          summary.posted += 1;
        } else if (status === "paid") {
          summary.paid += 1;
        } else if (status === "failed") {
          summary.failed += 1;
        }

        const canNeedReimbursement =
          status === "posted" || status === "paid";

        if (
          canNeedReimbursement &&
          reimbursementStatus ===
            "awaiting_reimbursement"
        ) {
          summary.reimbursementDuePence +=
            amountPence;
        }

        if (
          canNeedReimbursement &&
          reimbursementStatus ===
            "partially_reimbursed"
        ) {
          const reimbursedPence = Math.max(
            0,
            Number(
              occurrence.reimbursement_amount_pence ||
                0,
            ),
          );

          summary.reimbursementDuePence +=
            Math.max(
              0,
              amountPence - reimbursedPence,
            );
        }

        summary.totalValuePence += amountPence;

        return summary;
      },
      {
        scheduled: 0,
        posted: 0,
        paid: 0,
        failed: 0,
        reimbursementDuePence: 0,
        totalValuePence: 0,
      },
    );
  }, [occurrences]);

  const nextScheduledOccurrence = useMemo(() => {
    const today = todayDateKey();

    const scheduled = occurrences
      .filter(
        (occurrence) =>
          cleanText(occurrence.status).toLowerCase() ===
          "scheduled",
      )
      .sort(
        (a, b) =>
          dateTimeValue(a.due_date) -
          dateTimeValue(b.due_date),
      );

    return (
      scheduled.find(
        (occurrence) =>
          dateKey(occurrence.due_date) >= today,
      ) ||
      scheduled[0] ||
      null
    );
  }, [occurrences]);

  async function openReceipt(
    occurrence: Occurrence,
  ) {
    if (!isUuid(occurrence.id)) {
      setActionError(
        "The receipt cannot be opened because the payment occurrence ID is invalid.",
      );
      return;
    }

    setReceiptBusyId(occurrence.id);
    setActionError("");

    const popup = window.open(
      "",
      "_blank",
      "noopener,noreferrer",
    );

    try {
      const response = await fetch(
        `/api/admin/money/direct-debits/${encodeURIComponent(
          planId,
        )}/occurrences/${encodeURIComponent(
          occurrence.id,
        )}/invoice?mode=receipts&t=${Date.now()}`,
        {
          method: "GET",
          cache: "no-store",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const payload =
        await readJson<ReceiptResponse>(response);

      if (!response.ok) {
        throw new Error(
          errorMessage(payload, response),
        );
      }

      const attachments = Array.isArray(
        payload.attachments,
      )
        ? [...payload.attachments]
        : [];

      const attachment =
        attachments
          .sort(
            (a, b) =>
              dateTimeValue(b.created_at) -
              dateTimeValue(a.created_at),
          )
          .find((item) =>
            Boolean(
              cleanText(
                item.signed_url || item.file_url,
              ),
            ),
          ) || null;

      const receiptUrl = cleanText(
        attachment?.signed_url ||
          attachment?.file_url,
      );

      if (!receiptUrl) {
        throw new Error(
          "No accessible receipt file was returned for this payment.",
        );
      }

      if (popup) {
        popup.location.href = receiptUrl;
      } else {
        window.location.href = receiptUrl;
      }
    } catch (receiptError) {
      popup?.close();

      setActionError(
        receiptError instanceof Error
          ? receiptError.message
          : "The receipt could not be opened.",
      );
    } finally {
      setReceiptBusyId(null);
    }
  }


  if (loading) {
    return (
      <main className="min-h-screen w-full min-w-0 bg-[#080812] px-0 py-4 text-white sm:py-6">
        <div className="flex min-h-[60vh] items-center justify-center rounded-3xl border border-white/10 bg-white/[0.04]">
          <div className="text-center">
            <Loader2 className="mx-auto h-10 w-10 animate-spin text-pink-200" />
            <p className="mt-3 font-bold text-white/60">
              Loading Direct Debit plan...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !plan) {
    return (
      <main className="min-h-screen w-full min-w-0 bg-[#080812] px-0 py-4 text-white sm:py-6">
        <section className="mx-auto max-w-3xl rounded-3xl border border-red-300/25 bg-red-500/10 p-6">
          <AlertTriangle className="h-8 w-8 text-red-200" />
          <h1 className="mt-3 text-2xl font-black">
            Direct Debit plan unavailable
          </h1>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-red-100/80">
            {error ||
              "The Direct Debit plan could not be found."}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadPlan(false)}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black ring-1 ring-white/10 hover:bg-white/15"
            >
              <RefreshCcw className="h-4 w-4" />
              Try again
            </button>

            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black hover:bg-pink-400"
            >
              <ArrowLeft className="h-4 w-4" />
              Go back
            </button>
          </div>
        </section>
      </main>
    );
  }

  const title =
    cleanText(plan.title) ||
    cleanText(plan.name) ||
    "Direct Debit";

  return (
    <main className="min-h-screen w-full min-w-0 bg-[#080812] px-0 py-4 text-white sm:py-6">
      <div className="w-full min-w-0 max-w-none space-y-5">
        <header className="w-full rounded-none border-y border-white/10 bg-white/[0.04] p-4 sm:p-6 xl:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-black ring-1 ring-white/10 hover:bg-white/15"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ring-1 ${statusClasses(
                    plan.status,
                  )}`}
                >
                  {normaliseStatus(plan.status)}
                </span>
              </div>

              <h1 className="mt-4 break-words text-3xl font-black tracking-tight sm:text-4xl">
                {title}
              </h1>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                {cleanText(plan.description) ||
                  "View the Direct Debit plan, payment schedule, Money Tracker links, invoices and personal reimbursements."}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/Admin/MoneyManagement/TrackingMoney/DirectDebits"
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black ring-1 ring-white/10 hover:bg-white/15"
              >
                <Repeat2 className="h-4 w-4" />
                All Direct Debits
              </Link>

              <Link
                href="/Admin/MoneyManagement/TrackingMoney"
                className="inline-flex items-center gap-2 rounded-xl bg-pink-500 px-4 py-3 text-sm font-black hover:bg-pink-400"
              >
                <WalletCards className="h-4 w-4" />
                Money Tracker
              </Link>

              <button
                type="button"
                onClick={() => void loadPlan(true)}
                disabled={refreshing}
                className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black ring-1 ring-white/10 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCcw
                  className={`h-4 w-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                {refreshing ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </header>

        {actionError ? (
          <section className="mx-4 rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-red-100 sm:mx-6 xl:mx-8">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="font-black">Action could not be completed</p>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-6 text-red-100/75">
                  {actionError}
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid w-full gap-3 px-4 sm:grid-cols-2 sm:px-6 xl:grid-cols-4 xl:px-8">
          <InfoCard
            label="Monthly amount"
            value={money(plan.amount_pence)}
            icon={
              <Banknote className="h-4 w-4" />
            }
          />
          <InfoCard
            label="Next collection"
            value={dateLabel(
              nextScheduledOccurrence?.due_date ||
                plan.next_collection_date,
            )}
            icon={
              <CalendarDays className="h-4 w-4" />
            }
          />
          <InfoCard
            label="Paying account"
            value={
              cleanText(plan.account_source) ===
              "personal"
                ? cleanText(plan.account_holder) ||
                  "Personal account"
                : "Burton Pride account"
            }
            icon={
              cleanText(plan.account_source) ===
              "personal" ? (
                <UserRound className="h-4 w-4" />
              ) : (
                <WalletCards className="h-4 w-4" />
              )
            }
          />
          <InfoCard
            label="Progress"
            value={`${totals.paid + totals.posted} completed · ${totals.scheduled} scheduled · ${occurrences.length} total`}
            icon={
              <CheckCircle2 className="h-4 w-4" />
            }
          />
        </section>

        {totals.reimbursementDuePence > 0 ? (
          <section className="mx-4 rounded-2xl border border-amber-300/25 bg-amber-500/10 p-4 text-amber-100 sm:mx-6 xl:mx-8">
            <div className="flex items-start gap-3">
              <HandCoins className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-black">
                  Personal reimbursement outstanding
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-100/75">
                  {money(
                    totals.reimbursementDuePence,
                  )}{" "}
                  is still awaiting repayment to{" "}
                  {cleanText(plan.account_holder) ||
                    "the payer"}.
                </p>
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid w-full gap-4 px-4 sm:px-6 lg:grid-cols-2 xl:px-8">
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">
              Plan details
            </h2>

            <dl className="mt-4 divide-y divide-white/10">
              {[
                [
                  "Supplier",
                  cleanText(plan.supplier_name) ||
                    "No supplier linked",
                ],
                [
                  "Budget",
                  cleanText(
                    plan.budget_category_label,
                  ) ||
                    cleanText(
                      plan.budget_category_key,
                    ) ||
                    "Not in budget yet",
                ],
                [
                  "Mandate reference",
                  cleanText(
                    plan.mandate_reference,
                  ) || "Not recorded",
                ],
                [
                  "First collection",
                  dateLabel(
                    plan.first_collection_date,
                  ),
                ],
                [
                  "Payment schedule",
                  plan.is_open_ended
                    ? "Open ended"
                    : `${Number(
                        plan.total_payments || 0,
                      )} payments`,
                ],
                [
                  "Automatic reimbursement",
                  plan.auto_reimburse_person
                    ? `Enabled · ${
                        cleanText(
                          plan.reimbursement_payment_method,
                        ) || "Bank Transfer"
                      }`
                    : "Disabled",
                ],
                [
                  "Created",
                  dateTimeLabel(plan.created_at),
                ],
                [
                  "Last updated",
                  dateTimeLabel(plan.updated_at),
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="grid gap-1 py-3 sm:grid-cols-[180px_1fr]"
                >
                  <dt className="text-xs font-black uppercase tracking-wide text-white/40">
                    {label}
                  </dt>
                  <dd className="break-words text-sm font-bold text-white/80">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {cleanText(plan.notes) ? (
              <div className="mt-4 rounded-2xl bg-black/20 p-4">
                <p className="text-xs font-black uppercase tracking-wide text-white/40">
                  Notes
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">
                  {plan.notes}
                </p>
              </div>
            ) : null}
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
            <h2 className="text-xl font-black">
              Payment summary
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <InfoCard
                label="Scheduled"
                value={String(totals.scheduled)}
                icon={
                  <CalendarDays className="h-4 w-4" />
                }
              />
              <InfoCard
                label="Posted"
                value={String(totals.posted)}
                icon={
                  <FileText className="h-4 w-4" />
                }
              />
              <InfoCard
                label="Paid"
                value={String(totals.paid)}
                icon={
                  <CheckCircle2 className="h-4 w-4" />
                }
              />
              <InfoCard
                label="Failed"
                value={String(totals.failed)}
                icon={
                  <AlertTriangle className="h-4 w-4" />
                }
              />
            </div>

            <div className="mt-4 rounded-2xl bg-black/20 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-white/40">
                Plan ID
              </p>
              <p className="mt-2 break-all font-mono text-xs text-white/65">
                {plan.id}
              </p>
            </div>
          </div>
        </section>

        <section className="w-full rounded-none border-y border-white/10 bg-white/[0.04] p-4 sm:p-6 xl:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">
                Payment schedule
              </h2>
              <p className="mt-1 text-sm text-white/50">
                Every occurrence is loaded directly from
                the Direct Debit plan API.
              </p>
            </div>

            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-white/65 ring-1 ring-white/10">
              {occurrences.length} record
              {occurrences.length === 1 ? "" : "s"}
            </span>
          </div>

          {occurrences.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-dashed border-white/15 p-8 text-center text-white/50">
              No payment occurrences were returned for
              this plan.
            </div>
          ) : (
            <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[1050px] text-left text-sm">
                <thead className="bg-white/[0.05] text-xs uppercase tracking-wide text-white/45">
                  <tr>
                    <th className="px-4 py-3">
                      Payment
                    </th>
                    <th className="px-4 py-3">
                      Due date
                    </th>
                    <th className="px-4 py-3">
                      Amount
                    </th>
                    <th className="px-4 py-3">
                      Payment status
                    </th>
                    <th className="px-4 py-3">
                      Reimbursement
                    </th>
                    <th className="px-4 py-3">
                      Receipt
                    </th>
                    <th className="px-4 py-3">
                      Money Tracker
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-white/10">
                  {occurrences.map((occurrence) => {
                    const transactionId = cleanText(
                      occurrence.transaction_id,
                    );

                    return (
                      <tr
                        key={occurrence.id}
                        className="bg-black/10 align-top"
                      >
                        <td className="px-4 py-4">
                          <p className="font-black">
                            Payment{" "}
                            {occurrence.payment_number ??
                              "—"}
                          </p>
                          <p className="mt-1 font-mono text-[10px] text-white/35">
                            {occurrence.id}
                          </p>
                        </td>

                        <td className="px-4 py-4 font-bold">
                          {dateLabel(
                            occurrence.due_date,
                          )}
                        </td>

                        <td className="px-4 py-4 font-black">
                          {money(
                            occurrence.amount_pence,
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${statusClasses(
                              occurrence.status,
                            )}`}
                          >
                            {normaliseStatus(
                              occurrence.status,
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ${statusClasses(
                              occurrence.reimbursement_status,
                            )}`}
                          >
                            {normaliseStatus(
                              occurrence.reimbursement_status ||
                                "not required",
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-4">
                          {cleanText(
                            occurrence.invoice_file_name,
                          ) ? (
                            <div className="space-y-2">
                              <p
                                className="max-w-[220px] truncate font-bold text-emerald-100"
                                title={cleanText(
                                  occurrence.invoice_file_name,
                                )}
                              >
                                {
                                  occurrence.invoice_file_name
                                }
                              </p>
                              <p className="text-[11px] text-white/40">
                                Uploaded{" "}
                                {dateTimeLabel(
                                  occurrence.invoice_uploaded_at,
                                )}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  void openReceipt(occurrence)
                                }
                                disabled={
                                  receiptBusyId ===
                                  occurrence.id
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-black text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                {receiptBusyId ===
                                occurrence.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <FileText className="h-3 w-3" />
                                )}
                                Open receipt
                              </button>
                            </div>
                          ) : (
                            <span className="text-white/40">
                              No receipt
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          {transactionId &&
                          isUuid(transactionId) ? (
                            <Link
                              href={`/Admin/MoneyManagement/TrackingMoney?transaction=${encodeURIComponent(
                                transactionId,
                              )}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-pink-500/15 px-2.5 py-1.5 text-[11px] font-black text-pink-100 ring-1 ring-pink-300/20 hover:bg-pink-500/25"
                            >
                              Open transaction
                              <ChevronRight className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span className="text-white/40">
                              Not linked yet
                            </span>
                          )}
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
    </main>
  );
}
