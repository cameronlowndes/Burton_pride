"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eye,
  Filter,
  Gift,
  Loader2,
  Mail,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  X,
} from "lucide-react";

type WinnerStatus =
  | "selected"
  | "contact_pending"
  | "contacted"
  | "eligibility_confirmed"
  | "claimed"
  | "fulfilled"
  | "unclaimed"
  | "disqualified"
  | "replaced";

type ContactAttempt = {
  id: string;
  method: "email" | "phone" | "other";
  outcome: string;
  notes: string | null;
  attempted_at: string;
  admin_name: string | null;
};

type WinnerRecord = {
  id: string;
  lottery_id: string;
  lottery_title: string;
  lottery_slug: string;
  draw_id: string;
  draw_reference: string | null;
  prize_id: string;
  prize_name: string;
  prize_value: number | null;
  ticket_id: string;
  ticket_number: string;
  order_id: string | null;
  order_reference: string | null;
  entrant_name: string | null;
  entrant_email: string | null;
  entrant_phone: string | null;
  status: WinnerStatus;
  selected_at: string;
  contacted_at: string | null;
  eligibility_confirmed_at: string | null;
  claimed_at: string | null;
  fulfilled_at: string | null;
  unclaimed_at: string | null;
  disqualified_at: string | null;
  replaced_at: string | null;
  collection_delivery_date: string | null;
  fulfilment_method: string | null;
  fulfilment_notes: string | null;
  internal_notes: string | null;
  public_display_mode: "full_name" | "first_name" | "ticket_number" | "none";
  public_display_consent: boolean;
  public_results_published_at: string | null;
  replacement_winner_id: string | null;
  original_winner_id: string | null;
  contact_attempts: ContactAttempt[];
  created_at: string;
  updated_at: string;
};

type RequestError = { title: string; message: string };
type WinnerForm = {
  status: WinnerStatus;
  contact_method: ContactAttempt["method"];
  contact_outcome: string;
  contact_notes: string;
  fulfilment_method: string;
  collection_delivery_date: string;
  fulfilment_notes: string;
  internal_notes: string;
  reason: string;
  confirmTransition: boolean;
};
type WinnerFilter =
  | "all"
  | "needs_contact"
  | "in_progress"
  | "claimed"
  | "fulfilled"
  | "issues";

const API_ROUTE = "/api/admin/lotterymanagement/winners";

const TIMEOUT_MS = 20000;
const PAGE_SIZE = 25;
const MAX_RECORDS = 2000;
const MAX_BYTES = 5 * 1024 * 1024;
class WinnersError extends Error {
  constructor(
    message: string,
    public status?: number,
  ) {
    super(message);
  }
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function textOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}
const NEXT_STATUS: Partial<Record<WinnerStatus, WinnerStatus>> = {
  selected: "contact_pending",
  contact_pending: "contacted",
  contacted: "eligibility_confirmed",
  eligibility_confirmed: "claimed",
  claimed: "fulfilled",
};
function allowedStatuses(status: WinnerStatus): WinnerStatus[] {
  const next = NEXT_STATUS[status];
  return next ? [status, next] : [status];
}
function requestMessage(status: number): string {
  if (status === 401)
    return "Your session has expired. Sign in again and refresh winner records.";
  if (status === 403)
    return "You do not have permission, or recent verification is required. Verify your session and refresh.";
  if (status === 409)
    return "The winner record changed or the action is not permitted. Refresh before continuing.";
  if (status === 429) return "Too many requests. Wait a moment and refresh.";
  if (status === 400 || status === 422)
    return "The request was rejected. Check the values and required approvals, then refresh.";
  return "The winners service could not complete this request. Refresh and check the saved record.";
}
function parseWinner(value: unknown): WinnerRecord {
  if (
    !isRecord(value) ||
    ["id", "lottery_id", "lottery_title", "ticket_number", "prize_name"].some(
      (key) => typeof value[key] !== "string" || !value[key],
    ) ||
    !STATUS_OPTIONS.some(
      (option) => option.value !== "all" && option.value === value.status,
    )
  ) {
    throw new WinnersError(
      "Incomplete winner records were returned. Refresh or report the issue.",
    );
  }
  const strings = [
    "lottery_slug",
    "draw_id",
    "prize_id",
    "ticket_id",
    "selected_at",
    "created_at",
    "updated_at",
  ] as const;
  const nullable = [
    "draw_reference",
    "order_id",
    "order_reference",
    "entrant_name",
    "entrant_email",
    "entrant_phone",
    "contacted_at",
    "eligibility_confirmed_at",
    "claimed_at",
    "fulfilled_at",
    "unclaimed_at",
    "disqualified_at",
    "replaced_at",
    "collection_delivery_date",
    "fulfilment_method",
    "fulfilment_notes",
    "internal_notes",
    "public_results_published_at",
    "replacement_winner_id",
    "original_winner_id",
  ] as const;
  const fields: Record<string, string | null> = {};
  for (const key of strings) fields[key] = textOrNull(value[key]) ?? "";
  for (const key of nullable) fields[key] = textOrNull(value[key]);
  if (
    value.contact_attempts != null &&
    (!Array.isArray(value.contact_attempts) ||
      value.contact_attempts.length > 1000)
  )
    throw new WinnersError("Invalid contact history was returned.");
  const attempts: ContactAttempt[] = Array.isArray(value.contact_attempts)
    ? value.contact_attempts.map((attempt) => {
        if (
          !isRecord(attempt) ||
          typeof attempt.id !== "string" ||
          typeof attempt.outcome !== "string" ||
          !["email", "phone", "other"].includes(String(attempt.method))
        )
          throw new WinnersError("Invalid contact history was returned.");
        return {
          id: attempt.id,
          method: attempt.method as ContactAttempt["method"],
          outcome: attempt.outcome,
          notes: textOrNull(attempt.notes),
          attempted_at: textOrNull(attempt.attempted_at) ?? "",
          admin_name: textOrNull(attempt.admin_name),
        };
      })
    : [];
  if (new Set(attempts.map((attempt) => attempt.id)).size !== attempts.length)
    throw new WinnersError("Duplicate contact history was returned.");
  if (
    !["full_name", "first_name", "ticket_number", "none"].includes(
      String(value.public_display_mode),
    ) ||
    typeof value.public_display_consent !== "boolean"
  )
    throw new WinnersError(
      "Winner privacy settings are incomplete. Refresh or report the issue.",
    );
  return {
    ...fields,
    id: value.id,
    lottery_id: value.lottery_id,
    lottery_title: value.lottery_title,
    ticket_number: value.ticket_number,
    prize_name: value.prize_name,
    status: value.status,
    prize_value:
      typeof value.prize_value === "number" &&
      Number.isFinite(value.prize_value)
        ? value.prize_value
        : null,
    public_display_mode: value.public_display_mode,
    public_display_consent: value.public_display_consent,
    contact_attempts: attempts,
  } as WinnerRecord;
}
async function readJson(response: Response): Promise<Record<string, unknown>> {
  const reader = response.body?.getReader();
  if (!reader)
    throw new WinnersError("The service returned an unreadable response.");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES)
        throw new WinnersError(
          "The response is too large. Ask the administrator to enable server pagination.",
        );
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      throw new WinnersError("The service returned an unreadable response.");
    }
    if (!isRecord(data))
      throw new WinnersError("The service returned an unexpected response.");
    return data;
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
async function requestApi(
  url: string,
  signal: AbortSignal,
  body?: Record<string, unknown>,
) {
  const response = await fetch(url, {
    method: body ? "PATCH" : "GET",
    cache: "no-store",
    credentials: "include",
    signal,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw new WinnersError(requestMessage(response.status), response.status);
  }
  const data = await readJson(response);
  if (data.ok !== true)
    throw new WinnersError(
      "The request could not be confirmed. Refresh and check the saved record.",
    );
  return data;
}
async function fetchRecords(signal: AbortSignal): Promise<WinnerRecord[]> {
  const data = await requestApi(API_ROUTE, signal);
  if (!Array.isArray(data.items) || data.items.length > MAX_RECORDS)
    throw new WinnersError(
      "The winner response is incomplete or too large. Refresh or ask the administrator to enable server pagination.",
    );
  const items = data.items.map(parseWinner);
  if (new Set(items.map((item) => item.id)).size !== items.length)
    throw new WinnersError(
      "Duplicate winner records were returned. Report the issue.",
    );
  return items;
}
// Native datetime-local inputs contain London wall time. Reject ambiguous or missing DST times.
function toLocalInput(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}
function londonDateToIso(value: string): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new WinnersError("Enter a valid collection/delivery date and time.");
  const raw = Date.parse(`${value}:00Z`);
  if (!Number.isFinite(raw))
    throw new WinnersError("Enter a valid collection/delivery date and time.");
  const candidates = [raw, raw - 3600000].filter(
    (timestamp) => toLocalInput(new Date(timestamp).toISOString()) === value,
  );
  if (candidates.length !== 1)
    throw new WinnersError(
      "This London time is invalid or occurs twice during a clock change. Choose an unambiguous time.",
    );
  return new Date(candidates[0]).toISOString();
}
function verifySaved(
  before: WinnerRecord,
  after: WinnerRecord,
  form: WinnerForm,
  date: string | null,
) {
  const unchanged = [
    "id",
    "lottery_id",
    "draw_id",
    "prize_id",
    "ticket_id",
    "ticket_number",
    "order_id",
    "entrant_name",
    "entrant_email",
    "entrant_phone",
    "public_display_mode",
    "public_display_consent",
    "public_results_published_at",
    "selected_at",
    "created_at",
    "replacement_winner_id",
    "original_winner_id",
  ] as const;
  if (unchanged.some((key) => before[key] !== after[key])) return false;
  const historical = [
    "contacted_at",
    "eligibility_confirmed_at",
    "claimed_at",
    "fulfilled_at",
    "unclaimed_at",
    "disqualified_at",
    "replaced_at",
  ] as const;
  const timestampForStatus: Partial<Record<WinnerStatus, keyof WinnerRecord>> =
    {
      contacted: "contacted_at",
      eligibility_confirmed: "eligibility_confirmed_at",
      claimed: "claimed_at",
      fulfilled: "fulfilled_at",
    };
  const expectedNewTimestamp =
    form.status !== before.status ? timestampForStatus[form.status] : undefined;
  if (
    historical.some(
      (key) =>
        before[key] !== after[key] &&
        !(key === expectedNewTimestamp && before[key] === null),
    )
  )
    return false;
  const key = timestampForStatus[form.status];
  if (
    form.status !== before.status &&
    key &&
    (typeof after[key] !== "string" ||
      !Number.isFinite(Date.parse(after[key] as string)))
  )
    return false;
  if (
    after.status !== form.status ||
    after.fulfilment_method !== (form.fulfilment_method.trim() || null) ||
    after.collection_delivery_date !== date ||
    after.fulfilment_notes !== (form.fulfilment_notes.trim() || null) ||
    after.internal_notes !== (form.internal_notes.trim() || null)
  )
    return false;
  if (
    before.contact_attempts.some(
      (old) =>
        !after.contact_attempts.some(
          (saved) =>
            saved.id === old.id &&
            saved.method === old.method &&
            saved.outcome === old.outcome &&
            saved.notes === old.notes &&
            saved.attempted_at === old.attempted_at &&
            saved.admin_name === old.admin_name,
        ),
    )
  )
    return false;
  if (
    form.contact_outcome.trim() &&
    !after.contact_attempts.some(
      (saved) =>
        !before.contact_attempts.some((old) => old.id === saved.id) &&
        saved.method === form.contact_method &&
        saved.outcome === form.contact_outcome.trim() &&
        saved.notes === (form.contact_notes.trim() || null),
    )
  )
    return false;
  return true;
}

const STATUS_OPTIONS: Array<{
  value: WinnerStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All winner statuses" },
  { value: "selected", label: "Selected" },
  { value: "contact_pending", label: "Contact pending" },
  { value: "contacted", label: "Contacted" },
  { value: "eligibility_confirmed", label: "Eligibility confirmed" },
  { value: "claimed", label: "Claimed" },
  { value: "fulfilled", label: "Fulfilled" },
  { value: "unclaimed", label: "Unclaimed" },
  { value: "disqualified", label: "Disqualified" },
  { value: "replaced", label: "Replaced" },
];

function statusLabel(status: WinnerStatus) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label || status;
}

function statusClass(status: WinnerStatus) {
  const map: Record<WinnerStatus, string> = {
    selected: "border-blue-400/25 bg-blue-500/10 text-blue-200",
    contact_pending: "border-amber-400/25 bg-amber-500/10 text-amber-200",
    contacted: "border-cyan-400/25 bg-cyan-500/10 text-cyan-200",
    eligibility_confirmed:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    claimed: "border-purple-400/25 bg-purple-500/10 text-purple-200",
    fulfilled: "border-teal-400/25 bg-teal-500/10 text-teal-200",
    unclaimed: "border-orange-400/25 bg-orange-500/10 text-orange-200",
    disqualified: "border-red-400/25 bg-red-500/10 text-red-200",
    replaced: "border-white/15 bg-white/10 text-white/60",
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

function formatMoney(value: number | null) {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "Not set";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function publicWinnerDisplay(item: WinnerRecord) {
  if (!item.public_results_published_at) return "Not published";
  if (
    ["first_name", "full_name"].includes(item.public_display_mode) &&
    !item.public_display_consent
  )
    return "Publication needs review";
  if (item.public_display_mode === "none") return "Hidden from public results";
  if (item.public_display_mode === "ticket_number") {
    return `Ticket ${item.ticket_number}`;
  }

  const name = item.entrant_name || "Winner";

  if (item.public_display_mode === "first_name") {
    return name.split(/\s+/)[0] || "Winner";
  }

  return name;
}

export default function WinnersClient() {
  const [items, setItems] = useState<WinnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [selected, setSelected] = useState<WinnerRecord | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [mustReload, setMustReload] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const alive = useRef(false);
  const operation = useRef<AbortController | null>(null);
  const savingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const searchId = useId();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WinnerStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [workflow, setWorkflow] = useState<WinnerFilter>("all");
  const [sort, setSort] = useState("newest");

  const [form, setForm] = useState<WinnerForm>({
    status: "contact_pending",
    contact_method: "email",
    contact_outcome: "",
    contact_notes: "",
    fulfilment_method: "",
    collection_delivery_date: "",
    fulfilment_notes: "",
    internal_notes: "",
    reason: "",
    confirmTransition: false,
  });
  const loadWinners = useCallback(async () => {
    if (savingRef.current) return;
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    setLoading(true);
    setError(null);
    setItems([]);
    setSelected(null);
    setManageOpen(false);
    setPage(1);
    try {
      const records = await fetchRecords(controller.signal);
      if (
        !alive.current ||
        controller.signal.aborted ||
        operation.current !== controller
      )
        return;
      setItems(records);
      setMustReload(false);
    } catch (err) {
      if (alive.current && operation.current === controller)
        setError({
          title: "Could not load winners",
          message:
            err instanceof WinnersError && !controller.signal.aborted
              ? err.message
              : "Check your connection and refresh winner records.",
        });
    } finally {
      window.clearTimeout(timer);
      if (operation.current === controller) {
        operation.current = null;
        if (alive.current) setLoading(false);
      }
    }
  }, []);
  useEffect(() => {
    alive.current = true;
    void loadWinners();
    return () => {
      alive.current = false;
      operation.current?.abort();
      operation.current = null;
      savingRef.current = false;
    };
  }, [loadWinners]);
  useEffect(() => {
    setPage(1);
  }, [search, status, lotteryId, workflow, sort]);
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
        item.entrant_name?.toLowerCase().includes(q) ||
        item.entrant_email?.toLowerCase().includes(q) ||
        item.ticket_number.toLowerCase().includes(q) ||
        item.prize_name.toLowerCase().includes(q) ||
        item.lottery_title.toLowerCase().includes(q) ||
        item.order_reference?.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q);

      const matchesStatus = status === "all" || item.status === status;
      const matchesLottery =
        lotteryId === "all" || item.lottery_id === lotteryId;

      const matchesWorkflow =
        workflow === "all" ||
        (workflow === "needs_contact" &&
          ["selected", "contact_pending"].includes(item.status)) ||
        (workflow === "in_progress" &&
          ["contacted", "eligibility_confirmed"].includes(item.status)) ||
        (workflow === "claimed" && item.status === "claimed") ||
        (workflow === "fulfilled" && item.status === "fulfilled") ||
        (workflow === "issues" &&
          ["unclaimed", "disqualified", "replaced"].includes(item.status));

      return (
        matchesSearch && matchesStatus && matchesLottery && matchesWorkflow
      );
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return (
            (Date.parse(a.selected_at) || 0) - (Date.parse(b.selected_at) || 0)
          );
        case "prize_value":
          return Number(b.prize_value || 0) - Number(a.prize_value || 0);
        case "name":
          return (a.entrant_name || "").localeCompare(b.entrant_name || "");
        default:
          return (
            (Date.parse(b.selected_at) || 0) - (Date.parse(a.selected_at) || 0)
          );
      }
    });
  }, [items, search, status, lotteryId, workflow, sort]);

  const needsContact = items.filter((x) =>
    ["selected", "contact_pending"].includes(x.status),
  ).length;
  const inProgress = items.filter((x) =>
    ["contacted", "eligibility_confirmed", "claimed"].includes(x.status),
  ).length;
  const fulfilled = items.filter((x) => x.status === "fulfilled").length;
  const issues = items.filter((x) =>
    ["unclaimed", "disqualified", "replaced"].includes(x.status),
  ).length;

  useEffect(() => {
    if (!manageOpen || saving) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [manageOpen, saving]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const visibleItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  function openManage(item: WinnerRecord) {
    if (savingRef.current || mustReload || loading) return;
    if (item.public_results_published_at) {
      setError({
        title: "Published winner needs the protected workflow",
        message:
          "This endpoint combines editing with publication. Published winners cannot be edited here until those operations are separated on the server.",
      });
      return;
    }
    setSelected(item);
    setForm({
      status: item.status,
      contact_method: "email",
      contact_outcome: "",
      contact_notes: "",
      fulfilment_method: item.fulfilment_method || "",
      collection_delivery_date: toLocalInput(item.collection_delivery_date),
      fulfilment_notes: item.fulfilment_notes || "",
      internal_notes: item.internal_notes || "",
      reason: "",
      confirmTransition: false,
    });
    setManageOpen(true);
    setError(null);
    setNotice(null);
  }
  async function saveWinner() {
    if (!selected || savingRef.current || saving || mustReload || loading)
      return;
    const before = selected;
    let date: string | null;
    try {
      if (before.public_results_published_at)
        throw new WinnersError(
          "Published winners require the separate protected workflow.",
        );
      if (!allowedStatuses(before.status).includes(form.status))
        throw new WinnersError(
          "Choose the current status or its next workflow step. Exceptional decisions and replacements require a separate controlled workflow.",
        );
      if (form.status !== before.status && !form.confirmTransition)
        throw new WinnersError(
          "Confirm that the selected workflow step and its evidence have been checked.",
        );
      if (form.reason.trim().length < 5 || form.reason.trim().length > 1000)
        throw new WinnersError(
          "Enter a reason or evidence reference of 5 to 1000 characters.",
        );
      if (!["email", "phone", "other"].includes(form.contact_method))
        throw new WinnersError("Choose a supported contact method.");
      if (form.contact_notes.trim() && !form.contact_outcome.trim())
        throw new WinnersError(
          "Enter an outcome for the contact notes, or clear the notes.",
        );
      if (
        form.status === "contacted" &&
        before.status !== "contacted" &&
        !form.contact_outcome.trim() &&
        !before.contact_attempts.length
      )
        throw new WinnersError(
          "Record a contact attempt before marking this winner contacted.",
        );
      if (
        [form.contact_outcome, form.fulfilment_method].some(
          (value) => value.length > 500,
        ) ||
        [form.contact_notes, form.fulfilment_notes, form.internal_notes].some(
          (value) => value.length > 5000,
        )
      )
        throw new WinnersError("Shorten the entered notes or contact outcome.");
      date =
        form.collection_delivery_date ===
        toLocalInput(before.collection_delivery_date)
          ? before.collection_delivery_date
          : londonDateToIso(form.collection_delivery_date);
      if (
        form.status === "fulfilled" &&
        (!date || !form.fulfilment_method.trim())
      )
        throw new WinnersError(
          "Enter a fulfilment method and collection/delivery date before marking the prize fulfilled.",
        );
    } catch (err) {
      setError({
        title: "Check winner changes",
        message:
          err instanceof WinnersError
            ? err.message
            : "Check the entered values.",
      });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    operation.current?.abort();
    const controller = new AbortController();
    operation.current = controller;
    const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      await requestApi(
        `${API_ROUTE}/${encodeURIComponent(before.id)}`,
        controller.signal,
        {
          id: before.id,
          status: form.status,
          reason: form.reason.trim(),
          expected_updated_at: before.updated_at,
          // Preserve saved privacy choices. This ordinary edit never requests publication.
          public_display_mode: before.public_display_mode,
          public_display_consent: before.public_display_consent,
          publish_to_live_draw: false,
          fulfilment_method: form.fulfilment_method.trim() || null,
          collection_delivery_date: date,
          fulfilment_notes: form.fulfilment_notes.trim() || null,
          internal_notes: form.internal_notes.trim() || null,
          contact_attempt: form.contact_outcome.trim()
            ? {
                method: form.contact_method,
                outcome: form.contact_outcome.trim(),
                notes: form.contact_notes.trim() || null,
              }
            : null,
        },
      );
      const records = await fetchRecords(controller.signal);
      if (
        !alive.current ||
        controller.signal.aborted ||
        operation.current !== controller
      )
        return;
      const saved = records.find((item) => item.id === before.id);
      if (!saved || !verifySaved(before, saved, form, date))
        throw new WinnersError(
          "The saved changes or preserved history could not be verified. Report the issue and review the stored winner record.",
        );
      setItems(records);
      setSelected(null);
      setManageOpen(false);
      setNotice("Winner changes saved and verified.");
    } catch (err) {
      if (alive.current && operation.current === controller) {
        setMustReload(true);
        const message =
          err instanceof WinnersError && !controller.signal.aborted
            ? err.message
            : "The save outcome could not be confirmed.";
        setError({
          title: "Review the save outcome",
          message: `${message} The request may have changed the record. Close this dialog, refresh and check it before retrying.`,
        });
        if (
          err instanceof WinnersError &&
          [401, 403].includes(err.status ?? 0)
        ) {
          setItems([]);
          setSelected(null);
          setManageOpen(false);
        }
      }
    } finally {
      window.clearTimeout(timer);
      if (operation.current === controller) {
        operation.current = null;
        savingRef.current = false;
        if (alive.current) setSaving(false);
      }
    }
  }
  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
              <Trophy className="h-5 w-5 text-white" />
            </div>

            <div>
              <h1 className="text-2xl font-extrabold text-white">Winners</h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Manage selected winners, contact attempts, eligibility
                confirmation, prize claims, fulfilment and exceptional cases.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void loadWinners()}
              disabled={loading || saving}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </section>

      <p className="text-sm text-white/65">
        Counts describe loaded records. This screen does not verify lottery
        completion or public-result timing. Publication, consent changes,
        disqualification and replacement require separate protected server
        workflows.
      </p>
      {notice && (
        <p role="status" className="text-sm text-emerald-200">
          {notice}
        </p>
      )}
      {mustReload && (
        <p role="alert" className="text-sm text-amber-100">
          Refresh and review the saved record before making another change.
        </p>
      )}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Needs contact"
          value={
            loading || (error && !items.length)
              ? "Unavailable"
              : String(needsContact)
          }
          icon={<Mail className="h-5 w-5" />}
        />
        <StatCard
          label="In progress"
          value={
            loading || (error && !items.length)
              ? "Unavailable"
              : String(inProgress)
          }
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Fulfilled"
          value={
            loading || (error && !items.length)
              ? "Unavailable"
              : String(fulfilled)
          }
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Issues / replacements"
          value={
            loading || (error && !items.length) ? "Unavailable" : String(issues)
          }
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      {error ? <RequestErrorAlert error={error} /> : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">Search &amp; filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <label htmlFor={searchId} className="sr-only">
              Search loaded winners
            </label>
            <input
              id={searchId}
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Winner, email, ticket, prize, order or lottery..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-12 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-300 placeholder:text-white/35"
            />
            {search && (
              <button
                type="button"
                aria-label="Clear winner search"
                onClick={() => {
                  setSearch("");
                  searchRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <Select
            label="Winner status"
            value={status}
            onChange={(v) => setStatus(v as WinnerStatus | "all")}
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
            label="Workflow"
            value={workflow}
            onChange={(v) => setWorkflow(v as WinnerFilter)}
          >
            <option value="all">All workflows</option>
            <option value="needs_contact">Needs contact</option>
            <option value="in_progress">In progress</option>
            <option value="claimed">Claimed</option>
            <option value="fulfilled">Fulfilled</option>
            <option value="issues">Issues / replacements</option>
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select label="Sort winners" value={sort} onChange={setSort}>
            <option value="newest">Newest selected</option>
            <option value="oldest">Oldest selected</option>
            <option value="prize_value">Highest prize value</option>
            <option value="name">Winner name A-Z</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">Winner register</h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {visibleItems.length} of {filtered.length} matching winners
            ({items.length} loaded)
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading winners...
          </div>
        ) : error && !items.length ? (
          <p className="py-6 text-white/65">
            Winner records are unavailable. Use Refresh to try again.
          </p>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">No winners found</h3>
            <p className="mt-1 text-sm text-white/50">
              {items.length
                ? "Change the filters or clear the search."
                : "No winner records were returned by the server."}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {visibleItems.map((item) => (
              <WinnerRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
                manageDisabled={
                  saving ||
                  mustReload ||
                  Boolean(item.public_results_published_at)
                }
                onManage={() => openManage(item)}
              />
            ))}
          </div>
        )}
      </section>

      {filtered.length > PAGE_SIZE && (
        <nav
          aria-label="Winner pages"
          className="flex items-center justify-between gap-3 text-white"
        >
          <button
            type="button"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous winners
          </button>
          <span aria-live="polite">
            Page {currentPage} of {pageCount}
          </span>
          <button
            type="button"
            disabled={currentPage === pageCount}
            onClick={() => setPage(currentPage + 1)}
          >
            Next winners
          </button>
        </nav>
      )}
      {selected && !manageOpen ? (
        <WinnerDetailsModal
          winner={selected}
          onClose={() => setSelected(null)}
          manageDisabled={
            saving ||
            mustReload ||
            Boolean(selected.public_results_published_at)
          }
          onManage={() => openManage(selected)}
        />
      ) : null}

      {selected && manageOpen ? (
        <ManageWinnerModal
          winner={selected}
          form={form}
          setForm={setForm}
          saving={saving}
          mustReload={mustReload}
          error={error}
          onClose={() => {
            if (!saving) {
              setManageOpen(false);
              setSelected(null);
            }
          }}
          onSave={saveWinner}
        />
      ) : null}
    </div>
  );
}

function RequestErrorAlert({ error }: { error: RequestError }) {
  return (
    <section
      role="alert"
      className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-red-100"
    >
      <h2 className="font-bold">{error.title}</h2>
      <p className="mt-1 text-sm">{error.message}</p>
    </section>
  );
}

function WinnerRow({
  item,
  manageDisabled,
  onView,
  onManage,
}: {
  item: WinnerRecord;
  manageDisabled: boolean;
  onView: () => void;
  onManage: () => void;
}) {
  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-base font-extrabold text-white">
              {item.entrant_name || "Winner not named"}
            </h3>

            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(
                item.status,
              )}`}
            >
              {statusLabel(item.status)}
            </span>

            <span className="inline-flex items-center gap-1 rounded-full border border-yellow-400/20 bg-yellow-500/10 px-2.5 py-1 text-[11px] font-bold text-yellow-200">
              <Trophy className="h-3 w-3" />
              {item.prize_name}
            </span>
          </div>

          <p className="mt-2 text-sm font-semibold text-white/70">
            {item.lottery_title}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Info label="Ticket" value={item.ticket_number} />
            <Info label="Prize value" value={formatMoney(item.prize_value)} />
            <Info label="Selected" value={formatDate(item.selected_at)} />
            <Info
              label="Contact attempts"
              value={String(item.contact_attempts.length)}
            />
            <Info
              label="Stored public display"
              value={publicWinnerDisplay(item)}
            />
            <Info
              label="Live Draw page"
              value={
                item.public_results_published_at
                  ? "Publication recorded (unverified)"
                  : "Not published"
              }
            />
            <Info
              label="Fulfilment"
              value={item.fulfilment_method || "Not recorded"}
            />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={onView}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-purple-300"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>

          <button
            type="button"
            onClick={onManage}
            disabled={manageDisabled}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-extrabold text-black hover:opacity-90"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Manage
          </button>
        </div>
      </div>
    </article>
  );
}

function WinnerDetailsModal({
  winner,
  manageDisabled,
  onClose,
  onManage,
}: {
  winner: WinnerRecord;
  manageDisabled: boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  return (
    <Modal
      title={winner.entrant_name || "Winner"}
      subtitle={winner.lottery_title}
      onClose={onClose}
    >
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DetailCard
          icon={<Trophy className="h-4 w-4" />}
          label="Status"
          value={statusLabel(winner.status)}
        />
        <DetailCard
          icon={<Gift className="h-4 w-4" />}
          label="Prize"
          value={winner.prize_name}
        />
        <DetailCard
          icon={<Ticket className="h-4 w-4" />}
          label="Ticket"
          value={winner.ticket_number}
        />
        <DetailCard
          icon={<ShieldCheck className="h-4 w-4" />}
          label="Stored public display"
          value={publicWinnerDisplay(winner)}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Winner & entry">
          <DetailRows
            rows={[
              ["Winner", winner.entrant_name || "Not recorded"],
              ["Email", winner.entrant_email || "Not recorded"],
              ["Phone", winner.entrant_phone || "Not recorded"],
              ["Order", winner.order_reference || "Not linked"],
              ["Ticket", winner.ticket_number],
              ["Draw", winner.draw_reference || winner.draw_id],
            ]}
          />
        </Panel>

        <Panel title="Prize & fulfilment">
          <DetailRows
            rows={[
              ["Prize", winner.prize_name],
              ["Prize value", formatMoney(winner.prize_value)],
              ["Claimed", formatDate(winner.claimed_at)],
              ["Fulfilled", formatDate(winner.fulfilled_at)],
              ["Method", winner.fulfilment_method || "Not recorded"],
              [
                "Collection / delivery",
                formatDate(winner.collection_delivery_date),
              ],
            ]}
          />
        </Panel>

        <Panel title="Winner timeline">
          <Timeline winner={winner} />
        </Panel>

        <Panel title="Contact attempts">
          <ContactAttempts items={winner.contact_attempts} />
        </Panel>

        <Panel title="Privacy & public display">
          <DetailRows
            rows={[
              [
                "Display setting",
                winner.public_display_mode.replaceAll("_", " "),
              ],
              ["Public result", publicWinnerDisplay(winner)],
              [
                "Replacement winner",
                winner.replacement_winner_id || "Not linked",
              ],
              [
                "Original winner",
                winner.original_winner_id || "Not applicable",
              ],
            ]}
          />
        </Panel>

        <Panel title="Internal fulfilment notes">
          <p className="text-sm leading-6 text-white/65">
            {winner.fulfilment_notes ||
              winner.internal_notes ||
              "No internal notes recorded."}
          </p>
        </Panel>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
        <Link
          href={`/Lottery/${encodeURIComponent(winner.lottery_slug)}/LiveDraw`}
          className="text-sm text-purple-200 underline"
        >
          Public Live Draw page
        </Link>
        <button
          type="button"
          onClick={onManage}
          disabled={manageDisabled}
          className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
        >
          <ShieldCheck className="h-4 w-4" />
          Manage winner
        </button>
      </div>
    </Modal>
  );
}

function ManageWinnerModal({
  winner,
  form,
  setForm,
  saving,
  mustReload,
  error,
  onClose,
  onSave,
}: {
  winner: WinnerRecord;
  form: WinnerForm;
  setForm: React.Dispatch<React.SetStateAction<WinnerForm>>;
  saving: boolean;
  mustReload: boolean;
  error: RequestError | null;
  onClose: () => void;
  onSave: () => void;
}) {
  return (
    <Modal
      title={`Manage ${winner.entrant_name || "winner"}`}
      subtitle={`${winner.prize_name} · ${winner.ticket_number}`}
      onClose={onClose}
      closeDisabled={saving}
    >
      {error && (
        <div className="mb-5">
          <RequestErrorAlert error={error} />
        </div>
      )}
      <form
        noValidate
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          if (!saving && !mustReload) onSave();
        }}
      >
        <fieldset
          disabled={saving || mustReload}
          className="min-w-0 border-0 p-0"
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <Panel title="Winner status">
              <Field label="Workflow status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      status: e.target.value as WinnerStatus,
                      confirmTransition: false,
                    }))
                  }
                  className={inputClass}
                >
                  {STATUS_OPTIONS.filter(
                    (x) =>
                      x.value !== "all" &&
                      allowedStatuses(winner.status).includes(x.value),
                  ).map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>

              <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/80">
                A replacement winner must only come from the controlled redraw
                or reserve-winner process. Changing the status here must not
                silently select another ticket.
              </div>
            </Panel>

            <Panel title="Contact attempt">
              <div className="space-y-4">
                <Field label="Contact method">
                  <select
                    value={form.contact_method}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contact_method: e.target
                          .value as ContactAttempt["method"],
                      }))
                    }
                    className={inputClass}
                  >
                    <option value="email">Email</option>
                    <option value="phone">Phone</option>
                    <option value="other">Other</option>
                  </select>
                </Field>

                <Field label="Outcome">
                  <input
                    value={form.contact_outcome}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contact_outcome: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="e.g. Winner contacted successfully"
                  />
                </Field>

                <Field label="Contact notes">
                  <textarea
                    value={form.contact_notes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        contact_notes: e.target.value,
                      }))
                    }
                    className={`${inputClass} min-h-24 resize-none`}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Prize fulfilment">
              <div className="space-y-4">
                <Field label="Fulfilment method">
                  <input
                    value={form.fulfilment_method}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        fulfilment_method: e.target.value,
                      }))
                    }
                    className={inputClass}
                    placeholder="Collection, delivery, post..."
                  />
                </Field>

                <Field label="Collection / delivery time (Europe/London)">
                  <input
                    type="datetime-local"
                    value={form.collection_delivery_date}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        collection_delivery_date: e.target.value,
                      }))
                    }
                    className={inputClass}
                  />
                </Field>

                <Field label="Fulfilment notes">
                  <textarea
                    value={form.fulfilment_notes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        fulfilment_notes: e.target.value,
                      }))
                    }
                    className={`${inputClass} min-h-24 resize-none`}
                  />
                </Field>
              </div>
            </Panel>

            <Panel title="Privacy & internal notes">
              <div className="space-y-4">
                <DetailRows
                  rows={[
                    [
                      "Saved display setting",
                      winner.public_display_mode.replaceAll("_", " "),
                    ],
                    [
                      "Saved consent",
                      winner.public_display_consent
                        ? "Recorded"
                        : "Not recorded",
                    ],
                    [
                      "Publication timestamp",
                      formatDate(winner.public_results_published_at),
                    ],
                  ]}
                />
                <p className="text-sm text-white/65">
                  Publication and consent are read-only here. They must be
                  changed through a separate protected workflow that checks
                  lottery completion, publication time and consent evidence.
                </p>
                <Field label="Internal notes">
                  <textarea
                    value={form.internal_notes}
                    onChange={(e) =>
                      setForm((p) => ({
                        ...p,
                        internal_notes: e.target.value,
                      }))
                    }
                    className={`${inputClass} min-h-28 resize-none`}
                    placeholder="Only record necessary operational information."
                  />
                </Field>
              </div>
            </Panel>
          </div>

          <div className="mt-6 space-y-4">
            <Field label="Reason or evidence reference">
              <input
                value={form.reason}
                maxLength={1000}
                onChange={(event) =>
                  setForm((previous) => ({
                    ...previous,
                    reason: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </Field>
            {form.status !== winner.status && (
              <label className="flex items-start gap-3 text-sm text-white/80">
                <input
                  type="checkbox"
                  checked={form.confirmTransition}
                  onChange={(event) =>
                    setForm((previous) => ({
                      ...previous,
                      confirmTransition: event.target.checked,
                    }))
                  }
                />
                <span>
                  I have checked the evidence for changing{" "}
                  {statusLabel(winner.status)} to {statusLabel(form.status)}.
                </span>
              </label>
            )}
          </div>
        </fieldset>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || mustReload}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {saving ? "Saving..." : "Save winner"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Timeline({ winner }: { winner: WinnerRecord }) {
  const rows = [
    ["Selected", winner.selected_at],
    ["Contacted", winner.contacted_at],
    ["Eligibility confirmed", winner.eligibility_confirmed_at],
    ["Claimed", winner.claimed_at],
    ["Fulfilled", winner.fulfilled_at],
    ["Unclaimed", winner.unclaimed_at],
    ["Disqualified", winner.disqualified_at],
    ["Replaced", winner.replaced_at],
  ];

  return (
    <div className="space-y-2">
      {rows.map(([label, value]) => (
        <div
          key={label}
          className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <span className="text-sm font-semibold text-white/65">{label}</span>
          <span className="text-xs text-white/45">{formatDate(value)}</span>
        </div>
      ))}
    </div>
  );
}

function ContactAttempts({ items }: { items: ContactAttempt[] }) {
  const [limit, setLimit] = useState(25);
  useEffect(() => {
    setLimit(25);
  }, [items]);
  if (!items.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
        No contact attempts recorded.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.slice(0, limit).map((item) => (
        <div
          key={item.id}
          className="rounded-xl border border-white/10 bg-black/20 p-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              {item.method === "phone" ? (
                <Phone className="h-4 w-4" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              {item.outcome}
            </div>
            <span className="text-xs text-white/40">
              {formatDate(item.attempted_at)}
            </span>
          </div>
          {item.notes ? (
            <p className="mt-2 text-xs leading-5 text-white/55">{item.notes}</p>
          ) : null}
        </div>
      ))}
      {items.length > limit && (
        <button
          type="button"
          onClick={() => setLimit((previous) => previous + 25)}
          className="rounded-xl border border-white/15 px-4 py-2 text-sm text-white"
        >
          Show more contact attempts
        </button>
      )}
    </div>
  );
}

function Modal({
  title,
  subtitle,
  onClose,
  closeDisabled = false,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  closeDisabled?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    if (dialog && !dialog.open) dialog.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        if (!closeDisabled) onClose();
      }}
      className="fixed inset-0 m-0 h-dvh w-screen max-h-none max-w-none items-center justify-center border-0 bg-black/75 p-3 text-white backdrop-blur-sm open:flex md:p-6"
      aria-labelledby={titleId}
    >
      <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 id={titleId} className="text-xl font-extrabold text-white">
              {title}
            </h2>
            <p className="mt-1 text-sm text-white/55">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
            autoFocus
            aria-label="Close winner dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
    </dialog>
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
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-3 text-2xl font-black text-white">{value}</div>
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
  // Preserve the existing native select and platform-owned popup.
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 pr-10 text-sm text-white outline-none"
      >
        {children}
      </select>
    </div>
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
        {value}
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
          <span className="break-all text-sm font-semibold text-white/80 sm:max-w-[60%] sm:text-right">
            {value}
          </span>
        </div>
      ))}
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-purple-300 placeholder:text-white/35 focus:border-white/25";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span className="mb-2 block text-sm font-semibold text-white/80">
        {label}
      </span>
      {children}
    </label>
  );
}
