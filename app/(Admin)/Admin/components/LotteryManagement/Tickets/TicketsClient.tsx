"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
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
  created_at: string;
  updated_at: string;
  is_payment_valid: boolean;
  is_draw_eligible: boolean;
  events: TicketEvent[];
};

type ApiResponse = {
  ok: boolean;
  items?: TicketRecord[];
  error?: string;
  message?: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/tickets";

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
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return { ok: false, error: "The API returned invalid JSON." };
  }
}

export default function TicketsClient() {
  const [items, setItems] = useState<TicketRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<TicketRecord | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<TicketStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [eligibility, setEligibility] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to load tickets.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  }

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
      const matchesLottery = lotteryId === "all" || item.lottery_id === lotteryId;
      const matchesEligibility =
        eligibility === "all" ||
        (eligibility === "eligible" && item.is_draw_eligible) ||
        (eligibility === "ineligible" && !item.is_draw_eligible);

      return matchesSearch && matchesStatus && matchesLottery && matchesEligibility;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "ticket_asc":
          return a.ticket_number.localeCompare(b.ticket_number, undefined, { numeric: true });
        case "ticket_desc":
          return b.ticket_number.localeCompare(a.ticket_number, undefined, { numeric: true });
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
  }, [items, search, status, lotteryId, eligibility, sort]);

  const issued = items.filter((x) => x.status === "issued").length;
  const reserved = items.filter((x) => x.status === "reserved").length;
  const winners = items.filter((x) => x.status === "winner").length;
  const invalid = items.filter((x) => ["void", "refunded"].includes(x.status)).length;
  const integrityWarnings = items.filter(
    (x) => ["issued", "winner"].includes(x.status) && !x.is_payment_valid,
  ).length;

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
                View the immutable ticket register, linked orders, payment validity,
                ticket states, winner records and ticket history.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadTickets}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Issued" value={issued} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Reserved" value={reserved} icon={<Ticket className="h-5 w-5" />} />
        <StatCard label="Winners" value={winners} icon={<Trophy className="h-5 w-5" />} />
        <StatCard label="Void / refunded" value={invalid} icon={<XCircle className="h-5 w-5" />} />
        <StatCard label="Integrity warnings" value={integrityWarnings} icon={<AlertTriangle className="h-5 w-5" />} />
      </section>

      {error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
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
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket, purchaser, order or payment reference..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={status} onChange={(v) => setStatus(v as TicketStatus | "all")}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>

          <Select value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (
              <option key={id} value={id}>
                {title}
              </option>
            ))}
          </Select>

          <Select value={eligibility} onChange={setEligibility}>
            <option value="all">All draw eligibility</option>
            <option value="eligible">Draw eligible</option>
            <option value="ineligible">Not draw eligible</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="newest">Newest issued</option>
            <option value="oldest">Oldest issued</option>
            <option value="ticket_asc">Ticket number A-Z</option>
            <option value="ticket_desc">Ticket number Z-A</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Ticket register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} ticket records
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading tickets...
          </div>
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
            {filtered.map((item) => (
              <TicketRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <TicketDetailsModal ticket={selected} onClose={() => setSelected(null)} />
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
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/55">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">{label}</span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none"
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
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
  const hasIntegrityWarning =
    ["issued", "winner"].includes(item.status) && !item.is_payment_valid;

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white">
              {item.ticket_number}
            </h3>

            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}>
              {statusLabel(item.status)}
            </span>

            {item.is_draw_eligible ? (
              <span className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-bold text-emerald-200">
                Draw eligible
              </span>
            ) : (
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
                Not draw eligible
              </span>
            )}

            {hasIntegrityWarning ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-400/25 bg-red-500/10 px-2.5 py-1 text-[11px] font-bold text-red-200">
                <AlertTriangle className="h-3 w-3" />
                Payment warning
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold text-white/75">{item.lottery_title}</p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Info label="Purchaser" value={item.purchaser_name || "Not linked"} />
            <Info label="Order" value={item.order_reference || "Not linked"} />
            <Info label="Payment" value={item.payment_status || "Unknown"} />
            <Info label="Issued" value={formatDate(item.issued_at)} />
            <Info label="History events" value={String(item.events.length)} />
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
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
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">{value}</div>
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
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ticket-details-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="ticket-details-title" className="text-xl font-extrabold text-white">
              Ticket {ticket.ticket_number}
            </h2>
            <p className="mt-1 text-sm text-white/55">{ticket.lottery_title}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10"
            aria-label="Close ticket details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard icon={<Ticket className="h-4 w-4" />} label="Status" value={statusLabel(ticket.status)} />
            <DetailCard icon={<UserRound className="h-4 w-4" />} label="Purchaser" value={ticket.purchaser_name || "Not linked"} />
            <DetailCard icon={<ShieldCheck className="h-4 w-4" />} label="Payment valid" value={ticket.is_payment_valid ? "Yes" : "No"} />
            <DetailCard icon={<Trophy className="h-4 w-4" />} label="Draw eligible" value={ticket.is_draw_eligible ? "Yes" : "No"} />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Ticket record">
              <DetailRows
                rows={[
                  ["Ticket number", ticket.ticket_number],
                  ["Ticket UUID", ticket.id],
                  ["Lottery", ticket.lottery_title],
                  ["Issued at", formatDate(ticket.issued_at)],
                  ["Created at", formatDate(ticket.created_at)],
                  ["Updated at", formatDate(ticket.updated_at)],
                  ["Voided at", formatDate(ticket.voided_at)],
                  ["Refunded at", formatDate(ticket.refunded_at)],
                  ["Winner at", formatDate(ticket.winner_at)],
                  ["Status reason", ticket.status_reason || ticket.void_reason || "Not recorded"],
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
                  ["Payment reference", ticket.payment_reference || "Not recorded"],
                ]}
              />
            </Panel>

            <Panel title="Integrity checks">
              <div className="space-y-3">
                <IntegrityRow
                  ok={ticket.status === "reserved" || ticket.is_payment_valid || ["void", "refunded"].includes(ticket.status)}
                  text={
                    ticket.is_payment_valid
                      ? "Ticket is linked to a paid order."
                      : ticket.status === "reserved"
                        ? "Reserved ticket has not yet been issued as a valid paid ticket."
                        : ["void", "refunded"].includes(ticket.status)
                          ? "Ticket is intentionally excluded from the draw."
                          : "Issued/winner ticket is not linked to a paid order and needs investigation."
                  }
                />
                <IntegrityRow
                  ok={!["void", "refunded"].includes(ticket.status) || !ticket.is_draw_eligible}
                  text={
                    ["void", "refunded"].includes(ticket.status) && ticket.is_draw_eligible
                      ? "Invalid ticket is incorrectly marked draw eligible."
                      : "Void/refunded ticket exclusion is consistent."
                  }
                />
              </div>
            </Panel>

            <Panel title="Ticket history">
              {ticket.events.length ? (
                <div className="space-y-3">
                  {ticket.events.map((event) => (
                    <div key={event.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-white">{event.event_type}</span>
                        <span className="text-xs text-white/40">{formatDate(event.created_at)}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/55">
                        {event.previous_status || "none"} → {event.new_status || "none"}
                      </p>
                      {event.reason ? (
                        <p className="mt-2 text-xs leading-5 text-white/65">{event.reason}</p>
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
    </div>
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
      <div className="mt-2 break-words text-sm font-extrabold text-white">{value}</div>
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
        <div key={label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between">
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-all text-sm font-semibold text-white/80">{value}</span>
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