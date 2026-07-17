"use client";

import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clipboard,
  FileClock,
  Loader2,
  MessageSquarePlus,
  RotateCcw,
  ShieldAlert,
  X,
} from "lucide-react";

import EventAuditChangeViewer from "./EventAuditChangeViewer";
import { EventAuditRiskBadge, EventAuditStatusBadge } from "./EventAuditBadges";
import type {
  AuditAlert,
  AuditLogRow,
  AuditPermissions,
  InvestigationNote,
} from "./client-types";

type DetailsResponse = {
  ok: boolean;
  error?: string;
  log?: AuditLogRow;
  alerts?: AuditAlert[];
  notes?: InvestigationNote[];
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "medium",
  });
}

function text(value: unknown) {
  if (value === null || value === undefined || value === "") return "Not recorded";
  return String(value);
}

function Detail({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-white/40">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white/85">{text(value)}</p>
    </div>
  );
}

export default function EventAuditDetailsDrawer({
  auditId,
  permissions,
  onClose,
  onChanged,
}: {
  auditId: string | null;
  permissions: AuditPermissions;
  onClose: () => void;
  onChanged: () => void;
}) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [data, setData] = useState<DetailsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [confidentialNote, setConfidentialNote] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [updatingAlert, setUpdatingAlert] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState<Record<string, string>>({});
  const [restoreReason, setRestoreReason] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [notice, setNotice] = useState("");

  async function loadDetails(signal?: AbortSignal) {
    if (!auditId) return;
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/burton-pride-event-hub/audit-log/${encodeURIComponent(auditId)}`,
        { cache: "no-store", credentials: "include", signal },
      );
      const json = (await response.json().catch(() => ({}))) as DetailsResponse;
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Failed to load audit-event details.");
      }
      setData(json);
    } catch (loadError) {
      if ((loadError as Error)?.name !== "AbortError") {
        setError(loadError instanceof Error ? loadError.message : "Failed to load details.");
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!auditId) {
      setData(null);
      return;
    }

    const controller = new AbortController();
    void loadDetails(controller.signal);
    window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      controller.abort();
      window.removeEventListener("keydown", closeOnEscape);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auditId]);

  if (!auditId) return null;

  const log = data?.log;

  async function copyId() {
    await navigator.clipboard.writeText(auditId || "");
    setNotice("Audit ID copied.");
  }

  async function addNote() {
    const cleanNote = note.trim();
    if (cleanNote.length < 3) {
      setNotice("Enter at least three characters for the investigation note.");
      return;
    }

    setSavingNote(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/burton-pride-event-hub/audit-log/${encodeURIComponent(auditId || "")}/notes`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note: cleanNote,
            is_confidential: confidentialNote,
            alert_id: data?.alerts?.[0]?.id || null,
          }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to add note.");
      setNote("");
      setConfidentialNote(false);
      setNotice("Investigation note added.");
      await loadDetails();
      onChanged();
    } catch (saveError) {
      setNotice(saveError instanceof Error ? saveError.message : "Failed to add note.");
    } finally {
      setSavingNote(false);
    }
  }

  async function updateAlert(alert: AuditAlert, status: string) {
    setUpdatingAlert(alert.id);
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/burton-pride-event-hub/audit-log/security-alerts/${encodeURIComponent(alert.id)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status,
            resolution_notes: resolutionNotes[alert.id] || undefined,
            reason: resolutionNotes[alert.id] || `Alert changed to ${status}.`,
          }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Failed to update alert.");
      setNotice(`Alert changed to ${status.replaceAll("_", " ")}.`);
      await loadDetails();
      onChanged();
    } catch (updateError) {
      setNotice(updateError instanceof Error ? updateError.message : "Failed to update alert.");
    } finally {
      setUpdatingAlert(null);
    }
  }

  async function restoreRecord() {
    if (restoreReason.trim().length < 10) {
      setNotice("Enter a restoration reason of at least 10 characters.");
      return;
    }

    setRestoring(true);
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/burton-pride-event-hub/audit-log/${encodeURIComponent(auditId || "")}/restore`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: restoreReason.trim() }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok || !json.ok) throw new Error(json.error || "Restore failed.");
      setRestoreReason("");
      setNotice("Record restored and a linked audit event was created.");
      await loadDetails();
      onChanged();
    } catch (restoreError) {
      setNotice(restoreError instanceof Error ? restoreError.message : "Restore failed.");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Audit event details">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close audit details" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-3xl flex-col border-l border-white/10 bg-[#120d1d] text-white shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-white/10 bg-white/[0.04] p-4 sm:p-6">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {log && <EventAuditStatusBadge status={log.status} />}
              {log && <EventAuditRiskBadge risk={log.risk_level} />}
              {log?.is_security_event && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2.5 py-1 text-[11px] font-black text-red-100 ring-1 ring-red-300/25">
                  <ShieldAlert className="h-3.5 w-3.5" /> Security
                </span>
              )}
            </div>
            <h2 className="break-words text-xl font-black sm:text-2xl">
              {log?.action_label || "Audit event details"}
            </h2>
            <p className="mt-1 break-all text-xs text-white/45">{auditId}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => void copyId()} className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label="Copy audit ID">
              <Clipboard className="h-5 w-5" />
            </button>
            <button ref={closeButtonRef} onClick={onClose} className="rounded-xl border border-white/10 bg-white/5 p-2.5 hover:bg-white/10" aria-label="Close details">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {notice && (
            <div className="mb-4 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-50" aria-live="polite">
              {notice}
            </div>
          )}

          {loading && (
            <div className="flex min-h-64 items-center justify-center gap-3 text-white/65">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading audit details…
            </div>
          )}

          {error && (
            <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-red-100">
              <div className="flex gap-3"><AlertTriangle className="h-5 w-5 shrink-0" /><div><p className="font-black">Details could not load</p><p className="mt-1 text-sm">{error}</p></div></div>
            </div>
          )}

          {log && !loading && (
            <div className="space-y-6">
              <section>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-black uppercase tracking-[0.16em] text-white/60">
                  <FileClock className="h-4 w-4" /> Event overview
                </h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Date and time" value={formatDate(log.created_at)} />
                  <Detail label="Admin" value={log.admin_name || log.admin_email} />
                  <Detail label="Role" value={log.admin_role} />
                  <Detail label="Area" value={log.area} />
                  <Detail label="Technical action" value={log.action} />
                  <Detail label="Record" value={log.record_title} />
                  <Detail label="Record type" value={log.record_type} />
                  <Detail label="Record ID" value={log.record_id} />
                  <Detail label="Request ID" value={log.request_id} />
                </div>
                {(log.summary || log.reason || log.error_message) && (
                  <div className="mt-3 space-y-2">
                    {log.summary && <Detail label="Summary" value={log.summary} />}
                    {log.reason && <Detail label="Reason" value={log.reason} />}
                    {log.error_message && <Detail label="Error" value={`${log.error_code || "Error"}: ${log.error_message}`} />}
                  </div>
                )}
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white/60">Recorded changes</h3>
                <EventAuditChangeViewer changes={log.changed_fields} />
              </section>

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white/60">Request and source</h3>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <Detail label="Route" value={log.route} />
                  <Detail label="HTTP method" value={log.http_method} />
                  <Detail label="Response status" value={log.response_status} />
                  <Detail label="Browser" value={log.browser} />
                  <Detail label="Operating system" value={log.operating_system} />
                  <Detail label="Device" value={log.device_type} />
                  <Detail label="IP address" value={log.ip_address} />
                </div>
              </section>

              {permissions.viewSensitiveChanges && (
                <details className="rounded-2xl border border-white/10 bg-black/20 p-4">
                  <summary className="cursor-pointer font-black text-white/80">Safe before/after snapshots and metadata</summary>
                  <div className="mt-4 grid gap-3">
                    {[
                      ["Before", log.before_data],
                      ["After", log.after_data],
                      ["Metadata", log.metadata],
                    ].map(([label, value]) => (
                      <div key={String(label)}>
                        <p className="mb-1 text-xs font-black text-white/50">{String(label)}</p>
                        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-black/35 p-3 text-xs text-white/70">{JSON.stringify(value || {}, null, 2)}</pre>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {data?.alerts?.length ? (
                <section>
                  <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white/60">Security alerts</h3>
                  <div className="space-y-3">
                    {data.alerts.map((alert) => (
                      <article key={alert.id} className="rounded-2xl border border-red-300/20 bg-red-500/10 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div><p className="font-black text-red-50">{alert.title}</p><p className="mt-1 text-xs text-red-100/60">{alert.severity} · {alert.status} · {formatDate(alert.created_at)}</p></div>
                          <EventAuditRiskBadge risk={alert.severity} />
                        </div>
                        {alert.description && <p className="mt-3 text-sm leading-6 text-red-50/80">{alert.description}</p>}
                        {permissions.manageAlerts && (
                          <div className="mt-4 space-y-3">
                            <textarea value={resolutionNotes[alert.id] || ""} onChange={(event) => setResolutionNotes((current) => ({ ...current, [alert.id]: event.target.value }))} placeholder="Review or resolution notes" className="min-h-24 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40" />
                            <div className="flex flex-wrap gap-2">
                              {[
                                ["reviewing", "Start review"],
                                ["resolved", "Resolve"],
                                ["dismissed", "Dismiss"],
                              ].map(([status, label]) => (
                                <button key={status} type="button" disabled={updatingAlert === alert.id} onClick={() => void updateAlert(alert, status)} className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black hover:bg-white/15 disabled:opacity-50">
                                  {updatingAlert === alert.id ? "Saving…" : label}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white/60">Investigation notes</h3>
                <div className="space-y-2">
                  {data?.notes?.length ? data.notes.map((item) => (
                    <article key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                      <div className="flex flex-wrap justify-between gap-2"><p className="font-black text-white/85">{item.admin_name || item.admin_email || "Admin"}</p><p className="text-xs text-white/40">{formatDate(item.created_at)}</p></div>
                      {item.is_confidential && <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-amber-200">Confidential note</p>}
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-white/70">{item.note}</p>
                    </article>
                  )) : <p className="rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-white/45">No investigation notes have been added.</p>}
                </div>

                {permissions.addNotes && (
                  <div className="mt-3 rounded-2xl border border-cyan-300/15 bg-cyan-500/[0.06] p-4">
                    <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Add an evidence-based investigation note…" className="min-h-28 w-full rounded-xl border border-white/10 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-white/35 focus:border-cyan-300/40" />
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                      <label className="flex items-center gap-2 text-xs font-bold text-white/65"><input type="checkbox" checked={confidentialNote} onChange={(event) => setConfidentialNote(event.target.checked)} /> Confidential security note</label>
                      <button type="button" onClick={() => void addNote()} disabled={savingNote} className="inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200 disabled:opacity-50">
                        {savingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageSquarePlus className="h-4 w-4" />} Add note
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {permissions.restoreRecords && log.record_type === "event" && ["event.archived", "event.deleted"].includes(log.action) && (
                <section className="rounded-2xl border border-amber-300/20 bg-amber-500/10 p-4">
                  <h3 className="flex items-center gap-2 font-black text-amber-50"><RotateCcw className="h-5 w-5" /> Controlled restoration</h3>
                  <p className="mt-2 text-sm leading-6 text-amber-50/70">Restoration creates a new linked audit event. The original history remains unchanged.</p>
                  <textarea value={restoreReason} onChange={(event) => setRestoreReason(event.target.value)} placeholder="Explain why this event record must be restored…" className="mt-3 min-h-24 w-full rounded-xl border border-amber-300/20 bg-black/25 p-3 text-sm text-white outline-none placeholder:text-white/35" />
                  <button type="button" onClick={() => void restoreRecord()} disabled={restoring} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-300 px-4 py-2.5 text-sm font-black text-slate-950 hover:bg-amber-200 disabled:opacity-50">
                    {restoring ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />} Restore event record
                  </button>
                </section>
              )}

              {log.entry_hash && (
                <section className="rounded-2xl border border-emerald-300/15 bg-emerald-500/[0.06] p-4">
                  <h3 className="flex items-center gap-2 font-black text-emerald-50"><CheckCircle2 className="h-5 w-5" /> Integrity information</h3>
                  <p className="mt-2 break-all text-xs text-emerald-50/60">Entry hash: {log.entry_hash}</p>
                  <p className="mt-1 break-all text-xs text-emerald-50/45">Previous: {log.previous_entry_hash || "Genesis entry"}</p>
                </section>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
