"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Barcode,
  CheckCircle2,
  Eye,
  Filter,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

type TicketStatus = "reserved" | "issued" | "void" | "refunded" | "winner";

type TicketEvent = {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  reason: string | null;
  created_at: string;
};

type TicketRecord = {
  id: string;
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  order_id: string | null;
  order_reference: string | null;
  purchaser_name: string | null;
  purchaser_email: string | null;
  payment_status: string | null;
  payment_reference: string | null;
  ticket_number: string;
  status: TicketStatus;
  issued_at: string | null;
  voided_at: string | null;
  refunded_at: string | null;
  winner_at: string | null;
  void_reason: string | null;
  status_reason: string | null;
  ticket_source?: "online" | "paper" | null;
  paper_registered_at?: string | null;
  paper_registered_by?: string | null;
  created_at: string;
  updated_at: string;
  is_payment_valid: boolean;
  is_draw_eligible: boolean;
  is_test?: boolean;
  events: TicketEvent[];
};

const API_ROUTE = "/api/admin/lotterymanagement/tickets";
const REQUEST_TIMEOUT_MS = 20000;
const PAGE_SIZE = 50;
class TicketRequestError extends Error {}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function nullableText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
function parseTicket(value: unknown): TicketRecord {
  if (
    !isRecord(value) ||
    ["id", "lottery_id", "lottery_title", "ticket_number"].some(
      (key) => typeof value[key] !== "string" || !value[key],
    ) ||
    !["reserved", "issued", "void", "refunded", "winner"].includes(
      String(value.status),
    )
  ) {
    throw new TicketRequestError(
      "Ticket data is incomplete. Refresh or report the issue.",
    );
  }
  const events = Array.isArray(value.events)
    ? value.events.map((event): TicketEvent => {
        if (
          !isRecord(event) ||
          typeof event.id !== "string" ||
          typeof event.event_type !== "string"
        ) {
          throw new TicketRequestError(
            "Ticket history is incomplete. Refresh or report the issue.",
          );
        }
        return {
          id: event.id,
          event_type: event.event_type,
          previous_status: nullableText(event.previous_status),
          new_status: nullableText(event.new_status),
          reason: nullableText(event.reason),
          created_at: nullableText(event.created_at) ?? "",
        };
      })
    : [];
  return {
    id: value.id as string,
    lottery_id: value.lottery_id as string,
    lottery_title: value.lottery_title as string,
    lottery_slug: nullableText(value.lottery_slug) ?? "",
    ticket_number: value.ticket_number as string,
    status: value.status as TicketStatus,
    order_id: nullableText(value.order_id),
    order_reference: nullableText(value.order_reference),
    purchaser_name: nullableText(value.purchaser_name),
    purchaser_email: nullableText(value.purchaser_email),
    payment_status: nullableText(value.payment_status),
    payment_reference: nullableText(value.payment_reference),
    issued_at: nullableText(value.issued_at),
    voided_at: nullableText(value.voided_at),
    refunded_at: nullableText(value.refunded_at),
    winner_at: nullableText(value.winner_at),
    void_reason: nullableText(value.void_reason),
    status_reason: nullableText(value.status_reason),
    ticket_source:
      value.ticket_source === "paper"
        ? "paper"
        : value.ticket_source === "online"
          ? "online"
          : null,
    paper_registered_at: nullableText(value.paper_registered_at),
    paper_registered_by: nullableText(value.paper_registered_by),
    created_at: nullableText(value.created_at) ?? "",
    updated_at: nullableText(value.updated_at) ?? "",
    is_payment_valid: value.is_payment_valid === true,
    is_draw_eligible: value.is_draw_eligible === true,
    is_test: value.is_test === true,
    events,
  };
}
// This is a conservative display check. The frozen server snapshot determines the actual draw pool.
function reportedEligible(ticket: TicketRecord): boolean {
  return (
    ticket.is_draw_eligible &&
    ticket.status === "issued" &&
    ticket.is_payment_valid &&
    ticket.payment_status === "paid" &&
    !!ticket.order_id &&
    ticket.ticket_source !== "paper" &&
    ticket.is_test !== true
  );
}
function integrityWarning(ticket: TicketRecord): boolean {
  return (
    (["issued", "winner"].includes(ticket.status) &&
      (!ticket.is_payment_valid ||
        ticket.payment_status !== "paid" ||
        !ticket.order_id)) ||
    (ticket.is_draw_eligible && !reportedEligible(ticket))
  );
}
function safeRequestError(status: number): string {
  if (status === 401)
    return "Your session has expired. Sign in again and refresh tickets.";
  if (status === 403)
    return "You do not have permission to view these ticket records.";
  if (status === 429)
    return "Too many requests. Wait a moment and refresh tickets.";
  return "Tickets could not be loaded. Refresh or report the issue.";
}

const STATUS_OPTIONS: Array<{ value: TicketStatus | "all"; label: string }> = [
  { value: "all", label: "All ticket statuses" },
  { value: "reserved", label: "Reserved" },
  { value: "issued", label: "Issued" },
  { value: "void", label: "Void" },
  { value: "refunded", label: "Refunded" },
  { value: "winner", label: "Winner" },
];

function statusLabel(status: TicketStatus) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label || status;
}

function statusClass(status: TicketStatus) {
  const map: Record<TicketStatus, string> = {
    reserved: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    issued: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    void: "border-red-400/25 bg-red-500/10 text-red-200",
    refunded: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    winner: "border-yellow-400/25 bg-yellow-500/10 text-yellow-200",
  };
  return map[status];
}

function formatDate(value: string | null) {
  if (!value) return "Not recorded";
  if (!Number.isFinite(Date.parse(value))) return "Invalid date";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

export default function TicketsClient() {
  const [items, setItems] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TicketRecord | null>(null);
  const [page, setPage] = useState(1);
  const mountedRef = useRef(false);
  const requestRef = useRef<AbortController | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [eligibility, setEligibility] = useState("all");
  const [sort, setSort] = useState("newest");

  const loadTickets = useCallback(async () => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    const timer = window.setTimeout(
      () => controller.abort(),
      REQUEST_TIMEOUT_MS,
    );
    setLoading(true);
    setError(null);
    setItems([]);
    setSelected(null);
    setPage(1);
    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });
      if (!res.ok) throw new TicketRequestError(safeRequestError(res.status));
      const data: unknown = await res.json();
      if (!isRecord(data) || data.ok !== true || !Array.isArray(data.items)) {
        throw new TicketRequestError(
          "The service returned incomplete ticket records. Refresh or report the issue.",
        );
      }
      const records = data.items.map(parseTicket);
      if (new Set(records.map((item) => item.id)).size !== records.length) {
        throw new TicketRequestError(
          "Duplicate ticket records were returned. Report the issue before relying on these records.",
        );
      }
      if (
        !mountedRef.current ||
        controller.signal.aborted ||
        requestRef.current !== controller
      )
        return;
      // Paper-ticket operations remain outside this release's scope.
      setItems(records.filter((item) => item.ticket_source !== "paper"));
    } catch (err) {
      if (mountedRef.current && requestRef.current === controller) {
        setItems([]);
        setError(
          err instanceof TicketRequestError && !controller.signal.aborted
            ? err.message
            : "Tickets could not be loaded. Check your connection and refresh.",
        );
      }
    } finally {
      window.clearTimeout(timer);
      if (requestRef.current === controller) {
        requestRef.current = null;
        if (mountedRef.current) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    void loadTickets();
    return () => {
      mountedRef.current = false;
      requestRef.current?.abort();
      requestRef.current = null;
    };
  }, [loadTickets]);
  useEffect(() => {
    setPage(1);
  }, [search, status, lotteryId, eligibility, sort]);

  const lotteries = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.lottery_id, item.lottery_title));
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.ticket_number.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.order_reference || "").toLowerCase().includes(q) ||
        (item.purchaser_name || "").toLowerCase().includes(q) ||
        (item.purchaser_email || "").toLowerCase().includes(q) ||
        (item.payment_reference || "").toLowerCase().includes(q) ||
        item.lottery_title.toLowerCase().includes(q);

      const matchesStatus = status === "all" || item.status === status;
      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;
      const matchesEligibility =
        eligibility === "all" ||
        (eligibility === "eligible" && reportedEligible(item)) ||
        (eligibility === "ineligible" && !reportedEligible(item));

      return (
        matchesSearch && matchesStatus && matchesLottery && matchesEligibility
      );
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (
            (Date.parse(a.created_at) || 0) - (Date.parse(b.created_at) || 0)
          );
        case "ticket_asc":
          return a.ticket_number.localeCompare(b.ticket_number, undefined, {
            numeric: true,
          });
        case "ticket_desc":
          return b.ticket_number.localeCompare(a.ticket_number, undefined, {
            numeric: true,
          });
        default:
          return (
            (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0)
          );
      }
    });
  }, [items, search, status, lotteryId, eligibility, sort]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const issued = items.filter((x) => x.status === "issued").length;
  const reserved = items.filter((x) => x.status === "reserved").length;
  const winners = items.filter((x) => x.status === "winner").length;
  const invalid = items.filter((x) =>
    ["void", "refunded"].includes(x.status),
  ).length;
  const integrityWarnings = items.filter(integrityWarning).length;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Ticket className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">Tickets</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                View the loaded ticket register, linked order references,
                payment status, ticket states, winner records and ticket
                history.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadTickets()}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div
        className="rounded-2xl border border-purple-400/20 bg-purple-500/10 p-4 text-sm text-purple-100"
        role="status"
      >
        This view shows loaded online ticket records. Eligibility is reported by
        the API and checked for visible inconsistencies; the frozen server
        snapshot determines the draw pool. Paper tickets are outside this
        release.
      </div>

      <section
        aria-label="Counts for loaded online ticket records"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"
      >
        <StatCard
          label="Issued"
          value={loading || error ? null : issued}
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatCard
          label="Reserved"
          value={loading || error ? null : reserved}
          icon={<Ticket className="h-5 w-5" />}
        />
        <StatCard
          label="Winners"
          value={loading || error ? null : winners}
          icon={<Trophy className="h-5 w-5" />}
        />
        <StatCard
          label="Void / refunded"
          value={loading || error ? null : invalid}
          icon={<XCircle className="h-5 w-5" />}
        />
        <StatCard
          label="Integrity warnings"
          value={loading || error ? null : integrityWarnings}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200"
        >
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <label htmlFor={searchId} className="sr-only">
              Search loaded tickets
            </label>
            <input
              id={searchId}
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket, purchaser, order or payment reference..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-12 text-sm text-white outline-none placeholder:text-white/35 focus-visible:ring-2 focus-visible:ring-purple-400"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear ticket search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select
            label="Ticket status"
            value={status}
            onChange={(v) => setStatus(v as TicketStatus | "all")}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select label="Lottery" value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>

          <Select
            label="Reported eligibility"
            value={eligibility}
            onChange={setEligibility}
          >
            <option value="all">All draw eligibility</option>
            <option value="eligible">Reported eligible</option>
            <option value="ineligible">Not reported eligible</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select label="Sort tickets" value={sort} onChange={setSort}>
            <option value="newest">Newest created</option>
            <option value="oldest">Oldest created</option>
            <option value="ticket_asc">Ticket number A-Z</option>
            <option value="ticket_desc">Ticket number Z-A</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Ticket register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {visibleItems.length} of {filtered.length} matching records
            ({items.length} loaded)
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading tickets...
          </div>
        ) : error ? (
          <p className="py-6 text-white/60">
            Ticket records are unavailable. Use Refresh to try again.
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">No tickets found</h3>
            <p className="mt-1 text-sm text-white/50">
              No ticket records match the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <TicketRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </section>

      {filtered.length > PAGE_SIZE && !loading && !error && (
        <nav
          aria-label="Ticket pages"
          className="flex flex-wrap items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-xl border border-white/15 px-4 py-2 text-white disabled:opacity-40"
          >
            Previous
          </button>
          <span
            role="status"
            aria-live="polite"
            className="text-sm text-white/70"
          >
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-xl border border-white/15 px-4 py-2 text-white disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}
      {selected ? (
        <TicketDetailsModal
          ticket={selected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number | null;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/55">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value ?? "—"}</div>
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  const id = useId();
  // Preserve the existing native select; its popup is owned by the platform.
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
      >
        {children}
      </select>
    </div>
  );
}

function TicketRow({
  item,
  onView,
}: {
  item: TicketRecord;
  onView: () => void;
}) {
  const hasIntegrityWarning = integrityWarning(item);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white">
              {item.ticket_number}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}
            >
              {statusLabel(item.status)}
            </span>

            {reportedEligible(item) ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                Reported eligible
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
                Not reported eligible
              </span>
            )}

            {hasIntegrityWarning ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-200">
                <AlertTriangle className="h-3 w-3" />
                Integrity warning
              </span>
            ) : null}

            {item.ticket_source === "paper" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-100">
                <Barcode className="h-3 w-3" />
                Paper ticket
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold text-white/75">
            {item.lottery_title}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Info
              label="Purchaser"
              value={item.purchaser_name || "Not linked"}
            />
            <Info label="Order" value={item.order_reference || "Not linked"} />
            <Info label="Payment" value={item.payment_status || "Unknown"} />
            <Info label="Issued" value={formatDate(item.issued_at)} />
            <Info label="History events" value={String(item.events.length)} />
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-400"
        >
          <Eye className="h-4 w-4" />
          View ticket
        </button>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">
        {value ?? "—"}
      </div>
    </div>
  );
}

function TicketDetailsModal({
  ticket,
  onClose,
}: {
  ticket: TicketRecord;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      dialog?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none items-center justify-center border-0 bg-black/75 p-3 text-white backdrop-blur-sm open:flex md:p-6"
      aria-labelledby="ticket-details-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2
              id="ticket-details-title"
              className="text-xl font-extrabold text-white"
            >
              Ticket {ticket.ticket_number}
            </h2>
            <p className="mt-1 text-sm text-white/55">{ticket.lottery_title}</p>
          </div>

          <div className="flex items-center gap-2">
            {ticket.order_id && (
              <Link
                href="/Admin/LotteryManagement/Orders"
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-sm font-extrabold text-purple-100 focus-visible:ring-2 focus-visible:ring-purple-400"
              >
                <Eye className="h-4 w-4" /> Open orders
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-400"
              autoFocus
              aria-label="Close ticket details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard
              icon={<Ticket className="h-4 w-4" />}
              label="Status"
              value={statusLabel(ticket.status)}
            />
            <DetailCard
              icon={<UserRound className="h-4 w-4" />}
              label="Purchaser"
              value={ticket.purchaser_name || "Not linked"}
            />
            <DetailCard
              icon={<ShieldCheck className="h-4 w-4" />}
              label="API payment check"
              value={ticket.is_payment_valid ? "Yes" : "No"}
            />
            <DetailCard
              icon={<Trophy className="h-4 w-4" />}
              label="Reported eligibility"
              value={reportedEligible(ticket) ? "Eligible" : "Not eligible"}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Ticket record">
              <DetailRows
                rows={[
                  ["Ticket number", ticket.ticket_number],
                  ["Ticket UUID", ticket.id],
                  [
                    "Ticket source",
                    ticket.ticket_source === "paper"
                      ? "Paper ticket"
                      : "Online ticket",
                  ],
                  ["Lottery", ticket.lottery_title],
                  ["Issued at", formatDate(ticket.issued_at)],
                  ["Created at", formatDate(ticket.created_at)],
                  ["Updated at", formatDate(ticket.updated_at)],
                  ["Voided at", formatDate(ticket.voided_at)],
                  ["Refunded at", formatDate(ticket.refunded_at)],
                  ["Winner at", formatDate(ticket.winner_at)],
                  [
                    "Status reason",
                    ticket.status_reason ||
                      ticket.void_reason ||
                      "Not recorded",
                  ],
                ]}
              />
            </Panel>

            <Panel title="Order & purchaser">
              <DetailRows
                rows={[
                  ["Order reference", ticket.order_reference || "Not linked"],
                  ["Order ID", ticket.order_id || "Not linked"],
                  ["Purchaser", ticket.purchaser_name || "Not provided"],
                  ["Email", ticket.purchaser_email || "Not provided"],
                  ["Payment status", ticket.payment_status || "Unknown"],
                  [
                    "Payment reference",
                    ticket.payment_reference || "Not recorded",
                  ],
                ]}
              />
            </Panel>

            <Panel title="Integrity checks">
              <div className="space-y-3">
                <IntegrityRow
                  ok={!integrityWarning(ticket)}
                  text={
                    integrityWarning(ticket)
                      ? "The visible payment, order or eligibility fields are inconsistent. Investigate before drawing."
                      : "No inconsistency was found in these displayed fields. Server verification is still required."
                  }
                />
                <p className="text-sm text-white/60">
                  This register does not verify the payment provider,
                  cross-lottery links, refunds or the frozen draw snapshot.
                  Winner state is managed only by the controlled draw workflow.
                </p>
              </div>
            </Panel>

            <Panel title="Ticket history">
              {ticket.events.length ? (
                <div className="space-y-3">
                  {ticket.events.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-4"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">
                          {event.event_type}
                        </span>
                        <span className="text-xs text-white/40">
                          {formatDate(event.created_at)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-white/55">
                        {event.previous_status || "none"} →{" "}
                        {event.new_status || "none"}
                      </p>
                      {event.reason ? (
                        <p className="mt-2 text-xs leading-5 text-white/65">
                          {event.reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
                  No ticket status events have been recorded yet.
                </div>
              )}
            </Panel>
          </div>
        </div>
      </div>
    </dialog>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-white/40">
        {icon}
        {label}
      </div>
      <div className="mt-2 break-words text-sm font-extrabold text-white">
        {value ?? "—"}
      </div>
    </div>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 font-extrabold text-white">{title}</h3>
      {children}
    </section>
  );
}

function DetailRows({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
        >
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-all text-sm font-semibold text-white/80">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

function IntegrityRow({ ok, text }: { ok: boolean; text: string }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border p-3 ${
        ok
          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/20 bg-red-500/10 text-red-100"
      }`}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="text-sm leading-5">{text}</span>
    </div>
  );
}
