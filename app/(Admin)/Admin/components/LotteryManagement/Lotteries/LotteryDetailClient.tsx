"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, CircleDollarSign, ClipboardCheck, ExternalLink, FileText, Gift, History, Loader2, Pencil, RefreshCw, ShieldCheck, Ticket, Trophy, Users, WalletCards, } from "lucide-react";
import type { LotteryDetail, LotteryStatus } from "@/lib/lottery/lottery-detail-types";
type Props = {
    slug: string;
};
// Add the canonical field locally until the shared type is migrated. Never read
// show_in_directory as a fallback: an old true must not override a new false.
type Detail = LotteryDetail & {
    show_in_public_directory?: boolean | null;
};
type ApiObject = {
    ok?: unknown;
    item?: unknown;
    items?: unknown;
    request_id?: unknown;
};
type PageError = {
    message: string;
    requestId?: string;
    status?: number;
};
const LOTTERY_API = "/api/admin/lotterymanagement/lottery";
const REQUEST_TIMEOUT_MS = 20000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;
const STATUS_LABELS: Record<LotteryStatus, string> = {
    draft: "Draft", compliance_review: "Compliance review", scheduled: "Scheduled",
    live: "Live", sales_closed: "Sales closed", draw_ready: "Draw ready",
    completed: "Completed", archived: "Archived", paused: "Paused",
    cancelled: "Cancelled", under_review: "Under review",
};
const STATUS_CLASSES: Record<LotteryStatus, string> = {
    draft: "border-white/15 bg-white/10 text-white/75",
    compliance_review: "border-amber-400/30 bg-amber-500/10 text-amber-200",
    scheduled: "border-blue-400/30 bg-blue-500/10 text-blue-200",
    live: "border-emerald-400/30 bg-emerald-500/10 text-emerald-200",
    sales_closed: "border-orange-400/30 bg-orange-500/10 text-orange-200",
    draw_ready: "border-purple-400/30 bg-purple-500/10 text-purple-200",
    completed: "border-cyan-400/30 bg-cyan-500/10 text-cyan-200",
    archived: "border-white/10 bg-black/20 text-white/50",
    paused: "border-yellow-400/30 bg-yellow-500/10 text-yellow-100",
    cancelled: "border-red-400/30 bg-red-500/10 text-red-200",
    under_review: "border-rose-400/30 bg-rose-500/10 text-rose-200",
};
class LotteryRequestError extends Error {
    constructor(message: string, public status?: number, public requestId?: string) {
        super(message);
        this.name = "LotteryRequestError";
    }
}
function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function isIdentity(value: unknown): value is Record<string, unknown> & {
    id: string;
    slug: string;
} {
    return isObject(value) && typeof value.id === "string" && value.id.length > 0 &&
        typeof value.slug === "string" && value.slug.length > 0;
}
function isDetail(value: unknown): value is Detail {
    if (!isIdentity(value) || !isObject(value))
        return false;
    const stringFields = ["short_summary", "internal_reference", "lottery_type", "currency", "timezone",
        "publication_at", "sales_open_at", "sales_close_at", "draw_at", "results_publish_at",
        "description", "fundraising_purpose", "promoting_society_legal_name", "registration_licence_type",
        "registration_licence_number", "licensing_authority", "responsible_promoter_name",
        "geographic_eligibility", "terms_version", "privacy_notice_version", "created_at", "updated_at"];
    const numberFields = ["ticket_price", "max_tickets", "minimum_age", "order_count", "paid_order_count",
        "ticket_count", "revenue", "prize_count", "winner_count", "refund_total"];
    const booleanFields = ["show_in_public_directory", "allow_page_before_sales", "show_ticket_count",
        "show_amount_raised", "show_remaining_tickets", "show_prize_values", "countdown_enabled"];
    return typeof value.title === "string" && typeof value.status === "string" &&
        Object.prototype.hasOwnProperty.call(STATUS_LABELS, value.status) &&
        stringFields.every(key => value[key] == null || typeof value[key] === "string") &&
        numberFields.every(key => value[key] == null ||
            (typeof value[key] === "number" && Number.isFinite(value[key]) && value[key] >= 0)) &&
        booleanFields.every(key => value[key] == null || typeof value[key] === "boolean") &&
        (value.winner_display_mode == null ||
            ["full_name", "first_name", "ticket_number", "none"].includes(String(value.winner_display_mode)));
}
function safeRequestId(value: unknown) {
    return typeof value === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(value) ? value : undefined;
}
function httpError(status: number, requestId?: string) {
    const message = status === 401 ? "Your session has expired. Sign in again to continue." :
        status === 403 ? "You do not have permission to view this lottery." :
            status === 404 ? "This lottery could not be found. Return to the lottery list." :
                status === 429 ? "Too many requests. Wait a moment before trying again." :
                    "Unable to load the lottery. Try again or return to the lottery list.";
    return new LotteryRequestError(message, status, requestId);
}
async function readApiJson(response: Response): Promise<ApiObject> {
    const reader = response.body?.getReader();
    if (!reader)
        throw new LotteryRequestError("The server returned an unreadable response. Try again.");
    const decoder = new TextDecoder();
    let text = "";
    let bytes = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            bytes += value.byteLength;
            if (bytes > MAX_RESPONSE_BYTES)
                throw new LotteryRequestError("The response is too large to display safely. Contact the administrator.");
            text += decoder.decode(value, { stream: true });
        }
        text += decoder.decode();
        let data: unknown;
        try {
            data = JSON.parse(text);
        }
        catch {
            throw new LotteryRequestError("The server returned an unreadable response. Try again.");
        }
        if (!isObject(data))
            throw new LotteryRequestError("The server returned an unexpected response. Try again.");
        return data;
    }
    finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
    }
}
async function fetchApi(url: string, signal: AbortSignal) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted)
        abort();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, REQUEST_TIMEOUT_MS);
    try {
        const response = await fetch(url, {
            method: "GET", credentials: "include", cache: "no-store",
            headers: { Accept: "application/json" }, signal: controller.signal,
        });
        // Authentication failures remain recognisable even if an upstream proxy
        // returns HTML instead of the expected JSON. Never echo its body.
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => undefined);
            throw httpError(response.status);
        }
        const data = await readApiJson(response);
        if (!response.ok || data.ok !== true)
            throw httpError(response.status, safeRequestId(data.request_id));
        return data;
    }
    catch (caught) {
        if (timedOut && !signal.aborted)
            throw new LotteryRequestError("The request timed out. Try again.");
        if (caught instanceof LotteryRequestError)
            throw caught;
        throw new LotteryRequestError("Unable to connect. Check your connection and try again.");
    }
    finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
    }
}
async function resolveLotteryIdFromSlug(slug: string, signal: AbortSignal): Promise<string> {
    const data = await fetchApi(`${LOTTERY_API}?slug=${encodeURIComponent(slug)}`, signal);
    const candidates: unknown[] = [];
    if (data.item != null)
        candidates.push(data.item);
    if (data.items != null) {
        if (!Array.isArray(data.items))
            throw new LotteryRequestError("The lottery lookup returned an unexpected response.");
        candidates.push(...data.items);
    }
    const ids = new Set(candidates.filter(isIdentity).filter(item => item.slug === slug).map(item => item.id));
    if (ids.size === 0)
        throw new LotteryRequestError("No matching lottery was returned. Return to the lottery list. The server must support an exact slug lookup.");
    if (ids.size !== 1)
        throw new LotteryRequestError("The lottery slug is not unique. Contact the administrator before continuing.");
    return [...ids][0];
}
function displayTimezone(value?: string | null) {
    if (value) {
        try {
            new Intl.DateTimeFormat("en-GB", { timeZone: value }).format();
            return value;
        }
        catch { /* invalid setting */ }
    }
    return "Europe/London";
}
function formatDate(value?: string | null, timezone = "Europe/London") {
    if (value == null || value === "")
        return "Not set";
    const date = new Date(value);
    if (Number.isNaN(date.getTime()))
        return "Invalid date";
    return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium", timeStyle: "short", timeZone: displayTimezone(timezone),
    }).format(date);
}
function formatMoney(value?: number | null, currency?: string | null) {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || !currency || !/^[A-Z]{3}$/.test(currency))
        return "Unavailable";
    try {
        return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value);
    }
    catch {
        return "Unavailable";
    }
}
function formatCount(value?: number | null) {
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
        ? new Intl.NumberFormat("en-GB").format(value) : "Unavailable";
}
function flagLabel(value: unknown) {
    return value === true ? "Enabled" : value === false ? "Disabled" : "Unavailable";
}
function Card({ children, className = "" }: {
    children: ReactNode;
    className?: string;
}) {
    return <section className={`rounded-3xl border border-white/10 bg-white/[0.04] p-5 shadow-xl backdrop-blur-xl sm:p-6 ${className}`}>{children}</section>;
}
function StatCard({ label, value, icon: Icon }: {
    label: string;
    value: string | number;
    icon: ComponentType<{
        className?: string;
    }>;
}) {
    return <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-white/60">{label}</p>
        <p className="mt-2 text-xl font-black text-white">{value}</p></div>
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-300"><Icon className="h-4.5 w-4.5"/></div>
    </div>
  </div>;
}
function InfoRow({ label, value }: {
    label: string;
    value: ReactNode;
}) {
    return <div className="grid gap-1 border-b border-white/10 py-3 last:border-b-0 sm:grid-cols-[220px_1fr] sm:gap-5">
    <div className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{label}</div>
    <div className="break-words text-sm text-white/75">{value == null || value === "" ? "Not set" : value}</div>
  </div>;
}
const ACTION_CLASS = "inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 disabled:cursor-not-allowed disabled:opacity-50";
export default function LotteryDetailClient({ slug }: Props) {
    const [lottery, setLottery] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<PageError | null>(null);
    const activeRequest = useRef<AbortController | null>(null);
    const requestVersion = useRef(0);
    const loadLottery = useCallback(async (refresh = false) => {
        activeRequest.current?.abort();
        const controller = new AbortController();
        activeRequest.current = controller;
        const version = ++requestVersion.current;
        const current = () => !controller.signal.aborted && version === requestVersion.current;
        if (refresh)
            setRefreshing(true);
        else {
            setLoading(true);
            setRefreshing(false);
            setLottery(null);
        }
        setError(null);
        try {
            if (!slug.trim())
                throw new LotteryRequestError("No lottery slug was supplied. Return to the lottery list.");
            const lotteryId = await resolveLotteryIdFromSlug(slug, controller.signal);
            if (!current())
                return;
            const data = await fetchApi(`${LOTTERY_API}/${encodeURIComponent(lotteryId)}`, controller.signal);
            if (!current())
                return;
            if (!isDetail(data.item) || data.item.id !== lotteryId || data.item.slug !== slug)
                throw new LotteryRequestError("The returned lottery did not match this page or contains invalid data. Try again.");
            setLottery(data.item);
        }
        catch (caught) {
            if (!current())
                return;
            const safe = caught instanceof LotteryRequestError ? caught : new LotteryRequestError("Unable to load the lottery. Try again.");
            if (!refresh || safe.status === 401 || safe.status === 403)
                setLottery(null);
            setError({ message: safe.message, status: safe.status, requestId: safe.requestId });
        }
        finally {
            if (current()) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [slug]);
    useEffect(() => {
        void loadLottery(false);
        return () => { activeRequest.current?.abort(); requestVersion.current += 1; };
    }, [loadLottery]);
    // Prevent even a single render of a previous lottery when the route changes.
    if (loading || (lottery && lottery.slug !== slug))
        return (<div className="flex min-h-[55vh] w-full items-center justify-center" role="status" aria-live="polite">
      <div className="flex items-center gap-3 text-white/60"><Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none"/><span className="font-bold">Loading lottery…</span></div>
    </div>);
    if (!lottery)
        return (<div className="w-full px-4 py-8 sm:px-6 lg:px-8"><div className="mx-auto max-w-4xl"><Card>
      <div className="flex items-start gap-4" role="alert">
        <div className="rounded-2xl bg-red-500/10 p-3 text-red-300"><AlertTriangle className="h-5 w-5"/></div>
        <div className="flex-1"><h1 className="text-xl font-black text-white">Lottery could not be loaded</h1>
          <p className="mt-2 text-sm leading-6 text-white/65">{error?.message ?? "Lottery not found."}</p>
          {error?.requestId && <p className="mt-2 break-words text-xs text-white/60">Request reference: {error.requestId}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/Admin/LotteryManagement/Lotteries" className={ACTION_CLASS}><ArrowLeft className="h-4 w-4"/>Back to lotteries</Link>
            <button type="button" onClick={() => void loadLottery(false)} className={ACTION_CLASS}><RefreshCw className="h-4 w-4"/>Try again</button>
          </div>
        </div>
      </div>
    </Card></div></div>);
    const publicUrl = `/Lottery/${encodeURIComponent(lottery.slug)}`;
    const adminUrl = `/Admin/LotteryManagement/Lotteries/${encodeURIComponent(lottery.slug)}`;
    const lotteryQuery = encodeURIComponent(lottery.id);
    const timezone = displayTimezone(lottery.timezone);
    const date = (value?: string | null) => formatDate(value, timezone);
    const flags: Array<{
        label: string;
        value: boolean | null | undefined;
    }> = [
        { label: "Public directory", value: lottery.show_in_public_directory },
        { label: "Page before sales", value: lottery.allow_page_before_sales },
        { label: "Show ticket count", value: lottery.show_ticket_count },
        { label: "Show amount raised", value: lottery.show_amount_raised },
        { label: "Show remaining tickets", value: lottery.show_remaining_tickets },
        { label: "Show prize values", value: lottery.show_prize_values },
        { label: "Countdown", value: lottery.countdown_enabled },
    ];
    return <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6" aria-busy={refreshing}>
    {error && <div role="alert" className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 text-amber-100">
      <p>{error.message}</p><p className="mt-2 text-sm">The last successfully loaded values remain below. Refresh before relying on them.</p>
      {error.requestId && <p className="mt-2 break-words text-xs">Request reference: {error.requestId}</p>}
    </div>}
    <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-5 shadow-xl backdrop-blur-xl sm:p-6 lg:p-7">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <Link href="/Admin/LotteryManagement/Lotteries" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-purple-300 hover:text-purple-200 focus-visible:ring-2 focus-visible:ring-purple-300"><ArrowLeft className="h-4 w-4"/>Back to lotteries</Link>
          <div className="flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-black tracking-tight text-white sm:text-4xl">{lottery.title}</h1>
            <span className={`rounded-full border px-3 py-1 text-xs font-black ${STATUS_CLASSES[lottery.status]}`}>{STATUS_LABELS[lottery.status]}</span>
          </div>
          <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65 sm:text-base">{lottery.short_summary || "Manage this lottery campaign, its schedule, sales, draw, compliance and public page."}</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-white/60">
            <span className="break-all">Slug: <strong>{lottery.slug}</strong></span>
            <span className="break-all">Reference: <strong>{lottery.internal_reference || "Not set"}</strong></span>
            <span className="break-all">ID: <strong>{lottery.id}</strong></span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => void loadLottery(true)} disabled={refreshing} className={ACTION_CLASS}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none"/> : <RefreshCw className="h-4 w-4"/>}Refresh
          </button>
          <Link href={`${adminUrl}/Edit`} className={ACTION_CLASS}><Pencil className="h-4 w-4"/>Edit lottery</Link>
          {lottery.show_in_public_directory === true && <Link href={publicUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-2xl bg-purple-500 px-4 text-sm font-black text-white transition hover:bg-purple-400 focus-visible:ring-2 focus-visible:ring-purple-300"><ExternalLink className="h-4 w-4"/>Open public page</Link>}
        </div>
      </div>
    </section>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
      <StatCard label="Ticket price" value={formatMoney(lottery.ticket_price, lottery.currency)} icon={CircleDollarSign}/>
      <StatCard label="Orders" value={formatCount(lottery.order_count)} icon={Users}/>
      <StatCard label="Paid orders" value={formatCount(lottery.paid_order_count)} icon={CheckCircle2}/>
      <StatCard label="Tickets issued" value={formatCount(lottery.ticket_count)} icon={WalletCards}/>
      <StatCard label="Revenue" value={formatMoney(lottery.revenue, lottery.currency)} icon={CircleDollarSign}/>
      <StatCard label="Prizes" value={formatCount(lottery.prize_count)} icon={Gift}/>
      <StatCard label="Winners" value={formatCount(lottery.winner_count)} icon={Trophy}/>
      <StatCard label="Refunds" value={formatMoney(lottery.refund_total, lottery.currency)} icon={Archive}/>
    </div>

    {lottery.status === "live" && <div className="rounded-3xl border border-blue-400/20 bg-blue-500/[0.07] p-5">
      <div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-300"/>
        <div><h2 className="font-black text-blue-100">Lottery status: Live</h2>
          <p className="mt-1 text-sm leading-6 text-blue-100/80">The status alone does not confirm compliance approval, public availability or whether sales are open. Check the relevant records before taking action.</p>
        </div>
      </div>
    </div>}

    <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
      <Card><div className="mb-5"><h2 className="text-xl font-black text-white">Lottery information</h2><p className="mt-1 text-sm text-white/60">Core campaign details. All dates below use {timezone}.</p></div>
        <InfoRow label="Lottery type" value={lottery.lottery_type?.replaceAll("_", " ")}/>
        <InfoRow label="Status" value={STATUS_LABELS[lottery.status]}/>
        <InfoRow label="Publication" value={date(lottery.publication_at)}/>
        <InfoRow label="Sales open" value={date(lottery.sales_open_at)}/>
        <InfoRow label="Sales close" value={date(lottery.sales_close_at)}/>
        <InfoRow label="Draw" value={date(lottery.draw_at)}/>
        <InfoRow label="Results publication" value={date(lottery.results_publish_at)}/>
        <InfoRow label="Timezone" value={lottery.timezone === timezone ? timezone : `${timezone} (display fallback; review the configured timezone)`}/>
        <InfoRow label="Maximum tickets" value={lottery.max_tickets == null ? "Not supplied; check the approved profile limit" : formatCount(lottery.max_tickets)}/>
        <InfoRow label="Minimum age" value={lottery.minimum_age == null ? "Unavailable" : `${formatCount(lottery.minimum_age)}+ (configured)`}/>
      </Card>
      <Card><div className="mb-5"><h2 className="text-xl font-black text-white">Quick actions</h2><p className="mt-1 text-sm text-white/60">Open the related records for this campaign.</p></div>
        <div className="grid gap-3">{[
            { label: "Orders & Entries", page: "Orders", icon: Users },
            { label: "Tickets", page: "Tickets", icon: Ticket },
            { label: "Prizes", page: "Prizes", icon: Gift },
            { label: "Draws", page: "Draws", icon: Trophy },
            { label: "Winners", page: "Winners", icon: Trophy },
            { label: "Compliance", page: "Compliance", icon: ShieldCheck },
            { label: "Reports & Exports", page: "Reports", icon: FileText },
            { label: "Audit Logs", page: "AuditLogs", icon: History },
        ].map(({ label, page, icon: Icon }) => <Link key={page} href={`/Admin/LotteryManagement/${page}?lottery=${lotteryQuery}`} className="group flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-purple-500/25 hover:bg-purple-500/[0.07] focus-visible:ring-2 focus-visible:ring-purple-300">
          <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/5 text-purple-300"><Icon className="h-4.5 w-4.5"/></div><span className="text-sm font-black text-white/75 group-hover:text-white">{label}</span></div><ExternalLink className="h-4 w-4 text-white/40 group-hover:text-purple-300"/>
        </Link>)}</div>
      </Card>
    </div>

    <div className="grid gap-6 xl:grid-cols-2">
      <Card><div className="mb-5 flex items-center gap-3"><ClipboardCheck className="h-5 w-5 text-purple-300"/><div><h2 className="text-xl font-black text-white">Description & fundraising purpose</h2><p className="mt-1 text-sm text-white/60">Campaign information shown during management and public-page setup.</p></div></div>
        <div className="space-y-5"><div><div className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Full description</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/70">{lottery.description || "No full description has been added."}</p></div>
          <div><div className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Fundraising purpose</div><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/70">{lottery.fundraising_purpose || "No fundraising purpose has been added."}</p></div></div>
      </Card>
      <Card><div className="mb-5 flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-purple-300"/><div><h2 className="text-xl font-black text-white">Compliance information</h2><p className="mt-1 text-sm text-white/60">Stored information does not confirm approval. Review the compliance record before publication.</p></div></div>
        <InfoRow label="Promoting society" value={lottery.promoting_society_legal_name}/>
        <InfoRow label="Registration / licence type" value={lottery.registration_licence_type}/>
        <InfoRow label="Registration / licence number" value={lottery.registration_licence_number}/>
        <InfoRow label="Licensing authority" value={lottery.licensing_authority}/>
        <InfoRow label="Responsible promoter" value={lottery.responsible_promoter_name}/>
        <InfoRow label="Geographic eligibility" value={lottery.geographic_eligibility}/>
        <InfoRow label="Terms version" value={lottery.terms_version}/>
        <InfoRow label="Privacy version" value={lottery.privacy_notice_version}/>
      </Card>
    </div>

    <Card><div className="mb-5"><h2 className="text-xl font-black text-white">Public-page settings</h2><p className="mt-1 break-words text-sm text-white/60">Stored settings for {publicUrl}. Public availability also depends on publication rules, approval and dates.</p></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{flags.map(({ label, value }) => <div key={label} className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">{label}</p>
        <p className={`mt-2 text-sm font-black ${value === true ? "text-emerald-300" : "text-white/65"}`}>{flagLabel(value)}</p>
      </div>)}
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4"><p className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">Winner display</p><p className="mt-2 text-sm font-black capitalize text-white/75">{lottery.winner_display_mode?.replaceAll("_", " ") || "Unavailable"}</p><p className="mt-2 text-xs text-white/60">Display preference only; consent and publication requirements still apply.</p></div>
      </div>
    </Card>
    <div className="text-xs text-white/60">Created {date(lottery.created_at)} • Last updated {date(lottery.updated_at)}</div>
    <span role="status" aria-live="polite" className="sr-only">{refreshing ? "Refreshing lottery…" : error ? "Lottery refresh failed." : "Lottery details loaded."}</span>
  </div>;
}
