"use client";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Filter, Loader2, LockKeyhole, Pencil, PoundSterling, ReceiptText, RefreshCw, Save, Search, Ticket, Trophy, X, } from "lucide-react";
// This screen owns its display model and modal. It no longer imports types or
// an order component from the unrelated TicketsDetailsModal lottery edit page.
export type PaymentStatus = "pending" | "processing" | "paid" | "failed" | "cancelled" | "refunded" | "partially_refunded" | "disputed";
export type TicketRecord = {
    id: string;
    ticket_number: string;
    status: string;
    issued_at?: string | null;
};
type TimelineRecord = {
    id: string;
    label?: string | null;
    status?: string | null;
    created_at?: string | null;
};
export type OrderRecord = {
    id: string;
    lottery_id: string;
    payment_status: PaymentStatus;
    order_reference?: string | null;
    lottery_title?: string | null;
    lottery_slug?: string | null;
    purchaser_name?: string | null;
    purchaser_email?: string | null;
    purchaser_phone?: string | null;
    quantity?: number | null;
    total_amount?: number | null;
    currency?: string | null;
    payment_reference?: string | null;
    eligibility_accepted?: boolean | null;
    terms_version?: string | null;
    privacy_notice_version?: string | null;
    marketing_opt_in?: boolean | null;
    created_at?: string | null;
    updated_at?: string | null;
    paid_at?: string | null;
    ticket_count?: number | null;
    active_ticket_count?: number | null;
    winner_count?: number | null;
    refunded_amount?: number | null;
    tickets?: TicketRecord[] | null;
    acceptances?: TimelineRecord[] | null;
    refunds?: TimelineRecord[] | null;
    notifications?: TimelineRecord[] | null;
};
export type MutationAction = "edit_order" | "mark_paid" | "issue_missing_tickets";
type Draft = {
    purchaser_name: string;
    purchaser_email: string;
    purchaser_phone: string;
};
type Mutation = {
    action: MutationAction;
    order: OrderRecord;
    draft: Draft;
};
type ApiData = {
    ok?: unknown;
    items?: unknown;
    request_id?: unknown;
};
const API_ROUTE = "/api/admin/lotterymanagement/orders";
const TIMEOUT_MS = 20000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ORDERS = 1000;
const PAGE_SIZE = 25;
const STATUS_LABELS: Record<PaymentStatus, string> = {
    pending: "Waiting payment", processing: "Processing", paid: "Paid", failed: "Failed",
    cancelled: "Cancelled", refunded: "Refunded", partially_refunded: "Partially refunded", disputed: "Disputed",
};
const STATUS_CLASSES: Record<PaymentStatus, string> = {
    pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    processing: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    paid: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    failed: "border-red-400/25 bg-red-500/10 text-red-200",
    cancelled: "border-white/10 bg-white/5 text-white/65",
    refunded: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    partially_refunded: "border-fuchsia-400/25 bg-fuchsia-500/10 text-fuchsia-200",
    disputed: "border-orange-400/25 bg-orange-500/10 text-orange-200",
};
const BUTTON = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/15 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50";
const INPUT = "mt-2 w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-300 placeholder:text-white/50";
class OrdersError extends Error {
    constructor(message: string, public status?: number, public requestId?: string) { super(message); this.name = "OrdersError"; }
}
function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function safeReference(value: unknown) {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
}
function requestError(status: number, requestId?: string) {
    const message = status === 401 ? "Your session has expired. Sign in again to continue." :
        status === 403 ? "You do not have permission to access these orders or perform this action." :
            status === 409 ? "The order has changed or this action is not permitted in its current state. Refresh and review it." :
                status === 429 ? "Too many requests. Wait a moment before trying again." :
                    status === 400 || status === 422 ? "The server rejected this request. Check the fields and required approval." :
                        "The request could not be completed. Refresh and check the current order before continuing.";
    return new OrdersError(message, status, requestId);
}
async function readJson(response: Response): Promise<ApiData> {
    const reader = response.body?.getReader();
    if (!reader)
        throw new OrdersError("The server returned an unreadable response.");
    const decoder = new TextDecoder();
    let text = "";
    let size = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            size += value.byteLength;
            if (size > MAX_BYTES)
                throw new OrdersError("The order response is too large. Ask the administrator to enable server pagination.");
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        let data: unknown;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new OrdersError("The server returned an unreadable response.");
        }
        if (!isObject(data))
            throw new OrdersError("The server returned an unexpected response.");
        // Error bodies, provider diagnostics and arbitrary metadata never reach UI/logs.
        return { ok: data.ok, items: data.items, request_id: safeReference(data.request_id) };
    }
    finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
async function requestApi(init: RequestInit, signal: AbortSignal): Promise<ApiData> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted)
        abort();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, TIMEOUT_MS);
    try {
        const response = await fetch(API_ROUTE, {
            ...init, cache: "no-store", credentials: "include", signal: controller.signal,
            headers: { Accept: "application/json", ...(init.method === "PATCH" ? { "Content-Type": "application/json" } : {}) },
        });
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => undefined);
            throw requestError(response.status);
        }
        const data = await readJson(response);
        if (!response.ok || data.ok !== true)
            throw requestError(response.status, safeReference(data.request_id));
        return data;
    }
    catch (caught) {
        if (timedOut && !signal.aborted)
            throw new OrdersError("The request timed out. Refresh and check the current order.");
        if (caught instanceof OrdersError)
            throw caught;
        throw new OrdersError("Unable to connect. Check your connection and refresh before continuing.");
    }
    finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
    }
}
function parseTickets(value: unknown): TicketRecord[] | undefined {
    if (value == null)
        return undefined;
    if (!Array.isArray(value) || value.length > 10000)
        throw new OrdersError("Invalid ticket records were returned.");
    const ids = new Set<string>();
    return value.map(item => {
        if (!isObject(item) || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            typeof item.ticket_number !== "string" || !item.ticket_number || typeof item.status !== "string" ||
            (item.issued_at != null && typeof item.issued_at !== "string"))
            throw new OrdersError("Invalid ticket records were returned.");
        ids.add(item.id);
        return { id: item.id, ticket_number: item.ticket_number, status: item.status, issued_at: item.issued_at as string | null | undefined };
    });
}
function parseTimeline(value: unknown): TimelineRecord[] | undefined {
    if (value == null)
        return undefined;
    if (!Array.isArray(value) || value.length > 1000)
        throw new OrdersError("Invalid order history was returned.");
    const ids = new Set<string>();
    return value.map(item => {
        if (!isObject(item) || typeof item.id !== "string" || !item.id || ids.has(item.id))
            throw new OrdersError("Invalid order history was returned.");
        ids.add(item.id);
        const record: TimelineRecord = { id: item.id };
        for (const key of ["label", "status", "created_at"] as const) {
            if (item[key] != null && typeof item[key] !== "string")
                throw new OrdersError("Invalid order history was returned.");
            record[key] = item[key] as string | null | undefined;
        }
        return record;
    });
}
function parseOrders(value: unknown): OrderRecord[] {
    if (!Array.isArray(value))
        throw new OrdersError("The server did not return an order list.");
    if (value.length > MAX_ORDERS)
        throw new OrdersError("Too many orders were returned. Ask the administrator to enable server pagination.");
    const ids = new Set<string>();
    return value.map(item => {
        if (!isObject(item) || typeof item.id !== "string" || !item.id || ids.has(item.id) ||
            typeof item.lottery_id !== "string" || !item.lottery_id || typeof item.payment_status !== "string" ||
            !Object.prototype.hasOwnProperty.call(STATUS_LABELS, item.payment_status))
            throw new OrdersError("Invalid or duplicate order records were returned.");
        ids.add(item.id);
        const order: OrderRecord = { id: item.id, lottery_id: item.lottery_id, payment_status: item.payment_status as PaymentStatus };
        for (const key of ["order_reference", "lottery_title", "lottery_slug", "purchaser_name", "purchaser_email", "purchaser_phone", "currency",
            "payment_reference", "terms_version", "privacy_notice_version", "created_at", "updated_at", "paid_at"] as const) {
            if (item[key] != null && typeof item[key] !== "string")
                throw new OrdersError("Invalid order fields were returned.");
            order[key] = item[key] as string | null | undefined;
        }
        for (const key of ["quantity", "total_amount", "ticket_count", "active_ticket_count", "winner_count", "refunded_amount"] as const) {
            const n = item[key];
            if (n != null && (typeof n !== "number" || !Number.isFinite(n) || n < 0 ||
                (key !== "total_amount" && key !== "refunded_amount" && !Number.isSafeInteger(n))))
                throw new OrdersError("Invalid order figures were returned.");
            order[key] = n as number | null | undefined;
        }
        for (const key of ["eligibility_accepted", "marketing_opt_in"] as const) {
            if (item[key] != null && typeof item[key] !== "boolean")
                throw new OrdersError("Invalid declarations were returned.");
            order[key] = item[key] as boolean | null | undefined;
        }
        order.tickets = parseTickets(item.tickets);
        order.acceptances = parseTimeline(item.acceptances);
        order.refunds = parseTimeline(item.refunds);
        order.notifications = parseTimeline(item.notifications);
        return order;
    });
}
async function fetchOrders(signal: AbortSignal) { return parseOrders((await requestApi({ method: "GET" }, signal)).items); }
function formatMoney(value?: number | null, currency?: string | null) {
    if (typeof value !== "number" || !Number.isFinite(value) || !currency || !/^[A-Z]{3}$/.test(currency))
        return "Unavailable";
    try {
        return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
    }
    catch {
        return "Unavailable";
    }
}
function formatDate(value?: string | null) {
    if (!value)
        return "Not recorded";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Invalid date" : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
    }).format(date);
}
function count(value?: number | null) { return value == null ? "Unavailable" : String(value); }
function declaration(value?: boolean | null) { return value === true ? "Recorded yes" : value === false ? "Recorded no" : "Unavailable"; }
function missingTickets(order: OrderRecord): number | null {
    // Do not infer completeness from active counts: refunded/void tickets must not
    // be replaced automatically. Require a complete, consistently counted list.
    if (!Number.isSafeInteger(order.quantity) || !order.quantity || !Array.isArray(order.tickets) ||
        order.ticket_count == null || order.ticket_count !== order.tickets.length ||
        order.tickets.some(ticket => ticket.status !== "issued") || order.ticket_count > order.quantity)
        return null;
    return order.quantity - order.ticket_count;
}
function canMarkPaid(order: OrderRecord) {
    return order.payment_status === "pending" && Number.isSafeInteger(order.quantity) &&
        (order.quantity ?? 0) > 0 && order.refunded_amount === 0 &&
        order.ticket_count === 0 && Array.isArray(order.tickets) && order.tickets.length === 0;
}
function canIssue(order: OrderRecord) {
    return order.payment_status === "paid" && order.refunded_amount === 0 && (missingTickets(order) ?? 0) > 0;
}
function verifiedMutation(before: OrderRecord, after: OrderRecord, action: MutationAction, changes?: Draft) {
    if (before.id !== after.id || before.lottery_id !== after.lottery_id)
        return false;
    if (action === "edit_order")
        return !!changes && after.purchaser_name === changes.purchaser_name &&
            after.purchaser_email === changes.purchaser_email && (after.purchaser_phone || "") === changes.purchaser_phone;
    if (after.payment_status !== "paid" || after.quantity !== before.quantity || after.total_amount !== before.total_amount || after.currency !== before.currency || after.refunded_amount !== 0 || !Number.isSafeInteger(after.quantity) || !after.quantity ||
        !Array.isArray(after.tickets) || after.ticket_count !== after.quantity || after.tickets.length !== after.quantity ||
        after.tickets.some(ticket => ticket.status !== "issued") || new Set(after.tickets.map(ticket => ticket.ticket_number)).size !== after.quantity)
        return false;
    const oldTickets = before.tickets;
    if (!Array.isArray(oldTickets))
        return false;
    return oldTickets.every(ticket => after.tickets!.some(saved => saved.id === ticket.id && saved.ticket_number === ticket.ticket_number && saved.status === ticket.status));
}
// Native modal semantics supply focus isolation. No browser confirm/alert, and
// no background dismissal during a request whose server outcome is uncertain.
function Modal({ title, children, onClose, busy = false }: {
    title: string;
    children: ReactNode;
    onClose: () => void;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const titleId = useId();
    useEffect(() => {
        const dialog = ref.current;
        if (!dialog)
            return;
        const previous = document.activeElement;
        const overflow = document.body.style.overflow;
        dialog.showModal();
        document.body.style.overflow = "hidden";
        return () => { dialog.close(); document.body.style.overflow = overflow; if (previous instanceof HTMLElement && previous.isConnected)
            previous.focus(); };
    }, []);
    return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); if (!busy)
        onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-3xl border border-white/15 bg-[#15172a] p-0 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm">
    <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-white/10 bg-[#15172a] p-5">
      <h2 id={titleId} className="text-xl font-extrabold">{title}</h2><button type="button" autoFocus onClick={onClose} disabled={busy} aria-label="Close dialog" className={BUTTON}><X className="h-4 w-4"/></button>
    </div><div className="p-5 sm:p-6">{children}</div>
  </dialog>;
}
function Info({ label, value }: {
    label: string;
    value: ReactNode;
}) {
    return <div className="rounded-xl border border-white/10 bg-white/5 p-3"><div className="text-xs font-bold text-white/65">{label}</div><div className="mt-1 break-words text-sm text-white/85">{value == null || value === "" ? "Not recorded" : value}</div></div>;
}
function StatCard({ label, value, icon }: {
    label: string;
    value: string;
    icon: ReactNode;
}) {
    return <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-white/65">{label}</span>{icon}</div><p className="mt-2 text-xl font-extrabold text-white">{value}</p></div>;
}
// Preserve native selects from the supplied screen: popup geometry and keyboard
// interaction remain browser-owned. No shared Select primitive was supplied.
function Select({ label, value, onChange, children }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: ReactNode;
}) {
    return <label className="block text-xs font-bold text-white/75">{label}<select value={value} onChange={event => onChange(event.target.value)} className={`${INPUT} bg-[#15172a]`}>{children}</select></label>;
}
function HistoryList({ title, records }: {
    title: string;
    records?: TimelineRecord[] | null;
}) {
    const [limit, setLimit] = useState(25);
    return <section className="mt-6"><h3 className="text-lg font-bold">{title}</h3>{!records ? <p className="mt-2 text-sm text-white/65">Unavailable</p> : !records.length ? <p className="mt-2 text-sm text-white/65">No records returned.</p> : <>
    <ul className="mt-3 space-y-2">{records.slice(0, limit).map(record => <li key={record.id} className="rounded-xl border border-white/10 p-3 text-sm"><p className="font-bold">{record.label || "Unlabelled record"}</p><p className="mt-1 text-white/65">{record.status || "Status unavailable"} • {formatDate(record.created_at)}</p></li>)}</ul>
    {records.length > limit && <button type="button" onClick={() => setLimit(current => current + 25)} className={`${BUTTON} mt-3`}>Show more {title.toLowerCase()}</button>}
  </>}</section>;
}
export type OrderDetailsModalProps = {
    order: OrderRecord;
    onClose: () => void;
    onAction?: (action: MutationAction, order: OrderRecord) => void;
    actionsDisabled?: boolean;
    availableActions?: readonly MutationAction[];
};
// Shared by the Orders screen and the legacy TicketsDetailsModal import path.
export function OrderDetailsModal({ order, onClose, onAction, actionsDisabled = false,
    availableActions = ["edit_order", "mark_paid", "issue_missing_tickets"],
}: OrderDetailsModalProps) {
    const canShowAction = (action: MutationAction) => !!onAction && availableActions.includes(action);
    const [ticketPage, setTicketPage] = useState(1);
    const tickets = order.tickets;
    const ticketPages = Math.max(1, Math.ceil((tickets?.length ?? 0) / 25));
    const visibleTicketPage = Math.min(ticketPage, ticketPages);
    useEffect(() => { setTicketPage(1); }, [order.id]);
    return <Modal title={`Order ${order.order_reference || order.id}`} onClose={onClose}>
    <p className="mb-4 font-bold text-purple-200">{order.lottery_title || "Lottery title unavailable"}</p>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <Info label="Purchaser" value={order.purchaser_name}/><Info label="Email" value={order.purchaser_email}/><Info label="Phone" value={order.purchaser_phone}/>
      <Info label="Payment status" value={STATUS_LABELS[order.payment_status]}/><Info label="Order amount" value={formatMoney(order.total_amount, order.currency)}/><Info label="Quantity" value={count(order.quantity)}/>
      <Info label="Payment reference" value={order.payment_reference}/><Info label="Created (London time)" value={formatDate(order.created_at)}/><Info label="Paid at (London time)" value={formatDate(order.paid_at)}/>
      <Info label="Updated (London time)" value={formatDate(order.updated_at)}/><Info label="Refunded amount" value={formatMoney(order.refunded_amount, order.currency)}/><Info label="Winners" value={count(order.winner_count)}/>
      <Info label="Eligibility declaration" value={declaration(order.eligibility_accepted)}/><Info label="Terms version" value={order.terms_version}/><Info label="Privacy version" value={order.privacy_notice_version}/>
      <Info label="Marketing choice" value={declaration(order.marketing_opt_in)}/>
    </div>
    {onAction && availableActions.length > 0 && <div className="mt-5 flex flex-wrap gap-3">
      {canShowAction("edit_order") && <button type="button" disabled={actionsDisabled} onClick={() => { if (!actionsDisabled) onAction("edit_order", order); }} className={BUTTON}><Pencil className="h-4 w-4"/>Edit purchaser details</button>}
      {canShowAction("mark_paid") && <button type="button" disabled={actionsDisabled || !canMarkPaid(order)} onClick={() => { if (!actionsDisabled && canMarkPaid(order)) onAction("mark_paid", order); }} className={BUTTON}><LockKeyhole className="h-4 w-4"/>Mark paid manually</button>}
      {canShowAction("issue_missing_tickets") && <button type="button" disabled={actionsDisabled || !canIssue(order)} onClick={() => { if (!actionsDisabled && canIssue(order)) onAction("issue_missing_tickets", order); }} className={BUTTON}><Ticket className="h-4 w-4"/>Issue missing tickets</button>}
    </div>}
    <p className="mt-3 text-sm text-white/65">Payment corrections require confirmed payment evidence. Ticket recovery requires a complete ticket list and no recorded refund. Use the dedicated winner and refund workflows for those actions.</p>
    <div className="mt-3 flex flex-wrap gap-3"><Link href={`/Admin/LotteryManagement/Winners?lottery=${encodeURIComponent(order.lottery_id)}`} className={BUTTON}>Winner records</Link><Link href={`/Admin/LotteryManagement/AuditLogs?lottery=${encodeURIComponent(order.lottery_id)}`} className={BUTTON}>Audit records</Link></div>
    <section className="mt-6"><h3 className="text-lg font-bold">Tickets</h3>{!tickets ? <p className="mt-2 text-white/65">Unavailable</p> : !tickets.length ? <p className="mt-2 text-white/65">No tickets returned.</p> : <>
      <div className="mt-3 overflow-x-auto rounded-xl border border-white/10"><table className="w-full text-left text-sm"><caption className="sr-only">Tickets for this order</caption><thead><tr className="bg-white/5"><th scope="col" className="p-3">Number</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Issued (London time)</th></tr></thead><tbody>{tickets.slice((visibleTicketPage - 1) * 25, visibleTicketPage * 25).map(ticket => <tr key={ticket.id} className="border-t border-white/10"><td className="p-3 font-mono">{ticket.ticket_number}</td><td className="p-3">{ticket.status}</td><td className="p-3">{formatDate(ticket.issued_at)}</td></tr>)}</tbody></table></div>
      {ticketPages > 1 && <div className="mt-3 flex items-center gap-3"><button type="button" disabled={visibleTicketPage === 1} onClick={() => setTicketPage(visibleTicketPage - 1)} className={BUTTON}>Previous tickets</button><span>Page {visibleTicketPage} of {ticketPages}</span><button type="button" disabled={visibleTicketPage === ticketPages} onClick={() => setTicketPage(visibleTicketPage + 1)} className={BUTTON}>Next tickets</button></div>}
    </>}</section>
    <HistoryList title="Declarations" records={order.acceptances}/><HistoryList title="Refunds" records={order.refunds}/><HistoryList title="Notifications" records={order.notifications}/>
  </Modal>;
}
export default function OrdersClient() {
    const [items, setItems] = useState<OrderRecord[]>([]);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [mutation, setMutation] = useState<Mutation | null>(null);
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(false);
    const [mutationError, setMutationError] = useState<string | null>(null);
    const [uncertain, setUncertain] = useState(false);
    const [search, setSearch] = useState("");
    const [paymentStatus, setPaymentStatus] = useState("all");
    const [lotteryId, setLotteryId] = useState("all");
    const [ticketState, setTicketState] = useState("all");
    const [sort, setSort] = useState("newest");
    const [page, setPage] = useState(1);
    const alive = useRef(false);
    const activeLoad = useRef<AbortController | null>(null);
    const activeMutation = useRef<AbortController | null>(null);
    const loadVersion = useRef(0);
    const busyRef = useRef(false);
    const passwordId = useId();
    const loadOrders = useCallback(async () => {
        if (busyRef.current)
            return;
        activeLoad.current?.abort();
        const controller = new AbortController();
        activeLoad.current = controller;
        const version = ++loadVersion.current;
        const current = () => alive.current && !controller.signal.aborted && version === loadVersion.current;
        setLoading(true);
        setError(null);
        try {
            const records = await fetchOrders(controller.signal);
            if (!current())
                return;
            setItems(records);
            setHasLoaded(true);
            setUncertain(false);
            // A refreshed record replaces any displayed details; missing records close.
            setSelectedId(id => records.some(record => record.id === id) ? id : null);
        }
        catch (caught) {
            if (!current())
                return;
            const safe = caught instanceof OrdersError ? caught : new OrdersError("Unable to load orders. Try again.");
            const ref = safe.requestId ? ` Request reference: ${safe.requestId}.` : "";
            setError(safe.message + ref);
            // Purchaser data is cleared after any failed load; no stale PII remains in a modal.
            setItems([]);
            setHasLoaded(false);
            setSelectedId(null);
            setMutation(null);
            setPassword("");
            setShowPassword(false);
        }
        finally {
            if (current())
                setLoading(false);
        }
    }, []);
    useEffect(() => {
        alive.current = true;
        const filter = new URLSearchParams(window.location.search).get("lottery");
        if (filter)
            setLotteryId(filter);
        void loadOrders();
        return () => { alive.current = false; activeLoad.current?.abort(); activeMutation.current?.abort(); loadVersion.current += 1; };
    }, [loadOrders]);
    useEffect(() => { setPage(1); }, [search, paymentStatus, lotteryId, ticketState, sort]);
    function openMutation(action: MutationAction, order: OrderRecord) {
        if (busyRef.current || loading || uncertain)
            return;
        if (action === "mark_paid" && (!canMarkPaid(order)))
            return;
        if (action === "issue_missing_tickets" && !canIssue(order))
            return;
        setSelectedId(null);
        setMutation({ action, order, draft: {
                purchaser_name: order.purchaser_name || "", purchaser_email: order.purchaser_email || "", purchaser_phone: order.purchaser_phone || "",
            } });
        setPassword("");
        setShowPassword(false);
        setReason("");
        setMutationError(null);
        setNotice(null);
    }
    function closeMutation() {
        if (busyRef.current)
            return;
        setMutation(null);
        setPassword("");
        setShowPassword(false);
        setReason("");
        setMutationError(null);
    }
    async function submitMutation(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!mutation || busyRef.current || uncertain)
            return;
        const { order, action } = mutation;
        if (!password.trim()) {
            setMutationError("Enter the main admin settings password.");
            return;
        }
        if (!reason.trim()) {
            setMutationError("Enter a reason or payment evidence reference. Do not enter bank details or secrets.");
            return;
        }
        const changes: Draft = {
            purchaser_name: mutation.draft.purchaser_name.trim(), purchaser_email: mutation.draft.purchaser_email.trim(), purchaser_phone: mutation.draft.purchaser_phone.trim(),
        };
        if (action === "edit_order") {
            if (!changes.purchaser_name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(changes.purchaser_email)) {
                setMutationError("Enter a purchaser name and valid email address.");
                return;
            }
            if (changes.purchaser_name === (order.purchaser_name || "") && changes.purchaser_email === (order.purchaser_email || "") && changes.purchaser_phone === (order.purchaser_phone || "")) {
                setMutationError("No purchaser details have changed.");
                return;
            }
        }
        if (action === "mark_paid" && (!canMarkPaid(order))) {
            setMutationError("Refresh and review this order before confirming payment.");
            return;
        }
        if (action === "issue_missing_tickets" && !canIssue(order)) {
            setMutationError("Ticket recovery is not available for this order. Review its payment, refunds and ticket records.");
            return;
        }
        busyRef.current = true;
        setBusy(true);
        setMutationError(null);
        setNotice(null);
        activeLoad.current?.abort();
        loadVersion.current += 1;
        const controller = new AbortController();
        activeMutation.current = controller;
        let submitted = false;
        try {
            // Preserve the existing Orders PATCH action contract. The server must verify
            // this credential, action-specific permission, recent MFA, reason, current
            // state and mandatory audit transaction. A client password check proves none
            // of those controls, so there is no separate delete-password API request.
            const body = JSON.stringify({ action, order_id: order.id, main_admin_password: password, reason: reason.trim(),
                ...(action === "edit_order" ? { changes: { ...changes, purchaser_phone: changes.purchaser_phone || null } } : {}),
            });
            setPassword("");
            setShowPassword(false);
            submitted = true;
            await requestApi({ method: "PATCH", body }, controller.signal);
            if (!alive.current || controller.signal.aborted)
                return;
            const records = await fetchOrders(controller.signal);
            if (!alive.current || controller.signal.aborted)
                return;
            const saved = records.find(record => record.id === order.id);
            setItems(records);
            setHasLoaded(true);
            if (!saved || !verifiedMutation(order, saved, action, changes))
                throw new OrdersError("The updated order could not be verified.");
            setMutation(null);
            setReason("");
            setUncertain(false);
            setNotice(action === "edit_order" ? "Purchaser details saved and verified." : action === "mark_paid" ?
                "Paid status and ticket records verified. Check notification records for delivery." :
                "Ticket records verified. Existing ticket numbers were preserved. Check notification records for delivery.");
        }
        catch (caught) {
            if (!alive.current || controller.signal.aborted)
                return;
            const safe = caught instanceof OrdersError ? caught : new OrdersError("The action could not be verified.");
            setUncertain(submitted);
            setPassword("");
            setShowPassword(false);
            const message = safe.message + (safe.requestId ? ` Request reference: ${safe.requestId}.` : "") +
                (submitted ? " The action may have completed. Close this dialog, refresh and check the stored order before retrying." : "");
            if (safe.status === 401 || safe.status === 403) {
                setItems([]);
                setHasLoaded(false);
                setMutation(null);
                setSelectedId(null);
                setError(message);
            }
            else
                setMutationError(message);
        }
        finally {
            if (alive.current && !controller.signal.aborted) {
                busyRef.current = false;
                setBusy(false);
                setLoading(false);
            }
        }
    }
    const lotteries = useMemo(() => Array.from(new Map(items.map(item => [item.lottery_id, item.lottery_title || item.lottery_id])).entries())
        .sort((a, b) => a[1].localeCompare(b[1])), [items]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const records = items.filter(item => {
            const texts = [item.order_reference, item.id, item.purchaser_name, item.purchaser_email, item.payment_reference, item.lottery_title,
                ...(item.tickets?.map(ticket => ticket.ticket_number) ?? [])];
            return (!q || texts.some(text => text?.toLowerCase().includes(q))) &&
                (paymentStatus === "all" || item.payment_status === paymentStatus) && (lotteryId === "all" || item.lottery_id === lotteryId) &&
                (ticketState === "all" || (ticketState === "issued" && (item.active_ticket_count ?? 0) > 0) ||
                    (ticketState === "none" && item.ticket_count === 0) || (ticketState === "winner" && (item.winner_count ?? 0) > 0));
        });
        const timestamp = (value?: string | null) => { const n = value ? new Date(value).getTime() : NaN; return Number.isFinite(n) ? n : 0; };
        return records.sort((a, b) => {
            if (sort === "oldest")
                return timestamp(a.created_at) - timestamp(b.created_at);
            if (sort === "amount_high")
                return (b.total_amount ?? -1) - (a.total_amount ?? -1);
            if (sort === "amount_low")
                return (a.total_amount ?? Infinity) - (b.total_amount ?? Infinity);
            if (sort === "tickets_high")
                return (b.ticket_count ?? -1) - (a.ticket_count ?? -1);
            return timestamp(b.created_at) - timestamp(a.created_at);
        });
    }, [items, search, paymentStatus, lotteryId, ticketState, sort]);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visiblePage = Math.min(page, pageCount);
    const visible = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
    const paid = items.filter(order => order.payment_status === "paid");
    const currencies = new Set(paid.map(order => order.currency));
    const paidAmount = paid.length === 0 ? "No paid orders loaded" : currencies.size !== 1 ? "Multiple / missing currencies" :
        paid.some(order => order.total_amount == null) ? "Unavailable" : formatMoney(paid.reduce((sum, order) => sum + order.total_amount!, 0), paid[0].currency);
    const ticketsTotal = items.some(order => order.ticket_count == null) ? "Unavailable" : String(items.reduce((sum, order) => sum + order.ticket_count!, 0));
    const problems = items.filter(order => ["failed", "disputed", "partially_refunded"].includes(order.payment_status)).length;
    const selected = items.find(order => order.id === selectedId);
    const unavailable = !hasLoaded || loading;
    const mutationTitle = mutation?.action === "edit_order" ? "Edit purchaser details" : mutation?.action === "mark_paid" ? "Mark order paid manually" : "Issue missing tickets";
    return <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
    <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-start gap-3"><ReceiptText className="mt-1 h-6 w-6 shrink-0 text-white"/><div><h1 className="text-2xl font-extrabold text-white">Orders & Entries</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-white/65">Review purchasers, payments, tickets, declarations, notifications and refunds.</p></div></div>
      <button type="button" onClick={() => void loadOrders()} disabled={loading || busy} className={BUTTON}><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`}/>Refresh</button>
    </div></section>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Loaded orders" value={unavailable ? "Unavailable" : String(items.length)} icon={<ReceiptText className="h-5 w-5"/>}/>
      <StatCard label="Paid orders (loaded)" value={unavailable ? "Unavailable" : String(paid.length)} icon={<CheckCircle2 className="h-5 w-5"/>}/>
      <StatCard label="Paid order amount (loaded)" value={unavailable ? "Unavailable" : paidAmount} icon={<PoundSterling className="h-5 w-5"/>}/>
      <StatCard label="Recorded tickets (loaded)" value={unavailable ? "Unavailable" : ticketsTotal} icon={<Ticket className="h-5 w-5"/>}/>
      <StatCard label="Needs attention (loaded)" value={unavailable ? "Unavailable" : String(problems)} icon={<AlertTriangle className="h-5 w-5"/>}/>
    </section>
    <p className="text-sm text-white/65">Figures describe the returned orders, not a reconciled financial ledger. This client displays 25 orders per page and accepts at most {MAX_ORDERS.toLocaleString("en-GB")} orders per response; server pagination is still required for larger registers.</p>
    {notice && <div role="status" className="flex items-start justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-sm text-emerald-100"><span>{notice}</span><button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message" className={BUTTON}><X className="h-4 w-4"/></button></div>}
    {error && <div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>}
    {uncertain && <div role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">The previous action could not be verified. Refresh and check its stored result before trying another action.</div>}
    <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-white"><Filter className="h-4 w-4"/>Search & filters</h2>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label className="block text-xs font-bold text-white/75 xl:col-span-2">Search orders<div className="relative"><Search className="pointer-events-none absolute left-4 top-1/2 mt-1 h-4 w-4 -translate-y-1/2 text-white/65"/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Name, email, order, ticket or payment reference" className={`${INPUT} pl-11 pr-12`}/>{search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 rounded-lg p-1 text-white focus-visible:ring-2 focus-visible:ring-purple-300"><X className="h-4 w-4"/></button>}</div></label>
        <Select label="Payment status" value={paymentStatus} onChange={setPaymentStatus}><option value="all">All payment statuses</option>{Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</Select>
        <Select label="Lottery" value={lotteryId} onChange={setLotteryId}><option value="all">All lotteries</option>{lotteryId !== "all" && !lotteries.some(([id]) => id === lotteryId) && <option value={lotteryId}>Selected lottery (not in loaded records)</option>}{lotteries.map(([id, title]) => <option key={id} value={id}>{title}</option>)}</Select>
        <Select label="Ticket state" value={ticketState} onChange={setTicketState}><option value="all">All ticket states</option><option value="issued">Has issued tickets</option><option value="none">No tickets recorded</option><option value="winner">Winner orders</option></Select>
      </div>
      <div className="mt-3 max-w-sm"><Select label="Sort orders" value={sort} onChange={setSort}><option value="newest">Newest orders</option><option value="oldest">Oldest orders</option><option value="amount_high">Highest amount</option><option value="amount_low">Lowest amount</option><option value="tickets_high">Most tickets</option></Select></div>
    </section>
    <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <h2 className="text-lg font-bold text-white">Order register</h2><p className="mt-1 text-sm text-white/65">{hasLoaded ? `${filtered.length} matching orders from ${items.length} loaded` : "Orders unavailable"}</p>
      {loading ? <div role="status" className="flex min-h-52 items-center justify-center text-white/65"><Loader2 className="mr-2 h-5 w-5 animate-spin motion-reduce:animate-none"/>Loading orders…</div> : !hasLoaded ? <p className="mt-5 text-sm text-white/65">Use Refresh to try loading orders again.</p> : !filtered.length ? <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-8 text-center text-white"><h3 className="font-bold">{items.length ? "No matching orders" : "No orders returned"}</h3><p className="mt-2 text-sm text-white/65">{items.length ? "Change the filters or clear the search." : "The server returned an empty order list."}</p></div> : <>
        <div className="mt-5 space-y-4">{visible.map(order => <article key={order.id} className="rounded-2xl border border-white/10 bg-black/20 p-5">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="break-words font-extrabold text-white">{order.order_reference || order.id}</h3><span className={`rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_CLASSES[order.payment_status]}`}>{STATUS_LABELS[order.payment_status]}</span>{(order.winner_count ?? 0) > 0 && <span className="inline-flex items-center gap-1 text-sm font-bold text-yellow-200"><Trophy className="h-4 w-4"/>Winner</span>}</div>
            <p className="mt-2 text-sm font-semibold text-white/75">{order.lottery_title || "Lottery title unavailable"}</p><div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><Info label="Purchaser" value={order.purchaser_name}/><Info label="Email" value={order.purchaser_email}/><Info label="Amount" value={formatMoney(order.total_amount, order.currency)}/><Info label="Tickets recorded" value={count(order.ticket_count)}/><Info label="Ordered (London time)" value={formatDate(order.created_at)}/></div>
          </div><button type="button" disabled={loading || busy} onClick={() => setSelectedId(order.id)} className={BUTTON}><Eye className="h-4 w-4"/>View order</button></div>
        </article>)}</div>
        <nav aria-label="Order pages" className="mt-5 flex flex-wrap items-center gap-3"><button type="button" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)} className={BUTTON}>Previous orders</button><span className="text-sm text-white/75" aria-live="polite">Page {visiblePage} of {pageCount}</span><button type="button" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)} className={BUTTON}>Next orders</button></nav>
      </>}
    </section>
    {selected && !loading && <OrderDetailsModal key={selected.id} order={selected} onClose={() => setSelectedId(null)} onAction={openMutation} actionsDisabled={busy || uncertain}/>}
    {mutation && <Modal title={`${mutationTitle}: ${mutation.order.order_reference || mutation.order.id}`} busy={busy} onClose={closeMutation}>
      <form noValidate onSubmit={submitMutation}>
        <p className="mb-5 text-sm leading-6 text-white/75">{mutation.action === "edit_order" ? "Correct the purchaser contact details. Declarations, marketing consent, payment and tickets are managed separately." : mutation.action === "mark_paid" ? "Use only after confirming payment evidence. This requests paid status, ticket allocation and notification work. Check the stored result before repeating the action." : `Request recovery of ${missingTickets(mutation.order) ?? "unverified"} missing ticket(s). This must preserve all existing numbers and cannot be used to replace refunded or void tickets.`}</p>
        <fieldset disabled={busy || uncertain} className="min-w-0 border-0 p-0">
          {mutation.action === "edit_order" && <div className="mb-5 grid gap-4 sm:grid-cols-2">{([["purchaser_name", "Purchaser name", "text"], ["purchaser_email", "Purchaser email", "email"], ["purchaser_phone", "Purchaser phone", "tel"]] as const).map(([key, label, type]) => <label key={key} className="block text-sm font-bold text-white/85">{label}<input type={type} value={mutation.draft[key]} onChange={event => setMutation(current => current ? { ...current, draft: { ...current.draft, [key]: event.target.value } } : current)} className={INPUT}/></label>)}</div>}
          <label className="mb-5 block text-sm font-bold text-white/85">Reason / payment evidence reference<input value={reason} maxLength={1000} onChange={event => setReason(event.target.value)} className={INPUT}/><span className="mt-2 block text-xs font-normal text-white/65">Use a case or payment reference. Do not include bank details, passwords or other secrets.</span></label>
          <label htmlFor={passwordId} className="block text-sm font-bold text-white/85">Main admin settings password</label><div className="relative"><input id={passwordId} type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" spellCheck={false} className={`${INPUT} pr-14`}/><button type="button" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} className="absolute right-3 top-1/2 mt-1 -translate-y-1/2 rounded-lg p-2 text-white focus-visible:ring-2 focus-visible:ring-purple-300">{showPassword ? <EyeOff className="h-4 w-4"/> : <Eye className="h-4 w-4"/>}</button></div>
        </fieldset>
        {mutationError && <p role="alert" className="mt-5 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">{mutationError}</p>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" onClick={closeMutation} disabled={busy} className={BUTTON}>{uncertain ? "Close and review" : "Cancel"}</button><button type="submit" disabled={busy || uncertain || !password.trim() || !reason.trim()} className={`${BUTTON} bg-purple-500 hover:bg-purple-400`}>{busy ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/> : <Save className="h-4 w-4"/>}{mutationTitle}</button></div>
      </form>
    </Modal>}
  </div>;
}
