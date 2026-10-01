"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import CreateLotteryModal, { type LotteryCreationProfile } from "./CreateLotteryModal";
import { Archive, Copy, ExternalLink, Eye, EyeOff, Filter, Loader2, Plus, RefreshCw, Search, ShieldCheck, Ticket, Trash2, X, XCircle } from "lucide-react";

const API_ROUTE = "/api/admin/lotterymanagement/lottery";
const DELETE_PASSWORD_ROUTE = "/api/admin/settings/delete-password";
const ROOT = "/Admin/LotteryManagement";
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 2_097_152;
const MAX_LOADED_ROWS = 500;
const PAGE_SIZE = 20;
const STATUSES = ["draft", "compliance_review", "scheduled", "live", "sales_closed", "draw_ready", "completed", "archived", "paused", "cancelled", "under_review"] as const;
type LotteryStatus = (typeof STATUSES)[number];
type DisplayStatus = LotteryStatus | "unknown";
type ActionType = "duplicate" | "archive" | "close_sales" | "delete";
type Sort = "created_desc" | "created_asc" | "closing_asc" | "draw_asc" | "revenue_desc" | "tickets_desc";
const SORTS: Sort[] = ["created_desc", "created_asc", "closing_asc", "draw_asc", "revenue_desc", "tickets_desc"];

type Lottery = {
  id: string; title: string; slug: string; internal_reference: string | null;
  lottery_type: string; status: DisplayStatus; short_summary: string | null;
  ticket_price: number | null; currency: string; max_tickets: number | null;
  minimum_age?: number; sales_open_at?: string | null; sales_close_at?: string | null;
  draw_at?: string | null; created_at?: string | null; updated_at?: string | null;
  archived_at?: string | null; is_active?: boolean;
  order_count?: number; paid_order_count?: number; ticket_count?: number; revenue?: number;
  show_in_public_directory?: boolean; public_page_available?: boolean;
};

/** UX permissions only. Resolve them from a verified server session.
 * APIs must check the same capabilities independently, including main-admin
 * authority for deletion. Missing access denies every mutation in this UI.
 */
export type LotteryListAccess = {
  create: boolean; edit: boolean; duplicate: boolean; closeSales: boolean; archive: boolean; delete: boolean;
};
export type LotteriesClientProps = {
  access?: LotteryListAccess;
  profiles?: readonly LotteryCreationProfile[];
  /** Only supply when the API implements X-CSRF-Token. */
  csrfToken?: string;
};
type Filters = { q: string; status: LotteryStatus | "all"; type: string; year: string; sort: Sort; page: number };
const DEFAULT_FILTERS: Filters = { q: "", status: "all", type: "all", year: "all", sort: "created_desc", page: 1 };
const FILTER_KEYS = ["q", "status", "type", "year", "sort", "page"] as const;
type ListData = { items: Lottery[]; total?: number; partial: boolean };
type Problem = { message: string; code: string; httpStatus?: number; requestId?: string; action: string; occurredAt: string };
type Selection = { type: ActionType; item: Lottery };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function safeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_.:-]{1,128}$/.test(value) ? value : undefined;
}
class UiError extends Error {
  constructor(message: string, readonly code: string, readonly httpStatus?: number, readonly requestId?: string) { super(message); }
}
function httpMessage(status: number): string {
  if (status === 401) return "Your session has expired. Sign in again, then refresh the list.";
  if (status === 403) return "This action is not permitted, or further verification is required.";
  if (status === 404) return "The lottery or requested endpoint is unavailable. Refresh the list.";
  if (status === 409 || status === 412) return "The record or lottery rules conflict with this request. Refresh the list and review the record.";
  if (status === 400 || status === 422) return "The server rejected the request. Check the entered details and lottery state.";
  if (status === 429) return "Too many requests. Wait before trying again.";
  return "The server could not confirm the request.";
}
async function readBoundedJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json") || !response.body) throw new UiError("The server response could not be verified.", "INVALID_RESPONSE");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new UiError("The response exceeds this page's safe size limit. A paginated API is required.", "RESPONSE_LIMIT"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new UiError("The server response could not be verified.", "INVALID_RESPONSE"); }
}
async function requestJson(route: string, method: "GET" | "POST" | "PATCH" | "DELETE", options: { body?: unknown; signal?: AbortSignal; csrfToken?: string } = {}): Promise<Record<string, unknown>> {
  const abort = new AbortController();
  const cancel = () => abort.abort();
  options.signal?.addEventListener("abort", cancel, { once: true });
  if (options.signal?.aborted) abort.abort();
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; abort.abort(); }, TIMEOUT_MS);
  let status: number | undefined;
  let requestId: string | undefined;
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";
    if (method !== "GET" && options.csrfToken) headers["X-CSRF-Token"] = options.csrfToken;
    const response = await fetch(route, { method, credentials: "include", cache: "no-store", redirect: "error", signal: abort.signal, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    status = response.status;
    requestId = safeRequestId(response.headers.get("x-request-id"));
    let data: unknown;
    try { data = await readBoundedJson(response); }
    catch (error) { if (!response.ok) throw new UiError(httpMessage(response.status), "HTTP_REJECTED", status, requestId); throw error; }
    if (isRecord(data)) requestId = safeRequestId(data.request_id) ?? requestId;
    if (!response.ok) throw new UiError(httpMessage(response.status), "HTTP_REJECTED", status, requestId);
    if (!isRecord(data) || data.ok !== true) throw new UiError("The server did not confirm the request.", "UNCONFIRMED_RESPONSE", status, requestId);
    return data;
  } catch (error) {
    if (timedOut) throw new UiError("The request timed out.", "REQUEST_TIMEOUT", status, requestId);
    if (error instanceof UiError) throw error;
    throw new UiError(options.signal?.aborted ? "The request was cancelled." : "Unable to connect. Check your connection.", "REQUEST_FAILED", status, requestId);
  } finally {
    clearTimeout(timer); options.signal?.removeEventListener("abort", cancel);
  }
}
function parseAmount(value: unknown, optional = false): number | undefined | null {
  if (value === undefined) { if (optional) return undefined; return null; }
  if (value === null) return null;
  const number = typeof value === "string" && /^\d+(?:\.\d{1,2})?$/.test(value) ? Number(value) : value;
  if (typeof number !== "number" || !Number.isFinite(number) || number < 0 || number > Number.MAX_SAFE_INTEGER / 100) throw new UiError("A lottery contains invalid financial data.", "INVALID_LOTTERY");
  return number;
}
function parseLottery(value: unknown): Lottery {
  if (!isRecord(value) || !["id", "title", "slug", "lottery_type"].every((key) => typeof value[key] === "string" && String(value[key]).trim() && String(value[key]).length <= 500) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value.slug)) || typeof value.status !== "string" ||
    !["internal_reference", "short_summary"].every((key) => value[key] === undefined || value[key] === null || (typeof value[key] === "string" && String(value[key]).length <= 10_000)) ||
    typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) throw new UiError("A lottery record could not be verified. Refresh the list.", "INVALID_LOTTERY");
  const item: Lottery = {
    id: String(value.id), title: String(value.title), slug: String(value.slug), lottery_type: String(value.lottery_type),
    status: STATUSES.includes(value.status as LotteryStatus) ? value.status as LotteryStatus : "unknown",
    internal_reference: typeof value.internal_reference === "string" ? value.internal_reference : null,
    short_summary: typeof value.short_summary === "string" ? value.short_summary : null,
    currency: value.currency, ticket_price: parseAmount(value.ticket_price) ?? null,
    max_tickets: value.max_tickets === undefined || value.max_tickets === null ? null
      : typeof value.max_tickets === "number" ? value.max_tickets
      : typeof value.max_tickets === "string" && /^\d+$/.test(value.max_tickets) ? Number(value.max_tickets) : NaN,
  };
  if (item.max_tickets !== null && (!Number.isSafeInteger(item.max_tickets) || item.max_tickets <= 0)) throw new UiError("A lottery contains an invalid capacity.", "INVALID_LOTTERY");
  for (const key of ["sales_open_at", "sales_close_at", "draw_at", "created_at", "updated_at", "archived_at"] as const) {
    if (value[key] !== undefined && value[key] !== null && typeof value[key] !== "string") throw new UiError("A lottery contains an invalid date field.", "INVALID_LOTTERY");
    item[key] = value[key] as string | null | undefined;
  }
  for (const key of ["order_count", "paid_order_count", "ticket_count", "minimum_age"] as const) {
    if (value[key] === undefined || value[key] === null) continue;
    if (typeof value[key] !== "number" || !Number.isSafeInteger(value[key]) || Number(value[key]) < 0) throw new UiError("A lottery contains an invalid count or age.", "INVALID_LOTTERY");
    item[key] = value[key] as number;
  }
  item.revenue = parseAmount(value.revenue, true) ?? undefined;
  for (const key of ["show_in_public_directory", "public_page_available", "is_active"] as const) {
    if (value[key] === undefined) continue;
    if (typeof value[key] !== "boolean") throw new UiError("A lottery contains an invalid visibility field.", "INVALID_LOTTERY");
    item[key] = value[key] as boolean;
  }
  return item;
}
function parseList(data: Record<string, unknown>): ListData {
  if (!Array.isArray(data.items)) throw new UiError("The lottery list response is incomplete.", "INVALID_LIST");
  if (data.items.length > MAX_LOADED_ROWS) throw new UiError(`The API returned more than ${MAX_LOADED_ROWS} lotteries. Server pagination must be connected before this list can be loaded safely.`, "ROW_LIMIT");
  const items = data.items.map(parseLottery);
  if (new Set(items.map((item) => item.id)).size !== items.length) throw new UiError("The list contains duplicate record identifiers.", "INVALID_LIST");
  const total = data.total === undefined ? undefined : data.total;
  if (total !== undefined && (typeof total !== "number" || !Number.isSafeInteger(total) || total < items.length)) throw new UiError("The list total could not be verified.", "INVALID_LIST");
  if (data.has_more !== undefined && typeof data.has_more !== "boolean") throw new UiError("The list paging information could not be verified.", "INVALID_LIST");
  return { items, total: total as number | undefined, partial: data.has_more === true || (typeof total === "number" && total > items.length) };
}
function timestamp(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return undefined;
  const [year,month,day,hour,minute,second] = match.slice(1,7).map(Number);
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return undefined;
  const calendar = new Date(Date.UTC(year,month-1,day));
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month-1 || calendar.getUTCDate() !== day) return undefined;
  if (match[7] !== "Z") {
    const [offsetHour, offsetMinute] = match[7].slice(1).split(":").map(Number);
    if (offsetHour > 23 || offsetMinute > 59) return undefined;
  }
  const number = Date.parse(value);
  return Number.isFinite(number) ? number : undefined;
}
function formatDate(value: string | null | undefined): string {
  if (value === null) return "Not set";
  const time = timestamp(value);
  return time === undefined ? "Unavailable" : new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" }).format(time);
}
function ukYear(value: string | null | undefined): string | undefined {
  const time = timestamp(value);
  return time === undefined ? undefined : new Intl.DateTimeFormat("en-GB", { year: "numeric", timeZone: "Europe/London" }).format(time);
}
function formatMoney(value: number | null | undefined, currency = "GBP"): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "Unavailable";
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency }).format(value); }
  catch { return "Unavailable"; }
}
function statusLabel(status: DisplayStatus): string { return status === "unknown" ? "Unrecognised status" : status.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }
function statusClass(status: DisplayStatus): string {
  if (status === "live") return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
  if (status === "unknown" || status === "cancelled") return "border-rose-300/40 bg-rose-500/10 text-rose-200";
  if (status === "compliance_review" || status === "under_review" || status === "paused") return "border-amber-300/40 bg-amber-500/10 text-amber-200";
  return "border-white/25 bg-white/10 text-white/85";
}
function readFilters(url: URL): Filters {
  const get = (key: string) => url.searchParams.get(`lottery_${key}`);
  const status = get("status"); const sort = get("sort"); const page = Number(get("page") ?? 1);
  return {
    q: (get("q") ?? "").slice(0, 200),
    status: STATUSES.includes(status as LotteryStatus) ? status as LotteryStatus : "all",
    type: (get("type") ?? "all").slice(0, 100), year: /^\d{4}$/.test(get("year") ?? "") ? get("year")! : "all",
    sort: SORTS.includes(sort as Sort) ? sort as Sort : "created_desc",
    page: Number.isSafeInteger(page) && page > 0 ? page : 1,
  };
}
function writeFilters(url: URL, filters: Filters): URL {
  const next = new URL(url);
  for (const key of FILTER_KEYS) {
    if (filters[key] === DEFAULT_FILTERS[key]) next.searchParams.delete(`lottery_${key}`);
    else next.searchParams.set(`lottery_${key}`, String(filters[key]));
  }
  return next;
}
function compareOptional(a: number | undefined, b: number | undefined, descending = false): number {
  if (a === undefined) return b === undefined ? 0 : 1;
  if (b === undefined) return -1;
  return descending ? b - a : a - b;
}
function filterItems(items: Lottery[], filters: Filters): Lottery[] {
  const query = filters.q.trim().toLowerCase();
  const result = items.filter((item) => (!query || [item.title, item.slug, item.id, item.internal_reference ?? ""].some((text) => text.toLowerCase().includes(query))) &&
    (filters.status === "all" || item.status === filters.status) && (filters.type === "all" || item.lottery_type === filters.type) &&
    (filters.year === "all" || ukYear(item.created_at) === filters.year));
  return result.sort((a, b) => {
    let order = 0;
    if (filters.sort === "closing_asc") order = compareOptional(timestamp(a.sales_close_at), timestamp(b.sales_close_at));
    else if (filters.sort === "draw_asc") order = compareOptional(timestamp(a.draw_at), timestamp(b.draw_at));
    else if (filters.sort === "revenue_desc") order = compareOptional(a.revenue, b.revenue, true);
    else if (filters.sort === "tickets_desc") order = compareOptional(a.ticket_count, b.ticket_count, true);
    else order = compareOptional(timestamp(a.created_at), timestamp(b.created_at), filters.sort === "created_desc");
    return order || a.id.localeCompare(b.id, "en-GB");
  });
}
function actionAllowed(type: ActionType, item: Lottery, access: LotteryListAccess | undefined): boolean {
  if (!access || item.status === "unknown") return false;
  if (type === "duplicate") return access.duplicate === true;
  if (type === "archive") return access.archive === true && ["completed", "cancelled"].includes(item.status);
  if (type === "close_sales") return access.closeSales === true && item.status === "live";
  return access.delete === true;
}
function publicLinkAvailable(item: Lottery): boolean {
  // Never guess publication from a legacy flag or lifecycle status alone.
  return item.public_page_available === true && item.show_in_public_directory === true && ["scheduled", "live", "sales_closed", "draw_ready", "completed"].includes(item.status);
}
function actionLabel(type: ActionType): string {
  return { duplicate: "Duplicate lottery", archive: "Archive lottery", close_sales: "Close ticket sales", delete: "Permanently delete lottery" }[type];
}
function problemFor(error: unknown, action: string): Problem {
  const safe = error instanceof UiError ? error : new UiError("The request could not be verified.", "CLIENT_FAILURE");
  return { message: safe.message, code: safe.code, httpStatus: safe.httpStatus, requestId: safe.requestId, action, occurredAt: new Date().toISOString() };
}

/** Server integration:
 * access must come from a verified session; APIs independently enforce creation,
 * edit, close-sales, deletion, recent 2FA, lifecycle transitions and atomic audit.
 * Use the previously updated CreateLotteryModal and supply authoritative profiles.
 * Publication deliberately has no PATCH shortcut here. Complete the protected
 * compliance/publish workflow on the server before enabling it elsewhere.
 * List API still uses the supplied {ok, items} contract. It must return a complete
 * bounded snapshot or truthful total/has_more metadata. Client paging does not
 * implement backend pagination; no unsupported page query is invented.
 * Optional public_page_available must be computed by the shared server predicate.
 * Duplicate must return a new private draft AND copy prizes transactionally.
 * Delete must verify the password and permissions itself, not trust preflight.
 * Add server idempotency and conditional writes for concurrent-editor safety.
 */
export default function LotteriesClient({ access, profiles, csrfToken }: LotteriesClientProps = {}) {
  const id = useId();
  const [items, setItems] = useState<Lottery[]>([]);
  const [hasSnapshot, setHasSnapshot] = useState(false);
  const [partial, setPartial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadProblem, setLoadProblem] = useState<Problem | null>(null);
  const [actionProblem, setActionProblem] = useState<Problem | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [uncertainIds, setUncertainIds] = useState<Set<string>>(() => new Set());
  const [selection, setSelection] = useState<Selection | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [filters, setFilters] = useState<Filters>({ ...DEFAULT_FILTERS });
  const [filtersReady, setFiltersReady] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(false);
  const loadController = useRef<AbortController | null>(null);
  const actionController = useRef<AbortController | null>(null);
  const loadGeneration = useRef(0);
  const actionLock = useRef(false);
  const itemsRef = useRef(items); itemsRef.current = items;
  const accessRef = useRef(access); accessRef.current = access;
  const blockedRef = useRef(uncertainIds); blockedRef.current = uncertainIds;

  const loadItems = useCallback(async (): Promise<ListData | null> => {
    const generation = ++loadGeneration.current;
    loadController.current?.abort();
    const abort = new AbortController(); loadController.current = abort;
    if (mounted.current) { setLoading(true); setLoadProblem(null); }
    try {
      const result = parseList(await requestJson(API_ROUTE, "GET", { signal: abort.signal }));
      if (!mounted.current || generation !== loadGeneration.current) return null;
      setItems(result.items); itemsRef.current = result.items; setPartial(result.partial); setHasSnapshot(true);
      return result;
    } catch (error) {
      if (mounted.current && generation === loadGeneration.current) setLoadProblem(problemFor(error, "Load lotteries"));
      return null;
    } finally { if (mounted.current && generation === loadGeneration.current) setLoading(false); }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void loadItems();
    return () => { mounted.current = false; ++loadGeneration.current; loadController.current?.abort(); actionController.current?.abort(); };
  }, [loadItems]);
  useEffect(() => {
    const sync = () => setFilters(readFilters(new URL(window.location.href)));
    sync(); setFiltersReady(true); window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);
  useEffect(() => {
    if (!busyId) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busyId]);

  function updateFilters(patch: Partial<Filters>, replace = false) {
    const next = { ...filters, ...patch, page: patch.page ?? 1 };
    setFilters(next);
    if (filtersReady) {
      const url = writeFilters(new URL(window.location.href), next);
      // Preserve Next's existing history state and unrelated query parameters.
      window.history[replace ? "replaceState" : "pushState"](window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }
  const filtered = useMemo(() => filterItems(items, filters), [items, filters]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const types = [...new Set(items.map((item) => item.lottery_type))].sort();
  const years = [...new Set(items.map((item) => ukYear(item.created_at)).filter((value): value is string => !!value))].sort().reverse();
  const mutationsBlocked = loading || !!loadProblem || !!busyId || !hasSnapshot || partial;
  useEffect(() => {
    if (!filtersReady || !hasSnapshot || loading || filters.page === page) return;
    const next = { ...filters, page }; setFilters(next);
    const url = writeFilters(new URL(window.location.href), next);
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }, [filters, filtersReady, hasSnapshot, loading, page]);

  function openAction(type: ActionType, item: Lottery) {
    if (actionLock.current || mutationsBlocked || uncertainIds.has(item.id) || !actionAllowed(type, item, accessRef.current)) return;
    setSelection({ type, item }); setModalError(null); setActionProblem(null); setNotice(null);
  }
  function closeAction() { if (!actionLock.current) { setSelection(null); setModalError(null); } }

  async function executeAction(password: string, confirmation: string) {
    if (!selection || actionLock.current || mutationsBlocked) return;
    const { type, item: original } = selection;
    const current = itemsRef.current.find((item) => item.id === original.id);
    if (!current || !actionAllowed(type, current, accessRef.current) || blockedRef.current.has(original.id) || current.status !== original.status || current.updated_at !== original.updated_at) {
      setModalError("The record or your access changed. Close this window, refresh the list and review it again."); return;
    }
    if (type === "delete" && (confirmation !== current.title || !password)) { setModalError("Enter the exact lottery title and the main administrator password."); return; }
    actionLock.current = true; setBusyId(current.id); setModalError(null); setActionProblem(null); setNotice(null);
    const abort = new AbortController(); actionController.current = abort;
    let mutationSent = false;
    let acknowledged = false;
    try {
      if (type === "delete") {
        // Preflight alone is not authority. DELETE must verify the password too.
        await requestJson(DELETE_PASSWORD_ROUTE, "POST", { body: { password }, signal: abort.signal, csrfToken });
      }
      const base = `${API_ROUTE}/${encodeURIComponent(current.id)}`;
      const route = type === "duplicate" ? `${base}/duplicate` : type === "close_sales" ? `${base}/close-sales` : base;
      const method = type === "archive" ? "PATCH" : type === "delete" ? "DELETE" : "POST";
      const body = type === "archive" ? { status: "archived" } : type === "delete" ? { confirmation_title: confirmation, main_admin_password: password } : undefined;
      mutationSent = true;
      const data = await requestJson(route, method, { body, signal: abort.signal, csrfToken });
      if (type === "duplicate") {
        const copy = parseLottery(data.item);
        if (copy.id === current.id || copy.status !== "draft" || copy.show_in_public_directory !== false) throw new UiError("The duplicate was not confirmed as a new private draft. Check the lottery list before duplicating again.", "UNVERIFIED_DUPLICATE");
      }
      acknowledged = true;
      if (!mounted.current) return;
      setSelection(null);
      // Refresh is a separate outcome from an acknowledged mutation.
      const result = await loadItems();
      if (!mounted.current) return;
      const updated = result?.items.find((item) => item.id === current.id);
      const verified = !!result && !result.partial && (type === "duplicate" ||
        (type === "delete" ? !updated : type === "archive" ? updated?.status === "archived" : updated?.status === "sales_closed"));
      if (!verified) {
        const next = new Set(blockedRef.current).add(current.id); blockedRef.current = next; setUncertainIds(next);
        setNotice(`${actionLabel(type)} was acknowledged, but the updated list could not confirm the result. Check the record before another action. This page will keep actions on it blocked.`);
      } else setNotice(`${actionLabel(type)} completed. The list has been refreshed.`);
    } catch (error) {
      if (!mounted.current) return;
      const problem = problemFor(error, actionLabel(type));
      if (mutationSent && !acknowledged) {
        const next = new Set(blockedRef.current).add(current.id); blockedRef.current = next; setUncertainIds(next);
        problem.message += " The change may have been applied. Refresh and inspect the record; this page will not repeat the action.";
        setSelection(null);
      } else if (type === "delete" && !mutationSent) {
        problem.message += " No lottery deletion was sent. Re-enter the password to try verification again.";
        setModalError(problem.message);
      }
      setActionProblem(problem);
    } finally {
      password = "";
      actionController.current = null; actionLock.current = false;
      if (mounted.current) setBusyId(null);
    }
  }

  const counts = [
    ["Live", items.filter((item) => item.status === "live").length], ["Drafts", items.filter((item) => item.status === "draft").length],
    ["Needs review", items.filter((item) => ["compliance_review", "under_review"].includes(item.status)).length], ["Archived", items.filter((item) => item.status === "archived").length],
  ] as const;
  return <div className="w-full space-y-6 py-4 text-white md:py-6">
    <section className={`${panelClass} flex flex-wrap items-center justify-between gap-4`}>
      <div><h1 id={`${id}-heading`} tabIndex={-1} className="flex items-center gap-3 text-2xl font-extrabold outline-none"><Ticket aria-hidden="true" className="h-6 w-6" /> Lotteries</h1><p className="mt-2 text-sm text-white/80">Manage campaigns, sales dates and draft details.</p></div>
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={loading || !!busyId} onClick={() => void loadItems()} className={`${buttonClass} border border-white/25`}><RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} /> Refresh</button>
        <button type="button" disabled={!!busyId || !access?.create || !profiles?.length || !!selection} onClick={() => setCreateOpen(true)} className={`${buttonClass} bg-white text-black enabled:hover:bg-fuchsia-100`}><Plus aria-hidden="true" className="h-4 w-4" /> Create lottery</button>
      </div>
    </section>
    {!access ? <p className="text-sm text-amber-200">Account action permissions are unavailable. This page is read-only until they are supplied.</p> : null}
    {access?.create && !profiles?.length ? <p className="text-sm text-amber-200">Creation needs the configured compliance profiles.</p> : null}
    <section aria-label="Counts in loaded records" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{counts.map(([label, count]) => <div key={label} className={panelClass}><p className="text-3xl font-black">{hasSnapshot ? count : "Unavailable"}</p><p className="mt-1 text-sm text-white/80">{label}</p></div>)}</section>
    <p className="text-xs text-white/75">Counts cover loaded records{loadProblem && hasSnapshot ? " from the last successful refresh" : ""}. Dates use Europe/London.</p>
    {loadProblem ? <ProblemPanel problem={loadProblem} /> : null}
    {actionProblem ? <ProblemPanel problem={actionProblem} /> : null}
    {notice ? <p role="status" className="text-sm text-emerald-200">{notice}</p> : null}
    {partial ? <p role="alert" className="text-sm text-amber-200">The server returned only part of the list. Counts and filters cover these records only. Actions are disabled until a complete list or server pagination is connected.</p> : null}
    {uncertainIds.size ? <p className="text-sm text-amber-200">Some action results need checking. Refreshing reads the current records; it does not repeat actions or clear these session safeguards.</p> : null}
    <section className={panelClass} aria-labelledby={`${id}-filters`}>
      <h2 id={`${id}-filters`} className="mb-4 flex items-center gap-2 text-lg font-bold"><Filter aria-hidden="true" className="h-4 w-4" /> Search and filters</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2"><label htmlFor={`${id}-search`} className="mb-2 block text-sm font-semibold">Search lotteries</label>
          <div className="relative"><Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/75" />
            <input ref={searchInput} id={`${id}-search`} type="search" maxLength={200} value={filters.q} placeholder="Title, slug, ID or reference" onChange={(event) => updateFilters({ q: event.target.value }, true)} className={`${inputClass} pl-10 pr-12`} />
            {filters.q ? <button type="button" aria-label="Clear search" onClick={() => { updateFilters({ q: "" }, true); searchInput.current?.focus(); }} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-300"><X aria-hidden="true" className="h-4 w-4" /></button> : null}
          </div>
        </div>
        <Select id={`${id}-status`} label="Status" value={filters.status} onChange={(value) => updateFilters({ status: value as Filters["status"] })}><option value="all">All statuses</option>{STATUSES.map((value) => <option key={value} value={value}>{statusLabel(value)}</option>)}</Select>
        <Select id={`${id}-type`} label="Lottery type" value={filters.type} onChange={(value) => updateFilters({ type: value })}><option value="all">All types</option>{filters.type !== "all" && !types.includes(filters.type) ? <option value={filters.type}>{filters.type} (not in loaded records)</option> : null}{types.map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</Select>
        <Select id={`${id}-year`} label="Created year (UK)" value={filters.year} onChange={(value) => updateFilters({ year: value })}><option value="all">All years</option>{filters.year !== "all" && !years.includes(filters.year) ? <option value={filters.year}>{filters.year} (not in loaded records)</option> : null}{years.map((value) => <option key={value} value={value}>{value}</option>)}</Select>
      </div>
      <div className="mt-4 flex flex-wrap items-end gap-4"><div className="w-full max-w-sm"><Select id={`${id}-sort`} label="Sort" value={filters.sort} onChange={(value) => updateFilters({ sort: value as Sort })}>{([['created_desc','Newest created'],['created_asc','Oldest created'],['closing_asc','Closing date'],['draw_asc','Draw date'],['revenue_desc','Revenue'],['tickets_desc','Ticket count']] as [Sort,string][]).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</Select></div><button type="button" onClick={() => { updateFilters({ ...DEFAULT_FILTERS }); searchInput.current?.focus(); }} className={`${buttonClass} border border-white/25`}>Reset filters</button></div>
    </section>
    <section className={panelClass} aria-labelledby={`${id}-list`} aria-busy={loading}>
      <h2 id={`${id}-list`} className="text-lg font-bold">Lottery list</h2>
      <p role="status" className="mt-2 min-h-6 text-sm text-white/80">{hasSnapshot ? `${filtered.length} matching ${items.length} loaded records${loadProblem ? " (previous snapshot)" : ""}.` : loading ? "Loading records…" : "No verified list is available."}</p>
      {loading ? <div role="status" className="flex min-h-48 items-center justify-center gap-2 text-white/80"><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin motion-reduce:animate-none" /> Loading lotteries…</div>
        : !hasSnapshot ? <p className="py-8 text-white/80">Refresh to load the lottery list.</p>
        : !filtered.length ? <div className="py-8"><h3 className="font-bold">{items.length ? "No matching lotteries" : "No lotteries in this response"}</h3><p className="mt-2 text-sm text-white/80">{items.length ? "Change or reset the filters." : "Create a draft when your account access and compliance profiles are available."}</p></div>
        : <div className="mt-4 space-y-4">{visible.map((item) => <LotteryRow key={item.id} item={item} access={access} blocked={mutationsBlocked || uncertainIds.has(item.id) || createOpen} navigatingBlocked={!!busyId} uncertain={uncertainIds.has(item.id)} busy={busyId === item.id} onAction={(type) => openAction(type,item)} />)}</div>}
      <nav aria-label="Lottery list pages" className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <button type="button" disabled={page <= 1 || loading || !hasSnapshot} className={`${buttonClass} border border-white/25`} onClick={() => updateFilters({ page: page - 1 })}>Previous</button>
        <p className="text-sm text-white/80">Page {page} of {pages}{filtered.length ? ` · ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, filtered.length)} of ${filtered.length} matches` : ""}</p>
        <button type="button" disabled={page >= pages || loading || !hasSnapshot} className={`${buttonClass} border border-white/25`} onClick={() => updateFilters({ page: page + 1 })}>Next</button>
      </nav>
    </section>
    {selection ? <ActionDialog key={`${selection.type}:${selection.item.id}`} selection={selection} busy={!!busyId} error={modalError} fallbackFocusId={`${id}-heading`} onClose={closeAction} onConfirm={(password,confirmation) => void executeAction(password,confirmation)} /> : null}
    <CreateLotteryModal open={createOpen} onClose={() => setCreateOpen(false)} profiles={access?.create ? profiles : undefined} csrfToken={csrfToken} onCreated={async () => { if (!await loadItems()) throw new Error("The lottery list could not be refreshed."); }} />
  </div>;
}

const panelClass = "rounded-3xl border border-white/15 bg-white/10 p-5 shadow-xl backdrop-blur-xl";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold enabled:cursor-pointer enabled:hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-50";
const inputClass = "min-h-11 w-full min-w-0 rounded-xl border border-white/25 bg-[#101221] px-4 py-3 text-sm text-white placeholder:text-white/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:opacity-60";
function Select({ id, label, value, onChange, children }: { id: string; label: string; value: string; onChange: (value: string) => void; children: ReactNode }) {
  return <div className="min-w-0"><label htmlFor={id} className="mb-2 block text-sm font-semibold">{label}</label><select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${inputClass} cursor-pointer`}>{children}</select></div>;
}
function NavLink({ href, disabled, children, external = false }: { href: string; disabled: boolean; children: ReactNode; external?: boolean }) {
  const classes = `${buttonClass} border border-white/25`;
  return disabled ? <span aria-disabled="true" className={`${classes} cursor-not-allowed opacity-50`}>{children}</span> : <Link href={href} className={`${classes} cursor-pointer hover:bg-white/10`} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>{children}</Link>;
}
function LotteryRow({ item, access, blocked, navigatingBlocked, uncertain, busy, onAction }: { item: Lottery; access?: LotteryListAccess; blocked: boolean; navigatingBlocked: boolean; uncertain: boolean; busy: boolean; onAction: (type: ActionType) => void }) {
  const detail = `${ROOT}/Lotteries/${encodeURIComponent(item.id)}`;
  return <article className="rounded-2xl border border-white/20 bg-black/20 p-5">
    <div className="flex flex-wrap items-center gap-3"><h3 className="break-words text-lg font-extrabold">{item.title}</h3><span className={`rounded-full border px-3 py-1 text-xs ${statusClass(item.status)}`}>{statusLabel(item.status)}</span><span className="text-sm text-white/80">{item.lottery_type.replaceAll("_", " ")}</span></div>
    <p className="mt-2 break-words text-xs text-white/75">Slug: {item.slug} · Reference: {item.internal_reference || "Not set"} · ID: {item.id}</p>
    {item.short_summary ? <p className="mt-3 break-words text-sm text-white/80">{item.short_summary}</p> : null}
    <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([
      ["Ticket price", formatMoney(item.ticket_price,item.currency)], ["Sales close",formatDate(item.sales_close_at)],
      ["Draw",formatDate(item.draw_at)], ["Tickets issued",item.ticket_count === undefined ? "Unavailable" : item.ticket_count.toLocaleString("en-GB")],
    ] as [string,string][]).map(([label,value]) => <div key={label} className="rounded-xl border border-white/15 p-3"><dt className="text-xs text-white/75">{label}</dt><dd className="mt-1 break-words text-sm font-bold">{value}</dd></div>)}</dl>
    {uncertain ? <p className="mt-3 text-sm text-amber-200">An action result needs checking. Further actions are blocked in this session.</p> : null}
    {busy ? <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> Processing the requested action…</p> : null}
    <div className="mt-4 flex flex-wrap gap-2">
      <NavLink href={detail} disabled={navigatingBlocked}><Eye aria-hidden="true" className="h-4 w-4" /> View</NavLink>
      {access?.edit ? <NavLink href={`${detail}/Edit`} disabled={navigatingBlocked}>Edit</NavLink> : null}
      <NavLink href={`${ROOT}/Compliance`} disabled={navigatingBlocked}><ShieldCheck aria-hidden="true" className="h-4 w-4" /> Compliance</NavLink>
      {actionAllowed("duplicate",item,access) ? <button type="button" disabled={blocked} onClick={() => onAction("duplicate")} className={`${buttonClass} border border-white/25`}><Copy aria-hidden="true" className="h-4 w-4" /> Duplicate</button> : null}
      {publicLinkAvailable(item) ? <NavLink href={`/Lottery/${encodeURIComponent(item.slug)}`} disabled={navigatingBlocked} external><ExternalLink aria-hidden="true" className="h-4 w-4" /> Public page</NavLink> : null}
      {actionAllowed("close_sales",item,access) ? <button type="button" disabled={blocked} onClick={() => onAction("close_sales")} className={`${buttonClass} border border-orange-300/40 text-orange-200`}><XCircle aria-hidden="true" className="h-4 w-4" /> Close sales</button> : null}
      {actionAllowed("archive",item,access) ? <button type="button" disabled={blocked} onClick={() => onAction("archive")} className={`${buttonClass} border border-white/25`}><Archive aria-hidden="true" className="h-4 w-4" /> Archive</button> : null}
      {actionAllowed("delete",item,access) ? <button type="button" disabled={blocked} onClick={() => onAction("delete")} className={`${buttonClass} border border-rose-300/40 text-rose-200`}><Trash2 aria-hidden="true" className="h-4 w-4" /> Delete</button> : null}
    </div>
  </article>;
}
function ProblemPanel({ problem }: { problem: Problem }) {
  return <section role="alert" className="rounded-2xl border border-rose-300/40 bg-rose-500/10 p-5 text-rose-100"><p className="font-bold">{problem.action}</p><p className="mt-2 break-words text-sm">{problem.message}</p><p className="mt-3 break-words text-xs">Code: {problem.code}{problem.httpStatus ? ` · HTTP ${problem.httpStatus}` : ""}{problem.requestId ? ` · Request ID: ${problem.requestId}` : ""} · {formatDate(problem.occurredAt)}</p></section>;
}
function ActionDialog({ selection, busy, error, fallbackFocusId, onClose, onConfirm }: { selection: Selection; busy: boolean; error: string | null; fallbackFocusId: string; onClose: () => void; onConfirm: (password: string, confirmation: string) => void }) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const [confirmation, setConfirmation] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const deletion = selection.type === "delete";
  const matches = confirmation === selection.item.title;
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (element && !element.open) element.showModal();
    cancelButton.current?.focus();
    return () => {
      if (element?.open) element.close(); document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected && !(previousFocus instanceof HTMLButtonElement && previousFocus.disabled)) previousFocus.focus();
      else document.getElementById(fallbackFocusId)?.focus();
    };
  }, [fallbackFocusId]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (deletion && (!matches || !password))) return;
    const secret = password;
    setPassword(""); setVisible(false);
    onConfirm(secret,confirmation);
  }
  const description = selection.type === "delete" ? "This requests permanent deletion. Related records may be removed. Check retention and financial records before continuing."
    : selection.type === "archive" ? "Archive this completed or cancelled lottery as a historical record."
    : selection.type === "close_sales" ? "Request closure of new ticket sales. Check the lottery and closing time before continuing."
    : "Request a new private draft based on this lottery. Review the duplicate and its prizes before publishing.";
  return <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`} onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    className="fixed inset-0 m-auto max-h-[94dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-3xl border border-white/20 bg-[#15172a] p-5 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm">
    <form noValidate onSubmit={submit} aria-busy={busy}>
      <div className="flex items-start justify-between gap-4"><h2 id={`${id}-title`} className="text-xl font-extrabold">{actionLabel(selection.type)}?</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close confirmation" className={`${buttonClass} border border-white/25 px-3`}><X aria-hidden="true" className="h-4 w-4" /></button></div>
      <p id={`${id}-description`} className="mt-4 text-sm leading-6 text-white/85">{description}</p>
      <p className="mt-4 break-words font-bold">{selection.item.title}</p><p className="mt-1 break-words text-xs text-white/75">{selection.item.slug} · {statusLabel(selection.item.status)}</p>
      {deletion ? <fieldset disabled={busy} className="mt-5 min-w-0 space-y-4 border-0 p-0"><legend className="sr-only">Deletion verification</legend>
        <div><label htmlFor={`${id}-confirmation`} className="mb-2 block text-sm font-bold">Type the lottery name exactly</label><input id={`${id}-confirmation`} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" spellCheck={false} maxLength={500} className={inputClass} aria-invalid={!!confirmation && !matches} aria-describedby={`${id}-confirmation-help`} /><p id={`${id}-confirmation-help`} className={`mt-2 text-xs ${confirmation && !matches ? "text-rose-200" : "text-white/80"}`}>{confirmation && !matches ? "The name must match exactly, including capitals and spaces." : "Enter the full lottery title shown above."}</p></div>
        <div><label htmlFor={`${id}-password`} className="mb-2 block text-sm font-bold">Main administrator password</label><div className="relative"><input id={`${id}-password`} type={visible ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" className={`${inputClass} pr-14`} aria-describedby={`${id}-password-help`} /><button type="button" disabled={busy} aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((value) => !value)} className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-fuchsia-300">{visible ? <EyeOff aria-hidden="true" className="h-4 w-4" /> : <Eye aria-hidden="true" className="h-4 w-4" />}</button></div><p id={`${id}-password-help`} className="mt-2 text-xs text-white/80">The password field is cleared when submitted. It is sent only to the verification and deletion requests.</p></div>
      </fieldset> : null}
      {error ? <p ref={errorRef} tabIndex={-1} role="alert" className="mt-4 text-sm text-rose-200 outline-none">{error}</p> : null}
      <div className="mt-6 flex flex-wrap justify-end gap-3"><button ref={cancelButton} type="button" disabled={busy} onClick={onClose} className={`${buttonClass} border border-white/25`}>Cancel</button><button type="submit" disabled={busy || (deletion && (!matches || !password))} className={`${buttonClass} ${deletion ? "bg-rose-200 text-black" : "bg-white text-black"}`}>{busy ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : null}{actionLabel(selection.type)}</button></div>
    </form>
  </dialog>;
}
