"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Lock,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Star,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import { useBurtonPrideEvent, type BurtonPrideEvent } from "../../components/event-hub/BurtonPrideEventProvider";

type EventsResponse = {
  ok: boolean;
  error?: string;
  events?: BurtonPrideEvent[];
  event?: BurtonPrideEvent;
};

type FormState = {
  event_name: string;
  event_year: string;
  event_date: string;
  event_start_time: string;
  event_end_time: string;
  setup_start_time: string;
  venue_name: string;
  venue_address: string;
  theme: string;
  status: BurtonPrideEvent["status"];
  is_active: boolean;
};

const EVENTS_API = "/api/admin/burton-pride-event-hub/events";

const emptyForm: FormState = {
  event_name: "Burton Pride",
  event_year: String(new Date().getFullYear() + 1),
  event_date: "",
  event_start_time: "12:00",
  event_end_time: "18:00",
  setup_start_time: "10:00",
  venue_name: "Shobnall Fields",
  venue_address: "Shobnall Road, Burton-on-Trent, DE14 2BB",
  theme: "United as One",
  status: "planning",
  is_active: false,
};

async function readJson(res: Response): Promise<EventsResponse> {
  const text = await res.text();

  try {
    return text ? JSON.parse(text) : { ok: false, error: "Server returned an empty response." };
  } catch {
    return {
      ok: false,
      error: text
        ? `Server returned invalid JSON. Raw response: ${text.slice(0, 500)}`
        : "Server returned invalid JSON.",
    };
  }
}
type Notice = {
  type: "success" | "error";
  title?: string;
  message: string;
  details?: string[];
};

function getHttpHelp(status: number) {
  if (status === 400) return "The server rejected the request because some information was missing or invalid.";
  if (status === 401) return "You are not logged in, or your admin session has expired. Please log back in.";
  if (status === 403) return "Your account does not have permission to do this action. Main admin access may be required.";
  if (status === 404) return "The API route or event record could not be found. Check the route exists and the event has not been deleted.";
  if (status === 409) return "This conflicts with existing event data. For example, the year may already exist or another event may already be active.";
  if (status === 500) return "The server had an internal error. Check the terminal/server logs and Supabase response.";
  return `The server returned status ${status}.`;
}

function makeDetailedErrorMessage(action: string, res: Response, data: EventsResponse) {
  const serverError = data?.error || "No detailed server error was returned.";
  return {
    type: "error" as const,
    title: `${action} failed`,
    message: serverError,
    details: [
      `Action: ${action}`,
      `Endpoint: ${res.url}`,
      `Status code: ${res.status}`,
      getHttpHelp(res.status),
      "Check that the active admin session is valid.",
      "Check that the Event Hub events API route exists.",
      "Check that the Supabase table and columns match this page.",
      "Check server logs for the full Supabase error.",
    ],
  };
}

function makeUnknownError(action: string, error: unknown): Notice {
  return {
    type: "error",
    title: `${action} failed`,
    message: error instanceof Error ? error.message : "Something went wrong.",
    details: [
      `Action: ${action}`,
      "This error happened before the page received a valid server response.",
      "Check your internet connection.",
      "Check the browser console.",
      "Check the Next.js terminal/server logs.",
    ],
  };
}


function toForm(event: BurtonPrideEvent): FormState {
  return {
    event_name: event.event_name || "Burton Pride",
    event_year: String(event.event_year || ""),
    event_date: event.event_date || "",
    event_start_time: event.event_start_time || "",
    event_end_time: event.event_end_time || "",
    setup_start_time: event.setup_start_time || "",
    venue_name: event.venue_name || "",
    venue_address: event.venue_address || "",
    theme: event.theme || "",
    status: event.status || "planning",
    is_active: Boolean(event.is_active),
  };
}

export default function BurtonPrideEventManagementPage() {
  const { currentEvent, refreshEvent } = useBurtonPrideEvent();

  const [events, setEvents] = useState<BurtonPrideEvent[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [mainAdminPassword, setMainAdminPassword] = useState("");
  const [showMainAdminPassword, setShowMainAdminPassword] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const sortedEvents = useMemo(
    () => [...events].sort((a, b) => b.event_year - a.event_year),
    [events]
  );

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  async function loadEvents() {
    try {
      setLoading(true);
      setNotice(null);

      const res = await fetch(EVENTS_API, {
        cache: "no-store",
        credentials: "include",
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setNotice(makeDetailedErrorMessage("Load events", res, data));
        return;
      }

      setEvents(data.events || []);
    } catch (error) {
      setNotice(makeUnknownError("Load events", error));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvents();
  }, []);

  function startEdit(event: BurtonPrideEvent) {
    setEditingId(event.id);
    setForm(toForm(event));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEvent() {
    try {
      setSaving(true);
      setNotice(null);

      const year = Number(form.event_year);

      if (!form.event_name.trim()) throw new Error("Please enter the event name.");
      if (!Number.isInteger(year) || year < 2024 || year > 2100) {
        throw new Error("Please enter a valid event year.");
      }
      if (!form.event_date) throw new Error("Please enter the event date.");

      const payload = {
        id: editingId || undefined,
        event_name: form.event_name.trim(),
        event_year: year,
        event_date: form.event_date || null,
        event_start_time: form.event_start_time || null,
        event_end_time: form.event_end_time || null,
        setup_start_time: form.setup_start_time || null,
        venue_name: form.venue_name || null,
        venue_address: form.venue_address || null,
        theme: form.theme || null,
        status: form.status,
        is_active: form.is_active,
      };

      const res = await fetch(EVENTS_API, {
        method: editingId ? "PATCH" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setNotice(makeDetailedErrorMessage(editingId ? "Update event" : "Create event", res, data));
        return;
      }

      setNotice({
        type: "success",
        message: editingId ? "Event updated successfully." : "Event created successfully.",
      });

      resetForm();
      await loadEvents();
      await refreshEvent();
    } catch (error) {
      setNotice(makeUnknownError(editingId ? "Update event" : "Create event", error));
    } finally {
      setSaving(false);
    }
  }

  async function runEventAction(eventId: string, action: "set_active" | "lock" | "unlock" | "archive" | "restore" | "clone" | "delete") {
    try {
      setActionLoadingId(`${eventId}:${action}`);
      setNotice(null);

      if (["lock", "unlock", "archive", "restore", "delete"].includes(action) && !mainAdminPassword.trim()) {
        throw new Error("Please enter the main admin password before doing this action.");
      }

      const res = await fetch(`${EVENTS_API}/${eventId}/actions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          main_admin_password: mainAdminPassword || undefined,
        }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setNotice(makeDetailedErrorMessage(`Event action: ${action}`, res, data));
        return;
      }

      setNotice({ type: "success", message: "Event action completed successfully." });
      setMainAdminPassword("");
      await loadEvents();
      await refreshEvent();
    } catch (error) {
      setNotice(makeUnknownError(`Event action: ${action}`, error));
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] p-4 text-white md:p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <CalendarDays className="h-4 w-4" />
                Burton Pride Event Hub
              </div>
              <h1 className="text-3xl font-extrabold tracking-tight">Event Management</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
                Manage the base event record used across the whole Event Hub. The active event controls the year, date, venue, lock status and event context every page should use automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={loadEvents}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        {currentEvent && (
          <div className="mb-6 rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
                  <Star className="h-4 w-4" /> Active event
                </div>
                <h2 className="text-2xl font-black">
                  {currentEvent.event_name} {currentEvent.event_year}
                </h2>
                <p className="mt-1 text-sm text-emerald-100/80">
                  {currentEvent.event_date || "No date set"} · {currentEvent.event_start_time || "No start"} - {currentEvent.event_end_time || "No end"} · {currentEvent.venue_name || "No venue set"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {currentEvent.is_locked ? <StatusIcon type="locked" label="Locked" /> : <StatusIcon type="open" label="Open" />}
                {currentEvent.is_archived ? <StatusIcon type="archived" label="Archived" /> : null}
                <StatusIcon type="status" label={currentEvent.status} />
              </div>
            </div>
          </div>
        )}

        {notice && <NoticeBox notice={notice} onClose={() => setNotice(null)} />}

        <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <h2 className="mb-4 text-xl font-bold">{editingId ? "Edit event" : "Create event"}</h2>

            <div className="grid gap-4">
              <Input label="Event name" value={form.event_name} onChange={(value) => updateForm("event_name", value)} required />
              <Input label="Event year" value={form.event_year} onChange={(value) => updateForm("event_year", value)} required />
              <Input label="Event date" type="date" value={form.event_date} onChange={(value) => updateForm("event_date", value)} required />

              <div className="grid gap-4 sm:grid-cols-3">
                <Input label="Setup starts" type="time" value={form.setup_start_time} onChange={(value) => updateForm("setup_start_time", value)} />
                <Input label="Public opens" type="time" value={form.event_start_time} onChange={(value) => updateForm("event_start_time", value)} />
                <Input label="Public closes" type="time" value={form.event_end_time} onChange={(value) => updateForm("event_end_time", value)} />
              </div>

              <Input label="Venue name" value={form.venue_name} onChange={(value) => updateForm("venue_name", value)} />
              <textarea
                value={form.venue_address}
                onChange={(event) => updateForm("venue_address", event.target.value)}
                placeholder="Venue address"
                rows={3}
                className="resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
              />
              <Input label="Theme" value={form.theme} onChange={(value) => updateForm("theme", value)} />

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/75">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => updateForm("status", event.target.value as BurtonPrideEvent["status"])}
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none"
                >
                  <option className="bg-[#1f1030]" value="planning">Planning</option>
                  <option className="bg-[#1f1030]" value="open">Open</option>
                  <option className="bg-[#1f1030]" value="live">Live</option>
                  <option className="bg-[#1f1030]" value="finished">Finished</option>
                  <option className="bg-[#1f1030]" value="archived">Archived</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateForm("is_active", event.target.checked)}
                />
                Make this the active Event Hub event
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={saveEvent}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black hover:opacity-90 disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editingId ? "Update event" : "Create event"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Burton Pride events</h2>
                <p className="mt-1 text-sm text-white/60">Choose the active event the whole Event Hub should use.</p>
              </div>

              <div className="w-full max-w-md rounded-2xl border border-amber-400/20 bg-amber-500/10 p-3">
                <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                  Main admin password
                </label>

                <div className="relative">
                  <input
                    type={showMainAdminPassword ? "text" : "password"}
                    value={mainAdminPassword}
                    onChange={(event) => setMainAdminPassword(event.target.value)}
                    placeholder="Needed for lock, unlock, archive and delete"
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 pr-11 text-sm outline-none placeholder:text-white/35"
                  />

                  <button
                    type="button"
                    onClick={() => setShowMainAdminPassword((prev) => !prev)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                    aria-label={showMainAdminPassword ? "Hide password" : "Show password"}
                    title={showMainAdminPassword ? "Hide password" : "Show password"}
                  >
                    {showMainAdminPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">Loading events...</div>
            ) : sortedEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">No events have been created yet.</div>
            ) : (
              <div className="grid gap-4">
                {sortedEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    actionLoadingId={actionLoadingId}
                    onEdit={() => startEdit(event)}
                    onAction={(action) => runEventAction(event.id, action)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


function NoticeBox({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const isSuccess = notice.type === "success";

  return (
    <div
      className={`mb-6 rounded-3xl border p-5 text-sm shadow-xl ${
        isSuccess
          ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
          : "border-red-400/30 bg-red-500/10 text-red-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-2xl p-2 ${
              isSuccess ? "bg-emerald-500/15" : "bg-red-500/15"
            }`}
          >
            {isSuccess ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>

          <div>
            <p className="text-base font-black">
              {notice.title || (isSuccess ? "Success" : "Something went wrong")}
            </p>
            <p className="mt-1 font-semibold leading-6">{notice.message}</p>

            {notice.details && notice.details.length > 0 && (
              <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
                <p className="mb-2 text-xs font-black uppercase tracking-[0.16em] text-white/60">
                  Details to help fix it
                </p>
                <ul className="grid gap-1 text-xs leading-5 text-white/75">
                  {notice.details.map((detail) => (
                    <li key={detail}>• {detail}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="rounded-xl border border-white/10 p-2 hover:bg-white/10"
          aria-label="Close message"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function EventCard({
  event,
  actionLoadingId,
  onEdit,
  onAction,
}: {
  event: BurtonPrideEvent;
  actionLoadingId: string | null;
  onEdit: () => void;
  onAction: (action: "set_active" | "lock" | "unlock" | "archive" | "restore" | "clone" | "delete") => void;
}) {
  const loading = (action: string) => actionLoadingId === `${event.id}:${action}`;

  return (
    <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">{event.event_name} {event.event_year}</h3>
            {event.is_active ? <StatusIcon type="active" label="Active" /> : null}
            {event.is_locked ? <StatusIcon type="locked" label="Locked" /> : <StatusIcon type="open" label="Open" />}
            {event.is_archived ? <StatusIcon type="archived" label="Archived" /> : null}
            <StatusIcon type="status" label={event.status} />
          </div>

          <div className="mt-3 grid gap-2 text-sm text-white/70 md:grid-cols-2">
            <p><span className="font-bold text-white/85">Date:</span> {event.event_date || "Not set"}</p>
            <p><span className="font-bold text-white/85">Public:</span> {event.event_start_time || "Not set"} - {event.event_end_time || "Not set"}</p>
            <p><span className="font-bold text-white/85">Setup:</span> {event.setup_start_time || "Not set"}</p>
            <p><span className="font-bold text-white/85">Theme:</span> {event.theme || "Not set"}</p>
            <p className="md:col-span-2"><span className="font-bold text-white/85">Venue:</span> {event.venue_name || "Not set"}</p>
            <p className="md:col-span-2"><span className="font-bold text-white/85">Address:</span> {event.venue_address || "Not set"}</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10">
            <Edit className="h-4 w-4" /> Edit
          </button>

          {!event.is_active && !event.is_archived && (
            <button type="button" onClick={() => onAction("set_active")} disabled={loading("set_active")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-60">
              <Star className="h-4 w-4" /> {loading("set_active") ? "Setting..." : "Set active"}
            </button>
          )}

          {event.is_locked ? (
            <button type="button" onClick={() => onAction("unlock")} disabled={loading("unlock")} className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20 disabled:opacity-60">
              <Unlock className="h-4 w-4" /> {loading("unlock") ? "Unlocking..." : "Unlock"}
            </button>
          ) : (
            <button type="button" onClick={() => onAction("lock")} disabled={loading("lock")} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:opacity-60">
              <Lock className="h-4 w-4" /> {loading("lock") ? "Locking..." : "Lock"}
            </button>
          )}

          <button type="button" onClick={() => onAction("clone")} disabled={loading("clone")} className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100 hover:bg-sky-500/20 disabled:opacity-60">
            <Copy className="h-4 w-4" /> {loading("clone") ? "Cloning..." : "Clone"}
          </button>

          {event.is_archived ? (
            <button type="button" onClick={() => onAction("restore")} disabled={loading("restore")} className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/20 disabled:opacity-60">
              <ShieldCheck className="h-4 w-4" /> {loading("restore") ? "Restoring..." : "Restore"}
            </button>
          ) : (
            <button type="button" onClick={() => onAction("archive")} disabled={loading("archive")} className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15 disabled:opacity-60">
              <ShieldCheck className="h-4 w-4" /> {loading("archive") ? "Archiving..." : "Archive"}
            </button>
          )}

          <button type="button" onClick={() => onAction("delete")} disabled={loading("delete")} className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 className="h-4 w-4" /> {loading("delete") ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({ type, label }: { type: "active" | "locked" | "open" | "archived" | "status"; label: string }) {
  const className =
    type === "active"
      ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-100"
      : type === "locked"
      ? "border-red-400/20 bg-red-500/10 text-red-100"
      : type === "open"
      ? "border-sky-400/20 bg-sky-500/10 text-sky-100"
      : type === "archived"
      ? "border-zinc-400/20 bg-zinc-500/10 text-zinc-100"
      : "border-violet-400/20 bg-violet-500/10 text-violet-100";

  const icon =
    type === "active" ? <Star className="h-3.5 w-3.5" /> :
    type === "locked" ? <Lock className="h-3.5 w-3.5" /> :
    type === "open" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
    type === "archived" ? <AlertTriangle className="h-3.5 w-3.5" /> :
    <CalendarDays className="h-3.5 w-3.5" />;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${className}`}>
      {icon} {label}
    </span>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white/75">
        {label}{required ? <span className="text-red-300"> *</span> : null}
      </label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || label}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35"
      />
    </div>
  );
}
