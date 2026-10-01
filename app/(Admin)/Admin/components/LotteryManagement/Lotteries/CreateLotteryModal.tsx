"use client";

import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, Check, Loader2, Plus, PoundSterling, Settings2, ShieldCheck, Ticket, X } from "lucide-react";

const DEFAULT_API_ROUTE = "/api/admin/lotterymanagement/lottery";
const TIMEOUT_MS = 20_000;
const MAX_RESPONSE_BYTES = 131_072;
const UK_TIMEZONE = "Europe/London";
const CALLBACK_TIMEOUT_MS = 8_000;
const COMPLIANCE_LABELS = {
  promoting_society_legal_name: "promoting society legal name", registration_licence_type: "registration or licence type",
  registration_licence_number: "registration or licence number", licensing_authority: "licensing authority",
  responsible_promoter_name: "responsible promoter name", responsible_promoter_address: "responsible promoter address",
  geographic_eligibility: "geographic eligibility", terms_version: "terms version", privacy_notice_version: "privacy notice version",
  responsible_gambling_info: "responsible gambling information", required_ticket_wording: "required ticket wording",
} as const;
export type DraftComplianceField = keyof typeof COMPLIANCE_LABELS;

export type CreatedLottery = {
  id: string; title: string; slug: string; internal_reference: string | null;
  lottery_type: string; status: "draft"; short_summary: string | null;
  ticket_price: number; currency: string; max_tickets: number | null;
  paper_tickets_enabled: boolean; paper_ticket_count: number; minimum_age: number;
  sales_open_at: string | null; sales_close_at: string | null; draw_at: string | null;
  created_at: string; updated_at: string; archived_at: null; is_active: boolean;
  show_in_public_directory?: boolean;
  order_count?: number; paid_order_count?: number; ticket_count?: number; revenue?: number;
};

/** Load these from the application's authoritative server configuration.
 * Null means the profile explicitly sets no cap/default, not a failed lookup.
 * Draft UI checks are advisory: the POST route must independently resolve and
 * validate the profile, its current version, age, caps and permitted sales channel.
 * One profile per lottery_type is supported by the existing POST contract.
 */
export type LotteryCreationProfile = {
  lottery_type: string;
  label: string;
  minimum_age: number;
  currency: "GBP";
  requires_paid_tickets: boolean;
  online_sales_allowed: boolean;
  default_ticket_price: number | null; // GBP pounds, like the existing API.
  maximum_proceeds: number | null; // GBP pounds.
  maximum_prize_value: number | null; // GBP pounds.
  max_tickets: number | null;
  /** Fields the configured profile requires at draft creation, not approval. */
  required_draft_fields: readonly DraftComplianceField[];
};

export type CreateLotteryModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (lottery: CreatedLottery | null) => void | Promise<void>;
  apiRoute?: string;
  /** Legacy prop retained for callers; local demo creation is disabled. */
  testMode?: boolean;
  /** Required to enable creation. No compliance endpoint is invented here. */
  profiles?: readonly LotteryCreationProfile[];
  /** Supply only if the application's CSRF contract uses X-CSRF-Token. */
  csrfToken?: string;
};

const INITIAL_FORM = {
  title: "", slug: "", internal_reference: "", lottery_type: "", short_summary: "",
  description: "", fundraising_purpose: "", publication_at: "", sales_open_at: "",
  sales_close_at: "", draw_at: "", results_publish_at: "", ticket_price: "", max_tickets: "",
  promoting_society_legal_name: "Burton Pride C.I.C.", registration_licence_type: "",
  registration_licence_number: "", licensing_authority: "", responsible_promoter_name: "",
  responsible_promoter_address: "", geographic_eligibility: "Great Britain", terms_version: "",
  privacy_notice_version: "", responsible_gambling_info: "", required_ticket_wording: "",
  show_in_public_directory: false, allow_page_before_sales: false, show_ticket_count: false,
  show_amount_raised: false, show_remaining_tickets: false, show_prize_values: true,
  winner_display_mode: "first_name", countdown_enabled: true,
};
type FormValues = typeof INITIAL_FORM;
type DateKey = "publication_at" | "sales_open_at" | "sales_close_at" | "draw_at" | "results_publish_at";
type CreationPayload = Omit<FormValues, DateKey | "ticket_price" | "max_tickets"> & Record<DateKey, string | null> & {
  status: "draft"; timezone: string; ticket_price: number; currency: "GBP"; minimum_age: number;
  max_tickets: number | null; maximum_proceeds: number | null; maximum_prize_value: number | null;
  paper_tickets_enabled: false; paper_ticket_start_number: null; paper_ticket_count: 0;
};
type TextKey = { [K in keyof FormValues]: FormValues[K] extends string ? K : never }[keyof FormValues];
type ToggleKey = { [K in keyof FormValues]: FormValues[K] extends boolean ? K : never }[keyof FormValues];
type ValidationError = { step: number; field?: TextKey; message: string };
type Outcome = "idle" | "pending" | "uncertain" | "created";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
function moneyToPence(value: string): number | null {

  if (!/^\d+(?:\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole, fraction = ""] = value.trim().split(".");
  const pence = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(pence) ? pence : null;
}
function positiveInteger(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const number = Number(value.trim());
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}
function validProfile(value: unknown): value is LotteryCreationProfile {
  if (!isRecord(value) || typeof value.lottery_type !== "string" || !/^[a-z][a-z0-9_]{0,79}$/.test(value.lottery_type) ||
    typeof value.label !== "string" || !value.label.trim() || value.currency !== "GBP" ||
    !Number.isSafeInteger(value.minimum_age) || Number(value.minimum_age) < 0 ||
    typeof value.requires_paid_tickets !== "boolean" || typeof value.online_sales_allowed !== "boolean" ||
    !Array.isArray(value.required_draft_fields) || !value.required_draft_fields.every((field) => typeof field === "string" && Object.hasOwn(COMPLIANCE_LABELS, field))) return false;
  for (const key of ["default_ticket_price", "maximum_proceeds", "maximum_prize_value"] as const) {
    const limit = value[key];
    if (limit !== null && (typeof limit !== "number" || !Number.isFinite(limit) || limit < 0 || moneyToPence(String(limit)) === null)) return false;
  }
  if (value.max_tickets !== null && (!Number.isSafeInteger(value.max_tickets) || Number(value.max_tickets) <= 0)) return false;
  if (value.default_ticket_price !== null &&
    (value.requires_paid_tickets ? Number(value.default_ticket_price) <= 0 : Number(value.default_ticket_price) !== 0)) return false;
  return true;
}

function localParts(instant: number, timezone: string): number[] {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit",
    minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  return ["year", "month", "day", "hour", "minute", "second"].map((name) => Number(parts.find((part) => part.type === name)?.value));
}

function ukDateToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw new Error("Enter a complete date and time.");
  const expected = match.slice(1).map(Number);
  const [year, month, day, hour, minute] = expected;
  if (year < 1000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) throw new Error("Enter a valid date and time.");
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  const date = new Date(wall);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error("Enter a valid calendar date.");
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const sample = wall + hours * 3_600_000;
    const [y, m, d, h, min, sec] = localParts(sample, UK_TIMEZONE);
    offsets.add(Date.UTC(y, m - 1, d, h, min, sec) - sample);
  }
  const candidates = [...offsets].map((offset) => wall - offset)
    .filter((instant) => localParts(instant, UK_TIMEZONE).slice(0, 5).every((part, index) => part === expected[index]));
  if (candidates.length === 0) throw new Error("This UK time does not exist because the clocks move forward. Choose another time.");
  if (candidates.length !== 1) throw new Error("This UK time occurs twice because the clocks move back. Choose an unambiguous time outside that hour.");
  return new Date(candidates[0]).toISOString();
}

const TEXT_LIMITS: Partial<Record<TextKey, number>> = {
  title: 200, slug: 120, internal_reference: 120, short_summary: 1_000, description: 10_000,
  fundraising_purpose: 5_000, promoting_society_legal_name: 300, registration_licence_type: 200,
  registration_licence_number: 200, licensing_authority: 300, responsible_promoter_name: 300,
  responsible_promoter_address: 2_000, geographic_eligibility: 500, terms_version: 120,
  privacy_notice_version: 120, responsible_gambling_info: 5_000, required_ticket_wording: 5_000,
};
const DATE_FIELDS = ["publication_at", "sales_open_at", "sales_close_at", "draw_at", "results_publish_at"] as const;

function validateStep(form: FormValues, step: number, profile: LotteryCreationProfile | undefined): ValidationError | null {
  const fail = (message: string, field?: TextKey): ValidationError => ({ step, field, message });
  if (step === 1) {
    if (!form.title.trim()) return fail("Enter a lottery title.", "title");
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) return fail("Enter a slug using lowercase letters, numbers and single hyphens.", "slug");
    if (!profile || !validProfile(profile)) return fail("Select an available server-configured compliance profile.", "lottery_type");
  }
  if (step === 2) {
    const instants: Partial<Record<(typeof DATE_FIELDS)[number], number>> = {};
    for (const field of DATE_FIELDS) {
      if (!form[field]) {
        if (field === "sales_open_at" || field === "sales_close_at" || field === "draw_at") return fail("Set the sales opening, sales closing and draw dates.", field);
        continue;
      }
      try { instants[field] = Date.parse(ukDateToIso(form[field])); }
      catch (error) { return fail(error instanceof Error ? error.message : "Check the date and time.", field); }
    }
    const opening = instants.sales_open_at!;
    const closing = instants.sales_close_at!;
    const draw = instants.draw_at!;
    if (closing <= opening) return fail("Sales closing time must be after sales opening time.", "sales_close_at");
    if (draw < closing) return fail("Draw time must be on or after sales closing time.", "draw_at");
    if (instants.publication_at !== undefined && instants.publication_at > closing) return fail("Publication must not be scheduled after sales close.", "publication_at");
    if (instants.results_publish_at !== undefined && instants.results_publish_at < draw) return fail("Results publication must be on or after the draw.", "results_publish_at");
  }
  if (step === 3) {
    if (!profile || !validProfile(profile)) return fail("Reload the configured compliance profiles.");
    const pence = moneyToPence(form.ticket_price);
    if (pence === null || (profile.requires_paid_tickets ? pence <= 0 : pence !== 0)) return fail(profile.requires_paid_tickets
      ? "Enter a positive ticket price with no more than two decimal places." : "This profile requires a ticket price of £0.00.", "ticket_price");
    const capacity = form.max_tickets.trim() ? positiveInteger(form.max_tickets) : null;
    if (form.max_tickets.trim() && capacity === null) return fail("Enter a positive whole number of entries.", "max_tickets");
    if (profile.max_tickets !== null && (capacity === null || capacity > profile.max_tickets)) return fail(`Enter a capacity no greater than the configured limit of ${profile.max_tickets.toLocaleString("en-GB")}.`, "max_tickets");
    if (capacity !== null && !Number.isSafeInteger(capacity * pence!)) return fail("The price and capacity are too large to calculate safely.", "max_tickets");
    if (profile.maximum_proceeds !== null && capacity !== null && capacity * pence! > moneyToPence(String(profile.maximum_proceeds))!) return fail("Ticket price multiplied by capacity exceeds the configured proceeds limit.", "max_tickets");
    if (profile.maximum_proceeds !== null && pence! > 0 && capacity === null) return fail("Set a capacity so the configured proceeds limit can be checked.", "max_tickets");
  }
  if (step === 4) {
    if (!profile || !validProfile(profile)) return fail("Reload the configured compliance profiles.");
    for (const name of profile.required_draft_fields) if (!form[name].trim()) return fail(`Enter the ${COMPLIANCE_LABELS[name]}.`, name);
  }
  if (step === 5 && !["full_name", "first_name", "ticket_number", "none"].includes(form.winner_display_mode)) return fail("Select a winner display preference.", "winner_display_mode");
  for (const [field, limit] of Object.entries(TEXT_LIMITS) as [TextKey, number][]) {
    const fieldStep = ["title", "slug", "internal_reference", "short_summary", "description", "fundraising_purpose"].includes(field) ? 1 : 4;
    if (step === fieldStep && form[field].length > limit) return fail(`This field must contain no more than ${limit.toLocaleString("en-GB")} characters.`, field);
  }
  return null;
}

function createPayload(form: FormValues, profile: LotteryCreationProfile): CreationPayload {
  const trimmed = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value])) as FormValues;
  const dates = Object.fromEntries(DATE_FIELDS.map((field) => [field, form[field] ? ukDateToIso(form[field]) : null])) as Record<DateKey, string | null>;
  return {
    ...trimmed,
    ...dates,
    status: "draft", timezone: UK_TIMEZONE,
    ticket_price: moneyToPence(form.ticket_price)! / 100, currency: profile.currency,
    minimum_age: profile.minimum_age,
    max_tickets: form.max_tickets.trim() ? positiveInteger(form.max_tickets) : null,
    maximum_proceeds: profile.maximum_proceeds, maximum_prize_value: profile.maximum_prize_value,
    paper_tickets_enabled: false, paper_ticket_start_number: null, paper_ticket_count: 0,
  };
}

function parseCreatedLottery(value: unknown, payload: ReturnType<typeof createPayload>): CreatedLottery {
  if (!isRecord(value)) throw new Error("The creation response could not be verified.");
  const stringFields = ["id", "title", "slug", "lottery_type", "currency", "created_at", "updated_at"];
  if (stringFields.some((field) => typeof value[field] !== "string" || !String(value[field]).trim()) ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(String(value.slug)) || value.status !== "draft" ||
    value.title !== payload.title || value.slug !== payload.slug || value.lottery_type !== payload.lottery_type ||
    value.currency !== payload.currency || value.minimum_age !== payload.minimum_age ||
    value.ticket_price !== payload.ticket_price || value.max_tickets !== payload.max_tickets ||
    value.paper_tickets_enabled !== false || value.paper_ticket_count !== 0 ||
    typeof value.is_active !== "boolean" || value.archived_at !== null ||
    !["internal_reference", "short_summary"].every((field) => value[field] === null || typeof value[field] === "string") ||
    !["created_at", "updated_at"].every((field) => typeof value[field] === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(String(value[field])) && Number.isFinite(Date.parse(String(value[field])))) ||
    !(["sales_open_at", "sales_close_at", "draw_at"] as const).every((field) => typeof value[field] === "string" && /(?:Z|[+-]\d{2}:\d{2})$/.test(String(value[field])) && Number.isFinite(Date.parse(String(value[field]))) && Date.parse(String(value[field])) === Date.parse(String(payload[field])))) {
    throw new Error("The created draft could not be verified. Check the lottery list before creating another.");
  }
  if (value.show_in_public_directory !== undefined && value.show_in_public_directory !== payload.show_in_public_directory) throw new Error("The saved directory preference could not be verified.");
  const item: CreatedLottery = {
    id: String(value.id), title: String(value.title), slug: String(value.slug),
    lottery_type: String(value.lottery_type), status: "draft", currency: String(value.currency),
    internal_reference: value.internal_reference as string | null, short_summary: value.short_summary as string | null,
    ticket_price: value.ticket_price as number, max_tickets: value.max_tickets as number | null,
    minimum_age: value.minimum_age as number, paper_tickets_enabled: false, paper_ticket_count: 0,
    sales_open_at: value.sales_open_at as string, sales_close_at: value.sales_close_at as string, draw_at: value.draw_at as string,
    created_at: String(value.created_at), updated_at: String(value.updated_at), archived_at: null, is_active: value.is_active as boolean,
  };
  if (typeof value.show_in_public_directory === "boolean") item.show_in_public_directory = value.show_in_public_directory;
  for (const key of ["order_count", "paid_order_count", "ticket_count", "revenue"] as const) {
    if (typeof value[key] === "number" && Number.isFinite(value[key]) && Number(value[key]) >= 0) item[key] = value[key] as number;
  }
  return item;
}

async function readJson(response: Response): Promise<unknown> {
  if (!response.headers.get("content-type")?.toLowerCase().includes("application/json") || !response.body) throw new Error("The creation response could not be verified.");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) { await reader.cancel(); throw new Error("The creation response was too large to verify."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder().decode(bytes)) as unknown; }
  catch { throw new Error("The creation response could not be verified."); }
}

function requestRoute(value: string, origin: string): string {
  const url = new URL(value, origin);
  if (url.origin !== origin || !url.pathname.startsWith("/api/") || url.username || url.password || url.hash) throw new Error("The lottery API route must be a same-origin /api/ URL.");
  return `${url.pathname}${url.search}`;
}
function safeHttpError(status: number): string {
  if (status === 401) return "Your session has expired. Sign in again.";
  if (status === 403) return "You do not have permission to create this draft, or further verification is required.";
  if (status === 409) return "The request conflicts with an existing record or lottery rule. Check the slug and lottery list.";
  if (status === 400 || status === 422) return "The server rejected these details. Check the form and configured profile.";
  if (status === 429) return "Too many requests. Wait before trying again.";
  return "The server did not confirm creation.";
}

export default function CreateLotteryModal({ open, onClose, onCreated, apiRoute = DEFAULT_API_ROUTE, testMode = false, profiles, csrfToken }: CreateLotteryModalProps) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const feedbackRef = useRef<HTMLParagraphElement>(null);
  const slugEdited = useRef(false);
  const submitLock = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(false);
  const latestCallbacks = useRef({ onClose, onCreated });
  latestCallbacks.current = { onClose, onCreated };
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormValues>({ ...INITIAL_FORM });
  const [error, setError] = useState<ValidationError | null>(null);
  const [outcome, setOutcome] = useState<Outcome>("idle");
  const [notice, setNotice] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [createdItem, setCreatedItem] = useState<CreatedLottery | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const submitting = outcome === "pending";
  const busy = submitting || refreshing;
  const locked = outcome !== "idle";
  const configured = !!profiles?.length && profiles.every(validProfile) && new Set(profiles.map((item) => item.lottery_type)).size === profiles.length;
  const availableProfiles = configured ? profiles! : [];
  const profile = availableProfiles.find((item) => item.lottery_type === form.lottery_type);
  const dirty = JSON.stringify(form) !== JSON.stringify(INITIAL_FORM);
  const canCreate = configured && !!profile && !testMode;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; controller.current?.abort(); };
  }, []);

  useEffect(() => {
    const element = dialog.current;
    if (!open || !element) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!element.open) element.showModal();
    heading.current?.focus();
    return () => {
      if (element.open) element.close();
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [open]);

  useEffect(() => {
    if (open) heading.current?.focus();
  }, [step, open]);
  useEffect(() => {
    if (!open || !error) return;
    const field = error.field ? document.getElementById(`${id}-${error.field}`) : null;
    (field ?? feedbackRef.current)?.focus();
  }, [error, step, open, id]);
  useEffect(() => {
    if (!open || (!dirty && !locked)) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [open, dirty, locked]);

  function reset() {
    setStep(1); setForm({ ...INITIAL_FORM }); setError(null); setNotice(null);
    setOutcome("idle"); setDiscarding(false); setCreatedItem(null); setRefreshing(false); slugEdited.current = false;
  }
  function requestClose() {
    if (submitLock.current || submitting) return;
    if (outcome === "uncertain") {
      latestCallbacks.current.onClose(); return;
    }
    if (outcome === "created") { reset(); latestCallbacks.current.onClose(); return; }
    if (dirty) { setDiscarding(true); return; }
    reset(); latestCallbacks.current.onClose();
  }
  function update<K extends keyof FormValues>(name: K, value: FormValues[K]) {
    if (locked) return;
    if (name === "slug") slugEdited.current = true;
    setForm((previous) => {
      const next = { ...previous, [name]: value };
      if (name === "title" && !slugEdited.current) next.slug = slugify(String(value));
      if (name === "lottery_type") {
        const selected = availableProfiles.find((item) => item.lottery_type === value);
        next.ticket_price = selected?.default_ticket_price === null || !selected ? "" : selected.default_ticket_price.toFixed(2);
        next.max_tickets = selected?.max_tickets === null || !selected ? "" : String(selected.max_tickets);
      }
      return next;
    });
    setError(null); setNotice(null);
  }
  function next() {
    if (locked) return;
    const validation = validateStep(form, step, profile);
    if (validation) { setError(validation); return; }
    setError(null); setStep((current) => Math.min(5, current + 1));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitLock.current || locked || !open) return;
    if (step < 5) { next(); return; }
    if (!canCreate || !profile) { setError({ step, message: "Creation requires an available server-configured profile. Local demo creation is disabled." }); return; }
    // Validate every step again, including fields changed by going back.
    for (let current = 1; current <= 5; current++) {
      const validation = validateStep(form, current, profile);
      if (validation) { setStep(current); setError(validation); return; }
    }
    let route: string;
    let payload: ReturnType<typeof createPayload>;
    try { route = requestRoute(apiRoute, window.location.origin); payload = createPayload(form, profile); }
    catch { setError({ step, message: "Check the API route, selected profile and dates before creating the draft." }); return; }
    submitLock.current = true;
    setOutcome("pending"); setError(null); setNotice(null);
    const abort = new AbortController();
    controller.current = abort;
    let timedOut = false;
    let confirmedItem: CreatedLottery | null = null;
    const timer = window.setTimeout(() => { timedOut = true; abort.abort(); }, TIMEOUT_MS);
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json", Accept: "application/json" };
      if (csrfToken) headers["X-CSRF-Token"] = csrfToken;
      const response = await fetch(route, { method: "POST", credentials: "include", cache: "no-store", redirect: "error", headers, signal: abort.signal, body: JSON.stringify(payload) });
      if (!response.ok) throw new Error(safeHttpError(response.status));
      const data = await readJson(response);
      if (!isRecord(data) || data.ok !== true) throw new Error("The server did not confirm creation.");
      const item = parseCreatedLottery(data.item, payload);
      confirmedItem = item;
      if (!mounted.current) return;
      // Once creation is confirmed, a parent refresh failure must never offer POST again.
      setCreatedItem(item); setOutcome("created"); setRefreshing(true);
      setNotice("Draft created. Updating the lottery list…");
      window.clearTimeout(timer);
      let callbackTimer: number | undefined;
      try {
        await Promise.race([
          Promise.resolve(latestCallbacks.current.onCreated?.(item)),
          new Promise<never>((_, reject) => { callbackTimer = window.setTimeout(() => reject(new Error("List refresh timed out.")), CALLBACK_TIMEOUT_MS); }),
        ]);
      }
      catch {
        if (mounted.current) setNotice("Draft created, but the lottery list could not be refreshed. Close this window and refresh the list. Do not create it again.");
        return;
      } finally {
        if (callbackTimer !== undefined) window.clearTimeout(callbackTimer);
        if (mounted.current) setRefreshing(false);
      }
      if (mounted.current) { latestCallbacks.current.onClose(); reset(); }
    } catch (requestError) {
      if (!mounted.current) return;
      if (confirmedItem) {
        setCreatedItem(confirmedItem); setOutcome("created");
        setNotice("Draft created, but this window could not be closed. Close it and check the lottery list. Do not create it again.");
        return;
      }
      setOutcome("uncertain");
      const reason = timedOut ? "The creation request timed out."
        : requestError instanceof TypeError ? "The connection failed."
        : requestError instanceof Error ? requestError.message : "Creation could not be confirmed.";
      setError({ step: 5, message: `${reason} A record may have been created. Close this window and check the lottery list for “${payload.title}” or “${payload.slug}” before any further attempt.` });
    } finally {
      window.clearTimeout(timer); controller.current = null; submitLock.current = false;
    }
  }

  const money = (value: number | null) => value === null ? "No cap set by this profile" : new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
  const field = (name: TextKey, label: string, options: { required?: boolean; hint?: string; full?: boolean; multiline?: boolean; type?: string; placeholder?: string } = {}) => {
    const invalid = error?.field === name;
    const describedBy = `${id}-${name}-hint${invalid ? ` ${id}-error` : ""}`;
    return <Field key={name} label={label} htmlFor={`${id}-${name}`} required={options.required} full={options.full}>
      {options.multiline ? <textarea id={`${id}-${name}`} value={form[name]} required={options.required}
        maxLength={TEXT_LIMITS[name]} onChange={(event) => update(name, event.target.value)}
        onInput={(event) => { event.currentTarget.style.height = "auto"; event.currentTarget.style.height = `${event.currentTarget.scrollHeight}px`; }}
        className={`${inputClass} min-h-28 resize-none`} placeholder={options.placeholder} aria-invalid={invalid} aria-describedby={describedBy} />
        : <input id={`${id}-${name}`} type={options.type ?? "text"} value={form[name]} required={options.required}
          maxLength={TEXT_LIMITS[name]} step={options.type === "datetime-local" ? 60 : undefined}
          inputMode={name === "ticket_price" ? "decimal" : name === "max_tickets" ? "numeric" : undefined}
          autoComplete={name === "responsible_promoter_name" ? "name" : "off"}
          onChange={(event) => update(name, event.target.value)} className={inputClass}
          placeholder={options.placeholder} aria-invalid={invalid} aria-describedby={describedBy} />}
      <span id={`${id}-${name}-hint`} className="mt-2 block text-xs font-normal text-white/75">{options.hint ?? (TEXT_LIMITS[name] ? `Up to ${TEXT_LIMITS[name]!.toLocaleString("en-GB")} characters.` : "")}</span>
    </Field>;
  };
  const select = (name: TextKey, label: string, options: { value: string; label: string }[], hint?: string) => <Field label={label} htmlFor={`${id}-${name}`}>
    <select id={`${id}-${name}`} value={form[name]} onChange={(event) => update(name, event.target.value)} className={inputClass}
      aria-invalid={error?.field === name} aria-describedby={`${id}-${name}-hint${error?.field === name ? ` ${id}-error` : ""}`}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    <span id={`${id}-${name}-hint`} className="mt-2 block text-xs font-normal text-white/75">{hint}</span>
  </Field>;

  return (
    <dialog ref={dialog} aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onCancel={(event) => { event.preventDefault(); if (discarding) setDiscarding(false); else requestClose(); }}
      className="fixed inset-0 z-[9999] m-auto max-h-[94dvh] w-[calc(100%-1.5rem)] max-w-6xl overflow-hidden rounded-3xl border border-white/15 bg-[#15172a] p-0 text-white shadow-2xl backdrop:bg-black/75 backdrop:backdrop-blur-sm">
      <form noValidate onSubmit={(event) => void submit(event)} aria-busy={busy} className="flex max-h-[94dvh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/15 p-5 md:p-6">
          <div className="flex items-center gap-3">
            <Plus aria-hidden="true" className="h-6 w-6 shrink-0" />
            <div><h2 ref={heading} tabIndex={-1} id={`${id}-title`} className="text-xl font-extrabold outline-none">Create new lottery</h2>
              <p id={`${id}-description`} className="mt-1 text-sm text-white/80">Create a draft for review. Compliance approval and publication are separate actions.</p></div>
          </div>
          <button type="button" onClick={requestClose} disabled={busy} aria-label="Close create lottery" className={`${buttonClass} shrink-0 border border-white/20 p-3`}><X aria-hidden="true" className="h-5 w-5" /></button>
        </header>
        <div className="min-h-0 overflow-y-auto p-5 md:p-6">
          <ol aria-label="Creation steps" className="mb-5 grid grid-cols-2 gap-2 md:grid-cols-5">
            {["Basic", "Dates", "Tickets", "Compliance", "Public settings"].map((label, index) => {
              const number = index + 1;
              return <li key={label}><button type="button" disabled={number >= step || locked || discarding}
                aria-current={number === step ? "step" : undefined} onClick={() => { setError(null); setStep(number); }}
                className={`${buttonClass} w-full justify-start border px-3 py-2 text-left text-xs ${number === step ? "border-white/30 bg-white text-black" : "border-white/15 bg-white/5 text-white/80"}`}>
                <span aria-hidden="true">{number < step ? <Check className="h-4 w-4" /> : number}</span>
                <span>{label}</span></button></li>;
            })}
          </ol>
          {!configured ? <p role="alert" className="mb-5 text-sm text-amber-200">Compliance profiles are unavailable or incomplete. Connect the server-configured profiles before creating a draft. No age or financial limits have been assumed.</p> : null}
          {testMode ? <p role="alert" className="mb-5 text-sm text-amber-200">Local demo creation is disabled. Use the application's separate server-managed test environment.</p> : null}
          {error ? <p ref={feedbackRef} tabIndex={-1} id={`${id}-error`} role="alert" className="mb-5 break-words text-sm text-rose-200 outline-none">{error.message}</p> : null}
          {notice ? <p role="status" className="mb-5 text-sm text-emerald-200">{notice}</p> : null}
          {createdItem ? <p role="status" className="mb-5 text-sm text-emerald-200">Created draft: {createdItem.title} ({createdItem.slug}).</p> : null}
          {discarding ? <section aria-labelledby={`${id}-discard-title`} className="mb-5">
            <h3 id={`${id}-discard-title`} className="font-bold">Discard this draft form?</h3>
            <p className="mt-2 text-sm text-white/80">Your entered details have not been saved.</p>
            <div className="mt-4 flex flex-wrap gap-3">
              <button autoFocus type="button" className={`${buttonClass} border border-white/20 px-4 py-3`} onClick={() => setDiscarding(false)}>Keep editing</button>
              <button type="button" className={`${buttonClass} bg-rose-200 px-4 py-3 text-black`} onClick={() => { reset(); latestCallbacks.current.onClose(); }}>Discard and close</button>
            </div>
          </section> : null}
          <fieldset disabled={locked || discarding} className="min-w-0 border-0 p-0">
            <legend className="sr-only">Lottery draft details</legend>
            {step === 1 ? <CreateSection icon={<Ticket />} title="Basic information" description="Choose the identity and configured profile for this draft.">
              {field("title", "Lottery title", { required: true, placeholder: "Christmas Raffle 2026" })}
              {field("slug", "Unique slug", { required: true, hint: "Used for /Lottery/[slug]. Uniqueness is checked by the server." })}
              {field("internal_reference", "Internal reference / code")}
              {select("lottery_type", "Lottery type / compliance profile", [{ value: "", label: "Select a configured profile" }, ...availableProfiles.map((item) => ({ value: item.lottery_type, label: item.label }))], "Profile values come from server configuration and must be checked again when saved.")}
              {field("short_summary", "Short summary", { full: true, multiline: true })}
              {field("description", "Full description", { full: true, multiline: true })}
              {field("fundraising_purpose", "Fundraising purpose / good cause", { full: true, multiline: true })}
            </CreateSection> : null}
            {step === 2 ? <CreateSection icon={<CalendarDays />} title="Dates and times" description="All dates use Europe/London, including British Summer Time. They are saved as UTC instants.">
              {field("publication_at", "Publication date and time", { type: "datetime-local", hint: "Optional UK publication time." })}
              {field("sales_open_at", "Sales opening date and time", { type: "datetime-local", required: true, hint: "UK time." })}
              {field("sales_close_at", "Sales closing date and time", { type: "datetime-local", required: true, hint: "After sales open, in UK time." })}
              {field("draw_at", "Draw date and time", { type: "datetime-local", required: true, hint: "On or after sales close, in UK time." })}
              {field("results_publish_at", "Results publication date and time", { type: "datetime-local", hint: "Optional. Must be on or after the draw." })}
              <p className="self-center text-sm text-white/80">Timezone: Europe/London. Clock-change times that occur twice or do not exist must be changed.</p>
            </CreateSection> : null}
            {step === 3 ? <CreateSection icon={<PoundSterling />} title="Ticket setup" description="Pricing and capacity are checked against the selected profile.">
              {field("ticket_price", "Ticket price (£)", { required: true, hint: profile?.requires_paid_tickets ? "GBP per ticket, up to two decimal places. No discounted bundles." : "Use £0.00 for a profile requiring free entry." })}
              {field("max_tickets", "Maximum total entries", { hint: profile?.max_tickets !== null && profile ? `Configured capacity limit: ${profile.max_tickets.toLocaleString("en-GB")}.` : "Optional unless the configured proceeds limit requires a capacity." })}
              <p className="text-sm text-white/80">Currency: {profile?.currency ?? "Select a profile"}</p>
              <p className="text-sm text-white/80">Minimum participant age: {profile ? `${profile.minimum_age} (configured profile)` : "Select a profile"}</p>
              <p className="md:col-span-2 text-sm text-white/80">Paper tickets are disabled for this draft.</p>
              {profile && !profile.online_sales_allowed ? <p className="md:col-span-2 text-sm text-amber-200">This profile does not permit online sales. Creation only saves a draft; this form does not enable a sales channel.</p> : null}
            </CreateSection> : null}
            {step === 4 ? <CreateSection icon={<ShieldCheck />} title="Compliance details" description="Record draft details for review. Completing this form does not approve compliance.">
              {field("promoting_society_legal_name", "Promoting society legal name", { required: profile?.required_draft_fields.includes("promoting_society_legal_name") })}
              {field("registration_licence_type", "Registration / licence type", { required: profile?.required_draft_fields.includes("registration_licence_type") })}
              {field("registration_licence_number", "Registration / licence number", { required: profile?.required_draft_fields.includes("registration_licence_number") })}
              {field("licensing_authority", "Licensing authority", { required: profile?.required_draft_fields.includes("licensing_authority") })}
              {field("responsible_promoter_name", "Responsible promoter name", { required: profile?.required_draft_fields.includes("responsible_promoter_name") })}
              {field("geographic_eligibility", "Geographic eligibility", { required: profile?.required_draft_fields.includes("geographic_eligibility") })}
              {field("responsible_promoter_address", "Responsible promoter address", { required: profile?.required_draft_fields.includes("responsible_promoter_address"), full: true, multiline: true })}
              {field("terms_version", "Terms version", { required: profile?.required_draft_fields.includes("terms_version") })}
              {field("privacy_notice_version", "Privacy notice version", { required: profile?.required_draft_fields.includes("privacy_notice_version") })}
              <p className="text-sm text-white/80">Configured maximum proceeds: {profile ? money(profile.maximum_proceeds) : "Unavailable"}</p>
              <p className="text-sm text-white/80">Configured maximum prize value: {profile ? money(profile.maximum_prize_value) : "Unavailable"}</p>
              {field("required_ticket_wording", "Required ticket wording", { required: profile?.required_draft_fields.includes("required_ticket_wording"), full: true, multiline: true })}
              {field("responsible_gambling_info", "Responsible gambling information", { required: profile?.required_draft_fields.includes("responsible_gambling_info"), full: true, multiline: true })}
            </CreateSection> : null}
            {step === 5 ? <CreateSection icon={<Settings2 />} title="Public preferences" description="Preferences for a future public page. The record is created as a draft.">
              {([
                ["show_in_public_directory", "Show in public directory when published"], ["allow_page_before_sales", "Allow page before sales open when published"],
                ["show_ticket_count", "Show tickets sold"], ["show_amount_raised", "Show amount raised"], ["show_remaining_tickets", "Show remaining tickets"],
                ["show_prize_values", "Show prize values"], ["countdown_enabled", "Enable sales-close countdown"],
              ] as [ToggleKey, string][]).map(([name, label]) => <ToggleField key={name} label={label} checked={form[name]} onChange={(value) => update(name, value)} />)}
              {select("winner_display_mode", "Public winner display preference", [
                { value: "first_name", label: "First name only" }, { value: "full_name", label: "Full name" },
                { value: "ticket_number", label: "Ticket number only" }, { value: "none", label: "Do not show winner identity" },
              ], "This preference does not grant winner consent or publish results.")}
              <div className="md:col-span-2 text-sm text-white/80"><h3 className="font-bold text-white">Review before creating</h3>
                <p className="mt-2">{form.title || "Untitled draft"} · /Lottery/{form.slug || "slug"}</p>
                <p className="mt-2">{profile?.label ?? "Profile unavailable"} · Ticket price £{form.ticket_price || "—"} · Capacity {form.max_tickets || "Not set"}</p>
                <p className="mt-2">The server must enforce draft status, profile rules and access controls. Saving these details does not authorise publication.</p>
              </div>
            </CreateSection> : null}
          </fieldset>
        </div>
        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/15 p-5 md:px-6">
          <button type="button" disabled={step === 1 || locked || discarding} onClick={() => { setError(null); setStep((current) => Math.max(1, current - 1)); }} className={`${buttonClass} border border-white/20 px-5 py-3`}><ArrowLeft aria-hidden="true" className="h-4 w-4" /> Back</button>
          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={requestClose} disabled={busy || discarding} className={`${buttonClass} border border-white/20 px-5 py-3`}>{outcome === "uncertain" ? "Close and check lottery list" : outcome === "created" ? "Close" : "Cancel"}</button>
            {outcome === "idle" || submitting ? <button type="submit" disabled={submitting || discarding || !configured || testMode} className={`${buttonClass} bg-white px-5 py-3 text-black enabled:hover:bg-fuchsia-100`}>
              {submitting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin motion-reduce:animate-none" /> : step < 5 ? <ArrowRight aria-hidden="true" className="h-4 w-4" /> : <Plus aria-hidden="true" className="h-4 w-4" />}
              {step < 5 ? "Continue" : "Create draft lottery"}
            </button> : null}
          </div>
        </footer>
      </form>
    </dialog>
  );
}

const inputClass = "w-full min-w-0 rounded-2xl border border-white/20 bg-[#101221] px-4 py-3 text-sm text-white placeholder:text-white/65 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-60";
const buttonClass = "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl text-sm font-bold enabled:cursor-pointer enabled:hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-50";
function CreateSection({ icon, title, description, children }: { icon: ReactNode; title: string; description: string; children: ReactNode }) {
  return <section><div className="mb-5 flex items-start gap-3"><span aria-hidden="true" className="shrink-0 text-fuchsia-200">{icon}</span><div><h3 className="text-lg font-extrabold">{title}</h3><p className="mt-1 text-sm text-white/80">{description}</p></div></div><div className="grid gap-4 md:grid-cols-2">{children}</div></section>;
}
function Field({ label, htmlFor, required, full, children }: { label: string; htmlFor: string; required?: boolean; full?: boolean; children: ReactNode }) {
  return <div className={`min-w-0 ${full ? "md:col-span-2" : ""}`}><label htmlFor={htmlFor} className="mb-2 block text-sm font-semibold text-white">{label}{required ? <span className="ml-1 text-rose-200"> (required)</span> : null}</label>{children}</div>;
}
function ToggleField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-12 items-center justify-between gap-4 rounded-2xl border border-white/20 bg-black/20 p-4 text-sm font-semibold text-white has-[:disabled]:cursor-not-allowed has-[:enabled]:cursor-pointer"><span>{label}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-5 w-5 shrink-0 accent-fuchsia-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fuchsia-300" /></label>;
}
