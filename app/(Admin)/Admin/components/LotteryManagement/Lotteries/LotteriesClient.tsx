"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Archive,
  CalendarDays,
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
  X,
  Check,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Settings2,
  PoundSterling,
  Beaker,
} from "lucide-react";

type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "paused"
  | "cancelled"
  | "under_review";

type Lottery = {
  id: string;
  title: string;
  slug: string;
  internal_reference: string | null;
  lottery_type: string;
  status: LotteryStatus;
  short_summary: string | null;
  ticket_price: number;
  currency: string;
  max_tickets: number | null;
  minimum_age: number;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  is_active: boolean;
  order_count?: number;
  paid_order_count?: number;
  ticket_count?: number;
  revenue?: number;
};

type ApiResponse = {
  ok: boolean;
  items?: Lottery[];
  item?: Lottery;

  error?: string;
  message?: string;
  code?: string;
  details?: unknown;
  request_id?: string;
};

type DetailedError = {
  title: string;
  message: string;
  code: string;
  httpStatus?: number;
  httpStatusText?: string;
  route?: string;
  method?: string;
  action?: string;
  lotteryId?: string;
  lotteryTitle?: string;
  requestId?: string;
  details?: unknown;
  occurredAt: string;
};

const API_ROUTE = "/api/admin/lotterymanagement/lottery";
const ROOT = "/Admin/LotteryManagement";
const REQUIRED_MINIMUM_AGE = 18;

const STATUS_OPTIONS: Array<{ value: LotteryStatus | "all"; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "compliance_review", label: "Compliance Review" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "sales_closed", label: "Sales Closed" },
  { value: "draw_ready", label: "Draw Ready" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "under_review", label: "Under Review" },
];

function statusLabel(status: LotteryStatus) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label ?? status;
}

function statusClass(status: LotteryStatus) {
  const map: Record<LotteryStatus, string> = {
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
  return map[status];
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/London",
  }).format(new Date(value));
}

function formatMoney(value: number, currency = "GBP") {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
  }).format(Number(value || 0));
}

async function readJson(res: Response): Promise<ApiResponse> {
  const text = await res.text();

  if (!text) {
    return {
      ok: false,
      error: "The API returned an empty response body.",
      code: "API_EMPTY_RESPONSE",
    };
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      error:
        "The API returned a response that could not be parsed as JSON.",
      code: "API_INVALID_JSON",
      details: {
        response_preview:
          text.length > 500
            ? `${text.slice(0, 500)}…`
            : text,
      },
    };
  }
}

function makeDetailedError({
  title,
  message,
  code,
  response,
  route,
  method,
  action,
  lottery,
  requestId,
  details,
}: {
  title: string;
  message: string;
  code: string;
  response?: Response;
  route?: string;
  method?: string;
  action?: string;
  lottery?: Lottery;
  requestId?: string;
  details?: unknown;
}): DetailedError {
  return {
    title,
    message,
    code,
    httpStatus: response?.status,
    httpStatusText: response?.statusText || undefined,
    route,
    method,
    action,
    lotteryId: lottery?.id,
    lotteryTitle: lottery?.title,
    requestId,
    details,
    occurredAt: new Date().toISOString(),
  };
}

function detailedErrorToText(error: DetailedError) {
  const parts = [
    error.message,
    `Error code: ${error.code}`,
  ];

  if (error.httpStatus) {
    parts.push(
      `HTTP: ${error.httpStatus}${
        error.httpStatusText
          ? ` ${error.httpStatusText}`
          : ""
      }`,
    );
  }

  if (error.action) {
    parts.push(`Action: ${error.action}`);
  }

  if (error.method || error.route) {
    parts.push(
      `Request: ${error.method || "REQUEST"} ${
        error.route || ""
      }`.trim(),
    );
  }

  if (error.lotteryId) {
    parts.push(`Lottery ID: ${error.lotteryId}`);
  }

  if (error.requestId) {
    parts.push(`Request ID: ${error.requestId}`);
  }

  return parts.join(" | ");
}

export default function LotteriesClient() {
  const [items, setItems] = useState<Lottery[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [detailedError, setDetailedError] =
    useState<DetailedError | null>(null);

  const [testMode, setTestMode] = useState(false);

  const [confirmAction, setConfirmAction] = useState<{
    type: "go_live" | "archive" | "close_sales";
    item: Lottery;
  } | null>(null);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<LotteryStatus | "all">("all");
  const [type, setType] = useState("all");
  const [year, setYear] = useState("all");
  const [sort, setSort] = useState("created_desc");

  const [createOpen, setCreateOpen] = useState(false);
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({
    title: "",
    slug: "",
    internal_reference: "",
    lottery_type: "small_society",
    short_summary: "",
    description: "",
    fundraising_purpose: "",
    publication_at: "",
    sales_open_at: "",
    sales_close_at: "",
    draw_at: "",
    results_publish_at: "",
    timezone: "Europe/London",
    ticket_price: "1.00",
    currency: "GBP",
    max_tickets: "",
    minimum_age: "18",
    promoting_society_legal_name: "Burton Pride C.I.C.",
    registration_licence_type: "",
    registration_licence_number: "",
    licensing_authority: "",
    responsible_promoter_name: "",
    responsible_promoter_address: "",
    geographic_eligibility: "Great Britain",
    terms_version: "",
    privacy_notice_version: "",
    responsible_gambling_info: "",
    required_ticket_wording: "",
    maximum_proceeds: "",
    maximum_prize_value: "",
    show_in_directory: true,
    allow_page_before_sales: false,
    show_ticket_count: false,
    show_amount_raised: false,
    show_remaining_tickets: false,
    show_prize_values: true,
    winner_display_mode: "first_name",
    countdown_enabled: true,
  });


  useEffect(() => {
    loadItems();
  }, []);

  function startFullFeatureTest() {
    const now = Date.now();

    const demoItems: Lottery[] = [
      {
        id: "test-lottery-live",
        title: "Test Summer Raffle 2026",
        slug: "test-summer-raffle-2026",
        internal_reference: "TEST-LOT-001",
        lottery_type: "small_society",
        status: "live",
        short_summary: "Test live lottery used to preview the full Lottery Management interface.",
        ticket_price: 1,
        currency: "GBP",
        max_tickets: 5000,
        minimum_age: REQUIRED_MINIMUM_AGE,
        sales_open_at: new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now + 8 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 10 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        is_active: true,
        order_count: 42,
        paid_order_count: 39,
        ticket_count: 184,
        revenue: 184,
      },
      {
        id: "test-lottery-draft",
        title: "Test Christmas Raffle 2026",
        slug: "test-christmas-raffle-2026",
        internal_reference: "TEST-LOT-002",
        lottery_type: "small_society",
        status: "draft",
        short_summary: "Draft test campaign for checking editing and filtering.",
        ticket_price: 2,
        currency: "GBP",
        max_tickets: 3000,
        minimum_age: REQUIRED_MINIMUM_AGE,
        sales_open_at: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now + 45 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now + 46 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 2 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        is_active: true,
        order_count: 0,
        paid_order_count: 0,
        ticket_count: 0,
        revenue: 0,
      },
      {
        id: "test-lottery-review",
        title: "Test Community Fundraiser",
        slug: "test-community-fundraiser",
        internal_reference: "TEST-LOT-003",
        lottery_type: "small_society",
        status: "compliance_review",
        short_summary: "Test campaign waiting for compliance approval.",
        ticket_price: 1,
        currency: "GBP",
        max_tickets: 1000,
        minimum_age: REQUIRED_MINIMUM_AGE,
        sales_open_at: null,
        sales_close_at: null,
        draw_at: null,
        created_at: new Date(now - 4 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
        is_active: true,
        order_count: 0,
        paid_order_count: 0,
        ticket_count: 0,
        revenue: 0,
      },
      {
        id: "test-lottery-archived",
        title: "Test Archived Pride Draw",
        slug: "test-archived-pride-draw",
        internal_reference: "TEST-LOT-004",
        lottery_type: "small_society",
        status: "archived",
        short_summary: "Archived test record for checking historical lottery display.",
        ticket_price: 1,
        currency: "GBP",
        max_tickets: 2000,
        minimum_age: REQUIRED_MINIMUM_AGE,
        sales_open_at: new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(),
        sales_close_at: new Date(now - 45 * 24 * 60 * 60 * 1000).toISOString(),
        draw_at: new Date(now - 44 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(now - 70 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(now - 44 * 24 * 60 * 60 * 1000).toISOString(),
        archived_at: new Date(now - 40 * 24 * 60 * 60 * 1000).toISOString(),
        is_active: false,
        order_count: 57,
        paid_order_count: 55,
        ticket_count: 250,
        revenue: 250,
      },
    ];

    setTestMode(true);
    setItems(demoItems);
    setError(null);
    setSearch("");
    setStatus("all");
    setType("all");
    setYear("all");
    setSort("created_desc");
  }

  async function loadItems() {
    setTestMode(false);
    setLoading(true);
    setError(null);
    setDetailedError(null);

    try {
      const res = await fetch(API_ROUTE, {
        cache: "no-store",
        credentials: "include",
      });
      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to load lotteries.");
      }

      setItems(data.items || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load lotteries.");
    } finally {
      setLoading(false);
    }
  }

  const types = useMemo(
    () =>
      Array.from(new Set(items.map((x) => x.lottery_type).filter(Boolean))).sort(),
    [items],
  );

  const years = useMemo(
    () =>
      Array.from(
        new Set(
          items.map((x) => new Date(x.created_at).getFullYear().toString()),
        ),
      ).sort((a, b) => Number(b) - Number(a)),
    [items],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();

    const result = items.filter((item) => {
      const matchesSearch =
        !q ||
        item.title.toLowerCase().includes(q) ||
        item.slug.toLowerCase().includes(q) ||
        item.id.toLowerCase().includes(q) ||
        (item.internal_reference || "").toLowerCase().includes(q);

      const matchesStatus = status === "all" || item.status === status;
      const matchesType = type === "all" || item.lottery_type === type;
      const matchesYear =
        year === "all" ||
        new Date(item.created_at).getFullYear().toString() === year;

      return matchesSearch && matchesStatus && matchesType && matchesYear;
    });

    return result.sort((a, b) => {
      switch (sort) {
        case "created_asc":
          return +new Date(a.created_at) - +new Date(b.created_at);
        case "closing_asc":
          return +(a.sales_close_at ? new Date(a.sales_close_at) : new Date(8640000000000000))
            - +(b.sales_close_at ? new Date(b.sales_close_at) : new Date(8640000000000000));
        case "draw_asc":
          return +(a.draw_at ? new Date(a.draw_at) : new Date(8640000000000000))
            - +(b.draw_at ? new Date(b.draw_at) : new Date(8640000000000000));
        case "revenue_desc":
          return Number(b.revenue || 0) - Number(a.revenue || 0);
        case "tickets_desc":
          return Number(b.ticket_count || 0) - Number(a.ticket_count || 0);
        default:
          return +new Date(b.created_at) - +new Date(a.created_at);
      }
    });
  }, [items, search, status, type, year, sort]);

  async function duplicateLottery(item: Lottery) {
    setActionId(item.id);
    setError(null);

    if (testMode) {
      const copy: Lottery = {
        ...item,
        id: `test-copy-${Date.now()}`,
        title: `${item.title} Copy`,
        slug: `${item.slug}-copy-${Date.now()}`,
        internal_reference: item.internal_reference
          ? `${item.internal_reference}-COPY`
          : "TEST-COPY",
        status: "draft",
        order_count: 0,
        paid_order_count: 0,
        ticket_count: 0,
        revenue: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        archived_at: null,
      };

      setItems((current) => [copy, ...current]);
      setActionId(null);
      return;
    }

    try {
      const res = await fetch(`${API_ROUTE}/${item.id}/duplicate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to duplicate lottery.");
      }

      await loadItems();
    } catch (err: any) {
      setError(err?.message || "Failed to duplicate lottery.");
    } finally {
      setActionId(null);
    }
  }

  async function archiveLottery(item: Lottery) {
    if (testMode) {
      setItems((current) =>
        current.map((lottery) =>
          lottery.id === item.id
            ? {
                ...lottery,
                status: "archived",
                is_active: false,
                archived_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : lottery,
        ),
      );
      return;
    }

    setConfirmAction(null);
    setActionId(item.id);
    setError(null);

    try {
      const res = await fetch(`${API_ROUTE}/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to archive lottery.");
      }

      await loadItems();
    } catch (err: any) {
      setError(err?.message || "Failed to archive lottery.");
    } finally {
      setActionId(null);
    }
  }

  async function closeSales(item: Lottery) {
    if (testMode) {
      setItems((current) =>
        current.map((lottery) =>
          lottery.id === item.id
            ? {
                ...lottery,
                status: "sales_closed",
                sales_close_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              }
            : lottery,
        ),
      );
      return;
    }

    setConfirmAction(null);
    setActionId(item.id);
    setError(null);

    try {
      const res = await fetch(`${API_ROUTE}/${item.id}/close-sales`, {
        method: "POST",
        credentials: "include",
      });
      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to close sales.");
      }

      await loadItems();
    } catch (err: any) {
      setError(err?.message || "Failed to close sales.");
    } finally {
      setActionId(null);
    }
  }


  async function goLiveLottery(item: Lottery) {
    setConfirmAction(null);
    setActionId(item.id);
    setError(null);

    if (testMode) {
      setItems((current) =>
        current.map((lottery) =>
          lottery.id === item.id
            ? {
                ...lottery,
                status: "live",
                is_active: true,
                archived_at: null,
                updated_at: new Date().toISOString(),
              }
            : lottery,
        ),
      );

      setActionId(null);
      return;
    }

    try {
      const res = await fetch(`${API_ROUTE}/${item.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          status: "live",
          is_active: true,
        }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        const problem = makeDetailedError({
          title: "Unable to make lottery live",
          message:
            data.error ||
            data.message ||
            "The Lottery Management API rejected the request to make this lottery live.",
          code:
            data.code ||
            (res.status === 401
              ? "LOTTERY_AUTH_REQUIRED"
              : res.status === 403
                ? "LOTTERY_PERMISSION_DENIED"
                : res.status === 404
                  ? "LOTTERY_NOT_FOUND"
                  : res.status === 405
                    ? "LOTTERY_PATCH_NOT_SUPPORTED"
                    : res.status === 409
                      ? "LOTTERY_STATUS_CONFLICT"
                      : res.status === 422
                        ? "LOTTERY_GO_LIVE_VALIDATION_FAILED"
                        : res.status >= 500
                          ? "LOTTERY_SERVER_ERROR"
                          : "LOTTERY_GO_LIVE_FAILED"),
          response: res,
          route: `${API_ROUTE}/${item.id}`,
          method: "PATCH",
          action: "Make lottery live",
          lottery: item,
          requestId: data.request_id,
          details: data.details,
        });

        setDetailedError(problem);
        throw new Error(
          detailedErrorToText(problem),
        );
      }

      setDetailedError(null);
      await loadItems();
    } catch (err: any) {
      if (!detailedError) {
        const problem = makeDetailedError({
          title: "Unable to make lottery live",
          message:
            err?.message ||
            "An unexpected client-side error occurred while making the lottery live.",
          code: "LOTTERY_GO_LIVE_CLIENT_ERROR",
          route: `${API_ROUTE}/${item.id}`,
          method: "PATCH",
          action: "Make lottery live",
          lottery: item,
          details:
            err instanceof Error
              ? {
                  name: err.name,
                }
              : undefined,
        });

        setDetailedError(problem);
        setError(
          detailedErrorToText(problem),
        );
      } else {
        setError(
          err?.message ||
            "Failed to make lottery live.",
        );
      }
    } finally {
      setActionId(null);
    }
  }

  function slugify(value: string) {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function updateCreateField(name: string, value: string | boolean) {
    setCreateForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "title" && !prev.slug) {
        next.slug = slugify(String(value));
      }
      return next;
    });
  }

  function closeCreateModal() {
    if (creating) return;
    setCreateOpen(false);
    setCreateStep(1);
    setCreateError(null);
  }

  function validateCreateStep(step: number) {
    if (step === 1) {
      if (!createForm.title.trim()) return "Enter a lottery title.";
      if (!createForm.slug.trim()) return "Enter a slug.";
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(createForm.slug)) {
        return "Slug must use lowercase letters, numbers and hyphens only.";
      }
      if (!createForm.lottery_type) return "Select a lottery type.";
    }

    if (step === 2) {
      if (!createForm.sales_open_at) return "Set the sales opening date and time.";
      if (!createForm.sales_close_at) return "Set the sales closing date and time.";
      if (!createForm.draw_at) return "Set the draw date and time.";

      const open = new Date(createForm.sales_open_at).getTime();
      const close = new Date(createForm.sales_close_at).getTime();
      const draw = new Date(createForm.draw_at).getTime();

      if (close <= open) return "Sales closing time must be after sales opening time.";
      if (draw < close) return "Draw time must be on or after the sales closing time.";
    }

    if (step === 3) {
      if (Number(createForm.ticket_price) <= 0) return "Ticket price must be more than £0.";
      if (Number(createForm.minimum_age) !== REQUIRED_MINIMUM_AGE) return "All Burton Pride lotteries must be 18+.";
      if (createForm.max_tickets && Number(createForm.max_tickets) <= 0) {
        return "Maximum tickets must be more than 0.";
      }
    }

    if (step === 4) {
      if (!createForm.promoting_society_legal_name.trim()) {
        return "Enter the promoting society legal name.";
      }
      if (!createForm.registration_licence_type.trim()) {
        return "Enter the registration or licence type.";
      }
      if (!createForm.licensing_authority.trim()) {
        return "Enter the licensing authority.";
      }
      if (!createForm.responsible_promoter_name.trim()) {
        return "Enter the responsible promoter name.";
      }
      if (!createForm.responsible_promoter_address.trim()) {
        return "Enter the responsible promoter address.";
      }
      if (!createForm.geographic_eligibility.trim()) {
        return "Enter geographic eligibility.";
      }
    }

    return null;
  }

  function nextCreateStep() {
    const validation = validateCreateStep(createStep);
    if (validation) {
      setCreateError(validation);
      return;
    }
    setCreateError(null);
    setCreateStep((step) => Math.min(5, step + 1));
  }

  async function submitCreateLottery() {
    const validation = validateCreateStep(4);
    if (validation) {
      setCreateError(validation);
      setCreateStep(4);
      return;
    }

    setCreating(true);
    setCreateError(null);

    if (testMode) {
      const now = new Date().toISOString();

      const demoLottery: Lottery = {
        id: `test-created-${Date.now()}`,
        title: createForm.title.trim(),
        slug: createForm.slug.trim(),
        internal_reference: createForm.internal_reference.trim() || null,
        lottery_type: createForm.lottery_type,
        status: "draft",
        short_summary: createForm.short_summary.trim() || null,
        ticket_price: Number(createForm.ticket_price),
        currency: createForm.currency,
        max_tickets: createForm.max_tickets ? Number(createForm.max_tickets) : null,
        minimum_age: REQUIRED_MINIMUM_AGE,
        sales_open_at: createForm.sales_open_at || null,
        sales_close_at: createForm.sales_close_at || null,
        draw_at: createForm.draw_at || null,
        created_at: now,
        updated_at: now,
        archived_at: null,
        is_active: true,
        order_count: 0,
        paid_order_count: 0,
        ticket_count: 0,
        revenue: 0,
      };

      setItems((current) => [demoLottery, ...current]);
      setCreateOpen(false);
      setCreateStep(1);
      setCreateForm((prev) => ({
        ...prev,
        title: "",
        slug: "",
        internal_reference: "",
        short_summary: "",
        description: "",
        fundraising_purpose: "",
        publication_at: "",
        sales_open_at: "",
        sales_close_at: "",
        draw_at: "",
        results_publish_at: "",
        minimum_age: String(REQUIRED_MINIMUM_AGE),
      }));
      setCreating(false);
      return;
    }

    try {
      const payload = {
        ...createForm,
        ticket_price: Number(createForm.ticket_price),
        minimum_age: REQUIRED_MINIMUM_AGE,
        max_tickets: createForm.max_tickets ? Number(createForm.max_tickets) : null,
        maximum_proceeds: createForm.maximum_proceeds
          ? Number(createForm.maximum_proceeds)
          : null,
        maximum_prize_value: createForm.maximum_prize_value
          ? Number(createForm.maximum_prize_value)
          : null,
        publication_at: createForm.publication_at || null,
        sales_open_at: createForm.sales_open_at || null,
        sales_close_at: createForm.sales_close_at || null,
        draw_at: createForm.draw_at || null,
        results_publish_at: createForm.results_publish_at || null,
      };

      const res = await fetch(API_ROUTE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        throw new Error(data.error || data.message || "Failed to create lottery.");
      }

      setCreateOpen(false);
      setCreateStep(1);
      setCreateForm((prev) => ({
        ...prev,
        title: "",
        slug: "",
        internal_reference: "",
        short_summary: "",
        description: "",
        fundraising_purpose: "",
        publication_at: "",
        sales_open_at: "",
        sales_close_at: "",
        draw_at: "",
        results_publish_at: "",
        minimum_age: String(REQUIRED_MINIMUM_AGE),
      }));

      await loadItems();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create lottery.");
    } finally {
      setCreating(false);
    }
  }

  async function runConfirmedAction() {
    if (!confirmAction) {
      return;
    }

    const { type, item } = confirmAction;

    if (type === "go_live") {
      await goLiveLottery(item);
      return;
    }

    if (type === "archive") {
      await archiveLottery(item);
      return;
    }

    if (type === "close_sales") {
      await closeSales(item);
    }
  }

  function getConfirmCopy() {
    if (!confirmAction) {
      return null;
    }

    const { type, item } = confirmAction;

    if (type === "go_live") {
      return {
        title: "Make lottery live?",
        description:
          `You are about to make "${item.title}" live. This can make the lottery available to the public and allow ticket sales according to its configured dates and public settings.`,
        warning:
          "Only continue if the lottery has passed the required compliance checks and all public information is ready.",
        confirmText: "Make lottery live",
        tone: "emerald" as const,
      };
    }

    if (type === "archive") {
      return {
        title: "Archive lottery?",
        description:
          `You are about to archive "${item.title}". The lottery record and history will be kept, but it will no longer be treated as an active lottery.`,
        warning:
          "This does not delete orders, tickets, audit records or historical data.",
        confirmText: "Archive lottery",
        tone: "amber" as const,
      };
    }

    return {
      title: "Close ticket sales?",
      description:
        `You are about to close ticket sales for "${item.title}". New purchases will stop once this action is completed.`,
      warning:
        "Check the closing time and lottery status before continuing.",
      confirmText: "Close ticket sales",
      tone: "orange" as const,
    };
  }

  const confirmCopy = getConfirmCopy();

  const liveCount = items.filter((x) => x.status === "live").length;
  const draftCount = items.filter((x) => x.status === "draft").length;
  const reviewCount = items.filter((x) =>
    ["compliance_review", "under_review"].includes(x.status),
  ).length;
  const archivedCount = items.filter((x) => x.status === "archived").length;

  return (
    <div className="w-full max-w-none space-y-6 px-0 py-4 md:py-6">
      <section className="rounded-3xl border border-white/10 bg-white/10 p-6 shadow-xl backdrop-blur-xl">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                <Ticket className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-extrabold text-white">Lotteries</h1>
                <p className="text-sm text-white/60">
                  Create and manage reusable lottery campaigns, sales dates, public pages and lifecycle status.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={startFullFeatureTest}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black transition hover:opacity-90"
            >
              <Beaker className="h-4 w-4" />
              Test full feature
            </button>

            <button
              type="button"
              onClick={loadItems}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black transition hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Create lottery
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
                You are using fake lottery records. Create, duplicate, close sales and archive actions only change this page and do not write to the real API or Supabase.
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Live lotteries" value={liveCount} />
        <StatCard label="Drafts" value={draftCount} />
        <StatCard label="Needs review" value={reviewCount} />
        <StatCard label="Archived" value={archivedCount} />
      </section>

      {detailedError ? (
        <section
          role="alert"
          className="
            overflow-hidden
            rounded-3xl
            border
            border-red-400/30
            bg-red-500/10
            shadow-xl
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              border-b
              border-red-400/20
              p-5

              sm:flex-row
              sm:items-start
              sm:justify-between
            "
          >
            <div className="flex items-start gap-3">
              <div
                className="
                  flex
                  h-11
                  w-11
                  shrink-0
                  items-center
                  justify-center
                  rounded-2xl
                  border
                  border-red-400/30
                  bg-red-500/15
                  text-red-200
                "
              >
                <XCircle className="h-5 w-5" />
              </div>

              <div>
                <div className="text-xs font-black uppercase tracking-[0.16em] text-red-200/70">
                  Lottery Management Error
                </div>

                <h2 className="mt-1 text-lg font-extrabold text-red-100">
                  {detailedError.title}
                </h2>

                <p className="mt-2 max-w-4xl text-sm leading-6 text-red-100/80">
                  {detailedError.message}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setDetailedError(null);
                setError(null);
              }}
              className="
                inline-flex
                min-h-10
                items-center
                justify-center
                rounded-xl
                border
                border-red-300/20
                px-4
                py-2
                text-xs
                font-bold
                text-red-100
                transition
                hover:bg-red-400/10
              "
            >
              Dismiss
            </button>
          </div>

          <div
            className="
              grid
              gap-3
              p-5

              md:grid-cols-2
              xl:grid-cols-4
            "
          >
            <ErrorInfo
              label="Error code"
              value={detailedError.code}
            />

            <ErrorInfo
              label="HTTP status"
              value={
                detailedError.httpStatus
                  ? `${detailedError.httpStatus}${
                      detailedError.httpStatusText
                        ? ` ${detailedError.httpStatusText}`
                        : ""
                    }`
                  : "No HTTP response"
              }
            />

            <ErrorInfo
              label="Action"
              value={
                detailedError.action ||
                "Unknown action"
              }
            />

            <ErrorInfo
              label="Request"
              value={`${detailedError.method || "REQUEST"} ${
                detailedError.route || "Unknown route"
              }`}
            />

            <ErrorInfo
              label="Lottery"
              value={
                detailedError.lotteryTitle ||
                "Not available"
              }
            />

            <ErrorInfo
              label="Lottery ID"
              value={
                detailedError.lotteryId ||
                "Not available"
              }
              mono
            />

            <ErrorInfo
              label="Request ID"
              value={
                detailedError.requestId ||
                "Not supplied by API"
              }
              mono
            />

            <ErrorInfo
              label="Occurred at"
              value={new Date(
                detailedError.occurredAt,
              ).toLocaleString(
                "en-GB",
                {
                  dateStyle: "medium",
                  timeStyle: "medium",
                },
              )}
            />
          </div>

          {detailedError.details !== undefined ? (
            <div className="border-t border-red-400/20 p-5">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-red-200/60">
                Server details
              </div>

              <pre
                className="
                  mt-3
                  max-h-72
                  overflow-auto
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/30
                  p-4
                  text-xs
                  leading-6
                  text-red-50
                "
              >
                {JSON.stringify(
                  detailedError.details,
                  null,
                  2,
                )}
              </pre>
            </div>
          ) : null}

          <div className="border-t border-red-400/20 p-5">
            <p className="text-xs leading-5 text-red-100/55">
              Use the error code, HTTP status, lottery ID and request ID when checking
              server logs. Sensitive authentication data, cookies and tokens are not
              displayed in this panel.
            </p>
          </div>
        </section>
      ) : error ? (
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-5 flex items-center gap-2">
          <Filter className="h-4 w-4 text-white/70" />
          <h2 className="text-lg font-bold text-white">Search & filters</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative xl:col-span-2">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, slug, ID or reference..."
              className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-11 pr-4 text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>

          <Select value={status} onChange={(v) => setStatus(v as LotteryStatus | "all")}>
            {STATUS_OPTIONS.map((x) => (
              <option key={x.value} value={x.value}>{x.label}</option>
            ))}
          </Select>

          <Select value={type} onChange={setType}>
            <option value="all">All types</option>
            {types.map((x) => <option key={x} value={x}>{x.replaceAll("_", " ")}</option>)}
          </Select>

          <Select value={year} onChange={setYear}>
            <option value="all">All years</option>
            {years.map((x) => <option key={x} value={x}>{x}</option>)}
          </Select>
        </div>

        <div className="mt-3 max-w-sm">
          <Select value={sort} onChange={setSort}>
            <option value="created_desc">Newest created</option>
            <option value="created_asc">Oldest created</option>
            <option value="closing_asc">Closing date</option>
            <option value="draw_asc">Draw date</option>
            <option value="revenue_desc">Revenue</option>
            <option value="tickets_desc">Ticket count</option>
          </Select>
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white">Lottery list</h2>
            <p className="mt-1 text-sm text-white/50">
              Showing {filtered.length} of {items.length} lotteries
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center text-white/70">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading lotteries...
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-black/20 p-8 text-center">
            <Ticket className="mx-auto h-8 w-8 text-white/35" />
            <h3 className="mt-3 font-bold text-white">No lotteries found</h3>
            <p className="mt-1 text-sm text-white/50">
              Create a new lottery or change your filters.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <LotteryRow
                key={item.id}
                item={item}
                busy={actionId === item.id}
                onDuplicate={() => duplicateLottery(item)}
                onArchive={() =>
                  setConfirmAction({
                    type: "archive",
                    item,
                  })
                }
                onCloseSales={() =>
                  setConfirmAction({
                    type: "close_sales",
                    item,
                  })
                }
                onGoLive={() =>
                  setConfirmAction({
                    type: "go_live",
                    item,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>

      {confirmAction && confirmCopy ? (
        <div
          className="
            fixed
            inset-0
            z-[10000]
            flex
            items-center
            justify-center
            bg-black/75
            p-4
            backdrop-blur-sm
          "
          role="dialog"
          aria-modal="true"
          aria-labelledby="lottery-confirm-title"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              !actionId
            ) {
              setConfirmAction(null);
            }
          }}
        >
          <div
            className="
              w-full
              max-w-xl
              overflow-hidden
              rounded-3xl
              border
              border-white/10
              bg-[#15172a]
              shadow-2xl
            "
          >
            <div
              className="
                flex
                items-start
                justify-between
                gap-4
                border-b
                border-white/10
                p-5
                sm:p-6
              "
            >
              <div className="flex items-start gap-3">
                <div
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
                    confirmCopy.tone === "emerald"
                      ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                      : confirmCopy.tone === "amber"
                        ? "border-amber-400/30 bg-amber-500/10 text-amber-200"
                        : "border-orange-400/30 bg-orange-500/10 text-orange-200",
                  ].join(" ")}
                >
                  {confirmCopy.tone === "emerald" ? (
                    <Check className="h-5 w-5" />
                  ) : (
                    <ShieldCheck className="h-5 w-5" />
                  )}
                </div>

                <div>
                  <h2
                    id="lottery-confirm-title"
                    className="text-xl font-extrabold text-white"
                  >
                    {confirmCopy.title}
                  </h2>

                  <p className="mt-1 text-sm text-white/55">
                    Confirm this Lottery Management action.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(actionId)}
                className="
                  rounded-xl
                  border
                  border-white/10
                  p-2
                  text-white/65
                  transition
                  hover:bg-white/10
                  hover:text-white
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
                aria-label="Close confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 sm:p-6">
              <p className="text-sm leading-7 text-white/80">
                {confirmCopy.description}
              </p>

              <div
                className="
                  mt-5
                  rounded-2xl
                  border
                  border-white/10
                  bg-black/20
                  p-4
                "
              >
                <div className="text-xs font-bold uppercase tracking-[0.14em] text-white/40">
                  Lottery
                </div>

                <div className="mt-1 text-lg font-extrabold text-white">
                  {confirmAction.item.title}
                </div>

                <div className="mt-1 text-xs text-white/45">
                  {confirmAction.item.slug}
                </div>
              </div>

              <div
                className={[
                  "mt-4 rounded-2xl border p-4 text-sm leading-6",
                  confirmCopy.tone === "emerald"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : confirmCopy.tone === "amber"
                      ? "border-amber-400/25 bg-amber-500/10 text-amber-100"
                      : "border-orange-400/25 bg-orange-500/10 text-orange-100",
                ].join(" ")}
              >
                {confirmCopy.warning}
              </div>
            </div>

            <div
              className="
                flex
                flex-col-reverse
                gap-3
                border-t
                border-white/10
                p-5
                sm:flex-row
                sm:justify-end
                sm:p-6
              "
            >
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(actionId)}
                className="
                  min-h-11
                  rounded-2xl
                  border
                  border-white/15
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-white/80
                  transition
                  hover:bg-white/10
                  disabled:cursor-not-allowed
                  disabled:opacity-40
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={runConfirmedAction}
                disabled={Boolean(actionId)}
                className={[
                  "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-extrabold transition disabled:cursor-not-allowed disabled:opacity-60",
                  confirmCopy.tone === "emerald"
                    ? "bg-emerald-400 text-emerald-950 hover:bg-emerald-300"
                    : confirmCopy.tone === "amber"
                      ? "bg-amber-300 text-amber-950 hover:bg-amber-200"
                      : "bg-orange-400 text-orange-950 hover:bg-orange-300",
                ].join(" ")}
              >
                {actionId ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Check className="h-4 w-4" />
                )}

                {actionId
                  ? "Please wait..."
                  : confirmCopy.confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {createOpen ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 p-3 backdrop-blur-sm md:p-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-lottery-title"
        >
          <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#15172a] shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-5 md:p-6">
              <div>
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10">
                    <Plus className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 id="create-lottery-title" className="text-xl font-extrabold text-white">
                      Create new lottery
                    </h2>
                    <p className="mt-1 text-sm text-white/55">
                      Create the campaign as a draft. It will not go live until the compliance checks are completed.
                    </p>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 disabled:opacity-50"
                aria-label="Close create lottery"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-white/10 px-5 py-4 md:px-6">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                {[
                  ["1", "Basic"],
                  ["2", "Dates"],
                  ["3", "Tickets"],
                  ["4", "Compliance"],
                  ["5", "Public settings"],
                ].map(([number, label]) => {
                  const active = Number(number) === createStep;
                  const complete = Number(number) < createStep;

                  return (
                    <button
                      key={number}
                      type="button"
                      onClick={() => Number(number) < createStep && setCreateStep(Number(number))}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-xs font-bold ${
                        active
                          ? "border-white/30 bg-white text-black"
                          : complete
                            ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-200"
                            : "border-white/10 bg-white/5 text-white/45"
                      }`}
                    >
                      <span className="flex h-6 w-6 items-center justify-center rounded-full border border-current/20">
                        {complete ? <Check className="h-3.5 w-3.5" /> : number}
                      </span>
                      <span className="hidden sm:inline">{label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="overflow-y-auto p-5 md:p-6">
              {createError ? (
                <div className="mb-5 rounded-2xl border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
                  {createError}
                </div>
              ) : null}

              {createStep === 1 ? (
                <CreateSection
                  icon={<Ticket className="h-5 w-5" />}
                  title="Basic information"
                  description="Set the identity of this reusable lottery campaign."
                >
                  <Field label="Lottery title" required>
                    <input
                      value={createForm.title}
                      onChange={(e) => updateCreateField("title", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Christmas Raffle 2026"
                    />
                  </Field>

                  <Field label="Unique slug" required hint="Used for the public /lottery/[slug] page.">
                    <input
                      value={createForm.slug}
                      onChange={(e) => updateCreateField("slug", slugify(e.target.value))}
                      className={inputClass}
                      placeholder="christmas-raffle-2026"
                    />
                  </Field>

                  <Field label="Internal reference / code">
                    <input
                      value={createForm.internal_reference}
                      onChange={(e) => updateCreateField("internal_reference", e.target.value)}
                      className={inputClass}
                      placeholder="BP-LOT-2026-001"
                    />
                  </Field>

                  <Field label="Lottery type / compliance profile" required>
                    <select
                      value={createForm.lottery_type}
                      onChange={(e) => updateCreateField("lottery_type", e.target.value)}
                      className={inputClass}
                    >
                      <option value="small_society">Small society lottery</option>
                      <option value="incidental_event">Incidental event lottery</option>
                      <option value="large_society">Large society lottery</option>
                      <option value="free_draw">Free draw / prize competition</option>
                    </select>
                  </Field>

                  <Field label="Short summary" full>
                    <textarea
                      value={createForm.short_summary}
                      onChange={(e) => updateCreateField("short_summary", e.target.value)}
                      className={`${inputClass} min-h-24`}
                      placeholder="Short summary shown in admin and public previews."
                    />
                  </Field>

                  <Field label="Full description" full>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => updateCreateField("description", e.target.value)}
                      className={`${inputClass} min-h-32`}
                      placeholder="Full lottery description."
                    />
                  </Field>

                  <Field label="Fundraising purpose / good cause" full>
                    <textarea
                      value={createForm.fundraising_purpose}
                      onChange={(e) => updateCreateField("fundraising_purpose", e.target.value)}
                      className={`${inputClass} min-h-24`}
                      placeholder="Explain what the money raised will support."
                    />
                  </Field>
                </CreateSection>
              ) : null}

              {createStep === 2 ? (
                <CreateSection
                  icon={<CalendarDays className="h-5 w-5" />}
                  title="Dates and times"
                  description="Configure publication, sales, draw and result timing."
                >
                  <Field label="Publication date/time">
                    <input
                      type="datetime-local"
                      value={createForm.publication_at}
                      onChange={(e) => updateCreateField("publication_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sales opening date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.sales_open_at}
                      onChange={(e) => updateCreateField("sales_open_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Sales closing date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.sales_close_at}
                      onChange={(e) => updateCreateField("sales_close_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Draw date/time" required>
                    <input
                      type="datetime-local"
                      value={createForm.draw_at}
                      onChange={(e) => updateCreateField("draw_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Results publication date/time">
                    <input
                      type="datetime-local"
                      value={createForm.results_publish_at}
                      onChange={(e) => updateCreateField("results_publish_at", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Timezone">
                    <select
                      value={createForm.timezone}
                      onChange={(e) => updateCreateField("timezone", e.target.value)}
                      className={inputClass}
                    >
                      <option value="Europe/London">Europe/London (UK)</option>
                    </select>
                  </Field>
                </CreateSection>
              ) : null}

              {createStep === 3 ? (
                <CreateSection
                  icon={<PoundSterling className="h-5 w-5" />}
                  title="Ticket setup"
                  description="Set fixed ticket pricing and entry limits."
                >
                  <Field label="Ticket price" required>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={createForm.ticket_price}
                      onChange={(e) => updateCreateField("ticket_price", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Currency">
                    <select
                      value={createForm.currency}
                      onChange={(e) => updateCreateField("currency", e.target.value)}
                      className={inputClass}
                    >
                      <option value="GBP">GBP (£)</option>
                    </select>
                  </Field>

                  <Field label="Maximum tickets">
                    <input
                      type="number"
                      min="1"
                      value={createForm.max_tickets}
                      onChange={(e) => updateCreateField("max_tickets", e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>

                  <Field label="Minimum participant age">
                    <div
                      className="
                        flex
                        min-h-12
                        items-center
                        justify-between
                        gap-3
                        rounded-2xl
                        border
                        border-emerald-400/25
                        bg-emerald-500/10
                        px-4
                        py-3
                        text-sm
                        font-bold
                        text-emerald-100
                      "
                    >
                      <div>
                        <div className="text-base font-extrabold">18+ only</div>
                        <div className="mt-1 text-xs font-medium text-emerald-100/65">
                          Fixed for every Burton Pride lottery and cannot be changed.
                        </div>
                      </div>

                      <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-200" />
                    </div>
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                    For profiles that require equal ticket pricing, quantity options must use the same individual ticket price. The system should not create discounted per-ticket bundles.
                  </div>
                </CreateSection>
              ) : null}

              {createStep === 4 ? (
                <CreateSection
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="Compliance"
                  description="Record the legal and operational details required before publication."
                >
                  <Field label="Promoting society legal name" required>
                    <input
                      value={createForm.promoting_society_legal_name}
                      onChange={(e) => updateCreateField("promoting_society_legal_name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Registration / licence type" required>
                    <input
                      value={createForm.registration_licence_type}
                      onChange={(e) => updateCreateField("registration_licence_type", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. Local authority registration"
                    />
                  </Field>

                  <Field label="Registration / licence number">
                    <input
                      value={createForm.registration_licence_number}
                      onChange={(e) => updateCreateField("registration_licence_number", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Licensing authority" required>
                    <input
                      value={createForm.licensing_authority}
                      onChange={(e) => updateCreateField("licensing_authority", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Responsible promoter name" required>
                    <input
                      value={createForm.responsible_promoter_name}
                      onChange={(e) => updateCreateField("responsible_promoter_name", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Geographic eligibility" required>
                    <input
                      value={createForm.geographic_eligibility}
                      onChange={(e) => updateCreateField("geographic_eligibility", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Responsible promoter address" full required>
                    <textarea
                      value={createForm.responsible_promoter_address}
                      onChange={(e) => updateCreateField("responsible_promoter_address", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <Field label="Terms version">
                    <input
                      value={createForm.terms_version}
                      onChange={(e) => updateCreateField("terms_version", e.target.value)}
                      className={inputClass}
                      placeholder="e.g. 2026-08-v1"
                    />
                  </Field>

                  <Field label="Privacy notice version">
                    <input
                      value={createForm.privacy_notice_version}
                      onChange={(e) => updateCreateField("privacy_notice_version", e.target.value)}
                      className={inputClass}
                    />
                  </Field>

                  <Field label="Maximum proceeds">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.maximum_proceeds}
                      onChange={(e) => updateCreateField("maximum_proceeds", e.target.value)}
                      className={inputClass}
                      placeholder="Profile limit"
                    />
                  </Field>

                  <Field label="Maximum prize value">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={createForm.maximum_prize_value}
                      onChange={(e) => updateCreateField("maximum_prize_value", e.target.value)}
                      className={inputClass}
                      placeholder="Profile limit"
                    />
                  </Field>

                  <Field label="Required ticket wording" full>
                    <textarea
                      value={createForm.required_ticket_wording}
                      onChange={(e) => updateCreateField("required_ticket_wording", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <Field label="Responsible gambling information" full>
                    <textarea
                      value={createForm.responsible_gambling_info}
                      onChange={(e) => updateCreateField("responsible_gambling_info", e.target.value)}
                      className={`${inputClass} min-h-24`}
                    />
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-blue-400/20 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100">
                    Creating the lottery does not approve compliance. The campaign will be saved as a Draft and must pass the publication compliance gate before it can be made Live.
                  </div>
                </CreateSection>
              ) : null}

              {createStep === 5 ? (
                <CreateSection
                  icon={<Settings2 className="h-5 w-5" />}
                  title="Public settings"
                  description="Choose what the public lottery page may display."
                >
                  <ToggleField
                    label="Show in public lottery directory"
                    checked={createForm.show_in_directory}
                    onChange={(v) => updateCreateField("show_in_directory", v)}
                  />
                  <ToggleField
                    label="Allow page before sales open"
                    checked={createForm.allow_page_before_sales}
                    onChange={(v) => updateCreateField("allow_page_before_sales", v)}
                  />
                  <ToggleField
                    label="Show tickets sold"
                    checked={createForm.show_ticket_count}
                    onChange={(v) => updateCreateField("show_ticket_count", v)}
                  />
                  <ToggleField
                    label="Show amount raised"
                    checked={createForm.show_amount_raised}
                    onChange={(v) => updateCreateField("show_amount_raised", v)}
                  />
                  <ToggleField
                    label="Show remaining tickets"
                    checked={createForm.show_remaining_tickets}
                    onChange={(v) => updateCreateField("show_remaining_tickets", v)}
                  />
                  <ToggleField
                    label="Show prize values"
                    checked={createForm.show_prize_values}
                    onChange={(v) => updateCreateField("show_prize_values", v)}
                  />
                  <ToggleField
                    label="Enable sales-close countdown"
                    checked={createForm.countdown_enabled}
                    onChange={(v) => updateCreateField("countdown_enabled", v)}
                  />

                  <Field label="Public winner display">
                    <select
                      value={createForm.winner_display_mode}
                      onChange={(e) => updateCreateField("winner_display_mode", e.target.value)}
                      className={inputClass}
                    >
                      <option value="full_name">Full name</option>
                      <option value="first_name">First name only</option>
                      <option value="ticket_number">Ticket number only</option>
                      <option value="none">Do not show winner identity</option>
                    </select>
                  </Field>

                  <div className="md:col-span-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5">
                    <div className="flex items-start gap-3">
                      <Check className="mt-0.5 h-5 w-5 shrink-0 text-emerald-200" />
                      <div>
                        <h3 className="font-bold text-emerald-100">Ready to create the draft</h3>
                        <p className="mt-1 text-sm leading-6 text-emerald-100/75">
                          This will create the lottery record and reserve the slug. It will remain Draft until the separate compliance approval and publishing process is completed.
                        </p>
                      </div>
                    </div>
                  </div>
                </CreateSection>
              ) : null}
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-white/10 p-5 sm:flex-row sm:items-center sm:justify-between md:px-6">
              <button
                type="button"
                onClick={() => {
                  setCreateError(null);
                  setCreateStep((step) => Math.max(1, step - 1));
                }}
                disabled={createStep === 1 || creating}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold text-white/80 hover:bg-white/10 disabled:opacity-50"
                >
                  Cancel
                </button>

                {createStep < 5 ? (
                  <button
                    type="button"
                    onClick={nextCreateStep}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90"
                  >
                    Continue
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={submitCreateLottery}
                    disabled={creating}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-extrabold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    {creating ? "Creating draft..." : "Create draft lottery"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ErrorInfo({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-red-300/15
        bg-black/20
        p-4
      "
    >
      <div className="text-[11px] font-black uppercase tracking-[0.14em] text-red-200/45">
        {label}
      </div>

      <div
        className={[
          "mt-1 break-words text-sm font-bold text-red-50",
          mono
            ? "font-mono text-xs"
            : "",
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="text-3xl font-black text-white">{value}</div>
      <div className="mt-1 text-sm text-white/55">{label}</div>
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
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
    </div>
  );
}

function LotteryRow({
  item,
  busy,
  onDuplicate,
  onArchive,
  onCloseSales,
  onGoLive,
}: {
  item: Lottery;
  busy: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  onCloseSales: () => void;
  onGoLive: () => void;
}) {
  const publicUrl = `/lottery/${item.slug}`;

  const canGoLive = [
    "draft",
    "compliance_review",
    "scheduled",
    "paused",
    "under_review",
  ].includes(item.status);

  return (
    <article className="rounded-2xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold text-white">{item.title}</h3>
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass(item.status)}`}>
              {statusLabel(item.status)}
            </span>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/60">
              {item.lottery_type.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs text-white/45">
            <span>Slug: {item.slug}</span>
            <span>Reference: {item.internal_reference || "Not set"}</span>
            <span>ID: {item.id}</span>
          </div>

          {item.short_summary ? (
            <p className="mt-3 max-w-4xl text-sm leading-6 text-white/65">
              {item.short_summary}
            </p>
          ) : null}

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MiniInfo label="Ticket price" value={formatMoney(item.ticket_price, item.currency)} />
            <MiniInfo label="Sales close" value={formatDate(item.sales_close_at)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
            <MiniInfo label="Draw" value={formatDate(item.draw_at)} icon={<CalendarDays className="h-3.5 w-3.5" />} />
            <MiniInfo label="Tickets issued" value={String(item.ticket_count || 0)} />
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 xl:max-w-md xl:justify-end">
          <Link
            href={`${ROOT}/Lotteries/${item.id}`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />
            View
          </Link>

          <Link
            href={`${ROOT}/Lotteries/${item.id}/Edit`}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>

          <button
            type="button"
            onClick={onDuplicate}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10 disabled:opacity-50"
          >
            <Copy className="h-3.5 w-3.5" />
            Duplicate
          </button>

          {canGoLive ? (
            <button
              type="button"
              onClick={onGoLive}
              disabled={busy}
              className="
                inline-flex
                items-center
                gap-2
                rounded-xl
                border
                border-emerald-400/30
                bg-emerald-500/15
                px-4
                py-2
                text-xs
                font-extrabold
                text-emerald-200
                transition
                hover:bg-emerald-500/25
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {busy ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}

              {busy ? "Going live..." : "Go live"}
            </button>
          ) : null}

          <Link
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/85 hover:bg-white/10"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Public page
          </Link>

          {item.status === "live" ? (
            <button
              type="button"
              onClick={onCloseSales}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-orange-400/20 bg-orange-500/10 px-3 py-2 text-xs font-bold text-orange-200 hover:bg-orange-500/20 disabled:opacity-50"
            >
              <XCircle className="h-3.5 w-3.5" />
              Close sales
            </button>
          ) : null}

          {item.status !== "archived" ? (
            <button
              type="button"
              onClick={onArchive}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 disabled:opacity-50"
            >
              <Archive className="h-3.5 w-3.5" />
              Archive
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function MiniInfo({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-[11px] uppercase tracking-wide text-white/35">{label}</div>
      <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-white/75">
        {icon}
        {value}
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-white/25";

function CreateSection({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-extrabold text-white">{title}</h3>
          <p className="mt-1 text-sm text-white/50">{description}</p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  full,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "md:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-semibold text-white/80">
        {label}
        {required ? <span className="ml-1 text-red-300">*</span> : null}
      </span>
      {children}
      {hint ? <span className="mt-2 block text-xs text-white/40">{hint}</span> : null}
    </label>
  );
}

function ToggleField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
      <span className="text-sm font-semibold text-white/80">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5"
      />
    </label>
  );
}
