"use client";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  RefreshCw,
  PoundSterling,
  Receipt,
  TrendingUp,
  ArrowRightLeft,
  Wallet,
  CirclePoundSterling,
} from "lucide-react";
import {
  FINANCE_API,
  formatGBP,
  londonToday,
  parsePounds,
} from "../../../../../../lib/lottery/finance";
import type {
  FinanceCost,
  FinanceReport,
  FinanceTotals,
  FinanceTransfer,
  WriteAction,
} from "../../../../../../lib/lottery/finance";
type FinanceOperation = "load" | WriteAction;
const operationLabels: Record<FinanceOperation, string> = {
  load: "Load lottery finances",
  cost: "Save lottery cost",
  reconcile: "Confirm reconciliation",
  transfer: "Record transfer to Money Tracker",
  pay_cost: "Mark lottery cost as paid",
  void_cost: "Void lottery cost",
};
class FinanceRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FinanceRequestError";
  }
}
function failureMessage(
  operation: FinanceOperation,
  status: number,
  body: unknown,
  headers: Headers,
): string {
  const data =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  // Render only bounded, plain user-facing error text, never raw HTML or database diagnostics.
  const raw = typeof data.error === "string" ? data.error.trim() : "";
  const safeReason =
    raw &&
    raw.length <= 600 &&
    status < 500 &&
    !/[<>]|(?:stack trace|postgres|sqlstate|password=|authorization:|bearer |service_role|select .* from |insert into )/i.test(
      raw,
    )
      ? raw
      : "";
  let next: string;
  switch (status) {
    case 400:
    case 422:
      next =
        "Check the amount, date, required fields and confirmation boxes. Correct the highlighted or reported details, then try again.";
      break;
    case 401:
      next =
        "Your admin session may have expired. Sign in again, reopen this lottery and check its latest history before retrying a save.";
      break;
    case 403:
      next =
        "Check that your account has permission for this action. If recent two-factor verification is required, complete it and try again. Ask a main admin to check your access if this continues.";
      break;
    case 404:
      next =
        "The requested lottery or finance record could not be found. Return to All lotteries, refresh the list and open the record again.";
      break;
    case 409:
    case 412:
      next =
        "The figures or record may have changed, or a finance requirement may be unmet. Check the latest history and reconciliation status before retrying. For a transfer, check the available balance again.";
      break;
    case 429: {
      const retry = headers.get("Retry-After");
      next =
        retry && /^\d{1,6}$/.test(retry)
          ? `Too many requests. Wait at least ${retry} seconds before trying again.`
          : "Too many requests. Wait a moment before trying again.";
      break;
    }
    default:
      next =
        status >= 500
          ? "The server could not complete the request normally. Try again shortly. If this continues, report the action, time and any support reference shown to a main admin."
          : "Refresh the figures and try again. If this continues, report the action and HTTP status to a main admin.";
  }
  const ref = headers.get("X-Request-ID") || headers.get("X-Correlation-ID");
  const reference =
    ref && /^[a-zA-Z0-9_.:-]{1,100}$/.test(ref)
      ? ` Support reference: ${ref}.`
      : "";
  const uncertain =
    operation !== "load"
      ? " A save is not confirmed by this error. Check the relevant history before submitting again; if you retry, keep the same details so the existing request key can be reused."
      : " The latest figures have not been loaded; do not rely on earlier totals for a transfer.";
  return `${operationLabels[operation]} failed (HTTP ${status}).\n${safeReason ? `Reason: ${safeReason}\n` : ""}Next step: ${next}\n${uncertain.trim()}${reference ? `\n${reference.trim()}` : ""}`;
}
async function readFinanceResponse(
  response: Response,
  operation: FinanceOperation,
): Promise<unknown> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    if (!response.ok)
      throw new FinanceRequestError(
        failureMessage(operation, response.status, null, response.headers),
      );
    throw new FinanceRequestError(
      `${operationLabels[operation]}: the server returned an unreadable response (HTTP ${response.status}). ` +
        (operation === "load"
          ? "The latest figures could not be displayed. Refresh the figures; if it happens again, report this response error to a main admin."
          : "The save outcome is unknown. Check the relevant history before retrying with the same details. Do not create another transfer with different details just to try again."),
    );
  }
  if (!response.ok)
    throw new FinanceRequestError(
      failureMessage(operation, response.status, body, response.headers),
    );
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new FinanceRequestError(
      `${operationLabels[operation]}: the server returned an unexpected response format. ${operation === "load" ? "Refresh the figures. If this continues, ask a main admin to check the finance endpoint." : "The save outcome is unknown. Check the relevant history and retry only with the same details."}`,
    );
  return body;
}
function describeFailure(error: unknown, operation: FinanceOperation): string {
  if (error instanceof FinanceRequestError) return error.message;
  const timeout = error instanceof Error && error.name === "AbortError";
  if (operation === "load")
    return timeout
      ? "Load lottery finances timed out after 20 seconds. No current figures were received. Check your connection and select Refresh figures. If it keeps happening, ask a main admin to check the finance service."
      : "Lottery finances could not be loaded. The browser could not complete the request or process the response. Check your connection, refresh the figures and sign in again if needed. If this continues, report the time and selected lottery to a main admin.";
  return `${operationLabels[operation]} could not be confirmed${timeout ? " within 25 seconds" : " because the browser could not complete the request"}. The save may have reached the server. Keep your details unchanged, check the relevant history, then retry with the same details if no matching entry appears. If this repeats, report the action and time to a main admin.`;
}
function readAmount(value: string, label: string, allowZero = false): number {
  try {
    return parsePounds(value, allowZero);
  } catch {
    throw new Error(
      `${label} is invalid. Enter an amount in pounds with no more than two decimal places, for example 24.56. ${allowZero ? "Use 0.00 if there is no amount." : "The amount must be greater than zero."} No request has been sent; correct this field and try again.`,
    );
  }
}

const input =
  "w-full rounded-xl border border-white/10 bg-[#0b1421] px-3 py-2.5 text-sm text-white [color-scheme:dark] focus-visible:outline focus-visible:outline-2 focus-visible:outline-purple-300";
const button =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-300 disabled:cursor-not-allowed disabled:opacity-40";
const primary = button
  .replace("bg-white/5", "bg-purple-500")
  .replace("hover:bg-white/10", "hover:bg-purple-400");
// Match the existing lottery dashboard: navy surfaces, subtle borders and purple accents.
const panel =
  "min-w-0 rounded-3xl border border-white/10 bg-[#101a28] p-4 sm:p-5";
function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-medium text-white/80">
      {label}
      {children}
    </label>
  );
}
function Message({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <p
      role={error ? "alert" : "status"}
      className={`whitespace-pre-line break-words rounded-xl border p-3 text-sm leading-6 ${error ? "border-red-300/30 bg-red-500/10 text-red-100" : "border-purple-300/20 bg-purple-500/10 text-purple-100"}`}
    >
      {children}
    </p>
  );
}
function Pages({
  page,
  total,
  onChange,
  label,
}: {
  page: number;
  total: number;
  onChange: (page: number) => void;
  label: string;
}) {
  const pages = Math.max(1, Math.ceil(total / 10));
  return (
    <nav
      aria-label={label}
      className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-white/70"
    >
      <span>
        {total === 0
          ? "No records"
          : `${(page - 1) * 10 + 1}–${Math.min(page * 10, total)} of ${total}`}{" "}
        · Page {page} of {pages}
      </span>
      <div className="flex gap-2">
        <button
          className={button}
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className={button}
          disabled={page >= pages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}
type Mutate = (
  action: WriteAction,
  data: Record<string, unknown>,
  key: string,
) => Promise<void>;
function useWrite(mutate: Mutate) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const inFlight = useRef(false),
    request = useRef<{ signature: string; key: string } | null>(null);
  async function run(action: WriteAction, data: Record<string, unknown>) {
    if (inFlight.current) return false;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      if (typeof crypto === "undefined" || !crypto.randomUUID)
        throw new FinanceRequestError(
          `${operationLabels[action]} could not start because this browser cannot create a secure request reference. Open the admin portal over HTTPS in a supported browser and try again. No save request has been sent.`,
        );
      const signature = JSON.stringify([action, data]);
      if (request.current?.signature !== signature)
        request.current = { signature, key: crypto.randomUUID() };
      await mutate(action, data, request.current.key);
      request.current = null;
      return true;
    } catch (error) {
      setError(describeFailure(error, action));
      return false;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  return { run, busy, error, setError };
}
function Metrics({ t }: { t: FinanceReport["summary"] }) {
  const cards = [
    [
      "Ticket income",
      t.gross_sales_pence,
      "Confirmed paid sales, before refunds.",
    ],
    [
      "Money out",
      t.paid_costs_pence + t.refunds_pence,
      "Paid costs plus completed refunds.",
    ],
    [
      "Profit / loss",
      t.net_result_pence,
      "Income less refunds and all recorded costs, including unpaid costs.",
    ],
    [
      "Already transferred",
      t.transferred_pence,
      "Linked credits in the main Money Tracker.",
    ],
    [
      "Remaining balance",
      t.balance_pence,
      "Sales less completed refunds, paid costs and transfers.",
    ],
    [
      "Available to transfer",
      t.available_pence,
      "Cleared funds after costs, pending refunds, transfers and reserves.",
    ],
  ] as const;
  const icons = [
    PoundSterling,
    Receipt,
    TrendingUp,
    ArrowRightLeft,
    Wallet,
    CirclePoundSterling,
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {cards.map(([label, value, help], index) => {
        const Icon = icons[index];
        return (
          <div key={label} className={panel}>
            <div className="flex items-start justify-between gap-3">
              <p className="pt-1 text-sm font-semibold text-white/60">
                {label}
              </p>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-purple-500/15 text-purple-200">
                <Icon size={20} aria-hidden="true" />
              </span>
            </div>
            <p
              className={`mt-1 break-words text-2xl font-bold tracking-tight tabular-nums ${label === "Profit / loss" ? (value < 0 ? "text-red-300" : "text-emerald-300") : "text-white"}`}
            >
              {formatGBP(value)}
            </p>
            <p className="mt-2 text-xs leading-5 text-white/55">{help}</p>
          </div>
        );
      })}
    </div>
  );
}
function CostForm({ mutate }: { mutate: Mutate }) {
  const { run, busy, error, setError } = useWrite(mutate),
    [title, setTitle] = useState(""),
    [amount, setAmount] = useState(""),
    [category, setCategory] = useState("prizes"),
    [status, setStatus] = useState("paid"),
    [date, setDate] = useState(londonToday),
    [reference, setReference] = useState(""),
    [note, setNote] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (
        await run("cost", {
          title,
          amount_pence: readAmount(amount, "Cost amount"),
          category,
          status,
          date,
          reference,
          note,
        })
      ) {
        setTitle("");
        setAmount("");
        setReference("");
        setNote("");
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The cost could not be prepared. Check the title, amount and cost date. No save request was sent; correct the details and try again.",
      );
    }
  }
  return (
    <form className={panel} onSubmit={submit}>
      <h2 className="text-lg font-bold">Add a lottery cost</h2>
      <p className="mt-2 text-sm text-white/65">
        Record the amount actually paid or owed. A donated prize’s estimated
        value is not a cash cost. Costs already recorded in the main Money
        Tracker must be reconciled before using net transfers here.
      </p>
      <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Cost title">
          <input
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Amount (£)">
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Category">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={input}
          >
            <option value="prizes">Prizes / winner payments</option>
            <option value="payment_fees">Stripe / payment fees</option>
            <option value="licence">Licence / registration</option>
            <option value="printing">Printing</option>
            <option value="other">Other running costs</option>
          </select>
        </Field>
        <Field label="Payment status">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={input}
          >
            <option value="paid">Paid</option>
            <option value="unpaid">Still to pay — reserve these funds</option>
          </select>
        </Field>
        <Field label="Cost date">
          <input
            type="date"
            required
            max={londonToday()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Receipt / payment reference">
          <input
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={input}
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="Notes">
            <textarea
              rows={3}
              maxLength={2000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${input} min-h-24 resize-none`}
              onInput={(event) => {
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
              }}
            />
          </Field>
        </div>
        <button className={primary} type="submit">
          {busy ? "Saving cost…" : "Save cost"}
        </button>
      </fieldset>
      {error && (
        <div className="mt-3">
          <Message error>{error}</Message>
        </div>
      )}
    </form>
  );
}
function ReconciliationForm({
  t,
  mutate,
}: {
  t: FinanceTotals;
  mutate: Mutate;
}) {
  const { run, busy, error, setError } = useWrite(mutate);
  const [mode, setMode] = useState(t.mode),
    [cleared, setCleared] = useState((t.cleared_gross_pence / 100).toFixed(2)),
    [reserve, setReserve] = useState((t.reserve_pence / 100).toFixed(2)),
    [note, setNote] = useState(""),
    [checks, setChecks] = useState([false, false, false]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      if (
        await run("reconcile", {
          mode,
          cleared_gross_pence: readAmount(
            cleared,
            "Cleared gross receipts",
            true,
          ),
          reserve_pence: readAmount(reserve, "Extra reserve", true),
          note,
          confirmed: checks.every(Boolean),
        })
      )
        setChecks([false, false, false]);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Reconciliation could not be prepared. Check cleared receipts, the reserve and your reference, then confirm all three checks. No reconciliation request was sent.",
      );
    }
  }
  return (
    <form className={panel} onSubmit={submit}>
      <h2 className="text-lg font-bold">Reconcile before transferring</h2>
      <p className="mt-2 text-sm text-white/65">
        Confirmation expires after 24 hours or when sales, refunds or costs
        change. Include outstanding prizes, payment fees and any other costs
        before confirming.
      </p>
      <fieldset disabled={busy} className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="Lottery mode">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as FinanceTotals["mode"])}
            className={input}
          >
            <option value="unclassified">Not yet checked</option>
            <option value="test">Test — transfers disabled</option>
            <option value="live">Live — real payments only</option>
          </select>
        </Field>
        <Field label="Cleared gross receipts (£), before fees / refunds">
          <input
            inputMode="decimal"
            required
            value={cleared}
            onChange={(e) => setCleared(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Extra reserve to keep (£)">
          <input
            inputMode="decimal"
            required
            value={reserve}
            onChange={(e) => setReserve(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Reconciliation reference / notes">
          <input
            required
            minLength={5}
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input}
          />
        </Field>
        <div className="grid gap-3 sm:col-span-2">
          {[
            "I checked the payment provider / bank statement and entered cleared gross receipts.",
            "I recorded all prizes, payment fees and running costs, including amounts still owed.",
            "These sales and costs are not already counted separately in the main Money Tracker.",
          ].map((text, index) => (
            <label
              key={text}
              className="flex cursor-pointer items-start gap-3 text-sm text-white/80"
            >
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 shrink-0 accent-purple-500"
                checked={checks[index]}
                onChange={(e) => {
                  const next = [...checks];
                  next[index] = e.target.checked;
                  setChecks(next);
                }}
              />
              {text}
            </label>
          ))}
        </div>
        <button type="submit" className={primary}>
          {busy ? "Saving reconciliation…" : "Confirm reconciliation"}
        </button>
      </fieldset>
      {error && (
        <div className="mt-3">
          <Message error>{error}</Message>
        </div>
      )}
    </form>
  );
}
function Dialog({
  title,
  busy,
  onClose,
  children,
}: {
  title: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    heading = useId();
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={heading}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      className="m-auto max-h-[calc(100dvh_-_2rem)] overflow-y-auto w-[calc(100%_-_2rem)] max-w-lg rounded-2xl border border-white/10 bg-[#0b1421] p-5 text-white shadow-2xl backdrop:bg-black/75"
    >
      <h2 id={heading} className="text-xl font-bold">
        {title}
      </h2>
      {children}
    </dialog>
  );
}
function TransferForm({ t, mutate }: { t: FinanceTotals; mutate: Mutate }) {
  const { run, busy, error, setError } = useWrite(mutate),
    [amount, setAmount] = useState(""),
    [date, setDate] = useState(londonToday),
    [reference, setReference] = useState(""),
    [note, setNote] = useState(""),
    [review, setReview] = useState<Record<string, unknown> | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const pence = readAmount(amount, "Transfer amount");
      if (pence > t.available_pence)
        throw new Error(
          `You entered ${formatGBP(pence)}, but only ${formatGBP(t.available_pence)} is currently available. Reduce the transfer by at least ${formatGBP(pence - t.available_pence)}, or review the costs, refunds and reserves before reconciling again. No transfer request has been sent.`,
        );
      setReview({
        amount_pence: pence,
        date,
        reference,
        note,
        confirmed: true,
        expected_fingerprint: t.fingerprint,
      });
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "The transfer could not be prepared. Check the amount, date and bank reference. No transfer request was sent.",
      );
    }
  }
  async function confirm() {
    if (review && (await run("transfer", review))) {
      setReview(null);
      setAmount("");
      setReference("");
      setNote("");
    }
  }
  return (
    <form className={panel} onSubmit={submit}>
      <h2 className="text-lg font-bold">Transfer to Money Tracker</h2>
      <p className="mt-2 text-sm text-white/65">
        Available:{" "}
        <strong className="text-white">{formatGBP(t.available_pence)}</strong>.
        This records one linked income entry in the main Money Tracker. It does
        not move bank money. Transfers do not change lottery profit.
      </p>
      <fieldset
        disabled={busy || Boolean(review) || t.available_pence <= 0}
        className="mt-4 grid gap-4 sm:grid-cols-2"
      >
        <Field label="Transfer amount (£)">
          <input
            required
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Transfer date">
          <input
            required
            type="date"
            max={londonToday()}
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Bank / allocation reference">
          <input
            required
            maxLength={200}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            className={input}
          />
        </Field>
        <Field label="Transfer notes">
          <input
            maxLength={2000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={input}
          />
        </Field>
        <button className={primary} type="submit">
          Review transfer <ArrowUpRight size={16} />
        </button>
      </fieldset>
      {!review && error && (
        <div className="mt-3">
          <Message error>{error}</Message>
        </div>
      )}
      {review && (
        <Dialog
          title="Confirm transfer to Money Tracker"
          busy={busy}
          onClose={() => setReview(null)}
        >
          <p className="mt-4 text-sm leading-6">
            Record <strong>{formatGBP(Number(review.amount_pence))}</strong>{" "}
            from <strong>{t.title}</strong> on {String(review.date)} with
            reference <strong>{String(review.reference)}</strong>?
          </p>
          <p className="mt-3 text-sm text-white/70">
            A linked credit will be added once. Linked transfers cannot be
            edited, hidden or deleted independently. Recent authenticator
            verification is required.
          </p>
          {error && (
            <div className="mt-3">
              <Message error>{error}</Message>
            </div>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              className={button}
              disabled={busy}
              onClick={() => setReview(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className={primary}
              disabled={busy}
              onClick={confirm}
            >
              {busy ? "Recording transfer…" : "Record transfer"}
            </button>
          </div>
        </Dialog>
      )}
    </form>
  );
}
function CostAction({
  cost,
  action,
  mutate,
  onClose,
}: {
  cost: FinanceCost;
  action: "pay_cost" | "void_cost";
  mutate: Mutate;
  onClose: () => void;
}) {
  const { run, busy, error } = useWrite(mutate),
    [reason, setReason] = useState("");
  return (
    <Dialog
      title={
        action === "void_cost" ? "Void this cost?" : "Mark this cost as paid?"
      }
      busy={busy}
      onClose={onClose}
    >
      <p className="mt-4 text-sm">
        {cost.title} · {formatGBP(cost.amount_pence)}
      </p>
      {action === "void_cost" ? (
        <div className="mt-4">
          <Field label="Reason (at least five characters)">
            <textarea
              rows={4}
              className={`${input} min-h-24 resize-none`}
              onInput={(event) => {
                event.currentTarget.style.height = "auto";
                event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`;
              }}
              minLength={5}
              maxLength={2000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <p className="mt-3 text-sm text-white/65">
            The original stays in the history. This removes it from costs; it
            does not record a supplier refund. Any refunded cash must be
            accounted for before reconciling again.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-white/65">
          Confirm payment was made from lottery funds. This changes money out
          and the remaining balance; the cost was already included in profit.
        </p>
      )}
      {error && (
        <div className="mt-3">
          <Message error>{error}</Message>
        </div>
      )}
      <div className="mt-5 flex gap-3">
        <button className={button} disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          className={primary}
          disabled={
            busy || (action === "void_cost" && reason.trim().length < 5)
          }
          onClick={async () => {
            if (await run(action, { cost_id: cost.id, note: reason }))
              onClose();
          }}
        >
          {busy
            ? "Saving…"
            : action === "void_cost"
              ? "Void cost"
              : "Mark paid"}
        </button>
      </div>
    </Dialog>
  );
}
export default function FinanceClient() {
  const router = useRouter(),
    params = useSearchParams(),
    query = params.toString();
  const [report, setReport] = useState<FinanceReport | null>(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [success, setSuccess] = useState(""),
    [revision, setRevision] = useState(0),
    [action, setAction] = useState<{
      cost: FinanceCost;
      action: "pay_cost" | "void_cost";
    } | null>(null);
  const lotteryId = params.get("lottery") || "",
    page = Math.max(1, Number(params.get("page")) || 1),
    costPage = Math.max(1, Number(params.get("costPage")) || 1),
    transferPage = Math.max(1, Number(params.get("transferPage")) || 1);
  const navigate = useCallback(
    (changes: Record<string, string | number | null>) => {
      const next = new URLSearchParams(query);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, String(value));
      }
      router.push(
        `/Admin/LotteryManagement/Finance${next.size ? "?" + next : ""}`,
        { scroll: false },
      );
    },
    [query, router],
  );
  useEffect(() => {
    const controller = new AbortController();
    let current = true;
    setLoading(true);
    setError("");
    const timeout = setTimeout(() => controller.abort(), 20000);
    fetch(`${FINANCE_API}?${query}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await readFinanceResponse(response, "load");
        const candidate = body as Partial<FinanceReport>;
        if (
          !candidate.summary ||
          !candidate.capabilities ||
          !Array.isArray(candidate.lotteries) ||
          !Array.isArray(candidate.costs) ||
          !Array.isArray(candidate.transfers)
        )
          throw new FinanceRequestError(
            "Load lottery finances: the response is missing required totals, permissions or history lists. The current report cannot be displayed safely. Refresh the figures; if this repeats, ask a main admin to check the finance API response.",
          );
        if (current) setReport(candidate as FinanceReport);
      })
      .catch((error) => {
        if (current) setError(describeFailure(error, "load"));
      })
      .finally(() => {
        clearTimeout(timeout);
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [query, revision]);
  const mutate = useCallback<Mutate>(
    async (action, data, key) => {
      if (!lotteryId)
        throw new FinanceRequestError(
          `${operationLabels[action]} could not start. Open a lottery from All lotteries before saving a cost, reconciliation or transfer. No request has been sent.`,
        );
      setSuccess("");
      if (typeof crypto === "undefined" || !crypto.subtle)
        throw new FinanceRequestError(
          `${operationLabels[action]} could not start because secure browser verification is unavailable. Open the admin portal over HTTPS in a supported browser. No save request has been sent.`,
        );
      const controller = new AbortController(),
        timer = setTimeout(() => controller.abort(), 25000);
      // Preserve an uncertain request across a manual refresh. Only an acknowledged
      // response clears it; the same lottery/action/details reuse the UUID.
      try {
        const digest = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(JSON.stringify([lotteryId, action, data])),
        );
        const storageKey =
          "bp-lottery-finance:" +
          Array.from(new Uint8Array(digest), (n) =>
            n.toString(16).padStart(2, "0"),
          ).join("");
        let requestKey = key;
        try {
          requestKey = sessionStorage.getItem(storageKey) || key;
          sessionStorage.setItem(storageKey, requestKey);
        } catch {
          /* Private-mode storage may be unavailable; in-memory retry key remains. */
        }
        const response = await fetch(FINANCE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, lotteryId, requestKey, data }),
          signal: controller.signal,
        });
        await readFinanceResponse(response, action);
        try {
          sessionStorage.removeItem(storageKey);
        } catch {
          /* Optional retry persistence. */
        }
        setSuccess(
          action === "transfer"
            ? "Transfer recorded in Money Tracker."
            : "Lottery finances saved.",
        );
        setRevision((n) => n + 1);
      } catch (error) {
        throw new FinanceRequestError(describeFailure(error, action));
      } finally {
        clearTimeout(timer);
      }
    },
    [lotteryId],
  );
  // Clamp after filtering, deletion or an out-of-range URL. Never show a blank page.
  useEffect(() => {
    if (!report || loading || error) return;
    const key = lotteryId
      ? costPage > Math.max(1, Math.ceil(report.cost_count / 10))
        ? "costPage"
        : transferPage > Math.max(1, Math.ceil(report.transfer_count / 10))
          ? "transferPage"
          : null
      : page > Math.max(1, Math.ceil(report.total / 10))
        ? "page"
        : null;
    if (key) navigate({ [key]: 1 });
  }, [
    report,
    loading,
    error,
    lotteryId,
    costPage,
    transferPage,
    page,
    navigate,
  ]);
  const t = report?.lottery;
  return (
    <main className="w-full min-w-0 max-w-none space-y-6 pb-8 text-white">
      <header className="flex flex-col gap-4 px-4 pt-5 sm:px-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-purple-300">
            Burton Pride Admin Portal
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">
            Finance &amp; Transfers
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/60">
            Manage lottery income, costs, profit and transfers to the Money
            Tracker.
          </p>
        </div>
        <button
          type="button"
          className={`${button} min-h-11 shrink-0 self-start lg:self-auto`}
          disabled={loading}
          aria-busy={loading}
          onClick={() => setRevision((n) => n + 1)}
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className={loading ? "animate-spin motion-reduce:animate-none" : ""}
          />
          Refresh figures
        </button>
      </header>
      {success && <Message>{success}</Message>}
      {error && (
        <div className="space-y-3">
          <Message error>{error}</Message>
          <button
            type="button"
            className={button}
            disabled={loading}
            onClick={() => setRevision((n) => n + 1)}
          >
            <RefreshCw size={16} aria-hidden="true" /> Try loading again
          </button>
        </div>
      )}
      {loading ? (
        <div className={panel} role="status" aria-live="polite">
          Loading lottery finances…
        </div>
      ) : error ? null : (
        report && (
          <>
            {t ? (
              <>
                <button
                  className={button}
                  onClick={() =>
                    navigate({
                      lottery: null,
                      costPage: null,
                      transferPage: null,
                    })
                  }
                >
                  <ArrowLeft size={16} />
                  All lotteries
                </button>
                <div className={panel}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-xl font-bold">{t.title}</h2>
                    <span className="rounded-lg bg-white/10 px-3 py-1 text-sm">
                      {t.mode === "unclassified"
                        ? "Needs classification"
                        : t.mode === "test"
                          ? "Test lottery"
                          : "Live lottery"}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-white/65">
                    {t.paid_orders} confirmed orders ·{" "}
                    {formatGBP(t.unpaid_costs_pence)} costs still to pay ·{" "}
                    {formatGBP(t.pending_refunds_pence)} refunds pending
                  </p>
                </div>
                {t.invalid_sources && (
                  <Message error>
                    Transfers are blocked because payment amounts, currencies or
                    refund links need review. Check this lottery’s orders and
                    refunds against the payment provider, correct any mismatched
                    records and refresh the figures. Reconcile again only after
                    those checks pass.
                  </Message>
                )}
                {t.imported_sales && (
                  <Message error>
                    Transfers are blocked because some lottery sales already
                    match income in the main Money Tracker. Compare the existing
                    income entries with this lottery’s orders before recording
                    another transfer. Ask a finance admin to resolve the
                    overlap, then refresh and reconcile again to avoid counting
                    income twice.
                  </Message>
                )}
                {!t.reconciled && (
                  <Message>
                    {t.mode === "test"
                      ? "Test lotteries cannot transfer real funds."
                      : "Transfers are locked until the current figures have been reconciled as live."}
                  </Message>
                )}
                {t.balance_pence < 0 && (
                  <Message error>
                    This lottery has a negative remaining balance. Compare paid
                    costs, completed refunds and previous transfers with
                    confirmed sales. Correct any inaccurate records or arrange
                    the missing funds through your normal finance process, then
                    refresh and reconcile the figures before attempting a
                    transfer.
                  </Message>
                )}
                <Metrics t={t} />
                <div className="grid items-start gap-5 lg:grid-cols-2">
                  {report.capabilities.canManage ? (
                    <CostForm key={"cost-" + t.id} mutate={mutate} />
                  ) : (
                    <Message>
                      Your account can view these finances. Cost and
                      reconciliation changes require finance management
                      permission.
                    </Message>
                  )}
                  <div className="space-y-5">
                    {report.capabilities.canTransfer ? (
                      <TransferForm
                        key={"transfer-" + t.id}
                        t={t}
                        mutate={mutate}
                      />
                    ) : (
                      <Message>
                        Transfers require lottery finance transfer and Money
                        Tracker add-transaction permissions.
                      </Message>
                    )}
                    {report.capabilities.canManage && (
                      <ReconciliationForm
                        key={t.id + "-" + t.fingerprint + "-" + t.reconciled_at}
                        t={t}
                        mutate={mutate}
                      />
                    )}
                  </div>
                </div>
                <section className={panel}>
                  <h2 className="text-lg font-bold">Cost history</h2>
                  <p className="mt-1 text-sm text-white/65">
                    Paid costs and costs still owed are both included in profit
                    / loss.
                  </p>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/65">
                        <tr>
                          {["Cost", "Date", "Amount", "Status", "Actions"].map(
                            (x) => (
                              <th key={x} scope="col" className="p-3">
                                {x}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {report.costs.map((cost: FinanceCost) => (
                          <tr
                            key={cost.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.025]"
                          >
                            <td className="p-3">
                              <p className="font-semibold">{cost.title}</p>
                              <p className="mt-1 text-xs text-white/60">
                                {cost.category.replaceAll("_", " ")}
                                {cost.reference ? " · " + cost.reference : ""}
                                {cost.void_reason
                                  ? " · Voided: " + cost.void_reason
                                  : ""}
                              </p>
                            </td>
                            <td className="whitespace-nowrap p-3">
                              {cost.cost_date}
                            </td>
                            <td className="whitespace-nowrap p-3 tabular-nums">
                              {formatGBP(cost.amount_pence)}
                            </td>
                            <td className="p-3">
                              {cost.voided_at
                                ? "Voided"
                                : cost.status === "paid"
                                  ? "Paid"
                                  : "Still to pay"}
                            </td>
                            <td className="p-3">
                              {!cost.voided_at &&
                                report.capabilities.canManage && (
                                  <div className="flex gap-2">
                                    {cost.status === "unpaid" && (
                                      <button
                                        className={button}
                                        onClick={() =>
                                          setAction({
                                            cost,
                                            action: "pay_cost",
                                          })
                                        }
                                      >
                                        Mark paid
                                      </button>
                                    )}
                                    <button
                                      className={button}
                                      onClick={() =>
                                        setAction({ cost, action: "void_cost" })
                                      }
                                    >
                                      Void
                                    </button>
                                  </div>
                                )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.costs.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-white/65">
                        No costs recorded. Add any paid or outstanding costs
                        before reconciling.
                      </p>
                    )}
                  </div>
                  <Pages
                    label="Cost pages"
                    page={costPage}
                    total={report.cost_count}
                    onChange={(n) => navigate({ costPage: n })}
                  />
                </section>
                <section className={panel}>
                  <h2 className="text-lg font-bold">
                    Transfers to Money Tracker
                  </h2>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/65">
                        <tr>
                          {[
                            "Date",
                            "Amount",
                            "Reference",
                            "Linked Money Tracker entry",
                          ].map((x) => (
                            <th key={x} scope="col" className="p-3">
                              {x}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.transfers.map((transfer: FinanceTransfer) => (
                          <tr
                            key={transfer.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.025]"
                          >
                            <td className="whitespace-nowrap p-3">
                              {transfer.transfer_date}
                            </td>
                            <td className="whitespace-nowrap p-3 tabular-nums">
                              {formatGBP(transfer.amount_pence)}
                            </td>
                            <td className="max-w-xs break-words p-3">
                              {transfer.reference}
                            </td>
                            <td className="max-w-xs break-all p-3 text-xs">
                              {transfer.money_transaction_id}
                              <p className="mt-1 text-white/60">
                                Search the Money Tracker for LF-{transfer.id}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.transfers.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-white/65">
                        No funds transferred yet.
                      </p>
                    )}
                  </div>
                  <Pages
                    label="Transfer pages"
                    page={transferPage}
                    total={report.transfer_count}
                    onChange={(n) => navigate({ transferPage: n })}
                  />
                </section>
              </>
            ) : (
              <>
                <form
                  key={
                    "filters-" +
                    (params.get("q") || "") +
                    "-" +
                    (params.get("year") || "")
                  }
                  className={
                    panel +
                    " grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(160px,240px)_auto_auto]"
                  }
                  onSubmit={(e) => {
                    e.preventDefault();
                    const f = new FormData(e.currentTarget);
                    navigate({
                      q: String(f.get("q") || ""),
                      year: String(f.get("year") || ""),
                      page: 1,
                    });
                  }}
                >
                  <Field label="Search lottery title">
                    <input
                      name="q"
                      defaultValue={params.get("q") || ""}
                      maxLength={200}
                      className={input}
                    />
                  </Field>
                  <Field label="Lottery year (optional)">
                    <input
                      name="year"
                      type="number"
                      min={2000}
                      max={2200}
                      defaultValue={params.get("year") || ""}
                      placeholder="All years"
                      className={input}
                    />
                  </Field>
                  <button type="submit" className={primary}>
                    Apply filters
                  </button>
                  <button
                    type="button"
                    className={button}
                    disabled={!params.get("q") && !params.get("year")}
                    onClick={() => navigate({ q: null, year: null, page: 1 })}
                  >
                    Clear filters
                  </button>
                </form>
                <Message>
                  Overview totals include lotteries classified as live. The year
                  is the draw year in UK time, or creation year if no draw is
                  scheduled.{" "}
                  {report.unclassified > 0
                    ? `${report.unclassified} lotteries still need classification.`
                    : ""}
                </Message>
                {report.needs_review > 0 && (
                  <Message error>
                    {report.needs_review} live lotteries need a source-data
                    review. Overview totals are provisional until those issues
                    are corrected.
                  </Message>
                )}
                <Metrics t={report.summary} />
                <section className={panel}>
                  <h2 className="text-lg font-bold">Lottery finances</h2>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
                    <table className="w-full min-w-[640px] text-left text-sm">
                      <thead className="border-b border-white/10 bg-white/[0.03] text-xs font-semibold text-white/65">
                        <tr>
                          {[
                            "Lottery",
                            "Mode",
                            "Income",
                            "Costs (paid + unpaid)",
                            "Profit / loss",
                            "Available",
                            "",
                          ].map((x, i) => (
                            <th key={i} scope="col" className="p-3">
                              {x || "Open"}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {report.lotteries.map((row: FinanceTotals) => (
                          <tr
                            key={row.id}
                            className="border-b border-white/10 last:border-b-0 hover:bg-white/[0.025]"
                          >
                            <td className="p-3 font-semibold">
                              {row.title}
                              <p className="mt-1 text-xs font-normal text-white/60">
                                {row.lottery_year}
                              </p>
                            </td>
                            <td className="p-3">
                              <span className="inline-flex whitespace-nowrap rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-medium text-white/75">
                                {row.mode === "live"
                                  ? "Live"
                                  : row.mode === "test"
                                    ? "Test"
                                    : "Needs classification"}
                              </span>
                            </td>
                            <td className="whitespace-nowrap p-3">
                              {formatGBP(row.gross_sales_pence)}
                            </td>
                            <td className="whitespace-nowrap p-3">
                              {formatGBP(
                                row.paid_costs_pence + row.unpaid_costs_pence,
                              )}
                            </td>
                            <td
                              className={
                                "whitespace-nowrap p-3 " +
                                (row.net_result_pence < 0
                                  ? "text-red-300"
                                  : "text-emerald-300")
                              }
                            >
                              {formatGBP(row.net_result_pence)}
                            </td>
                            <td className="whitespace-nowrap p-3">
                              {formatGBP(row.available_pence)}
                            </td>
                            <td className="p-3">
                              <button
                                className={button}
                                aria-label={`Open finances for ${row.title}`}
                                onClick={() =>
                                  navigate({
                                    lottery: row.id,
                                    costPage: 1,
                                    transferPage: 1,
                                  })
                                }
                              >
                                Open{" "}
                                <ArrowUpRight size={14} aria-hidden="true" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {report.total === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-white/65">
                        No lotteries match these filters.
                      </p>
                    )}
                  </div>
                  <Pages
                    label="Lottery pages"
                    page={page}
                    total={report.total}
                    onChange={(n) => navigate({ page: n })}
                  />
                </section>
              </>
            )}
            {action && (
              <CostAction
                key={action.cost.id + action.action}
                {...action}
                mutate={mutate}
                onClose={() => setAction(null)}
              />
            )}
          </>
        )
      )}
    </main>
  );
}
