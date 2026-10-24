"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
  Wrench,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

type RequestStatus =
  | "pending"
  | "approved"
  | "in_progress"
  | "on_hold"
  | "completed"
  | "rejected";

type RequestPriority = "low" | "normal" | "high" | "critical";

type DevelopmentRequest = {
  id: string;
  title: string;
  description: string;
  application: string | null;

  status: RequestStatus;
  priority: RequestPriority;

  requested_by_name: string | null;
  requested_by_email: string | null;

  assigned_admin_id: string | null;
  assigned_admin_name: string | null;
  assigned_admin_email: string | null;

  admin_notes: string | null;

  created_at: string;
  updated_at: string | null;
  completed_at?: string | null;
};

type AdminUser = {
  id: string;
  name: string | null;
  email: string;
  role?: string | null;
};

type HistoryItem = {
  id: string;
  action: string;
  description: string | null;
  admin_name: string | null;
  admin_email: string | null;
  created_at: string;
};

type ApiResponse = {
  request: DevelopmentRequest;
  admins?: AdminUser[];
  history?: HistoryItem[];
};

const statusOptions: Array<{
  value: RequestStatus;
  label: string;
}> = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "in_progress", label: "In Progress" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

const priorityOptions: Array<{
  value: RequestPriority;
  label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

function formatDate(value?: string | null) {
  if (!value) return "Not available";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not available";
  }

  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function statusLabel(status: RequestStatus) {
  return (
    statusOptions.find((item) => item.value === status)?.label ?? status
  );
}

function priorityLabel(priority: RequestPriority) {
  return (
    priorityOptions.find((item) => item.value === priority)?.label ?? priority
  );
}

function statusClasses(status: RequestStatus) {
  switch (status) {
    case "completed":
      return "border-emerald-400/30 bg-emerald-500/15 text-emerald-200";
    case "in_progress":
      return "border-blue-400/30 bg-blue-500/15 text-blue-200";
    case "approved":
      return "border-violet-400/30 bg-violet-500/15 text-violet-200";
    case "on_hold":
      return "border-amber-400/30 bg-amber-500/15 text-amber-200";
    case "rejected":
      return "border-red-400/30 bg-red-500/15 text-red-200";
    default:
      return "border-zinc-400/30 bg-zinc-500/15 text-zinc-200";
  }
}

function priorityClasses(priority: RequestPriority) {
  switch (priority) {
    case "critical":
      return "border-red-400/30 bg-red-500/15 text-red-200";
    case "high":
      return "border-orange-400/30 bg-orange-500/15 text-orange-200";
    case "normal":
      return "border-blue-400/30 bg-blue-500/15 text-blue-200";
    default:
      return "border-zinc-400/30 bg-zinc-500/15 text-zinc-200";
  }
}

export default function DevelopmentRequestDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const requestId = params?.id;

  const [request, setRequest] =
    useState<DevelopmentRequest | null>(null);

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  const [status, setStatus] =
    useState<RequestStatus>("pending");

  const [priority, setPriority] =
    useState<RequestPriority>("normal");

  const [assignedAdminId, setAssignedAdminId] =
    useState("");

  const [adminNotes, setAdminNotes] =
    useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] =
    useState("");

  const fetchRequest = useCallback(async () => {
    if (!requestId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/developmentrequests/${requestId}`,
        {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(
            "This development request could not be found."
          );
        }

        if (response.status === 401) {
          throw new Error(
            "Your admin session has expired. Please sign in again."
          );
        }

        throw new Error(
          data?.error ||
            "Unable to load this development request."
        );
      }

      const payload = data as ApiResponse;

      setRequest(payload.request);
      setAdmins(payload.admins ?? []);
      setHistory(payload.history ?? []);

      setStatus(payload.request.status);
      setPriority(payload.request.priority);
      setAssignedAdminId(
        payload.request.assigned_admin_id ?? ""
      );
      setAdminNotes(payload.request.admin_notes ?? "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this development request."
      );
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    fetchRequest();
  }, [fetchRequest]);

  const hasChanges = useMemo(() => {
    if (!request) return false;

    return (
      status !== request.status ||
      priority !== request.priority ||
      assignedAdminId !==
        (request.assigned_admin_id ?? "") ||
      adminNotes !== (request.admin_notes ?? "")
    );
  }, [
    request,
    status,
    priority,
    assignedAdminId,
    adminNotes,
  ]);

  async function saveChanges() {
    if (!requestId || !request || !hasChanges) {
      return;
    }

    setSaving(true);
    setError("");
    setSuccessMessage("");

    try {
      const response = await fetch(
        `/api/admin/developmentrequests/${requestId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            status,
            priority,
            assigned_admin_id:
              assignedAdminId || null,
            admin_notes: adminNotes.trim() || null,
          }),
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error(
            "Your admin session has expired. Please sign in again."
          );
        }

        throw new Error(
          data?.error ||
            "Unable to update this development request."
        );
      }

      setSuccessMessage(
        "Development request updated successfully."
      );

      await fetchRequest();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this development request."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080812] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[60vh] max-w-[1600px] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4">
            <Loader2 className="h-5 w-5 animate-spin text-fuchsia-300" />
            <span className="text-sm text-white/80">
              Loading development request...
            </span>
          </div>
        </div>
      </main>
    );
  }

  if (error && !request) {
    return (
      <main className="min-h-screen bg-[#080812] px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/Admin/Dashboard/Settings/DevelopmentRequests/"
            className="mb-6 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Development Requests
          </Link>

          <div className="rounded-3xl border border-red-400/20 bg-red-500/10 p-8">
            <CircleAlert className="mb-4 h-10 w-10 text-red-300" />

            <h1 className="text-2xl font-bold">
              Unable to open request
            </h1>

            <p className="mt-2 text-white/70">
              {error}
            </p>

            <button
              type="button"
              onClick={fetchRequest}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 font-semibold text-black transition hover:bg-white/90"
            >
              <RefreshCw className="h-4 w-4" />
              Try again
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!request) {
    return null;
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#080812] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10%] top-[-5%] h-[500px] w-[500px] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute right-[-8%] top-[20%] h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[120px]" />
        <div className="absolute bottom-[-20%] left-[30%] h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-[1700px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <Link
            href="/Admin/Dashboard/Settings/DevelopmentRequests"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Development Requests
          </Link>

          <button
            type="button"
            onClick={fetchRequest}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/[0.045] p-6 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClasses(
                    request.status
                  )}`}
                >
                  {statusLabel(request.status)}
                </span>

                <span
                  className={`rounded-full border px-3 py-1 text-xs font-bold ${priorityClasses(
                    request.priority
                  )}`}
                >
                  {priorityLabel(request.priority)} Priority
                </span>
              </div>

              <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl">
                {request.title}
              </h1>

              <p className="mt-3 break-all font-mono text-xs text-white/40">
                Request ID: {request.id}
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/40">
                Last updated
              </p>

              <p className="mt-1 text-sm font-medium text-white/80">
                {formatDate(
                  request.updated_at ?? request.created_at
                )}
              </p>
            </div>
          </div>
        </section>

        {successMessage && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-5 py-4 text-emerald-100">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                Update saved
              </p>
              <p className="mt-0.5 text-sm text-emerald-100/70">
                {successMessage}
              </p>
            </div>
          </div>
        )}

        {error && request && (
          <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-400/20 bg-red-500/10 px-5 py-4 text-red-100">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                Something went wrong
              </p>
              <p className="mt-0.5 text-sm text-red-100/70">
                {error}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(380px,0.75fr)]">
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-fuchsia-500/10 p-2.5 text-fuchsia-300">
                  <Wrench className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    Request Details
                  </h2>
                  <p className="text-sm text-white/50">
                    Original development request information.
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                    Description
                  </p>

                  <div className="whitespace-pre-wrap break-words rounded-2xl border border-white/10 bg-black/20 p-5 text-sm leading-7 text-white/80">
                    {request.description || "No description provided."}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                      Application / System
                    </p>

                    <p className="mt-2 font-semibold">
                      {request.application || "Not specified"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                      Submitted
                    </p>

                    <p className="mt-2 font-semibold">
                      {formatDate(request.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-300">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    Requested By
                  </h2>
                  <p className="text-sm text-white/50">
                    Person who submitted this request.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                    Name
                  </p>
                  <p className="mt-2 font-semibold">
                    {request.requested_by_name ||
                      "Not provided"}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/20 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-white/40">
                    Email
                  </p>
                  <p className="mt-2 break-all font-semibold">
                    {request.requested_by_email ||
                      "Not provided"}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl sm:p-7">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-violet-500/10 p-2.5 text-violet-300">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    Request History
                  </h2>
                  <p className="text-sm text-white/50">
                    Updates and changes made to this request.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-8 text-center">
                  <Clock3 className="mx-auto h-8 w-8 text-white/25" />
                  <p className="mt-3 font-semibold text-white/70">
                    No history recorded yet
                  </p>
                  <p className="mt-1 text-sm text-white/40">
                    Updates will appear here when changes are made.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-white/10 bg-black/20 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="font-semibold">
                            {item.action}
                          </p>

                          {item.description && (
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-white/60">
                              {item.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs text-white/40">
                            By{" "}
                            {item.admin_name ||
                              item.admin_email ||
                              "Admin"}
                          </p>
                        </div>

                        <span className="shrink-0 text-xs text-white/40">
                          {formatDate(item.created_at)}
                        </span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-3xl border border-fuchsia-400/15 bg-white/[0.055] p-6 shadow-xl shadow-fuchsia-950/10 backdrop-blur-xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="rounded-xl bg-fuchsia-500/10 p-2.5 text-fuchsia-300">
                  <ShieldCheck className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="text-xl font-bold">
                    Manage Request
                  </h2>
                  <p className="text-sm text-white/50">
                    Admin-only controls.
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Status
                  </label>

                  <select
                    value={status}
                    onChange={(event) =>
                      setStatus(
                        event.target.value as RequestStatus
                      )
                    }
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#11111d] px-4 text-sm font-medium text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20"
                  >
                    {statusOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Priority
                  </label>

                  <select
                    value={priority}
                    onChange={(event) =>
                      setPriority(
                        event.target
                          .value as RequestPriority
                      )
                    }
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#11111d] px-4 text-sm font-medium text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20"
                  >
                    {priorityOptions.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Assigned Admin
                  </label>

                  <select
                    value={assignedAdminId}
                    onChange={(event) =>
                      setAssignedAdminId(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#11111d] px-4 text-sm font-medium text-white outline-none transition focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20"
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {admins.map((admin) => (
                      <option
                        key={admin.id}
                        value={admin.id}
                      >
                        {admin.name ||
                          admin.email}
                        {admin.role
                          ? ` — ${admin.role}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-white/80">
                    Admin Notes
                  </label>

                  <textarea
                    value={adminNotes}
                    onChange={(event) =>
                      setAdminNotes(event.target.value)
                    }
                    rows={8}
                    placeholder="Add internal notes, progress updates or implementation details..."
                    className="w-full resize-y rounded-xl border border-white/10 bg-[#11111d] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-white/30 focus:border-fuchsia-400/50 focus:ring-2 focus:ring-fuchsia-500/20"
                  />
                </div>

                <button
                  type="button"
                  onClick={saveChanges}
                  disabled={!hasChanges || saving}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-violet-600 px-5 font-bold text-white shadow-lg shadow-fuchsia-950/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-5 w-5" />
                      Save Changes
                    </>
                  )}
                </button>

                {hasChanges && (
                  <p className="text-center text-xs text-amber-200/70">
                    You have unsaved changes.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.045] p-6 backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-blue-300" />
                <h2 className="font-bold">
                  Request Information
                </h2>
              </div>

              <dl className="space-y-4 text-sm">
                <div>
                  <dt className="text-white/40">
                    Created
                  </dt>
                  <dd className="mt-1 font-medium text-white/80">
                    {formatDate(request.created_at)}
                  </dd>
                </div>

                <div>
                  <dt className="text-white/40">
                    Last Updated
                  </dt>
                  <dd className="mt-1 font-medium text-white/80">
                    {formatDate(request.updated_at)}
                  </dd>
                </div>

                {request.completed_at && (
                  <div>
                    <dt className="text-white/40">
                      Completed
                    </dt>
                    <dd className="mt-1 font-medium text-white/80">
                      {formatDate(
                        request.completed_at
                      )}
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-white/40">
                    Current Assignee
                  </dt>
                  <dd className="mt-1 font-medium text-white/80">
                    {request.assigned_admin_name ||
                      request.assigned_admin_email ||
                      "Unassigned"}
                  </dd>
                </div>
              </dl>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}