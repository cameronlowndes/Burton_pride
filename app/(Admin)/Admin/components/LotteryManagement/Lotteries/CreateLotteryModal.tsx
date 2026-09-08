"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Loader2,
  Plus,
  PoundSterling,
  Settings2,
  ShieldCheck,
  Ticket,
  X,
} from "lucide-react";

const DEFAULT_API_ROUTE = "/api/admin/lotterymanagement/lottery";
const REQUIRED_MINIMUM_AGE = 18;

export type CreatedLottery = {
  id: string;
  title: string;
  slug: string;
  internal_reference: string | null;
  lottery_type: string;
  status: "draft";
  short_summary: string | null;
  ticket_price: number;
  currency: string;
  max_tickets: number | null;
  paper_tickets_enabled: boolean;
  paper_ticket_count: number;
  paper_ticket_start_number: number | null;
  paper_ticket_end_number?: number | null;
  minimum_age: number;
  sales_open_at: string | null;
  sales_close_at: string | null;
  draw_at: string | null;
  created_at: string;
  updated_at: string;
  archived_at: null;
  is_active: boolean;
  order_count?: number;
  paid_order_count?: number;
  ticket_count?: number;
  revenue?: number;
};

type CreateLotteryModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (lottery: CreatedLottery | null) => void | Promise<void>;
  apiRoute?: string;
  testMode?: boolean;
};

const INITIAL_FORM = {
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
  paper_tickets_enabled: false,
  paper_ticket_start_number: "1",
  paper_ticket_count: "",
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
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateLotteryModal({
  open,
  onClose,
  onCreated,
  apiRoute = DEFAULT_API_ROUTE,
  testMode = false,
}: CreateLotteryModalProps) {
  const [createStep, setCreateStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createForm, setCreateForm] = useState({ ...INITIAL_FORM });

  function resetCreateForm() {
    setCreateStep(1);
    setCreateError(null);
    setCreateForm({ ...INITIAL_FORM });
  }

  function finishAndClose() {
    resetCreateForm();
    onClose();
  }

  function closeCreateModal() {
    if (creating) return;
    finishAndClose();
  }

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) {
        setCreateStep(1);
        setCreateError(null);
        setCreateForm({ ...INITIAL_FORM });
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, creating, onClose]);

  function updateCreateField(name: string, value: string | boolean) {
    setCreateForm((previous) => {
      const next = { ...previous, [name]: value };

      if (name === "title" && !previous.slug) {
        next.slug = slugify(String(value));
      }

      return next;
    });
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

      const openAt = new Date(createForm.sales_open_at).getTime();
      const closeAt = new Date(createForm.sales_close_at).getTime();
      const drawAt = new Date(createForm.draw_at).getTime();

      if (closeAt <= openAt) return "Sales closing time must be after sales opening time.";
      if (drawAt < closeAt) return "Draw time must be on or after the sales closing time.";
    }

    if (step === 3) {
      if (Number(createForm.ticket_price) <= 0) return "Ticket price must be more than £0.";
      if (Number(createForm.minimum_age) !== REQUIRED_MINIMUM_AGE) {
        return "All Burton Pride lotteries must be 18+.";
      }
      if (
        createForm.max_tickets &&
        (!Number.isSafeInteger(Number(createForm.max_tickets)) ||
          Number(createForm.max_tickets) <= 0)
      ) {
        return "Maximum tickets must be more than 0.";
      }

      if (createForm.paper_tickets_enabled) {
        const paperTicketStartNumber = Number(
          createForm.paper_ticket_start_number,
        );
        const paperTicketCount = Number(createForm.paper_ticket_count);

        if (
          !Number.isSafeInteger(paperTicketStartNumber) ||
          paperTicketStartNumber <= 0
        ) {
          return "Enter the first paper ticket number.";
        }

        if (!Number.isSafeInteger(paperTicketCount) || paperTicketCount <= 0) {
          return "Enter the number of paper tickets you will use.";
        }

        const paperTicketEndNumber =
          paperTicketStartNumber + paperTicketCount - 1;

        if (!Number.isSafeInteger(paperTicketEndNumber)) {
          return "The paper ticket number range is too large.";
        }

        if (
          createForm.max_tickets &&
          paperTicketEndNumber > Number(createForm.max_tickets)
        ) {
          return "The final paper ticket number cannot be higher than the maximum ticket number.";
        }
      }
    }

    if (step === 4) {
      if (!createForm.promoting_society_legal_name.trim()) return "Enter the promoting society legal name.";
      if (!createForm.registration_licence_type.trim()) return "Enter the registration or licence type.";
      if (!createForm.licensing_authority.trim()) return "Enter the licensing authority.";
      if (!createForm.responsible_promoter_name.trim()) return "Enter the responsible promoter name.";
      if (!createForm.responsible_promoter_address.trim()) return "Enter the responsible promoter address.";
      if (!createForm.geographic_eligibility.trim()) return "Enter geographic eligibility.";
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

    try {
      if (testMode) {
        const now = new Date().toISOString();
        const demoLottery: CreatedLottery = {
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
          paper_tickets_enabled: createForm.paper_tickets_enabled,
          paper_ticket_start_number: createForm.paper_tickets_enabled
            ? Number(createForm.paper_ticket_start_number)
            : null,
          paper_ticket_end_number: createForm.paper_tickets_enabled
            ? Number(createForm.paper_ticket_start_number) +
              Number(createForm.paper_ticket_count) -
              1
            : null,
          paper_ticket_count: createForm.paper_tickets_enabled
            ? Number(createForm.paper_ticket_count)
            : 0,
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

        finishAndClose();
        await onCreated?.(demoLottery);
        return;
      }

      const payload = {
        ...createForm,
        ticket_price: Number(createForm.ticket_price),
        minimum_age: REQUIRED_MINIMUM_AGE,
        max_tickets: createForm.max_tickets ? Number(createForm.max_tickets) : null,
        paper_tickets_enabled: createForm.paper_tickets_enabled,
        paper_ticket_start_number: createForm.paper_tickets_enabled
          ? Number(createForm.paper_ticket_start_number)
          : null,
        paper_ticket_count: createForm.paper_tickets_enabled
          ? Number(createForm.paper_ticket_count)
          : 0,
        maximum_proceeds: createForm.maximum_proceeds ? Number(createForm.maximum_proceeds) : null,
        maximum_prize_value: createForm.maximum_prize_value ? Number(createForm.maximum_prize_value) : null,
        publication_at: createForm.publication_at || null,
        sales_open_at: createForm.sales_open_at || null,
        sales_close_at: createForm.sales_close_at || null,
        draw_at: createForm.draw_at || null,
        results_publish_at: createForm.results_publish_at || null,
      };

      const response = await fetch(apiRoute, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const raw = await response.text();
      let data: { ok?: boolean; item?: CreatedLottery; error?: string; message?: string } | null = null;

      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || data?.message || "Failed to create lottery.");
      }

      finishAndClose();
      await onCreated?.(data.item ?? null);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Failed to create lottery.");
    } finally {
      setCreating(false);
    }
  }

  if (!open) return null;

  return (
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

                  <Field label="Unique slug" required hint="Used for the public /Lottery/[slug] page.">
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

                  <Field
                    label="Maximum tickets"
                    hint="This is the highest ticket number available, including online and paper tickets."
                  >
                    <input
                      type="number"
                      min="1"
                      value={createForm.max_tickets}
                      onChange={(e) => updateCreateField("max_tickets", e.target.value)}
                      className={inputClass}
                      placeholder="Optional"
                    />
                  </Field>

                  <ToggleField
                    label="This lottery will use paper tickets"
                    checked={createForm.paper_tickets_enabled}
                    onChange={(value) => {
                      updateCreateField("paper_tickets_enabled", value);

                      if (!value) {
                        updateCreateField("paper_ticket_count", "");
                      }
                    }}
                  />

                  {createForm.paper_tickets_enabled ? (
                    <Field
                      label="First paper ticket number"
                      required
                      hint="Enter the number printed on the first physical ticket."
                    >
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={createForm.paper_ticket_start_number}
                        onChange={(e) =>
                          updateCreateField(
                            "paper_ticket_start_number",
                            e.target.value,
                          )
                        }
                        className={inputClass}
                        placeholder="e.g. 1"
                      />
                    </Field>
                  ) : null}

                  {createForm.paper_tickets_enabled ? (
                    <Field
                      label="Number of paper tickets"
                      required
                      hint="Enter the total number of printed tickets. Duplicate ticket numbers are blocked by the database."
                    >
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={createForm.paper_ticket_count}
                        onChange={(e) =>
                          updateCreateField("paper_ticket_count", e.target.value)
                        }
                        className={inputClass}
                        placeholder="e.g. 500"
                      />
                    </Field>
                  ) : null}

                  {createForm.paper_tickets_enabled &&
                  Number.isSafeInteger(
                    Number(createForm.paper_ticket_start_number),
                  ) &&
                  Number(createForm.paper_ticket_start_number) > 0 &&
                  Number.isInteger(Number(createForm.paper_ticket_count)) &&
                  Number(createForm.paper_ticket_count) > 0 &&
                  Number.isSafeInteger(
                    Number(createForm.paper_ticket_start_number) +
                      Number(createForm.paper_ticket_count) -
                      1,
                  ) ? (
                    <div className="md:col-span-2 rounded-2xl border border-blue-400/25 bg-blue-500/10 p-4 text-sm leading-6 text-blue-100">
                      Paper ticket numbers <strong>
                        {Number(
                          createForm.paper_ticket_start_number,
                        ).toLocaleString("en-GB")}
                      </strong>{" "}
                      to <strong>
                        {(
                          Number(createForm.paper_ticket_start_number) +
                          Number(createForm.paper_ticket_count) -
                          1
                        ).toLocaleString("en-GB")}
                      </strong>{" "}
                      will be reserved. Online tickets will automatically skip
                      this range.
                    </div>
                  ) : null}

                  <Field label="Minimum participant age">
                    <div className="flex min-h-12 items-center justify-between gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3">
                      <div>
                        <div className="text-base font-extrabold text-emerald-100">
                          18+ only
                        </div>
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
