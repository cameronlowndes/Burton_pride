"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type RepeatRule =
  | "none"
  | "daily"
  | "weekly"
  | "biweekly"
  | "triweekly"
  | "monthly";
type PriceType = "free" | "paid";

type EventRow = {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  location: string | null;
  start_at: string;
  end_at: string | null;

  image_url: string | null;
  ticket_url: string | null;
  website_url?: string | null;

  is_published: boolean;

  repeat_rule?: RepeatRule | null;
  price_type?: PriceType | null;
  price_gbp?: number | null;
  is_free?: boolean | null;
};

type DraftEvent = {
  title: string;
  description: string;
  location: string;

  // ✅ split date + time (fixes UI and saves correctly)
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_date: string; // YYYY-MM-DD
  end_time: string; // HH:mm

  image_url: string;
  ticket_url: string;
  website_url: string;

  is_published: boolean;

  repeat_rule: RepeatRule;
  price_type: PriceType;
  price_gbp: string;
};

const emptyDraft = (): DraftEvent => ({
  title: "",
  description: "",
  location: "",
  start_date: "",
  start_time: "",
  end_date: "",
  end_time: "",
  image_url: "",
  ticket_url: "",
  website_url: "",
  is_published: false,
  repeat_rule: "none",
  price_type: "free",
  price_gbp: "",
});

type Filter = "all" | "published" | "draft" | "expired";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function isoToLocalParts(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const date = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const time = `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  return { date, time };
}

function localPartsToIso(date: string, time: string) {
  // Interprets as local time (good for admin UI)
  const dt = new Date(`${date}T${time}`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

function formatPrice(ev: EventRow) {
  const isFree =
    ev.is_free === true ||
    ev.price_type === "free" ||
    (typeof ev.price_gbp === "number" && ev.price_gbp <= 0);

  if (isFree) return "Free";
  const p = typeof ev.price_gbp === "number" ? ev.price_gbp : 0;
  return `£${p.toFixed(2)}`;
}

function repeatLabel(rr?: string | null) {
  if (!rr || rr === "none") return "No repeat";
  if (rr === "daily") return "Daily";
  if (rr === "weekly") return "Weekly";
  if (rr === "biweekly") return "Every 2 weeks";
  if (rr === "triweekly") return "Every 3 weeks";
  if (rr === "monthly") return "Monthly";
  return rr;
}

/**
 * ✅ Admin status:
 * - expired: end_at < now OR (no end_at and start_at < now)
 * - ongoing: start_at <= now <= end_at (only when end_at exists)
 * - upcoming: everything else
 */
function getStatus(ev: EventRow): "upcoming" | "ongoing" | "expired" {
  const now = Date.now();
  const start = new Date(ev.start_at).getTime();
  const end = ev.end_at ? new Date(ev.end_at).getTime() : NaN;

  if (Number.isFinite(end)) {
    if (end < now) return "expired";
    if (Number.isFinite(start) && start <= now && now <= end) return "ongoing";
    return "upcoming";
  }

  if (Number.isFinite(start) && start < now) return "expired";
  return "upcoming";
}

export default function EventsPage() {
  const [events, setEvents] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mode, setMode] = useState<"create" | "edit">("create");
  const [selected, setSelected] = useState<EventRow | null>(null);
  const [draft, setDraft] = useState<DraftEvent>(emptyDraft());
  const [saving, setSaving] = useState(false);

  const [uploadingCover, setUploadingCover] = useState(false);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(
    null
  );

  const load = async () => {
    try {
      setError(null);
      setLoading(true);

      const res = await fetch("/api/admin/events", { cache: "no-store" });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Failed to load events");
      setEvents(json.events || []);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();

    return events
      .filter((ev) => {
        if (filter === "published") return ev.is_published;
        if (filter === "draft") return !ev.is_published;
        if (filter === "expired") return getStatus(ev) === "expired";
        return true;
      })
      .filter((ev) => {
        if (!qq) return true;
        return (
          ev.title.toLowerCase().includes(qq) ||
          ev.slug.toLowerCase().includes(qq) ||
          (ev.location || "").toLowerCase().includes(qq)
        );
      })
      .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime());
  }, [events, q, filter]);

  const openCreate = () => {
    setMode("create");
    setSelected(null);
    setDraft(emptyDraft());
    setDrawerOpen(true);
  };

  const openEdit = (ev: EventRow) => {
    setMode("edit");
    setSelected(ev);

    const isFree =
      ev.is_free === true ||
      ev.price_type === "free" ||
      (typeof ev.price_gbp === "number" && ev.price_gbp <= 0);

    const startParts = isoToLocalParts(ev.start_at);
    const endParts = ev.end_at ? isoToLocalParts(ev.end_at) : { date: "", time: "" };

    setDraft({
      title: ev.title,
      description: ev.description || "",
      location: ev.location || "",

      start_date: startParts.date,
      start_time: startParts.time,
      end_date: endParts.date,
      end_time: endParts.time,

      image_url: ev.image_url || "",
      ticket_url: ev.ticket_url || "",
      website_url: (ev as any).website_url || "",
      is_published: !!ev.is_published,

      repeat_rule: (ev.repeat_rule as RepeatRule) || "none",
      price_type: isFree ? "free" : "paid",
      price_gbp: !isFree && typeof ev.price_gbp === "number" ? String(ev.price_gbp) : "",
    });

    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving || uploadingCover) return;
    setDrawerOpen(false);
    setSelected(null);
  };

  const requestDelete = (ev: EventRow) => {
    setError(null);
    setPendingDelete({ id: ev.id, title: ev.title });
    setConfirmOpen(true);
  };

  const cancelDelete = () => {
    if (deletingId) return;
    setConfirmOpen(false);
    setPendingDelete(null);
  };

  const confirmDelete = async () => {
    if (!pendingDelete?.id || deletingId) return;

    const id = pendingDelete.id;
    setError(null);
    setDeletingId(id);

    try {
      const res = await fetch(`/api/admin/events/${id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Delete failed");

      setEvents((prev) => prev.filter((e) => e.id !== id));
      setConfirmOpen(false);
      setPendingDelete(null);
    } catch (e: any) {
      setError(e?.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const uploadCover = async (file: File) => {
    setError(null);
    setUploadingCover(true);

    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/events/upload", { method: "POST", body: fd });

      const text = await res.text();
      let json: any = {};
      try {
        json = JSON.parse(text);
      } catch {}

      if (!res.ok) {
        const msg =
          json?.error || `Upload failed (${res.status}). Response: ${text.slice(0, 120)}`;
        throw new Error(msg);
      }

      if (!json?.url) throw new Error("Upload succeeded but no URL returned.");

      setDraft((d) => ({ ...d, image_url: String(json.url) }));
    } catch (e: any) {
      setError(e?.message || "Cover upload failed");
    } finally {
      setUploadingCover(false);
    }
  };

  const onSave = async () => {
    if (!draft.title.trim() || !draft.location.trim() || !draft.description.trim()) {
      setError("Title, location and description are required.");
      return;
    }
    if (!draft.start_date.trim() || !draft.start_time.trim()) {
      setError("Start date and start time are required.");
      return;
    }

    if (draft.price_type === "paid") {
      const price = Number(draft.price_gbp);
      if (!Number.isFinite(price) || price <= 0) {
        setError("Enter a valid price for paid events (e.g. 5.00).");
        return;
      }
    }

    const startIso = localPartsToIso(draft.start_date, draft.start_time);
    if (!startIso) {
      setError("Start date/time is invalid.");
      return;
    }

    let endIso: string | null = null;
    const hasEnd = draft.end_date.trim() || draft.end_time.trim();
    if (hasEnd) {
      if (!draft.end_date.trim() || !draft.end_time.trim()) {
        setError("If you set an end time, you must set BOTH end date and end time.");
        return;
      }
      const iso = localPartsToIso(draft.end_date, draft.end_time);
      if (!iso) {
        setError("End date/time is invalid.");
        return;
      }
      endIso = iso;
    }

    setSaving(true);
    setError(null);

    try {
      const payload = {
        title: draft.title.trim(),
        description: draft.description.trim() || null,
        location: draft.location.trim() || null,
        start_at: startIso,
        end_at: endIso,

        image_url: draft.image_url.trim() || null,
        ticket_url: draft.ticket_url.trim() || null,
        website_url: draft.website_url.trim() || null,

        is_published: !!draft.is_published,

        repeat_rule: draft.repeat_rule,
        price_type: draft.price_type,
        price_gbp:
          draft.price_type === "paid" && draft.price_gbp ? Number(draft.price_gbp) : 0,
        is_free: draft.price_type === "free",
      };

      if (mode === "create") {
        const res = await fetch("/api/admin/events", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to create event");

        setEvents((prev) => [json.event, ...prev]);
        setDrawerOpen(false);
      } else {
        if (!selected) return;

        const res = await fetch(`/api/admin/events/${selected.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        const json = await res.json();
        if (!res.ok) throw new Error(json?.error || "Failed to update event");

        setEvents((prev) => prev.map((e) => (e.id === json.event.id ? json.event : e)));
        setDrawerOpen(false);
      }
    } catch (e: any) {
      setError(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 text-white">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Events</h1>
          <p className="text-sm text-white/70 mt-1">Create and manage Burton Pride events.</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 cursor-pointer"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition cursor-pointer"
          >
            + New event
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-4">
        <AdminEventTabs active="events" />
      </div>

      {/* Controls */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="md:col-span-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by title, slug, location…"
            className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
          />
        </div>

        <div className="flex gap-2">
          <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>
            All
          </FilterChip>
          <FilterChip active={filter === "published"} onClick={() => setFilter("published")}>
            Published
          </FilterChip>
          <FilterChip active={filter === "draft"} onClick={() => setFilter("draft")}>
            Drafts
          </FilterChip>
          <FilterChip active={filter === "expired"} onClick={() => setFilter("expired")}>
            Expired
          </FilterChip>
        </div>
      </div>

      {/* States */}
      {loading && <div className="mt-6 text-white/70">Loading…</div>}

      {error && (
        <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="mt-6 text-sm text-white/70">
            Showing <span className="text-white">{filtered.length}</span>{" "}
            {filtered.length === 1 ? "event" : "events"}
          </div>

          <div className="mt-3 grid grid-cols-1 xl:grid-cols-2 gap-3">
            {filtered.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/70">
                No events match your filters. Try “New event”.
              </div>
            ) : (
              filtered.map((ev) => (
                <EventCard
                  key={ev.id}
                  ev={ev}
                  onEdit={() => openEdit(ev)}
                  onDelete={() => requestDelete(ev)}
                  deleting={deletingId === ev.id}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* Drawer */}
      <Drawer open={drawerOpen} onClose={closeDrawer}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-lg font-extrabold">
              {mode === "create" ? "Create event" : "Edit event"}
            </div>
            <div className="text-xs text-white/60 mt-1">
              {mode === "create"
                ? "Saves to database using POST /api/admin/events/"
                : "Saves to database using PUT /api/admin/events/:id"}
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-xl px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <Field label="Title" required>
            <input
              value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="e.g. Burton Pride Opening Night"
            />
          </Field>

          {/* ✅ Date then Time (separate boxes) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start date" required>
              <div className="space-y-2">
                <input
                  type="date"
                  value={draft.start_date}
                  onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                />
                <input
                  type="time"
                  value={draft.start_time}
                  onChange={(e) => setDraft((d) => ({ ...d, start_time: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                />
                <div className="text-[11px] text-white/55">
                  Date picker shows Day / Month / Year. Time is separate.
                </div>
              </div>
            </Field>

            <Field label="End date">
              <div className="space-y-2">
                <input
                  type="date"
                  value={draft.end_date}
                  onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                />
                <input
                  type="time"
                  value={draft.end_time}
                  onChange={(e) => setDraft((d) => ({ ...d, end_time: e.target.value }))}
                  className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                />
                <div className="text-[11px] text-white/55">
                  Leave both blank if there is no end time.
                </div>
              </div>
            </Field>
          </div>

          <Field label="Location" required>
            <input
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="e.g. Burton Town Centre"
            />
          </Field>

          <Field label="Description" required>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full min-h-[110px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="Short details about the event…"
            />
          </Field>

          {/* Cover + Ticket */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Cover picture">
              <div className="rounded-2xl bg-white/5 border border-white/10 p-3">
                {draft.image_url ? (
                  <div className="space-y-2">
                    <div className="text-xs text-white/70">Cover uploaded ✅</div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={draft.image_url}
                      alt="Cover preview"
                      className="w-full h-32 object-cover rounded-xl border border-white/10"
                    />
                  </div>
                ) : (
                  <div className="text-xs text-white/60">Upload an image for the event cover.</div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="file"
                    accept="image/*"
                    disabled={uploadingCover || saving}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) uploadCover(f);
                      e.currentTarget.value = "";
                    }}
                    className="block w-full text-sm text-white/80
                               file:mr-3 file:rounded-xl file:border-0
                               file:bg-white file:text-black
                               file:px-3 file:py-2 file:text-sm file:font-semibold
                               hover:file:bg-white/90"
                  />

                  {draft.image_url ? (
                    <button
                      type="button"
                      onClick={() => setDraft((d) => ({ ...d, image_url: "" }))}
                      disabled={uploadingCover || saving}
                      className="rounded-xl px-3 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 disabled:opacity-60 cursor-pointer"
                    >
                      Remove
                    </button>
                  ) : null}
                </div>

                {uploadingCover ? <div className="mt-2 text-xs text-white/60">Uploading…</div> : null}
              </div>
            </Field>

            <Field label="Ticket URL (optional)">
              <input
                value={draft.ticket_url}
                onChange={(e) => setDraft((d) => ({ ...d, ticket_url: e.target.value }))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                placeholder="https://..."
              />
            </Field>
          </div>

          <Field label="Website URL (optional)">
            <input
              value={draft.website_url}
              onChange={(e) => setDraft((d) => ({ ...d, website_url: e.target.value }))}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="https://..."
            />
          </Field>

          {/* Repeat + Price */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Repeat">
              <select
                value={draft.repeat_rule}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    repeat_rule: e.target.value as RepeatRule,
                  }))
                }
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              >
                <option className="text-black" value="none">
                  No repeat
                </option>
                <option className="text-black" value="daily">
                  Daily
                </option>
                <option className="text-black" value="weekly">
                  Weekly
                </option>
                <option className="text-black" value="biweekly">
                  Every 2 weeks
                </option>
                <option className="text-black" value="triweekly">
                  Every 3 weeks
                </option>
                <option className="text-black" value="monthly">
                  Monthly
                </option>
              </select>
            </Field>

            <Field label="Price">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, price_type: "free", price_gbp: "" }))}
                  className={[
                    "flex-1 rounded-2xl px-3 py-3 text-sm font-semibold border transition cursor-pointer",
                    draft.price_type === "free"
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Free
                </button>

                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, price_type: "paid" }))}
                  className={[
                    "flex-1 rounded-2xl px-3 py-3 text-sm font-semibold border transition cursor-pointer",
                    draft.price_type === "paid"
                      ? "bg-white text-black border-white"
                      : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10",
                  ].join(" ")}
                >
                  Paid
                </button>
              </div>
            </Field>
          </div>

          {draft.price_type === "paid" ? (
            <Field label="Price (GBP)" required>
              <input
                value={draft.price_gbp}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    price_gbp: e.target.value.replace(/[^\d.]/g, ""),
                  }))
                }
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                placeholder="e.g. 5.00"
                inputMode="decimal"
              />
            </Field>
          ) : null}

          <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
            <input
              type="checkbox"
              checked={draft.is_published}
              onChange={(e) => setDraft((d) => ({ ...d, is_published: e.target.checked }))}
              className="h-4 w-4"
            />
            <div>
              <div className="text-sm font-semibold">Published</div>
              <div className="text-xs text-white/60">
                Toggle whether this event is visible on the public site.
              </div>
            </div>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeDrawer}
              disabled={saving || uploadingCover}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving || uploadingCover}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
            </button>
          </div>
        </div>
      </Drawer>

      {/* Confirm delete */}
      <ConfirmModal
        open={confirmOpen}
        title="Delete event?"
        message={
          pendingDelete?.title
            ? `Are you sure you want to delete “${pendingDelete.title}”? This can’t be undone.`
            : "Are you sure you want to delete this event? This can’t be undone."
        }
        confirmText={deletingId ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        loading={!!deletingId}
        onConfirm={confirmDelete}
        onCancel={cancelDelete}
      />
    </div>
  );
}

/** Tabs bar */
function AdminEventTabs({ active }: { active: "events" | "woh" }) {
  const base =
    "rounded-2xl px-4 py-2 text-sm font-semibold border transition inline-flex items-center gap-2";
  const activeCls = "bg-white text-black border-white";
  const idleCls =
    "bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white";

  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/admin/dashboard/events"
        className={[base, active === "events" ? activeCls : idleCls].join(" ")}
      >
        Events
      </Link>

      <Link
        href="/admin/dashboard/windows-showcase"
        className={[base, active === "woh" ? activeCls : idleCls].join(" ")}
      >
        Windows of Hope
      </Link>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex-1 rounded-2xl px-3 py-3 text-sm font-semibold border transition cursor-pointer",
        active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EventCard({
  ev,
  onEdit,
  onDelete,
  deleting,
}: {
  ev: EventRow;
  onEdit: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const start = new Date(ev.start_at);
  const end = ev.end_at ? new Date(ev.end_at) : null;
  const status = getStatus(ev);

  const statusCls =
    status === "expired"
      ? "border-red-400/30 text-red-200 bg-red-500/10"
      : status === "ongoing"
      ? "border-yellow-400/30 text-yellow-200 bg-yellow-500/10"
      : "border-blue-400/30 text-blue-200 bg-blue-500/10";

  const statusLabel =
    status === "expired" ? "Expired" : status === "ongoing" ? "Ongoing" : "Upcoming";

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-extrabold truncate">{ev.title}</div>
            <Badge published={ev.is_published} />

            <span className={["text-[11px] px-2 py-1 rounded-full border", statusCls].join(" ")}>
              {statusLabel}
            </span>

            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
              {formatPrice(ev)}
            </span>

            <span className="text-[11px] px-2 py-1 rounded-full border border-white/10 bg-white/5 text-white/80">
              {repeatLabel(ev.repeat_rule)}
            </span>
          </div>

          <div className="mt-1 text-sm text-white/70">
            {start.toLocaleString()}
            {end ? ` → ${end.toLocaleString()}` : ""}
            {ev.location ? ` • ${ev.location}` : ""}
          </div>

          <div className="mt-2 text-xs text-white/50">/{ev.slug}</div>

          {ev.ticket_url ? (
            <div className="mt-2 text-xs text-white/70 break-all">
              Tickets:{" "}
              <a
                href={ev.ticket_url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                {ev.ticket_url}
              </a>
            </div>
          ) : null}

          {(ev as any).website_url ? (
            <div className="mt-1 text-xs text-white/70 break-all">
              Website:{" "}
              <a
                href={(ev as any).website_url}
                target="_blank"
                rel="noreferrer"
                className="underline hover:text-white"
              >
                {(ev as any).website_url}
              </a>
            </div>
          ) : null}

          {ev.description ? (
            <div className="mt-3 text-sm text-white/80 line-clamp-3">{ev.description}</div>
          ) : (
            <div className="mt-3 text-sm text-white/50 italic">No description</div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl px-3 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 cursor-pointer"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="rounded-xl px-3 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 transition border border-white/10 text-white/80 disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Badge({ published }: { published: boolean }) {
  return (
    <span
      className={[
        "text-[11px] px-2 py-1 rounded-full border",
        published
          ? "border-green-400/30 text-green-200 bg-green-500/10"
          : "border-yellow-400/30 text-yellow-200 bg-yellow-500/10",
      ].join(" ")}
    >
      {published ? "Published" : "Draft"}
    </span>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs text-white/70 mb-2">
        {label} {required ? <span className="text-red-200">*</span> : null}
      </div>
      {children}
    </div>
  );
}

/**
 * ✅ Drawer fix:
 * - DO NOT use translate/transform animation (breaks native date/time pickers)
 * - animate "right" instead
 */
function Drawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const closedRightPx = -560; // push fully off-screen

  return (
    <div className={["fixed inset-0 z-50", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div
        className={[
          "absolute top-0 h-full w-[520px] max-w-[92vw]",
          "bg-black/40 backdrop-blur-xl border-l border-white/10 shadow-2xl",
          "transition-[right] duration-200 ease-out",
          "overflow-y-auto",
        ].join(" ")}
        style={{ right: open ? 0 : closedRightPx }}
      >
        <div className="p-5 pb-10">{children}</div>
      </div>
    </div>
  );
}

function ConfirmModal({
  open,
  title,
  message,
  confirmText,
  cancelText,
  loading,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  return (
    <div className={["fixed inset-0 z-[60]", open ? "pointer-events-auto" : "pointer-events-none"].join(" ")}>
      <div
        onClick={onCancel}
        className={[
          "absolute inset-0 bg-black/70 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div
        className={[
          "absolute left-1/2 top-1/2 w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2",
          "rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl shadow-2xl",
          "transition-all duration-200",
          open ? "opacity-100 scale-100" : "opacity-0 scale-95",
        ].join(" ")}
      >
        <div className="p-5">
          <div className="text-lg font-extrabold">{title}</div>
          <div className="mt-2 text-sm text-white/70">{message}</div>

          <div className="mt-5 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {cancelText}
            </button>

            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="cursor-pointer rounded-xl px-4 py-2 text-sm font-semibold bg-red-500 text-white hover:bg-red-500/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}