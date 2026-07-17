"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Copy,
  Edit,
  Eye,
  EyeOff,
  Filter,
  Lock,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Unlock,
  X,
} from "lucide-react";
import {
  useBurtonPrideEvent,
  type BurtonPrideEvent,
} from "../../components/event-hub/BurtonPrideEventProvider";

type EventsResponse = {
  ok: boolean;
  error?: string;
  events?: BurtonPrideEvent[];
  event?: BurtonPrideEvent;
};

type EventAction =
  | "set_active"
  | "lock"
  | "unlock"
  | "archive"
  | "restore"
  | "clone"
  | "delete";

type EventStatus = BurtonPrideEvent["status"];

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
  status: EventStatus;
  is_active: boolean;
};

type Notice = {
  type: "success" | "error" | "warning";
  title?: string;
  message: string;
  details?: string[];
};

type PendingAction = {
  event: BurtonPrideEvent;
  action: EventAction;
};

const EVENTS_API = "/api/admin/burton-pride-event-hub/events";

const STATUS_OPTIONS: EventStatus[] = [
  "planning",
  "open",
  "live",
  "finished",
  "archived",
];

const PROTECTED_ACTIONS: EventAction[] = [
  "lock",
  "unlock",
  "archive",
  "restore",
  "delete",
];

function getEmptyForm(): FormState {
  return {
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
}

async function readJson(res: Response): Promise<EventsResponse> {
  const text = await res.text();

  try {
    return text
      ? JSON.parse(text)
      : { ok: false, error: "Server returned an empty response." };
  } catch {
    return {
      ok: false,
      error: text
        ? `Server returned invalid JSON. Raw response: ${text.slice(0, 500)}`
        : "Server returned invalid JSON.",
    };
  }
}

function getHttpHelp(status: number) {
  if (status === 400) {
    return "The server rejected the request because some information was missing or invalid.";
  }
  if (status === 401) {
    return "You are not logged in, or your admin session has expired. Please log back in.";
  }
  if (status === 403) {
    return "Your account does not have permission to do this action. Main admin access may be required.";
  }
  if (status === 404) {
    return "The API route or event record could not be found. Check the route exists and the event has not been deleted.";
  }
  if (status === 409) {
    return "This conflicts with existing event data. For example, the year may already exist or another event may already be active.";
  }
  if (status === 500) {
    return "The server had an internal error. Check the terminal/server logs and Supabase response.";
  }

  return `The server returned status ${status}.`;
}

function makeDetailedErrorMessage(
  action: string,
  res: Response,
  data: EventsResponse
): Notice {
  const serverError = data?.error || "No detailed server error was returned.";

  return {
    type: "error",
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

function formatStatus(status: string) {
  return status.replaceAll("_", " ");
}

function toMinutes(value: string) {
  if (!value) return null;

  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function getDeleteConfirmText(event: BurtonPrideEvent) {
  return `DELETE ${event.event_year}`;
}

function isProtectedAction(action: EventAction) {
  return PROTECTED_ACTIONS.includes(action);
}

function getActionLabel(action: EventAction) {
  if (action === "set_active") return "Set active";
  if (action === "lock") return "Lock";
  if (action === "unlock") return "Unlock";
  if (action === "archive") return "Archive";
  if (action === "restore") return "Restore";
  if (action === "clone") return "Clone";
  return "Delete";
}

function getActionCopy(action: EventAction, event: BurtonPrideEvent) {
  const eventLabel = `${event.event_name} ${event.event_year}`;

  if (action === "set_active") {
    return {
      title: "Set this as the active event?",
      message: `${eventLabel} will become the event used across the Event Hub. Other Event Hub pages should then use this year, date and venue automatically.`,
      confirmLabel: "Set active event",
      danger: false,
    };
  }

  if (action === "lock") {
    return {
      title: "Lock this event?",
      message: `${eventLabel} will be locked. This helps protect the event from accidental edits once the details are final.`,
      confirmLabel: "Lock event",
      danger: true,
    };
  }

  if (action === "unlock") {
    return {
      title: "Unlock this event?",
      message: `${eventLabel} will be editable again. Only do this when changes are genuinely needed.`,
      confirmLabel: "Unlock event",
      danger: false,
    };
  }

  if (action === "archive") {
    return {
      title: "Archive this event?",
      message: `${eventLabel} will be archived and hidden from the normal event list unless archived events are shown.`,
      confirmLabel: "Archive event",
      danger: true,
    };
  }

  if (action === "restore") {
    return {
      title: "Restore this event?",
      message: `${eventLabel} will be brought back from the archive.`,
      confirmLabel: "Restore event",
      danger: false,
    };
  }

  if (action === "clone") {
    return {
      title: "Clone this event?",
      message: `${eventLabel} will be copied using your existing API clone action. After cloning, edit the new event year and date if needed.`,
      confirmLabel: "Clone event",
      danger: false,
    };
  }

  return {
    title: "Delete this event?",
    message: `${eventLabel} will be deleted. This may affect records linked to this Event Hub event. This should only be used when you are completely sure.`,
    confirmLabel: "Delete event",
    danger: true,
  };
}

function validateEventForm(
  form: FormState,
  editingEvent: BurtonPrideEvent | null
): string[] {
  const errors: string[] = [];
  const year = Number(form.event_year);

  if (!form.event_name.trim()) {
    errors.push("Please enter the event name.");
  }

  if (!Number.isInteger(year) || year < 2024 || year > 2100) {
    errors.push("Please enter a valid event year between 2024 and 2100.");
  }

  if (!form.event_date) {
    errors.push("Please enter the event date.");
  }

  if (form.event_date && Number.isInteger(year)) {
    const eventDateYear = new Date(`${form.event_date}T00:00:00`).getFullYear();
    if (eventDateYear !== year) {
      errors.push(
        `The event date is in ${eventDateYear}, but the event year is ${year}. Please make them match.`
      );
    }
  }

  const setupStart = toMinutes(form.setup_start_time);
  const publicStart = toMinutes(form.event_start_time);
  const publicEnd = toMinutes(form.event_end_time);

  if (setupStart !== null && publicStart !== null && setupStart >= publicStart) {
    errors.push("Setup start time must be before the public opening time.");
  }

  if (publicStart !== null && publicEnd !== null && publicEnd <= publicStart) {
    errors.push("Public closing time must be after the public opening time.");
  }

  if (form.status === "archived" && form.is_active) {
    errors.push("An archived event cannot also be the active Event Hub event.");
  }

  if (editingEvent?.is_locked) {
    errors.push("This event is locked. Unlock it before editing event details.");
  }

  if (editingEvent?.is_archived) {
    errors.push("This event is archived. Restore it before editing event details.");
  }

  return errors;
}

function getFormWarnings(form: FormState, editingEvent: BurtonPrideEvent | null) {
  const warnings: string[] = [];

  if (form.is_active) {
    warnings.push(
      "Saving this as active will make it the event context used across the Event Hub."
    );
  }

  if (editingEvent?.is_active && !form.is_active) {
    warnings.push(
      "You are removing active status from the current active event. Make sure another event is active afterwards."
    );
  }

  if (!form.venue_name.trim() || !form.venue_address.trim()) {
    warnings.push(
      "Venue details are not complete. Other pages may show missing venue information."
    );
  }

  return warnings;
}

export default function BurtonPrideEventManagementPage() {
  const { currentEvent, refreshEvent } = useBurtonPrideEvent();

  const [events, setEvents] = useState<BurtonPrideEvent[]>([]);
  const [form, setForm] = useState<FormState>(() => getEmptyForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | EventStatus>("all");
  const [showArchived, setShowArchived] = useState(false);

  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");

  const noticeRef = useRef<HTMLDivElement | null>(null);

  const editingEvent = useMemo(
    () => events.find((event) => event.id === editingId) || null,
    [editingId, events]
  );

  const isBusy = saving || Boolean(actionLoadingId);

  const formWarnings = useMemo(
    () => getFormWarnings(form, editingEvent),
    [form, editingEvent]
  );

  const sortedEvents = useMemo(() => {
    return [...events].sort((a, b) => {
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1;
      if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
      return b.event_year - a.event_year;
    });
  }, [events]);

  const visibleEvents = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return sortedEvents.filter((event) => {
      if (!showArchived && event.is_archived) return false;
      if (statusFilter !== "all" && event.status !== statusFilter) return false;

      if (!search) return true;

      const haystack = [
        event.event_name,
        event.event_year,
        event.event_date,
        event.venue_name,
        event.venue_address,
        event.theme,
        event.status,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [searchTerm, showArchived, sortedEvents, statusFilter]);

  const activeEventInList = useMemo(
    () => events.find((event) => event.is_active && !event.is_archived) || null,
    [events]
  );

  const loadEvents = useCallback(
    async (options?: {
      signal?: AbortSignal;
      silent?: boolean;
      suppressNotice?: boolean;
    }) => {
      try {
        if (!options?.silent) setLoading(true);
        if (!options?.suppressNotice) setNotice(null);

        const res = await fetch(EVENTS_API, {
          cache: "no-store",
          credentials: "include",
          signal: options?.signal,
        });

        const data = await readJson(res);

        if (options?.signal?.aborted) return false;

        if (!res.ok || !data.ok) {
          if (!options?.suppressNotice) {
            setNotice(makeDetailedErrorMessage("Load events", res, data));
          }
          return false;
        }

        setEvents(data.events || []);
        return true;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return false;
        }

        if (!options?.suppressNotice) {
          setNotice(makeUnknownError("Load events", error));
        }
        return false;
      } finally {
        if (!options?.signal?.aborted && !options?.silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadEvents({ signal: controller.signal });

    return () => controller.abort();
  }, [loadEvents]);

  useEffect(() => {
    if (!notice) return;

    noticeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [notice]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(getEmptyForm());
    setEditingId(null);
  }

  function createNextEventAsActive() {
    setEditingId(null);
    setForm({ ...getEmptyForm(), is_active: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEdit(event: BurtonPrideEvent) {
    if (event.is_locked) {
      setNotice({
        type: "warning",
        title: "Event is locked",
        message: "Unlock this event before editing its details.",
        details: [
          `${event.event_name} ${event.event_year} is currently locked.`,
          "Use the Unlock action first if the committee team needs to make changes.",
        ],
      });
      return;
    }

    if (event.is_archived) {
      setNotice({
        type: "warning",
        title: "Event is archived",
        message: "Restore this event before editing its details.",
      });
      return;
    }

    setEditingId(event.id);
    setForm(toForm(event));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveEvent() {
    try {
      setSaving(true);
      setNotice(null);

      const validationErrors = validateEventForm(form, editingEvent);
      if (validationErrors.length > 0) {
        throw new Error(validationErrors.join("\n"));
      }

      const year = Number(form.event_year);

      const payload = {
        id: editingId || undefined,
        event_name: form.event_name.trim(),
        event_year: year,
        event_date: form.event_date || null,
        event_start_time: form.event_start_time || null,
        event_end_time: form.event_end_time || null,
        setup_start_time: form.setup_start_time || null,
        venue_name: form.venue_name.trim() || null,
        venue_address: form.venue_address.trim() || null,
        theme: form.theme.trim() || null,
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
        setNotice(
          makeDetailedErrorMessage(
            editingId ? "Update event" : "Create event",
            res,
            data
          )
        );
        return;
      }

      resetForm();

      const reloadOk = await loadEvents({ silent: true, suppressNotice: true });
      let providerRefreshOk = true;

      try {
        await refreshEvent();
      } catch {
        providerRefreshOk = false;
      }

      const refreshDetails: string[] = [];
      if (!reloadOk) {
        refreshDetails.push(
          "The event saved, but the event list could not refresh automatically. Press Refresh."
        );
      }
      if (!providerRefreshOk) {
        refreshDetails.push(
          "The event saved, but the Event Hub provider did not refresh automatically. Refresh the page if other Event Hub pages still show old data."
        );
      }

      setNotice({
        type: "success",
        title: editingId ? "Event updated" : "Event created",
        message: editingId
          ? "Event updated successfully."
          : "Event created successfully.",
        details: refreshDetails.length > 0 ? refreshDetails : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setNotice({
        type: "error",
        title: editingId ? "Update event failed" : "Create event failed",
        message: message.split("\n")[0],
        details: message.includes("\n") ? message.split("\n").slice(1) : undefined,
      });
    } finally {
      setSaving(false);
    }
  }

  function openActionModal(event: BurtonPrideEvent, action: EventAction) {
    setNotice(null);
    setPendingAction({ event, action });
    setConfirmPassword("");
    setShowConfirmPassword(false);
    setDeleteConfirmText("");
  }

  function closeActionModal() {
    if (actionLoadingId) return;

    setPendingAction(null);
    setConfirmPassword("");
    setShowConfirmPassword(false);
    setDeleteConfirmText("");
  }

  async function confirmEventAction() {
    if (!pendingAction) return;

    const { event, action } = pendingAction;

    try {
      setActionLoadingId(`${event.id}:${action}`);
      setNotice(null);

      if (isProtectedAction(action) && !confirmPassword.trim()) {
        throw new Error("Please enter the main admin password before doing this action.");
      }

      if (action === "delete") {
        const requiredText = getDeleteConfirmText(event);
        if (deleteConfirmText.trim() !== requiredText) {
          throw new Error(`Please type ${requiredText} to confirm deletion.`);
        }
      }

      const res = await fetch(`${EVENTS_API}/${event.id}/actions`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          main_admin_password: confirmPassword.trim() || undefined,
        }),
      });

      const data = await readJson(res);

      if (!res.ok || !data.ok) {
        setNotice(makeDetailedErrorMessage(`Event action: ${action}`, res, data));
        return;
      }

      setPendingAction(null);
      setConfirmPassword("");
      setShowConfirmPassword(false);
      setDeleteConfirmText("");

      const reloadOk = await loadEvents({ silent: true, suppressNotice: true });
      let providerRefreshOk = true;

      try {
        await refreshEvent();
      } catch {
        providerRefreshOk = false;
      }

      const refreshDetails: string[] = [];
      if (!reloadOk) {
        refreshDetails.push(
          "The action completed, but the event list could not refresh automatically. Press Refresh."
        );
      }
      if (!providerRefreshOk) {
        refreshDetails.push(
          "The action completed, but the Event Hub provider did not refresh automatically. Refresh the page if other Event Hub pages still show old data."
        );
      }

      setNotice({
        type: "success",
        title: `${getActionLabel(action)} complete`,
        message: `${getActionLabel(action)} action completed successfully.`,
        details: refreshDetails.length > 0 ? refreshDetails : undefined,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Something went wrong.";
      setNotice({
        type: "error",
        title: `${getActionLabel(action)} failed`,
        message,
      });
    } finally {
      setActionLoadingId(null);
    }
  }

  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top,_rgba(236,72,153,0.18),_transparent_32%),linear-gradient(180deg,#12091f_0%,#24113a_48%,#111827_100%)] p-4 text-white md:p-6">
      <div className="w-full">
        <div className="mb-6 rounded-[32px] border border-white/10 bg-white/10 p-6 shadow-2xl backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-400/30 bg-pink-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-pink-100">
                <CalendarDays className="h-4 w-4" />
                Burton Pride Event Hub
              </div>

              <h1 className="text-3xl font-extrabold tracking-tight">
                Event Management
              </h1>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-white/70">
                Manage the base event record used across the whole Event Hub.
                The active event controls the year, date, venue, lock status and
                event context every page should use automatically.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEvents()}
              disabled={loading || isBusy}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-sm font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div ref={noticeRef} aria-live="polite" aria-atomic="true">
          {notice && <NoticeBox notice={notice} onClose={() => setNotice(null)} />}
        </div>

        {!currentEvent && !activeEventInList && !loading && (
          <NoActiveEventWarning onCreate={createNextEventAsActive} />
        )}

        {(currentEvent || activeEventInList) && (
          <ActiveEventBanner event={currentEvent || activeEventInList} />
        )}

        <div className="grid w-full gap-6 xl:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void saveEvent();
            }}
            className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl"
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">
                  {editingId ? "Edit event" : "Create event"}
                </h2>
                <p className="mt-1 text-sm text-white/55">
                  {editingId
                    ? "Update the selected Event Hub event. Locked or archived events must be unlocked/restored first."
                    : "Create a new Event Hub event and choose whether it should become active."}
                </p>
              </div>

              {editingId && (
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isBusy}
                  className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  New event
                </button>
              )}
            </div>

            <div className="grid gap-4">
              <Input
                label="Event name"
                value={form.event_name}
                onChange={(value) => updateForm("event_name", value)}
                required
              />

              <Input
                label="Event year"
                type="number"
                inputMode="numeric"
                min="2024"
                max="2100"
                value={form.event_year}
                onChange={(value) => updateForm("event_year", value)}
                required
              />

              <Input
                label="Event date"
                type="date"
                value={form.event_date}
                onChange={(value) => updateForm("event_date", value)}
                required
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Setup starts"
                  type="time"
                  value={form.setup_start_time}
                  onChange={(value) => updateForm("setup_start_time", value)}
                />

                <Input
                  label="Public opens"
                  type="time"
                  value={form.event_start_time}
                  onChange={(value) => updateForm("event_start_time", value)}
                />

                <Input
                  label="Public closes"
                  type="time"
                  value={form.event_end_time}
                  onChange={(value) => updateForm("event_end_time", value)}
                />
              </div>

              <Input
                label="Venue name"
                value={form.venue_name}
                onChange={(value) => updateForm("venue_name", value)}
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/75">
                  Venue address
                </label>
                <textarea
                  value={form.venue_address}
                  onChange={(event) => updateForm("venue_address", event.target.value)}
                  placeholder="Venue address"
                  rows={3}
                  className="w-full resize-none rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-pink-300/50"
                />
              </div>

              <Input
                label="Theme"
                value={form.theme}
                onChange={(value) => updateForm("theme", value)}
              />

              <div>
                <label className="mb-2 block text-sm font-semibold text-white/75">
                  Status
                </label>
                <select
                  value={form.status}
                  onChange={(event) =>
                    updateForm("status", event.target.value as EventStatus)
                  }
                  className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none focus:border-pink-300/50"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} className="bg-[#1f1030]" value={status}>
                      {formatStatus(status)}
                    </option>
                  ))}
                </select>
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm font-semibold">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => updateForm("is_active", event.target.checked)}
                  className="h-4 w-4 accent-pink-400"
                />
                Make this the active Event Hub event
              </label>

              {formWarnings.length > 0 && (
                <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
                  <p className="mb-2 font-black">Before saving</p>
                  <ul className="grid gap-1 text-xs leading-5 text-amber-50/85">
                    {formWarnings.map((warning) => (
                      <li key={warning}>• {warning}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={saving || Boolean(actionLoadingId)}
                  className="inline-flex items-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-black hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : editingId ? "Update event" : "Create event"}
                </button>

                <button
                  type="button"
                  onClick={resetForm}
                  disabled={isBusy}
                  className="inline-flex items-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <X className="h-4 w-4" />
                  Clear
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-[32px] border border-white/10 bg-white/10 p-5 shadow-xl backdrop-blur-xl">
            <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div>
                <h2 className="text-xl font-bold">Burton Pride events</h2>
                <p className="mt-1 text-sm text-white/60">
                  Choose the active event the whole Event Hub should use.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3 xl:w-[620px]">
                <div className="relative sm:col-span-1 xl:col-span-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <input
                    type="search"
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search events"
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm outline-none placeholder:text-white/35 focus:border-pink-300/50"
                  />
                </div>

                <div className="relative">
                  <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
                  <select
                    value={statusFilter}
                    onChange={(event) =>
                      setStatusFilter(event.target.value as "all" | EventStatus)
                    }
                    className="w-full rounded-2xl border border-white/10 bg-black/20 py-3 pl-10 pr-3 text-sm outline-none focus:border-pink-300/50"
                  >
                    <option className="bg-[#1f1030]" value="all">
                      All statuses
                    </option>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} className="bg-[#1f1030]" value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                </div>

                <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-black/20 px-3 py-3 text-sm font-bold text-white/75 hover:bg-white/10">
                  <input
                    type="checkbox"
                    checked={showArchived}
                    onChange={(event) => setShowArchived(event.target.checked)}
                    className="h-4 w-4 accent-pink-400"
                  />
                  Show archived
                </label>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-black/20 p-5 text-sm text-white/60">
                Loading events...
              </div>
            ) : events.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">
                No events have been created yet.
              </div>
            ) : visibleEvents.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-8 text-center text-white/60">
                No events match your filters.
              </div>
            ) : (
              <div className="grid gap-4">
                {visibleEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    actionLoadingId={actionLoadingId}
                    disableActions={isBusy}
                    onEdit={() => startEdit(event)}
                    onAction={(action) => openActionModal(event, action)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {pendingAction && (
        <ActionConfirmModal
          pendingAction={pendingAction}
          password={confirmPassword}
          showPassword={showConfirmPassword}
          deleteConfirmText={deleteConfirmText}
          loading={actionLoadingId === `${pendingAction.event.id}:${pendingAction.action}`}
          onPasswordChange={setConfirmPassword}
          onTogglePassword={() => setShowConfirmPassword((prev) => !prev)}
          onDeleteConfirmTextChange={setDeleteConfirmText}
          onClose={closeActionModal}
          onConfirm={() => void confirmEventAction()}
        />
      )}
    </div>
  );
}

function NoActiveEventWarning({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mb-6 rounded-[28px] border border-amber-400/25 bg-amber-500/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-3">
          <div className="rounded-2xl bg-amber-500/15 p-2 text-amber-100">
            <AlertTriangle className="h-5 w-5" />
          </div>

          <div>
            <h2 className="text-xl font-black text-amber-50">
              No active Event Hub event selected
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-50/80">
              Other Event Hub pages may not know which year, date or venue to
              use. Create or set one active event before using the wider Event
              Hub.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-black text-black hover:opacity-90"
        >
          <Star className="h-4 w-4" />
          Create active event
        </button>
      </div>
    </div>
  );
}

function ActiveEventBanner({ event }: { event: BurtonPrideEvent | null }) {
  if (!event) return null;

  return (
    <div className="mb-6 rounded-[28px] border border-emerald-400/25 bg-emerald-500/10 p-5 shadow-xl backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-emerald-100">
            <Star className="h-4 w-4" /> Active event
          </div>

          <h2 className="text-2xl font-black">
            {event.event_name} {event.event_year}
          </h2>

          <p className="mt-1 text-sm text-emerald-100/80">
            {event.event_date || "No date set"} · {event.event_start_time || "No start"} - {event.event_end_time || "No end"} · {event.venue_name || "No venue set"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {event.is_locked ? (
            <StatusIcon type="locked" label="Locked" />
          ) : (
            <StatusIcon type="open" label="Open" />
          )}
          {event.is_archived ? <StatusIcon type="archived" label="Archived" /> : null}
          <StatusIcon type="status" label={formatStatus(event.status)} />
        </div>
      </div>
    </div>
  );
}

function NoticeBox({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const isSuccess = notice.type === "success";
  const isWarning = notice.type === "warning";

  const className = isSuccess
    ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100"
    : isWarning
    ? "border-amber-400/30 bg-amber-500/10 text-amber-100"
    : "border-red-400/30 bg-red-500/10 text-red-100";

  return (
    <div className={`mb-6 rounded-3xl border p-5 text-sm shadow-xl ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div
            className={`rounded-2xl p-2 ${
              isSuccess
                ? "bg-emerald-500/15"
                : isWarning
                ? "bg-amber-500/15"
                : "bg-red-500/15"
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
              {notice.title ||
                (isSuccess
                  ? "Success"
                  : isWarning
                  ? "Check this first"
                  : "Something went wrong")}
            </p>

            <p className="mt-1 whitespace-pre-line font-semibold leading-6">
              {notice.message}
            </p>

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
  disableActions,
  onEdit,
  onAction,
}: {
  event: BurtonPrideEvent;
  actionLoadingId: string | null;
  disableActions: boolean;
  onEdit: () => void;
  onAction: (action: EventAction) => void;
}) {
  const loading = (action: EventAction) => actionLoadingId === `${event.id}:${action}`;
  const editDisabled = disableActions || event.is_locked || event.is_archived;

  return (
    <div
      className={`rounded-3xl border p-5 ${
        event.is_active
          ? "border-emerald-400/25 bg-emerald-500/10"
          : "border-white/10 bg-black/20"
      }`}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-extrabold">
              {event.event_name} {event.event_year}
            </h3>
            {event.is_active ? <StatusIcon type="active" label="Active" /> : null}
            {event.is_locked ? (
              <StatusIcon type="locked" label="Locked" />
            ) : (
              <StatusIcon type="open" label="Open" />
            )}
            {event.is_archived ? <StatusIcon type="archived" label="Archived" /> : null}
            <StatusIcon type="status" label={formatStatus(event.status)} />
          </div>

          <div className="mt-4 grid gap-3 text-sm text-white/70 md:grid-cols-2">
            <InfoItem label="Date" value={event.event_date || "Not set"} />
            <InfoItem
              label="Public"
              value={`${event.event_start_time || "Not set"} - ${event.event_end_time || "Not set"}`}
            />
            <InfoItem label="Setup" value={event.setup_start_time || "Not set"} />
            <InfoItem label="Theme" value={event.theme || "Not set"} />
            <InfoItem label="Venue" value={event.venue_name || "Not set"} wide />
            <InfoItem label="Address" value={event.venue_address || "Not set"} wide />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 lg:justify-end">
          <button
            type="button"
            onClick={onEdit}
            disabled={editDisabled}
            title={
              event.is_locked
                ? "Unlock this event before editing"
                : event.is_archived
                ? "Restore this event before editing"
                : "Edit event"
            }
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-3 py-2 text-xs font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Edit className="h-4 w-4" /> Edit
          </button>

          {!event.is_active && !event.is_archived && (
            <button
              type="button"
              onClick={() => onAction("set_active")}
              disabled={disableActions || loading("set_active")}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Star className="h-4 w-4" />
              {loading("set_active") ? "Setting..." : "Set active"}
            </button>
          )}

          {event.is_locked ? (
            <button
              type="button"
              onClick={() => onAction("unlock")}
              disabled={disableActions || loading("unlock")}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/10 px-3 py-2 text-xs font-bold text-amber-100 hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Unlock className="h-4 w-4" />
              {loading("unlock") ? "Unlocking..." : "Unlock"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAction("lock")}
              disabled={disableActions || loading("lock") || event.is_archived}
              className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Lock className="h-4 w-4" />
              {loading("lock") ? "Locking..." : "Lock"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onAction("clone")}
            disabled={disableActions || loading("clone")}
            className="inline-flex items-center gap-2 rounded-xl border border-sky-400/20 bg-sky-500/10 px-3 py-2 text-xs font-bold text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Copy className="h-4 w-4" />
            {loading("clone") ? "Cloning..." : "Clone"}
          </button>

          {event.is_archived ? (
            <button
              type="button"
              onClick={() => onAction("restore")}
              disabled={disableActions || loading("restore")}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/20 bg-violet-500/10 px-3 py-2 text-xs font-bold text-violet-100 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {loading("restore") ? "Restoring..." : "Restore"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAction("archive")}
              disabled={disableActions || loading("archive")}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {loading("archive") ? "Archiving..." : "Archive"}
            </button>
          )}

          <button
            type="button"
            onClick={() => onAction("delete")}
            disabled={disableActions || loading("delete")}
            className="inline-flex items-center gap-2 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-100 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            {loading("delete") ? "Deleting..." : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoItem({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <p className={wide ? "md:col-span-2" : undefined}>
      <span className="font-bold text-white/85">{label}:</span> {value}
    </p>
  );
}

function ActionConfirmModal({
  pendingAction,
  password,
  showPassword,
  deleteConfirmText,
  loading,
  onPasswordChange,
  onTogglePassword,
  onDeleteConfirmTextChange,
  onClose,
  onConfirm,
}: {
  pendingAction: PendingAction;
  password: string;
  showPassword: boolean;
  deleteConfirmText: string;
  loading: boolean;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onDeleteConfirmTextChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { event, action } = pendingAction;
  const actionCopy = getActionCopy(action, event);
  const needsPassword = isProtectedAction(action);
  const requiredDeleteText = getDeleteConfirmText(event);
  const deleteTextMatches =
    action !== "delete" || deleteConfirmText.trim() === requiredDeleteText;
  const passwordReady = !needsPassword || password.trim().length > 0;
  const canConfirm = passwordReady && deleteTextMatches && !loading;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[32px] border border-white/10 bg-[#1b1029] p-5 text-white shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div
              className={`rounded-2xl p-2 ${
                actionCopy.danger
                  ? "bg-red-500/15 text-red-100"
                  : "bg-emerald-500/15 text-emerald-100"
              }`}
            >
              {actionCopy.danger ? (
                <AlertTriangle className="h-5 w-5" />
              ) : (
                <ShieldCheck className="h-5 w-5" />
              )}
            </div>

            <div>
              <h2 className="text-xl font-black">{actionCopy.title}</h2>
              <p className="mt-2 text-sm leading-6 text-white/70">
                {actionCopy.message}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="rounded-xl border border-white/10 p-2 text-white/70 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close confirmation modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
          <div className="grid gap-2 text-white/75 sm:grid-cols-2">
            <InfoItem label="Event" value={`${event.event_name} ${event.event_year}`} />
            <InfoItem label="Status" value={formatStatus(event.status)} />
            <InfoItem label="Date" value={event.event_date || "Not set"} />
            <InfoItem
              label="Active"
              value={event.is_active ? "Yes" : "No"}
            />
          </div>
        </div>

        {event.is_active && ["archive", "delete"].includes(action) && (
          <div className="mt-4 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
            <p className="font-black">This is currently the active event.</p>
            <p className="mt-1 leading-6 text-red-50/80">
              Archiving or deleting it may leave the Event Hub without an active
              event until another one is selected.
            </p>
          </div>
        )}

        {needsPassword && (
          <div className="mt-4">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-amber-100">
              Main admin password
            </label>

            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => onPasswordChange(event.target.value)}
                placeholder="Enter main admin password"
                className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 pr-12 text-sm outline-none placeholder:text-white/35 focus:border-amber-300/50"
              />

              <button
                type="button"
                onClick={onTogglePassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
                title={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {action === "delete" && (
          <div className="mt-4">
            <label className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-red-100">
              Confirm deletion
            </label>
            <p className="mb-2 text-xs leading-5 text-white/60">
              Type <span className="font-black text-white">{requiredDeleteText}</span> to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(event) => onDeleteConfirmTextChange(event.target.value)}
              placeholder={requiredDeleteText}
              className="w-full rounded-2xl border border-red-400/20 bg-black/25 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-red-300/50"
            />
          </div>
        )}

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 px-5 py-3 text-sm font-bold hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black disabled:cursor-not-allowed disabled:opacity-50 ${
              actionCopy.danger
                ? "bg-red-500 text-white hover:bg-red-400"
                : "bg-white text-black hover:opacity-90"
            }`}
          >
            {loading ? "Working..." : actionCopy.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusIcon({
  type,
  label,
}: {
  type: "active" | "locked" | "open" | "archived" | "status";
  label: string;
}) {
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
    type === "active" ? (
      <Star className="h-3.5 w-3.5" />
    ) : type === "locked" ? (
      <Lock className="h-3.5 w-3.5" />
    ) : type === "open" ? (
      <CheckCircle2 className="h-3.5 w-3.5" />
    ) : type === "archived" ? (
      <AlertTriangle className="h-3.5 w-3.5" />
    ) : (
      <CalendarDays className="h-3.5 w-3.5" />
    );

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${className}`}
    >
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
  inputMode,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  type?: string;
  inputMode?: "text" | "numeric" | "decimal" | "tel" | "search" | "email" | "url";
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-semibold text-white/75">
        {label}
        {required ? <span className="text-red-300"> *</span> : null}
      </label>
      <input
        type={type}
        inputMode={inputMode}
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder || label}
        className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm outline-none placeholder:text-white/35 focus:border-pink-300/50"
      />
    </div>
  );
}
