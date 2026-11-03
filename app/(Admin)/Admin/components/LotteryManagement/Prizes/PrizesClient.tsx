"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, Eye, Filter, Gift, Image as ImageIcon, Loader2, Pencil, Plus, RefreshCw, Search, Trophy, X, } from "lucide-react";
type PrizeStatus = "draft" | "confirmed" | "available_for_draw" | "allocated" | "claimed" | "fulfilled" | "unclaimed" | "withdrawn";
type PrizeRecord = {
    id: string;
    lottery_id: string;
    lottery_title: string;
    lottery_slug: string;
    name: string;
    description: string | null;
    image_url: string | null;
    quantity: number | null;
    declared_value: number | null;
    is_donated: boolean | null;
    donor_name: string | null;
    sponsor_name: string | null;
    display_order: number | null;
    eligibility_restrictions: string | null;
    fulfilment_requirements: string | null;
    fulfilment_notes: string | null;
    status: PrizeStatus;
    allocated_winner_id: string | null;
    allocated_at: string | null;
    claimed_at: string | null;
    fulfilled_at: string | null;
    unclaimed_at: string | null;
    withdrawn_at: string | null;
    created_at: string | null;
    updated_at: string | null;
    winner_name: string | null;
    winner_email: string | null;
    winner_claimed: boolean | null;
};
type LotteryOption = {
    id: string;
    title: string;
    slug: string;
    status: string;
    is_active: boolean;
    draw_at: string | null;
};
type ApiResponse = {
    ok: boolean;
    items?: PrizeRecord[];
    lotteries?: LotteryOption[];
    item?: PrizeRecord;
    error?: string;
    message?: string;
    request_id?: string;
};
const API_ROUTE = "/api/admin/lotterymanagement/prizes";
const STATUS_OPTIONS: Array<{
    value: PrizeStatus | "all";
    label: string;
}> = [
    { value: "all", label: "All prize statuses" },
    { value: "draft", label: "Draft" },
    { value: "confirmed", label: "Confirmed" },
    { value: "available_for_draw", label: "Ready for draw" },
    { value: "allocated", label: "Allocated" },
    { value: "claimed", label: "Claimed" },
    { value: "fulfilled", label: "Fulfilled" },
    { value: "unclaimed", label: "Unclaimed" },
    { value: "withdrawn", label: "Withdrawn" },
];
const PRIZE_NAME_SUGGESTIONS = ["Gold", "Silver", "Bronze"];
const inputClass = "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/50 focus:ring-2 focus:ring-purple-300";
const readableOptionClass = "bg-white text-slate-950";
function statusLabel(status: PrizeStatus) {
    return STATUS_OPTIONS.find((x) => x.value === status)?.label || status;
}
function statusClass(status: PrizeStatus) {
    const map: Record<PrizeStatus, string> = {
        draft: "border-white/15 bg-white/10 text-white/70",
        confirmed: "border-blue-400/25 bg-blue-500/10 text-blue-200",
        available_for_draw: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
        allocated: "border-purple-400/25 bg-purple-500/10 text-purple-200",
        claimed: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
        fulfilled: "border-teal-400/25 bg-teal-500/10 text-teal-200",
        unclaimed: "border-amber-400/25 bg-amber-500/10 text-amber-200",
        withdrawn: "border-red-400/25 bg-red-500/10 text-red-200",
    };
    return map[status];
}
function formatMoney(value: number | null) {
    if (value == null || !Number.isFinite(value) || value < 0)
        return "Unavailable";
    return new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: "GBP",
    }).format(Number(value || 0));
}
function formatDate(value: string | null) {
    if (!value)
        return "Not recorded";
    if (Number.isNaN(new Date(value).getTime()))
        return "Invalid date";
    return new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/London",
    }).format(new Date(value));
}
const MAX_RECORDS = 1000;
const PAGE_SIZE = 25;
const SETUP_STATUSES: PrizeStatus[] = ["draft", "confirmed", "available_for_draw"];
type PrizeForm = {
    lottery_id: string;
    name: string;
    description: string;
    image_url: string;
    quantity: string;
    declared_value: string;
    is_donated: boolean;
    donor_name: string;
    sponsor_name: string;
    display_order: string;
    eligibility_restrictions: string;
    fulfilment_requirements: string;
    fulfilment_notes: string;
    status: PrizeStatus;
};
class PrizeError extends Error {
    constructor(message: string, public status?: number) { super(message); }
}
function isObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}
function safeImage(value: string | null) {
    if (!value)
        return false;
    try {
        const url = new URL(value);
        return url.protocol === "https:" && !url.username && !url.password;
    }
    catch {
        return false;
    }
}
function parsePrize(value: unknown): PrizeRecord {
    if (!isObject(value) || typeof value.id !== "string" || !value.id || typeof value.lottery_id !== "string" || !value.lottery_id ||
        typeof value.name !== "string" || !value.name || !STATUS_OPTIONS.some(option => option.value !== "all" && option.value === value.status))
        throw new PrizeError("Invalid prize records were returned.");
    const item: Record<string, unknown> = { id: value.id, lottery_id: value.lottery_id, name: value.name, status: value.status };
    for (const key of ["lottery_title", "lottery_slug", "description", "image_url", "donor_name", "sponsor_name", "eligibility_restrictions",
        "fulfilment_requirements", "fulfilment_notes", "allocated_winner_id", "allocated_at", "claimed_at", "fulfilled_at", "unclaimed_at", "withdrawn_at", "created_at", "updated_at", "winner_name", "winner_email"]) {
        if (value[key] != null && typeof value[key] !== "string")
            throw new PrizeError("Invalid prize fields were returned.");
        item[key] = value[key] ?? (key === "lottery_title" ? "Unavailable" : key === "lottery_slug" ? "" : null);
    }
    for (const key of ["quantity", "declared_value", "display_order"]) {
        const n = value[key];
        if (n != null && (typeof n !== "number" || !Number.isFinite(n) || n < 0 || (key !== "declared_value" && !Number.isSafeInteger(n))))
            throw new PrizeError("Invalid prize figures were returned.");
        item[key] = n ?? null;
    }
    for (const key of ["is_donated", "winner_claimed"]) {
        if (value[key] != null && typeof value[key] !== "boolean")
            throw new PrizeError("Invalid prize flags were returned.");
        item[key] = value[key] ?? null;
    }
    return item as PrizeRecord;
}
function parseList<T>(value: unknown, parser: (value: unknown) => T & {
    id: string;
}): T[] {
    if (!Array.isArray(value) || value.length > MAX_RECORDS)
        throw new PrizeError("The server must return a bounded register. Ask the administrator to enable server pagination.");
    const ids = new Set<string>();
    return value.map(raw => { const item = parser(raw); if (ids.has(item.id))
        throw new PrizeError("Duplicate records were returned."); ids.add(item.id); return item; });
}
function parseLottery(value: unknown): LotteryOption {
    if (!isObject(value) || typeof value.id !== "string" || !value.id || typeof value.title !== "string" || typeof value.slug !== "string" ||
        typeof value.status !== "string" || typeof value.is_active !== "boolean" || (value.draw_at != null && typeof value.draw_at !== "string"))
        throw new PrizeError("Invalid lottery options were returned.");
    return { id: value.id, title: value.title, slug: value.slug, status: value.status, is_active: value.is_active, draw_at: value.draw_at as string | null ?? null };
}
async function requestPrizes(init: RequestInit, signal: AbortSignal): Promise<ApiResponse> {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted)
        abort();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(); }, 20000);
    try {
        const response = await fetch(API_ROUTE, { ...init, signal: controller.signal, cache: "no-store", credentials: "include",
            headers: { Accept: "application/json", ...(init.method !== "GET" ? { "Content-Type": "application/json" } : {}) } });
        if (response.status === 401 || response.status === 403) {
            await response.body?.cancel().catch(() => undefined);
            throw new PrizeError(response.status === 401 ? "Your session has expired. Sign in again." : "You do not have permission to access or change prizes.", response.status);
        }
        const reader = response.body?.getReader();
        if (!reader)
            throw new PrizeError("The server returned an unreadable response.");
        const decoder = new TextDecoder();
        let text = "";
        let size = 0;
        let raw: unknown;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done)
                    break;
                size += value.byteLength;
                if (size > 5 * 1024 * 1024)
                    throw new PrizeError("The response is too large. Ask the administrator to enable server pagination.");
                text += decoder.decode(value, { stream: true });
            }
            text += decoder.decode();
            try {
                raw = JSON.parse(text);
            }
            catch {
                throw new PrizeError("The server returned an unreadable response.");
            }
        }
        finally {
            await reader.cancel().catch(() => undefined);
            reader.releaseLock();
        }
        if (!isObject(raw))
            throw new PrizeError("The server returned an unexpected response.");
        if (!response.ok || raw.ok !== true) {
            const reference = typeof raw.request_id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(raw.request_id) ? ` Request reference: ${raw.request_id}.` : "";
            throw new PrizeError((response.status === 409 ? "The prize changed or this action requires a separate workflow. Refresh and review it." : response.status === 429 ? "Too many requests. Wait before trying again." : "The server rejected this request. Check the fields, permissions and required approval.") + reference, response.status);
        }
        return { ok: true, ...(init.method === "GET" ? { items: parseList(raw.items, parsePrize), lotteries: raw.lotteries == null ? [] : parseList(raw.lotteries, parseLottery) } : { item: raw.item == null ? undefined : parsePrize(raw.item) }) };
    }
    catch (caught) {
        if (timedOut && !signal.aborted)
            throw new PrizeError("The request timed out. Refresh and check the stored result.");
        if (caught instanceof PrizeError)
            throw caught;
        throw new PrizeError("Unable to connect. Check your connection and refresh before continuing.");
    }
    finally {
        clearTimeout(timer);
        signal.removeEventListener("abort", abort);
    }
}
function ModalSurface({ children, titleId, onClose, busy = false }: {
    children: React.ReactNode;
    titleId: string;
    onClose: () => void;
    busy?: boolean;
}) {
    const ref = useRef<HTMLDialogElement>(null);
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
        onClose(); }} className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-5xl overflow-y-auto rounded-3xl border border-white/10 bg-[#15172a] p-0 text-white shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-sm">{children}</dialog>;
}
function newPrizeForm(lotteryId: string, items: PrizeRecord[]): PrizeForm {
    return {
        lottery_id: lotteryId,
        name: "",
        description: "",
        image_url: "",
        quantity: "1",
        declared_value: "",
        is_donated: false,
        donor_name: "",
        sponsor_name: "",
        display_order: String(Math.max(-1, ...items
            .filter((item) => item.lottery_id === lotteryId)
            .map((item) => Number(item.display_order) || 0)) + 1),
        eligibility_restrictions: "",
        fulfilment_requirements: "",
        fulfilment_notes: "",
        status: "draft",
    };
}

export default function PrizesClient() {
    const [items, setItems] = useState<PrizeRecord[]>([]);
    const [lotteryOptions, setLotteryOptions] = useState<LotteryOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<PrizeRecord | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [editing, setEditing] = useState<PrizeRecord | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [uncertain, setUncertain] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [readyPrize, setReadyPrize] = useState<PrizeRecord | null>(null);
    const [reason, setReason] = useState("");
    const alive = useRef(false);
    const busyRef = useRef(false);
    const activeLoad = useRef<AbortController | null>(null);
    const activeMutation = useRef<AbortController | null>(null);
    const loadVersion = useRef(0);
    const [updatingPrizeId, setUpdatingPrizeId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState<PrizeStatus | "all">("all");
    const [lotteryId, setLotteryId] = useState("all");
    const [source, setSource] = useState("all");
    const [sort, setSort] = useState("display_order");
    const [form, setForm] = useState(() => newPrizeForm("", []));
    const loadPrizes = useCallback(async () => {
        if (busyRef.current)
            return;
        activeLoad.current?.abort();
        const controller = new AbortController();
        activeLoad.current = controller;
        const version = ++loadVersion.current;
        const current = () => alive.current && !controller.signal.aborted && version === loadVersion.current;
        setLoading(true);
        setError(null);
        setSelected(null);
        setEditorOpen(false);
        setReadyPrize(null);
        try {
            const data = await requestPrizes({ method: "GET" }, controller.signal);
            if (!current())
                return;
            setItems(data.items!);
            setLotteryOptions(data.lotteries!);
            setHasLoaded(true);
            setUncertain(false);
        }
        catch (caught) {
            if (!current())
                return;
            setItems([]);
            setLotteryOptions([]);
            setHasLoaded(false);
            setError(caught instanceof PrizeError ? caught.message : "Unable to load prizes. Try again.");
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
        void loadPrizes();
        return () => { alive.current = false; activeLoad.current?.abort(); activeMutation.current?.abort(); loadVersion.current += 1; };
    }, [loadPrizes]);
    useEffect(() => { setPage(1); }, [search, status, lotteryId, source, sort]);
    const lotteries = useMemo(() => {
        const map = new Map<string, LotteryOption>();
        lotteryOptions.forEach((lottery) => {
            map.set(lottery.id, lottery);
        });
        items.forEach((item) => {
            if (!map.has(item.lottery_id)) {
                map.set(item.lottery_id, {
                    id: item.lottery_id,
                    title: item.lottery_title,
                    slug: item.lottery_slug,
                    status: "historical",
                    is_active: false,
                    draw_at: null,
                });
            }
        });
        return Array.from(map.values()).sort((a, b) => {
            const dateA = a.draw_at ? new Date(a.draw_at).getTime() : Number.MAX_SAFE_INTEGER;
            const dateB = b.draw_at ? new Date(b.draw_at).getTime() : Number.MAX_SAFE_INTEGER;
            return dateA - dateB || a.title.localeCompare(b.title);
        });
    }, [items, lotteryOptions]);
    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const result = items.filter((item) => {
            const matchesSearch = !q ||
                item.name.toLowerCase().includes(q) ||
                item.lottery_title.toLowerCase().includes(q) ||
                (item.description || "").toLowerCase().includes(q) ||
                (item.donor_name || "").toLowerCase().includes(q) ||
                (item.sponsor_name || "").toLowerCase().includes(q) ||
                (item.winner_name || "").toLowerCase().includes(q);
            const matchesStatus = status === "all" || item.status === status;
            const matchesLottery = lotteryId === "all" || item.lottery_id === lotteryId;
            const matchesSource = source === "all" ||
                (source === "donated" && item.is_donated) ||
                (source === "purchased" && item.is_donated === false);
            return matchesSearch && matchesStatus && matchesLottery && matchesSource;
        });
        return result.sort((a, b) => {
            switch (sort) {
                case "created_desc":
                    return (b.created_at ? new Date(b.created_at).getTime() : 0) - (a.created_at ? new Date(a.created_at).getTime() : 0);
                case "value_desc":
                    return Number(b.declared_value || 0) - Number(a.declared_value || 0);
                case "name_asc":
                    return a.name.localeCompare(b.name);
                default:
                    return ((a.display_order ?? Number.MAX_SAFE_INTEGER) - (b.display_order ?? Number.MAX_SAFE_INTEGER) ||
                        a.name.localeCompare(b.name));
            }
        });
    }, [items, search, status, lotteryId, source, sort]);
    const totalValue = items.some(item => item.declared_value == null || item.quantity == null) ? null :
        items.reduce((sum, item) => sum + item.declared_value! * item.quantity!, 0);
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const visiblePage = Math.min(page, pageCount);
    const visibleItems = filtered.slice((visiblePage - 1) * PAGE_SIZE, visiblePage * PAGE_SIZE);
    const available = items.filter((x) => x.status === "available_for_draw").length;
    const allocated = items.filter((x) => ["allocated", "claimed", "fulfilled"].includes(x.status)).length;
    const unclaimed = items.filter((x) => x.status === "unclaimed").length;
    function openCreate() {
        if (busyRef.current || loading || uncertain)
            return;
        setSelected(null);
        setEditing(null);
        const selectedLotteryId = lotteryOptions.find(item => item.id === lotteryId)?.id || lotteryOptions[0]?.id || "";
        setForm(newPrizeForm(selectedLotteryId, items));
        setEditorOpen(true);
        setError(null);
    }
    function openEdit(item: PrizeRecord) {
        if (busyRef.current || loading || uncertain || !SETUP_STATUSES.includes(item.status) || item.allocated_winner_id)
            return;
        setSelected(null);
        setEditing(item);
        setForm({
            lottery_id: item.lottery_id,
            name: item.name,
            description: item.description || "",
            image_url: item.image_url || "",
            quantity: item.quantity == null ? "" : String(item.quantity),
            declared_value: item.declared_value === null ? "" : String(item.declared_value),
            is_donated: item.is_donated === true,
            donor_name: item.donor_name || "",
            sponsor_name: item.sponsor_name || "",
            display_order: item.display_order == null ? "" : String(item.display_order),
            eligibility_restrictions: item.eligibility_restrictions || "",
            fulfilment_requirements: item.fulfilment_requirements || "",
            fulfilment_notes: item.fulfilment_notes || "",
            status: item.status,
        });
        setEditorOpen(true);
        setError(null);
    }
    async function persistPrize(payload: Record<string, unknown>, method: "PATCH" | "POST", expectedId?: string, addAnother = false) {
        if (busyRef.current || uncertain)
            return;
        busyRef.current = true;
        setSaving(true);
        setError(null);
        setNotice(null);
        activeLoad.current?.abort();
        loadVersion.current += 1;
        const controller = new AbortController();
        activeMutation.current = controller;
        const baseline = expectedId ? items.find(item => item.id === expectedId) : undefined;
        try {
            const data = await requestPrizes({ method, body: JSON.stringify(payload) }, controller.signal);
            if (!alive.current || controller.signal.aborted)
                return;
            // A create must return its real ID. Do not guess by name: names need not be unique.
            const id = expectedId || data.item?.id;
            if (!id)
                throw new PrizeError("The new prize ID was not returned.");
            const refreshed = await requestPrizes({ method: "GET" }, controller.signal);
            if (!alive.current || controller.signal.aborted)
                return;
            const actual = refreshed.items!.find(item => item.id === id);
            setItems(refreshed.items!);
            setLotteryOptions(refreshed.lotteries!);
            setHasLoaded(true);
            if (!actual || Object.entries(payload).some(([key, value]) => key !== "id" && key !== "reason" && (actual as unknown as Record<string, unknown>)[key] !== value))
                throw new PrizeError("The saved prize values could not be verified.");
            if (baseline) {
                if ((!Object.prototype.hasOwnProperty.call(payload, "status") && actual.status !== baseline.status) ||
                    actual.allocated_winner_id !== baseline.allocated_winner_id || actual.claimed_at !== baseline.claimed_at ||
                    actual.fulfilled_at !== baseline.fulfilled_at || actual.unclaimed_at !== baseline.unclaimed_at)
                    throw new PrizeError("The prize workflow changed while saving. Review it before taking another action.");
                if (payload.status === "available_for_draw" && ["name", "description", "image_url", "quantity", "declared_value", "is_donated", "donor_name", "sponsor_name", "display_order", "eligibility_restrictions", "fulfilment_requirements", "fulfilment_notes"].some(key => (actual as unknown as Record<string, unknown>)[key] !== (baseline as unknown as Record<string, unknown>)[key]))
                    throw new PrizeError("Readiness changed other prize details. Review the stored record.");
            }
            else if (actual.allocated_winner_id)
                throw new PrizeError("The newly created prize has an unexpected winner link.");
            if (addAnother) {
                setForm(newPrizeForm(actual.lottery_id, refreshed.items!));
            } else {
                setEditorOpen(false);
            }
            setEditing(null);
            setReadyPrize(null);
            setReason("");
            setSelected(null);
            setNotice("Prize changes saved and verified. Draw eligibility and compliance are checked separately.");
        }
        catch (caught) {
            if (!alive.current || controller.signal.aborted)
                return;
            const safe = caught instanceof PrizeError ? caught : new PrizeError("The save outcome could not be verified.");
            setUncertain(true);
            setError(safe.message + " The action may have completed. Close the dialog, refresh and check the stored result before retrying.");
            if (safe.status === 401 || safe.status === 403) {
                setItems([]);
                setLotteryOptions([]);
                setHasLoaded(false);
                setSelected(null);
                setEditorOpen(false);
                setReadyPrize(null);
            }
        }
        finally {
            if (alive.current && !controller.signal.aborted) {
                busyRef.current = false;
                setSaving(false);
                setUpdatingPrizeId(null);
            }
        }
    }
    async function savePrize(addAnother = false) {
        if (busyRef.current || uncertain)
            return;
        if (!form.lottery_id || (!editing && !lotteryOptions.some(item => item.id === form.lottery_id))) {
            setError("Select a returned lottery option.");
            return;
        }
        if (editing && (form.lottery_id !== editing.lottery_id || !SETUP_STATUSES.includes(editing.status) || editing.allocated_winner_id)) {
            setError("Allocated and winner-related prizes use the dedicated winner workflow.");
            return;
        }
        if (!form.name.trim()) {
            setError("Enter a prize name.");
            return;
        }
        if (!/^\d+$/.test(form.quantity) || !Number.isSafeInteger(Number(form.quantity)) || Number(form.quantity) < 1) {
            setError("Quantity must be a positive whole number.");
            return;
        }
        if (!/^\d+$/.test(form.display_order) || !Number.isSafeInteger(Number(form.display_order))) {
            setError("Display order must be a non-negative whole number.");
            return;
        }
        if (form.declared_value && (!/^\d+(?:\.\d{1,2})?$/.test(form.declared_value) || !Number.isSafeInteger(Math.round(Number(form.declared_value) * 100)))) {
            setError("Declared value must be non-negative and have no more than two decimal places.");
            return;
        }
        if (form.image_url.trim() && !safeImage(form.image_url.trim())) {
            setError("Use an HTTPS image URL without credentials.");
            return;
        }
        const body: Record<string, unknown> = {
            lottery_id: form.lottery_id, name: form.name.trim(), description: form.description.trim() || null,
            image_url: form.image_url.trim() || null, quantity: Number(form.quantity), declared_value: form.declared_value ? Number(form.declared_value) : null,
            is_donated: form.is_donated, donor_name: form.donor_name.trim() || null, sponsor_name: form.sponsor_name.trim() || null,
            display_order: Number(form.display_order), eligibility_restrictions: form.eligibility_restrictions.trim() || null,
            fulfilment_requirements: form.fulfilment_requirements.trim() || null, fulfilment_notes: form.fulfilment_notes.trim() || null,
        };
        if (editing) {
            if (editing.is_donated == null && !form.is_donated)
                delete body.is_donated;
            for (const [key, value] of Object.entries(body)) {
                if (key !== "lottery_id" && (editing as unknown as Record<string, unknown>)[key] === value)
                    delete body[key];
            }
            if (Object.keys(body).length === 1) {
                setError("No prize details have changed.");
                return;
            }
            body.id = editing.id;
        }
        else
            body.status = "draft";
        await persistPrize(body, editing ? "PATCH" : "POST", editing?.id, addAnother);
    }
    function requestReady(item: PrizeRecord) {
        if (busyRef.current || loading || uncertain || !["draft", "confirmed"].includes(item.status) || item.allocated_winner_id)
            return;
        setSelected(null);
        setReadyPrize(item);
        setReason("");
        setError(null);
    }
    async function confirmReady() {
        if (!readyPrize || !reason.trim() || busyRef.current || uncertain)
            return;
        setUpdatingPrizeId(readyPrize.id);
        // Winner/claim/fulfilment states are never editable through this screen.
        await persistPrize({ id: readyPrize.id, lottery_id: readyPrize.lottery_id, status: "available_for_draw", reason: reason.trim() }, "PATCH", readyPrize.id);
    }
    return (<div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Gift className="h-5 w-5 text-white"/>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-white">Prizes</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Manage prize details, values, donors, display order, eligibility,
                and fulfilment information. Winner allocation and status changes use the dedicated draw and winner workflows.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={() => void loadPrizes()} disabled={loading || saving} className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}/>
              Refresh
            </button>

            <button type="button" onClick={openCreate} disabled={loading || saving || uncertain || !lotteryOptions.length} className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90">
              <Plus className="h-4 w-4"/>
              Add prize
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Declared value (loaded, GBP)" value={!hasLoaded || loading ? "Unavailable" : formatMoney(totalValue)}/>
        <StatCard label="Recorded ready (loaded)" value={!hasLoaded || loading ? "Unavailable" : String(available)}/>
        <StatCard label="Allocated / claimed (loaded)" value={!hasLoaded || loading ? "Unavailable" : String(allocated)}/>
        <StatCard label="Unclaimed (loaded)" value={!hasLoaded || loading ? "Unavailable" : String(unclaimed)}/>
      </section>

      {notice && <p role="status" className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100">{notice}</p>}
      {uncertain && <p role="alert" className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4 text-amber-100">Refresh and review the previous action before saving again.</p>}
      <p className="text-sm text-white/65">Totals describe loaded records only. Missing values remain unavailable. This screen displays 25 prizes per page; larger registers require server pagination.</p>
      {error ? (<div role="alert" className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65"/>
          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"/>
            <input aria-label="Search prizes" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Prize, donor, sponsor, winner or lottery..." className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/60"/>
          </div>

          <Select label="Prize status" value={status} onChange={(v) => setStatus(v as PrizeStatus | "all")}>
            {STATUS_OPTIONS.map((option) => (<option key={option.value} value={option.value}>
                {option.label}
              </option>))}
          </Select>

          <Select label="Lottery filter" value={lotteryId} onChange={setLotteryId}>
            <option value="all">All lotteries</option>
            {lotteryId !== "all" && !lotteries.some(item => item.id === lotteryId) && <option value={lotteryId}>Selected lottery (not in loaded records)</option>}
            {lotteries.map((lottery) => (<option key={lottery.id} value={lottery.id} className={readableOptionClass}>
                {lottery.title}
              </option>))}
          </Select>

          <Select label="Prize source" value={source} onChange={setSource}>
            <option value="all">All prize sources</option>
            <option value="donated">Donated</option>
            <option value="purchased">Purchased</option>
          </Select>
        </div>

        {search && <button type="button" onClick={() => setSearch("")} className="mt-3 rounded-xl border border-white/15 p-3 text-sm text-white focus-visible:ring-2 focus-visible:ring-purple-300">Clear search</button>}
        <div className="mt-3 max-w-sm">
          <Select label="Sort prizes" value={sort} onChange={setSort}>
            <option value="display_order">Display order</option>
            <option value="created_desc">Newest created</option>
            <option value="value_desc">Highest value</option>
            <option value="name_asc">Prize name A-Z</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Prize register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} prize {items.length === 1 ? "record" : "records"}
          </p>
        </div>

        {loading ? (<div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin"/>
            Loading prizes...
          </div>) : !hasLoaded ? <p className="p-5 text-white/65">Prizes unavailable. Use Refresh to try again.</p> : filtered.length === 0 ? (<div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Gift className="mx-auto h-8 w-8 text-white/30"/>
            <h3 className="mt-3 font-bold text-white">No prizes found</h3>
            <p className="mt-1 text-sm text-white/50">
              Add the first prize or change the selected filters.
            </p>
          </div>) : (<div className="space-y-4">
            {visibleItems.map((item) => (<PrizeRow key={item.id} item={item} onView={() => setSelected(item)} onEdit={() => openEdit(item)} onMakeReady={() => requestReady(item)} makingReady={updatingPrizeId === item.id} disabled={saving || uncertain || loading}/>))}
          </div>)}
      </section>

      {hasLoaded && filtered.length > 0 && <nav aria-label="Prize pages" className="flex flex-wrap items-center gap-3 text-white">
        <button type="button" disabled={visiblePage === 1} onClick={() => setPage(visiblePage - 1)} className="rounded-xl border border-white/15 p-3 disabled:opacity-40">Previous prizes</button>
        <span aria-live="polite">Page {visiblePage} of {pageCount}</span>
        <button type="button" disabled={visiblePage === pageCount} onClick={() => setPage(visiblePage + 1)} className="rounded-xl border border-white/15 p-3 disabled:opacity-40">Next prizes</button>
      </nav>}
      {readyPrize && <ModalSurface titleId="ready-prize-title" busy={saving} onClose={() => { if (!busyRef.current)
            setReadyPrize(null); }}>
        <div className="p-6"><h2 id="ready-prize-title" className="text-xl font-bold">Make {readyPrize.name} ready for draw?</h2>
          <p className="mt-3 text-sm text-white/75">This requests a prize status change. The server must enforce permissions, approval and draw restrictions. This does not select a winner or prove overall draw readiness.</p>
          <label className="mt-5 block text-white">Reason<input value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} disabled={saving || uncertain} className={inputClass}/></label>
          {error && <p role="alert" className="mt-4 text-amber-100">{error}</p>}
          <div className="mt-5 flex gap-3"><button type="button" autoFocus disabled={saving} onClick={() => setReadyPrize(null)} className="rounded-xl border border-white/15 p-3 text-white">Cancel</button><button type="button" disabled={saving || uncertain || !reason.trim()} onClick={() => void confirmReady()} className="rounded-xl bg-purple-500 p-3 text-white disabled:opacity-40">Confirm ready status</button></div>
        </div>
      </ModalSurface>}
      {selected ? (<PrizeDetailsModal prize={selected} onClose={() => setSelected(null)}/>) : null}

      {editorOpen ? (<PrizeEditor form={form} setForm={setForm} lotteries={editing ? lotteries : lotteryOptions} editing={editing} saving={saving} blocked={uncertain} error={error} onClose={() => !saving && setEditorOpen(false)} onSave={savePrize} onLotteryChange={(id) => setForm((current) => ({ ...current, lottery_id: id, display_order: newPrizeForm(id, items).display_order }))}/>) : null}
    </div>);
}
function StatCard({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-2xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-white/55">{label}</div>
    </div>);
}
// Native filter popups retain the browser-owned interaction used by the supplied screen.
function Select({ label, value, onChange, children, }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    children: React.ReactNode;
}) {
    return (<div className="relative">
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className="w-full appearance-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none [&>option]:bg-white [&>option]:text-slate-950">
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/60"/>
    </div>);
}
function PrizeRow({ item, onView, onEdit, onMakeReady, makingReady, disabled, }: {
    item: PrizeRecord;
    onView: () => void;
    onEdit: () => void;
    onMakeReady: () => void;
    makingReady: boolean;
    disabled: boolean;
}) {
    return (<article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="flex min-w-0 flex-1 gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
            {safeImage(item.image_url) ? (<img src={item.image_url!} referrerPolicy="no-referrer" alt="" className="h-full w-full object-cover"/>) : (<ImageIcon className="h-6 w-6 text-white/25"/>)}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-base font-extrabold text-white">{item.name}</h3>
              <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}>
                {statusLabel(item.status)}
              </span>

              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/55">
                {item.is_donated === true ? "Donated" : item.is_donated === false ? "Purchased" : "Unavailable"}
              </span>

              {item.allocated_winner_id ? (<span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
                  <Trophy className="h-3 w-3"/>
                  Allocated
                </span>) : null}
            </div>

            <p className="mt-2 text-sm font-semibold text-white/70">{item.lottery_title}</p>

            {item.description ? (<p className="mt-2 max-w-4xl text-sm leading-6 text-white/55">
                {item.description}
              </p>) : null}

            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Info label="Value" value={formatMoney(item.declared_value)}/>
              <Info label="Quantity" value={item.quantity == null ? "Unavailable" : String(item.quantity)}/>
              <Info label="Display order" value={item.display_order == null ? "Unavailable" : String(item.display_order)}/>
              <Info label="Donor / sponsor" value={item.donor_name || item.sponsor_name || "Not set"}/>
              <Info label="Winner" value={item.winner_name || "Not allocated"}/>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button type="button" onClick={onView} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
            <Eye className="h-3.5 w-3.5"/>
            View
          </button>

          <button type="button" onClick={onEdit} disabled={disabled || !SETUP_STATUSES.includes(item.status) || Boolean(item.allocated_winner_id)} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10">
            <Pencil className="h-3.5 w-3.5"/>
            Edit
          </button>

          {item.status === "draft" || item.status === "confirmed" ? (<button type="button" onClick={onMakeReady} disabled={makingReady || disabled || Boolean(item.allocated_winner_id)} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60">
              {makingReady ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<CheckCircle2 className="h-3.5 w-3.5"/>)}
              Make ready for draw
            </button>) : null}
        </div>
      </div>
    </article>);
}
function Info({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[10px] font-bold uppercase tracking-wide text-white/60">
        {label}
      </div>
      <div className="mt-1 break-words text-xs font-bold text-white/75">{value}</div>
    </div>);
}
function PrizeDetailsModal({ prize, onClose, }: {
    prize: PrizeRecord;
    onClose: () => void;
}) {
    return (<ModalSurface titleId="prize-details-title" onClose={onClose}>
      <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="prize-details-title" className="text-xl font-extrabold text-white">
              {prize.name}
            </h2>
            <p className="mt-1 text-sm text-white/55">{prize.lottery_title}</p>
          </div>

          <button type="button" autoFocus aria-label="Close prize dialog" onClick={onClose} className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10">
            <X className="h-5 w-5"/>
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DetailCard label="Status" value={statusLabel(prize.status)}/>
            <DetailCard label="Declared value" value={formatMoney(prize.declared_value)}/>
            <DetailCard label="Quantity" value={prize.quantity == null ? "Unavailable" : String(prize.quantity)}/>
            <DetailCard label="Source" value={prize.is_donated === true ? "Donated" : prize.is_donated === false ? "Purchased" : "Unavailable"}/>
          </div>

          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <Panel title="Prize information">
              <DetailRows rows={[
            ["Prize name", prize.name],
            ["Description", prize.description || "Not provided"],
            ["Display order", prize.display_order == null ? "Unavailable" : String(prize.display_order)],
            ["Donor", prize.donor_name || "Not recorded"],
            ["Sponsor", prize.sponsor_name || "Not recorded"],
            ["Eligibility restrictions", prize.eligibility_restrictions || "None recorded"],
            ["Fulfilment requirements", prize.fulfilment_requirements || "None recorded"],
        ]}/>
            </Panel>

            <Panel title="Winner allocation">
              <Link className="mb-4 block text-sm text-purple-200 underline" href={`/Admin/LotteryManagement/Winners?lottery=${encodeURIComponent(prize.lottery_id)}`}>Open winner workflow</Link>
              <DetailRows rows={[
            ["Winner", prize.winner_name || "Not allocated"],
            ["Allocated at", formatDate(prize.allocated_at)],
            ["Claimed at", formatDate(prize.claimed_at)],
            ["Fulfilled at", formatDate(prize.fulfilled_at)],
            ["Unclaimed at", formatDate(prize.unclaimed_at)],
            ["Withdrawn at", formatDate(prize.withdrawn_at)],
        ]}/>
            </Panel>

            <Panel title="Fulfilment notes">
              {prize.fulfilment_notes ? (<p className="text-sm leading-6 text-white/70">{prize.fulfilment_notes}</p>) : (<Empty text="No fulfilment notes recorded."/>)}
            </Panel>

            <Panel title="Limited record checks">
              <p className="text-sm leading-6 text-white/75">These are local record checks, not compliance approval or proof of draw integrity.</p>
              {["allocated", "claimed", "fulfilled", "unclaimed"].includes(prize.status) && <p className="mt-3 text-sm text-white/80">{prize.allocated_winner_id ? "A winner link is recorded." : "Warning: this winner-related status has no linked winner."}</p>}
              {prize.status === "fulfilled" && <p className="mt-3 text-sm text-white/80">{prize.fulfilled_at ? "A fulfilment timestamp is recorded." : "Warning: fulfilled status has no fulfilment timestamp."}</p>}
              {!prize.allocated_winner_id && <p className="mt-3 text-sm text-white/65">No winner link is recorded. Review allocation in the winner workflow.</p>}
            </Panel>
          </div>
        </div>
      </div>
    </ModalSurface>);
}
function PrizeEditor({ form, setForm, lotteries, editing, saving, blocked, error, onClose, onSave, onLotteryChange, }: {
    form: PrizeForm;
    setForm: React.Dispatch<React.SetStateAction<PrizeForm>>;
    lotteries: LotteryOption[];
    editing: PrizeRecord | null;
    saving: boolean;
    blocked: boolean;
    error: string | null;
    onClose: () => void;
    onSave: (addAnother?: boolean) => void;
    onLotteryChange: (id: string) => void;
}) {
    return (<ModalSurface titleId="prize-editor-title" onClose={onClose} busy={saving}>
      <div className="flex max-h-[88dvh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id="prize-editor-title" className="text-xl font-extrabold text-white">
              {editing ? "Edit prize" : "Add prize"}
            </h2>
            <p className="mt-1 text-sm text-white/55">
              Manage prize information and operational fulfilment details.
            </p>
          </div>

          <button type="button" autoFocus aria-label="Close prize dialog" onClick={onClose} disabled={saving} className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50">
            <X className="h-5 w-5"/>
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">
          {error && <p role="alert" className="mb-4 rounded-xl border border-amber-400/30 bg-amber-500/10 p-4 text-sm text-amber-100">{error}</p>}
          <fieldset disabled={saving || blocked} className="grid min-w-0 gap-4 border-0 p-0 md:grid-cols-2">
            <Field label="Lottery" required>
              <select value={form.lottery_id} onChange={(e) => onLotteryChange(e.target.value)} className={`${inputClass} [&>option]:bg-white [&>option]:text-slate-950`} disabled={Boolean(editing)}>
                <option value="" className={readableOptionClass}>
                  Select lottery
                </option>
                {lotteries.map((lottery) => (<option key={lottery.id} value={lottery.id} className={readableOptionClass}>
                    {lottery.title} — {lottery.status === "live" ? "Live" : lottery.status.replaceAll("_", " ")}
                  </option>))}
              </select>
            </Field>

            <Field label="Prize name" required>
              <input
                value={form.name}
                list="prize-name-suggestions"
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
                className={inputClass}
                required
              />
              <datalist id="prize-name-suggestions">
                {PRIZE_NAME_SUGGESTIONS.map((name) => <option key={name} value={name}/>)}
              </datalist>
            </Field>

            <Field label="Quantity" required>
              <input type="number" min="1" value={form.quantity} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, quantity: e.target.value }))} className={inputClass}/>
            </Field>

            <Field label="Declared value">
              <input type="number" min="0" step="0.01" value={form.declared_value} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, declared_value: e.target.value }))} className={inputClass}/>
            </Field>

            <div><p className="text-sm font-bold text-white">Status: {statusLabel(editing?.status || "draft")}</p><p className="mt-2 text-xs text-white/65">Winner, claim and fulfilment statuses use separate workflows. Ordinary edits do not change status.</p></div>
            <Field label="Display order">
              <input type="number" value={form.display_order} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, display_order: e.target.value }))} className={inputClass}/>
            </Field>

            <Field label="Image URL" full>
              <input value={form.image_url} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, image_url: e.target.value }))} className={inputClass} placeholder="https://..."/>
            </Field>

            <Field label="Description" full>
              <textarea value={form.description} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, description: e.target.value }))} className={`${inputClass} resize-none min-h-28`}/>
            </Field>

            <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
              <span className="text-sm font-semibold text-white/80">Donated prize</span>
              <input type="checkbox" checked={form.is_donated} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, is_donated: e.target.checked }))} className="h-5 w-5"/>
            </label>

            <Field label="Donor name">
              <input value={form.donor_name} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, donor_name: e.target.value }))} className={inputClass}/>
            </Field>

            <Field label="Sponsor name">
              <input value={form.sponsor_name} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, sponsor_name: e.target.value }))} className={inputClass}/>
            </Field>

            <Field label="Eligibility restrictions" full>
              <textarea value={form.eligibility_restrictions} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, eligibility_restrictions: e.target.value }))} className={`${inputClass} resize-none min-h-24`}/>
            </Field>

            <Field label="Collection / delivery requirements" full>
              <textarea value={form.fulfilment_requirements} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, fulfilment_requirements: e.target.value }))} className={`${inputClass} resize-none min-h-24`}/>
            </Field>

            <Field label="Fulfilment notes" full>
              <textarea value={form.fulfilment_notes} onChange={(e) => setForm((p: PrizeForm) => ({ ...p, fulfilment_notes: e.target.value }))} className={`${inputClass} resize-none min-h-24`}/>
            </Field>
          </fieldset>
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:justify-end md:px-6">
          <button type="button" autoFocus aria-label="Close prize dialog" onClick={onClose} disabled={saving} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
            Cancel
          </button>

          {!editing && (
            <button type="button" onClick={() => onSave(true)} disabled={saving || blocked} className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50">
              Save and add another
            </button>
          )}

          <button type="button" onClick={() => onSave()} disabled={saving || blocked} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:opacity-60">
            {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : <CheckCircle2 className="h-4 w-4"/>}
            {saving ? "Saving..." : editing ? "Update prize" : "Create prize"}
          </button>
        </div>
      </div>
    </ModalSurface>);
}
function Field({ label, required, full, children, }: {
    label: string;
    required?: boolean;
    full?: boolean;
    children: React.ReactNode;
}) {
    return (<label className={full ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-white/80">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
    </label>);
}
function DetailCard({ label, value }: {
    label: string;
    value: string;
}) {
    return (<div className="rounded-2xl border border-white/10 bg-black/20 p-4">
      <div className="text-xs font-bold uppercase tracking-wide text-white/60">{label}</div>
      <div className="mt-2 text-sm font-extrabold text-white">{value}</div>
    </div>);
}
function Panel({ title, children }: {
    title: string;
    children: React.ReactNode;
}) {
    return (<section className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="mb-4 font-extrabold text-white">{title}</h3>
      {children}
    </section>);
}
function DetailRows({ rows }: {
    rows: Array<[
        string,
        string
    ]>;
}) {
    return (<div className="divide-y divide-white/10">
      {rows.map(([label, value]) => (<div key={label} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:justify-between">
          <span className="text-sm text-white/65">{label}</span>
          <span className="break-words text-sm font-semibold text-white/80 sm:max-w-[60%] sm:text-right">
            {value}
          </span>
        </div>))}
    </div>);
}
function Empty({ text }: {
    text: string;
}) {
    return (<div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/65">
      {text}
    </div>);
}
