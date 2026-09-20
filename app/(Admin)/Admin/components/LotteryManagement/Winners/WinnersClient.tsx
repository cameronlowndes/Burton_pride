"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Beaker,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Eye,
  Filter,
  Gift,
  Loader2,
  Mail,
  MapPin,
  PackageCheck,
  Phone,
  RefreshCw,
  Search,
  ShieldCheck,
  Ticket,
  Trophy,
  UserRound,
  X,
  XCircle,
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
  public_display_mode:
    | "full_name"
    | "first_name"
    | "ticket_number"
    | "none";
  public_display_consent: boolean;
  public_results_published_at: string | null;
  replacement_winner_id: string | null;
  original_winner_id: string | null;
  contact_attempts: ContactAttempt[];
  created_at: string;
  updated_at: string;
};

type ApiResponse = {
  ok: boolean;
  items?: WinnerRecord[];
  item?: WinnerRecord;
  error?: string;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type RequestError = {
  title: string;
  method: "GET" | "PATCH";
  endpoint: string;
  status?: number;
  statusText?: string;
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  troubleshooting: string[];
};

type WinnerFilter =
  | "all"
  | "needs_contact"
  | "in_progress"
  | "claimed"
  | "fulfilled"
  | "issues";

const API_ROUTE = "/api/admin/lotterymanagement/winners";

function getApiMessage(data: ApiResponse) {
  return data.error || data.message || "The server did not provide an error message.";
}

function getApiDetails(data: ApiResponse) {
  return data.details || data.hint || undefined;
}

function makeRequestError({
  title,
  method,
  endpoint,
  response,
  data,
}: {
  title: string;
  method: "GET" | "PATCH";
  endpoint: string;
  response: Response;
  data: ApiResponse;
}): RequestError {
  const isAuthError = response.status === 401 || response.status === 403;
  const isServerError = response.status >= 500;

  return {
    title,
    method,
    endpoint,
    status: response.status,
    statusText: response.statusText,
    code: data.code,
    message: getApiMessage(data),
    details: getApiDetails(data),
    hint: data.hint,
    troubleshooting: isAuthError
      ? [
          "Your admin session may have expired. Refresh the page and sign in again.",
          "Check that your account has permission to view or manage lottery winners.",
        ]
      : isServerError
        ? [
            "This is a server-side error. Check the Next.js terminal logs for this request.",
            "Check that the winners API route, Supabase connection and lottery tables are available.",
          ]
        : [
            "Check the request data and the API validation rules.",
            "Use the request details below to find the matching server log entry.",
          ],
  };
}

function makeNetworkError({
  title,
  method,
  endpoint,
  cause,
}: {
  title: string;
  method: "GET" | "PATCH";
  endpoint: string;
  cause: unknown;
}): RequestError {
  const message = cause instanceof Error ? cause.message : "Unknown network error";

  return {
    title,
    method,
    endpoint,
    message,
    troubleshooting: [
      "The browser could not complete the request. Check your internet connection and refresh the page.",
      "Make sure the Next.js development server is running and the API route exists.",
      "If this continues, check the browser Network tab and the Next.js terminal logs.",
    ],
  };
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

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "Not set";

  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
  }).format(Number(value || 0));
}

function publicWinnerDisplay(item: WinnerRecord) {
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

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false };
  } catch {
    return {
      ok: false,
      error: "The API returned invalid JSON.",
      code: "INVALID_JSON_RESPONSE",
      details: text
        ? `Response preview: ${text.slice(0, 500)}`
        : "The response body was empty.",
    };
  }
}

export default function WinnersClient() {
  const [items, setItems] = useState<WinnerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<RequestError | null>(null);
  const [selected, setSelected] = useState<WinnerRecord | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [testMode, setTestMode] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<WinnerStatus | "all">("all");
  const [lotteryId, setLotteryId] = useState("all");
  const [workflow, setWorkflow] = useState<WinnerFilter>("all");
  const [sort, setSort] = useState("newest");

  const [form, setForm] = useState({
    status: "contact_pending" as WinnerStatus,
    contact_method: "email",
    contact_outcome: "",
    contact_notes: "",
    public_display_mode: "first_name",
    public_display_consent: false,
    publish_to_live_draw: false,
    fulfilment_method: "",
    collection_delivery_date: "",
    fulfilment_notes: "",
    internal_notes: "",
    replacement_reason: "",
  });

  useEffect(() => {
    loadWinners();
  }, []);

  async function loadWinners() {
    setTestMode(false);
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setError(
          makeRequestError({
            title: "Could not load winner records",
            method: "GET",
            endpoint: API_ROUTE,
            response: res,
            data,
          }),
        );
        return;
      }

      setItems(data.items || []);
    } catch (err: unknown) {
      setError(
        makeNetworkError({
          title: "Could not load winner records",
          method: "GET",
          endpoint: API_ROUTE,
          cause: err,
        }),
      );
    } finally {
      setLoading(false);
    }
  }

  function startFullFeatureTest() {
    const now = Date.now();

    const demo: WinnerRecord[] = [
      makeTestWinner({
        id: "test-winner-contact",
        lotteryId: "test-lottery-1",
        lotteryTitle: "Test Summer Raffle 2026",
        prizeName: "Test Main Prize",
        prizeValue: 250,
        ticket: "BP-TEST-000104",
        entrantName: "Test Winner One",
        entrantEmail: "winner.one@example.test",
        status: "contact_pending",
        selectedAt: now - 45 * 60 * 1000,
        publicMode: "first_name",
      }),
      makeTestWinner({
        id: "test-winner-contacted",
        lotteryId: "test-lottery-1",
        lotteryTitle: "Test Summer Raffle 2026",
        prizeName: "Test Second Prize",
        prizeValue: 100,
        ticket: "BP-TEST-000057",
        entrantName: "Test Winner Two",
        entrantEmail: "winner.two@example.test",
        status: "contacted",
        selectedAt: now - 4 * 60 * 60 * 1000,
        contactedAt: now - 2 * 60 * 60 * 1000,
        publicMode: "ticket_number",
        attempts: [
          {
            id: "test-contact-1",
            method: "email",
            outcome: "Winner email sent",
            notes: "Waiting for reply.",
            attempted_at: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            admin_name: "Test Admin",
          },
        ],
      }),
      makeTestWinner({
        id: "test-winner-confirmed",
        lotteryId: "test-lottery-2",
        lotteryTitle: "Test Christmas Raffle 2026",
        prizeName: "Test Gift Voucher",
        prizeValue: 75,
        ticket: "BP-TEST-000210",
        entrantName: "Test Confirmed Winner",
        entrantEmail: "confirmed@example.test",
        status: "eligibility_confirmed",
        selectedAt: now - 3 * 24 * 60 * 60 * 1000,
        contactedAt: now - 2.5 * 24 * 60 * 60 * 1000,
        eligibilityAt: now - 2 * 24 * 60 * 60 * 1000,
        publicMode: "full_name",
      }),
      makeTestWinner({
        id: "test-winner-claimed",
        lotteryId: "test-lottery-2",
        lotteryTitle: "Test Christmas Raffle 2026",
        prizeName: "Test Hamper",
        prizeValue: 50,
        ticket: "BP-TEST-000211",
        entrantName: "Test Claimed Winner",
        entrantEmail: "claimed@example.test",
        status: "claimed",
        selectedAt: now - 7 * 24 * 60 * 60 * 1000,
        contactedAt: now - 6 * 24 * 60 * 60 * 1000,
        eligibilityAt: now - 5 * 24 * 60 * 60 * 1000,
        claimedAt: now - 4 * 24 * 60 * 60 * 1000,
        publicMode: "first_name",
      }),
      makeTestWinner({
        id: "test-winner-fulfilled",
        lotteryId: "test-lottery-3",
        lotteryTitle: "Test Community Fundraiser",
        prizeName: "Test Experience Prize",
        prizeValue: 150,
        ticket: "BP-TEST-000305",
        entrantName: "Test Fulfilled Winner",
        entrantEmail: "fulfilled@example.test",
        status: "fulfilled",
        selectedAt: now - 15 * 24 * 60 * 60 * 1000,
        contactedAt: now - 14 * 24 * 60 * 60 * 1000,
        eligibilityAt: now - 13 * 24 * 60 * 60 * 1000,
        claimedAt: now - 12 * 24 * 60 * 60 * 1000,
        fulfilledAt: now - 10 * 24 * 60 * 60 * 1000,
        collectionDate: now - 10 * 24 * 60 * 60 * 1000,
        fulfilmentMethod: "Collection",
        publicMode: "first_name",
      }),
      makeTestWinner({
        id: "test-winner-unclaimed",
        lotteryId: "test-lottery-3",
        lotteryTitle: "Test Community Fundraiser",
        prizeName: "Test Unclaimed Prize",
        prizeValue: 40,
        ticket: "BP-TEST-000306",
        entrantName: "Test Unclaimed Winner",
        entrantEmail: "unclaimed@example.test",
        status: "unclaimed",
        selectedAt: now - 30 * 24 * 60 * 60 * 1000,
        contactedAt: now - 29 * 24 * 60 * 60 * 1000,
        unclaimedAt: now - 2 * 24 * 60 * 60 * 1000,
        publicMode: "none",
      }),
      makeTestWinner({
        id: "test-winner-disqualified",
        lotteryId: "test-lottery-4",
        lotteryTitle: "Test Archived Draw",
        prizeName: "Test Replacement Prize",
        prizeValue: 60,
        ticket: "BP-TEST-000401",
        entrantName: "Test Disqualified Winner",
        entrantEmail: "disqualified@example.test",
        status: "disqualified",
        selectedAt: now - 20 * 24 * 60 * 60 * 1000,
        contactedAt: now - 19 * 24 * 60 * 60 * 1000,
        disqualifiedAt: now - 18 * 24 * 60 * 60 * 1000,
        publicMode: "none",
      }),
    ];

    setTestMode(true);
    setItems(demo);
    setSelected(null);
    setManageOpen(false);
    setError(null);
    setSearch("");
    setStatus("all");
    setLotteryId("all");
    setWorkflow("all");
    setSort("newest");
    setLoading(false);
  }

  const lotteries = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.lottery_id, item.lottery_title));
    return Array.from(map.entries()).sort((a, b) =>
      a[1].localeCompare(b[1]),
    );
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

      return matchesSearch && matchesStatus && matchesLottery && matchesWorkflow;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "oldest":
          return +new Date(a.selected_at) - +new Date(b.selected_at);
        case "prize_value":
          return Number(b.prize_value || 0) - Number(a.prize_value || 0);
        case "name":
          return (a.entrant_name || "").localeCompare(b.entrant_name || "");
        default:
          return +new Date(b.selected_at) - +new Date(a.selected_at);
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

  function openManage(item: WinnerRecord) {
    setSelected(item);
    setForm({
      status: item.status,
      contact_method: "email",
      contact_outcome: "",
      contact_notes: "",
      public_display_mode: item.public_display_mode,
      public_display_consent: item.public_display_consent,
      publish_to_live_draw: Boolean(item.public_results_published_at),
      fulfilment_method: item.fulfilment_method || "",
      collection_delivery_date: toLocalInput(item.collection_delivery_date),
      fulfilment_notes: item.fulfilment_notes || "",
      internal_notes: item.internal_notes || "",
      replacement_reason: "",
    });
    setManageOpen(true);
    setError(null);
  }

  async function saveWinner() {
    if (!selected) return;

    setSaving(true);
    setError(null);

    const nameDisplaySelected = ["full_name", "first_name"].includes(
      form.public_display_mode,
    );

    if (nameDisplaySelected && !form.public_display_consent) {
      setError({
        title: "Public permission is required",
        method: "PATCH",
        endpoint: `${API_ROUTE}/${selected.id}`,
        message:
          "You cannot publish a winner's name until you have recorded their permission.",
        troubleshooting: [
          "Ask the winner whether they agree to their full name or first name being published.",
          "Tick the permission box, or choose Ticket number only / Do not show winner identity.",
        ],
      });
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();

    if (testMode) {
      const newAttempt =
        form.contact_outcome.trim().length > 0
          ? {
              id: `test-contact-${Date.now()}`,
              method: form.contact_method as "email" | "phone" | "other",
              outcome: form.contact_outcome.trim(),
              notes: form.contact_notes.trim() || null,
              attempted_at: now,
              admin_name: "Test Admin",
            }
          : null;

      setItems((current) =>
        current.map((item) => {
          if (item.id !== selected.id) return item;

          const nextStatus = form.status;

          return {
            ...item,
            status: nextStatus,
            public_display_mode: form.public_display_mode as
              | "full_name"
              | "first_name"
              | "ticket_number"
              | "none",
            public_display_consent: form.public_display_consent,
            public_results_published_at:
              form.publish_to_live_draw && form.public_display_mode !== "none"
                ? item.public_results_published_at || now
                : null,
            fulfilment_method: form.fulfilment_method.trim() || null,
            collection_delivery_date: form.collection_delivery_date
              ? new Date(form.collection_delivery_date).toISOString()
              : null,
            fulfilment_notes: form.fulfilment_notes.trim() || null,
            internal_notes: form.internal_notes.trim() || null,
            contacted_at:
              ["contacted", "eligibility_confirmed", "claimed", "fulfilled"].includes(
                nextStatus,
              ) && !item.contacted_at
                ? now
                : item.contacted_at,
            eligibility_confirmed_at:
              ["eligibility_confirmed", "claimed", "fulfilled"].includes(
                nextStatus,
              ) && !item.eligibility_confirmed_at
                ? now
                : item.eligibility_confirmed_at,
            claimed_at:
              ["claimed", "fulfilled"].includes(nextStatus) && !item.claimed_at
                ? now
                : item.claimed_at,
            fulfilled_at:
              nextStatus === "fulfilled" && !item.fulfilled_at
                ? now
                : item.fulfilled_at,
            unclaimed_at:
              nextStatus === "unclaimed" && !item.unclaimed_at
                ? now
                : item.unclaimed_at,
            disqualified_at:
              nextStatus === "disqualified" && !item.disqualified_at
                ? now
                : item.disqualified_at,
            contact_attempts: newAttempt
              ? [newAttempt, ...item.contact_attempts]
              : item.contact_attempts,
            updated_at: now,
          };
        }),
      );

      setManageOpen(false);
      setSelected(null);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        id: selected.id,
        status: form.status,
        public_display_mode: form.public_display_mode,
        public_display_consent: form.public_display_consent,
        publish_to_live_draw: form.publish_to_live_draw,
        fulfilment_method: form.fulfilment_method.trim() || null,
        collection_delivery_date: form.collection_delivery_date
          ? new Date(form.collection_delivery_date).toISOString()
          : null,
        fulfilment_notes: form.fulfilment_notes.trim() || null,
        internal_notes: form.internal_notes.trim() || null,
        contact_attempt:
          form.contact_outcome.trim().length > 0
            ? {
                method: form.contact_method,
                outcome: form.contact_outcome.trim(),
                notes: form.contact_notes.trim() || null,
              }
            : null,
      };

      const res = await fetch(`${API_ROUTE}/${selected.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setError(
          makeRequestError({
            title: "Could not save winner changes",
            method: "PATCH",
            endpoint: `${API_ROUTE}/${selected.id}`,
            response: res,
            data,
          }),
        );
        return;
      }

      setManageOpen(false);
      setSelected(null);
      await loadWinners();
    } catch (err: unknown) {
      setError(
        makeNetworkError({
          title: "Could not save winner changes",
          method: "PATCH",
          endpoint: `${API_ROUTE}/${selected.id}`,
          cause: err,
        }),
      );
    } finally {
      setSaving(false);
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
              <h1 className="text-2xl font-extrabold text-white">
                Winners
              </h1>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-white/60">
                Manage selected winners, contact attempts, eligibility
                confirmation, prize claims, fulfilment and exceptional cases.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFullFeatureTest}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
            >
              <Beaker className="h-4 w-4" />
              Test full feature
            </button>

            <button
              type="button"
              onClick={loadWinners}
              disabled={loading}
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

      {testMode ? (
        <div className="rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          <div className="flex items-start gap-3">
            <Beaker className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-bold">Test mode is active</div>
              <div className="mt-1 text-yellow-100/70">
                These are fake winner records. You can test contact,
                eligibility, claim, fulfilment and issue workflows without
                writing to the real API or Supabase.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Needs contact"
          value={String(needsContact)}
          icon={<Mail className="h-5 w-5" />}
        />
        <StatCard
          label="In progress"
          value={String(inProgress)}
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatCard
          label="Fulfilled"
          value={String(fulfilled)}
          icon={<PackageCheck className="h-5 w-5" />}
        />
        <StatCard
          label="Issues / replacements"
          value={String(issues)}
          icon={<AlertTriangle className="h-5 w-5" />}
        />
      </section>

      {error ? (
        <RequestErrorAlert error={error} onRetry={loadWinners} />
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/65" />
          <h2 className="text-lg font-bold text-white">
            Search &amp; filters
          </h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Winner, email, ticket, prize, order or lottery..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select
            value={status}
            onChange={(v) => setStatus(v as WinnerStatus | "all")}
          >
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

          <Select
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
          <Select value={sort} onChange={setSort}>
            <option value="newest">Newest selected</option>
            <option value="oldest">Oldest selected</option>
            <option value="prize_value">Highest prize value</option>
            <option value="name">Winner name A-Z</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">
            Winner register
          </h2>
          <p className="mt-1 text-sm text-white/50">
            Showing {filtered.length} of {items.length} winner records
          </p>
        </div>

        {loading ? (
          <div className="flex min-h-52 items-center justify-center text-white/65">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading winners...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Trophy className="mx-auto h-8 w-8 text-white/30" />
            <h3 className="mt-3 font-bold text-white">
              No winners found
            </h3>
            <p className="mt-1 text-sm text-white/50">
              Winners will appear here after a completed draw.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <WinnerRow
                key={item.id}
                item={item}
                onView={() => setSelected(item)}
                onManage={() => openManage(item)}
              />
            ))}
          </div>
        )}
      </section>

      {selected && !manageOpen ? (
        <WinnerDetailsModal
          winner={selected}
          onClose={() => setSelected(null)}
          onManage={() => openManage(selected)}
        />
      ) : null}

      {selected && manageOpen ? (
        <ManageWinnerModal
          winner={selected}
          form={form}
          setForm={setForm}
          saving={saving}
          testMode={testMode}
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

function RequestErrorAlert({
  error,
  onRetry,
  retryLabel = "Try loading winners again",
}: {
  error: RequestError;
  onRetry: () => void;
  retryLabel?: string;
}) {
  return (
    <section
      className="rounded-2xl border border-red-400/40 bg-red-500/10 p-5 text-red-100"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" />

        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold">{error.title}</h2>
          <p className="mt-1 text-sm leading-6 text-red-100/90">
            {error.message}
          </p>

          <dl className="mt-4 grid gap-3 rounded-xl border border-red-300/20 bg-black/20 p-4 text-xs sm:grid-cols-2">
            <div>
              <dt className="font-bold uppercase tracking-wide text-red-100/60">
                Request
              </dt>
              <dd className="mt-1 break-all font-mono text-red-50">
                {error.method} {error.endpoint}
              </dd>
            </div>

            <div>
              <dt className="font-bold uppercase tracking-wide text-red-100/60">
                HTTP status
              </dt>
              <dd className="mt-1 font-mono text-red-50">
                {error.status
                  ? `${error.status}${error.statusText ? ` ${error.statusText}` : ""}`
                  : "No HTTP response received"}
              </dd>
            </div>

            {error.code ? (
              <div>
                <dt className="font-bold uppercase tracking-wide text-red-100/60">
                  Error code
                </dt>
                <dd className="mt-1 break-all font-mono text-red-50">
                  {error.code}
                </dd>
              </div>
            ) : null}

            {error.details ? (
              <div className="sm:col-span-2">
                <dt className="font-bold uppercase tracking-wide text-red-100/60">
                  Server detail
                </dt>
                <dd className="mt-1 whitespace-pre-wrap break-words font-mono text-red-50">
                  {error.details}
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="mt-4">
            <h3 className="text-sm font-bold">What to check</h3>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-red-100/85">
              {error.troubleshooting.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-red-200/30 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-50 hover:bg-red-950/40"
          >
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </button>
        </div>
      </div>
    </section>
  );
}

function WinnerRow({
  item,
  onView,
  onManage,
}: {
  item: WinnerRecord;
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
              label="Public result"
              value={publicWinnerDisplay(item)}
            />
            <Info
              label="Live Draw page"
              value={
                item.public_results_published_at
                  ? "Published"
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
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </button>

          <button
            type="button"
            onClick={onManage}
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
  onClose,
  onManage,
}: {
  winner: WinnerRecord;
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
          label="Public result"
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
              ["Display setting", winner.public_display_mode.replaceAll("_", " ")],
              ["Public result", publicWinnerDisplay(winner)],
              [
                "Replacement winner",
                winner.replacement_winner_id || "Not linked",
              ],
              ["Original winner", winner.original_winner_id || "Not applicable"],
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

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          onClick={onManage}
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
  testMode,
  error,
  onClose,
  onSave,
}: {
  winner: WinnerRecord;
  form: any;
  setForm: React.Dispatch<React.SetStateAction<any>>;
  saving: boolean;
  testMode: boolean;
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
      {testMode ? (
        <div className="mb-5 rounded-2xl border border-yellow-400/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
          Test mode — these changes only update the fake records on this page.
        </div>
      ) : null}

      {error ? (
        <div className="mb-5">
          <RequestErrorAlert
            error={error}
            onRetry={onSave}
            retryLabel="Try saving winner again"
          />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Winner status">
          <Field label="Workflow status">
            <select
              value={form.status}
              onChange={(e) =>
                setForm((p: any) => ({ ...p, status: e.target.value }))
              }
              className={inputClass}
            >
              {STATUS_OPTIONS.filter((x) => x.value !== "all").map(
                (option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </Field>

          <div className="mt-4 rounded-xl border border-amber-400/20 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100/80">
            A replacement winner must only come from the controlled redraw or
            reserve-winner process. Changing the status here must not silently
            select another ticket.
          </div>
        </Panel>

        <Panel title="Contact attempt">
          <div className="space-y-4">
            <Field label="Contact method">
              <select
                value={form.contact_method}
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    contact_method: e.target.value,
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
                  setForm((p: any) => ({
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
                  setForm((p: any) => ({
                    ...p,
                    contact_notes: e.target.value,
                  }))
                }
                className={`${inputClass} min-h-24`}
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
                  setForm((p: any) => ({
                    ...p,
                    fulfilment_method: e.target.value,
                  }))
                }
                className={inputClass}
                placeholder="Collection, delivery, post..."
              />
            </Field>

            <Field label="Collection / delivery date">
              <input
                type="datetime-local"
                value={form.collection_delivery_date}
                onChange={(e) =>
                  setForm((p: any) => ({
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
                  setForm((p: any) => ({
                    ...p,
                    fulfilment_notes: e.target.value,
                  }))
                }
                className={`${inputClass} min-h-24`}
              />
            </Field>
          </div>
        </Panel>

        <Panel title="Privacy & internal notes">
          <div className="space-y-4">
            <Field label="Public winner display">
              <select
                value={form.public_display_mode}
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    public_display_mode: e.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="full_name">Full name</option>
                <option value="first_name">First name only</option>
                <option value="ticket_number">Ticket number only</option>
                <option value="none">Do not show winner identity</option>
              </select>
            </Field>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.public_display_consent}
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    public_display_consent: e.target.checked,
                    public_display_mode: e.target.checked
                      ? p.public_display_mode
                      : "none",
                    publish_to_live_draw: e.target.checked
                      ? p.publish_to_live_draw
                      : false,
                  }))
                }
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-fuchsia-500"
              />
              <span>
                <strong className="block text-white">Winner gave permission to be named publicly</strong>
                Only tick this when the winner has agreed to the selected name display.
              </span>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-fuchsia-300/20 bg-fuchsia-500/10 p-3 text-sm text-white/80">
              <input
                type="checkbox"
                checked={form.publish_to_live_draw}
                disabled={!form.public_display_consent || form.public_display_mode === "none"}
                onChange={(e) =>
                  setForm((p: any) => ({ ...p, publish_to_live_draw: e.target.checked }))
                }
                className="mt-0.5 h-4 w-4 rounded border-white/20 bg-black/30 text-fuchsia-500 disabled:opacity-40"
              />
              <span>
                <strong className="block text-white">Publish on the Live Draw page</strong>
                This publishes only the approved name or ticket number. It never publishes email or phone details.
              </span>
            </label>

            <Field label="Internal notes">
              <textarea
                value={form.internal_notes}
                onChange={(e) =>
                  setForm((p: any) => ({
                    ...p,
                    internal_notes: e.target.value,
                  }))
                }
                className={`${inputClass} min-h-28`}
                placeholder="Only record necessary operational information."
              />
            </Field>
          </div>
        </Panel>
      </div>

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
          type="button"
          onClick={onSave}
          disabled={saving}
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
          <span className="text-xs text-white/45">
            {formatDate(value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ContactAttempts({ items }: { items: ContactAttempt[] }) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 text-sm text-white/45">
        No contact attempts recorded.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
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
            <p className="mt-2 text-xs leading-5 text-white/55">
              {item.notes}
            </p>
          ) : null}
        </div>
      ))}
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
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
          <div>
            <h2 className="text-xl font-extrabold text-white">{title}</h2>
            <p className="mt-1 text-sm text-white/55">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5 md:p-6">{children}</div>
      </div>
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
        <span className="text-xs font-bold uppercase tracking-wide">
          {label}
        </span>
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
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

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

function toLocalInput(value: string | null) {
  if (!value) return "";

  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function makeTestWinner({
  id,
  lotteryId,
  lotteryTitle,
  prizeName,
  prizeValue,
  ticket,
  entrantName,
  entrantEmail,
  status,
  selectedAt,
  contactedAt,
  eligibilityAt,
  claimedAt,
  fulfilledAt,
  unclaimedAt,
  disqualifiedAt,
  collectionDate,
  fulfilmentMethod,
  publicMode,
  attempts = [],
}: {
  id: string;
  lotteryId: string;
  lotteryTitle: string;
  prizeName: string;
  prizeValue: number;
  ticket: string;
  entrantName: string;
  entrantEmail: string;
  status: WinnerStatus;
  selectedAt: number;
  contactedAt?: number;
  eligibilityAt?: number;
  claimedAt?: number;
  fulfilledAt?: number;
  unclaimedAt?: number;
  disqualifiedAt?: number;
  collectionDate?: number;
  fulfilmentMethod?: string;
  publicMode: WinnerRecord["public_display_mode"];
  attempts?: ContactAttempt[];
}): WinnerRecord {
  return {
    id,
    lottery_id: lotteryId,
    lottery_title: lotteryTitle,
    lottery_slug: lotteryTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    draw_id: `test-draw-${lotteryId}`,
    draw_reference: `TEST-DRAW-${lotteryId.slice(-1)}`,
    prize_id: `test-prize-${id}`,
    prize_name: prizeName,
    prize_value: prizeValue,
    ticket_id: `test-ticket-${ticket}`,
    ticket_number: ticket,
    order_id: `test-order-${id}`,
    order_reference: `TEST-ORDER-${id.slice(-4).toUpperCase()}`,
    entrant_name: entrantName,
    entrant_email: entrantEmail,
    entrant_phone: "07123 000000",
    status,
    selected_at: new Date(selectedAt).toISOString(),
    contacted_at: contactedAt ? new Date(contactedAt).toISOString() : null,
    eligibility_confirmed_at: eligibilityAt
      ? new Date(eligibilityAt).toISOString()
      : null,
    claimed_at: claimedAt ? new Date(claimedAt).toISOString() : null,
    fulfilled_at: fulfilledAt ? new Date(fulfilledAt).toISOString() : null,
    unclaimed_at: unclaimedAt ? new Date(unclaimedAt).toISOString() : null,
    disqualified_at: disqualifiedAt
      ? new Date(disqualifiedAt).toISOString()
      : null,
    replaced_at: null,
    collection_delivery_date: collectionDate
      ? new Date(collectionDate).toISOString()
      : null,
    fulfilment_method: fulfilmentMethod || null,
    fulfilment_notes: fulfilmentMethod
      ? "Test fulfilment record."
      : null,
    internal_notes: null,
    public_display_mode: publicMode,
    public_display_consent: publicMode !== "none",
    public_results_published_at: null,
    replacement_winner_id: null,
    original_winner_id: null,
    contact_attempts: attempts,
    created_at: new Date(selectedAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}
