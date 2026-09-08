"use client";

import type { ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  Mail,
  Pencil,
  PoundSterling,
  Ticket,
  UserRound,
  X,
  XCircle,
} from "lucide-react";

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially_refunded"
  | "disputed";

export type TicketRecord = {
  id: string;
  ticket_number: string;
  status: string;
  issued_at: string | null;
};

export type HistoryRecord = {
  id: string;
  label: string;
  status?: string | null;
  detail?: string | null;
  created_at: string;
};

export type OrderRecord = {
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

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Waiting payment",
  processing: "Processing",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  partially_refunded: "Partially refunded",
  disputed: "Disputed",
};

function statusLabel(status: PaymentStatus) {
  return PAYMENT_STATUS_LABELS[status];
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

export default function OrderDetailsModal({
  order,
  onClose,
  onMarkPaid,
  onIssueMissingTickets,
  onEdit,
}: {
  order: OrderRecord;
  onClose: () => void;
  onMarkPaid: (order: OrderRecord) => void;
  onIssueMissingTickets: (order: OrderRecord) => void;
  onEdit: (order: OrderRecord) => void;
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

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-purple-300/20 bg-purple-500/10 px-4 py-2 text-sm font-extrabold text-purple-100 transition hover:bg-purple-500/20"
            >
              <Pencil className="h-4 w-4" />
              Edit order
            </button>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10"
              aria-label="Close order details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          {order.payment_status === "pending" ? (
            <div className="mb-6 rounded-2xl border border-amber-400/25 bg-amber-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 font-extrabold text-amber-100">
                    <AlertTriangle className="h-5 w-5" />
                    Waiting for payment
                  </div>

                  <p className="mt-2 text-sm leading-6 text-amber-100/70">
                    Only use the manual paid action when Burton Pride has confirmed
                    that this payment should be treated as received. A main admin
                    password is required. The action will issue the lottery number
                    and send the entrant a confirmation email.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onMarkPaid(order)}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-emerald-400 px-5 py-3 text-sm font-extrabold text-emerald-950 transition hover:bg-emerald-300"
                >
                  <CheckCircle2 className="h-5 w-5" />
                  Mark as paid
                </button>
              </div>
            </div>
          ) : null}

          {order.payment_status === "paid" &&
          order.ticket_count < Math.max(1, order.quantity || 1) ? (
            <div className="mb-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex items-center gap-2 font-extrabold text-red-100">
                    <AlertTriangle className="h-5 w-5" />
                    Paid order has missing tickets
                  </div>

                  <p className="mt-2 text-sm leading-6 text-red-100/70">
                    This order is paid for {Math.max(1, order.quantity || 1)} ticket
                    {Math.max(1, order.quantity || 1) === 1 ? "" : "s"}, but only{" "}
                    {order.ticket_count} {order.ticket_count === 1 ? "has" : "have"} been
                    issued. A main admin can safely issue only the missing ticket
                    {Math.max(1, order.quantity || 1) - order.ticket_count === 1
                      ? ""
                      : "s"}.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onIssueMissingTickets(order)}
                  className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-red-400 px-5 py-3 text-sm font-extrabold text-red-950 transition hover:bg-red-300"
                >
                  <Ticket className="h-5 w-5" />
                  Issue missing ticket
                  {Math.max(1, order.quantity || 1) - order.ticket_count === 1
                    ? ""
                    : "s"}
                </button>
              </div>
            </div>
          ) : null}

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
  icon: ReactNode;
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
  children: ReactNode;
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
