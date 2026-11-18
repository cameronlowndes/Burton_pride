"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, CircleAlert, Loader2, RefreshCw, Save } from "lucide-react";
import { DEVELOPMENT_REQUESTS_PATH, requestPriorities, requestStatuses, type RequestPriority, type RequestStatus } from "@/lib/development-requests/model";

type Admin = { id: string; name: string; email: string; role?: string | null };
type DevelopmentRequest = {
  id: string;
  reference_number: string;
  request_type: "feature" | "new_app";
  title: string;
  description: string;
  application: string | null;
  app_name?: string | null;
  reason_needed?: string | null;
  problem_solved?: string | null;
  users_affected?: string | null;
  example_workflow?: string | null;
  required_pages?: string | null;
  permissions_required?: string | null;
  connected_apps?: string | null;
  reporting_requirements?: string | null;
  needs_sidebar?: boolean | null;
  connects_to_other_apps?: boolean | null;
  needs_public_pages?: boolean | null;
  status: RequestStatus;
  priority: RequestPriority;
  requested_by_name: string | null;
  requested_by_email: string | null;
  assigned_admin_id: string | null;
  assigned_admin_name?: string | null;
  assigned_admin_email?: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string | null;
  completed_at?: string | null;
};

type ResponseBody = { request?: DevelopmentRequest; admins?: Admin[]; error?: string };
type Form = { status: RequestStatus; priority: RequestPriority; assigned_admin_id: string; admin_notes: string };

function display(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function date(value: string | null | undefined) {
  if (!value) return "Not available";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "Not available" : new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London",
  }).format(parsed);
}

function Detail({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
    <dt className="text-xs font-bold uppercase tracking-wider text-white/50">{label}</dt>
    <dd className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-white/85">{value}</dd>
  </div>;
}

const fieldClass = "mt-2 min-h-11 w-full rounded-xl border border-white/20 bg-[#151526] px-3 py-2 text-sm text-white outline-none focus:border-fuchsia-400 focus:ring-2 focus:ring-fuchsia-400/20";

export default function DevelopmentRequestDetails({ requestId }: { requestId: string }) {
  const [item, setItem] = useState<DevelopmentRequest | null>(null);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/developmentrequests/${encodeURIComponent(requestId)}`, {
        credentials: "same-origin", cache: "no-store", signal,
      });
      const body = await response.json().catch(() => ({})) as ResponseBody;
      if (!response.ok || !body.request) throw new Error(body.error || "Unable to load this request.");
      if (signal?.aborted) return;
      setItem(body.request);
      setAdmins(body.admins ?? []);
      setForm({ status: body.request.status, priority: body.request.priority,
        assigned_admin_id: body.request.assigned_admin_id ?? "", admin_notes: body.request.admin_notes ?? "" });
    } catch (cause) {
      if (signal?.aborted) return;
      setError(cause instanceof Error ? cause.message : "Unable to load this request.");
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const changed = useMemo(() => Boolean(item && form && (
    form.status !== item.status || form.priority !== item.priority ||
    form.assigned_admin_id !== (item.assigned_admin_id ?? "") ||
    form.admin_notes.trim() !== (item.admin_notes ?? "")
  )), [item, form]);

  async function save() {
    if (!form || !item || !changed || saving) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/admin/developmentrequests/${encodeURIComponent(requestId)}`, {
        method: "PATCH", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, assigned_admin_id: form.assigned_admin_id || null, admin_notes: form.admin_notes.trim() || null }),
      });
      const body = await response.json().catch(() => ({})) as ResponseBody;
      if (!response.ok) throw new Error(body.error || "Unable to save this request.");
      if (body.request) {
        setItem((current) => current ? { ...current, ...body.request } : current);
      }
      setMessage("Changes saved.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save this request.");
    } finally {
      setSaving(false);
    }
  }

  return <main className="min-h-screen bg-[#080812] px-4 py-8 text-white sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={DEVELOPMENT_REQUESTS_PATH} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10"><ArrowLeft className="h-4 w-4" />Back to requests</Link>
        <button type="button" onClick={() => { setMessage(""); void load(); }} disabled={loading || saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/15 px-4 text-sm font-semibold hover:bg-white/10 disabled:opacity-50"><RefreshCw className="h-4 w-4" />Refresh</button>
      </div>

      {error && <div role="alert" className="flex gap-2 rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-red-100"><CircleAlert className="h-5 w-5 shrink-0" />{error}</div>}
      {message && <div role="status" className="flex gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-4 text-emerald-100"><CheckCircle2 className="h-5 w-5 shrink-0" />{message}</div>}
      {loading && !item && <div role="status" className="flex items-center gap-3 rounded-2xl border border-white/10 p-8"><Loader2 className="h-5 w-5 animate-spin" />Loading development request…</div>}
      {!loading && !item && error && <button type="button" onClick={() => void load()} className="rounded-xl bg-fuchsia-600 px-5 py-3 font-semibold">Try again</button>}

      {item && form && <>
        <header className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-8">
          <p className="text-sm font-bold text-fuchsia-300">{item.reference_number} · {item.request_type === "new_app" ? "New app" : "Feature request"}</p>
          <h1 className="mt-2 break-words text-3xl font-black sm:text-4xl">{item.title}</h1>
          <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full border border-violet-400/30 bg-violet-500/15 px-3 py-1.5">{display(item.status)}</span>
            <span className="rounded-full border border-amber-400/30 bg-amber-500/15 px-3 py-1.5">{display(item.priority)} priority</span>
          </div>
          <p className="mt-4 text-sm text-white/50">Submitted {date(item.created_at)} · Updated {date(item.updated_at)}</p>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(300px,370px)]">
          <div className="space-y-6">
            <section className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-7">
              <h2 className="text-xl font-bold">Request details</h2>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2"><Detail label="Description" value={item.description || "No description provided."} /></div>
                <Detail label="Application" value={item.application || item.app_name} />
                <Detail label="Why it is needed" value={item.reason_needed} />
                <Detail label="Problem it solves" value={item.problem_solved} />
                <Detail label="Who will use it" value={item.users_affected} />
                <Detail label="Example workflow" value={item.example_workflow} />
                <Detail label="Required pages" value={item.required_pages} />
                <Detail label="Permissions" value={item.permissions_required} />
                <Detail label="Connected apps" value={item.connected_apps} />
                <Detail label="Reports and exports" value={item.reporting_requirements} />
              </dl>
              {item.request_type === "new_app" && <p className="text-sm text-white/65">Own sidebar: {item.needs_sidebar ? "Yes" : "No"} · Other app connections: {item.connects_to_other_apps ? "Yes" : "No"} · Public pages: {item.needs_public_pages ? "Yes" : "No"}</p>}
            </section>
            <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-7">
              <h2 className="text-xl font-bold">Requester</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <Detail label="Name" value={item.requested_by_name || "Not provided"} />
                <Detail label="Email" value={item.requested_by_email || "Not provided"} />
              </dl>
            </section>
          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.05] p-6 sm:p-7">
            <h2 className="text-xl font-bold">Manage request</h2>
            <p className="mt-1 text-sm text-white/55">Set progress, priority and ownership.</p>
            <div className="mt-5 space-y-5">
              <label className="block text-sm font-semibold">Status
                <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as RequestStatus })} disabled={saving} className={fieldClass}>{requestStatuses.map((value) => <option key={value} value={value}>{display(value)}</option>)}</select>
              </label>
              <label className="block text-sm font-semibold">Priority
                <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as RequestPriority })} disabled={saving} className={fieldClass}>{requestPriorities.map((value) => <option key={value} value={value}>{display(value)}</option>)}</select>
              </label>
              <label className="block text-sm font-semibold">Assigned administrator
                <select value={form.assigned_admin_id} onChange={(event) => setForm({ ...form, assigned_admin_id: event.target.value })} disabled={saving} className={fieldClass}>
                  <option value="">Unassigned</option>
                  {form.assigned_admin_id && !admins.some((admin) => admin.id === form.assigned_admin_id) && <option value={form.assigned_admin_id}>{item.assigned_admin_name || "Previously assigned admin"}</option>}
                  {admins.map((admin) => <option key={admin.id} value={admin.id}>{admin.name}{admin.email ? ` (${admin.email})` : ""}</option>)}
                </select>
              </label>
              <label className="block text-sm font-semibold">Admin notes
                <textarea value={form.admin_notes} onChange={(event) => setForm({ ...form, admin_notes: event.target.value })} maxLength={12000} rows={7} disabled={saving} className={`${fieldClass} resize-y`} placeholder="Progress, decisions or next steps" />
              </label>
              <button type="button" onClick={() => void save()} disabled={!changed || saving || loading} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-5 font-bold hover:bg-fuchsia-500 disabled:cursor-not-allowed disabled:opacity-50">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? "Saving…" : "Save changes"}
              </button>
              {item.completed_at && <p className="text-xs text-white/55">Completed {date(item.completed_at)}</p>}
            </div>
          </section>
        </div>
      </>}
    </div>
  </main>;
}
