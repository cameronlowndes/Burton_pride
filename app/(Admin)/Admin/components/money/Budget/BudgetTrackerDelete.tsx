"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  RotateCcw,
  Target,
  Trash2,
  WalletCards,
} from "lucide-react";

type DeletedSavingTarget = {
  id: string;
  year?: string | null;
  target_name?: string | null;
  target_amount_pence?: number | null;
  saved_amount_pence?: number | null;
  months_to_save?: number | null;
  notes?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
};

type DeletedBudgetItem = {
  id: string;
  year?: string | null;
  category_key?: string | null;
  category_label?: string | null;
  planned_amount_pence?: number | null;
  notes?: string | null;
  deleted_at?: string | null;
  deleted_by?: string | null;
  deleted_by_email?: string | null;
};

type DeletedItemsPayload = {
  year?: string | null;
  savingTargets: DeletedSavingTarget[];
  budgetItems: DeletedBudgetItem[];
  budgetTable?: string | null;
  budgetWarning?: string | null;
};

type DeletedItemsApiResponse = {
  ok?: boolean;
  success?: boolean;
  error?: string;
  message?: string;
  details?: unknown;
  hint?: unknown;
  code?: unknown;
  year?: string | null;
  savingTargets?: unknown;
  budgetItems?: unknown;
  budgetTable?: string | null;
  budgetWarning?: string | null;
};

type DeletedItemType = "saving_target" | "budget_item";

type StatusMessage = {
  tone: "success" | "error";
  text: string;
};

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function safeNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeCount(value: unknown): number {
  return Math.max(0, Math.floor(safeNumber(value)));
}

function isValidYear(value: string): boolean {
  return /^\d{4}$/.test(value);
}

function money(value: unknown): string {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(safeNumber(value) / 100);
}

function parseDate(value: unknown): Date | null {
  const text = cleanText(value);
  if (!text) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);

  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const date = new Date(
      Number(year),
      Number(month) - 1,
      Number(day),
    );

    return Number.isNaN(date.getTime()) ? null : date;
  }

  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value: unknown): string {
  const text = cleanText(value);

  if (!text) {
    return "No date recorded";
  }

  const date = parseDate(text);

  if (!date) {
    return text;
  }

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function serialiseDetails(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value);
    } catch {
      return "No extra server details were returned.";
    }
  }
}

function normaliseSavingTarget(
  value: unknown,
): DeletedSavingTarget | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Partial<DeletedSavingTarget>;
  const id = cleanText(item.id);

  if (!id) {
    return null;
  }

  return {
    ...item,
    id,
    target_name: cleanText(item.target_name) || null,
    year: cleanText(item.year) || null,
    target_amount_pence: safeNumber(item.target_amount_pence),
    saved_amount_pence: safeNumber(item.saved_amount_pence),
    months_to_save: safeCount(item.months_to_save),
    notes: cleanText(item.notes) || null,
    deleted_at: cleanText(item.deleted_at) || null,
    deleted_by: cleanText(item.deleted_by) || null,
    deleted_by_email: cleanText(item.deleted_by_email) || null,
  };
}

function normaliseBudgetItem(
  value: unknown,
): DeletedBudgetItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const item = value as Partial<DeletedBudgetItem>;
  const id = cleanText(item.id);

  if (!id) {
    return null;
  }

  return {
    ...item,
    id,
    year: cleanText(item.year) || null,
    category_key: cleanText(item.category_key) || null,
    category_label: cleanText(item.category_label) || null,
    planned_amount_pence: safeNumber(item.planned_amount_pence),
    notes: cleanText(item.notes) || null,
    deleted_at: cleanText(item.deleted_at) || null,
    deleted_by: cleanText(item.deleted_by) || null,
    deleted_by_email: cleanText(item.deleted_by_email) || null,
  };
}

function normaliseList<T>(
  value: unknown,
  normalise: (item: unknown) => T | null,
  getId: (item: T) => string,
): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();

  return value
    .map(normalise)
    .filter((item): item is T => Boolean(item))
    .filter((item) => {
      const id = getId(item);

      if (seen.has(id)) {
        return false;
      }

      seen.add(id);
      return true;
    });
}

async function parseResponse(
  response: Response,
): Promise<DeletedItemsApiResponse> {
  const text = await response.text().catch(() => "");

  let payload: DeletedItemsApiResponse = {};

  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;

      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Response body was not a JSON object.");
      }

      payload = parsed as DeletedItemsApiResponse;
    } catch (error) {
      if (response.ok) {
        const reason =
          error instanceof Error ? error.message : "Invalid JSON response.";

        throw new Error(
          [
            "The deleted-items API returned an invalid response.",
            `HTTP status: ${response.status}`,
            `Reason: ${reason}`,
            `Raw response: ${text.slice(0, 2000)}`,
          ].join("\n\n"),
        );
      }
    }
  }

  if (
    !response.ok ||
    payload.ok === false ||
    payload.success === false
  ) {
    const mainError =
      cleanText(payload.error) ||
      cleanText(payload.message) ||
      "Deleted items request failed.";

    const details =
      serialiseDetails(payload.details) ||
      serialiseDetails(payload.hint) ||
      serialiseDetails(payload.code) ||
      cleanText(text) ||
      "No extra server details were returned.";

    const apiRoute =
      response.url || "/api/admin/money/deleted-items";

    const lines = [
      `Deleted area error (${response.status} ${
        response.statusText || "Request failed"
      })`,
      "",
      `Main error: ${mainError}`,
      `Details: ${details}`,
      `API route: ${apiRoute}`,
    ];

    if (response.status === 400) {
      lines.push(
        "",
        "What to check:",
        "• Make sure the request includes the item ID.",
        "• Make sure type is either saving_target or budget_item.",
        "• Check the browser Network tab to see the request body.",
      );
    }

    if (response.status === 401 || response.status === 403) {
      lines.push(
        "",
        "What to check:",
        "• Make sure you are signed in as an admin.",
        "• Check the current Supabase admin session and route permissions.",
        "• Make sure the admin has permission to view deleted money records.",
      );
    }

    if (response.status === 404) {
      lines.push(
        "",
        "What to check:",
        "• Make sure app/api/admin/money/deleted-items/route.ts exists.",
        "• Make sure the route exports GET and PATCH.",
        "• The deleted row may already have been restored or removed.",
      );
    }

    if (response.status === 405) {
      lines.push(
        "",
        "What to check:",
        "• The route exists, but the HTTP method is missing.",
        "• Add export async function GET(request: Request) for loading.",
        "• Add export async function PATCH(request: Request) for restoring.",
      );
    }

    if (response.status >= 500) {
      lines.push(
        "",
        "What to check:",
        "• Check the terminal or Vercel logs for the full server error.",
        "• Make sure money_saving_targets has the soft-delete columns.",
        "• Make sure the budget table name is valid.",
        "• Make sure the budget table also has the required soft-delete columns.",
      );
    }

    throw new Error(lines.join("\n"));
  }

  return payload;
}

export default function DeletedMoneyItemsClient() {
  const loadAbortRef = useRef<AbortController | null>(null);
  const restoreSubmitRef = useRef<Set<string>>(new Set());

  const [selectedYear, setSelectedYear] = useState(() =>
    String(new Date().getFullYear()),
  );
  const [activeTab, setActiveTab] = useState<
    "saving_targets" | "budget_items"
  >("saving_targets");
  const [payload, setPayload] = useState<DeletedItemsPayload>({
    savingTargets: [],
    budgetItems: [],
  });
  const [loading, setLoading] = useState(false);
  const [restoringIds, setRestoringIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [statusMessage, setStatusMessage] =
    useState<StatusMessage | null>(null);

  const cleanSelectedYear = cleanText(selectedYear);
  const selectedYearValid = isValidYear(cleanSelectedYear);

  const totals = useMemo(
    () => ({
      savingTargets: payload.savingTargets.length,
      budgetItems: payload.budgetItems.length,
      all:
        payload.savingTargets.length +
        payload.budgetItems.length,
    }),
    [payload.budgetItems.length, payload.savingTargets.length],
  );

  const loadDeletedItems = useCallback(async () => {
    if (!selectedYearValid) {
      setStatusMessage({
        tone: "error",
        text: "Enter a valid four-digit year before loading deleted items.",
      });
      return;
    }

    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading(true);
    setStatusMessage(null);

    try {
      const response = await fetch(
        `/api/admin/money/deleted-items?year=${encodeURIComponent(
          cleanSelectedYear,
        )}`,
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

      const data = await parseResponse(response);

      setPayload({
        savingTargets: normaliseList(
          data.savingTargets,
          normaliseSavingTarget,
          (item) => item.id,
        ),
        budgetItems: normaliseList(
          data.budgetItems,
          normaliseBudgetItem,
          (item) => item.id,
        ),
        budgetTable: cleanText(data.budgetTable) || null,
        budgetWarning: cleanText(data.budgetWarning) || null,
        year: cleanText(data.year) || cleanSelectedYear,
      });
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === "AbortError"
      ) {
        return;
      }

      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not load deleted items.",
      });
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
        setLoading(false);
      }
    }
  }, [cleanSelectedYear, selectedYearValid]);

  useEffect(() => {
    void loadDeletedItems();

    return () => {
      loadAbortRef.current?.abort();
    };
  }, [loadDeletedItems]);

  async function restoreItem(
    type: DeletedItemType,
    id: string,
  ) {
    const cleanId = cleanText(id);
    const restoreKey = `${type}:${cleanId}`;

    if (!cleanId || restoreSubmitRef.current.has(restoreKey)) {
      return;
    }

    restoreSubmitRef.current.add(restoreKey);
    setRestoringIds((current) => {
      const next = new Set(current);
      next.add(restoreKey);
      return next;
    });
    setStatusMessage(null);

    try {
      const response = await fetch(
        "/api/admin/money/deleted-items",
        {
          method: "PATCH",
          cache: "no-store",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            type,
            id: cleanId,
            table:
              type === "budget_item"
                ? cleanText(payload.budgetTable) || undefined
                : undefined,
          }),
        },
      );

      await parseResponse(response);

      setStatusMessage({
        tone: "success",
        text:
          type === "saving_target"
            ? "Saving target restored successfully."
            : "Budget tracker item restored successfully.",
      });

      setPayload((current) => ({
        ...current,
        savingTargets:
          type === "saving_target"
            ? current.savingTargets.filter(
                (item) => item.id !== cleanId,
              )
            : current.savingTargets,
        budgetItems:
          type === "budget_item"
            ? current.budgetItems.filter(
                (item) => item.id !== cleanId,
              )
            : current.budgetItems,
      }));

      void loadDeletedItems();
    } catch (error) {
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Could not restore item.",
      });
    } finally {
      restoreSubmitRef.current.delete(restoreKey);
      setRestoringIds((current) => {
        const next = new Set(current);
        next.delete(restoreKey);
        return next;
      });
    }
  }

  return (
    <section
      aria-labelledby="deleted-money-items-title"
      className="space-y-5"
    >
      <h1 id="deleted-money-items-title" className="sr-only">
        Deleted money items
      </h1>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard
          label="Deleted total"
          value={totals.all}
          className="border-red-300/20 bg-red-500/10 text-red-100/70"
        />

        <StatCard
          label="Saving targets"
          value={totals.savingTargets}
          className="border-sky-300/20 bg-sky-500/10 text-sky-100/70"
        />

        <StatCard
          label="Budget items"
          value={totals.budgetItems}
          className="border-emerald-300/20 bg-emerald-500/10 text-emerald-100/70"
        />

        <label className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <span className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-wide text-white/60">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Year
          </span>

          <input
            type="number"
            min={1900}
            max={9999}
            step={1}
            value={selectedYear}
            onChange={(event) => {
              setSelectedYear(event.target.value);
              setStatusMessage(null);
            }}
            aria-invalid={!selectedYearValid}
            className="w-full rounded-xl bg-black/30 p-3 text-white outline-none ring-1 ring-white/10 focus-visible:ring-2 focus-visible:ring-pink-300/40"
          />

          {!selectedYearValid ? (
            <span className="mt-2 block text-xs font-bold text-red-200">
              Enter a valid four-digit year.
            </span>
          ) : null}
        </label>
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="flex flex-wrap gap-2"
          role="tablist"
          aria-label="Deleted item type"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "saving_targets"}
            onClick={() => setActiveTab("saving_targets")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              activeTab === "saving_targets"
                ? "bg-sky-400 text-black"
                : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/20"
            }`}
          >
            <Target className="h-4 w-4" aria-hidden="true" />
            Saving targets
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "budget_items"}
            onClick={() => setActiveTab("budget_items")}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 ${
              activeTab === "budget_items"
                ? "bg-emerald-400 text-black"
                : "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/20"
            }`}
          >
            <WalletCards className="h-4 w-4" aria-hidden="true" />
            Budget tracker
          </button>
        </div>

        <button
          type="button"
          onClick={() => void loadDeletedItems()}
          disabled={loading || !selectedYearValid}
          aria-busy={loading}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          )}
          Refresh
        </button>
      </div>

      {statusMessage ? (
        <div
          role={statusMessage.tone === "error" ? "alert" : "status"}
          aria-live={
            statusMessage.tone === "error"
              ? "assertive"
              : "polite"
          }
          className={`rounded-2xl border p-4 text-sm ${
            statusMessage.tone === "success"
              ? "border-emerald-300/20 bg-emerald-500/10 font-bold text-emerald-100"
              : "border-red-300/30 bg-red-500/10 text-red-100"
          }`}
        >
          <div className="flex items-start gap-3">
            {statusMessage.tone === "success" ? (
              <CheckCircle2
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
            ) : (
              <AlertTriangle
                className="mt-0.5 h-5 w-5 shrink-0"
                aria-hidden="true"
              />
            )}

            <pre className="min-w-0 whitespace-pre-wrap break-words font-sans leading-6">
              {statusMessage.text}
            </pre>
          </div>
        </div>
      ) : null}

      {payload.budgetWarning ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100"
        >
          <p className="font-black text-white">Budget tracker note</p>
          <p className="mt-1 break-words">{payload.budgetWarning}</p>
        </div>
      ) : null}

      {loading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-sm font-bold text-white/60"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading deleted items...
        </div>
      ) : activeTab === "saving_targets" ? (
        <div
          role="tabpanel"
          className="grid gap-3 lg:grid-cols-2"
        >
          {payload.savingTargets.length === 0 ? (
            <EmptyState label="No soft-deleted saving targets for this year." />
          ) : (
            payload.savingTargets.map((item) => {
              const restoreKey = `saving_target:${item.id}`;
              const restoring = restoringIds.has(restoreKey);

              return (
                <DeletedCard
                  key={item.id}
                  tone="sky"
                  title={item.target_name || "Saving target"}
                  lines={[
                    `${money(item.saved_amount_pence)} saved of ${money(
                      item.target_amount_pence,
                    )}`,
                    `Months: ${safeCount(item.months_to_save)}`,
                  ]}
                  notes={item.notes}
                  restoring={restoring}
                  onRestore={() =>
                    void restoreItem("saving_target", item.id)
                  }
                >
                  <DeletedMeta item={item} />
                </DeletedCard>
              );
            })
          )}
        </div>
      ) : (
        <div
          role="tabpanel"
          className="grid gap-3 lg:grid-cols-2"
        >
          {payload.budgetItems.length === 0 ? (
            <EmptyState label="No soft-deleted budget tracker items for this year." />
          ) : (
            payload.budgetItems.map((item) => {
              const restoreKey = `budget_item:${item.id}`;
              const restoring = restoringIds.has(restoreKey);

              return (
                <DeletedCard
                  key={item.id}
                  tone="emerald"
                  title={
                    item.category_label ||
                    item.category_key ||
                    "Budget item"
                  }
                  lines={[
                    `Planned: ${money(item.planned_amount_pence)}`,
                  ]}
                  notes={item.notes}
                  restoring={restoring}
                  onRestore={() =>
                    void restoreItem("budget_item", item.id)
                  }
                  extra={
                    payload.budgetTable
                      ? `Table: ${payload.budgetTable}`
                      : undefined
                  }
                >
                  <DeletedMeta item={item} />
                </DeletedCard>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: number;
  className: string;
}) {
  return (
    <article className={`rounded-2xl border p-4 ${className}`}>
      <p className="text-xs font-black uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-2 text-3xl font-black text-white">
        {safeCount(value)}
      </p>
    </article>
  );
}

function DeletedCard({
  tone,
  title,
  lines,
  notes,
  extra,
  restoring,
  onRestore,
  children,
}: {
  tone: "sky" | "emerald";
  title: string;
  lines: string[];
  notes?: string | null;
  extra?: string;
  restoring: boolean;
  onRestore: () => void;
  children: ReactNode;
}) {
  const toneClass =
    tone === "sky"
      ? "border-sky-300/20 bg-sky-500/10 text-sky-100/70"
      : "border-emerald-300/20 bg-emerald-500/10 text-emerald-100/70";

  return (
    <article className={`rounded-2xl border p-4 ${toneClass}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="break-words text-lg font-black text-white">
            {cleanText(title) || "Deleted item"}
          </p>

          {lines.map((line, index) => (
            <p key={`${line}:${index}`} className="mt-1 break-words text-sm">
              {line}
            </p>
          ))}

          {cleanText(notes) ? (
            <p className="mt-2 whitespace-pre-wrap break-words rounded-xl bg-black/20 px-3 py-2 text-sm text-white/80">
              {cleanText(notes)}
            </p>
          ) : null}

          {cleanText(extra) ? (
            <p className="mt-2 break-all text-xs opacity-60">
              {cleanText(extra)}
            </p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          aria-busy={restoring}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-black text-black hover:bg-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {restoring ? (
            <Loader2
              className="h-4 w-4 animate-spin"
              aria-hidden="true"
            />
          ) : (
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
          )}
          {restoring ? "Restoring..." : "Restore"}
        </button>
      </div>

      {children}
    </article>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6 text-center lg:col-span-2">
      <Trash2
        className="mx-auto mb-3 h-8 w-8 text-white/30"
        aria-hidden="true"
      />
      <p className="font-bold text-white/70">{label}</p>
    </div>
  );
}

function DeletedMeta({
  item,
}: {
  item: {
    deleted_at?: string | null;
    deleted_by?: string | null;
    deleted_by_email?: string | null;
  };
}) {
  return (
    <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-xs leading-5 text-white/55">
      <p>
        Deleted at:{" "}
        <span className="font-bold text-white/80">
          {formatDate(item.deleted_at)}
        </span>
      </p>
      <p>
        Deleted by:{" "}
        <span className="break-words font-bold text-white/80">
          {cleanText(item.deleted_by) || "Not recorded"}
        </span>
      </p>

      {cleanText(item.deleted_by_email) ? (
        <p className="break-all">
          Email:{" "}
          <span className="font-bold text-white/80">
            {cleanText(item.deleted_by_email)}
          </span>
        </p>
      ) : null}
    </div>
  );
}
