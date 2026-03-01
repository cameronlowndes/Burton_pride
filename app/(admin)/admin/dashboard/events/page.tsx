"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

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
  is_published: boolean;
};

type DraftEvent = {
  title: string;
  description: string;
  location: string;
  start_at: string;
  end_at: string;
  image_url: string;
  ticket_url: string;
  is_published: boolean;
};

const emptyDraft = (): DraftEvent => ({
  title: "",
  description: "",
  location: "",
  start_at: "",
  end_at: "",
  image_url: "",
  ticket_url: "",
  is_published: false,
});

type Filter = "all" | "published" | "draft";

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
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
      .sort(
        (a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime()
      );
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
    setDraft({
      title: ev.title,
      description: ev.description || "",
      location: ev.location || "",
      start_at: ev.start_at ? toLocalInputValue(ev.start_at) : "",
      end_at: ev.end_at ? toLocalInputValue(ev.end_at) : "",
      image_url: ev.image_url || "",
      ticket_url: ev.ticket_url || "",
      is_published: !!ev.is_published,
    });
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setSelected(null);
  };

  const onSave = async () => {
    if (!draft.title.trim() || !draft.start_at.trim()) {
      setError("Title and start date/time are required.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === "create") {
        const payload = {
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          location: draft.location.trim() || null,
          start_at: new Date(draft.start_at).toISOString(),
          end_at: draft.end_at ? new Date(draft.end_at).toISOString() : null,
          image_url: draft.image_url.trim() || null,
          ticket_url: draft.ticket_url.trim() || null,
          is_published: !!draft.is_published,
        };

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

        const updated: EventRow = {
          ...selected,
          title: draft.title.trim(),
          description: draft.description.trim() || null,
          location: draft.location.trim() || null,
          start_at: new Date(draft.start_at).toISOString(),
          end_at: draft.end_at ? new Date(draft.end_at).toISOString() : null,
          image_url: draft.image_url.trim() || null,
          ticket_url: draft.ticket_url.trim() || null,
          is_published: !!draft.is_published,
        };

        // UI-only edit until we add PUT endpoint
        setEvents((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
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
          <p className="text-sm text-white/70 mt-1">
            Create and manage Burton Pride events.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={load}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10"
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition"
          >
            + New event
          </button>
        </div>
      </div>

      {/* ✅ Tabs */}
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
          <FilterChip
            active={filter === "published"}
            onClick={() => setFilter("published")}
          >
            Published
          </FilterChip>
          <FilterChip active={filter === "draft"} onClick={() => setFilter("draft")}>
            Drafts
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
                <EventCard key={ev.id} ev={ev} onEdit={() => openEdit(ev)} />
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
                ? "Saves to database using POST /api/admin/events"
                : "UI only for now (we’ll wire PUT next)"}
            </div>
          </div>

          <button
            type="button"
            onClick={closeDrawer}
            className="rounded-xl px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 transition"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Start date/time" required>
              <input
                type="datetime-local"
                value={draft.start_at}
                onChange={(e) => setDraft((d) => ({ ...d, start_at: e.target.value }))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              />
            </Field>

            <Field label="End date/time">
              <input
                type="datetime-local"
                value={draft.end_at}
                onChange={(e) => setDraft((d) => ({ ...d, end_at: e.target.value }))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              />
            </Field>
          </div>

          <Field label="Location">
            <input
              value={draft.location}
              onChange={(e) => setDraft((d) => ({ ...d, location: e.target.value }))}
              className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="e.g. Burton Town Centre"
            />
          </Field>

          <Field label="Description">
            <textarea
              value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              className="w-full min-h-[110px] rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
              placeholder="Short details about the event…"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Image URL">
              <input
                value={draft.image_url}
                onChange={(e) => setDraft((d) => ({ ...d, image_url: e.target.value }))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                placeholder="https://..."
              />
            </Field>

            <Field label="Ticket URL">
              <input
                value={draft.ticket_url}
                onChange={(e) => setDraft((d) => ({ ...d, ticket_url: e.target.value }))}
                className="w-full rounded-2xl bg-white/5 border border-white/10 px-4 py-3 text-sm outline-none focus:border-white/20"
                placeholder="https://..."
              />
            </Field>
          </div>

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
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10 disabled:opacity-60"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-xl px-4 py-2 text-sm font-semibold bg-white text-black hover:bg-white/90 transition disabled:opacity-60"
            >
              {saving ? "Saving…" : mode === "create" ? "Create" : "Save changes"}
            </button>
          </div>
        </div>
      </Drawer>
    </div>
  );
}

/** ✅ Tabs bar: Events + Windows of Hope */
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
        "flex-1 rounded-2xl px-3 py-3 text-sm font-semibold border transition",
        active
          ? "bg-white text-black border-white"
          : "bg-white/5 text-white/80 border-white/10 hover:bg-white/10 hover:text-white",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EventCard({ ev, onEdit }: { ev: EventRow; onEdit: () => void }) {
  const start = new Date(ev.start_at);
  const end = ev.end_at ? new Date(ev.end_at) : null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="font-extrabold truncate">{ev.title}</div>
            <Badge published={ev.is_published} />
          </div>

          <div className="mt-1 text-sm text-white/70">
            {start.toLocaleString()}
            {end ? ` → ${end.toLocaleString()}` : ""}
            {ev.location ? ` • ${ev.location}` : ""}
          </div>

          <div className="mt-2 text-xs text-white/50">/{ev.slug}</div>

          {ev.description ? (
            <div className="mt-3 text-sm text-white/80 line-clamp-3">
              {ev.description}
            </div>
          ) : (
            <div className="mt-3 text-sm text-white/50 italic">No description</div>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            type="button"
            onClick={onEdit}
            className="rounded-xl px-3 py-2 text-sm font-semibold bg-white/10 hover:bg-white/15 transition border border-white/10"
          >
            Edit
          </button>

          <button
            type="button"
            onClick={() => alert("Delete UI next (needs DELETE endpoint)")}
            className="rounded-xl px-3 py-2 text-sm font-semibold bg-white/5 hover:bg-white/10 transition border border-white/10 text-white/80"
          >
            Delete
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

  return (
    <div
      className={[
        "fixed inset-0 z-50",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <div
        onClick={onClose}
        className={[
          "absolute inset-0 bg-black/60 transition-opacity",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
      />

      <div
        className={[
          "absolute right-0 top-0 h-full w-[520px] max-w-[92vw] bg-black/40 backdrop-blur-xl border-l border-white/10 shadow-2xl transition-transform",
          open ? "translate-x-0" : "translate-x-full",
        ].join(" ")}
      >
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}