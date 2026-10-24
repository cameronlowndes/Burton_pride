"use client";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Download, FileArchive, FileSpreadsheet, Filter, Loader2, PoundSterling, Printer, RefreshCw, Search, Ticket, Trophy, UsersRound, WalletCards, X, } from "lucide-react";
type LotteryReport = {
    lottery_id: string;
    lottery_title: string;
    lottery_slug: string;
    lottery_status: string;
    lottery_type: string;
    created_at: string;
    sales_open_at: string | null;
    sales_close_at: string | null;
    draw_at: string | null;
    gross_proceeds: number | null;
    paid_orders: number | null;
    tickets_sold: number | null;
    average_order_value: number | null;
    refunds: number | null;
    payment_fees: number | null;
    net_funds: number | null;
    prize_costs: number | null;
    good_cause_amount: number | null;
    winners: number | null;
    unclaimed_prizes: number | null;
    failed_payments: number | null;
    disputed_payments: number | null;
    compliance_warnings: number | null;
};
type PaperDrawLottery = {
    id: string;
    title: string;
    slug: string;
    status: string;
    draw_at: string | null;
    sales_close_at: string | null;
};
type PaperDrawTicket = {
    id: string;
    ticket_number: string;
    order_reference: string;
    issued_at: string | null;
};
type ExportType = "entrants" | "tickets" | "orders" | "prizes" | "winners" | "audit" | "regulatory" | "archive" | "paper_draw";
const API_ROUTE = "/api/admin/lotterymanagement/reports";
const EXPORT_OPTIONS: Array<{
    type: ExportType;
    title: string;
    description: string;
    icon: React.ReactNode;
}> = [
    {
        type: "entrants",
        title: "Entrants export",
        description: "Entrant/customer records for the selected lottery.",
        icon: <UsersRound className="h-5 w-5"/>,
    },
    {
        type: "tickets",
        title: "Issued ticket register",
        description: "Ticket numbers, status and linked order information.",
        icon: <Ticket className="h-5 w-5"/>,
    },
    {
        type: "paper_draw",
        title: "Paper draw ticket sheets",
        description: "Preview and print the ticket register returned by the server.",
        icon: <Printer className="h-5 w-5"/>,
    },
    {
        type: "orders",
        title: "Orders & payments",
        description: "Orders, payment status, totals and refund information.",
        icon: <WalletCards className="h-5 w-5"/>,
    },
    {
        type: "prizes",
        title: "Prize register",
        description: "Prize values, donors, allocation and fulfilment.",
        icon: <Trophy className="h-5 w-5"/>,
    },
    {
        type: "winners",
        title: "Winner report",
        description: "Winner status, ticket, prize and fulfilment records.",
        icon: <Trophy className="h-5 w-5"/>,
    },
    {
        type: "audit",
        title: "Audit log export",
        description: "Security-sensitive and outcome-changing admin actions.",
        icon: <FileSpreadsheet className="h-5 w-5"/>,
    },
    {
        type: "regulatory",
        title: "Regulatory return data",
        description: "Reported figures to review and reconcile before preparing a return.",
        icon: <FileSpreadsheet className="h-5 w-5"/>,
    },
    {
        type: "archive",
        title: "Full lottery archive pack",
        description: "Server-generated archive for one selected lottery; review contents.",
        icon: <FileArchive className="h-5 w-5"/>,
    },
];
const MAX_REPORTS = 1000;
const MAX_PRINT_TICKETS = 10000;
const PAGE_SIZE = 25;
const JSON_LIMIT = 5 * 1024 * 1024;
const EXPORT_LIMIT = 50 * 1024 * 1024;
const MONEY_FIELDS = ["gross_proceeds", "average_order_value", "refunds", "payment_fees", "net_funds", "prize_costs", "good_cause_amount"] as const;
const COUNT_FIELDS = ["paid_orders", "tickets_sold", "winners", "unclaimed_prizes", "failed_payments", "disputed_payments", "compliance_warnings"] as const;
type NumericField = typeof MONEY_FIELDS[number] | typeof COUNT_FIELDS[number];
function formatCount(value: number | null) { return value === null ? "Unavailable" : value.toLocaleString("en-GB"); }
function formatMoney(value: number | null) {
    return value === null || !Number.isFinite(value) ? "Unavailable" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}
function formatDate(value: string | null) {
    if (!value || !Number.isFinite(new Date(value).getTime()))
        return "Not recorded";
    return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(new Date(value));
}
function reportYear(value: string) {
    return Number.isFinite(new Date(value).getTime()) ? new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/London" }).format(new Date(value)) : "";
}
function record(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function requiredText(value: unknown): string {
    if (typeof value !== "string" || !value.trim() || value.length > 500)
        throw new Error("The server returned an invalid record.");
    return value;
}
function nullableDate(value: unknown): string | null { return typeof value === "string" && Number.isFinite(new Date(value).getTime()) ? value : null; }
function normalizeReports(value: unknown): LotteryReport[] {
    if (!Array.isArray(value) || value.length > MAX_REPORTS)
        throw new Error("The report response is invalid or too large. Ask for a server-paginated report.");
    const ids = new Set<string>();
    return value.map(raw => {
        if (!record(raw))
            throw new Error("The server returned an invalid record.");
        const lottery_id = requiredText(raw.lottery_id);
        if (ids.has(lottery_id))
            throw new Error("The server returned duplicate lottery reports.");
        ids.add(lottery_id);
        const row = { lottery_id, lottery_title: requiredText(raw.lottery_title), lottery_slug: requiredText(raw.lottery_slug), lottery_status: requiredText(raw.lottery_status), lottery_type: typeof raw.lottery_type === "string" ? raw.lottery_type : "Unavailable", created_at: nullableDate(raw.created_at) ?? "", sales_open_at: nullableDate(raw.sales_open_at), sales_close_at: nullableDate(raw.sales_close_at), draw_at: nullableDate(raw.draw_at) } as LotteryReport;
        for (const key of [...MONEY_FIELDS, ...COUNT_FIELDS]) {
            const v = raw[key];
            row[key] = typeof v === "number" && Number.isFinite(v) && (!COUNT_FIELDS.includes(key as typeof COUNT_FIELDS[number]) || (Number.isSafeInteger(v) && v >= 0)) ? v : null;
        }
        return row;
    });
}
function sumFields(rows: LotteryReport[], keys: readonly NumericField[]): number | null {
    let total = 0;
    for (const row of rows)
        for (const key of keys) {
            if (row[key] === null)
                return null;
            total += row[key];
        }
    return Number.isFinite(total) ? total : null;
}
async function boundedBytes(response: Response, limit: number): Promise<Uint8Array> {
    if (Number(response.headers.get("content-length")) > limit)
        throw new Error("The response is too large. Request a smaller scope.");
    if (!response.body)
        throw new Error("The server returned an empty response.");
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            length += value.length;
            if (length > limit)
                throw new Error("The response is too large. Request a smaller scope.");
            chunks.push(value);
        }
    }
    catch (error) {
        await reader.cancel().catch(() => { });
        throw error;
    }
    finally {
        reader.releaseLock();
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
    }
    return bytes;
}
async function readJson(response: Response): Promise<Record<string, unknown>> {
    try {
        const value: unknown = JSON.parse(new TextDecoder().decode(await boundedBytes(response, JSON_LIMIT)));
        if (record(value))
            return value;
    }
    catch (error) {
        if (error instanceof Error && error.message.includes("too large"))
            throw error;
    }
    throw new Error("The server returned an invalid report response.");
}
class ReportRequestError extends Error {
    constructor(message: string, public status: number) { super(message); }
}
function responseError(response: Response) {
    return new ReportRequestError(response.status === 401 ? "Your session has expired. Sign in again." : response.status === 403 ? "You do not have permission to access this report." : "The report request failed. Try again or contact support.", response.status);
}
async function request<T>(url: string, controller: AbortController, consume: (response: Response) => Promise<T>): Promise<T> {
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
        const response = await fetch(url, { method: "GET", credentials: "include", cache: "no-store", signal: controller.signal, headers: { Accept: "application/json, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/zip" } });
        if (!response.ok)
            throw responseError(response);
        const result = await consume(response);
        if (controller.signal.aborted)
            throw new Error("The request was interrupted. Try again.");
        return result;
    }
    catch (error) {
        if (controller.signal.aborted)
            throw new Error("The request was interrupted or timed out. Try again.");
        throw error;
    }
    finally {
        clearTimeout(timer);
    }
}
async function exportBlob(response: Response): Promise<{
    blob: Blob;
    extension: "zip" | "xlsx";
}> {
    const mime = (response.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
    if (!["application/zip", "application/x-zip-compressed", "application/octet-stream", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"].includes(mime))
        throw new Error("The server did not return a supported export file.");
    const bytes = await boundedBytes(response, EXPORT_LIMIT);
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b || bytes[2] !== 3 || bytes[3] !== 4)
        throw new Error("The server did not return a valid export container.");
    // ZIP signature is a format check, not verification of workbook contents.
    const disposition = response.headers.get("content-disposition") ?? "";
    const filename = disposition.match(/filename\*?=(?:UTF-8''|"?)([^";\r\n]+)/i)?.[1]?.trim();
    const extension = filename?.toLowerCase().endsWith(".xlsx") ? "xlsx" : filename?.toLowerCase().endsWith(".zip") ? "zip" : mime.includes("spreadsheetml") ? "xlsx" : mime.includes("zip") ? "zip" : null;
    if (!extension)
        throw new Error("The export file format could not be identified.");
    return { blob: new Blob([new Uint8Array(bytes).buffer], { type: mime }), extension };
}
function Modal({ children, onClose, titleId, className = "" }: {
    children: React.ReactNode;
    onClose: () => void;
    titleId: string;
    className?: string;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const dialog = ref.current;
        const previous = document.activeElement as HTMLElement | null;
        const overflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        dialog?.showModal();
        return () => { dialog?.close(); document.body.style.overflow = overflow; if (previous?.isConnected)
            previous.focus(); };
    }, []);
    return <dialog ref={ref} aria-labelledby={titleId} onCancel={event => { event.preventDefault(); onClose(); }} className={`max-h-[95vh] w-[95vw] max-w-6xl overflow-y-auto rounded-3xl border border-white/15 bg-[#15172a] p-0 text-white backdrop:bg-black/80 ${className}`}>{children}</dialog>;
}
export default function ReportsClient() {
    const [items, setItems] = useState<LotteryReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState<ExportType | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [paperDrawOpen, setPaperDrawOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [lotteryId, setLotteryId] = useState("all");
    const [status, setStatus] = useState("all");
    const [year, setYear] = useState("all");
    const [sort, setSort] = useState("gross_desc");
    const [page, setPage] = useState(1);
    const [loaded, setLoaded] = useState(false);
    const [notice, setNotice] = useState("");
    const [pendingExport, setPendingExport] = useState<{
        type: Exclude<ExportType, "paper_draw">;
        lotteryId: string;
        year: string;
        title: string;
    } | null>(null);
    const loadController = useRef<AbortController | null>(null);
    const exportController = useRef<AbortController | null>(null);
    const exportBusy = useRef(false);
    const mounted = useRef(false);
    const downloadUrls = useRef(new Set<string>());
    const clearDeniedData = useCallback(() => {
        setItems([]);
        setLoaded(false);
        setLoading(false);
        setPendingExport(null);
        setPaperDrawOpen(false);
        setNotice("");
        setError("Report access was denied or your session expired. Sign in with the required permissions.");
        loadController.current?.abort();
        loadController.current = null;
        exportController.current?.abort();
    }, []);
    const loadLotteryReports = useCallback(async () => {
        loadController.current?.abort();
        const controller = new AbortController();
        loadController.current = controller;
        setLoading(true);
        setLoaded(false);
        setItems([]);
        setError(null);
        try {
            const rows = await request(API_ROUTE, controller, async (response) => {
                const data = await readJson(response);
                if (data.ok !== true)
                    throw new Error("Unable to load lottery reports.");
                return normalizeReports(data.items);
            });
            if (mounted.current && loadController.current === controller) {
                setItems(rows);
                setLoaded(true);
            }
        }
        catch (error) {
            if (mounted.current && loadController.current === controller) {
                if (error instanceof ReportRequestError && [401, 403].includes(error.status))
                    clearDeniedData();
                setError(error instanceof Error ? error.message : "Unable to load lottery reports.");
            }
        }
        finally {
            if (mounted.current && loadController.current === controller)
                setLoading(false);
        }
    }, [clearDeniedData]);
    useEffect(() => {
        mounted.current = true;
        void loadLotteryReports();
        return () => { mounted.current = false; loadController.current?.abort(); exportController.current?.abort(); for (const url of downloadUrls.current)
            URL.revokeObjectURL(url); downloadUrls.current.clear(); };
    }, [loadLotteryReports]);
    useEffect(() => { setPage(1); }, [search, lotteryId, status, year, sort, items]);
    const lotteries = useMemo(() => items
        .map((item) => [item.lottery_id, item.lottery_title] as const)
        .sort((a, b) => a[1].localeCompare(b[1])), [items]);
    const statuses = useMemo(() => Array.from(new Set(items.map((x) => x.lottery_status).filter(Boolean))).sort(), [items]);
    const years = useMemo(() => Array.from(new Set(items.map((x) => reportYear(x.created_at)).filter(Boolean))).sort((a, b) => Number(b) - Number(a)), [items]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = items.filter((item) => {
            const matchesSearch = !q ||
                item.lottery_title.toLowerCase().includes(q) ||
                item.lottery_slug.toLowerCase().includes(q) ||
                item.lottery_id.toLowerCase().includes(q);
            const matchesLottery = lotteryId === "all" || item.lottery_id === lotteryId;
            const matchesStatus = status === "all" || item.lottery_status === status;
            const matchesYear = year === "all" ||
                reportYear(item.created_at) === year;
            return matchesSearch && matchesLottery && matchesStatus && matchesYear;
        });
        return result.sort((a, b) => {
            switch (sort) {
                case "gross_asc":
                    return (a.gross_proceeds ?? Infinity) - (b.gross_proceeds ?? Infinity);
                case "tickets_desc":
                    return (b.tickets_sold ?? -Infinity) - (a.tickets_sold ?? -Infinity);
                case "orders_desc":
                    return (b.paid_orders ?? -Infinity) - (a.paid_orders ?? -Infinity);
                case "newest":
                    return (Date.parse(b.created_at) || 0) - (Date.parse(a.created_at) || 0);
                default:
                    return (b.gross_proceeds ?? -Infinity) - (a.gross_proceeds ?? -Infinity);
            }
        });
    }, [items, search, lotteryId, status, year, sort]);
    const totals = useMemo(() => {
        const sum = (...keys: NumericField[]) => loaded ? sumFields(filtered, keys) : null;
        return { gross: sum("gross_proceeds"), orders: sum("paid_orders"), tickets: sum("tickets_sold"), refunds: sum("refunds"), fees: sum("payment_fees"), net: sum("net_funds"), prizes: sum("prize_costs"), goodCause: sum("good_cause_amount"), problems: sum("failed_payments", "disputed_payments", "compliance_warnings") };
    }, [filtered, loaded]);
    const averageOrder = totals.orders !== null && totals.orders > 0 && totals.gross !== null ? totals.gross / totals.orders : null;
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, pageCount);
    function prepareExport(type: ExportType) {
        if (exportBusy.current || !loaded || loading)
            return;
        if (type === "paper_draw") {
            setPaperDrawOpen(true);
            return;
        }
        if (type === "archive" && lotteryId === "all") {
            setError("Choose a specific lottery for an archive pack.");
            return;
        }
        setPendingExport({ type, lotteryId, year, title: lotteryId === "all" ? "All lotteries" : lotteries.find(([id]) => id === lotteryId)?.[1] ?? lotteryId });
    }
    async function exportReport() {
        const scope = pendingExport;
        if (!scope || exportBusy.current)
            return;
        exportBusy.current = true;
        const controller = new AbortController();
        exportController.current = controller;
        setExporting(scope.type);
        setPendingExport(null);
        setError(null);
        setNotice("");
        try {
            const params = new URLSearchParams({ type: scope.type });
            if (scope.lotteryId !== "all")
                params.set("lottery_id", scope.lotteryId);
            if (scope.year !== "all")
                params.set("year", scope.year);
            const file = await request(`${API_ROUTE}/export?${params}`, controller, exportBlob);
            if (!mounted.current)
                return;
            const url = URL.createObjectURL(file.blob);
            downloadUrls.current.add(url);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `burton-pride-lottery-${scope.type}-${new Date().toISOString().slice(0, 10)}.${file.extension}`;
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
            setTimeout(() => { URL.revokeObjectURL(url); downloadUrls.current.delete(url); }, 1000);
            setNotice("Download started. Review the file before sharing or using it for a return.");
        }
        catch (error) {
            if (mounted.current) {
                if (error instanceof ReportRequestError && [401, 403].includes(error.status))
                    clearDeniedData();
                setError(error instanceof Error ? error.message : "Unable to download the report.");
            }
        }
        finally {
            exportBusy.current = false;
            if (mounted.current)
                setExporting(null);
        }
    }
    return (<div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <BarChart3 className="h-5 w-5 text-white"/>
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">
                Reports
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Review lottery proceeds, orders, tickets, refunds, fees, prize
                costs, good-cause funds and operational reporting.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadLotteryReports()} disabled={loading} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>
              Refresh
            </button>
          </div>
        </div>
      </section>

      <div role="note" className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
        These are API-reported figures. Payment fees, net funds and good-cause amounts are unverified estimates and require ledger reconciliation. A zero fee does not confirm that no fees were charged. Warning counts do not establish compliance approval.
      </div>
      {notice && <p role="status" className="text-sm text-white/70">{notice}</p>}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Gross proceeds" value={formatMoney(totals.gross)} icon={<PoundSterling className="h-5 w-5"/>}/>
        <StatCard label="Paid orders" value={formatCount(totals.orders)} icon={<WalletCards className="h-5 w-5"/>}/>
        <StatCard label="Tickets sold" value={formatCount(totals.tickets)} icon={<Ticket className="h-5 w-5"/>}/>
        <StatCard label="Average order" value={formatMoney(averageOrder)} icon={<BarChart3 className="h-5 w-5"/>}/>
        <StatCard label="Net funds (unverified)" value={formatMoney(totals.net)} icon={<CheckCircle2 className="h-5 w-5"/>}/>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Refunds" value={formatMoney(totals.refunds)}/>
        <MetricCard label="Fees (unverified)" value={formatMoney(totals.fees)}/>
        <MetricCard label="Prize costs" value={formatMoney(totals.prizes)}/>
        <MetricCard label="Good cause (unverified)" value={formatMoney(totals.goodCause)}/>
        <MetricCard label="Needs attention" value={formatCount(totals.problems)} warning={(totals.problems ?? 0) > 0}/>
      </section>

      {error ? (<div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65"/>
          <h2 className="text-lg font-bold text-white">
            Search &amp; filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"/>
            <input aria-label="Search lottery reports" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Lottery title, slug or ID..." className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"/>
          </div>

          <Select label="Lottery" value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteries.map(([id, title]) => (<option key={id} value={id}>
                {title}
              </option>))}
          </Select>

          <Select label="Status" value={status} onChange={setStatus}>
            <option value="all">All statuses</option>
            {statuses.map((value) => (<option key={value} value={value}>
                {value.replaceAll("_", " ")}
              </option>))}
          </Select>

          <Select label="Created year" value={year} onChange={setYear}>
            <option value="all">All years</option>
            {years.map((value) => (<option key={value} value={value}>
                {value}
              </option>))}
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select label="Sort reports" value={sort} onChange={setSort}>
            <option value="gross_desc">Highest gross proceeds</option>
            <option value="gross_asc">Lowest gross proceeds</option>
            <option value="tickets_desc">Most tickets sold</option>
            <option value="orders_desc">Most paid orders</option>
            <option value="newest">Newest lottery</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">
            Lottery performance
          </h2>
          <p className="mt-1 text-sm text-white/50">
            {loaded ? `Showing ${filtered.length} of ${items.length} lottery reports` : "Report data is unavailable"}
          </p>
        </div>

        {loading ? (<div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
            Loading reports...
          </div>) : !loaded ? (<p className="text-white/60">Report data could not be loaded. Use Refresh to try again.</p>) : filtered.length === 0 ? (<div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <BarChart3 className="mx-auto h-8 w-8 text-white/30"/>
            <h3 className="mt-3 font-bold text-white">
              No report data found
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Change the filters or wait for lottery activity to be recorded.
            </p>
          </div>) : (<div className="space-y-4">
            {filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((item) => (<ReportRow key={item.lottery_id} item={item}/>))}
          </div>)}
      </section>

      {loaded && filtered.length > PAGE_SIZE && <nav aria-label="Report pages" className="flex items-center justify-between gap-3 text-sm text-white">
        <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)} className="rounded-xl border border-white/15 px-4 py-3 disabled:opacity-40">Previous</button>
        <span>Page {currentPage} of {pageCount}</span>
        <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)} className="rounded-xl border border-white/15 px-4 py-3 disabled:opacity-40">Next</button>
      </nav>}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5">
          <h2 className="text-lg font-bold text-white">
            Exports &amp; archive
          </h2>
          <p className="mt-1 text-sm leading-6 text-white/50">
            Downloads use only the chosen lottery and year. Search, status, sort and pagination affect the on-screen register only. Exports may contain personal or sensitive records; review their scope before downloading.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {EXPORT_OPTIONS.map((option) => (<button key={option.type} type="button" onClick={() => prepareExport(option.type)} disabled={Boolean(exporting) || !loaded || loading} className="group rounded-2xl border border-white/10 bg-black/20 p-5 text-left transition hover:border-white/20 hover:bg-white/5 disabled:opacity-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/65">
                  {option.icon}
                </div>
                {exporting === option.type ? (<Loader2 className="h-4 w-4 animate-spin text-white/55"/>) : option.type === "paper_draw" ? (<Printer className="h-4 w-4 text-white/35 transition group-hover:text-white/65"/>) : (<Download className="h-4 w-4 text-white/35 transition group-hover:text-white/65"/>)}
              </div>

              <h3 className="mt-4 font-extrabold text-white">
                {option.title}
              </h3>
              <p className="mt-1 text-xs leading-5 text-white/45">
                {option.description}
              </p>
            </button>))}
        </div>
      </section>

      <section className="rounded-3xl border border-blue-400/20 bg-blue-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-blue-200"/>
          <div>
            <h3 className="font-bold text-blue-100">
              Report limitations
            </h3>
            <p className="mt-1 text-sm leading-6 text-blue-100/70">
              Financial returns require verified payment fees, refunds, prize costs and ledger transactions. Export access and dataset permissions must be enforced and audited by the server. This screen cannot verify either requirement.
            </p>
          </div>
        </div>
      </section>

      {pendingExport && <Modal titleId="export-title" onClose={() => setPendingExport(null)}>
        <div className="space-y-4 p-6">
          <h2 id="export-title" className="text-xl font-bold">Download {EXPORT_OPTIONS.find(option => option.type === pendingExport.type)?.title}</h2>
          <p>Lottery: {pendingExport.title}. Year: {pendingExport.year === "all" ? "All years" : pendingExport.year}.</p>
          <p className="text-sm leading-6 text-white/65">Search and status filters are not applied. The server determines which rows and fields are included. This download may contain personal data. Regulatory figures require reconciliation before submission.</p>
          <div className="flex gap-3">
            <button autoFocus type="button" onClick={() => setPendingExport(null)} className="rounded-xl border border-white/15 px-4 py-3">Cancel</button>
            <button type="button" onClick={() => void exportReport()} className="rounded-xl bg-white px-4 py-3 font-bold text-black">Download</button>
          </div>
        </div>
      </Modal>}
      {paperDrawOpen && <PaperDrawModal open={paperDrawOpen} initialLotteryId={lotteryId === "all" ? "" : lotteryId} onDenied={clearDeniedData} onClose={() => setPaperDrawOpen(false)}/>}
    </div>);
}
function normalizePaperDraw(raw: Record<string, unknown>, selectedId: string) {
    const parseLottery = (value: unknown): PaperDrawLottery => {
        if (!record(value))
            throw new Error("The server returned an invalid lottery.");
        return { id: requiredText(value.id), title: requiredText(value.title), slug: requiredText(value.slug), status: requiredText(value.status), draw_at: nullableDate(value.draw_at), sales_close_at: nullableDate(value.sales_close_at) };
    };
    if (raw.lotteries !== undefined && (!Array.isArray(raw.lotteries) || raw.lotteries.length > MAX_REPORTS))
        throw new Error("The server returned an invalid lottery list.");
    const lotteries = (raw.lotteries === undefined ? [] : raw.lotteries as unknown[]).map(parseLottery);
    if (new Set(lotteries.map(item => item.id)).size !== lotteries.length)
        throw new Error("The server returned duplicate lotteries.");
    if (!selectedId)
        return { lotteries, lottery: null, tickets: [], generated_at: "" };
    const lottery = parseLottery(raw.lottery);
    if (lottery.id !== selectedId)
        throw new Error("The server returned tickets for a different lottery.");
    if (!Array.isArray(raw.tickets) || raw.tickets.length > MAX_PRINT_TICKETS)
        throw new Error("The ticket register is invalid or too large. Request a bounded server-generated print file.");
    const ids = new Set<string>();
    const numbers = new Set<string>();
    const tickets = raw.tickets.map(value => {
        if (!record(value))
            throw new Error("The server returned an invalid ticket.");
        const id = requiredText(value.id);
        const ticket_number = requiredText(value.ticket_number);
        if (ids.has(id) || numbers.has(ticket_number))
            throw new Error("The server returned duplicate print tickets.");
        ids.add(id);
        numbers.add(ticket_number);
        return { id, ticket_number, order_reference: requiredText(value.order_reference), issued_at: nullableDate(value.issued_at) };
    });
    if (!lotteries.some(item => item.id === lottery.id))
        lotteries.push(lottery);
    return { lotteries, lottery, tickets, generated_at: nullableDate(raw.generated_at) ?? "" };
}
function PaperDrawModal({ onDenied, open, initialLotteryId, onClose, }: {
    onDenied: () => void;
    open: boolean;
    initialLotteryId: string;
    onClose: () => void;
}) {
    const [selectedLotteryId, setSelectedLotteryId] = useState(initialLotteryId);
    const [lotteries, setLotteries] = useState<PaperDrawLottery[]>([]);
    const [lottery, setLottery] = useState<PaperDrawLottery | null>(null);
    const [tickets, setTickets] = useState<PaperDrawTicket[]>([]);
    const [generatedAt, setGeneratedAt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [reloadKey, setReloadKey] = useState(0);
    useEffect(() => {
        if (!open)
            return;
        setSelectedLotteryId(initialLotteryId);
    }, [open, initialLotteryId]);
    useEffect(() => {
        if (!open)
            return;
        const controller = new AbortController();
        let active = true;
        async function loadPaperDraw() {
            setLoading(true);
            setError("");
            setLottery(null);
            setTickets([]);
            setGeneratedAt("");
            try {
                const params = new URLSearchParams();
                if (selectedLotteryId) {
                    params.set("lottery_id", selectedLotteryId);
                }
                const data = await request(`${API_ROUTE}/paper-draw?${params}`, controller, async (response) => {
                    const raw = await readJson(response);
                    if (raw.ok !== true)
                        throw new Error("Unable to prepare paper draw tickets.");
                    return normalizePaperDraw(raw, selectedLotteryId);
                });
                if (controller.signal.aborted || !active)
                    return;
                setLotteries(data.lotteries);
                setLottery(data.lottery);
                setTickets(data.tickets);
                setGeneratedAt(data.generated_at);
            }
            catch (loadError) {
                if (!active)
                    return;
                if (loadError instanceof ReportRequestError && [401, 403].includes(loadError.status)) {
                    onDenied();
                    return;
                }
                setLottery(null);
                setTickets([]);
                setError(loadError instanceof Error
                    ? loadError.message
                    : "Unable to prepare paper draw tickets.");
            }
            finally {
                if (active)
                    setLoading(false);
            }
        }
        void loadPaperDraw();
        return () => { active = false; controller.abort(); };
    }, [open, selectedLotteryId, reloadKey, onDenied]);
    if (!open)
        return null;
    return (<Modal className="paper-draw-overlay" titleId="paper-draw-title" onClose={onClose}>
      <div className="paper-draw-modal my-auto w-full max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-[#15172a] shadow-2xl">
        <header className="paper-draw-controls sticky top-0 z-10 border-b border-white/10 bg-[#15172a] p-5 text-white sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="paper-draw-title" className="text-xl font-black sm:text-2xl">
                Paper draw ticket sheets
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-white/55">
                Preview server-returned ticket slips. Paid-order eligibility, completeness and a secure draw snapshot must be verified by the server before using these for a draw.
              </p>
            </div>
            <button type="button" onClick={onClose} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/15 text-white/65 hover:bg-white/10 hover:text-white" autoFocus aria-label="Close paper draw popup">
              <X className="h-5 w-5"/>
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto]">
            <label className="text-sm font-bold">
              Lottery
              <select value={selectedLotteryId} onChange={(event) => setSelectedLotteryId(event.target.value)} className="mt-2 min-h-11 w-full rounded-xl border border-white/15 bg-slate-950 px-3 text-white">
                <option value="">Choose a lottery</option>
                {lotteries.map((item) => (<option key={item.id} value={item.id}>
                    {item.title}
                  </option>))}
              </select>
            </label>

            <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-white/15 px-4 font-bold disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>
              Refresh
            </button>

            <button type="button" onClick={() => { if (!loading && lottery?.id === selectedLotteryId && tickets.length && !error)
        window.print(); }} disabled={loading || tickets.length === 0 || !lottery || lottery.id !== selectedLotteryId || Boolean(error)} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-yellow-300 px-5 font-black text-purple-950 disabled:cursor-not-allowed disabled:opacity-45">
              <Printer className="h-4 w-4"/>
              Print {tickets.length || ""} tickets
            </button>
          </div>
        </header>

        <div className="max-h-[72vh] overflow-y-auto p-4 sm:p-6">
          {error ? (<div className="paper-draw-controls rounded-2xl border border-red-300 bg-red-50 p-5 font-bold text-red-800">
              {error}
            </div>) : loading ? (<div className="paper-draw-controls flex min-h-56 items-center justify-center text-white/60">
              <Loader2 className="mr-3 h-5 w-5 animate-spin"/>
              Preparing tickets…
            </div>) : !selectedLotteryId ? (<div className="paper-draw-controls rounded-2xl border border-dashed border-white/20 p-10 text-center text-white/60">
              Choose a lottery to preview its paper draw tickets.
            </div>) : lottery && tickets.length === 0 ? (<div className="paper-draw-controls rounded-2xl border border-dashed border-white/20 p-10 text-center text-white/60">
              No tickets were returned for this lottery.
            </div>) : lottery ? (<main className="paper-draw-print bg-white p-5 text-black sm:p-7">
              <header className="paper-draw-print-header mb-5 border-b-2 border-black pb-4">
                <div className="flex items-start justify-between gap-5">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em]">
                      Burton Pride Lottery
                    </p>
                    <h3 className="mt-1 text-2xl font-black">{lottery.title}</h3>
                  </div>
                  <Ticket className="h-8 w-8" aria-hidden="true"/>
                </div>
                <div className="mt-3 grid gap-2 text-xs sm:grid-cols-3">
                  <p><strong>Tickets:</strong> {tickets.length}</p>
                  <p><strong>Draw:</strong> {formatDate(lottery.draw_at)}</p>
                  <p><strong>Prepared:</strong> {formatDate(generatedAt || null)}</p>
                </div>
                <p className="mt-2 text-[11px] text-slate-600">
                  Server-returned ticket register. Verify draw eligibility and completeness before use. Cut along the dashed lines.
                </p>
              </header>

              <div className="paper-ticket-grid grid gap-4 sm:grid-cols-2">
                {tickets.map((item) => (<article key={item.id} className="paper-ticket flex min-h-36 break-inside-avoid flex-col justify-between border border-dashed border-slate-500 p-4 text-black">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.14em]">
                          Burton Pride Lottery
                        </p>
                        <p className="mt-1 text-sm font-bold">{lottery.title}</p>
                      </div>
                      <p className="text-[10px] uppercase">Paper draw slip</p>
                    </div>
                    <p className="my-3 text-center text-3xl font-black tracking-wide">
                      Ticket {item.ticket_number}
                    </p>
                    <p className="border-t border-slate-300 pt-2 text-[10px]">
                      Order reference: <strong>{item.order_reference}</strong>
                    </p>
                  </article>))}
              </div>
            </main>) : null}
        </div>
      </div>

      <style>{`
        @page {
          size: A4 portrait;
          margin: 8mm;
        }

        @media print {
          body * {
            visibility: hidden !important;
          }

          html,
          body {
            background: #fff !important;
          }

          .paper-draw-overlay,
          .paper-draw-modal,
          .paper-draw-print,
          .paper-draw-print * {
            visibility: visible !important;
          }

          .paper-draw-controls {
            display: none !important;
          }

          .paper-draw-overlay,
          .paper-draw-modal {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            max-width: none !important;
            max-height: none !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: #fff !important;
            box-shadow: none !important;
          }

          .paper-draw-modal > div {
            max-height: none !important;
            overflow: visible !important;
            padding: 0 !important;
          }

          .paper-draw-print {
            padding: 0 !important;
          }

          .paper-draw-print-header {
            margin-bottom: 4mm !important;
          }

          .paper-ticket-grid {
            display: grid !important;
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            gap: 4mm !important;
          }

          .paper-ticket {
            min-height: 34mm !important;
            padding: 3mm !important;
            break-inside: avoid !important;
            page-break-inside: avoid !important;
            border: 1px dashed #555 !important;
            background: #fff !important;
            color: #000 !important;
          }
        }
      `}</style>
    </Modal>);
}
function ReportRow({ item }: {
    item: LotteryReport;
}) {
    const issues = sumFields([item], ["failed_payments", "disputed_payments", "compliance_warnings"]);
    return (<article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white">
                {item.lottery_title}
              </h3>
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/55">
                {item.lottery_status.replaceAll("_", " ")}
              </span>
              {issues !== null && issues > 0 ? (<span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-200">
                  <AlertTriangle className="h-3 w-3"/>
                  {issues} issue{issues === 1 ? "" : "s"}
                </span>) : (<span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-white/60">
                  <CheckCircle2 className="h-3 w-3"/>
                  {issues === null ? "Warning data unavailable" : "No reported warnings · not approval"}
                </span>)}
            </div>

            <p className="mt-2 text-xs text-white/40">
              Sales close: {formatDate(item.sales_close_at)} · Draw:{" "}
              {formatDate(item.draw_at)}
            </p>
          </div>

          <div className="text-left xl:text-right">
            <div className="text-2xl font-black text-white">
              {formatMoney(item.gross_proceeds)}
            </div>
            <div className="text-xs text-white/45">Gross proceeds</div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
          <Info label="Paid orders" value={formatCount(item.paid_orders)}/>
          <Info label="Tickets" value={formatCount(item.tickets_sold)}/>
          <Info label="Avg order" value={formatMoney(item.average_order_value)}/>
          <Info label="Refunds" value={formatMoney(item.refunds)}/>
          <Info label="Fees (unverified)" value={formatMoney(item.payment_fees)}/>
          <Info label="Net funds (unverified)" value={formatMoney(item.net_funds)}/>
          <Info label="Prize costs" value={formatMoney(item.prize_costs)}/>
          <Info label="Good cause (unverified)" value={formatMoney(item.good_cause_amount)}/>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Info label="Winners" value={formatCount(item.winners)}/>
          <Info label="Unclaimed prizes" value={formatCount(item.unclaimed_prizes)}/>
          <Info label="Failed payments" value={formatCount(item.failed_payments)}/>
          <Info label="Disputes" value={formatCount(item.disputed_payments)}/>
          <Info label="Compliance warnings" value={formatCount(item.compliance_warnings)}/>
        </div>
      </div>
    </article>);
}
function StatCard({ icon, label, value, }: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (<div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex items-center gap-3 text-white/55">
        {icon}
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
    </div>);
}
function MetricCard({ label, value, warning = false, }: {
    label: string;
    value: string;
    warning?: boolean;
}) {
    return (<div className={`rounded-2xl border p-4 ${warning
            ? "border-amber-400/20 bg-amber-500/10"
            : "border-white/10 bg-black/20"}`}>
      <div className="text-xs font-bold uppercase tracking-wide text-white/40">
        {label}
      </div>
      <div className={`mt-2 text-xl font-black ${warning ? "text-amber-100" : "text-white"}`}>
        {value}
      </div>
    </div>);
}
function Select({ label, value, onChange, children, }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (<div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40"/>
    </div>);
}
function Info({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">
        {value}
      </div>
    </div>);
}
