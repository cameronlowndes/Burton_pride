"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import Link from "next/link";

import {
  AlertTriangle,
  ArrowLeft,
  CalendarDays,
  Check,
  CircleDollarSign,
  ExternalLink,
  Eye,
  FileText,
  Globe2,
  Heart,
  ImageIcon,
  Info,
  Loader2,
  Save,
  ShieldCheck,
  Ticket,
  Trophy,
  X,
} from "lucide-react";

type LotteryStatus =
  | "draft"
  | "compliance_review"
  | "scheduled"
  | "live"
  | "paused"
  | "sales_closed"
  | "draw_ready"
  | "completed"
  | "archived"
  | "cancelled"
  | "under_review";

type WinnerDisplayMode =
  | "full_name"
  | "first_name"
  | "ticket_number"
  | "none";

type Lottery = {
  paper_tickets_enabled?: boolean | null;

  id: string;

  title: string;
  slug: string;

  short_summary:
    | string
    | null;

  description:
    | string
    | null;

  fundraising_purpose:
    | string
    | null;

  hero_image_url:
    | string
    | null;

  status:
    LotteryStatus;

  is_active:
    boolean;

  ticket_price:
    | number
    | null;

  ticket_price_pence:
    | number
    | null;

  currency:
    string | null;

  minimum_age:
    number | null;

  max_tickets:
    number | null;

  publication_at:
    | string
    | null;

  sales_open_at:
    | string
    | null;

  sales_close_at:
    | string
    | null;

  draw_at:
    | string
    | null;

  results_publish_at:
    | string
    | null;

  geographic_eligibility:
    | string
    | null;

  terms_version:
    | string
    | null;

  privacy_notice_version:
    | string
    | null;

  responsible_gambling_info:
    | string
    | null;

  show_in_directory:
    boolean | null;

  show_in_public_directory:
    boolean | null;

  allow_page_before_sales:
    boolean | null;

  show_ticket_count:
    boolean | null;

  show_amount_raised:
    boolean | null;

  show_remaining_tickets:
    boolean | null;

  show_prize_values:
    boolean | null;

  countdown_enabled:
    boolean | null;

  winner_display_mode:
    WinnerDisplayMode | null;

  is_featured:
    boolean | null;

  order_count?:
    number;

  paid_order_count?:
    number;

  ticket_count?:
    number;

  prize_count?:
    number;

  winner_count?:
    number;

  revenue?:
    number;

  refund_total?:
    number;

  created_at?:
    string | null;

  updated_at?:
    string | null;
};

type EditForm = {
  title: string;

  shortSummary: string;

  description: string;

  fundraisingPurpose:
    string;

  heroImageUrl: string;

  status:
    LotteryStatus;

  ticketPrice: string;

  currency: string;

  minimumAge: string;

  maxTickets: string;

  publicationAt: string;

  salesOpenAt: string;

  salesCloseAt: string;

  drawAt: string;

  resultsPublishAt: string;

  geographicEligibility:
    string;

  termsVersion: string;

  privacyNoticeVersion:
    string;

  responsibleGamblingInfo:
    string;

  showInDirectory:
    boolean;

  allowPageBeforeSales:
    boolean;

  showTicketCount:
    boolean;

  showAmountRaised:
    boolean;

  showRemainingTickets:
    boolean;

  showPrizeValues:
    boolean;

  countdownEnabled:
    boolean;

  winnerDisplayMode:
    WinnerDisplayMode;

  isFeatured:
    boolean;
};

type ApiResponse = {
  ok?: boolean;

  item?: Lottery;

  error?: string;

  message?: string;

  code?: string;

  request_id?: string;

  details?: unknown;
};

// Lifecycle and age are server-owned; this form never mutates them.
const LOTTERY_STATUSES = new Set<LotteryStatus>([
  "draft", "compliance_review", "scheduled", "live", "paused", "sales_closed",
  "draw_ready", "completed", "archived", "cancelled", "under_review",
]);
const REQUEST_TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 2 * 1024 * 1024;

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function toDateTimeLocal(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  const pad = (
    number: number,
  ) =>
    String(number)
      .padStart(
        2,
        "0",
      );

  return [
    date.getFullYear(),
    "-",
    pad(
      date.getMonth() +
        1,
    ),
    "-",
    pad(
      date.getDate(),
    ),
    "T",
    pad(
      date.getHours(),
    ),
    ":",
    pad(
      date.getMinutes(),
    ),
  ].join("");
}

function localDateToIso(
  value: string,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function isSafeImageUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch { return false; }
}

function isLottery(value: unknown): value is Lottery {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  const strings = ["short_summary", "description", "fundraising_purpose", "hero_image_url", "currency",
    "publication_at", "sales_open_at", "sales_close_at", "draw_at", "results_publish_at",
    "geographic_eligibility", "terms_version", "privacy_notice_version", "responsible_gambling_info",
    "created_at", "updated_at"];
  const numbers = ["ticket_price", "ticket_price_pence", "minimum_age", "max_tickets", "order_count",
    "paid_order_count", "ticket_count", "prize_count", "winner_count", "revenue", "refund_total"];
  const booleans = ["is_active", "show_in_public_directory", "allow_page_before_sales", "show_ticket_count",
    "show_amount_raised", "show_remaining_tickets", "show_prize_values", "countdown_enabled", "is_featured"];
  return typeof item.id === "string" && item.id.length > 0 &&
    typeof item.title === "string" && typeof item.slug === "string" &&
    typeof item.status === "string" && LOTTERY_STATUSES.has(item.status as LotteryStatus) &&
    strings.every(key => item[key] == null || typeof item[key] === "string") &&
    numbers.every(key => item[key] == null || (typeof item[key] === "number" && Number.isFinite(item[key]))) &&
    booleans.every(key => item[key] == null || typeof item[key] === "boolean") &&
    (item.winner_display_mode == null || ["full_name", "first_name", "ticket_number", "none"].includes(String(item.winner_display_mode)));
}

async function readJson(response: Response): Promise<ApiResponse> {
  // Never display raw HTML, database diagnostics, or unexpected exception text.
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Invalid response");
  const decoder = new TextDecoder();
  let result = "";
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) throw new Error("Response too large");
      result += decoder.decode(value, { stream: true });
    }
    result += decoder.decode();
    const data: unknown = JSON.parse(result);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Invalid response");
    const raw = data as Record<string, unknown>;
    return {
      ok: raw.ok === true,
      item: isLottery(raw.item) ? raw.item : undefined,
      request_id: typeof raw.request_id === "string" && /^[a-zA-Z0-9_-]{1,100}$/.test(raw.request_id)
        ? raw.request_id : undefined,
    };
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}

async function requestLottery(route: string, init: RequestInit, signal: AbortSignal) {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener("abort", abort, { once: true });
  if (signal.aborted) abort();
  const timer = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(route, {
      ...init, credentials: "include", cache: "no-store", signal: controller.signal,
    });
    const data = await readJson(response);
    return { response, data };
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", abort);
  }
}

function responseError(status: number, request_id?: string): ApiResponse {
  const error = status === 401 ? "Your session has expired. Sign in again before continuing." :
    status === 403 ? "You do not have permission to make this change." :
    status === 409 ? "This change conflicts with the current lottery or requires a separate approval workflow. Reload and review it." :
    status === 400 || status === 422 ? "The server rejected these changes. Check the fields and the lottery's compliance requirements." :
    "The request could not be completed. Reload the lottery and check its current values.";
  return { ok: false, code: `LOTTERY_EDIT_HTTP_${status}`, error, request_id };
}

const EDIT_COLUMNS: Record<keyof EditForm, string[]> = {
  title: ["title"], shortSummary: ["short_summary"],
  description: ["description"], fundraisingPurpose: ["fundraising_purpose"],
  heroImageUrl: ["hero_image_url"], status: [],
  ticketPrice: ["ticket_price"], currency: ["currency"],
  minimumAge: [], maxTickets: ["max_tickets"],
  publicationAt: ["publication_at"], salesOpenAt: ["sales_open_at"],
  salesCloseAt: ["sales_close_at"], drawAt: ["draw_at"],
  resultsPublishAt: ["results_publish_at"],
  geographicEligibility: ["geographic_eligibility"],
  termsVersion: ["terms_version"], privacyNoticeVersion: ["privacy_notice_version"],
  responsibleGamblingInfo: ["responsible_gambling_info"],
  showInDirectory: ["show_in_public_directory"],
  allowPageBeforeSales: ["allow_page_before_sales"],
  showTicketCount: ["show_ticket_count"], showAmountRaised: ["show_amount_raised"],
  showRemainingTickets: ["show_remaining_tickets"], showPrizeValues: ["show_prize_values"],
  countdownEnabled: ["countdown_enabled"],
  winnerDisplayMode: ["winner_display_mode"], isFeatured: ["is_featured"],
};

function lotteryToEditForm(item: Lottery): EditForm {
  return {
      title: item.title || "",
      shortSummary: item.short_summary || "",
      description: item.description || "",
      fundraisingPurpose: item.fundraising_purpose || "",
      heroImageUrl: item.hero_image_url || "",
      status: item.status,
      ticketPrice: Number(item.ticket_price ?? (item.ticket_price_pence ?? 0) / 100).toFixed(2),
      currency: item.currency || "GBP",
      minimumAge: item.minimum_age != null ? String(item.minimum_age) : "",
      maxTickets: item.max_tickets != null ? String(item.max_tickets) : "",
      publicationAt: toDateTimeLocal(item.publication_at),
      salesOpenAt: toDateTimeLocal(item.sales_open_at),
      salesCloseAt: toDateTimeLocal(item.sales_close_at),
      drawAt: toDateTimeLocal(item.draw_at),
      resultsPublishAt: toDateTimeLocal(item.results_publish_at),
      geographicEligibility: item.geographic_eligibility || "",
      termsVersion: item.terms_version || "",
      privacyNoticeVersion: item.privacy_notice_version || "",
      responsibleGamblingInfo: item.responsible_gambling_info || "",
      showInDirectory: item.show_in_public_directory === true,
      allowPageBeforeSales: item.allow_page_before_sales === true,
      showTicketCount: item.show_ticket_count === true,
      showAmountRaised: item.show_amount_raised === true,
      showRemainingTickets: item.show_remaining_tickets === true,
      showPrizeValues: item.show_prize_values === true,
      countdownEnabled: item.countdown_enabled === true,
      winnerDisplayMode: item.winner_display_mode || "ticket_number",
      isFeatured: item.is_featured === true,
  };
}


export default function EditLotteryPage({ params }: PageProps) {
  const [id, setId] = useState("");
  const [lottery, setLottery] = useState<Lottery | null>(null);
  const [form, setForm] = useState<EditForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiResponse | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [confirmSave, setConfirmSave] = useState(false);
  const [saveUncertain, setSaveUncertain] = useState(false);
  const editVersion = useRef(0);
  const savingRef = useRef(false);
  const lifecycle = useRef<AbortController | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    params.then(result => {
      if (!active) return;
      if (!result.id) throw new Error("Missing lottery ID");
      setId(result.id);
    }).catch(() => {
      if (active) {
        setLoading(false);
        setError({ error: "Unable to resolve the lottery. Return to the lottery list and open it again." });
      }
    });
    return () => { active = false; };
  }, [params]);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();
    lifecycle.current = controller;
    setLoading(true);
    setLottery(null);
    setForm(null);
    setError(null);
    setSuccess(null);
    setConfirmSave(false);
    setSaveUncertain(false);
    setSaving(false);
    savingRef.current = false;
    editVersion.current += 1;
    async function load() {
      try {
        const { response, data } = await requestLottery(
          `/api/admin/lotterymanagement/lottery/${encodeURIComponent(id)}`,
          { method: "GET" }, controller.signal,
        );
        if (controller.signal.aborted) return;
        if (!response.ok || !data.ok || !data.item || data.item.id !== id) {
          setError(responseError(response.status, data.request_id));
          return;
        }
        setLottery(data.item);
        setForm(lotteryToEditForm(data.item));
      } catch {
        if (!controller.signal.aborted) setError({ error: "Unable to load the lottery. Reload the page to try again." });
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => { controller.abort(); };
  }, [id]);

  useEffect(() => {
    if (!confirmSave) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const previousFocus = document.activeElement;
    dialog.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [confirmSave]);

  function updateField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    if (savingRef.current || key === "status" || key === "minimumAge") return;
    editVersion.current += 1;
    setForm(current => current ? { ...current, [key]: value } : current);
    setSuccess(null);
  }

  const hasChanges = useMemo(() => {
    if (!form || !lottery) return false;
    const initial = lotteryToEditForm(lottery);
    return (Object.keys(initial) as (keyof EditForm)[]).some(key => form[key] !== initial[key]);
  }, [form, lottery]);

  function validate() {
    if (!form || !lottery) return "The edit form is not available.";
    if (!form.title.trim()) return "Lottery title is required.";
    if (form.status !== lottery.status || form.minimumAge !== lotteryToEditForm(lottery).minimumAge)
      return "Status and minimum age must be managed through their approved workflows.";
    if (!/^\d+(?:\.\d{1,2})?$/.test(form.ticketPrice.trim()) ||
        !Number.isSafeInteger(Math.round(Number(form.ticketPrice) * 100)) || Number(form.ticketPrice) <= 0)
      return "Ticket price must be positive and have no more than two decimal places.";
    if (form.currency !== "GBP") return "This form supports GBP. Review other currencies separately.";
    if (form.maxTickets && (!/^\d+$/.test(form.maxTickets) ||
        !Number.isSafeInteger(Number(form.maxTickets)) || Number(form.maxTickets) <= 0))
      return "Maximum tickets must be a positive whole number.";
    if (form.heroImageUrl.trim()) {
      try {
        const url = new URL(form.heroImageUrl.trim());
        if (url.protocol !== "https:" || url.username || url.password) throw new Error();
      } catch { return "Use an HTTPS image URL without a username or password."; }
    }
    const dates = [form.publicationAt, form.salesOpenAt, form.salesCloseAt, form.drawAt, form.resultsPublishAt];
    for (const value of dates) {
      if (value && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) ||
          !localDateToIso(value) || toDateTimeLocal(localDateToIso(value)) !== value))
        return "Enter valid dates and times. A clock-change gap is not a valid local time.";
    }
    if (form.salesOpenAt && form.salesCloseAt && form.salesCloseAt <= form.salesOpenAt)
      return "Ticket sales must close after they open.";
    if (form.salesCloseAt && form.drawAt && form.drawAt < form.salesCloseAt)
      return "The draw date must be on or after ticket sales close.";
    if (form.resultsPublishAt && (!form.drawAt || form.resultsPublishAt < form.drawAt))
      return "Results publication requires a draw date and cannot be earlier than the draw.";
    if (form.publicationAt && form.salesOpenAt && form.publicationAt > form.salesOpenAt)
      return "Publication cannot be later than ticket sales open.";
    return null;
  }

  function requestSave() {
    if (savingRef.current || !hasChanges || saveUncertain) return;
    const problem = validate();
    if (problem) {
      setError({ ok: false, code: "LOTTERY_EDIT_VALIDATION_FAILED", error: problem });
      return;
    }
    setError(null);
    setConfirmSave(true);
  }

  async function saveChanges() {
    if (savingRef.current || saveUncertain || !form || !lottery || !hasChanges) return;
    const problem = validate();
    if (problem) {
      setConfirmSave(false);
      setError({ error: problem, code: "LOTTERY_EDIT_VALIDATION_FAILED" });
      return;
    }
    const controller = lifecycle.current;
    if (!controller || controller.signal.aborted) return;
    savingRef.current = true;
    const submittedVersion = editVersion.current;
    setConfirmSave(false);
    setSaving(true);
    setError(null);
    setSuccess(null);
    let mutationSent = false;
    try {
      const fullBody = {
        title: form.title.trim(), short_summary: form.shortSummary.trim() || null,
        description: form.description.trim() || null,
        fundraising_purpose: form.fundraisingPurpose.trim() || null,
        hero_image_url: form.heroImageUrl.trim() || null,
        ticket_price: Number(form.ticketPrice), currency: form.currency,
        max_tickets: form.maxTickets ? Number(form.maxTickets) : null,
        publication_at: localDateToIso(form.publicationAt), sales_open_at: localDateToIso(form.salesOpenAt),
        sales_close_at: localDateToIso(form.salesCloseAt), draw_at: localDateToIso(form.drawAt),
        results_publish_at: localDateToIso(form.resultsPublishAt),
        geographic_eligibility: form.geographicEligibility.trim() || null,
        terms_version: form.termsVersion.trim() || null,
        privacy_notice_version: form.privacyNoticeVersion.trim() || null,
        responsible_gambling_info: form.responsibleGamblingInfo.trim() || null,
        show_in_public_directory: form.showInDirectory, allow_page_before_sales: form.allowPageBeforeSales,
        show_ticket_count: form.showTicketCount, show_amount_raised: form.showAmountRaised,
        show_remaining_tickets: form.showRemainingTickets, show_prize_values: form.showPrizeValues,
        countdown_enabled: form.countdownEnabled, winner_display_mode: form.winnerDisplayMode,
        is_featured: form.isFeatured,
      };
      const baseline = lotteryToEditForm(lottery);
      const changedColumns = new Set((Object.keys(baseline) as (keyof EditForm)[])
        .filter(key => form[key] !== baseline[key]).flatMap(key => EDIT_COLUMNS[key]));
      const body = Object.fromEntries(Object.entries(fullBody).filter(([key]) => changedColumns.has(key)));
      if (!Object.keys(body).length) return;
      const route = `/api/admin/lotterymanagement/lottery/${encodeURIComponent(lottery.id)}`;
      mutationSent = true;
      const { response, data } = await requestLottery(route, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }, controller.signal);
      if (controller.signal.aborted) return;
      if (!response.ok || !data.ok) {
        setError(responseError(response.status, data.request_id));
        // Even an error response can follow a partial server write. Require a reload.
        setSaveUncertain(true);
        return;
      }
      const { response: refreshedResponse, data: refreshed } = await requestLottery(
        route, { method: "GET" }, controller.signal,
      );
      if (controller.signal.aborted) return;
      if (!refreshedResponse.ok || !refreshed.ok || !refreshed.item || refreshed.item.id !== lottery.id)
        throw new Error("Verification failed");
      const item = refreshed.item;
      const actual: Record<string, unknown> = { ...item };
      actual.ticket_price = item.ticket_price ?? (item.ticket_price_pence ?? 0) / 100;
      const mismatches = Object.entries(body).filter(([key, expected]) => {
        const received = actual[key];
        if (key.endsWith("_at")) return expected === null ? received != null :
          !received || new Date(String(expected)).getTime() !== new Date(String(received)).getTime();
        if (key === "ticket_price" || key === "max_tickets") return expected === null ? received != null :
          received == null || Number(expected) !== Number(received);
        return expected !== received;
      });
      if (mismatches.length) throw new Error("Verification failed");
      setLottery(item);
      setForm(current => editVersion.current === submittedVersion ? lotteryToEditForm(item) : current);
      setSuccess(editVersion.current === submittedVersion ? "Lottery changes saved and verified." :
        "Earlier changes saved. You have newer unsaved edits.");
    } catch {
      if (!controller.signal.aborted) {
        setSaveUncertain(mutationSent);
        setError({ code: "LOTTERY_EDIT_SAVE_UNVERIFIED", error: mutationSent ?
          "The save outcome could not be verified. Reload the page and check the stored values before trying again. Your edits remain visible." :
          "Unable to prepare these changes. Check the form and try again." });
      }
    } finally {
      if (!controller.signal.aborted) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  }

  /*
   * =====================================================
   * LOADING
   * =====================================================
   */
  if (loading) {
    return (
      <main
        className="
          flex
          min-h-[70vh]
          items-center
          justify-center
          p-6
        "
      >
        <div className="text-center">
          <Loader2
            className="
              mx-auto
              h-10
              w-10
              animate-spin
              text-purple-300
            "
          />

          <p
            className="
              mt-4
              font-bold
              text-white/70
            "
          >
            Loading lottery...
          </p>
        </div>
      </main>
    );
  }

  if (
    !form ||
    !lottery
  ) {
    return (
      <main className="p-6">
        <div
          className="
            rounded-3xl
            border
            border-red-400/30
            bg-red-500/10
            p-6
            text-red-100
          "
        >
          {error?.error || "Unable to load the lottery edit form."}
          <Link className="mt-4 block underline" href="/Admin/LotteryManagement/Lotteries">Return to lottery list</Link>
        </div>
      </main>
    );
  }

  return (
    <main
      className="
        w-full
        px-4
        pb-24
        pt-6

        sm:px-6

        lg:px-8
      "
    >
      {saveUncertain && <p role="alert" className="mb-4 rounded-2xl border border-amber-300/30 bg-amber-500/10 p-4 text-amber-100">
        Reload this page and check the stored values before saving again. Copy any edits you want to keep first.
      </p>}
      <fieldset disabled={saving} className="min-w-0 border-0 p-0">
      {/* =====================================================
          HEADER
          ===================================================== */}
      <div
        className="
          flex
          flex-col
          gap-5

          xl:flex-row
          xl:items-start
          xl:justify-between
        "
      >
        <div>
          <div
            className="
              flex
              flex-wrap
              items-center
              gap-2
            "
          >
            <Link
              href="/Admin/LotteryManagement/Lotteries"
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-white/15
                px-4
                py-2
                text-sm
                font-bold
                text-white/75
                transition

                hover:bg-white/10
                hover:text-white
              "
            >
              <ArrowLeft className="h-4 w-4" />

              Lottery list
            </Link>

            <Link
              href={`/Admin/LotteryManagement/Lotteries/${lottery.id}`}
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-white/15
                px-4
                py-2
                text-sm
                font-bold
                text-white/75
                transition

                hover:bg-white/10
                hover:text-white
              "
            >
              <Eye className="h-4 w-4" />

              View lottery
            </Link>

            <Link
              href={`/lottery/${lottery.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="
                inline-flex
                min-h-10
                items-center
                gap-2
                rounded-xl
                border
                border-purple-300/20
                bg-purple-500/10
                px-4
                py-2
                text-sm
                font-bold
                text-purple-200
                transition

                hover:bg-purple-500/20
              "
            >
              <ExternalLink className="h-4 w-4" />

              Public page
            </Link>
          </div>

          <p
            className="
              mt-6
              text-xs
              font-black
              uppercase
              tracking-[0.18em]
              text-purple-300
            "
          >
            Lottery Management
          </p>

          <h1
            className="
              mt-2
              text-3xl
              font-black
              text-white

              sm:text-4xl
            "
          >
            Edit {lottery.title}
          </h1>

          <p
            className="
              mt-3
              max-w-3xl
              leading-7
              text-white/55
            "
          >
            Update the lottery&apos;s public information,
            sales dates, pricing, eligibility, terms and
            visibility settings.
          </p>

          <div
            className="
              mt-4
              flex
              flex-wrap
              gap-2
            "
          >
            <Badge>
              ID: {lottery.id}
            </Badge>

            <Badge>
              /lottery/{lottery.slug}
            </Badge>

            <StatusBadge
              status={
                lottery.status
              }
            />
          </div>
        </div>

        <div
          className="
            flex
            flex-wrap
            items-center
            gap-3
          "
        >
          {hasChanges && (
            <span
              className="
                rounded-full
                border
                border-amber-300/20
                bg-amber-500/10
                px-4
                py-2
                text-xs
                font-black
                text-amber-200
              "
            >
              Unsaved changes
            </span>
          )}

          <button
            type="button"
            onClick={
              requestSave
            }
            disabled={
              saving ||
              !hasChanges || saveUncertain
            }
            className="
              inline-flex
              min-h-12
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-yellow-300
              px-6
              py-3
              text-sm
              font-black
              text-purple-950
              shadow-lg
              transition

              hover:bg-yellow-200

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}

            {saving
              ? "Saving..."
              : "Save changes"}
          </button>
        </div>
      </div>

      {/* =====================================================
          SUCCESS
          ===================================================== */}
      {success && (
        <div
          role="status"
          className="
            mt-6
            flex
            items-start
            justify-between
            gap-4
            rounded-2xl
            border
            border-emerald-400/30
            bg-emerald-500/10
            p-5
            text-emerald-100
          "
        >
          <div className="flex gap-3">
            <Check className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-black">
                Lottery updated
              </p>

              <p className="mt-1 text-sm text-emerald-100/70">
                {success}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              setSuccess(
                null,
              )
            }
            className="text-emerald-100/60 hover:text-white"
            aria-label="Dismiss success message"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      {/* =====================================================
          ERROR
          ===================================================== */}
      {error && (
        <DetailedErrorPanel
          error={error}
          onDismiss={() =>
            setError(
              null,
            )
          }
        />
      )}

      {/* =====================================================
          MAIN FORM
          ===================================================== */}
      <div
        className="
          mt-8
          grid
          gap-6

          xl:grid-cols-[minmax(0,1fr)_420px]
        "
      >
        <div className="space-y-6">
          {/* BASIC INFORMATION */}
          <FormCard
            icon={
              <Info />
            }
            title="Basic information"
            description="Core information shown across the Admin Portal and public lottery page."
          >
            <div className="grid gap-5">
              <TextField
                label="Lottery title"
                required
                value={
                  form.title
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "title",
                    value,
                  )
                }
              />

              <TextArea
                label="Short summary"
                value={
                  form.shortSummary
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "shortSummary",
                    value,
                  )
                }
                rows={3}
                help="Used on the public lottery directory and near the top of the lottery page."
              />

              <TextArea
                label="Full description"
                value={
                  form.description
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "description",
                    value,
                  )
                }
                rows={6}
              />

              <TextArea
                label="Fundraising purpose"
                value={
                  form.fundraisingPurpose
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "fundraisingPurpose",
                    value,
                  )
                }
                rows={4}
                help="Explains publicly how money raised by this lottery will support Burton Pride."
              />
            </div>
          </FormCard>

          {/* IMAGE */}
          <FormCard
            icon={
              <ImageIcon />
            }
            title="Public image"
            description="Image displayed on the public lottery page and directory."
          >
            <TextField
              label="Hero image URL"
              type="url"
              value={
                form.heroImageUrl
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "heroImageUrl",
                  value,
                )
              }
              placeholder="https://..."
            />

            {isSafeImageUrl(form.heroImageUrl) && (
              <div
                className="
                  mt-5
                  overflow-hidden
                  rounded-2xl
                  border
                  border-white/10
                "
              >
                <img
                  src={
                    form.heroImageUrl
                  }
                  alt=""
                  className="max-h-80 w-full object-cover"
                />
              </div>
            )}
          </FormCard>

          {/* PRICING */}
          <FormCard
            icon={
              <CircleDollarSign />
            }
            title="Ticket pricing & limits"
            description="Configure the individual ticket price and ticket availability."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-3
              "
            >
              <TextField
                label="Ticket price"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={
                  form.ticketPrice
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "ticketPrice",
                    value,
                  )
                }
                prefix="£"
              />

              <SelectField
                label="Currency"
                value={
                  form.currency
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "currency",
                    value,
                  )
                }
                options={[
                  {
                    value:
                      "GBP",
                    label:
                      "GBP — Pound sterling",
                  },
                ]}
              />

              <TextField
                label="Maximum tickets"
                type="number"
                min="1"
                value={
                  form.maxTickets
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "maxTickets",
                    value,
                  )
                }
                placeholder="Use the approved profile limit"
              />
            </div>
          </FormCard>

          {/* PAPER TICKETS */}
          <FormCard
            icon={<Ticket />}
            title="Paper tickets"
            description="Paper ticket features will come soon."
          >
            <div className="rounded-2xl border border-white/15 bg-white/5 p-5" role="status">
              <span className="rounded-full border border-purple-300/25 bg-purple-500/15 px-3 py-1 text-xs font-bold text-purple-100">
                Coming soon
              </span>
              <p className="mt-3 text-sm leading-6 text-white/65">
                Paper ticket setup and printing are temporarily unavailable.
              </p>
            </div>
          </FormCard>

          {/* DATES */}
          <FormCard
            icon={
              <CalendarDays />
            }
            title="Lottery dates"
            description="Control publication, ticket sales, draw and result dates. Times use your device timezone."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <DateField
                label="Publication date"
                value={
                  form.publicationAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "publicationAt",
                    value,
                  )
                }
              />

              <DateField
                label="Ticket sales open"
                value={
                  form.salesOpenAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "salesOpenAt",
                    value,
                  )
                }
              />

              <DateField
                label="Ticket sales close"
                value={
                  form.salesCloseAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "salesCloseAt",
                    value,
                  )
                }
              />

              <DateField
                label="Draw date"
                value={
                  form.drawAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "drawAt",
                    value,
                  )
                }
              />

              <DateField
                label="Results publish date"
                value={
                  form.resultsPublishAt
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "resultsPublishAt",
                    value,
                  )
                }
              />
            </div>
          </FormCard>

          {/* ELIGIBILITY */}
          <FormCard
            icon={
              <ShieldCheck />
            }
            title="Eligibility & compliance information"
            description="Review eligibility against the approved compliance profile before publication."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <div>
                <div className="mb-2 text-sm font-bold text-white/80">
                  Minimum age
                </div>

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
                    text-emerald-100
                  "
                >
                  <div>
                    <div className="text-base font-extrabold">
                      {form.minimumAge ? `${form.minimumAge}+ (configured)` : "Minimum age unavailable"}
                    </div>

                    <div className="mt-1 text-xs font-medium text-emerald-100/65">
                      Managed through compliance approval. This form does not change the age requirement.
                    </div>
                  </div>

                  <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-200" />
                </div>
              </div>

              <TextField
                label="Geographical eligibility"
                value={
                  form.geographicEligibility
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "geographicEligibility",
                    value,
                  )
                }
                placeholder="Great Britain"
              />
            </div>

            <div className="mt-5">
              <TextArea
                label="Responsible participation information"
                value={
                  form.responsibleGamblingInfo
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "responsibleGamblingInfo",
                    value,
                  )
                }
                rows={5}
                placeholder="Please only spend what you can afford..."
              />
            </div>
          </FormCard>

          {/* TERMS */}
          <FormCard
            icon={
              <FileText />
            }
            title="Terms & privacy versions"
            description="These version references are stored with the lottery and can be recorded against purchases."
          >
            <div
              className="
                grid
                gap-5

                md:grid-cols-2
              "
            >
              <TextField
                label="Lottery terms version"
                value={
                  form.termsVersion
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "termsVersion",
                    value,
                  )
                }
                placeholder="2026-08-v1"
              />

              <TextField
                label="Privacy notice version"
                value={
                  form.privacyNoticeVersion
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "privacyNoticeVersion",
                    value,
                  )
                }
                placeholder="2026-08-v1"
              />
            </div>

            <div
              className="
                mt-5
                flex
                flex-wrap
                gap-3
              "
            >
              <Link
                href="/lottery/terms"
                target="_blank"
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-white/15
                  px-4
                  py-2
                  text-sm
                  font-bold
                  text-white/75
                  hover:bg-white/10
                "
              >
                General terms
                <ExternalLink className="h-4 w-4" />
              </Link>

              <Link
                href={`/lottery/${lottery.slug}/terms`}
                target="_blank"
                className="
                  inline-flex
                  items-center
                  gap-2
                  rounded-xl
                  border
                  border-purple-300/20
                  bg-purple-500/10
                  px-4
                  py-2
                  text-sm
                  font-bold
                  text-purple-200
                  hover:bg-purple-500/20
                "
              >
                Individual terms
                <ExternalLink className="h-4 w-4" />
              </Link>
            </div>
          </FormCard>
        </div>

        {/* ===================================================
            RIGHT COLUMN
            =================================================== */}
        <aside
          className="
            space-y-6

            xl:sticky
            xl:top-6
          "
        >
          {/* STATUS */}
          <FormCard
            icon={
              <Trophy />
            }
            title="Lottery status"
            description="Current lifecycle status."
          >
            <StatusBadge status={lottery.status} />
            <p className="mt-4 text-sm leading-6 text-white/65">
              Status changes use the compliance, sales closure and draw workflows.
              Saving this form does not change lottery status.
            </p>
            {form.status ===
              "live" && (
              <div
                className="
                  mt-4
                  rounded-2xl
                  border
                  border-emerald-400/20
                  bg-emerald-500/10
                  p-4
                  text-sm
                  leading-6
                  text-emerald-100
                "
              >
                A live lottery can accept ticket purchases
                when its configured sales period is open.
              </div>
            )}
          </FormCard>

          {/* PUBLIC SETTINGS */}
          <FormCard
            icon={
              <Globe2 />
            }
            title="Public website"
            description="Control what visitors can see on the public lottery website."
          >
            <div className="space-y-3">
              <Toggle
                label="Show in public lottery directory"
                description="Display this lottery on /lottery."
                checked={
                  form.showInDirectory
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showInDirectory",
                    value,
                  )
                }
              />

              <Toggle
                label="Featured lottery"
                description="Give this lottery priority in the public directory."
                checked={
                  form.isFeatured
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "isFeatured",
                    value,
                  )
                }
              />

              <Toggle
                label="Allow page before sales open"
                description="Visitors can view the lottery before ticket sales start."
                checked={
                  form.allowPageBeforeSales
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "allowPageBeforeSales",
                    value,
                  )
                }
              />

              <Toggle
                label="Show ticket count"
                checked={
                  form.showTicketCount
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showTicketCount",
                    value,
                  )
                }
              />

              <Toggle
                label="Show amount raised"
                checked={
                  form.showAmountRaised
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showAmountRaised",
                    value,
                  )
                }
              />

              <Toggle
                label="Show remaining tickets"
                checked={
                  form.showRemainingTickets
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showRemainingTickets",
                    value,
                  )
                }
              />

              <Toggle
                label="Show prize values"
                checked={
                  form.showPrizeValues
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "showPrizeValues",
                    value,
                  )
                }
              />

              <Toggle
                label="Show countdown"
                checked={
                  form.countdownEnabled
                }
                onChange={(
                  value,
                ) =>
                  updateField(
                    "countdownEnabled",
                    value,
                  )
                }
              />
            </div>
          </FormCard>

          {/* WINNER DISPLAY */}
          <FormCard
            icon={
              <Heart />
            }
            title="Winner visibility"
            description="Choose how winner information may be shown publicly."
          >
            <SelectField
              label="Public winner display"
              value={
                form.winnerDisplayMode
              }
              onChange={(
                value,
              ) =>
                updateField(
                  "winnerDisplayMode",
                  value as WinnerDisplayMode,
                )
              }
              options={[
                {
                  value:
                    "ticket_number",
                  label:
                    "Ticket number only",
                },

                {
                  value:
                    "first_name",
                  label:
                    "First name",
                },

                {
                  value:
                    "full_name",
                  label:
                    "Full name",
                },

                {
                  value:
                    "none",
                  label:
                    "Do not display identity",
                },
              ]}
            />
          </FormCard>

          {/* SUMMARY */}
          <FormCard
            icon={
              <Ticket />
            }
            title="Current summary"
          >
            <div className="grid grid-cols-2 gap-3">
              <SummaryItem
                label="Orders"
                value={
                  lottery.order_count ??
                  "Unavailable"
                }
              />

              <SummaryItem
                label="Paid orders"
                value={
                  lottery.paid_order_count ??
                  "Unavailable"
                }
              />

              <SummaryItem
                label="Tickets"
                value={
                  lottery.ticket_count ??
                  "Unavailable"
                }
              />

              <SummaryItem
                label="Prizes"
                value={
                  lottery.prize_count ??
                  "Unavailable"
                }
              />

              <SummaryItem
                label="Winners"
                value={
                  lottery.winner_count ??
                  "Unavailable"
                }
              />

              <SummaryItem
                label="Revenue"
                value={lottery.revenue == null ? "Unavailable" : `£${lottery.revenue.toFixed(2)}`}
              />
            </div>
          </FormCard>

          <button
            type="button"
            onClick={
              requestSave
            }
            disabled={
              saving ||
              !hasChanges || saveUncertain
            }
            className="
              inline-flex
              min-h-14
              w-full
              items-center
              justify-center
              gap-2
              rounded-2xl
              bg-yellow-300
              px-5
              py-3
              font-black
              text-purple-950
              shadow-lg
              transition

              hover:bg-yellow-200

              disabled:cursor-not-allowed
              disabled:opacity-50
            "
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}

            Save changes
          </button>
        </aside>
      </div>

      </fieldset>
      {/* =====================================================
          CONFIRM SAVE MODAL
          ===================================================== */}
      {confirmSave && (
        <dialog
          ref={dialogRef}
          aria-labelledby="confirm-save-title"
          aria-describedby="confirm-save-description"
          onCancel={() => setConfirmSave(false)}
          onClick={event => { if (event.target === event.currentTarget) setConfirmSave(false); }}
          className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto border-0 bg-transparent p-0 text-white backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        >
          <div
            className="
              w-full
              max-w-lg
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
                p-6
              "
            >
              <div className="flex gap-3">
                <div
                  className="
                    flex
                    h-11
                    w-11
                    shrink-0
                    items-center
                    justify-center
                    rounded-2xl
                    bg-purple-500/15
                    text-purple-200
                  "
                >
                  <Save className="h-5 w-5" />
                </div>

                <div>
                  <h2
                    id="confirm-save-title"
                    className="text-xl font-black text-white"
                  >
                    Save lottery changes?
                  </h2>

                  <p className="mt-1 text-sm text-white/50">
                    {lottery.title}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setConfirmSave(
                    false,
                  )
                }
                aria-label="Cancel save"
                autoFocus
                className="rounded-xl p-2 text-white/50 hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <p id="confirm-save-description" className="text-sm leading-7 text-white/70">
                These changes can affect the public lottery
                page, ticket availability, pricing and
                lottery terms.
              </p>

              {form.status ===
                "live" && (
                <div
                  className="
                    mt-4
                    rounded-2xl
                    border
                    border-amber-300/20
                    bg-amber-500/10
                    p-4
                    text-sm
                    leading-6
                    text-amber-100
                  "
                >
                  <div className="flex gap-2">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

                    <span>
                      This lottery is set to Live. Changes
                      may immediately affect information
                      shown to the public.
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div
              className="
                flex
                flex-col-reverse
                gap-3
                border-t
                border-white/10
                p-6

                sm:flex-row
                sm:justify-end
              "
            >
              <button
                type="button"
                onClick={() =>
                  setConfirmSave(
                    false,
                  )
                }
                className="
                  min-h-11
                  rounded-2xl
                  border
                  border-white/15
                  px-5
                  py-3
                  text-sm
                  font-bold
                  text-white/75
                  hover:bg-white/10
                "
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={
                  saveChanges
                }
                className="
                  inline-flex
                  min-h-11
                  items-center
                  justify-center
                  gap-2
                  rounded-2xl
                  bg-yellow-300
                  px-5
                  py-3
                  text-sm
                  font-black
                  text-purple-950
                  hover:bg-yellow-200
                "
              >
                <Check className="h-4 w-4" />

                Save changes
              </button>
            </div>
          </div>
        </dialog>
      )}
    </main>
  );
}

/*
 * =========================================================
 * COMPONENTS
 * =========================================================
 */

function FormCard({
  icon,
  title,
  description,
  children,
}: {
  icon:
    React.ReactNode;

  title: string;

  description?: string;

  children:
    React.ReactNode;
}) {
  return (
    <section
      className="
        rounded-3xl
        border
        border-white/10
        bg-[#151b29]/90
        p-5
        shadow-xl

        sm:p-6
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
            bg-purple-500/15
            text-purple-200

            [&>svg]:h-5
            [&>svg]:w-5
          "
        >
          {icon}
        </div>

        <div>
          <h2 className="text-lg font-black text-white">
            {title}
          </h2>

          {description && (
            <p className="mt-1 text-sm leading-6 text-white/45">
              {description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        {children}
      </div>
    </section>
  );
}

function TextField({
  label,
  value,
  onChange,
  type = "text",
  required = false,
  placeholder,
  min,
  step,
  prefix,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  type?: string;

  required?: boolean;

  placeholder?: string;

  min?: string;

  step?: string;

  prefix?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}

        {required && (
          <span className="ml-1 text-red-300">
            *
          </span>
        )}
      </span>

      <div className="relative mt-2">
        {prefix && (
          <span
            className="
              pointer-events-none
              absolute
              left-4
              top-1/2
              -translate-y-1/2
              font-bold
              text-white/45
            "
          >
            {prefix}
          </span>
        )}

        <input
          type={type}
          value={value}
          required={required}
          placeholder={
            placeholder
          }
          min={min}
          step={step}
          onChange={(
            event,
          ) =>
            onChange(
              event.target
                .value,
            )
          }
          className={`
            h-12
            w-full
            rounded-2xl
            border
            border-white/15
            bg-black/20
            pr-4
            font-semibold
            text-white
            outline-none
            transition
            placeholder:text-white/25

            focus:border-purple-400
            focus:ring-4
            focus:ring-purple-500/10

            ${
              prefix
                ? "pl-9"
                : "pl-4"
            }
          `}
        />
      </div>
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
  help,
  placeholder,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  rows?: number;

  help?: string;

  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <textarea
        value={value}
        rows={rows}
        placeholder={
          placeholder
        }
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          w-full
          resize-none
          rounded-2xl
          border
          border-white/15
          bg-black/20
          px-4
          py-3
          font-medium
          leading-6
          text-white
          outline-none
          transition
          placeholder:text-white/25

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10
        "
      />

      {help && (
        <span className="mt-2 block text-xs leading-5 text-white/35">
          {help}
        </span>
      )}
    </label>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <input
        type="datetime-local"
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          h-12
          w-full
          rounded-2xl
          border
          border-white/15
          bg-black/20
          px-4
          font-semibold
          text-white
          outline-none

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10

          [color-scheme:dark]
        "
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;

  value: string;

  onChange: (
    value: string,
  ) => void;

  options: Array<{
    value: string;

    label: string;
  }>;
}) {
  return (
    <label className="block">
      <span className="text-sm font-bold text-white/80">
        {label}
      </span>

      <select
        value={value}
        onChange={(
          event,
        ) =>
          onChange(
            event.target
              .value,
          )
        }
        className="
          mt-2
          h-12
          w-full
          rounded-2xl
          border
          border-white/15
          bg-[#101521]
          px-4
          font-bold
          text-white
          outline-none

          focus:border-purple-400
          focus:ring-4
          focus:ring-purple-500/10
        "
      >
        {options.map(
          (option) => (
            <option
              key={
                option.value
              }
              value={
                option.value
              }
            >
              {
                option.label
              }
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;

  description?: string;

  checked: boolean;

  onChange: (
    value: boolean,
  ) => void;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(
          !checked,
        )
      }
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="
        flex
        w-full
        items-center
        justify-between
        gap-4
        rounded-2xl
        border
        border-white/10
        bg-black/15
        p-4
        text-left
        transition

        hover:bg-white/[0.05]
      "
    >
      <div>
        <p className="text-sm font-bold text-white">
          {label}
        </p>

        {description && (
          <p className="mt-1 text-xs leading-5 text-white/40">
            {description}
          </p>
        )}
      </div>

      <span
        className={`
          relative
          h-7
          w-12
          shrink-0
          rounded-full
          transition

          ${
            checked
              ? "bg-purple-500"
              : "bg-white/15"
          }
        `}
      >
        <span
          className={`
            absolute
            top-1
            h-5
            w-5
            rounded-full
            bg-white
            shadow-md
            transition

            ${
              checked
                ? "left-6"
                : "left-1"
            }
          `}
        />
      </span>
    </button>
  );
}

function Badge({
  children,
}: {
  children:
    React.ReactNode;
}) {
  return (
    <span
      className="
        rounded-full
        border
        border-white/10
        bg-white/[0.05]
        px-3
        py-1.5
        text-xs
        font-bold
        text-white/50
      "
    >
      {children}
    </span>
  );
}

function StatusBadge({
  status,
}: {
  status:
    LotteryStatus;
}) {
  const classes =
    status === "live"
      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-200"
      : status ===
          "draft"
        ? "border-slate-400/20 bg-slate-500/10 text-slate-200"
        : status ===
            "cancelled"
          ? "border-red-400/25 bg-red-500/10 text-red-200"
          : "border-purple-400/25 bg-purple-500/10 text-purple-200";

  return (
    <span
      className={`
        rounded-full
        border
        px-3
        py-1.5
        text-xs
        font-black
        uppercase
        tracking-wide

        ${classes}
      `}
    >
      {status.replaceAll(
        "_",
        " ",
      )}
    </span>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;

  value:
    React.ReactNode;
}) {
  return (
    <div
      className="
        rounded-2xl
        border
        border-white/10
        bg-black/20
        p-4
      "
    >
      <p className="text-[11px] font-black uppercase tracking-wide text-white/35">
        {label}
      </p>

      <p className="mt-1 text-lg font-black text-white">
        {value}
      </p>
    </div>
  );
}

function DetailedErrorPanel({
  error,
  onDismiss,
}: {
  error:
    ApiResponse;

  onDismiss:
    () => void;
}) {
  return (
    <div
      role="alert"
      className="
        mt-6
        overflow-hidden
        rounded-3xl
        border
        border-red-400/30
        bg-red-500/10
      "
    >
      <div
        className="
          flex
          items-start
          justify-between
          gap-4
          border-b
          border-red-400/20
          p-5
        "
      >
        <div className="flex gap-3">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-red-300" />

          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-red-200/60">
              Lottery Management Error
            </p>

            <h2 className="mt-1 text-lg font-black text-red-100">
              Lottery request needs attention
            </h2>

            <p className="mt-2 max-w-4xl text-sm leading-6 text-red-100/75">
              {error.error ||
                error.message ||
                "An unexpected error occurred."}
            </p>
          </div>
        </div>

        <button
          type="button"
          aria-label="Dismiss error"
          onClick={
            onDismiss
          }
          className="
            rounded-xl
            border
            border-red-300/20
            p-2
            text-red-100/60
            hover:bg-red-400/10
            hover:text-white
          "
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        className="
          grid
          gap-3
          p-5

          sm:grid-cols-2
          xl:grid-cols-3
        "
      >
        <ErrorValue
          label="Error code"
          value={
            error.code ||
            "UNKNOWN_ERROR"
          }
        />

        <ErrorValue
          label="Request ID"
          value={
            error.request_id ||
            "Not supplied"
          }
        />

        <ErrorValue
          label="Message"
          value={
            error.error ||
            error.message ||
            "Unknown error"
          }
        />
      </div>


    </div>
  );
}

function ErrorValue({
  label,
  value,
}: {
  label: string;

  value: string;
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
      <p className="text-[11px] font-black uppercase tracking-wide text-red-200/40">
        {label}
      </p>

      <p className="mt-1 break-words font-mono text-xs font-bold text-red-50">
        {value}
      </p>
    </div>
  );
}
