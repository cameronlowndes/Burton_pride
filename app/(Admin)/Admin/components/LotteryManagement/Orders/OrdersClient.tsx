"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Eye,
  Filter,
  Loader2,
  Mail,
  PoundSterling,
  ReceiptText,
  RefreshCw,
  Search,
  Ticket,
  Trophy,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

type TicketRecord = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

type HistoryRecord = {
  id: string;
  label: string;
  status?: string | null;
  detail?: string | null;
  created_at: string;
};

type OrderRecord = {
  id: string;
  order_reference: string;
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  purchaser_name: string | null;
  purchaser_email: string | null;
  purchaser_phone: string | null;
  quantity: number;
  total_amount: number;
  currency: string;
  payment_status: PaymentStatus;
  payment_reference: string | null;
  eligibility_accepted: boolean;
  terms_version: string | null;
  privacy_notice_version: string | null;
  marketing_opt_in: boolean;
  created_at: string;
  updated_at: string;
  paid_at: string | null;
  ticket_count: number;
  active_ticket_count: number;
  winner_count: number;
  refunded_amount: number;
  tickets: TicketRecord[];
  acceptances: HistoryRecord[];
  refunds: HistoryRecord[];
  notifications: HistoryRecord[];
};

type ApiResponse = {
  ok: boolean;
  items?: OrderRecord[];
  error?: string;
  message?: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/orders";

const PAYMENT_OPTIONS: Array<{ value: PaymentStatus | "all"; label: string }> = [
  { value: "all", label: "All payment statuses" },
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "paid", label: "Paid" },
  { value: "failed", label: "Failed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
  { value: "partially_refunded", label: "Partially refunded" },
  { value: "disputed", label: "Disputed" },
];

function statusLabel(status: PaymentStatus) {
  return PAYMENT_OPTIONS.find((x) => x.value === status)?.label || status;
}

function statusClass(status: PaymentStatus) {
  const classes: Record<PaymentStatus, string> = {
    pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    processing: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    paid: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    failed: "border-red-400/25 bg-red-500/10 text-red-200",
    cancelled: "border-white/10 bg-white/5 text-white/50",
    refunded: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    partially_refunded: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200",
    disputed: "border-orange-400/25 bg-orange-500/10 text-orange-200",
  };

  return classes[status];
}

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
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

export default function OrdersClient() {
  const [items, setItems] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<OrderRecord | null>(null);

  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [ticketState, setTicketState] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    loadOrders();
  }, []);

  async function loadOrders() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to load lottery orders.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load lottery orders.");
    } finally {
      setLoading(false);
    }
  }

  const lotteries = useMemo(() => {
    const map = new Map<string, string>();

    for (const item of items) {
      map.set(item.lottery_id, item.lottery_title);
    }

    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const ticketMatches = item.tickets.some((ticket) =>
        ticket.ticket_number.toLowerCase().includes(q),
      );

      const matchesSearch =
        !q ||
        item.order_reference.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.purchaser_name || "").toLowerCase().includes(q) ||
        (item.purchaser_email || "").toLowerCase().includes(q) ||
        (item.payment_reference || "").toLowerCase().includes(q) ||
        item.lottery_title.toLowerCase().includes(q) ||
        ticketMatches;

      const matchesPayment =
        paymentStatus === "all" || item.payment_status === paymentStatus;

      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;

      const matchesTickets =
        ticketState === "all" ||
        (ticketState === "issued" && item.active_ticket_count > 0) ||
        (ticketState === "none" && item.ticket_count === 0) ||
        (ticketState === "winner" && item.winner_count > 0);

      return matchesSearch && matchesPayment && matchesLottery && matchesTickets;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "amount_high":
          return Number(b.total_amount) - Number(a.total_amount);
        case "amount_low":
          return Number(a.total_amount) - Number(b.total_amount);
        case "tickets_high":
          return Number(b.ticket_count) - Number(a.ticket_count);
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
  }, [items, search, paymentStatus, lotteryId, ticketState, sort]);

  const paidOrders = items.filter((x) => x.payment_status === "paid");
  const paidRevenue = paidOrders.reduce(
    (sum, item) => sum + Number(item.total_amount || 0),
    0,
  );
  const totalTickets = items.reduce((sum, item) => sum + item.ticket_count, 0);
  const problems = items.filter((x) =>
    ["failed", "disputed", "partially_refunded"].includes(x.payment_status),
  ).length;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <ReceiptText className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Orders & Entries
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Review lottery purchasers, payments, issued tickets, declarations,
                notifications, refunds and winner links.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard
          icon={<ReceiptText className="h-5 w-5" />}
          label="Total orders"
          value={String(items.length)}
        />
        <StatCard
          icon={<CheckCircle2 className="h-5 w-5" />}
          label="Paid orders"
          value={String(paidOrders.length)}
        />
        <StatCard
          icon={<PoundSterling className="h-5 w-5" />}
          label="Paid proceeds"
          value={formatMoney(paidRevenue)}
        />
        <StatCard
          icon={<Ticket className="h-5 w-5" />}
          label="Tickets issued"
          value={String(totalTickets)}
        />
        <StatCard
          icon={<AlertTriangle className="h-5 w-5" />}
          label="Needs attention"
          value={String(problems)}
        />
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
              placeholder="Name, email, order, ticket or payment reference..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={paymentStatus} onChange={(v) => setPaymentStatus(v as PaymentStatus | "all")}>
            {PAYMENT_OPTIONS.map((option) => (
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

          <Select value={ticketState} onChange={setTicketState}>
            <option value="all">All ticket states</option>
            <option value="issued">Has issued tickets</option>
            <option value="none">No tickets issued</option>
            <option value="winner">Winner orders</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="newest">Newest orders</option>
            <option value="oldest">Oldest orders</option>
            <option value="amount_high">Highest amount</option>
            <option value="amount_low">Lowest amount</option>
            <option value="tickets_high">Most tickets</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Order register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} orders
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading orders...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <ReceiptText className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">No orders found</h3>
            <p className="mt-1 text-sm text-white/50">
              There are no orders matching the selected filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <OrderRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected ? (
        <OrderDetailsModal order={selected} onClose={() => setSelected(null)} />
      ) : null}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
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

function OrderRow({
  item,
  onView,
}: {
  item: OrderRecord;
  onView: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-extrabold text-white">
              {item.order_reference}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                item.payment_status,
              )}`}
            >
              {statusLabel(item.payment_status)}
            </span>

            {item.winner_count > 0 ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/25 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
                <Trophy className="h-3 w-3" />
                Winner
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm font-semibold text-white/75">
            {item.lottery_title}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <Info label="Purchaser" value={item.purchaser_name || "Not provided"} />
            <Info label="Email" value={item.purchaser_email || "Not provided"} />
            <Info label="Amount" value={formatMoney(item.total_amount, item.currency)} />
            <Info label="Tickets" value={`${item.ticket_count} issued`} />
            <Info label="Ordered" value={formatDate(item.created_at)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/40">
            <span>Payment ref: {item.payment_reference || "Not recorded"}</span>
            <span>Order ID: {item.id}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={onView}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/10"
        >
          <Eye className="h-4 w-4" />
          View order
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
        {value}
      </div>
    </div>
  );
}

function OrderDetailsModal({
  order,
  onClose,
}: {
  order: OrderRecord;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="order-details-title"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="order-details-title" className="text-xl font-extrabold text-white">
              Order {order.order_reference}
            </h2>
            <p className="mt-1 text-sm text-white/55">{order.lottery_title}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10"
            aria-label="Close order details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard
              icon={<UserRound className="h-4 w-4" />}
              label="Purchaser"
              value={order.purchaser_name || "Not provided"}
            />
            <DetailCard
              icon={<Mail className="h-4 w-4" />}
              label="Email"
              value={order.purchaser_email || "Not provided"}
            />
            <DetailCard
              icon={<CreditCard className="h-4 w-4" />}
              label="Payment"
              value={statusLabel(order.payment_status)}
            />
            <DetailCard
              icon={<PoundSterling className="h-4 w-4" />}
              label="Order total"
              value={formatMoney(order.total_amount, order.currency)}
            />
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Order & payment details">
              <DetailRows
                rows={[
                  ["Order reference", order.order_reference],
                  ["Payment reference", order.payment_reference || "Not recorded"],
                  ["Quantity ordered", String(order.quantity)],
                  ["Order created", formatDate(order.created_at)],
                  ["Paid at", formatDate(order.paid_at)],
                  ["Refunded amount", formatMoney(order.refunded_amount, order.currency)],
                  ["Phone", order.purchaser_phone || "Not provided"],
                  ["Winner records", String(order.winner_count)],
                ]}
              />
            </Panel>

            <Panel title="Declarations & consent">
              <DetailRows
                rows={[
                  ["Eligibility accepted", order.eligibility_accepted ? "Yes" : "No"],
                  ["Terms version", order.terms_version || "Not recorded"],
                  ["Privacy notice version", order.privacy_notice_version || "Not recorded"],
                  ["Marketing opt-in", order.marketing_opt_in ? "Yes" : "No"],
                ]}
              />

              <HistoryList items={order.acceptances} empty="No declaration history recorded." />
            </Panel>

            <Panel title="Issued tickets">
              {order.tickets.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {order.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="rounded-xl border border-white/10 bg-black/20 p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-white/60" />
                        <span className="font-bold text-white">
                          {ticket.ticket_number}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-white/45">
                        {ticket.status} · {formatDate(ticket.issued_at)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Empty text="No ticket numbers have been issued for this order." />
              )}
            </Panel>

            <Panel title="Refund / void history">
              <HistoryList items={order.refunds} empty="No refund history recorded." />
            </Panel>

            <Panel title="Email & notification history">
              <HistoryList
                items={order.notifications}
                empty="No notification history recorded."
              />
            </Panel>

            <Panel title="Integrity summary">
              <div className="space-y-3">
                <IntegrityRow
                  ok={order.payment_status === "paid" ? order.ticket_count > 0 : true}
                  text={
                    order.payment_status === "paid"
                      ? order.ticket_count > 0
                        ? "Paid order has issued ticket records."
                        : "Paid order has no issued tickets and needs reconciliation."
                      : "Order is not marked paid."
                  }
                />
                <IntegrityRow
                  ok={order.payment_status !== "failed" || order.ticket_count === 0}
                  text={
                    order.payment_status === "failed" && order.ticket_count > 0
                      ? "Failed payment has ticket records and needs investigation."
                      : "No failed-payment ticket conflict detected."
                  }
                />
                <IntegrityRow
                  ok={order.refunded_amount <= order.total_amount}
                  text={
                    order.refunded_amount <= order.total_amount
                      ? "Recorded refunds do not exceed the order total."
                      : "Refund history exceeds the recorded order total."
                  }
                />
              </div>
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
        <div
          key={label}
          className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between"
        >
          <span className="text-sm text-white/45">{label}</span>
          <span className="break-all text-sm font-semibold text-white/80">{value}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryList({
  items,
  empty,
}: {
  items: HistoryRecord[];
  empty: string;
}) {
  if (!items.length) return <Empty text={empty} />;

  return (
    <div className="mt-4 space-y-2">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold text-white">{item.label}</span>
            {item.status ? (
              <span className="text-xs text-white/50">{item.status}</span>
            ) : null}
          </div>
          {item.detail ? (
            <p className="mt-1 text-xs leading-5 text-white/55">{item.detail}</p>
          ) : null}
          <p className="mt-1 text-xs text-white/35">{formatDate(item.created_at)}</p>
        </div>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
      {text}
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
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span className="text-sm leading-5">{text}</span>
    </div>
  );
}