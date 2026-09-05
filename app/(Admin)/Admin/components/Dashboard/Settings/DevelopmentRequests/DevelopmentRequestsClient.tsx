"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  AppWindow,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Code2,
  FilePlus2,
  Filter,
  Layers3,
  Loader2,
  Mail,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";

type RequestType = "feature" | "new_app";

type RequestPriority = "low" | "normal" | "high" | "urgent";

type RequestStatus =
  | "submitted"
  | "under_review"
  | "approved"
  | "planned"
  | "in_development"
  | "testing"
  | "completed"
  | "on_hold"
  | "rejected";

type DevelopmentRequest = {
  id: string;
  reference_number: string;
  request_type: RequestType;
  title: string;
  application: string | null;
  description: string;
  requested_by_name: string | null;
  requested_by_email: string | null;
  priority: RequestPriority;
  status: RequestStatus;
  assigned_to_name: string | null;
  target_date: string | null;
  created_at: string;
  updated_at: string;
};

type EmailDeliveryResult = {
  attempted: boolean;
  sent: boolean;
  recipient: string | null;
  email_id: string | null;
  error: string | null;
};

type SubmitSuccess = {
  reference: string;
  message: string;
  internal: EmailDeliveryResult | null;
  requester: EmailDeliveryResult | null;
  allSent: boolean;
};

type CreateRequestForm = {
  request_type: RequestType;
  application: string;
  title: string;
  description: string;
  reason_needed: string;
  problem_solved: string;
  users_affected: string;
  priority: RequestPriority;
  example_workflow: string;

  app_name: string;
  required_pages: string;
  permissions_required: string;
  needs_sidebar: boolean;
  connects_to_other_apps: boolean;
  connected_apps: string;
  needs_public_pages: boolean;
  reporting_requirements: string;
};

const APPLICATIONS = [
  "Admin Portal",
  "Email Hub",
  "Money Management",
  "Stock Management",
  "Event Hub",
  "Lottery Management",
  "Bug Tracker",
  "Website Management",
  "Other",
];

const STATUS_OPTIONS: Array<{
  value: RequestStatus | "all";
  label: string;
}> = [
  { value: "all", label: "All statuses" },
  { value: "submitted", label: "Submitted" },
  { value: "under_review", label: "Under Review" },
  { value: "approved", label: "Approved" },
  { value: "planned", label: "Planned" },
  { value: "in_development", label: "In Development" },
  { value: "testing", label: "Testing" },
  { value: "completed", label: "Completed" },
  { value: "on_hold", label: "On Hold" },
  { value: "rejected", label: "Rejected" },
];



const INITIAL_FORM: CreateRequestForm = {
  request_type: "feature",
  application: "Admin Portal",
  title: "",
  description: "",
  reason_needed: "",
  problem_solved: "",
  users_affected: "",
  priority: "normal",
  example_workflow: "",

  app_name: "",
  required_pages: "",
  permissions_required: "",
  needs_sidebar: true,
  connects_to_other_apps: false,
  connected_apps: "",
  needs_public_pages: false,
  reporting_requirements: "",
};

function prettyStatus(status: RequestStatus) {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "under_review":
      return "Under Review";
    case "approved":
      return "Approved";
    case "planned":
      return "Planned";
    case "in_development":
      return "In Development";
    case "testing":
      return "Testing";
    case "completed":
      return "Completed";
    case "on_hold":
      return "On Hold";
    case "rejected":
      return "Rejected";
  }
}

function statusClasses(status: RequestStatus) {
  switch (status) {
    case "submitted":
      return "border-sky-400/25 bg-sky-500/10 text-sky-200";
    case "under_review":
      return "border-amber-400/25 bg-amber-500/10 text-amber-200";
    case "approved":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "planned":
      return "border-purple-400/25 bg-purple-500/10 text-purple-200";
    case "in_development":
      return "border-pink-400/25 bg-pink-500/10 text-pink-200";
    case "testing":
      return "border-cyan-400/25 bg-cyan-500/10 text-cyan-200";
    case "completed":
      return "border-emerald-400/25 bg-emerald-500/10 text-emerald-200";
    case "on_hold":
      return "border-orange-400/25 bg-orange-500/10 text-orange-200";
    case "rejected":
      return "border-red-400/25 bg-red-500/10 text-red-200";
  }
}

function priorityClasses(priority: RequestPriority) {
  switch (priority) {
    case "low":
      return "border-white/10 bg-white/5 text-white/60";
    case "normal":
      return "border-blue-400/20 bg-blue-500/10 text-blue-200";
    case "high":
      return "border-orange-400/20 bg-orange-500/10 text-orange-200";
    case "urgent":
      return "border-red-400/25 bg-red-500/10 text-red-200";
  }
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

export default function DevelopmentRequestsPage() {
  const [requests, setRequests] = useState<DevelopmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<RequestType | "all">("all");

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState<CreateRequestForm>(INITIAL_FORM);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<SubmitSuccess | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch("/api/admin/developmentrequests", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
        headers: {
          Accept: "application/json",
        },
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok || !Array.isArray(result?.requests)) {
        throw new Error(
          result?.error ||
            "Development requests could not be loaded.",
        );
      }

      setRequests(result.requests);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Development requests could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  const filteredRequests = useMemo(() => {
    const term = search.trim().toLowerCase();

    return requests.filter((request) => {
      if (statusFilter !== "all" && request.status !== statusFilter) {
        return false;
      }

      if (typeFilter !== "all" && request.request_type !== typeFilter) {
        return false;
      }

      if (!term) return true;

      return [
        request.reference_number,
        request.title,
        request.application,
        request.description,
        request.requested_by_name,
        request.requested_by_email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [requests, search, statusFilter, typeFilter]);

  const stats = useMemo(() => {
    return {
      newRequests: requests.filter((item) => item.status === "submitted").length,
      underReview: requests.filter((item) => item.status === "under_review").length,
      approvedPlanned: requests.filter((item) =>
        ["approved", "planned"].includes(item.status),
      ).length,
      inDevelopment: requests.filter((item) => item.status === "in_development").length,
      completed: requests.filter((item) => item.status === "completed").length,
    };
  }, [requests]);

  function updateField<K extends keyof CreateRequestForm>(
    key: K,
    value: CreateRequestForm[K],
  ) {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function closeCreateModal() {
    if (submitting) return;

    setCreateOpen(false);
    setSubmitError(null);
    setSubmitSuccess(null);
    setForm(INITIAL_FORM);
  }

  async function submitRequest() {
    if (!form.title.trim()) {
      setSubmitError("Enter a title for the request.");
      return;
    }

    if (!form.description.trim()) {
      setSubmitError("Explain what you would like to be built or changed.");
      return;
    }

    if (form.request_type === "feature" && !form.application.trim()) {
      setSubmitError("Select which application the feature is for.");
      return;
    }

    if (form.request_type === "new_app" && !form.app_name.trim()) {
      setSubmitError("Enter a name for the new app.");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    try {
      const response = await fetch("/api/admin/developmentrequests", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          ...form,
          application:
            form.request_type === "feature" ? form.application : null,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok || !result?.ok) {
        throw new Error(
          result?.error ||
            "The development request could not be submitted.",
        );
      }

      const internalNotification =
        result?.email_notifications?.internal &&
        typeof result.email_notifications.internal === "object"
          ? (result.email_notifications.internal as EmailDeliveryResult)
          : null;

      const requesterNotification =
        result?.email_notifications?.requester &&
        typeof result.email_notifications.requester === "object"
          ? (result.email_notifications.requester as EmailDeliveryResult)
          : null;

      setSubmitSuccess({
        reference:
          typeof result?.request?.reference_number === "string"
            ? result.request.reference_number
            : "Saved",
        message:
          typeof result?.message === "string"
            ? result.message
            : "Development request submitted successfully.",
        internal: internalNotification,
        requester: requesterNotification,
        allSent: result?.email_notifications?.all_sent === true,
      });

      await loadRequests();
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The development request could not be submitted.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0b0c16] text-white">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-6 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#111321] shadow-2xl">
          <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400" />

          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-4xl">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-purple-200/65">
                  <Code2 className="h-4 w-4" />
                  Burton Pride Admin Portal
                </div>

                <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">
                  Development Requests
                </h1>

                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/60 sm:text-base">
                  Request a new feature for an existing Burton Pride application or
                  propose a completely new app to be built inside the Admin Portal.
                  Every request can be reviewed, planned, developed and tracked from
                  one place.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row xl:justify-end">
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  disabled={loading}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Clock3 className="h-4 w-4" />
                  )}
                  Refresh
                </button>

                <Link
                  href="/Admin/Dashboard"
                  className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
                >
                  Back to Admin Portal
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setSubmitSuccess(null);
                    setSubmitError(null);
                    setCreateOpen(true);
                  }}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500 px-5 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110"
                >
                  <Plus className="h-5 w-5" />
                  New Development Request
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryCard
            label="New requests"
            value={stats.newRequests}
            icon={<FilePlus2 className="h-5 w-5" />}
          />
          <SummaryCard
            label="Under review"
            value={stats.underReview}
            icon={<Clock3 className="h-5 w-5" />}
          />
          <SummaryCard
            label="Approved / planned"
            value={stats.approvedPlanned}
            icon={<Layers3 className="h-5 w-5" />}
          />
          <SummaryCard
            label="In development"
            value={stats.inDevelopment}
            icon={<Code2 className="h-5 w-5" />}
          />
          <SummaryCard
            label="Completed"
            value={stats.completed}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
        </section>

        <section className="mt-6 rounded-[2rem] border border-white/10 bg-[#111321] p-5 shadow-xl sm:p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-pink-300" />
                <h2 className="text-xl font-black">
                  Development request queue
                </h2>
              </div>

              <p className="mt-1 text-sm text-white/50">
                Track ideas from submission through to development and completion.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[760px]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search requests..."
                  className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-purple-400/40 focus:ring-2 focus:ring-purple-500/20"
                />
              </div>

              <div className="relative">
                <Filter className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <select
                  value={typeFilter}
                  onChange={(event) =>
                    setTypeFilter(event.target.value as RequestType | "all")
                  }
                  className="h-12 w-full appearance-none rounded-2xl border border-white/10 bg-black/20 pl-11 pr-4 text-sm text-white outline-none transition focus:border-purple-400/40 focus:ring-2 focus:ring-purple-500/20"
                >
                  <option value="all">All request types</option>
                  <option value="feature">Feature requests</option>
                  <option value="new_app">New app requests</option>
                </select>
              </div>

              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as RequestStatus | "all")
                }
                className="h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 text-sm text-white outline-none transition focus:border-purple-400/40 focus:ring-2 focus:ring-purple-500/20"
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {loading ? (
              <div className="rounded-3xl border border-white/10 bg-white/[0.02] px-5 py-14 text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-purple-300" />
                <h3 className="mt-4 font-black text-white/75">
                  Loading development requests
                </h3>
                <p className="mt-2 text-sm text-white/40">
                  Getting the latest requests from the Admin Portal.
                </p>
              </div>
            ) : loadError ? (
              <div className="rounded-3xl border border-red-400/20 bg-red-500/10 px-5 py-10 text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-red-200" />
                <h3 className="mt-4 font-black text-red-100">
                  Development requests could not be loaded
                </h3>
                <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-red-100/65">
                  {loadError}
                </p>
                <button
                  type="button"
                  onClick={() => void loadRequests()}
                  className="mt-5 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-red-500 px-5 py-3 text-sm font-black text-white transition hover:bg-red-400"
                >
                  Try again
                </button>
              </div>
            ) : filteredRequests.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-5 py-14 text-center">
                <AppWindow className="mx-auto h-8 w-8 text-white/25" />
                <h3 className="mt-4 font-black text-white/75">
                  No development requests found
                </h3>
                <p className="mt-2 text-sm text-white/40">
                  {requests.length === 0
                    ? "No requests have been submitted yet. Use New Development Request to create the first one."
                    : "Try changing your filters."}
                </p>
              </div>
            ) : (
              filteredRequests.map((request) => (
                <article
                  key={request.id}
                  className="rounded-3xl border border-white/10 bg-black/15 p-5 transition hover:border-white/15 hover:bg-white/[0.035] sm:p-6"
                >
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-black uppercase tracking-[0.12em] text-white/55">
                          {request.reference_number}
                        </span>

                        <span className="rounded-full border border-purple-400/20 bg-purple-500/10 px-3 py-1 text-[11px] font-black uppercase tracking-[0.1em] text-purple-200">
                          {request.request_type === "feature"
                            ? "Feature request"
                            : "New app request"}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${priorityClasses(
                            request.priority,
                          )}`}
                        >
                          {request.priority}
                        </span>

                        <span
                          className={`rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusClasses(
                            request.status,
                          )}`}
                        >
                          {prettyStatus(request.status)}
                        </span>
                      </div>

                      <h3 className="mt-4 text-xl font-black text-white sm:text-2xl">
                        {request.title}
                      </h3>

                      <p className="mt-3 max-w-4xl text-sm leading-7 text-white/55">
                        {request.description}
                      </p>

                      <div className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                        <MetaItem
                          label="Application"
                          value={request.application || "New application"}
                        />
                        <MetaItem
                          label="Requested by"
                          value={
                            request.requested_by_name ||
                            request.requested_by_email ||
                            "Unknown admin"
                          }
                        />
                        <MetaItem
                          label="Assigned to"
                          value={request.assigned_to_name || "Not assigned"}
                        />
                        <MetaItem
                          label="Submitted"
                          value={formatDate(request.created_at)}
                        />
                      </div>
                    </div>

                    <Link
                      href={`/Admin/Dashboard/Settings/DevelopmentRequests/${request.id}`}
                      className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/75 transition hover:bg-white/10 hover:text-white"
                    >
                      View request
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      {createOpen ? (
        <div
          className="fixed inset-0 z-[10020] flex items-center justify-center bg-black/75 p-3 backdrop-blur-xl sm:p-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-development-request-title"
        >
          <button
            type="button"
            aria-label="Close new development request"
            className="absolute inset-0 cursor-default"
            onClick={closeCreateModal}
            disabled={submitting}
          />

          <div className="relative max-h-[94dvh] w-full max-w-5xl overflow-y-auto rounded-[1.75rem] border border-white/10 bg-[#111321] shadow-2xl">
            <div className="h-1.5 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-400" />

            <div className="p-5 sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-purple-200/60">
                    <FilePlus2 className="h-4 w-4" />
                    Development Requests
                  </div>

                  <h2
                    id="new-development-request-title"
                    className="mt-2 text-2xl font-black sm:text-3xl"
                  >
                    New development request
                  </h2>

                  <p className="mt-2 max-w-3xl text-sm leading-6 text-white/55">
                    Request a change to an existing application or propose a new
                    Burton Pride Admin Portal app.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={submitting}
                  className="rounded-full border border-white/10 bg-white/5 p-2.5 text-white/55 transition hover:bg-white/10 hover:text-white disabled:opacity-40"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {submitSuccess ? (
                <div className="mt-6 rounded-3xl border border-emerald-400/25 bg-emerald-500/10 p-5 sm:p-6">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="mt-0.5 h-6 w-6 shrink-0 text-emerald-300" />

                    <div className="min-w-0 flex-1">
                      <h3 className="text-lg font-black text-emerald-100">
                        Development request submitted
                      </h3>

                      <p className="mt-2 text-sm leading-6 text-emerald-100/70">
                        {submitSuccess.message}
                      </p>

                      <div className="mt-4 rounded-2xl border border-emerald-300/15 bg-black/15 p-4">
                        <p className="text-[11px] font-black uppercase tracking-[0.14em] text-emerald-100/45">
                          Request reference
                        </p>

                        <p className="mt-1 text-xl font-black text-emerald-50">
                          {submitSuccess.reference}
                        </p>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <EmailStatusCard
                          title="Cameron notification"
                          result={submitSuccess.internal}
                          fallbackRecipient="cameronlowndes@burtonpride.co.uk"
                        />

                        <EmailStatusCard
                          title="Requester confirmation"
                          result={submitSuccess.requester}
                        />
                      </div>

                      {!submitSuccess.allSent ? (
                        <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100/80">
                          The request has been saved in Supabase. One or more emails were not confirmed as sent, so the request has not been lost.
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}

              {submitError ? (
                <div className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 p-4 text-sm leading-6 text-red-100">
                  <div className="flex gap-3">
                    <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                </div>
              ) : null}

              {!submitSuccess ? (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <Field label="Request type" full required>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <TypeButton
                      active={form.request_type === "feature"}
                      icon={<Sparkles className="h-5 w-5" />}
                      title="Feature Request"
                      description="Add or improve something in an existing app."
                      onClick={() => updateField("request_type", "feature")}
                    />

                    <TypeButton
                      active={form.request_type === "new_app"}
                      icon={<AppWindow className="h-5 w-5" />}
                      title="New App Request"
                      description="Request a completely new Admin Portal application."
                      onClick={() => updateField("request_type", "new_app")}
                    />
                  </div>
                </Field>

                {form.request_type === "feature" ? (
                  <Field label="Existing application" required>
                    <select
                      value={form.application}
                      onChange={(event) =>
                        updateField("application", event.target.value)
                      }
                      className={inputClass}
                    >
                      {APPLICATIONS.map((application) => (
                        <option key={application} value={application}>
                          {application}
                        </option>
                      ))}
                    </select>
                  </Field>
                ) : (
                  <Field label="New app name" required>
                    <input
                      value={form.app_name}
                      onChange={(event) =>
                        updateField("app_name", event.target.value)
                      }
                      className={inputClass}
                      placeholder="e.g. Volunteer Management"
                    />
                  </Field>
                )}

                <Field label="Priority" required>
                  <select
                    value={form.priority}
                    onChange={(event) =>
                      updateField(
                        "priority",
                        event.target.value as RequestPriority,
                      )
                    }
                    className={inputClass}
                  >
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </Field>

                <Field label="Request title" full required>
                  <input
                    value={form.title}
                    onChange={(event) =>
                      updateField("title", event.target.value)
                    }
                    className={inputClass}
                    placeholder="Short clear title for the request"
                  />
                </Field>

                <Field label="What would you like built or changed?" full required>
                  <textarea
                    value={form.description}
                    onChange={(event) =>
                      updateField("description", event.target.value)
                    }
                    className={`${inputClass} min-h-32 resize-y`}
                    placeholder="Describe the feature or app in as much useful detail as possible."
                  />
                </Field>

                <Field label="Why is this needed?">
                  <textarea
                    value={form.reason_needed}
                    onChange={(event) =>
                      updateField("reason_needed", event.target.value)
                    }
                    className={`${inputClass} min-h-24 resize-y`}
                    placeholder="Why would this help Burton Pride?"
                  />
                </Field>

                <Field label="What problem does it solve?">
                  <textarea
                    value={form.problem_solved}
                    onChange={(event) =>
                      updateField("problem_solved", event.target.value)
                    }
                    className={`${inputClass} min-h-24 resize-y`}
                    placeholder="Explain the current problem or limitation."
                  />
                </Field>

                <Field label="Who will use it?">
                  <input
                    value={form.users_affected}
                    onChange={(event) =>
                      updateField("users_affected", event.target.value)
                    }
                    className={inputClass}
                    placeholder="e.g. Main admins, committee members, volunteers"
                  />
                </Field>

                <Field label="Example of how it should work">
                  <textarea
                    value={form.example_workflow}
                    onChange={(event) =>
                      updateField("example_workflow", event.target.value)
                    }
                    className={`${inputClass} min-h-24 resize-y`}
                    placeholder="Describe a simple example workflow."
                  />
                </Field>

                {form.request_type === "new_app" ? (
                  <>
                    <div className="sm:col-span-2 mt-2 rounded-2xl border border-purple-400/20 bg-purple-500/[0.07] p-4">
                      <div className="flex items-center gap-2">
                        <AppWindow className="h-5 w-5 text-purple-300" />
                        <h3 className="font-black text-purple-100">
                          New app planning
                        </h3>
                      </div>

                      <p className="mt-1 text-xs leading-5 text-purple-100/50">
                        These extra details help work out the size and structure of
                        the proposed application.
                      </p>
                    </div>

                    <Field label="Required pages">
                      <textarea
                        value={form.required_pages}
                        onChange={(event) =>
                          updateField("required_pages", event.target.value)
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="e.g. Dashboard, Users, Reports, Settings"
                      />
                    </Field>

                    <Field label="Permissions / roles needed">
                      <textarea
                        value={form.permissions_required}
                        onChange={(event) =>
                          updateField(
                            "permissions_required",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="e.g. View, manage, approve, delete"
                      />
                    </Field>

                    <Field label="Connected apps">
                      <input
                        value={form.connected_apps}
                        onChange={(event) =>
                          updateField("connected_apps", event.target.value)
                        }
                        disabled={!form.connects_to_other_apps}
                        className={`${inputClass} disabled:cursor-not-allowed disabled:opacity-40`}
                        placeholder="e.g. Money Management, Event Hub"
                      />
                    </Field>

                    <Field label="Reporting / exports">
                      <textarea
                        value={form.reporting_requirements}
                        onChange={(event) =>
                          updateField(
                            "reporting_requirements",
                            event.target.value,
                          )
                        }
                        className={`${inputClass} min-h-24 resize-y`}
                        placeholder="Any reports, CSV, Excel or PDF exports needed?"
                      />
                    </Field>

                    <Field label="App options" full>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <ToggleCard
                          label="Own sidebar"
                          checked={form.needs_sidebar}
                          onChange={(value) =>
                            updateField("needs_sidebar", value)
                          }
                        />

                        <ToggleCard
                          label="Connect to other apps"
                          checked={form.connects_to_other_apps}
                          onChange={(value) =>
                            updateField("connects_to_other_apps", value)
                          }
                        />

                        <ToggleCard
                          label="Needs public website pages"
                          checked={form.needs_public_pages}
                          onChange={(value) =>
                            updateField("needs_public_pages", value)
                          }
                        />
                      </div>
                    </Field>
                  </>
                ) : null}
                </div>
              ) : null}

              <div className="mt-7 flex flex-col-reverse gap-3 border-t border-white/10 pt-5 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={submitting}
                  className="min-h-12 rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm font-black text-white/70 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                  {submitSuccess ? "Close" : "Cancel"}
                </button>

                {!submitSuccess ? (
                  <button
                    type="button"
                    onClick={submitRequest}
                    disabled={submitting}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-purple-500 via-pink-500 to-fuchsia-500 px-6 py-3 text-sm font-black text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FilePlus2 className="h-4 w-4" />
                    )}

                    {submitting ? "Submitting..." : "Submit development request"}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

const inputClass =
  "min-h-12 w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-purple-400/40 focus:ring-2 focus:ring-purple-500/20";

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-[#111321] p-5 shadow-lg">
      <div className="flex items-center justify-between gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-purple-400/15 bg-purple-500/10 text-purple-200">
          {icon}
        </div>

        <div className="text-3xl font-black">{value}</div>
      </div>

      <div className="mt-4 text-sm font-black text-white/70">
        {label}
      </div>
    </div>
  );
}

function MetaItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
      <div className="text-[11px] font-black uppercase tracking-[0.12em] text-white/35">
        {label}
      </div>
      <div className="mt-1 truncate font-bold text-white/75">
        {value}
      </div>
    </div>
  );
}

function Field({
  label,
  required = false,
  full = false,
  children,
}: {
  label: string;
  required?: boolean;
  full?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className={full ? "sm:col-span-2" : ""}>
      <span className="mb-2 block text-sm font-black text-white/75">
        {label}
        {required ? <span className="ml-1 text-pink-300">*</span> : null}
      </span>
      {children}
    </label>
  );
}

function TypeButton({
  active,
  icon,
  title,
  description,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left transition ${
        active
          ? "border-purple-400/40 bg-purple-500/15 ring-2 ring-purple-500/15"
          : "border-white/10 bg-black/15 hover:bg-white/5"
      }`}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${
          active
            ? "bg-purple-500/20 text-purple-200"
            : "bg-white/5 text-white/45"
        }`}
      >
        {icon}
      </div>

      <div className="mt-3 font-black">{title}</div>
      <div className="mt-1 text-xs leading-5 text-white/45">
        {description}
      </div>
    </button>
  );
}

function EmailStatusCard({
  title,
  result,
  fallbackRecipient,
}: {
  title: string;
  result: EmailDeliveryResult | null;
  fallbackRecipient?: string;
}) {
  const recipient =
    result?.recipient || fallbackRecipient || "Not recorded";

  const sent = result?.sent === true;

  return (
    <div
      className={`rounded-2xl border p-4 ${
        sent
          ? "border-emerald-300/20 bg-emerald-500/[0.07]"
          : "border-amber-300/20 bg-amber-500/[0.07]"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
            sent
              ? "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
          }`}
        >
          <Mail className="h-4 w-4" />
        </div>

        <div className="min-w-0">
          <p className="text-sm font-black text-white/85">
            {title}
          </p>

          <p className="mt-1 break-all text-xs leading-5 text-white/45">
            {recipient}
          </p>

          <p
            className={`mt-2 text-xs font-black ${
              sent ? "text-emerald-200" : "text-amber-200"
            }`}
          >
            {sent ? "Email sent" : "Email not confirmed"}
          </p>

          {!sent && result?.error ? (
            <p className="mt-2 text-xs leading-5 text-amber-100/60">
              {result.error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ToggleCard({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-2xl border px-4 py-4 text-left transition ${
        checked
          ? "border-emerald-400/30 bg-emerald-500/10"
          : "border-white/10 bg-black/15"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-black text-white/75">
          {label}
        </span>

        <span
          className={`flex h-6 w-11 items-center rounded-full p-1 transition ${
            checked ? "justify-end bg-emerald-500" : "justify-start bg-white/10"
          }`}
        >
          <span className="h-4 w-4 rounded-full bg-white" />
        </span>
      </div>
    </button>
  );
}
