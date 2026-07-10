"use client";

import { useEffect, useState } from "react";
import { Filter, RotateCcw, X } from "lucide-react";

import type { AuditAdminOption } from "./client-types";

export type FilterValues = {
  area: string;
  admin_id: string;
  action: string;
  status: string;
  risk: string;
  record_type: string;
  date_from: string;
  date_to: string;
  security_only: string;
  review_only: string;
};

const EMPTY_FILTERS: FilterValues = {
  area: "",
  admin_id: "",
  action: "",
  status: "",
  risk: "",
  record_type: "",
  date_from: "",
  date_to: "",
  security_only: "",
  review_only: "",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1.5 block text-xs font-black text-white/60">{label}</span>{children}</label>;
}

const inputClass = "w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm font-semibold text-white outline-none focus:border-cyan-300/40";

export default function EventAuditFiltersPanel({
  open,
  values,
  areas,
  admins,
  actions,
  canViewSecurity,
  onClose,
  onApply,
}: {
  open: boolean;
  values: FilterValues;
  areas: string[];
  admins: AuditAdminOption[];
  actions: Array<{ action: string; action_label: string }>;
  canViewSecurity: boolean;
  onClose: () => void;
  onApply: (values: FilterValues) => void;
}) {
  const [draft, setDraft] = useState<FilterValues>(values);

  useEffect(() => setDraft(values), [values, open]);
  if (!open) return null;

  function set<K extends keyof FilterValues>(key: K, value: FilterValues[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[90]" role="dialog" aria-modal="true" aria-label="Audit filters">
      <button className="absolute inset-0 bg-black/65 backdrop-blur-sm" onClick={onClose} aria-label="Close filters" />
      <aside className="absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#120d1d] text-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-white/10 p-5">
          <div><h2 className="flex items-center gap-2 text-xl font-black"><Filter className="h-5 w-5 text-cyan-200" /> Filter audit activity</h2><p className="mt-1 text-sm text-white/50">Filters stay in the URL, so the view can be bookmarked.</p></div>
          <button onClick={onClose} className="rounded-xl border border-white/10 p-2.5 hover:bg-white/10" aria-label="Close filters"><X className="h-5 w-5" /></button>
        </header>

        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Area"><select className={inputClass} value={draft.area} onChange={(event) => set("area", event.target.value)}><option value="">All areas</option>{areas.map((area) => <option key={area} value={area}>{area.replaceAll("_", " ")}</option>)}</select></Field>
            <Field label="Admin"><select className={inputClass} value={draft.admin_id} onChange={(event) => set("admin_id", event.target.value)}><option value="">All admins</option>{admins.map((admin) => <option key={admin.admin_id} value={admin.admin_id}>{admin.admin_name || admin.admin_email || "Admin"}</option>)}</select></Field>
            <Field label="Action"><select className={inputClass} value={draft.action} onChange={(event) => set("action", event.target.value)}><option value="">All actions</option>{actions.map((action) => <option key={action.action} value={action.action}>{action.action_label}</option>)}</select></Field>
            <Field label="Record type"><input className={inputClass} value={draft.record_type} onChange={(event) => set("record_type", event.target.value)} placeholder="document, contact, event…" /></Field>
            <Field label="Status"><select className={inputClass} value={draft.status} onChange={(event) => set("status", event.target.value)}><option value="">All statuses</option><option value="success">Success</option><option value="failed,partial_success">Failed / partial</option><option value="blocked">Blocked</option><option value="warning">Warning</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option></select></Field>
            <Field label="Risk"><select className={inputClass} value={draft.risk} onChange={(event) => set("risk", event.target.value)}><option value="">All risk levels</option><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option><option value="high,critical">High and critical</option></select></Field>
            <Field label="Date from"><input type="datetime-local" className={inputClass} value={draft.date_from} onChange={(event) => set("date_from", event.target.value)} /></Field>
            <Field label="Date to"><input type="datetime-local" className={inputClass} value={draft.date_to} onChange={(event) => set("date_to", event.target.value)} /></Field>
          </div>

          <div className="mt-5 space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            {canViewSecurity && <label className="flex items-center gap-3 text-sm font-bold text-white/75"><input type="checkbox" checked={draft.security_only === "true"} onChange={(event) => set("security_only", event.target.checked ? "true" : "")} /> Security events only</label>}
            <label className="flex items-center gap-3 text-sm font-bold text-white/75"><input type="checkbox" checked={draft.review_only === "true"} onChange={(event) => set("review_only", event.target.checked ? "true" : "")} /> Events requiring review only</label>
          </div>
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5">
          <button type="button" onClick={() => setDraft(EMPTY_FILTERS)} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black text-white/65 hover:bg-white/10"><RotateCcw className="h-4 w-4" /> Reset</button>
          <div className="flex gap-2"><button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-black hover:bg-white/10">Cancel</button><button type="button" onClick={() => onApply(draft)} className="rounded-xl bg-cyan-300 px-5 py-2.5 text-sm font-black text-slate-950 hover:bg-cyan-200">Apply filters</button></div>
        </footer>
      </aside>
    </div>
  );
}
