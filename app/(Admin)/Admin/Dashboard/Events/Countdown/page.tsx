"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

type CountdownItem = {
  id: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  target_date: string;
  event_message: string | null;
  show_event_message: boolean;
  slug: string | null;
  page_key: string;
  template: string;
  accent: string | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  updated_at?: string;
};

type FormState = {
  id?: string;
  enabled: boolean;
  title: string;
  subtitle: string;
  targetDate: string;
  eventMessage: string;
  showEventMessage: boolean;
  slug: string;
  pageKey: string;
  template: string;
  accent: string;
  description: string;
  isActive: boolean;
  sortOrder: number;
};

const PAGE_OPTIONS = [
  { value: "home", label: "Home" },
  { value: "about", label: "About" },
  { value: "tickets", label: "Tickets" },
  { value: "events", label: "Events" },
  { value: "sponsors", label: "Sponsors" },
];

const TEMPLATE_OPTIONS = [
  { value: "rainbow", label: "Rainbow" },
  { value: "minimal", label: "Minimal" },
  { value: "glass", label: "Glass" },
  { value: "festival", label: "Festival" },
];

function toLocalInputValue(iso: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInputValue(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

function createEmptyForm(): FormState {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  d.setHours(12, 0, 0, 0);

  return {
    enabled: true,
    title: "🌈 Countdown to Burton Pride 2026",
    subtitle: "Time remaining until the Pride Event kicks off 🎉",
    targetDate: d.toISOString(),
    eventMessage: "🎉 Free Event – Everyone’s Welcome!",
    showEventMessage: false,
    slug: "",
    pageKey: "home",
    template: "rainbow",
    accent: "#fde047",
    description: "",
    isActive: false,
    sortOrder: 0,
  };
}

function mapItemToForm(item: CountdownItem): FormState {
  return {
    id: item.id,
    enabled: item.enabled,
    title: item.title || "",
    subtitle: item.subtitle || "",
    targetDate: item.target_date || "",
    eventMessage: item.event_message || "",
    showEventMessage: item.show_event_message,
    slug: item.slug || "",
    pageKey: item.page_key || "home",
    template: item.template || "rainbow",
    accent: item.accent || "#fde047",
    description: item.description || "",
    isActive: item.is_active,
    sortOrder: item.sort_order || 0,
  };
}

function useCountdownPreview(targetDate: string) {
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const target = new Date(targetDate);

    const tick = () => {
      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (Number.isNaN(target.getTime()) || diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        return;
      }

      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      });
    };

    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  return timeLeft;
}

function PillButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded-2xl px-4 py-2 text-sm font-bold transition",
        active
          ? "bg-white text-black shadow-lg"
          : "border border-white/10 bg-white/8 text-white/85 hover:bg-white/14",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-white/75">{label}</div>
      {children}
    </label>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
      <div>
        <div className="font-semibold text-white">{label}</div>
        <div className="mt-1 text-sm text-white/55">{description}</div>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-5 w-5 shrink-0"
      />
    </label>
  );
}

function CountdownCard({
  item,
  selected,
  onClick,
}: {
  item: CountdownItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-3xl border p-4 text-left transition",
        selected
          ? "border-white/25 bg-white/[0.10]"
          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold text-white">{item.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              {item.enabled ? "Enabled" : "Disabled"}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              {item.template}
            </span>
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white/75">
              {item.page_key}
            </span>
            {item.is_active ? (
              <span className="rounded-full bg-emerald-400/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                Live
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="rounded-2xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm font-bold text-white">
            Edit
          </span>
        </div>
      </div>

      <div className="mt-3 text-sm text-white/70">
        {new Date(item.target_date).toLocaleString("en-GB")} • /{item.slug || "no-slug"}
      </div>

      <div className="mt-2 text-base text-white/85">
        {item.subtitle || "No subtitle"}
      </div>
    </button>
  );
}

function TemplatePreview({ form }: { form: FormState }) {
  const timeLeft = useCountdownPreview(form.targetDate);

  const blocks = [
    { label: "Days", value: timeLeft.days },
    { label: "Hours", value: timeLeft.hours },
    { label: "Minutes", value: timeLeft.minutes },
    { label: "Seconds", value: timeLeft.seconds },
  ];

  if (form.template === "minimal") {
    return (
      <div className="rounded-[30px] border border-white/10 bg-[#0b0b13] p-7 text-white shadow-2xl">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-white/55">
          Live preview
        </div>
        <h3 className="text-4xl font-black leading-tight">{form.title}</h3>
        <p className="mt-4 text-lg text-white/70">{form.subtitle}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {blocks.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] border border-white/10 bg-white/[0.04] p-5 text-center"
            >
              <div className="text-5xl font-black">{item.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/50">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (form.template === "glass") {
    return (
      <div className="relative overflow-hidden rounded-[30px] border border-cyan-300/20 bg-gradient-to-br from-cyan-400/10 via-sky-400/10 to-fuchsia-500/10 p-7 text-white shadow-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.22),transparent_35%),radial-gradient(circle_at_bottom_right,rgba(217,70,239,0.2),transparent_35%)]" />
        <div className="relative z-10">
          <div className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-cyan-100/60">
            Live preview
          </div>
          <h3 className="text-4xl font-black leading-tight">{form.title}</h3>
          <p className="mt-4 text-lg text-white/80">{form.subtitle}</p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {blocks.map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-white/15 bg-white/10 p-5 text-center backdrop-blur-md"
              >
                <div className="text-5xl font-black text-cyan-200">{item.value}</div>
                <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/55">
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (form.template === "festival") {
    return (
      <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-pink-500 via-orange-400 to-yellow-300 p-7 text-black shadow-2xl">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-black/55">
          Live preview
        </div>
        <h3 className="text-4xl font-black leading-tight">{form.title}</h3>
        <p className="mt-4 text-lg text-black/70">{form.subtitle}</p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {blocks.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] bg-white/65 p-5 text-center shadow-lg"
            >
              <div className="text-5xl font-black">{item.value}</div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-black/50">
                {item.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[30px] bg-gradient-to-br from-fuchsia-600 via-pink-500 to-amber-400 p-7 text-white shadow-2xl">
      <div className="absolute inset-0 opacity-30 bg-[linear-gradient(135deg,rgba(255,255,255,0.08),transparent_45%,rgba(255,255,255,0.1))]" />
      <div className="relative z-10">
        <div className="mb-4 text-xs font-bold uppercase tracking-[0.35em] text-white/70">
          Live preview
        </div>
        <h3 className="text-4xl font-black leading-tight">{form.title}</h3>
        <p className="mt-4 text-lg text-white/90">{form.subtitle}</p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {blocks.map((item) => (
            <div
              key={item.label}
              className="rounded-[22px] bg-white/20 p-5 text-center shadow-lg backdrop-blur-sm"
            >
              <div
                className="text-5xl font-black"
                style={{ color: form.accent || "#fde047" }}
              >
                {item.value}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.3em] text-white/75">
                {item.label}
              </div>
            </div>
          ))}
        </div>

        {form.showEventMessage && form.eventMessage ? (
          <div className="mt-7 inline-flex rounded-full bg-white/20 px-5 py-3 text-sm font-bold text-white backdrop-blur-sm">
            {form.eventMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AdminCountdownPage() {
  const [items, setItems] = useState<CountdownItem[]>([]);
  const [form, setForm] = useState<FormState>(createEmptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pageFilter, setPageFilter] = useState("all");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/countdown", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to load countdowns");
      }

      const list = Array.isArray(json.countdowns) ? json.countdowns : [];
      setItems(list);

      if (list.length > 0 && !form.id) {
        setForm(mapItemToForm(list[0]));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load countdowns");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredItems = useMemo(() => {
    if (pageFilter === "all") return items;
    return items.filter((item) => item.page_key === pageFilter);
  }, [items, pageFilter]);

  const selectedLabel = useMemo(() => {
    if (!form.id) return "New countdown";
    const found = items.find((item) => item.id === form.id);
    return found?.title || "Edit countdown";
  }, [form.id, items]);

  function updateField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function selectItem(item: CountdownItem) {
    setMessage("");
    setError("");
    setForm(mapItemToForm(item));
  }

  function handleCreateNew() {
    setMessage("");
    setError("");
    setForm(createEmptyForm());
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        id: form.id,
        enabled: form.enabled,
        title: form.title,
        subtitle: form.subtitle,
        targetDate: form.targetDate,
        eventMessage: form.eventMessage,
        showEventMessage: form.showEventMessage,
        slug: form.slug,
        pageKey: form.pageKey,
        template: form.template,
        accent: form.accent,
        description: form.description,
        isActive: form.isActive,
        sortOrder: form.sortOrder,
      };

      const res = await fetch("/api/admin/countdown", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Failed to save countdown");
      }

      setMessage(form.id ? "Countdown updated." : "Countdown created.");
      await loadData();

      if (json.countdown) {
        setForm(mapItemToForm(json.countdown));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save countdown");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ec4899_0%,#c026d3_35%,#6366f1_100%)] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-white">
              Countdown
            </h1>
            <p className="mt-2 text-lg text-white/70">
              Create and manage live countdowns across your Burton Pride pages.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <PillButton active>Countdowns</PillButton>
              <PillButton>Templates</PillButton>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <PillButton onClick={loadData}>Refresh</PillButton>
            <button
              type="button"
              onClick={handleCreateNew}
              className="rounded-2xl bg-white px-5 py-2.5 text-sm font-black text-black shadow-lg transition hover:scale-[1.02]"
            >
              + New countdown
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="w-full xl:max-w-2xl">
            <input
              value=""
              readOnly
              placeholder="Search by title, slug, page..."
              className="h-14 w-full rounded-3xl border border-white/10 bg-white/[0.05] px-5 text-white/75 outline-none placeholder:text-white/35"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <PillButton active={pageFilter === "all"} onClick={() => setPageFilter("all")}>
              All
            </PillButton>
            {PAGE_OPTIONS.map((page) => (
              <PillButton
                key={page.value}
                active={pageFilter === page.value}
                onClick={() => setPageFilter(page.value)}
              >
                {page.label}
              </PillButton>
            ))}
          </div>
        </div>

        <div className="mb-4 text-sm font-semibold text-white/70">
          Showing {filteredItems.length} countdown{filteredItems.length === 1 ? "" : "s"}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white/70">
                Loading countdowns...
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 text-white/70">
                No countdowns found.
              </div>
            ) : (
              filteredItems.map((item) => (
                <CountdownCard
                  key={item.id}
                  item={item}
                  selected={form.id === item.id}
                  onClick={() => selectItem(item)}
                />
              ))
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-[30px] border border-white/10 bg-[#1b1032]/75 p-5 shadow-2xl backdrop-blur-md">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.35em] text-white/45">
                    Editor
                  </div>
                  <h2 className="mt-2 text-4xl font-black text-white">
                    {selectedLabel}
                  </h2>
                </div>

                <span className="rounded-2xl bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-[0.2em] text-white/70">
                  {form.isActive ? "Live" : "Draft"}
                </span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Title">
                  <input
                    value={form.title}
                    onChange={(e) => updateField("title", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  />
                </Field>

                <Field label="Slug">
                  <input
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  />
                </Field>

                <Field label="Subtitle">
                  <input
                    value={form.subtitle}
                    onChange={(e) => updateField("subtitle", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none sm:col-span-2"
                  />
                </Field>

                <Field label="Page">
                  <select
                    value={form.pageKey}
                    onChange={(e) => updateField("pageKey", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  >
                    {PAGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1b1032]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Template">
                  <select
                    value={form.template}
                    onChange={(e) => updateField("template", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  >
                    {TEMPLATE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value} className="bg-[#1b1032]">
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="Target date and time">
                  <input
                    type="datetime-local"
                    value={toLocalInputValue(form.targetDate)}
                    onChange={(e) =>
                      updateField("targetDate", fromLocalInputValue(e.target.value))
                    }
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  />
                </Field>

                <Field label="Sort order">
                  <input
                    type="number"
                    value={form.sortOrder}
                    onChange={(e) => updateField("sortOrder", Number(e.target.value || 0))}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  />
                </Field>

                <Field label="Accent colour">
                  <div className="flex h-12 items-center gap-3 rounded-2xl border border-white/10 bg-black/25 px-4">
                    <input
                      type="color"
                      value={form.accent || "#fde047"}
                      onChange={(e) => updateField("accent", e.target.value)}
                      className="h-7 w-9 shrink-0 border-0 bg-transparent p-0"
                    />
                    <input
                      value={form.accent}
                      onChange={(e) => updateField("accent", e.target.value)}
                      className="w-full bg-transparent text-white outline-none"
                    />
                  </div>
                </Field>

                <Field label="Description">
                  <input
                    value={form.description}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                  />
                </Field>
              </div>

              <div className="mt-4 space-y-3">
                <ToggleRow
                  label="Enable countdown"
                  description="Show or hide this countdown entirely."
                  checked={form.enabled}
                  onChange={(value) => updateField("enabled", value)}
                />

                <ToggleRow
                  label="Set active on selected page"
                  description="Only one countdown can be live on each page."
                  checked={form.isActive}
                  onChange={(value) => updateField("isActive", value)}
                />

                <ToggleRow
                  label="Show event message"
                  description="Display an optional badge below the countdown."
                  checked={form.showEventMessage}
                  onChange={(value) => updateField("showEventMessage", value)}
                />
              </div>

              {form.showEventMessage ? (
                <div className="mt-4">
                  <Field label="Event message">
                    <input
                      value={form.eventMessage}
                      onChange={(e) => updateField("eventMessage", e.target.value)}
                      className="h-12 w-full rounded-2xl border border-white/10 bg-black/25 px-4 text-white outline-none"
                    />
                  </Field>
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-black shadow-lg disabled:opacity-60"
                >
                  {saving ? "Saving..." : form.id ? "Save changes" : "Create countdown"}
                </motion.button>

                <button
                  type="button"
                  onClick={() => setForm(createEmptyForm())}
                  className="rounded-2xl border border-white/10 bg-white/[0.05] px-5 py-3 text-sm font-bold text-white"
                >
                  Reset
                </button>

                {message ? (
                  <span className="text-sm font-bold text-emerald-200">{message}</span>
                ) : null}

                {error ? (
                  <span className="text-sm font-bold text-red-200">{error}</span>
                ) : null}
              </div>
            </section>

            <section className="rounded-[30px] border border-white/10 bg-white/[0.04] p-5 shadow-2xl backdrop-blur-md">
              <div className="mb-4 text-xs font-black uppercase tracking-[0.35em] text-white/55">
                Live preview
              </div>
              <TemplatePreview form={form} />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}